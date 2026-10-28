/**
 * 百科条目：双路检索 → 清洗排序 → 精读正文 → AI 撰写 → 校验/降级。
 *
 * 流水线：
 *   1. 用原检索词和「检索词 + 百科 / wiki encyclopedia」并行搜两次，合并去重；
 *   2. 复用 filters.js 做广告过滤、重复折叠与相关度排序，百科类站点优先；
 *   3. 精读排名最靠前的 2 个页面（总预算 6 秒），拿到正文摘录；
 *   4. 让模型按百度百科的风格写条目（标题 / 概述 / 小节 / 参考链接）；
 *   5. 严格校验模型输出：只允许引用候选里的链接，任何异常都退化成来源摘要。
 *
 * 约定：AI 失败只降级、不抛错；只有「缺少联网服务 / 参数非法 / 调用方取消」才抛出。
 */

import { createError, isAbortError } from './errors.js'
import { canonicalizeUrl, filterSources, projectSource, queryTerms } from './filters.js'
import { extractExcerpt, htmlToText } from './html-text.js'
import { parseJsonObject, runModelJson } from './model-json.js'

/** 每路检索请求的结果数。 */
const SEARCH_MAX_RESULTS = 10
/** 检索阶段超时。 */
const SEARCH_PHASE_MS = 20000
/** 单页抓取超时。 */
const FETCH_TIMEOUT_MS = 5000
/** 精读阶段总预算：到点就用已读到的正文继续。 */
const READ_BUDGET_MS = 6000
/** 可视为有效正文的最短字符数。 */
const MIN_PAGE_CHARS = 220
/** 精读的页面数。 */
const MAX_READ_PAGES = 2
/** 送给模型的候选条数。 */
const MAX_CANDIDATES = 10
/** 候选正文摘录长度。 */
const MAX_EXCERPT_CHARS = 900
/** 单个小节的正文长度上限。 */
const MAX_BODY_CHARS = 1200
/** 参考链接数量上限。 */
const MAX_REFERENCES = 8
/** 小节数量上限。 */
const MAX_SECTIONS = 10
/** AI 阶段超时。 */
const AI_TIMEOUT_MS = 40000
/** 百科条目的合法详细程度。 */
const VALID_DETAILS = ['brief', 'standard', 'detailed']
/** 详细程度 → 输出 token 上限。 */
const DETAIL_MAX_TOKENS = { brief: 1200, standard: 2000, detailed: 3200 }

/** 百科/工具书类域名后缀：排序时优先。 */
const ENCYCLOPEDIA_SUFFIXES = [
  'wikipedia.org',
  'wikidata.org',
  'baike.baidu.com',
  'baike.sogou.com',
  'britannica.com',
  'wikiwand.com',
  'fandom.com',
  'zh.wikipedia.org',
  'en.wikipedia.org',
  'baike.com',
  'sogou.com',
]

/** 各详细程度的小节要求，写进系统提示词。 */
const DETAIL_INSTRUCTIONS = {
  zh: {
    brief: '详细程度：简版。写 3-4 个小节，每节 1-2 句，只保留最核心的信息。',
    standard: '详细程度：标准。写 5-6 个小节，每节 2-3 句，兼顾定义、背景与主要应用。',
    detailed: '详细程度：详版。写 7-9 个小节，内容更充实，覆盖背景、技术细节、应用、影响、争议等方面。',
  },
  en: {
    brief: 'Detail level: brief. Write 3-4 sections, 1-2 sentences each, keeping only the core facts.',
    standard: 'Detail level: standard. Write 5-6 sections, 2-3 sentences each, covering definition, background and main applications.',
    detailed: 'Detail level: detailed. Write 7-9 sections with richer content, covering background, technical details, applications, impact and controversy.',
  },
}

/**
 * 组合父取消信号与阶段超时；父信号可以为 undefined。
 * @param {AbortSignal | undefined} signal
 * @returns {(ms: number) => AbortSignal}
 */
function makePhaseSignal(signal) {
  return (ms) => {
    const timeout = AbortSignal.timeout(Math.max(1, ms))
    return signal === undefined || signal === null ? timeout : AbortSignal.any([signal, timeout])
  }
}

/**
 * 给一个 Promise 加总预算：到点就继续，不等它完成；timer 不阻止进程退出。
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @returns {Promise<void>}
 */
function raceBudget(promise, ms) {
  return new Promise((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve()
    }
    const timer = setTimeout(finish, Math.max(1, ms))
    if (typeof timer.unref === 'function') timer.unref()
    promise.then(finish, finish)
  })
}

/**
 * 安全读取 ctx 上的服务。
 * @param {object} ctx
 * @param {string} name
 * @returns {any}
 */
function safeCtxGet(ctx, name) {
  if (ctx === null || typeof ctx !== 'object' || typeof ctx.get !== 'function') return undefined
  try {
    return ctx.get(name)
  } catch {
    return undefined
  }
}

/**
 * 归一化检索词。
 * @param {unknown} raw
 * @returns {string}
 */
function normalizeQuery(raw) {
  const text = typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim() : ''
  if (text === '') throw createError('INVALID_QUERY', '缺少检索词')
  if (text.length > 300) throw createError('INVALID_QUERY', '检索词过长（最多 300 字）')
  return text
}

/**
 * 输出语言只由调用方参数决定（不从检索词推断）；无法识别时按中文处理。
 * @param {unknown} language
 * @returns {'zh' | 'en'}
 */
function normalizeLanguage(language) {
  return typeof language === 'string' && language.trim().toLowerCase().startsWith('en') ? 'en' : 'zh'
}

/**
 * 归一化详细程度。
 * @param {unknown} detail
 * @returns {'brief' | 'standard' | 'detailed'}
 */
function normalizeDetail(detail) {
  return VALID_DETAILS.includes(detail) ? detail : 'standard'
}

/**
 * 中文单行化并限长。
 * @param {unknown} value
 * @param {number} limit
 * @returns {string}
 */
function oneLine(value, limit) {
  if (typeof value !== 'string') return ''
  const text = value.replace(/\s+/g, ' ').trim()
  return text.length > limit ? `${text.slice(0, limit)}…` : text
}

/**
 * 模型没给概述时，从原始输出里找第一行有意义的文本。
 * @param {string} text
 * @param {number} limit
 * @returns {string}
 */
function firstMeaningfulLine(text, limit) {
  if (typeof text !== 'string') return ''
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed === '') continue
    if (/^(?:```|~~~)/.test(trimmed)) continue
    if (/^[{}\[\],]+$/.test(trimmed)) continue
    return oneLine(trimmed, limit)
  }
  return ''
}

/**
 * 域名是否命中百科类后缀。
 * @param {string} domain
 * @returns {boolean}
 */
function isEncyclopediaDomain(domain) {
  const host = typeof domain === 'string' ? domain.toLowerCase() : ''
  if (host === '') return false
  return ENCYCLOPEDIA_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`))
}

/**
 * 去掉协议与 www，用于把模型补全过的链接对回候选。
 * @param {string} url
 * @returns {string}
 */
function bareUrl(url) {
  return String(url ?? '')
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
}

/**
 * 取错误信息文本。
 * @param {unknown} error
 * @returns {string}
 */
function messageOf(error) {
  if (error instanceof Error && error.message !== '') return error.message
  return String(error)
}

/**
 * 系统提示词：语言与详细程度都由参数决定。
 * @param {'zh' | 'en'} language
 * @param {'brief' | 'standard' | 'detailed'} detail
 * @returns {string}
 */
function systemPrompt(language, detail) {
  const instruction = DETAIL_INSTRUCTIONS[language][detail]
  if (language === 'zh') {
    return [
      '你是「百科」条目的撰写者。你会收到一个词条名，以及若干候选网页（标题、链接、摘要，部分附带正文摘录）。',
      '你的任务：写出一条类似百度百科的条目，中立、信息密度高、结构清晰。',
      '输出语言：必须使用简体中文，即使候选网页使用其他语言。',
      '只输出一个 JSON 对象，不要 Markdown 代码块，不要任何解释文字。JSON 结构：',
      '{"title":"词条名","lead":"2-4 句概述：这是什么、做什么、为什么重要","sections":[{"heading":"小节标题","body":"小节正文"}],"referenceUrls":["候选里逐字出现的链接"]}',
      '规则：',
      '1. 语气中立客观，像百科全书；禁止营销文案、广告语、第一人称（我们/我认为）、感叹号和“小编”口吻。',
      '2. 只能使用候选里出现的事实；候选没写的内容不要补；绝对禁止编造数字、日期、人名、版本号或链接。',
      '3. 小节标题要贴近主题（例如 概述/背景/发展/技术/应用/影响/争议），按内容取舍，不要用“一、二、三”编号。',
      '4. referenceUrls 只填候选里逐字出现的 url，最多 8 条；没有合适的就留空数组。',
      '5. 候选信息不足时只写能确认的部分，不要为了凑字数而扩写。',
      instruction,
    ].join('\n')
  }
  return [
    'You write encyclopedia entries. You receive one entry title and several candidate pages (title, URL, snippet, sometimes a body excerpt).',
    'Your task: write a Baidu-Baike-style entry that is neutral, dense and clearly structured.',
    'Output language: English only, even when the candidate pages are in another language.',
    'Output exactly one JSON object, no Markdown fence and no prose. Shape:',
    '{"title":"entry title","lead":"2-4 sentences: what it is, what it does, why it matters","sections":[{"heading":"topical heading","body":"section text"}],"referenceUrls":["candidate URLs copied verbatim"]}',
    'Rules:',
    '1. Neutral encyclopedic tone; no marketing language, no first person (we/I), no exclamation marks.',
    '2. Use only facts that appear in the candidates; never fill gaps from memory, and never invent numbers, dates, people, versions or links.',
    '3. Headings must be topical (e.g. Overview / Background / Development / Technology / Applications / Impact / Controversy), chosen to fit the subject; do not number them.',
    '4. referenceUrls may only contain candidate URLs copied verbatim, at most 8; leave an empty array when none fit.',
    '5. When the candidates are thin, write only what is verifiable instead of padding.',
    instruction,
  ].join('\n')
}

/**
 * 把模型给的参考链接对回候选来源；一个都对不上时退回前 5 条来源。
 * @param {unknown} rawUrls
 * @param {ReadonlyArray<object>} kept
 * @returns {Array<{ title: string, url: string, domain: string }>}
 */
function buildReferences(rawUrls, kept) {
  const byKey = new Map()
  for (const source of kept.slice(0, MAX_CANDIDATES)) {
    byKey.set(source.url, source)
    byKey.set(source.canonical, source)
    byKey.set(bareUrl(source.url), source)
  }
  const references = []
  const seen = new Set()
  for (const raw of Array.isArray(rawUrls) ? rawUrls : []) {
    if (typeof raw !== 'string') continue
    const key = raw.trim()
    if (key === '') continue
    let source = byKey.get(key)
    if (source === undefined) {
      const info = canonicalizeUrl(key)
      if (info !== null) source = byKey.get(info.canonical) ?? byKey.get(info.url)
    }
    if (source === undefined) continue
    if (seen.has(source.canonical)) continue
    seen.add(source.canonical)
    references.push({ title: source.title, url: source.url, domain: source.domain })
    if (references.length >= MAX_REFERENCES) break
  }
  if (references.length === 0) {
    for (const source of kept.slice(0, 5)) {
      if (seen.has(source.canonical)) continue
      seen.add(source.canonical)
      references.push({ title: source.title, url: source.url, domain: source.domain })
    }
  }
  return references
}

/**
 * 校验并归一化模型给出的条目；不可用时抛错，由调用方降级。
 * @param {object} parsed
 * @param {string} rawText 模型原始输出（概述缺失时取第一行兜底）。
 * @param {ReadonlyArray<object>} kept
 * @param {string} query
 * @returns {{ title: string, lead: string, sections: Array<{ heading: string, body: string }>, references: Array<object> }}
 */
function buildArticle(parsed, rawText, kept, query) {
  const title = oneLine(parsed?.title, 120) || query
  const lead = oneLine(parsed?.lead, 800) || firstMeaningfulLine(rawText, 400)
  if (lead === '') throw createError('AI_EMPTY_ARTICLE', '模型没有给出概述')
  const sections = []
  for (const entry of Array.isArray(parsed?.sections) ? parsed.sections : []) {
    if (entry === null || typeof entry !== 'object') continue
    const heading = oneLine(entry.heading, 120)
    const body = oneLine(entry.body, MAX_BODY_CHARS)
    if (heading === '' || body === '') continue
    sections.push({ heading, body })
    if (sections.length >= MAX_SECTIONS) break
  }
  if (sections.length === 0) throw createError('AI_EMPTY_ARTICLE', '模型没有给出可用的百科小节')
  return { title, lead, sections, references: buildReferences(parsed?.referenceUrls, kept) }
}

/**
 * AI 不可用时的降级条目：标题用检索词，小节直接来自来源标题与摘要。
 * @param {ReadonlyArray<object>} kept
 * @param {string} query
 * @param {'zh' | 'en'} language
 * @param {string} aiError
 * @returns {{ title: string, lead: string, sections: Array<{ heading: string, body: string }>, references: Array<object> }}
 */
function fallbackArticle(kept, query, language, aiError) {
  const lead =
    language === 'zh'
      ? `暂无 AI 生成的百科内容（${aiError}），以下为检索到的资料来源摘要。`
      : `No AI-generated encyclopedia entry is available (${aiError}). Below are summaries of the retrieved sources.`
  const sections = kept.slice(0, 3).map((source) => ({
    heading: source.title,
    body: source.snippet === '' ? '…' : source.snippet,
  }))
  return { title: query, lead, sections, references: buildReferences([], kept) }
}

/**
 * 运行一次百科生成。
 *
 * @param {object} options
 * @param {object} options.ctx Host 上下文。
 * @param {string} options.query 词条名。
 * @param {'zh' | 'en'} [options.language] 输出语言（不从检索词推断）。
 * @param {'brief' | 'standard' | 'detailed'} [options.detail] 详细程度。
 * @param {AbortSignal} [options.signal] 调用方取消信号。
 * @returns {Promise<object>}
 */
export async function runEncyclopedia({ ctx, query, language, detail, signal } = {}) {
  const web = safeCtxGet(ctx, 'web')
  if (web === null || typeof web !== 'object' || typeof web.search !== 'function') {
    throw createError('WEB_UNAVAILABLE', '当前 Harness 组合没有可用的联网搜索服务（ctx.web）')
  }

  const safeQuery = normalizeQuery(query)
  const outputLanguage = normalizeLanguage(language)
  const detailLevel = normalizeDetail(detail)
  const phaseSignal = makePhaseSignal(signal)

  // ---- 1. 双路检索：原词 + 百科/wiki 限定词 ----
  const queries = [safeQuery, outputLanguage === 'zh' ? `${safeQuery} 百科` : `${safeQuery} wiki encyclopedia`]
  const searchStartedAt = Date.now()
  const searchPhase = phaseSignal(SEARCH_PHASE_MS)
  const settled = await Promise.allSettled(
    queries.map((item) => Promise.resolve().then(() => web.search({ query: item, maxResults: SEARCH_MAX_RESULTS }, searchPhase))),
  )
  const searchMs = Date.now() - searchStartedAt

  const merged = []
  const seen = new Set()
  for (const entry of settled) {
    if (entry.status === 'rejected') {
      // 取消/超时是调用方语义，不能当成“这路搜索没结果”吞掉。
      if (isAbortError(entry.reason)) throw entry.reason
      continue
    }
    const sources = Array.isArray(entry.value?.sources) ? entry.value.sources : []
    for (const raw of sources) {
      if (raw === null || typeof raw !== 'object') continue
      const info = canonicalizeUrl(raw.url)
      const key = info === null ? String(raw.url ?? '').trim() : info.canonical
      if (key === '' || seen.has(key)) continue
      seen.add(key)
      merged.push(raw)
    }
  }

  // ---- 2. 广告过滤 + 相关度排序，百科类站点优先 ----
  const filtered = filterSources(merged, safeQuery, {
    maxKeep: 16,
    maxRemoved: 30,
    // 同一百科站（维基/百度百科）本来就会有多条目，站点上限放宽。
    maxPerDomain: (domain) => (isEncyclopediaDomain(domain) ? 8 : 5),
  })
  const kept = filtered.kept.slice()
  kept.sort((left, right) => {
    const leftRank = isEncyclopediaDomain(left.domain) ? 0 : 1
    const rightRank = isEncyclopediaDomain(right.domain) ? 0 : 1
    return leftRank - rightRank || right.score - left.score
  })

  // ---- 3. 精读前 2 个页面（总预算 6 秒） ----
  const pages = new Map()
  let fetched = 0
  if (typeof web.fetch === 'function' && kept.length > 0) {
    const tasks = kept.slice(0, MAX_READ_PAGES).map(async (source) => {
      try {
        const result = await web.fetch({ url: source.url }, phaseSignal(FETCH_TIMEOUT_MS))
        if (result === null || result === undefined) return
        if (Number.isFinite(result.statusCode) && result.statusCode >= 400) return
        const body = result.body ?? {}
        let text = ''
        if (body.kind === 'html') text = htmlToText(String(body.content ?? ''), { maxChars: 7000 })
        else if (body.kind === 'text') text = String(body.content ?? '').trim()
        if (text.length < MIN_PAGE_CHARS) return
        pages.set(source.canonical, { url: source.url, text })
      } catch {
        // 单页失败（403/超时/非 HTML）不影响整体结果。
      }
    })
    await raceBudget(Promise.allSettled(tasks), READ_BUDGET_MS)
    fetched = pages.size
  }

  // ---- 4. 候选负载 + AI 撰写 ----
  const terms = queryTerms(safeQuery)
  const candidates = kept.slice(0, MAX_CANDIDATES).map((source, index) => {
    const page = pages.get(source.canonical)
    const excerpt = page === undefined ? '' : extractExcerpt(page.text, terms, MAX_EXCERPT_CHARS)
    return {
      id: index + 1,
      url: source.url,
      title: source.title,
      domain: source.domain,
      snippet: source.snippet.slice(0, 400),
      excerpt,
    }
  })

  const llm = safeCtxGet(ctx, 'llm')
  let ai = false
  let aiModel = null
  let aiError = ''
  let aiMs = 0
  /** @type {{ title: string, lead: string, sections: Array<object>, references: Array<object> } | null} */
  let article = null

  if (kept.length === 0) {
    aiError = outputLanguage === 'zh' ? '没有检索到可供撰写的来源' : 'no usable sources were retrieved'
  } else if (llm === null || typeof llm !== 'object') {
    aiError = '当前组合没有可用的模型服务（ctx.llm）'
  } else {
    const aiStartedAt = Date.now()
    try {
      const user = JSON.stringify({ query: safeQuery, detail: detailLevel, outputLanguage, candidates })
      const response = await runModelJson({
        ctx,
        llm,
        system: systemPrompt(outputLanguage, detailLevel),
        user,
        maxTokens: DETAIL_MAX_TOKENS[detailLevel],
        temperature: 0.3,
        signal: phaseSignal(AI_TIMEOUT_MS),
      })
      const parsed = parseJsonObject(response.text)
      if (parsed === null) throw createError('AI_INVALID_JSON', '模型没有返回可解析的百科 JSON')
      article = buildArticle(parsed, response.text, kept, safeQuery)
      ai = true
      aiModel = `${response.provider}/${response.model}`
    } catch (error) {
      // 调用方主动取消要透传；模型失败（含 40 秒超时）一律降级。
      if (signal !== undefined && signal !== null && signal.aborted === true) throw error
      aiError = messageOf(error)
      article = null
    } finally {
      aiMs = Date.now() - aiStartedAt
    }
  }
  if (article === null) article = fallbackArticle(kept, safeQuery, outputLanguage, aiError)

  return {
    ai,
    aiModel: ai ? aiModel : null,
    aiError: aiError === '' ? null : aiError,
    title: article.title,
    lead: article.lead,
    sections: article.sections,
    references: article.references,
    sources: kept.map(projectSource),
    removed: filtered.removed,
    stats: {
      raw: merged.length,
      kept: kept.length,
      removed: filtered.removed.length,
      fetched,
      searchMs,
      aiMs,
    },
  }
}
