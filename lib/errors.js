/**
 * 插件内部错误类型：把可预期的失败（参数、上游服务、超时）连同机器可读的
 * code 一起抛出，方便 HTTP 层映射状态码、工具层回传原因。
 */

/** 带 code 的普通错误；HTTP 路由据此选择状态码。 */
export class AiSearchError extends Error {
  /**
   * @param {string} code 机器可读的错误码（如 INVALID_QUERY / WEB_UNAVAILABLE）。
   * @param {string} message 面向用户的中文说明。
   * @param {object} [details] 附加信息（不返回给浏览器以外的地方）。
   */
  constructor(code, message, details) {
    super(message)
    this.name = 'AiSearchError'
    this.code = code
    if (details !== undefined) this.details = details
  }
}

/**
 * 构造一个 AiSearchError；`createError` 这个名字在模块内更短。
 * @param {string} code
 * @param {string} message
 * @returns {AiSearchError}
 */
export function createError(code, message) {
  return new AiSearchError(code, message)
}

/**
 * 把任意异常归一化成 `{ code, message }`，未知异常保留原始消息。
 * @param {unknown} error
 * @returns {{ code: string, message: string }}
 */
export function describeError(error) {
  if (error instanceof AiSearchError) return { code: error.code, message: error.message }
  if (error instanceof Error) {
    const code = typeof error.code === 'string' && error.code !== '' ? error.code : 'INTERNAL_ERROR'
    return { code, message: error.message }
  }
  return { code: 'INTERNAL_ERROR', message: String(error) }
}

/**
 * 是否为调用方取消/超时（路由据此返回 499 语义或静默结束）。
 * @param {unknown} error
 * @returns {boolean}
 */
export function isAbortError(error) {
  if (error === null || typeof error !== 'object') return false
  if (error.name === 'AbortError' || error.name === 'TimeoutError') return true
  const code = typeof error.code === 'string' ? error.code : ''
  return code === 'ABORT_ERR' || code === 'ABORTED'
}
