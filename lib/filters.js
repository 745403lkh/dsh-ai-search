/**
 * 搜索结果清洗：链接规范化（去追踪参数、拆重定向包装）、广告/推广识别、
 * 重复项折叠、相关度排序与站点多样性限制。
 *
 * 这里的每个判断都只使用搜索结果自身的字段（url/title/snippet/publishedAt），
 * 不访问网络，因此可以在一次工具调用里确定性地跑完。
 */

/** 追踪/联盟参数：只删参数，不因它删掉整条结果。 */
const TRACKING_PARAMS = [
  /^utm_/i,
  /^gclid$/i,
  /^dclid$/i,
  /^fbclid$/i,
  /^msclkid$/i,
  /^yclid$/i,
  /^_openstat$/i,
  /^mc_cid$/i,
  /^mc_eid$/i,
  /^igshid$/i,
  /^spm$/i,
  /^scm$/i,
  /^ref_src$/i,
  /^ref_url$/i,
  /^cmpid$/i,
  /^campaignid$/i,
  /^adid$/i,
  /^affiliate/i,
  /^aff_/i,
  /^affid$/i,
  /^_ylt$/i,
  /^_ylu$/i,
  /^guccounter$/i,
  /^guce_referrer/i,
  /^guce_referrer_sig$/i,
  /^srsltid$/i,
  /^wbraid$/i,
  /^gbraid$/i,
  /^ttclid$/i,
  /^twclid$/i,
  /^li_fat_id$/i,
  /^irclickid$/i,
  /^irgwc$/i,
  /^epik$/i,
  /^pk_campaign$/i,
  /^pk_kwd$/i,
  /^test_uuid$/i,
  /^test_variant$/i,
  /^poc_token$/i,
  /^oly_enc_id$/i,
  /^oly_anon_id$/i,
  /^at_medium$/i,
  /^at_campaign$/i,
  /^tdsourcetag$/i,
  /^from_source$/i,
]

/** 广告/追踪/联盟网络域名后缀：命中即判定为广告。 */
const AD_HOST_SUFFIXES = [
  'doubleclick.net',
  'googlesyndication.com',
  'googleadservices.com',
  'adservice.google.com',
  'adsensecustomsearchads.com',
  'criteo.com',
  'criteo.net',
  'taboola.com',
  'outbrain.com',
  'adroll.com',
  'rubiconproject.com',
  'pubmatic.com',
  'openx.net',
  'amazon-adsystem.com',
  'media.net',
  'revcontent.com',
  'zergnet.com',
  'popads.net',
  'propellerads.com',
  'mgid.com',
  'adnxs.com',
  'smartadserver.com',
  'casalemedia.com',
  'sharethrough.com',
  'triplelift.com',
  'teads.tv',
  'spotxchange.com',
  'adform.net',
  'quantserve.com',
  'scorecardresearch.com',
  'moatads.com',
  'adsrvr.org',
  'bidswitch.net',
  'mathtag.com',
  '360yield.com',
  '1rx.io',
  '3lift.com',
  '33across.com',
  'sonobi.com',
  'gumgum.com',
  'districtm.io',
  'alimama.com',
  'tanx.com',
  'mmstat.com',
  'cnzz.com',
  'umeng.com',
  'umtrack.com',
  'doubleverify.com',
  'adsafeprotected.com',
  'taboolanews.com',
]

/** 明确标为广告/推广的标题文案（保守：只在标题里出现时才判定）。 */
const AD_TITLE_PATTERNS = [
  /\badvertisement\b/i,
  /\bsponsored\b/i,
  /\bpromoted\b/i,
  /\badvertorial\b/i,
  /\bpaid post\b/i,
  /\bpartner content\b/i,
  /(^|[\s|·—\-])广告([\s|·—\-:]|$)/,
  /【广告】/,
  /\[广告\]/,
  /\(广告\)/,
  /（广告）/,
  /^推广[:：]/,
]

/** 摘要里出现这些词，基本可以确认是推广文案（只保留明确的广告标识，避免误伤正常内容）。 */
const AD_SNIPPET_PATTERNS = [/\badvertisement\b/i, /\bsponsored\b/i, /\bpromoted\b/i, /(^|\s)广告(\s|$|[:：])/, /推广链接/]

/** 点击诱饵/低质标题：降低排序，不直接删除。 */
const CLICKBAIT_PATTERNS = [
  /^\s*(top|best)\s+\d+/i,
  /^\s*\d+\s*(个|种|款|大)/,
  /你(绝对|根本)?不知道/,
  /震惊|惊呆|速看|必看/,
  /百分之百|100%有效/,
  /点击(这里|领取|查看)/,
  /最后一天|仅剩|疯抢/,
]

/** 权威/一手来源：加分项。 */
const TRUSTED_HOST_SUFFIXES = [
  'wikipedia.org',
  'wikidata.org',
  'github.com',
  'gitlab.com',
  'developer.mozilla.org',
  'stackoverflow.com',
  'stackexchange.com',
  'arxiv.org',
  'nature.com',
  'science.org',
  'sciencedirect.com',
  'springer.com',
  'ieee.org',
  'acm.org',
  'nih.gov',
  'who.int',
  'un.org',
  'europa.eu',
  'npmjs.com',
  'pypi.org',
  'python.org',
  'nodejs.org',
  'rust-lang.org',
  'go.dev',
  'kernel.org',
  'microsoft.com',
  'apple.com',
  'google.dev',
  'deepseek.com',
  'openai.com',
  'anthropic.com',
  'huggingface.co',
  'docs.python.org',
]

/** 默认每站最多保留的结果数；调用方可以按站点类型给更高的上限（例如视频站）。 */
const MAX_PER_DOMAIN_DEFAULT = 5

/**
 * 安全解析 URL，只接受 http(s)。
 * @param {unknown} raw
 * @returns {URL | null}
 */
function parseUrl(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') return null
  try {
    const url = new URL(raw.trim())
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url
  } catch {
    return null
  }
}

/**
 * 拆掉常见搜索引擎的跳转包装（Google / Bing / DuckDuckGo），拿到真实地址。
 * 拆不动时返回原值，由后续规则处理。
 * @param {string} raw
 * @returns {string | null}
 */
export function unwrapRedirect(raw) {
  const url = parseUrl(raw)
  if (url === null) return null
  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  if ((host === 'google.com' || host.endsWith('.google.com')) && url.pathname === '/url') {
    const target = url.searchParams.get('q') ?? url.searchParams.get('url')
    if (target !== null && /^https?:\/\//i.test(target)) return target
  }
  if (host === 'l.duckduckgo.com' || host === 'duckduckgo.com') {
    const target = url.searchParams.get('uddg')
    if (target !== null) {
      try {
        const decoded = decodeURIComponent(target)
        if (/^https?:\/\//i.test(decoded)) return decoded
      } catch {
        /* 坏编码就按原链接处理 */
      }
    }
  }
  if (host === 'bing.com' && url.pathname.startsWith('/ck/a')) {
    const encoded = url.searchParams.get('u')
    if (encoded !== null && encoded.startsWith('a1')) {
      try {
        const text = Buffer.from(encoded.slice(2).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
        if (/^https?:\/\//i.test(text)) return text
      } catch {
        /* 解不开就按原链接处理 */
      }
    }
  }
  return raw
}

/**
 * 规范化一条链接：拆重定向、去 hash、去追踪参数。
 * @param {unknown} raw
 * @returns {{ url: string, canonical: string, domain: string } | null}
 */
export function canonicalizeUrl(raw) {
  const unwrapped = unwrapRedirect(String(raw ?? ''))
  const url = parseUrl(unwrapped)
  if (url === null) return null
  url.hash = ''
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.some((pattern) => pattern.test(key))) url.searchParams.delete(key)
  }
  const query = url.searchParams.toString()
  const pathname = url.pathname === '' ? '/' : url.pathname
  const displayUrl = `${url.origin}${pathname}${query === '' ? '' : `?${query}`}`
  const bareHost = url.hostname.toLowerCase().replace(/^www\./, '')
  const canonicalPath = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
  return {
    url: displayUrl,
    canonical: `${bareHost}${canonicalPath}${query === '' ? '' : `?${query}`}`,
    domain: bareHost,
  }
}

/**
 * 纯文本化：去标签、折叠空白、限长。
 * @param {unknown} value
 * @param {number} limit
 * @returns {string}
 */
function cleanText(value, limit) {
  if (typeof value !== 'string') return ''
  const text = value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > limit ? `${text.slice(0, limit)}…` : text
}

/**
 * 标题归一化，用于近似重复判定。
 * @param {string} title
 * @returns {string}
 */
function titleKey(title) {
  return title
    .toLowerCase()
    .replace(/[\s\u3000]+/g, '')
    .replace(/[|·—\-–_.,，。:：!！?？'"“”‘’()[\]【】<>《》/\\]+/g, '')
    .slice(0, 64)
}

/**
 * 查询词项：英文按词，中文按片段 + bigram，用于相关度打分。
 * @param {string} query
 * @returns {string[]}
 */
export function queryTerms(query) {
  const text = String(query ?? '').toLowerCase().trim()
  if (text === '') return []
  const terms = new Set()
  for (const part of text.split(/[\s,，。;；、/|+]+/)) {
    const token = part.trim()
    if (token.length >= 2 && /[a-z0-9]/.test(token)) terms.add(token)
  }
  for (const run of text.match(/[\u3400-\u9fff]+/g) ?? []) {
    if (run.length >= 2 && run.length <= 12) terms.add(run)
    for (let index = 0; index + 1 < run.length; index += 1) terms.add(run.slice(index, index + 2))
  }
  const stopWords = new Set(['the', 'and', 'for', 'with', 'what', 'how', 'best', 'vs', 'is', 'are', 'of', 'to', 'in', 'on', 'a', 'an'])
  return [...terms].filter((term) => !stopWords.has(term)).slice(0, 24)
}

/**
 * 域名是否命中广告/追踪网络。
 * @param {string} domain
 * @returns {boolean}
 */
function isAdHost(domain) {
  return AD_HOST_SUFFIXES.some((suffix) => domain === suffix || domain.endsWith(`.${suffix}`))
}

/**
 * 域名是否为权威/一手来源。
 * @param {string} domain
 * @returns {boolean}
 */
export function isTrustedDomain(domain) {
  if (domain.endsWith('.gov') || domain.endsWith('.edu') || domain.endsWith('.edu.cn') || domain.endsWith('.gov.cn')) return true
  return TRUSTED_HOST_SUFFIXES.some((suffix) => domain === suffix || domain.endsWith(`.${suffix}`))
}

/**
 * 判定一条结果是否为广告/推广；命中时返回中文原因。
 * 查询词本身包含该标记时不判广告（例如查询里就有“广告”二字）。
 * @param {{ title: string, snippet: string, domain: string }} candidate
 * @param {string} query
 * @returns {string | null}
 */
function adReason(candidate, query) {
  if (isAdHost(candidate.domain)) return '广告/追踪网络'
  const queryLower = query.toLowerCase()
  for (const pattern of AD_TITLE_PATTERNS) {
    const match = pattern.exec(candidate.title)
    if (match !== null) {
      const marker = match[0].toLowerCase()
      if (queryLower.includes(marker)) continue
      return '标题标为广告/推广'
    }
  }
  for (const pattern of AD_SNIPPET_PATTERNS) {
    const match = pattern.exec(candidate.snippet)
    if (match !== null) {
      const marker = match[0].toLowerCase()
      if (queryLower.includes(marker)) continue
      return '摘要含推广标识'
    }
  }
  return null
}

/**
 * 单条来源的相关度打分（0 起步，可负）。
 * @param {{ title: string, snippet: string, domain: string, publishedAt: string, rank: number }} candidate
 * @param {string} query
 * @returns {number}
 */
function scoreSource(candidate, query) {
  let score = 0
  const terms = queryTerms(query)
  if (terms.length > 0) {
    const title = candidate.title.toLowerCase()
    const snippet = candidate.snippet.toLowerCase()
    let titleHits = 0
    let snippetHits = 0
    for (const term of terms) {
      if (title.includes(term)) titleHits += 1
      if (snippet.includes(term)) snippetHits += 1
    }
    score += 6 * (titleHits / terms.length)
    score += 3 * (snippetHits / terms.length)
  }
  if (candidate.publishedAt !== '') score += 0.8
  if (isTrustedDomain(candidate.domain)) score += 2.5
  if (candidate.snippet.length >= 80) score += 0.8
  else if (candidate.snippet.length < 25) score -= 0.6
  if (candidate.title.length < 8) score -= 1
  if (CLICKBAIT_PATTERNS.some((pattern) => pattern.test(candidate.title))) score -= 2.5
  // 提供方顺序是弱信号：越靠前越相关，但不足以压过内容质量。
  score += Math.max(0, 1.2 - candidate.rank * 0.1)
  return Math.round(score * 100) / 100
}

/**
 * 过滤并排序搜索结果。
 *
 * @param {ReadonlyArray<{ url?: string, title?: string, snippet?: string, publishedAt?: string }>} rawSources
 * @param {string} query
 * @param {{ maxKeep?: number, maxRemoved?: number, maxPerDomain?: number | ((domain: string) => number) }} [limits]
 *   `maxPerDomain` 可以是数字或按域名返回上限的函数（例如视频站允许更多结果）。
 * @returns {{ kept: Array<object>, removed: Array<{ url: string, title: string, domain: string, reason: string }> }}
 */
export function filterSources(rawSources, query, limits = {}) {
  const maxKeep = limits.maxKeep ?? 20
  const maxRemoved = limits.maxRemoved ?? 40
  const maxPerDomainLimit = limits.maxPerDomain ?? MAX_PER_DOMAIN_DEFAULT
  const capForDomain =
    typeof maxPerDomainLimit === 'function'
      ? (domain) => {
          const value = Number(maxPerDomainLimit(domain))
          return Number.isFinite(value) && value > 0 ? Math.round(value) : MAX_PER_DOMAIN_DEFAULT
        }
      : () => Math.max(1, Math.round(maxPerDomainLimit))
  const removed = []
  const kept = []
  const seenCanonical = new Set()
  const seenTitle = new Set()

  const sources = Array.isArray(rawSources) ? rawSources : []
  for (let rank = 0; rank < sources.length; rank += 1) {
    const raw = sources[rank] ?? {}
    const title = cleanText(raw.title, 240)
    const snippet = cleanText(raw.snippet, 480)
    const publishedAt = cleanText(raw.publishedAt, 40)
    const normalized = canonicalizeUrl(raw.url)
    if (normalized === null) {
      removed.push({ url: String(raw.url ?? ''), title, domain: '', reason: '无效或非网页链接' })
      continue
    }
    const candidate = {
      url: normalized.url,
      canonical: normalized.canonical,
      domain: normalized.domain,
      title: title === '' ? normalized.domain : title,
      snippet,
      publishedAt,
      rank,
      score: 0,
    }
    const ad = adReason(candidate, query)
    if (ad !== null) {
      removed.push({ url: candidate.url, title: candidate.title, domain: candidate.domain, reason: ad })
      continue
    }
    if (seenCanonical.has(candidate.canonical)) {
      removed.push({ url: candidate.url, title: candidate.title, domain: candidate.domain, reason: '重复链接' })
      continue
    }
    const key = titleKey(candidate.title)
    if (key !== '' && seenTitle.has(key)) {
      removed.push({ url: candidate.url, title: candidate.title, domain: candidate.domain, reason: '重复标题' })
      continue
    }
    seenCanonical.add(candidate.canonical)
    if (key !== '') seenTitle.add(key)
    candidate.score = scoreSource(candidate, query)
    kept.push(candidate)
  }

  kept.sort((left, right) => right.score - left.score || left.rank - right.rank)

  const perDomain = new Map()
  const diverse = []
  for (const candidate of kept) {
    const count = perDomain.get(candidate.domain) ?? 0
    if (count >= capForDomain(candidate.domain)) {
      removed.push({ url: candidate.url, title: candidate.title, domain: candidate.domain, reason: '同站点结果较多，已精简' })
      continue
    }
    perDomain.set(candidate.domain, count + 1)
    diverse.push(candidate)
  }

  return {
    kept: diverse.slice(0, maxKeep),
    removed: removed.slice(0, maxRemoved),
  }
}

/**
 * 输出给浏览器/模型的来源字段（去掉内部 canonical/rank/score 细节）。
 * @param {object} source
 * @returns {object}
 */
export function projectSource(source) {
  return {
    url: source.url,
    title: source.title,
    domain: source.domain,
    snippet: source.snippet,
    publishedAt: source.publishedAt,
    trusted: isTrustedDomain(source.domain),
    score: source.score,
  }
}
