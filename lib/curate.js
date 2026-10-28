/**
 * AI 精选：把清洗后的候选来源交给当前会话模型，产出「摘要 + 精选排序 + 理由」。
 *
 * 设计要点：
 * - 只允许模型引用候选里的 URL，返回后逐条对齐；对不上的一律丢弃，避免幻觉链接。
 * - 任何一步失败都返回可用的降级结果（启发式排序），不让整个搜索失败。
 * - 模型路由优先跟随 Harness 默认模型（agentDefaultModel），拿不到时回退到
 *   llm 服务里第一个可用 provider 的第一个模型。
 */

import { createError } from './errors.js'
import { isTrustedDomain, queryTerms } from './filters.js'
import { extractExcerpt } from './html-text.js'

/** 摘要最大长度，防止模型跑题写成文章。 */
const MAX_SUMMARY_CHARS = 900
/** 推荐理由最大长度。 */
const MAX_REASON_CHARS = 200
/** 候选来源传给模型的条数上限。 */
const MAX_CANDIDATES = 12
/** 候选正文摘录长度上限。 */
const MAX_EXCERPT_CHARS = 700

/**
 * 判断文本主要语言，用于让摘要跟随问题语言。
 * @param {string} text
 * @returns {'zh' | 'en'}
 */
export function languageOf(text) {
  return /[\u3400-\u9fff]/.test(String(text ?? '')) ? 'zh' : 'en'
}

/**
 * 系统提示词：约束输出为可解析 JSON，并禁止编造链接。
 * @param {'zh' | 'en'} language 输出语言（来自设置；不是问题语言）。
 * @returns {string}
 */
function systemPrompt(language) {
  if (language === 'zh') {
    return [
      '你是「AI 搜索」的检索编辑。你会收到一个检索问题，以及若干候选网页（标题、链接、摘要，部分附带正文摘录）。',
      '你的任务：判断哪些来源真正值得读，给出直接回答问题的摘要，并按价值排序。',
      '输出语言：必须使用简体中文，即使问题和候选网页使用其他语言，summary、reason、alert 也全部用中文。',
      '只输出一个 JSON 对象，不要 Markdown 代码块，不要任何解释文字。JSON 结构：',
      '{"summary":"2-4 句，直接回答或概括问题，不写“根据以上来源”之类套话","picks":[{"url":"候选链接原样复制","reason":"一句话说明这条为什么值得读，要具体","score":0到100的整数}],"alert":"可选：候选信息不足或存在争议时的一句话提醒"}',
      '规则：',
      '1. picks 选 3-6 条，按价值从高到低；只能使用候选里出现过的 url，逐字复制，禁止编造或改写。',
      '2. 优先一手来源、官方文档、权威媒体；排斥营销稿、内容农场、重复转载和纯商品页。',
      '3. 同一内容的不同语言版本（本地化页面）只保留最权威的一份，不要重复占位。',
      '4. 若候选不足以回答问题，summary 仍要给出能确定的部分，并用 alert 说明还缺什么。',
      '5. 只依据候选内容作答，不要引入候选之外的事实；不要输出网址之外的链接格式。',
    ].join('\n')
  }
  return [
    'You are the retrieval editor of an "AI Search" engine. You receive one search question and a set of candidate pages (title, URL, snippet, sometimes a body excerpt).',
    'Decide which sources are genuinely worth reading, write a summary that answers the question directly, and rank the sources by value.',
    'Output language: English only. Write summary, reason and alert in English even when the question or the candidate pages use another language.',
    'Output exactly one JSON object, no Markdown fence and no prose. Shape:',
    '{"summary":"2-4 sentences answering or summarizing the question, no filler","picks":[{"url":"copy a candidate URL verbatim","reason":"one concrete sentence on why it is worth reading","score":0-100 integer}],"alert":"optional one-line caveat when candidates are insufficient or conflicting"}',
    'Rules:',
    '1. Choose 3-6 picks ordered by value. Only use URLs that appear in the candidates, copied verbatim; never invent or rewrite a URL.',
    '2. Prefer primary sources, official docs and authoritative outlets; reject marketing pieces, content farms and duplicated reposts.',
    '3. For the same content in several languages (localized pages) keep only the most authoritative one; do not fill several slots with translations.',
    '4. If candidates cannot answer the question, summarize what is certain and use alert to state what is missing.',
    '5. Use only the candidates; do not add outside facts.',
  ].join('\n')
}

/**
 * 把候选来源整理成模型输入（JSON），id 只用于本地对齐。
 * @param {string} query
 * @param {ReadonlyArray<object>} sources
 * @param {Map<string, { url: string, text: string }>} pages
 * @param {'zh' | 'en'} language 输出语言。
 * @returns {string}
 */
function buildUserPayload(query, sources, pages, language) {
  const candidates = sources.slice(0, MAX_CANDIDATES).map((source, index) => {
    const page = pages.get(source.canonical)
    const excerpt = page === undefined ? '' : extractExcerpt(page.text, queryTerms(query), MAX_EXCERPT_CHARS)
    return {
      id: index + 1,
      url: source.url,
      title: source.title,
      domain: source.domain,
      snippet: source.snippet.slice(0, 400),
      ...(source.publishedAt === '' ? {} : { publishedAt: source.publishedAt }),
      ...(excerpt === '' ? {} : { excerpt }),
    }
  })
  return JSON.stringify({
    question: query,
    outputLanguage: language,
    candidates,
  })
}

/**
 * 从模型输出里抠出 JSON 对象文本。
 * @param {string} text
 * @returns {string | null}
 */
function findJsonObject(text) {
  const start = text.indexOf('{')
  if (start === -1) return null
  let depth = 0
  let inString = false
  let escaped = false
  for (let index = start; index < text.length; index += 1) {
    const char = text[index]
    if (inString) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') inString = true
    else if (char === '{') depth += 1
    else if (char === '}') {
      depth -= 1
      if (depth === 0) return text.slice(start, index + 1)
    }
  }
  return null
}

/**
 * 清理模型给出的单行文本。
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
 * 分数归一化到 0-100。
 * @param {unknown} value
 * @param {number} fallback
 * @returns {number}
 */
function normalizeScore(value, fallback) {
  const numeric = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''))
  if (!Number.isFinite(numeric)) return fallback
  return Math.max(0, Math.min(100, Math.round(numeric)))
}

/**
 * 把模型输出解析成可展示的精选结构。
 *
 * @param {string} raw 模型原始输出。
 * @param {ReadonlyArray<object>} sources 清洗后的候选来源（含 canonical）。
 * @param {Map<string, { url: string, text: string }>} pages 正文缓存。
 * @param {string} query
 * @param {number} maxPicks
 * @returns {{ summary: string, picks: Array<object>, alert: string, ai: boolean }}
 */
export function parseCuration(raw, sources, pages, query, maxPicks) {
  const jsonText = findJsonObject(raw)
  let parsed = null
  if (jsonText !== null) {
    try {
      parsed = JSON.parse(jsonText)
    } catch {
      parsed = null
    }
  }
  const summaryFallback = oneLine(raw.split(/\n+/).find((line) => line.trim() !== ''), MAX_SUMMARY_CHARS)
  const summary = oneLine(parsed?.summary, MAX_SUMMARY_CHARS) || summaryFallback
  const alert = oneLine(parsed?.alert, 240)

  const byUrl = new Map()
  const byTitle = new Map()
  for (const source of sources) {
    byUrl.set(source.url, source)
    byUrl.set(source.canonical, source)
    byTitle.set(source.title.toLowerCase(), source)
  }

  const picks = []
  const used = new Set()
  const rawPicks = Array.isArray(parsed?.picks) ? parsed.picks : []
  for (const entry of rawPicks) {
    if (entry === null || typeof entry !== 'object') continue
    const rawUrl = typeof entry.url === 'string' ? entry.url.trim() : ''
    let source = byUrl.get(rawUrl)
    if (source === undefined && rawUrl !== '') {
      // 模型偶尔会补全成 https:// 或加 www；按域名+路径再匹配一次。
      const withoutProtocol = rawUrl.replace(/^https?:\/\//i, '').replace(/^www\./i, '')
      source = byUrl.get(withoutProtocol)
      if (source === undefined) {
        for (const candidate of sources) {
          if (candidate.canonical === withoutProtocol || candidate.url === rawUrl) {
            source = candidate
            break
          }
        }
      }
    }
    if (source === undefined) {
      const title = typeof entry.title === 'string' ? entry.title.toLowerCase().trim() : ''
      source = byTitle.get(title)
    }
    if (source === undefined || used.has(source.canonical)) continue
    used.add(source.canonical)
    const page = pages.get(source.canonical)
    const excerpt = page === undefined ? source.snippet : extractExcerpt(page.text, queryTerms(query), 360)
    picks.push({
      url: source.url,
      title: source.title,
      domain: source.domain,
      snippet: source.snippet,
      excerpt,
      reason: oneLine(entry.reason, MAX_REASON_CHARS),
      score: normalizeScore(entry.score, Math.max(55, 96 - picks.length * 7)),
      trusted: isTrustedDomain(source.domain),
    })
    if (picks.length >= maxPicks) break
  }

  return { summary, picks, alert, ai: true }
}

/**
 * 读取当前可用的模型路由。
 * @param {object} ctx Host 上下文。
 * @param {object} llm llm 服务。
 * @returns {Promise<{ provider: string, model: string }>}
 */
export async function resolveModelRoute(ctx, llm) {
  const preferred = ctx.get('agentDefaultModel')?.currentSelection?.()
  let providerIds = []
  try {
    const providers = typeof llm.listProviders === 'function' ? llm.listProviders() : []
    providerIds = (Array.isArray(providers) ? providers : []).map((entry) => entry?.id).filter((id) => typeof id === 'string' && id !== '')
  } catch {
    providerIds = []
  }
  if (preferred !== undefined && preferred !== null && typeof preferred.provider === 'string' && typeof preferred.model === 'string' && preferred.provider !== '' && preferred.model !== '') {
    if (providerIds.length === 0 || providerIds.includes(preferred.provider)) {
      return { provider: preferred.provider, model: preferred.model }
    }
  }
  for (const provider of providerIds) {
    try {
      const models = await llm.listModels(provider)
      const model = Array.isArray(models) ? models[0]?.id : undefined
      if (typeof model === 'string' && model !== '') return { provider, model }
    } catch {
      /* 试下一个 provider */
    }
  }
  throw createError('AI_ROUTE_UNAVAILABLE', '没有可用的模型路由，AI 精选不可用')
}

/**
 * 调一次模型做精选。任何失败都抛错，由调用方决定是否降级。
 *
 * @param {object} ctx Host 上下文。
 * @param {object} llm llm 服务。
 * @param {{ query: string, sources: ReadonlyArray<object>, pages: Map<string, { url: string, text: string }>, maxPicks: number, language?: 'zh' | 'en', signal: AbortSignal | undefined }} options
 * @returns {Promise<{ summary: string, picks: Array<object>, alert: string, ai: boolean, model: string }>}
 */
export async function curateWithLlm(ctx, llm, options) {
  const route = await resolveModelRoute(ctx, llm)
  const language = options.language ?? languageOf(options.query)
  const messages = [
    {
      role: 'user',
      content: [{ type: 'text', text: buildUserPayload(options.query, options.sources, options.pages, language) }],
    },
  ]
  const system = systemPrompt(language)
  const baseOptions = {
    provider: route.provider,
    model: route.model,
    maxTokens: 1400,
    temperature: 0.2,
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(new Error('AI 精选超时')), 40000)
  const signal = options.signal === undefined ? controller.signal : AbortSignal.any([options.signal, controller.signal])
  try {
    let streamOptions
    let stream
    if (typeof llm.prepareCall === 'function') {
      const call = await llm.prepareCall(baseOptions, signal, (controls, model) => {
        const effort = model?.reasoning?.efforts?.[0]?.id
        return effort === undefined ? { ...controls } : { ...controls, reasoningEffort: effort }
      })
      streamOptions = { ...call.config, messages, system, signal }
      stream = call.stream(streamOptions)
    } else {
      streamOptions = { ...baseOptions, messages, system, signal }
      stream = llm.stream(streamOptions)
    }

    let text = ''
    let finishReason = undefined
    const blocks = []
    for await (const chunk of stream) {
      if (chunk === null || typeof chunk !== 'object') continue
      if (chunk.type === 'text-delta' && typeof chunk.text === 'string') text += chunk.text
      else if (chunk.type === 'block-end' && chunk.block !== undefined) blocks.push(chunk.block)
      else if (chunk.type === 'finish') finishReason = chunk.reason
    }
    if (text.trim() === '' && blocks.length > 0) {
      text = blocks.filter((block) => block?.type === 'text').map((block) => block.text).join('')
    }
    if (finishReason !== undefined && (finishReason.kind === 'error' || finishReason.kind === 'aborted')) {
      const message = finishReason.failure?.message ?? 'AI 调用失败'
      throw createError('AI_CALL_FAILED', message)
    }
    if (text.trim() === '') throw createError('AI_EMPTY_RESPONSE', 'AI 没有返回内容')

    const parsed = parseCuration(text, options.sources, options.pages, options.query, options.maxPicks)
    return { ...parsed, model: `${route.provider}/${route.model}` }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw createError('AI_ABORTED', 'AI 精选被取消或超时')
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * 降级精选：AI 不可用时用启发式排序撑住页面，明确标记 ai:false。
 *
 * @param {{ query: string, sources: ReadonlyArray<object>, pages: Map<string, { url: string, text: string }>, providerContent: string, aiError: string, maxPicks: number, language?: 'zh' | 'en' }} options
 * @returns {{ summary: string, picks: Array<object>, alert: string, ai: boolean, model: null }}
 */
export function fallbackCuration(options) {
  const language = options.language ?? languageOf(options.query)
  const total = options.sources.length
  const fromProvider = oneLine(options.providerContent, MAX_SUMMARY_CHARS)
  const summary =
    fromProvider !== ''
      ? fromProvider
      : language === 'zh'
        ? `已联网检索并按相关度筛出 ${total} 个来源，以下是其中质量最高的参考。AI 精排暂不可用，排序依据为来源权威性、关键词相关性与内容完整度。`
        : `Retrieved ${total} sources and ranked them by authority, query relevance and content completeness. AI ranking is unavailable, so this is a heuristic ordering.`
  const picks = []
  for (const source of options.sources.slice(0, options.maxPicks)) {
    const page = options.pages.get(source.canonical)
    const excerpt = page === undefined ? source.snippet : extractExcerpt(page.text, queryTerms(options.query), 360)
    const trusted = isTrustedDomain(source.domain)
    picks.push({
      url: source.url,
      title: source.title,
      domain: source.domain,
      snippet: source.snippet,
      excerpt,
      reason:
        language === 'zh'
          ? trusted
            ? '权威/一手来源，可直接参考'
            : page !== undefined
              ? '已精读正文，信息密度较高'
              : '与问题的关键词相关度较高'
          : trusted
            ? 'Authoritative/primary source'
            : page !== undefined
              ? 'Body was read; high information density'
              : 'High keyword relevance',
      score: Math.max(50, 92 - picks.length * 7),
      trusted,
    })
  }
  return {
    summary,
    picks,
    alert: options.aiError === '' ? '' : language === 'zh' ? `AI 精选不可用：${options.aiError}` : `AI ranking unavailable: ${options.aiError}`,
    ai: false,
    model: null,
  }
}
