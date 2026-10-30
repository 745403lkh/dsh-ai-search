/**
 * 自定义 API 与模型：搜索平台与「思考模型」的适配层。
 *
 * 两类配置（都存在 settings.json 的 customApi 字段里）：
 * - search：用第三方搜索 API 替换 Harness 的 ctx.web.search（Tavily / 博查 / SearXNG / Serper）；
 * - thinking：用 OpenAI 兼容的 /chat/completions 接口替换 Harness 默认模型，并支持思考强度。
 *
 * 默认都是 harness（使用 Harness 自带服务），只有显式切到 custom 才走这里。
 */

import { createError } from './errors.js'

/** 支持的搜索 API 平台。 */
export const SEARCH_PROVIDERS = ['tavily', 'bocha', 'searxng', 'serper']

/** 各平台的默认接口地址。 */
const SEARCH_DEFAULT_BASE = {
  tavily: 'https://api.tavily.com',
  bocha: 'https://api.bochaai.com/v1/web-search',
  searxng: 'http://127.0.0.1:8080',
  serper: 'https://google.serper.dev',
}

/** 思考强度选项（auto = 用模型默认，不显式传参）。 */
export const THINKING_EFFORTS = ['auto', 'low', 'medium', 'high']

/** 默认自定义 API 配置。 */
export const DEFAULT_CUSTOM_API = {
  search: { mode: 'harness', provider: 'tavily', baseUrl: '', apiKey: '' },
  thinking: { mode: 'harness', baseUrl: '', apiKey: '', model: '', reasoningEffort: 'auto' },
}

/**
 * 校验 http(s) 地址。
 * @param {unknown} value
 * @returns {boolean}
 */
function isHttpUrl(value) {
  if (typeof value !== 'string' || value.trim() === '') return false
  try {
    const parsed = new URL(value.trim())
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * 宽松归一化：坏字段回退到默认值（读取设置时使用）。
 * @param {unknown} value
 * @returns {{ search: object, thinking: object }}
 */
export function normalizeCustomApi(value) {
  const raw = value !== null && typeof value === 'object' ? value : {}
  const rawSearch = raw.search !== null && typeof raw.search === 'object' ? raw.search : {}
  const rawThinking = raw.thinking !== null && typeof raw.thinking === 'object' ? raw.thinking : {}
  const provider = SEARCH_PROVIDERS.includes(rawSearch.provider) ? rawSearch.provider : DEFAULT_CUSTOM_API.search.provider
  return {
    search: {
      mode: rawSearch.mode === 'custom' ? 'custom' : 'harness',
      provider,
      baseUrl: typeof rawSearch.baseUrl === 'string' ? rawSearch.baseUrl.trim() : '',
      apiKey: typeof rawSearch.apiKey === 'string' ? rawSearch.apiKey.trim() : '',
    },
    thinking: {
      mode: rawThinking.mode === 'custom' ? 'custom' : 'harness',
      baseUrl: typeof rawThinking.baseUrl === 'string' ? rawThinking.baseUrl.trim() : '',
      apiKey: typeof rawThinking.apiKey === 'string' ? rawThinking.apiKey.trim() : '',
      model: typeof rawThinking.model === 'string' ? rawThinking.model.trim() : '',
      reasoningEffort: THINKING_EFFORTS.includes(rawThinking.reasoningEffort) ? rawThinking.reasoningEffort : 'auto',
    },
  }
}

/**
 * 严格校验（保存设置时使用）：切到 custom 时必须给出合法配置。
 * @param {unknown} value
 * @returns {{ search: object, thinking: object }}
 */
export function validateCustomApi(value) {
  if (value === null || typeof value !== 'object') throw new Error('customApi 必须是对象')
  const normalized = normalizeCustomApi(value)
  if (normalized.search.mode === 'custom') {
    if (!isHttpUrl(normalized.search.baseUrl)) {
      throw new Error('自定义搜索 API 需要合法的 http(s) 接口地址')
    }
    if (normalized.search.provider !== 'searxng' && normalized.search.apiKey === '') {
      throw new Error('自定义搜索 API 需要填写 API Key（SearXNG 可留空）')
    }
  }
  if (normalized.thinking.mode === 'custom') {
    if (!isHttpUrl(normalized.thinking.baseUrl)) throw new Error('自定义思考 API 需要合法的 http(s) 接口地址')
    if (normalized.thinking.model === '') throw new Error('自定义思考 API 需要填写模型名')
  }
  return normalized
}

/**
 * 用给定的 fetch 实现发一次 HTTP 请求（可注入，便于测试）。
 * @param {{ fetchImpl?: Function }} options
 * @returns {Function}
 */
function httpFetch(options) {
  const impl = options !== null && typeof options === 'object' && typeof options.fetchImpl === 'function' ? options.fetchImpl : globalThis.fetch
  if (typeof impl !== 'function') throw createError('CUSTOM_API_UNAVAILABLE', '当前运行环境没有可用的 fetch 实现')
  return impl
}

/**
 * 把各平台搜索结果统一成 Harness 的 sources 结构。
 * @param {string} provider
 * @param {unknown} payload
 * @returns {Array<{ url: string, title: string, snippet: string }>}
 */
function parseSearchPayload(provider, payload) {
  const out = []
  if (payload === null || payload === undefined) return out
  if (provider === 'tavily') {
    for (const entry of Array.isArray(payload.results) ? payload.results : []) {
      if (typeof entry?.url !== 'string') continue
      out.push({ url: entry.url, title: String(entry.title ?? entry.url), snippet: String(entry.content ?? '') })
    }
  } else if (provider === 'bocha') {
    const pages = payload?.data?.webPages?.value ?? payload?.webPages?.value ?? []
    for (const entry of Array.isArray(pages) ? pages : []) {
      if (typeof entry?.url !== 'string') continue
      out.push({ url: entry.url, title: String(entry.name ?? entry.title ?? entry.url), snippet: String(entry.snippet ?? entry.summary ?? '') })
    }
  } else if (provider === 'searxng') {
    for (const entry of Array.isArray(payload.results) ? payload.results : []) {
      if (typeof entry?.url !== 'string') continue
      out.push({ url: entry.url, title: String(entry.title ?? entry.url), snippet: String(entry.content ?? '') })
    }
  } else if (provider === 'serper') {
    for (const entry of Array.isArray(payload.organic) ? payload.organic : []) {
      if (typeof entry?.link !== 'string') continue
      out.push({ url: entry.link, title: String(entry.title ?? entry.link), snippet: String(entry.snippet ?? '') })
    }
  }
  return out
}

/**
 * 创建自定义搜索适配器：`search()` 走用户配置的平台，`fetch()` 继续用 Harness 的抓取（没有则不提供）。
 *
 * @param {object} searchConfig customApi.search
 * @param {{ fetch?: Function } | undefined} harnessWeb Harness 的 web 服务（用于抓取）
 * @param {{ fetchImpl?: Function }} [options] 注入 fetch 便于测试
 * @returns {{ search: Function, fetch?: Function }}
 */
export function createCustomSearchWeb(searchConfig, harnessWeb, options = {}) {
  const config = normalizeCustomApi({ search: searchConfig }).search
  const fetchImpl = httpFetch(options)
  const baseUrl = config.baseUrl !== '' ? config.baseUrl : SEARCH_DEFAULT_BASE[config.provider]

  async function search(request, signal) {
    const query = typeof request?.query === 'string' ? request.query : ''
    const maxResults = Number.isFinite(request?.maxResults) ? Math.max(1, Math.min(10, Math.round(request.maxResults))) : 8
    if (query === '') throw createError('INVALID_QUERY', '缺少检索词')
    const timeout = AbortSignal.timeout(20000)
    const combined = signal === undefined || signal === null ? timeout : AbortSignal.any([signal, timeout])
    let response
    let payload
    try {
      if (config.provider === 'tavily') {
        const endpoint = baseUrl.replace(/\/+$/, '') + '/search'
        response = await fetchImpl(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${config.apiKey}` },
          body: JSON.stringify({ query, max_results: maxResults, search_depth: 'basic' }),
          signal: combined,
        })
      } else if (config.provider === 'bocha') {
        const endpoint = baseUrl.includes('/web-search') ? baseUrl : baseUrl.replace(/\/+$/, '') + '/web-search'
        response = await fetchImpl(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${config.apiKey}` },
          body: JSON.stringify({ query, count: maxResults }),
          signal: combined,
        })
      } else if (config.provider === 'searxng') {
        const endpoint = baseUrl.replace(/\/+$/, '') + '/search?q=' + encodeURIComponent(query) + '&format=json'
        const headers = config.apiKey === '' ? {} : { authorization: `Bearer ${config.apiKey}` }
        response = await fetchImpl(endpoint, { headers, signal: combined })
      } else {
        const endpoint = baseUrl.replace(/\/+$/, '') + '/search'
        response = await fetchImpl(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'X-API-KEY': config.apiKey },
          body: JSON.stringify({ q: query, num: maxResults }),
          signal: combined,
        })
      }
      if (!response || response.ok !== true) {
        throw new Error(`HTTP ${response?.status ?? 'error'}`)
      }
      payload = await response.json()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw createError('CUSTOM_SEARCH_FAILED', `自定义搜索 API 调用失败：${message}`)
    }
    const sources = parseSearchPayload(config.provider, payload).slice(0, maxResults)
    return { sources, truncated: sources.length < maxResults }
  }

  const adapter = { search }
  if (harnessWeb !== undefined && harnessWeb !== null && typeof harnessWeb.fetch === 'function') {
    adapter.fetch = harnessWeb.fetch.bind(harnessWeb)
  }
  return adapter
}

/**
 * 把消息里的 content 块拍平成纯文本（OpenAI 兼容接口只吃字符串）。
 * @param {Array<object>} messages
 * @returns {Array<{ role: string, content: string }>}
 */
function flattenMessages(messages) {
  const out = []
  for (const message of Array.isArray(messages) ? messages : []) {
    if (message === null || typeof message !== 'object') continue
    let text = ''
    if (typeof message.content === 'string') text = message.content
    else if (Array.isArray(message.content)) {
      text = message.content
        .filter((block) => block !== null && typeof block === 'object' && block.type === 'text' && typeof block.text === 'string')
        .map((block) => block.text)
        .join('')
    }
    out.push({ role: typeof message.role === 'string' ? message.role : 'user', content: text })
  }
  return out
}

/**
 * 用自定义 OpenAI 兼容接口发一次非流式补全，返回文本。
 *
 * @param {object} thinkingConfig customApi.thinking
 * @param {{ system?: string, messages?: Array<object>, maxTokens?: number, signal?: AbortSignal }} request
 * @param {{ fetchImpl?: Function }} [options]
 * @returns {Promise<string>}
 */
export async function callCustomThinking(thinkingConfig, request = {}, options = {}) {
  const config = normalizeCustomApi({ thinking: thinkingConfig }).thinking
  const fetchImpl = httpFetch(options)
  const endpoint = config.baseUrl.replace(/\/+$/, '') + '/chat/completions'
  const messages = flattenMessages(request.messages)
  if (typeof request.system === 'string' && request.system !== '') {
    messages.unshift({ role: 'system', content: request.system })
  }
  const body = {
    model: config.model,
    messages,
    temperature: 0.2,
    stream: false,
  }
  if (Number.isFinite(request.maxTokens)) body.max_tokens = Math.max(1, Math.round(request.maxTokens))
  if (config.reasoningEffort !== 'auto') body.reasoning_effort = config.reasoningEffort
  const timeout = AbortSignal.timeout(60000)
  const signal = request.signal === undefined || request.signal === null ? timeout : AbortSignal.any([request.signal, timeout])
  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify(body),
      signal,
    })
    if (!response || response.ok !== true) throw new Error(`HTTP ${response?.status ?? 'error'}`)
    const payload = await response.json()
    const content = payload?.choices?.[0]?.message?.content
    if (typeof content === 'string' && content.trim() !== '') return content
    throw new Error('模型没有返回文本')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw createError('CUSTOM_MODEL_FAILED', `自定义思考模型调用失败：${message}`)
  }
}

/**
 * 把自定义思考模型包装成 Harness `ctx.llm` 形状（只实现 stream，足够现有调用方使用）。
 *
 * @param {object} thinkingConfig customApi.thinking
 * @param {{ fetchImpl?: Function }} [options]
 * @returns {{ stream: Function, listProviders: Function }}
 */
export function createCustomThinkingLlm(thinkingConfig, options = {}) {
  const config = normalizeCustomApi({ thinking: thinkingConfig }).thinking
  return {
    listProviders() {
      return [{ id: 'custom', name: config.model }]
    },
    async *stream({ messages, system, maxTokens, signal }) {
      const text = await callCustomThinking(config, { messages, system, maxTokens: maxTokens ?? 1600, signal }, options)
      yield { type: 'text-delta', text }
      yield { type: 'finish', reason: { kind: 'stop' } }
    },
  }
}

/**
 * 用自定义模型替换 ctx 的 llm 与 agentDefaultModel（供 curate/model-json 解析路由）。
 * @param {object} ctx
 * @param {object} thinkingConfig
 * @param {{ fetchImpl?: Function }} [options]
 * @returns {object}
 */
export function createThinkingCtx(ctx, thinkingConfig, options = {}) {
  const config = normalizeCustomApi({ thinking: thinkingConfig }).thinking
  const llm = createCustomThinkingLlm(config, options)
  const agentDefaultModel = { currentSelection: () => ({ provider: 'custom', model: config.model }) }
  return {
    get(name) {
      if (name === 'llm') return llm
      if (name === 'agentDefaultModel') return agentDefaultModel
      return ctx.get(name)
    },
  }
}
