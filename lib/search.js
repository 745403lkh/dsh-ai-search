/**
 * AI 搜索的 Host 侧流水线，共有三个模式：
 *
 * - `qa`（答疑）：联网检索 → 广告过滤 → 精读正文 → AI 摘要与推荐排序（lib/curate.js）。
 * - `encyclopedia`（百科）：围绕百科与权威来源检索，按档位生成百科体例的条目（lib/encyclopedia.js）。
 * - `browse`（浏览）：像搜索引擎信息流一样分综合/视频/图片/文章，按相关性/时效性/热度
 *    三指标加权排序，支持「下一页」追加（lib/browse.js）。
 *
 * 三个模式共用：问题校验、结果语言解析、内存缓存、搜索历史记录与统一响应外壳。
 */

import { createError, isAbortError } from './errors.js'
import { filterSources, projectSource } from './filters.js'
import { extractHtmlTitle, htmlToText } from './html-text.js'
import { curateWithLlm, fallbackCuration, languageOf } from './curate.js'
import { normalizeBrowseWeights } from './settings.js'
import { runEncyclopedia } from './encyclopedia.js'
import { runBrowse } from './browse.js'

/** 支持的搜索模式。 */
export const SEARCH_MODES = ['qa', 'encyclopedia', 'browse']

/** 浏览模式最多追加到第几页（每页都消耗检索与模型配额）。 */
export const BROWSE_MAX_PAGE = 5

/** 默认参数；作为 `createSearchService` 的可覆盖项。 */
export const SEARCH_DEFAULTS = {
  /** 向搜索提供方请求的候选数量（qa / 百科）。 */
  maxResults: 12,
  /** 最多精读多少个页面。 */
  fetchTop: 2,
  /** 单页抓取超时。 */
  fetchTimeoutMs: 5000,
  /** 精读阶段的总预算：到点就用已读到的页面继续，不被单个慢站拖住。 */
  readBudgetMs: 6000,
  /** 联网检索超时。 */
  searchTimeoutMs: 45000,
  /** AI 调用超时。 */
  aiTimeoutMs: 40000,
  /** 整个请求的超时。 */
  totalTimeoutMs: 90000,
  /** 答疑模式精选条数上限。 */
  maxPicks: 6,
  /** 结果缓存时长。 */
  cacheTtlMs: 10 * 60 * 1000,
  /** 缓存条目上限。 */
  cacheMaxEntries: 60,
}

/** 不值得抓正文的文件类型。 */
const BINARY_URL_PATTERN = /\.(pdf|docx?|xlsx?|pptx?|zip|rar|7z|tar|gz|mp4|mov|mp3|wav|apk|exe|dmg|iso|bin)(?:$|[?#])/i

/**
 * 组合父取消信号与阶段超时。
 * @param {AbortSignal | undefined} parent
 * @param {number} ms
 * @returns {AbortSignal}
 */
function phaseSignal(parent, ms) {
  const timeout = AbortSignal.timeout(Math.max(1000, ms))
  return parent === undefined ? timeout : AbortSignal.any([parent, timeout])
}

/**
 * 校验并归一化检索问题。
 * @param {unknown} raw
 * @returns {string}
 */
function normalizeQuery(raw) {
  if (typeof raw !== 'string') throw createError('INVALID_QUERY', '缺少检索问题')
  const query = raw.replace(/\s+/g, ' ').trim()
  if (query === '') throw createError('INVALID_QUERY', '检索问题不能为空')
  if (query.length > 300) throw createError('INVALID_QUERY', '检索问题过长（最多 300 字）')
  return query
}

/**
 * 归一化模式；未知值回退答疑。
 * @param {unknown} raw
 * @returns {'qa' | 'encyclopedia' | 'browse'}
 */
function normalizeMode(raw) {
  return typeof raw === 'string' && SEARCH_MODES.includes(raw) ? raw : 'qa'
}

/**
 * 归一化候选数量。
 * @param {unknown} raw
 * @param {number} fallback
 * @returns {number}
 */
function normalizeMaxResults(raw, fallback) {
  const numeric = typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? ''), 10)
  if (!Number.isFinite(numeric)) return fallback
  return Math.max(5, Math.min(20, Math.round(numeric)))
}

/**
 * 归一化浏览模式的页码。
 * @param {unknown} raw
 * @returns {number}
 */
function normalizePage(raw) {
  const numeric = typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? ''), 10)
  if (!Number.isFinite(numeric)) return 1
  return Math.max(1, Math.min(BROWSE_MAX_PAGE, Math.round(numeric)))
}

/**
 * 归一化「已看过」链接列表（浏览模式翻页去重用）。
 * @param {unknown} raw
 * @returns {string[]}
 */
function normalizeExclude(raw) {
  if (!Array.isArray(raw)) return []
  const unique = new Set()
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const url = item.trim()
    if (url === '' || url.length > 2000) continue
    unique.add(url)
    if (unique.size >= 120) break
  }
  return [...unique]
}

/**
 * 给一个 Promise 加总预算：到点就返回，不等它完成。
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @returns {Promise<void>}
 */
function raceBudget(promise, ms) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, Math.max(1000, ms))
    if (typeof timer.unref === 'function') timer.unref()
    promise.finally(() => {
      clearTimeout(timer)
      resolve()
    })
  })
}

/**
 * 把调用方传来的界面语言归一化成 zh / en；无法识别时返回 undefined。
 * @param {unknown} value
 * @returns {'zh' | 'en' | undefined}
 */
function normalizeLanguageHint(value) {
  if (typeof value !== 'string') return undefined
  const tag = value.trim().toLowerCase()
  if (tag === 'zh' || tag.startsWith('zh-') || tag.startsWith('zh_')) return 'zh'
  if (tag === 'en' || tag.startsWith('en-') || tag.startsWith('en_')) return 'en'
  return undefined
}

/**
 * 取当前时刻的毫秒数（测试可替换）。
 * @returns {number}
 */
function now() {
  return Date.now()
}

/** 默认浏览权重（设置读取失败时使用）。 */
const DEFAULT_BROWSE_WEIGHTS = { relevance: 40, timeliness: 30, heat: 30 }

/**
 * 创建搜索服务。返回对象是插件对外的唯一能力面：
 * HTTP 路由和 `curated_search` 工具都调用 `search()`。
 *
 * @param {object} ctx Host Cordis 上下文。
 * @param {Partial<typeof SEARCH_DEFAULTS>} [overrides]
 * @returns {{ search: Function, describe: Function, config: typeof SEARCH_DEFAULTS }}
 */
export function createSearchService(ctx, overrides = {}) {
  const config = { ...SEARCH_DEFAULTS, ...overrides }
  /** @type {Map<string, { value: object, expiresAt: number }>} */
  const cache = new Map()

  /**
   * 读取设置快照；失败时回退默认值。
   * @returns {{ language: string, encyclopediaDetail: string, browseWeights: object, preserveState: boolean }}
   */
  function settingsSnapshot() {
    try {
      if (config.settings !== undefined && typeof config.settings.get === 'function') {
        const settings = config.settings.get()
        return {
          language: settings.language === 'zh' || settings.language === 'en' ? settings.language : 'auto',
          encyclopediaDetail:
            settings.encyclopediaDetail === 'brief' || settings.encyclopediaDetail === 'detailed' ? settings.encyclopediaDetail : 'standard',
          browseWeights: normalizeBrowseWeights(settings.browseWeights),
          preserveState: settings.preserveState !== false,
        }
      }
    } catch {
      /* 设置不可用时用默认值 */
    }
    return {
      language: 'auto',
      encyclopediaDetail: 'standard',
      browseWeights: { ...DEFAULT_BROWSE_WEIGHTS },
      preserveState: true,
    }
  }

  /**
   * 选出值得精读的页面：分数高、域名不重复、不是二进制文件。
   * @param {ReadonlyArray<object>} sources
   * @returns {Array<object>}
   */
  function pickReadTargets(sources) {
    const targets = []
    const domains = new Set()
    for (const source of sources) {
      if (targets.length >= config.fetchTop) break
      if (BINARY_URL_PATTERN.test(source.url)) continue
      if (domains.has(source.domain)) continue
      domains.add(source.domain)
      targets.push(source)
    }
    return targets
  }

  /**
   * 并发精读页面正文；单页失败只丢这一页，整段最多等 readBudgetMs。
   * @param {ReadonlyArray<object>} sources
   * @param {AbortSignal | undefined} parent
   * @returns {Promise<Map<string, { url: string, text: string }>>}
   */
  async function readPages(sources, parent) {
    const web = ctx.get('web')
    if (web === undefined || typeof web.fetch !== 'function') return new Map()
    const targets = pickReadTargets(sources)
    if (targets.length === 0) return new Map()
    const pages = new Map()
    const tasks = targets.map(async (source) => {
      try {
        const result = await web.fetch({ url: source.url }, phaseSignal(parent, config.fetchTimeoutMs))
        if (result === undefined || result === null || result.statusCode >= 400) return
        const body = result.body ?? {}
        let text = ''
        let title = ''
        if (body.kind === 'html') {
          text = htmlToText(String(body.content ?? ''), { maxChars: 7000 })
          title = extractHtmlTitle(String(body.content ?? ''))
        } else if (body.kind === 'text') {
          text = String(body.content ?? '').trim()
        }
        if (text.length < 220) return
        pages.set(source.canonical, { url: source.url, title, text })
      } catch {
        // 单页失败（403/超时/非 HTML）不影响整体结果。
      }
    })
    await raceBudget(Promise.allSettled(tasks), config.readBudgetMs)
    // 返回快照：超预算仍在跑的抓取不会再改到这次请求的输入。
    return new Map(pages)
  }

  /**
   * 解析本次搜索的输出语言：
   * 1. 设置里写死 zh/en 时以设置为准；
   * 2. 设置为 auto（跟随 Harness）时，优先用调用方（页面）传来的界面语言；
   * 3. 都没有（Agent 工具调用）时按问题语言推断。
   * @param {string} query
   * @param {unknown} uiLanguage
   * @param {{ language: string }} settings
   * @returns {'zh' | 'en'}
   */
  function resolveLanguage(query, uiLanguage, settings) {
    if (settings.language === 'zh' || settings.language === 'en') return settings.language
    return normalizeLanguageHint(uiLanguage) ?? languageOf(query)
  }

  /**
   * 记录一次搜索历史；历史写入失败不影响搜索结果。
   * @param {{ query: string, mode: string, ai: boolean, kept: number }} entry
   */
  function recordHistory(entry) {
    try {
      if (config.history !== undefined && typeof config.history.record === 'function') config.history.record(entry)
    } catch {
      /* 历史是尽力而为 */
    }
  }

  /**
   * 答疑模式（原有流程）：检索 → 过滤 → 精读 → AI 摘要与推荐排序。
   *
   * @param {{ query: string, maxResults: number, aiRequested: boolean, language: 'zh' | 'en', parent: AbortSignal | undefined, startedAt: number }} params
   * @returns {Promise<object>}
   */
  async function runQa(params) {
    const { query, maxResults, aiRequested, language, parent, startedAt } = params
    const marks = []
    const mark = (stage) => marks.push({ stage, at: now() - startedAt })

    const web = ctx.get('web')
    if (web === undefined || typeof web.search !== 'function') {
      throw createError('WEB_UNAVAILABLE', '当前 Harness 组合没有可用的联网搜索服务（ctx.web）')
    }

    // ---- 1. 联网检索 ----
    mark('search')
    const searchStartedAt = now()
    let searchResult
    try {
      searchResult = await web.search({ query, maxResults }, phaseSignal(parent, config.searchTimeoutMs))
    } catch (error) {
      if (isAbortError(error)) throw error
      const message = error instanceof Error ? error.message : String(error)
      throw createError('WEB_SEARCH_FAILED', `联网检索失败：${message}`)
    }
    const searchMs = now() - searchStartedAt
    const rawSources = Array.isArray(searchResult?.sources) ? searchResult.sources : []
    const providerContent = typeof searchResult?.content === 'string' ? searchResult.content : ''

    // ---- 2. 广告过滤 + 排序 ----
    mark('filter')
    const { kept, removed } = filterSources(rawSources, query, { maxKeep: 20, maxRemoved: 40 })

    // ---- 3. 精读页面 ----
    mark('read')
    const pages = kept.length === 0 ? new Map() : await readPages(kept, parent)

    // ---- 4. AI 摘要与推荐排序 ----
    mark('curate')
    const curateStartedAt = now()
    let curation = null
    let aiError = ''
    if (kept.length > 0) {
      const llm = ctx.get('llm')
      if (!aiRequested) {
        curation = fallbackCuration({ query, sources: kept, pages, providerContent, aiError: '', maxPicks: config.maxPicks, language })
      } else if (llm === undefined) {
        aiError = '当前组合没有可用的模型服务（ctx.llm）'
        curation = fallbackCuration({ query, sources: kept, pages, providerContent, aiError, maxPicks: config.maxPicks, language })
      } else {
        try {
          curation = await curateWithLlm(ctx, llm, {
            query,
            sources: kept,
            pages,
            maxPicks: config.maxPicks,
            language,
            signal: phaseSignal(parent, config.aiTimeoutMs),
          })
          if (curation.picks.length === 0) {
            // 模型给了摘要但没有可用链接：保留摘要，用启发式补 picks。
            const fallback = fallbackCuration({ query, sources: kept, pages, providerContent: '', aiError: '', maxPicks: config.maxPicks, language })
            curation = { ...curation, picks: fallback.picks }
          }
        } catch (error) {
          if (isAbortError(error)) throw error
          aiError = error instanceof Error ? error.message : String(error)
          curation = fallbackCuration({ query, sources: kept, pages, providerContent, aiError, maxPicks: config.maxPicks, language })
        }
      }
    } else {
      curation = {
        summary:
          language === 'zh'
            ? `本次检索没有找到可用的干净结果：${removed.length} 条候选全部被判定为广告/推广、重复或低质内容。可以换个说法，或加上更具体的关键词再试一次。`
            : `No clean results: all ${removed.length} candidates were ads, duplicates, or low quality. Rephrase the question or add more specific keywords.`,
        picks: [],
        alert: '',
        ai: false,
        model: null,
      }
    }
    const curateMs = now() - curateStartedAt

    return {
      ok: true,
      mode: 'qa',
      query,
      language,
      answer: curation.summary,
      alert: curation.alert ?? '',
      ai: curation.ai === true,
      aiModel: curation.model ?? null,
      aiError: aiError === '' ? null : aiError,
      picks: curation.picks,
      sources: kept.map(projectSource),
      removed,
      cached: false,
      stats: {
        raw: rawSources.length,
        kept: kept.length,
        removed: removed.length,
        fetched: pages.size,
        searchMs,
        curateMs,
        elapsedMs: now() - startedAt,
        cached: false,
        stages: marks,
      },
      at: new Date(now()).toISOString(),
    }
  }

  /**
   * 百科模式：检索百科与外围来源，按档位生成百科体例条目。
   *
   * @param {{ query: string, language: 'zh' | 'en', detail: string, parent: AbortSignal | undefined, startedAt: number }} params
   * @returns {Promise<object>}
   */
  async function runEncyclopediaMode(params) {
    const { query, language, detail, parent, startedAt } = params
    const payload = await runEncyclopedia({ ctx, query, language, detail, signal: parent })
    return {
      ok: true,
      mode: 'encyclopedia',
      query,
      language,
      detail,
      ai: payload.ai === true,
      aiModel: payload.aiModel ?? null,
      aiError: payload.aiError ?? null,
      title: payload.title,
      lead: payload.lead,
      sections: payload.sections,
      references: payload.references,
      sources: payload.sources,
      removed: payload.removed,
      cached: false,
      stats: { ...payload.stats, elapsedMs: now() - startedAt, cached: false },
      at: new Date(now()).toISOString(),
    }
  }

  /**
   * 浏览模式：信息流式结果，三指标加权排序，支持下一页。
   *
   * @param {{ query: string, language: 'zh' | 'en', page: number, exclude: string[], weights: object, parent: AbortSignal | undefined, startedAt: number }} params
   * @returns {Promise<object>}
   */
  async function runBrowseMode(params) {
    const { query, language, page, exclude, weights, parent, startedAt } = params
    const payload = await runBrowse({ ctx, query, language, page, exclude, weights, signal: parent })
    return {
      ok: true,
      mode: 'browse',
      query,
      language,
      page,
      hasMore: payload.hasMore === true,
      ai: payload.ai === true,
      aiModel: payload.aiModel ?? null,
      aiError: payload.aiError ?? null,
      weights: payload.weights,
      normalizedWeights: payload.normalizedWeights,
      items: payload.items,
      boards: payload.boards,
      sources: payload.sources,
      removed: payload.removed,
      cached: false,
      stats: { ...payload.stats, elapsedMs: now() - startedAt, cached: false },
      at: new Date(now()).toISOString(),
    }
  }

  /**
   * 执行一次搜索（按 mode 分发）。
   *
   * @param {{ query: string, mode?: string, maxResults?: number, ai?: boolean, uiLanguage?: string, page?: number, exclude?: unknown[] }} input
   * @param {{ signal?: AbortSignal }} [exec]
   * @returns {Promise<object>}
   */
  async function search(input, exec = {}) {
    const startedAt = now()
    const query = normalizeQuery(input?.query)
    const mode = normalizeMode(input?.mode)
    const maxResults = normalizeMaxResults(input?.maxResults, config.maxResults)
    const aiRequested = input?.ai !== false
    const settings = settingsSnapshot()
    const language = resolveLanguage(query, input?.uiLanguage, settings)
    const page = normalizePage(input?.page)
    const exclude = normalizeExclude(input?.exclude)
    const weights = settings.browseWeights
    const detail = settings.encyclopediaDetail

    const cacheKey =
      mode === 'browse'
        ? `${mode}|${query.toLowerCase()}|${language}|${page}|${weights.relevance}-${weights.timeliness}-${weights.heat}|${exclude.length}`
        : mode === 'encyclopedia'
          ? `${mode}|${query.toLowerCase()}|${language}|${detail}`
          : `${mode}|${query.toLowerCase()}|${maxResults}|${aiRequested ? 1 : 0}|${language}`
    const cacheable = mode !== 'browse' || page === 1
    const cached = cacheable ? cache.get(cacheKey) : undefined
    if (cached !== undefined && cached.expiresAt > startedAt) {
      recordHistory({ query, mode, ai: cached.value.ai === true, kept: cached.value.stats?.kept ?? 0 })
      return {
        ...cached.value,
        cached: true,
        stats: { ...cached.value.stats, cached: true, elapsedMs: now() - startedAt },
      }
    }

    const parent = exec.signal
    const value =
      mode === 'encyclopedia'
        ? await runEncyclopediaMode({ query, language, detail, parent, startedAt })
        : mode === 'browse'
          ? await runBrowseMode({ query, language, page, exclude, weights, parent, startedAt })
          : await runQa({ query, maxResults, aiRequested, language, parent, startedAt })

    if (cacheable) {
      cache.set(cacheKey, { value, expiresAt: now() + config.cacheTtlMs })
      if (cache.size > config.cacheMaxEntries) {
        // Map 保持插入顺序，最早插入的即为最旧条目。
        const oldestKey = cache.keys().next().value
        if (oldestKey !== undefined) cache.delete(oldestKey)
      }
    }
    recordHistory({ query, mode, ai: value.ai === true, kept: value.stats?.kept ?? 0 })
    return value
  }

  /**
   * 健康检查信息：配置默认值 + 依赖服务是否就绪。
   * @returns {object}
   */
  function describe() {
    const settings = settingsSnapshot()
    return {
      ok: true,
      name: 'dsh-ai-search',
      version: '1.4.2',
      services: {
        web: ctx.get('web') !== undefined,
        llm: ctx.get('llm') !== undefined,
        agentDefaultModel: ctx.get('agentDefaultModel') !== undefined,
        webServer: ctx.get('webServer') !== undefined,
      },
      modes: [...SEARCH_MODES],
      language: settings.language,
      encyclopediaDetail: settings.encyclopediaDetail,
      browseWeights: { ...settings.browseWeights },
      preserveState: settings.preserveState,
      historyCount: config.history !== undefined && typeof config.history.list === 'function' ? config.history.list().length : 0,
      defaults: {
        maxResults: config.maxResults,
        fetchTop: config.fetchTop,
        maxPicks: config.maxPicks,
        browseMaxPage: BROWSE_MAX_PAGE,
        cacheTtlMs: config.cacheTtlMs,
      },
      time: new Date(now()).toISOString(),
    }
  }

  return { search, describe, config }
}

/** 导出给测试使用：纯函数便于单测。 */
export const internals = { normalizeMode, normalizePage, normalizeExclude, normalizeQuery, normalizeMaxResults }
