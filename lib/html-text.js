/**
 * 轻量 HTML → 正文纯文本提取。
 *
 * 目标不是完美还原网页，而是给 AI 精选提供一段可读、去噪的正文：
 * 去掉脚本/样式/导航/页脚等非正文块，保留段落换行，解码常见实体，限长。
 * 不依赖任何第三方解析器，因此插件无需额外依赖就能在 Host 里运行。
 */

/** 常见 HTML 实体表（只覆盖检索页里高频出现的那些）。 */
const NAMED_ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ensp: ' ',
  emsp: ' ',
  thinsp: ' ',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  middot: '·',
  bull: '•',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  copy: '©',
  reg: '®',
  trade: '™',
  deg: '°',
  times: '×',
  divide: '÷',
  laquo: '«',
  raquo: '»',
  euro: '€',
  pound: '£',
  yen: '¥',
  cent: '¢',
  sect: '§',
  para: '¶',
  dagger: '†',
  permil: '‰',
  prime: '′',
  Prime: '″',
  larr: '←',
  rarr: '→',
  uarr: '↑',
  darr: '↓',
  harr: '↔',
}

/** 这些整块内容与正文无关，直接删掉。 */
const DROP_TAGS = ['script', 'style', 'noscript', 'template', 'svg', 'canvas', 'iframe', 'object', 'embed', 'form', 'nav', 'footer', 'aside', 'video', 'audio']

/** 这些标签换行，保持段落结构。 */
const BLOCK_TAGS = ['p', 'div', 'section', 'article', 'main', 'br', 'li', 'tr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'table', 'ul', 'ol', 'dl', 'dt', 'dd', 'header', 'figure', 'figcaption', 'hr']

/**
 * 解码数字实体与常见命名实体。
 * @param {string} text
 * @returns {string}
 */
function decodeEntities(text) {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]{1,31});/g, (whole, body) => {
    if (body.startsWith('#x') || body.startsWith('#X')) {
      const code = Number.parseInt(body.slice(2), 16)
      return Number.isFinite(code) ? safeFromCodePoint(code, whole) : whole
    }
    if (body.startsWith('#')) {
      const code = Number.parseInt(body.slice(1), 10)
      return Number.isFinite(code) ? safeFromCodePoint(code, whole) : whole
    }
    const named = NAMED_ENTITIES[body]
    return named === undefined ? whole : named
  })
}

/**
 * 码点转字符；非法码点保留原文。
 * @param {number} code
 * @param {string} fallback
 * @returns {string}
 */
function safeFromCodePoint(code, fallback) {
  if (!Number.isInteger(code) || code <= 0 || code > 0x10ffff) return fallback
  try {
    return String.fromCodePoint(code)
  } catch {
    return fallback
  }
}

/**
 * 取出 `<title>` 的纯文本，用作正文缺失时的标题兜底。
 * @param {string} html
 * @returns {string}
 */
export function extractHtmlTitle(html) {
  if (typeof html !== 'string') return ''
  const match = /<title[^>]*>([\s\S]{0,300}?)<\/title>/i.exec(html)
  if (match === null) return ''
  return decodeEntities(match[1].replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
}

/**
 * 尽量定位正文容器：article/main 优先，其次整个 body。
 * @param {string} html
 * @returns {string}
 */
function pickMainRegion(html) {
  const article = /<article\b[^>]*>([\s\S]*?)<\/article>/i.exec(html)
  if (article !== null && article[1].length >= 400) return article[1]
  const main = /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(html)
  if (main !== null && main[1].length >= 400) return main[1]
  const body = /<body\b[^>]*>([\s\S]*?)<\/body>/i.exec(html)
  if (body !== null) return body[1]
  return html
}

/**
 * HTML → 纯文本正文。
 *
 * @param {string} html 原始 HTML。
 * @param {{ maxChars?: number, maxInputChars?: number }} [options]
 * @returns {string}
 */
export function htmlToText(html, options = {}) {
  if (typeof html !== 'string' || html.trim() === '') return ''
  const maxChars = options.maxChars ?? 6000
  const maxInputChars = options.maxInputChars ?? 160000
  let source = html.length > maxInputChars ? html.slice(0, maxInputChars) : html

  // 注释先删，避免注释里的标签干扰块级替换。
  source = source.replace(/<!--[\s\S]*?-->/g, ' ')
  // 去掉与正文无关的整块内容（非贪婪，脚本里出现 </script> 字符串的概率可接受）。
  for (const tag of DROP_TAGS) {
    const paired = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, 'gi')
    source = source.replace(paired, ' ')
    const selfClosing = new RegExp(`<${tag}\\b[^>]*\\/>`, 'gi')
    source = source.replace(selfClosing, ' ')
  }
  // 只保留正文区域，减少导航/页脚噪声。
  source = pickMainRegion(source)
  // 块级标签换成换行；行内标签直接去掉。
  const blockPattern = new RegExp(`<\\/?(?:${BLOCK_TAGS.join('|')})\\b[^>]*>`, 'gi')
  source = source.replace(blockPattern, '\n')
  source = source.replace(/<[^>]*>/g, '')
  source = decodeEntities(source)
  // 折叠空白：段内多空格压成一个，段间最多一个空行。
  const lines = source
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t\u00a0\u3000]+/g, ' ').trim())
    .filter((line) => line.length > 0)
  let text = lines.join('\n')
  text = text.replace(/\n{3,}/g, '\n\n').trim()
  if (text.length > maxChars) text = `${text.slice(0, maxChars)}\n…（正文已截断）`
  return text
}

/**
 * 从一段正文里取最相关的摘录：优先包含查询词项的段落窗口。
 *
 * @param {string} text 正文。
 * @param {string[]} terms 查询词项。
 * @param {number} [limit] 摘录字符数。
 * @returns {string}
 */
export function extractExcerpt(text, terms, limit = 320) {
  if (typeof text !== 'string' || text === '') return ''
  const paragraphs = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 40)
  if (paragraphs.length === 0) return text.slice(0, limit)
  const lowered = terms.map((term) => term.toLowerCase())
  let bestIndex = 0
  let bestHits = -1
  for (let index = 0; index < paragraphs.length; index += 1) {
    const haystack = paragraphs[index].toLowerCase()
    let hits = 0
    for (const term of lowered) if (haystack.includes(term)) hits += 1
    // 越靠前的段落略微占优，避免同样命中时全站导航段落胜出。
    const weighted = hits - index * 0.02
    if (weighted > bestHits) {
      bestHits = weighted
      bestIndex = index
    }
  }
  let excerpt = paragraphs[bestIndex]
  if (excerpt.length < limit) {
    const next = paragraphs[bestIndex + 1]
    if (next !== undefined) excerpt = `${excerpt} ${next}`
  }
  if (excerpt.length > limit) excerpt = `${excerpt.slice(0, limit)}…`
  return excerpt
}
