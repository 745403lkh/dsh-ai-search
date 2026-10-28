/**
 * 浏览器半侧使用的同源 HTTP 接口（安全加固版）。
 *
 * 前缀 `/.dsh-ai-search` 由 Host 的 webServer 注册；页面（client.js）用
 * `fetch('/.dsh-ai-search/...')` 调用。
 *
 * 安全模型（默认拒绝）：
 * 1. 所有接口（含 GET）都必须携带本地客户端请求头 `x-dsh-ai-search: 1`。
 *    浏览器跨站请求无法在不触发 CORS 预检的情况下设置自定义头，`<img>` / `<script>` /
 *    表单这类"简单请求"也带不上它；本接口从不返回 CORS 头，因此第三方网页拿不到数据、
 *    也触发不了检索（防止刷检索/模型配额、探测过滤规则、污染搜索历史）。
 * 2. Host 必须是本机回环地址；请求带 Origin 时，Origin 也必须是回环或桌面壳协议
 *    （这条对 GET 同样生效，堵住 DNS rebinding 读取响应的路径）。
 * 3. 不再提供 GET 搜索调试接口：搜索只接受 POST，避免 `<img src=...?q=...>` 一类请求。
 * 4. 搜索接口有频率限制（每客户端每分钟 10 次），超限返回 429。
 * 5. 所有响应带 `nosniff` / `no-referrer` / `no-store`，且从不输出 CORS 头。
 *
 * 只读接口（health / settings / history）保留 GET 形态，方便后续扩展调试入口，
 * 但和写接口使用同一道守卫。
 *
 *   GET  /.dsh-ai-search/health          → 依赖服务与默认参数
 *   GET  /.dsh-ai-search/settings        → 当前设置（语言 / 百科档位 / 浏览权重 / 保留状态）
 *   POST /.dsh-ai-search/settings        → 部分更新以上设置
 *   GET  /.dsh-ai-search/history         → 最近搜索历史
 *   POST /.dsh-ai-search/history         → { action: 'clear' }
 *   POST /.dsh-ai-search/search          → { query, mode?, maxResults?, ai?, uiLanguage?, page?, exclude? }
 */

import { describeError, isAbortError } from './errors.js'

/** 路由前缀：与 client.js 中的常量保持一致。 */
export const ROUTE_PREFIX = '/.dsh-ai-search'

/** 本地客户端必须携带的请求头（跨站简单请求无法设置它）。 */
export const CLIENT_HEADER = 'x-dsh-ai-search'

/** 请求头的期望值。 */
export const CLIENT_HEADER_VALUE = '1'

/** POST 请求体上限，防止异常请求占内存。 */
const BODY_LIMIT_BYTES = 16 * 1024

/** 搜索接口的频率限制：窗口与上限。 */
const RATE_LIMIT_WINDOW_MS = 60 * 1000
const RATE_LIMIT_MAX_SEARCHES = 10

/** 本机回环主机名集合。 */
const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]'])

/**
 * 把 `host[:port]` 归一化成 `loopback:端口` 形式的身份。
 * @param {string} authority
 * @returns {string | null}
 */
function loopbackAuthority(authority) {
  try {
    const parsed = new URL(`http://${authority}`)
    if (!LOOPBACK_HOSTNAMES.has(parsed.hostname.toLowerCase())) return null
    return `loopback:${parsed.port === '' ? '80' : parsed.port}`
  } catch {
    return null
  }
}

/**
 * 请求是否来自本机页面（同源或桌面壳协议）。
 * @param {import('node:http').IncomingMessage} request
 * @returns {boolean}
 */
function isTrustedRequest(request) {
  const host = request.headers.host
  const hostKey = host === undefined ? null : loopbackAuthority(host)
  if (hostKey === null) return false
  const origin = request.headers.origin
  // 原生客户端/桌面壳可能不带 Origin；浏览器请求若带 Origin，则必须同源。
  if (origin === undefined || origin === '') return true
  try {
    const parsed = new URL(origin)
    if (parsed.protocol === 'dsh-app:') return true
    return loopbackAuthority(parsed.host) === hostKey
  } catch {
    return false
  }
}

/**
 * 请求是否携带本地客户端请求头。
 * @param {import('node:http').IncomingMessage} request
 * @returns {boolean}
 */
function hasClientHeader(request) {
  const value = request.headers[CLIENT_HEADER]
  return typeof value === 'string' && value === CLIENT_HEADER_VALUE
}

/**
 * 发送 JSON 响应。
 * @param {import('node:http').ServerResponse} response
 * @param {number} status
 * @param {unknown} body
 * @param {Record<string, string>} [extraHeaders]
 */
function sendJson(response, status, body, extraHeaders) {
  const payload = JSON.stringify(body)
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'content-length': Buffer.byteLength(payload),
    ...(extraHeaders ?? {}),
  })
  response.end(payload)
}

/**
 * 拒绝无权访问的请求；通过返回 true。
 * @param {import('node:http').IncomingMessage} request
 * @param {import('node:http').ServerResponse} response
 * @returns {boolean}
 */
function requireLocalClient(request, response) {
  if (!hasClientHeader(request)) {
    sendJson(response, 403, {
      ok: false,
      error: { code: 'FORBIDDEN_CLIENT', message: '缺少本地客户端请求头，接口只接受本机页面调用' },
    })
    return false
  }
  if (!isTrustedRequest(request)) {
    sendJson(response, 403, {
      ok: false,
      error: { code: 'UNTRUSTED_ORIGIN', message: '只接受来自本机页面的请求' },
    })
    return false
  }
  return true
}

/**
 * 读取并解析 JSON 请求体；超限或非法 JSON 抛错。
 * @param {import('node:http').IncomingMessage} request
 * @returns {Promise<object>}
 */
async function readJsonBody(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > BODY_LIMIT_BYTES) throw new Error('请求体过大')
    chunks.push(buffer)
  }
  if (chunks.length === 0) return {}
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    throw new Error('请求体不是合法 JSON')
  }
}

/**
 * 错误码 → HTTP 状态码。
 * @param {string} code
 * @returns {number}
 */
function statusForCode(code) {
  if (code === 'INVALID_QUERY' || code === 'INVALID_LANGUAGE' || code === 'INVALID_BODY') return 400
  if (code === 'WEB_UNAVAILABLE' || code === 'WEB_SEARCH_FAILED' || code === 'AI_ROUTE_UNAVAILABLE') return 502
  if (code === 'TIMEOUT' || code === 'ABORT_ERR') return 504
  return 500
}

/**
 * 创建路由处理函数。
 *
 * @param {{ search: Function, describe: Function }} service
 * @param {{ get: Function, save: Function, describe: Function }} settings
 * @param {{ record: Function, list: Function, clear: Function, describe: Function }} history
 * @returns {(request: import('node:http').IncomingMessage, response: import('node:http').ServerResponse) => Promise<void>}
 */
export function createSearchRouteHandler(service, settings, history) {
  /** 搜索频率限制的滑动窗口：每个客户端最近 60 秒的请求时间戳。 */
  const searchBuckets = new Map()

  /**
   * 取一次搜索配额；超限返回需要等待的毫秒数（0 表示放行）。
   * @param {import('node:http').IncomingMessage} request
   * @returns {number}
   */
  function takeSearchSlot(request) {
    const address =
      request.socket !== undefined && typeof request.socket.remoteAddress === 'string' ? request.socket.remoteAddress : 'local'
    const now = Date.now()
    const windowStart = now - RATE_LIMIT_WINDOW_MS
    const timestamps = (searchBuckets.get(address) ?? []).filter((value) => value > windowStart)
    if (timestamps.length >= RATE_LIMIT_MAX_SEARCHES) {
      searchBuckets.set(address, timestamps)
      return Math.max(1000, timestamps[0] + RATE_LIMIT_WINDOW_MS - now)
    }
    timestamps.push(now)
    searchBuckets.set(address, timestamps)
    if (searchBuckets.size > 32) {
      for (const [key, values] of searchBuckets) {
        if (!values.some((value) => value > windowStart)) searchBuckets.delete(key)
      }
    }
    return 0
  }

  return async function handler(request, response) {
    // 默认拒绝：所有接口都要求本地客户端请求头 + 本机回环来源。
    if (!requireLocalClient(request, response)) return

    const url = new URL(request.url ?? '/', 'http://localhost')
    const pathname = url.pathname

    if (pathname === `${ROUTE_PREFIX}/health`) {
      if (request.method !== 'GET') {
        sendJson(response, 405, { ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: '只支持 GET' } }, { allow: 'GET' })
        return
      }
      sendJson(response, 200, service.describe())
      return
    }

    if (pathname === `${ROUTE_PREFIX}/settings`) {
      if (request.method === 'GET') {
        sendJson(response, 200, { ok: true, ...settings.describe() })
        return
      }
      if (request.method === 'POST') {
        try {
          const body = await readJsonBody(request)
          const saved = settings.save(body)
          sendJson(response, 200, { ok: true, settings: saved })
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          sendJson(response, 400, { ok: false, error: { code: 'INVALID_SETTINGS', message } })
        }
        return
      }
      sendJson(response, 405, { ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: '只支持 GET / POST' } }, { allow: 'GET, POST' })
      return
    }

    if (pathname === `${ROUTE_PREFIX}/history`) {
      if (request.method === 'GET') {
        sendJson(response, 200, { ok: true, ...history.describe() })
        return
      }
      if (request.method === 'POST') {
        try {
          const body = await readJsonBody(request)
          if (body.action !== 'clear') {
            sendJson(response, 400, { ok: false, error: { code: 'INVALID_ACTION', message: '只支持 action=clear' } })
            return
          }
          history.clear()
          sendJson(response, 200, { ok: true, ...history.describe() })
        } catch (error) {
          sendJson(response, 400, {
            ok: false,
            error: { code: 'INVALID_BODY', message: error instanceof Error ? error.message : String(error) },
          })
        }
        return
      }
      sendJson(response, 405, { ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: '只支持 GET / POST' } }, { allow: 'GET, POST' })
      return
    }

    if (pathname !== `${ROUTE_PREFIX}/search`) {
      sendJson(response, 404, { ok: false, error: { code: 'NOT_FOUND', message: '未知接口' } })
      return
    }

    // 搜索只接受 POST：不再保留 GET 调试入口（可被跨站 img 等简单请求触发）。
    if (request.method !== 'POST') {
      sendJson(response, 405, { ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: '搜索只支持 POST' } }, { allow: 'POST' })
      return
    }

    const retryAfterMs = takeSearchSlot(request)
    if (retryAfterMs > 0) {
      sendJson(
        response,
        429,
        { ok: false, error: { code: 'RATE_LIMITED', message: '搜索过于频繁，请稍后再试' }, retryAfterMs },
        { 'retry-after': String(Math.ceil(retryAfterMs / 1000)) },
      )
      return
    }

    let input
    try {
      input = await readJsonBody(request)
    } catch (error) {
      sendJson(response, 400, {
        ok: false,
        error: { code: 'INVALID_BODY', message: error instanceof Error ? error.message : String(error) },
      })
      return
    }

    // 客户端断开时取消上游检索/模型调用，别让它们继续烧配额。
    const controller = new AbortController()
    response.on('close', () => {
      if (!response.writableEnded) controller.abort(new Error('client disconnected'))
    })

    try {
      const result = await service.search(
        {
          query: input.query,
          mode: input.mode,
          maxResults: input.maxResults,
          ai: input.ai !== false,
          uiLanguage: input.uiLanguage,
          page: input.page,
          exclude: input.exclude,
        },
        { signal: controller.signal },
      )
      if (response.writableEnded) return
      sendJson(response, 200, result)
    } catch (error) {
      if (response.writableEnded) return
      if (isAbortError(error)) {
        sendJson(response, 504, { ok: false, error: { code: 'TIMEOUT', message: '检索超时，请重试或简化问题' } })
        return
      }
      const described = describeError(error)
      sendJson(response, statusForCode(described.code), { ok: false, error: described })
    }
  }
}
