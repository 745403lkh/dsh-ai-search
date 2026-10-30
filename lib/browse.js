/**
 * 浏览模式：分页检索 + 相关性/时效性/热度三轴排序 + 图文视频分栏。
 *
 * 流水线：
 *   1. 按页码选择 3 组检索词（每页换视角：视频/图片 → 最新/深度 → 评测/推荐 → 指南/经验 → 讨论/观点）；
 *   2. 三路并行检索，合并时记住每个链接由哪一路带出（用于去重与“多方印证”加分）；
 *   3. 去掉调用方已看过的链接（exclude），复用 filters.js 过滤广告与重复；
 *   4. 先给启发式三轴分，再让模型独立打分覆盖（失败就保留启发式）；
 *   5. 按调用方权重归一化加权，排序后分页 + 分栏，并尽力补缩略图。
 *
 * 约定：AI 失败只降级、不抛错；缺联网服务 / 参数非法 / 调用方取消才抛出。
 */

import { createError, isAbortError } from './errors.js'
import { canonicalizeUrl, filterSources, isTrustedDomain, projectSource } from './filters.js'
import { parseJsonObject, runModelJson } from './model-json.js'
import { isOfficialHomepage, officialInfoForQuery } from './official.js'

/** 每路检索请求的结果数。 */
const SEARCH_MAX_RESULTS = 10
/** 检索阶段超时。 */
const SEARCH_PHASE_MS = 20000
/** AI 评分阶段超时。 */
const AI_TIMEOUT_MS = 40000
/** AI 评分的候选条数。 */
const MAX_AI_CANDIDATES = 24
/** 单页缩略图抓取超时。 */
const THUMBNAIL_TIMEOUT_MS = 4000
/** 缩略图阶段总预算。 */
const THUMBNAIL_BUDGET_MS = 5000
/** 最多补几张图片类缩略图。 */
const MAX_IMAGE_THUMBNAILS = 10
/** 最多补几张视频类缩略图。 */
const MAX_VIDEO_THUMBNAILS = 6
/** 返回的条目数上限：与候选池上限一致，保证「综合」覆盖全部分栏条目。 */
const MAX_ITEMS = 36
/** 每个分栏的条目数上限。 */
const MAX_BOARD_ITEMS = 12
/** 页码上限。 */
const MAX_PAGE = 5
/** 还有下一页所需的最少保留条数。 */
const MIN_KEPT_FOR_MORE = 6
/** 默认权重（调用方没给或给了非法值时使用）。 */
const DEFAULT_WEIGHTS = { relevance: 40, timeliness: 30, heat: 30 }
/** 页面检索词里"视频/图片"几路的下标：第 2、3 路定向视频站，第 4、5 路定向图片站。 */
const VIDEO_ORIGINS = [1, 2]

/** 明确的视频站点：只认大型视频平台，避免把带“视频”字样的普通网页误判成视频。 */
const VIDEO_DOMAINS = [
  'youtube.com',
  'youtu.be',
  'bilibili.com',
  'b23.tv',
  'douyin.com',
  'tiktok.com',
  'kuaishou.com',
  'v.qq.com',
  'youku.com',
  'iqiyi.com',
  'mgtv.com',
  'xigua.com',
  'acfun.cn',
  'vimeo.com',
  'dailymotion.com',
  'twitch.tv',
  'nicovideo.jp',
  'huya.com',
  'douyu.com',
]

/** 视频站点 → 展示用的来源平台名。 */
const VIDEO_PLATFORMS = [
  ['youtube.com', 'YouTube'],
  ['youtu.be', 'YouTube'],
  ['bilibili.com', '哔哩哔哩'],
  ['b23.tv', '哔哩哔哩'],
  ['douyin.com', '抖音'],
  ['tiktok.com', 'TikTok'],
  ['kuaishou.com', '快手'],
  ['v.qq.com', '腾讯视频'],
  ['youku.com', '优酷'],
  ['iqiyi.com', '爱奇艺'],
  ['mgtv.com', '芒果TV'],
  ['xigua.com', '西瓜视频'],
  ['acfun.cn', 'AcFun'],
  ['vimeo.com', 'Vimeo'],
  ['dailymotion.com', 'Dailymotion'],
  ['twitch.tv', 'Twitch'],
  ['nicovideo.jp', 'niconico'],
  ['huya.com', '虎牙'],
  ['douyu.com', '斗鱼'],
]

/** 明确的图片站点。 */
const IMAGE_DOMAINS = [
  'unsplash.com',
  'pexels.com',
  'pixabay.com',
  'pinterest.com',
  'imgur.com',
  'flickr.com',
  '500px.com',
  'huaban.com',
  'duitang.com',
  'tuchong.com',
  '58pic.com',
  '699pic.com',
  'vcg.com',
  'pixiv.net',
  'giphy.com',
  'tenor.com',
  'zcool.com.cn',
  'gettyimages.com',
  'istockphoto.com',
  'deviantart.com',
  'artstation.com',
  'behance.net',
]

/** 图片站定向检索：每页两路图片站，按页轮换（pexels/pixabay 在各页交叉出现，保证有图）。 */
const IMAGE_SITE_PAIRS_ZH = [
  ['pexels.com', 'pixabay.com'],
  ['unsplash.com', 'pexels.com'],
  ['pixabay.com', 'unsplash.com'],
  ['huaban.com', 'duitang.com'],
  ['500px.com', 'flickr.com'],
]
const IMAGE_SITE_PAIRS_EN = [
  ['pexels.com', 'pixabay.com'],
  ['unsplash.com', 'pexels.com'],
  ['pixabay.com', 'unsplash.com'],
  ['500px.com', 'flickr.com'],
  ['pexels.com', 'pixabay.com'],
]

/** 本页的两路图片站定向检索词。 */
function imageSiteQueries(query, language, page) {
  const pairs = language === 'en' ? IMAGE_SITE_PAIRS_EN : IMAGE_SITE_PAIRS_ZH
  const pair = pairs[(page - 1) % pairs.length]
  return pair.map((host) => `${query} site:${host}`)
}

/** 页码 → 检索词（中文）。第 2/3 路定向视频站，第 4/5 路定向图片站。 */
const QUERY_PLANS_ZH = {
  1: (query) => [query, `${query} site:bilibili.com`, `${query} site:douyin.com`, ...imageSiteQueries(query, 'zh', 1)],
  2: (query) => [`${query} 最新`, `${query} 最新 site:bilibili.com`, `${query} 最新 site:douyin.com`, ...imageSiteQueries(query, 'zh', 2)],
  3: (query) => [`${query} 评测`, `${query} 评测 site:bilibili.com`, `${query} 评测 site:douyin.com`, ...imageSiteQueries(query, 'zh', 3)],
  4: (query) => [`${query} 指南`, `${query} 教程 site:bilibili.com`, `${query} 教程 site:douyin.com`, ...imageSiteQueries(query, 'zh', 4)],
  5: (query) => [`${query} 讨论`, `${query} 讨论 site:bilibili.com`, `${query} 讨论 site:douyin.com`, ...imageSiteQueries(query, 'zh', 5)],
}

/** 页码 → 检索词（英文）。 */
const QUERY_PLANS_EN = {
  1: (query) => [query, `${query} site:youtube.com`, `${query} site:tiktok.com`, ...imageSiteQueries(query, 'en', 1)],
  2: (query) => [`latest ${query}`, `${query} latest site:youtube.com`, `${query} latest site:tiktok.com`, ...imageSiteQueries(query, 'en', 2)],
  3: (query) => [`${query} review`, `${query} review site:youtube.com`, `${query} review site:tiktok.com`, ...imageSiteQueries(query, 'en', 3)],
  4: (query) => [`${query} guide`, `${query} tutorial site:youtube.com`, `${query} tutorial site:tiktok.com`, ...imageSiteQueries(query, 'en', 4)],
  5: (query) => [`${query} discussion`, `${query} discussion site:youtube.com`, `${query} discussion site:tiktok.com`, ...imageSiteQueries(query, 'en', 5)],
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
 * 页面检索词只区分中英两种；其他取值按中文处理。
 * @param {unknown} language
 * @returns {'zh' | 'en'}
 */
function normalizeLanguage(language) {
  return typeof language === 'string' && language.trim().toLowerCase().startsWith('en') ? 'en' : 'zh'
}

/**
 * 页码归一化：非数字回退 1，四舍五入后夹到 1..5。
 * @param {unknown} raw
 * @returns {number}
 */
function normalizePage(raw) {
  let numeric = typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? ''), 10)
  if (!Number.isFinite(numeric)) numeric = 1
  return Math.max(1, Math.min(MAX_PAGE, Math.round(numeric)))
}

/**
 * 取本页的检索词与“媒体来源”映射。
 * @param {string} query
 * @param {'zh' | 'en'} language
 * @param {number} page
 * @returns {{ queries: string[], media: Record<number, 'video' | 'image'> }}
 */
function buildPlan(query, language, page) {
  const table = language === 'en' ? QUERY_PLANS_EN : QUERY_PLANS_ZH
  const build = table[page] ?? table[1]
  // 第 2/3 路是视频站定向检索，第 4 路是图片；视频只认站点，图片允许“来源 + 关键词”双证据。
  const media = { [VIDEO_ORIGINS[0]]: 'video', [VIDEO_ORIGINS[1]]: 'video', 3: 'image', 4: 'image' }
  return { queries: build(query), media }
}

/**
 * 权重清洗：非负有限数才采信，否则逐项回退默认值。
 * @param {unknown} raw
 * @returns {{ relevance: number, timeliness: number, heat: number }}
 */
function normalizeWeights(raw) {
  const source = raw !== null && typeof raw === 'object' ? raw : {}
  const weights = { ...DEFAULT_WEIGHTS }
  for (const key of ['relevance', 'timeliness', 'heat']) {
    const value = source[key]
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) weights[key] = value
  }
  return weights
}

/**
 * 归一化成和为 1 的权重；全 0 时退化为“只看相关性”。
 * @param {{ relevance: number, timeliness: number, heat: number }} weights
 * @returns {{ relevance: number, timeliness: number, heat: number }}
 */
function normalizeToUnit(weights) {
  const sum = weights.relevance + weights.timeliness + weights.heat
  if (!Number.isFinite(sum) || sum <= 0) return { relevance: 1, timeliness: 0, heat: 0 }
  return { relevance: weights.relevance / sum, timeliness: weights.timeliness / sum, heat: weights.heat / sum }
}

/**
 * 已看过的链接集合：原始写法与规范化写法都收进来。
 * @param {unknown} exclude
 * @returns {Set<string>}
 */
function buildExcludeSet(exclude) {
  const excluded = new Set()
  if (!Array.isArray(exclude)) return excluded
  for (const entry of exclude) {
    if (typeof entry !== 'string') continue
    const raw = entry.trim()
    if (raw === '') continue
    excluded.add(raw)
    const info = canonicalizeUrl(raw)
    if (info !== null) {
      excluded.add(info.url)
      excluded.add(info.canonical)
    }
  }
  return excluded
}

/**
 * 域名后缀匹配（含自身）。
 * @param {string} domain
 * @param {string[]} suffixes
 * @returns {boolean}
 */
function domainMatches(domain, suffixes) {
  const host = typeof domain === 'string' ? domain.toLowerCase() : ''
  if (host === '') return false
  return suffixes.some((suffix) => host === suffix || host.endsWith(`.${suffix}`))
}

/** 媒体关键词：只用于“图片”的证据判断（视频只认站点，不做内容推断）。 */
const IMAGE_HINTS = /图片|图像|壁纸|海报|照片|图集|素材|插画|image|photo|picture|wallpaper|poster|gallery/i

/**
 * 判定条目类型：视频只认大型视频站点；图片先认图片站点，未知站点需要
 * “图片检索来源 + 标题/摘要里的图片词”两个证据同时成立；其余一律文章。
 * @param {{ domain: string, primaryOrigin: number, title?: string, snippet?: string }} source
 * @param {Record<number, 'video' | 'image'>} media
 * @returns {'article' | 'video' | 'image'}
 */
function kindOf(source, media) {
  if (domainMatches(source.domain, VIDEO_DOMAINS)) return 'video'
  if (domainMatches(source.domain, IMAGE_DOMAINS)) return 'image'
  const mediaKind = media[source.primaryOrigin]
  if (mediaKind === 'image') {
    const text = `${typeof source.title === 'string' ? source.title : ''} ${typeof source.snippet === 'string' ? source.snippet : ''}`
    if (IMAGE_HINTS.test(text)) return 'image'
  }
  return 'article'
}

/**
 * 视频来源平台名（非视频站点返回空串）。
 * @param {string} domain
 * @returns {string}
 */
function platformOf(domain) {
  const host = typeof domain === 'string' ? domain.toLowerCase() : ''
  for (const [suffix, label] of VIDEO_PLATFORMS) {
    if (host === suffix || host.endsWith(`.${suffix}`)) return label
  }
  return ''
}

/**
 * 整数夹取；非法值取下界。
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clampScore(value, min, max) {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, Math.round(value)))
}

/**
 * 时效性启发式：按发布时间距今天数分档。
 * @param {string} publishedAt
 * @returns {number}
 */
function timelinessOf(publishedAt) {
  if (typeof publishedAt !== 'string' || publishedAt.trim() === '') return 50
  const time = Date.parse(publishedAt)
  if (!Number.isFinite(time)) return 50
  const ageDays = (Date.now() - time) / 86400000
  if (!Number.isFinite(ageDays)) return 50
  if (ageDays <= 30) return 100
  if (ageDays <= 180) return 88
  if (ageDays <= 365) return 72
  if (ageDays <= 730) return 55
  return 38
}

/**
 * 热度启发式：权威域名 + 排名靠前 + 多路检索都命中，三者加权。
 * @param {{ domain: string, score: number }} source
 * @param {number} rank 在保留列表中的下标。
 * @param {number} corroboration 0..2。
 * @returns {number}
 */
function heatOf(source, rank, corroboration) {
  const trusted = isTrustedDomain(source.domain) ? 15 : 0
  const rankBonus = Math.max(0, 20 - rank * 2)
  return clampScore(40 + trusted + rankBonus + corroboration * 6, 5, 100)
}

/**
 * 相关性启发式：filters.js 的 0 分起步打分映射到 0-100。
 * @param {{ score: number }} source
 * @returns {number}
 */
function relevanceOf(source) {
  const base = Number.isFinite(source.score) ? source.score : 0
  return clampScore(45 + base * 5, 5, 100)
}

/**
 * 把模型给出的 0-100 分归一化；非法值返回 null（表示“这次没给”）。
 * @param {unknown} value
 * @returns {number | null}
 */
function clampPercent(value) {
  const numeric = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''))
  if (!Number.isFinite(numeric)) return null
  return Math.max(0, Math.min(100, Math.round(numeric)))
}

/**
 * 把模型评分对回候选（按 url / canonical / 去协议写法）；未知链接直接忽略。
 * @param {object} parsed
 * @param {Array<object>} kept
 * @returns {number} 至少写入一项分数的条目数。
 */
function applyAiScores(parsed, kept) {
  const byKey = new Map()
  for (const source of kept) {
    byKey.set(source.url, source)
    byKey.set(source.canonical, source)
    byKey.set(
      source.url
        .replace(/^https?:\/\//i, '')
        .replace(/^www\./i, ''),
      source,
    )
  }
  const scores = Array.isArray(parsed?.scores) ? parsed.scores : []
  let applied = 0
  for (const entry of scores) {
    if (entry === null || typeof entry !== 'object') continue
    const rawUrl = typeof entry.url === 'string' ? entry.url.trim() : ''
    if (rawUrl === '') continue
    let source = byKey.get(rawUrl)
    if (source === undefined) {
      const info = canonicalizeUrl(rawUrl)
      if (info !== null) source = byKey.get(info.canonical) ?? byKey.get(info.url)
    }
    if (source === undefined) continue
    let changed = false
    for (const key of ['relevance', 'timeliness', 'heat']) {
      const value = clampPercent(entry[key])
      if (value === null) continue
      source.metrics[key] = value
      changed = true
    }
    if (changed) applied += 1
  }
  return applied
}

/**
 * 从 YouTube 链接推导缩略图；不是可识别的 YouTube 视频时返回空串。
 * @param {string} url
 * @returns {string}
 */
function youtubeThumbnail(url) {
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return ''
  }
  const host = parsed.hostname.toLowerCase().replace(/^www\./, '')
  let id = ''
  if (host === 'youtu.be' || host.endsWith('.youtu.be')) {
    id = parsed.pathname.split('/').filter((part) => part !== '')[0] ?? ''
  } else if (host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtube-nocookie.com' || host.endsWith('.youtube-nocookie.com')) {
    id = parsed.searchParams.get('v') ?? ''
  }
  if (!/^[A-Za-z0-9_-]{6,}$/.test(id)) return ''
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
}

/**
 * URL 路径本身是图片文件（图片站直链）时，直接用这个 URL 当缩略图，省一次抓取。
 * @param {string} url
 * @returns {string}
 */
function directImageThumbnail(url) {
  try {
    const parsed = new URL(url)
    if (/\.(?:jpe?g|png|gif|webp|avif|bmp)(?:$|[?#])/i.test(parsed.pathname + parsed.search)) return parsed.toString()
    return ''
  } catch {
    return ''
  }
}

/**
 * 是否为 YouTube 域名（用于避免对拿不到视频 id 的 YouTube 页面做无谓抓取）。
 * @param {string} url
 * @returns {boolean}
 */
function isYouTubeHost(url) {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '')
    return host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be' || host.endsWith('.youtu.be')
  } catch {
    return false
  }
}

/** og:image / twitter:image，属性在 content 之前。 */
const OG_IMAGE_FORWARD = /<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]*content=["']([^"']+)/i
/** 同一组属性但 content 在前的写法。 */
const OG_IMAGE_REVERSED = /<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image|twitter:image)["']/i

/**
 * 从页面 HTML 里取 og:image / twitter:image，并把相对地址解析成绝对地址。
 * @param {string} html
 * @param {string} pageUrl
 * @returns {string}
 */
function extractImageUrl(html, pageUrl) {
  if (typeof html !== 'string' || html === '') return ''
  const match = OG_IMAGE_FORWARD.exec(html) ?? OG_IMAGE_REVERSED.exec(html)
  if (match === null) return ''
  const candidate = match[1].trim().replace(/&amp;/gi, '&')
  if (candidate === '') return ''
  try {
    const resolved = new URL(candidate, pageUrl)
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') return ''
    return resolved.toString()
  } catch {
    return ''
  }
}

/**
 * 评分用的系统提示词（英文即可，评分不需要自然语言产出）。
 * @returns {string}
 */
function scoringSystemPrompt() {
  return [
    'You score web search candidates for a browse page. You receive one query and a JSON list of candidates (id, url, title, domain, snippet, sometimes publishedAt).',
    'Score every candidate on exactly three independent metrics, each an integer from 0 to 100:',
    '- relevance: how directly the candidate covers or answers the query.',
    '- timeliness: how fresh the information is; use publishedAt when present, otherwise judge from the wording.',
    '- heat: how popular, widely shared or trending the page is likely to be.',
    'The three metrics are independent: do not copy one value into another, and do not let a relevant page automatically get high heat or timeliness.',
    'Output exactly one JSON object, no Markdown fence and no prose. Shape:',
    '{"scores":[{"url":"candidate URL copied verbatim","relevance":0,"timeliness":0,"heat":0}]}',
    'Rules:',
    '1. Only score URLs that appear in the candidates, copied verbatim; never invent or rewrite a URL.',
    '2. Every score must be an integer between 0 and 100.',
    '3. Judge each metric on its own evidence; if you cannot judge a metric, use 50.',
    '4. Return one entry per candidate and nothing else.',
  ].join('\n')
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
 * 运行一次浏览分页检索。
 *
 * @param {object} options
 * @param {object} options.ctx Host 上下文。
 * @param {string} options.query 检索词。
 * @param {'zh' | 'en'} [options.language] 检索词语言。
 * @param {number} [options.page] 页码（1..5）。
 * @param {string[]} [options.exclude] 已看过的链接。
 * @param {{ relevance?: number, timeliness?: number, heat?: number }} [options.weights]
 * @param {ReadonlyArray<object>} [options.officialSites] 设置里的自定义官网映射。
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<object>}
 */
export async function runBrowse({ ctx, query, language, page, exclude, weights, officialSites, signal } = {}) {
  const web = safeCtxGet(ctx, 'web')
  if (web === null || typeof web !== 'object' || typeof web.search !== 'function') {
    throw createError('WEB_UNAVAILABLE', '当前 Harness 组合没有可用的联网搜索服务（ctx.web）')
  }

  const safeQuery = normalizeQuery(query)
  const outputLanguage = normalizeLanguage(language)
  const pageNumber = normalizePage(page)
  const phaseSignal = makePhaseSignal(signal)
  const excluded = buildExcludeSet(exclude)
  const inputWeights = normalizeWeights(weights)
  const unitWeights = normalizeToUnit(inputWeights)
  const plan = buildPlan(safeQuery, outputLanguage, pageNumber)

  // ---- 1. 三路并行检索，合并时记住来源下标 ----
  const searchStartedAt = Date.now()
  const searchPhase = phaseSignal(SEARCH_PHASE_MS)
  const settled = await Promise.allSettled(
    plan.queries.map((item) => Promise.resolve().then(() => web.search({ query: item, maxResults: SEARCH_MAX_RESULTS }, searchPhase))),
  )
  const searchMs = Date.now() - searchStartedAt

  const merged = []
  const byCanonical = new Map()
  for (let origin = 0; origin < settled.length; origin += 1) {
    const entry = settled[origin]
    if (entry.status === 'rejected') {
      // 调用方取消要透传；单路失败只当这一路没结果，其他两路还能撑住页面。
      if (isAbortError(entry.reason) && signal !== undefined && signal !== null && signal.aborted === true) throw entry.reason
      continue
    }
    const sources = Array.isArray(entry.value?.sources) ? entry.value.sources : []
    for (const raw of sources) {
      if (raw === null || typeof raw !== 'object') continue
      const info = canonicalizeUrl(raw.url)
      if (info === null) continue
      const rawUrl = String(raw.url ?? '').trim()
      if (excluded.has(rawUrl) || excluded.has(info.url) || excluded.has(info.canonical)) continue
      const existing = byCanonical.get(info.canonical)
      if (existing !== undefined) {
        existing.origins.add(origin)
        continue
      }
      const record = {
        url: info.url,
        canonical: info.canonical,
        domain: info.domain,
        title: typeof raw.title === 'string' ? raw.title : '',
        snippet: typeof raw.snippet === 'string' ? raw.snippet : '',
        publishedAt: typeof raw.publishedAt === 'string' ? raw.publishedAt : '',
        // 最早带出这条链接的检索词下标（0 基础词 / 1 视频或对应视角 / 2 图片或对应视角）。
        primaryOrigin: origin,
        origins: new Set([origin]),
      }
      byCanonical.set(info.canonical, record)
      merged.push(record)
    }
  }

  // ---- 2. 广告过滤 + 重复折叠 ----
  const filtered = filterSources(merged, safeQuery, {
    maxKeep: 36,
    maxRemoved: 40,
    // 视频/图片站本来就有大量结果，按“媒体站”放宽站点上限；普通站点仍限制刷屏。
    maxPerDomain: (domain) => (domainMatches(domain, VIDEO_DOMAINS) || domainMatches(domain, IMAGE_DOMAINS) ? 10 : 5),
  })
  const kept = filtered.kept.map((source) => {
    const record = byCanonical.get(source.canonical)
    return { ...source, primaryOrigin: record === undefined ? 0 : record.primaryOrigin, origins: record === undefined ? new Set([0]) : record.origins }
  })

  // ---- 2.5 官网识别：只认官网首页；结果里没有官网首页则第 1 页补一条 ----
  const officialInfo = officialInfoForQuery(safeQuery, officialSites)
  if (officialInfo !== null) {
    for (const source of kept) {
      source.official = isOfficialHomepage(source.url, officialInfo)
    }
    const hasOfficialHomepage = kept.some((source) => source.official === true)
    if (!hasOfficialHomepage && pageNumber === 1) {
      const info = canonicalizeUrl(officialInfo.homepage)
      if (info !== null && !excluded.has(info.url) && !excluded.has(info.canonical)) {
        kept.unshift({
          url: info.url,
          canonical: info.canonical,
          domain: info.domain,
          title: `${officialInfo.name} 官网`,
          snippet: `${officialInfo.name} 官方网站`,
          publishedAt: '',
          primaryOrigin: 0,
          origins: new Set([0]),
          official: true,
        })
      }
    }
  }

  // ---- 3. 启发式三轴分（AI 只在能给出值时覆盖） ----
  kept.forEach((source, rank) => {
    const corroboration = Math.max(0, Math.min(2, source.origins.size - 1))
    source.kind = kindOf(source, plan.media)
    source.metrics = {
      relevance: relevanceOf(source),
      timeliness: timelinessOf(source.publishedAt),
      heat: heatOf(source, rank, corroboration),
    }
  })

  // ---- 4. AI 打分（失败保留启发式） ----
  const llm = safeCtxGet(ctx, 'llm')
  let ai = false
  let aiModel = null
  let aiError = ''
  let aiMs = 0
  if (kept.length > 0) {
    if (llm === null || typeof llm !== 'object') {
      aiError = '当前组合没有可用的模型服务（ctx.llm）'
    } else {
      const aiStartedAt = Date.now()
      try {
        const candidates = kept.slice(0, MAX_AI_CANDIDATES).map((source, index) => ({
          id: index + 1,
          url: source.url,
          title: source.title,
          domain: source.domain,
          snippet: source.snippet.slice(0, 300),
          ...(source.publishedAt === '' ? {} : { publishedAt: source.publishedAt }),
        }))
        const user = JSON.stringify({ query: safeQuery, page: pageNumber, candidates })
        const response = await runModelJson({
          ctx,
          llm,
          system: scoringSystemPrompt(),
          user,
          maxTokens: 1600,
          temperature: 0.2,
          signal: phaseSignal(AI_TIMEOUT_MS),
        })
        const parsed = parseJsonObject(response.text)
        if (parsed === null) throw createError('AI_INVALID_JSON', '模型没有返回可解析的评分 JSON')
        const applied = applyAiScores(parsed, kept)
        if (applied === 0) {
          aiError = '模型没有返回可用的评分'
        } else {
          ai = true
          aiModel = `${response.provider}/${response.model}`
        }
      } catch (error) {
        // 调用方主动取消要透传；模型失败（含 40 秒超时）一律降级。
        if (signal !== undefined && signal !== null && signal.aborted === true) throw error
        aiError = messageOf(error)
      } finally {
        aiMs = Date.now() - aiStartedAt
      }
    }
  }

  // ---- 5. 加权总分 + 排序 ----
  const scored = kept.map((source) => ({
    source,
    score: Math.max(
      0,
      Math.min(
        100,
        Math.round(
          source.metrics.relevance * unitWeights.relevance +
            source.metrics.timeliness * unitWeights.timeliness +
            source.metrics.heat * unitWeights.heat,
        ),
      ),
    ),
  }))
  scored.sort((left, right) => {
    // 官网永远置顶：先按 official，再按加权分。
    const officialDelta = (right.source.official === true ? 1 : 0) - (left.source.official === true ? 1 : 0)
    if (officialDelta !== 0) return officialDelta
    return right.score - left.score || right.source.metrics.relevance - left.source.metrics.relevance
  })

  const projected = scored.map((entry) => ({
    url: entry.source.url,
    title: entry.source.title,
    domain: entry.source.domain,
    kind: entry.source.kind,
    sourcePlatform: entry.source.kind === 'video' ? platformOf(entry.source.domain) : '',
    snippet: entry.source.snippet.slice(0, 240),
    publishedAt: entry.source.publishedAt,
    thumbnail: '',
    official: entry.source.official === true,
    metrics: {
      relevance: entry.source.metrics.relevance,
      timeliness: entry.source.metrics.timeliness,
      heat: entry.source.metrics.heat,
    },
    score: entry.score,
  }))

  // ---- 6. 缩略图：优先直链图片 / YouTube 推导，其余抓 og:image；5 秒总预算 ----
  let fetched = 0
  if (typeof web.fetch === 'function' && projected.length > 0) {
    const targets = []
    let imageTargets = 0
    let videoTargets = 0
    for (const item of projected) {
      if (item.kind === 'image' && imageTargets < MAX_IMAGE_THUMBNAILS) {
        targets.push(item)
        imageTargets += 1
      }
      if (item.kind === 'video' && videoTargets < MAX_VIDEO_THUMBNAILS) {
        targets.push(item)
        videoTargets += 1
      }
    }
    if (targets.length > 0) {
      const tasks = targets.map(async (item) => {
        const direct = directImageThumbnail(item.url)
        if (direct !== '') {
          item.thumbnail = direct
          return
        }
        const derived = youtubeThumbnail(item.url)
        if (derived !== '') {
          item.thumbnail = derived
          return
        }
        // 拿不到视频 id 的 YouTube 页面通常抓不到可用缩略图，直接跳过。
        if (isYouTubeHost(item.url)) return
        try {
          const result = await web.fetch({ url: item.url }, phaseSignal(THUMBNAIL_TIMEOUT_MS))
          if (result === null || result === undefined) return
          if (Number.isFinite(result.statusCode) && result.statusCode >= 400) return
          fetched += 1
          const html = String(result.body?.content ?? '').slice(0, 200000)
          const image = extractImageUrl(html, item.url)
          if (image !== '') item.thumbnail = image
        } catch {
          // 缩略图是尽力而为，失败就留空。
        }
      })
      await raceBudget(Promise.allSettled(tasks), THUMBNAIL_BUDGET_MS)
    }
  }

  // 图片类没拿到缩略图就不进「图片」板块，降级为普通条目，避免空图占位。
  for (const item of projected) {
    if (item.kind === 'image' && item.thumbnail === '') item.kind = 'article'
  }

  // 「综合」= 全部候选按加权分排序（最多 MAX_ITEMS 条）；分栏是它按类型筛选后的子集，
  // 因此分栏里不会出现「综合」中没有的条目（1.4.3-fix1 修正）。
  const items = projected.slice(0, MAX_ITEMS)

  const boards = {
    all: items,
    article: items.filter((item) => item.kind === 'article').slice(0, MAX_BOARD_ITEMS),
    video: items.filter((item) => item.kind === 'video').slice(0, MAX_BOARD_ITEMS),
    image: items.filter((item) => item.kind === 'image' && item.thumbnail !== '').slice(0, MAX_BOARD_ITEMS),
  }

  return {
    ai,
    aiModel,
    aiError: aiError === '' ? null : aiError,
    items,
    boards,
    weights: inputWeights,
    normalizedWeights: unitWeights,
    sources: kept.map(projectSource),
    removed: filtered.removed,
    stats: {
      raw: merged.length,
      kept: kept.length,
      removed: filtered.removed.length,
      fetched,
      searchMs,
      aiMs,
      page: pageNumber,
    },
    hasMore: pageNumber < MAX_PAGE && kept.length >= MIN_KEPT_FOR_MORE,
  }
}
