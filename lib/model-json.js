/**
 * 模型 JSON 调用的公共封装。
 *
 * 上层能力（encyclopedia / browse）都要做同样三件事：
 *   1. 选一条可用的模型路由（优先跟随 Harness 默认模型，其次 provider 列表里的第一个）；
 *   2. 发起一次流式调用，把 text-delta（或 block-end 的文本块）拼成完整文本；
 *   3. 从模型输出里解析出第一个 JSON 对象（模型经常带 Markdown 围栏或前后解释）。
 *
 * 可预期的失败统一抛出带 `code` 的 Error，由调用方决定降级还是继续抛出；
 * 取消/超时（AbortError / TimeoutError）原样透传，方便调用方识别真正的取消。
 * 本模块不调用 process.exit，也不做任何日志输出。
 */

import { createError, isAbortError } from './errors.js'

/** 默认输出上限。 */
const DEFAULT_MAX_TOKENS = 1600
/** 默认温度。 */
const DEFAULT_TEMPERATURE = 0.2
/** 流对象缺失/不可读时的兜底文案。 */
const BROKEN_STREAM_MESSAGE = 'AI 返回了无法读取的流'

/**
 * 去掉 Markdown 代码围栏所在的行（```json / ``` / ~~~ 等）。
 * 只删除整行的围栏标记，围栏里的 JSON 仍由后续的平衡括号扫描定位。
 * @param {string} text
 * @returns {string}
 */
function stripFences(text) {
  return text.replace(/^[ \t]*(?:```|~~~)[^\n]*$/gm, '')
}

/**
 * 从文本里截出第一个平衡的 `{...}`；扫描时尊重字符串与转义。
 * 与 curate.js 的 findJsonObject 保持同一策略，避免两处解析行为不一致。
 * @param {string} text
 * @returns {string | null}
 */
function findObjectText(text) {
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
 * 从模型输出里解析第一个 JSON 对象。
 * 容忍前后解释文字与 Markdown 围栏；解析失败或不是对象时返回 null。
 * @param {string} text
 * @returns {object | null}
 */
export function parseJsonObject(text) {
  if (typeof text !== 'string' || text.trim() === '') return null
  const objectText = findObjectText(stripFences(text))
  if (objectText === null) return null
  try {
    const parsed = JSON.parse(objectText)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return parsed
  } catch {
    return null
  }
}

/**
 * 安全读取 ctx 上的服务；ctx 缺失或 get 抛错时返回 undefined。
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
 * 读取 Harness 默认模型选择；服务缺失或实现异常时返回 undefined。
 * @param {object} ctx
 * @returns {{ provider?: string, model?: string } | undefined}
 */
function preferredSelection(ctx) {
  const service = safeCtxGet(ctx, 'agentDefaultModel')
  if (service === null || typeof service !== 'object' || typeof service.currentSelection !== 'function') return undefined
  try {
    const selection = service.currentSelection()
    return selection === null || typeof selection !== 'object' ? undefined : selection
  } catch {
    return undefined
  }
}

/**
 * 列出 llm 服务声明的 provider id。
 * `available` 表示服务是否提供了可用的 listProviders；没有该能力时无法校验默认路由。
 * @param {object} llm
 * @returns {{ available: boolean, ids: string[] }}
 */
function providerIdsOf(llm) {
  if (llm === null || typeof llm !== 'object' || typeof llm.listProviders !== 'function') {
    return { available: false, ids: [] }
  }
  try {
    const list = llm.listProviders()
    if (!Array.isArray(list)) return { available: true, ids: [] }
    const ids = []
    for (const entry of list) {
      const id = typeof entry === 'string' ? entry : entry?.id
      if (typeof id === 'string' && id !== '' && !ids.includes(id)) ids.push(id)
    }
    return { available: true, ids }
  } catch {
    // listProviders 自己坏了就不要用它来否决默认路由。
    return { available: false, ids: [] }
  }
}

/**
 * 解析模型路由：优先 Harness 默认模型，其次 provider 列表第一个可用的模型。
 * @param {object} ctx
 * @param {object} llm
 * @returns {Promise<{ provider: string, model: string }>}
 */
async function resolveModelRoute(ctx, llm) {
  const selection = preferredSelection(ctx)
  const providers = providerIdsOf(llm)
  const provider = typeof selection?.provider === 'string' ? selection.provider : ''
  const model = typeof selection?.model === 'string' ? selection.model : ''
  if (provider !== '' && model !== '') {
    // 无法枚举 provider，或默认 provider 确实在列表里时才采信默认路由。
    if (!providers.available || providers.ids.length === 0 || providers.ids.includes(provider)) {
      return { provider, model }
    }
  }
  for (const candidate of providers.ids) {
    try {
      const models = await llm.listModels(candidate)
      const list = Array.isArray(models) ? models : []
      for (const entry of list) {
        const id = typeof entry === 'string' ? entry : entry?.id
        if (typeof id === 'string' && id !== '') return { provider: candidate, model: id }
      }
    } catch {
      /* 这个 provider 拿不到模型，试下一个 */
    }
  }
  throw createError('AI_ROUTE_UNAVAILABLE', '没有可用的模型路由，AI 功能不可用')
}

/**
 * 调一次模型并返回完整文本。
 *
 * @param {object} options
 * @param {object} options.ctx Host 上下文（用于读取 agentDefaultModel）。
 * @param {object} options.llm llm 服务。
 * @param {string} options.system 系统提示词。
 * @param {string} options.user 用户消息文本（本模块会包成 text 内容块）。
 * @param {number} [options.maxTokens=1600]
 * @param {number} [options.temperature=0.2]
 * @param {AbortSignal} [options.signal] 调用方取消信号，可为 undefined。
 * @returns {Promise<{ text: string, model: string, provider: string }>}
 */
export async function runModelJson(options = {}) {
  const ctx = options.ctx
  const llm = options.llm
  const system = typeof options.system === 'string' ? options.system : ''
  const user = typeof options.user === 'string' ? options.user : String(options.user ?? '')
  const maxTokens = Number.isFinite(options.maxTokens) ? Math.max(1, Math.round(options.maxTokens)) : DEFAULT_MAX_TOKENS
  const temperature = Number.isFinite(options.temperature) ? options.temperature : DEFAULT_TEMPERATURE
  const signal = options.signal

  if (llm === null || typeof llm !== 'object' || (typeof llm.stream !== 'function' && typeof llm.prepareCall !== 'function')) {
    throw createError('AI_ROUTE_UNAVAILABLE', '没有可用的模型服务（ctx.llm）')
  }

  const route = await resolveModelRoute(ctx, llm)
  const messages = [{ role: 'user', content: [{ type: 'text', text: user }] }]
  const baseOptions = { provider: route.provider, model: route.model, maxTokens, temperature }

  try {
    let streamSource
    if (typeof llm.prepareCall === 'function') {
      const call = await llm.prepareCall(baseOptions, signal, (controls, info) => {
        const effort = info?.reasoning?.efforts?.[0]?.id
        return effort ? { ...controls, reasoningEffort: effort } : { ...controls }
      })
      if (call === null || call === undefined || typeof call.stream !== 'function') {
        throw createError('AI_CALL_FAILED', BROKEN_STREAM_MESSAGE)
      }
      streamSource = call.stream({ ...(call.config ?? {}), messages, system, signal })
    } else {
      streamSource = llm.stream({ ...baseOptions, messages, system, signal })
    }

    // 有些实现返回 Promise<stream>；await 对普通可迭代对象是幂等的。
    const stream = await streamSource
    if (stream === null || typeof stream !== 'object' || typeof stream[Symbol.asyncIterator] !== 'function') {
      throw createError('AI_CALL_FAILED', BROKEN_STREAM_MESSAGE)
    }

    let text = ''
    const blocks = []
    let finish
    for await (const chunk of stream) {
      if (chunk === null || typeof chunk !== 'object') continue
      if (chunk.type === 'text-delta' && typeof chunk.text === 'string') text += chunk.text
      else if (chunk.type === 'block-end' && chunk.block !== undefined) blocks.push(chunk.block)
      else if (chunk.type === 'finish') finish = chunk.reason
    }
    // 只给 block-end 不给 text-delta 的实现：从文本块里回捞。
    if (text.trim() === '' && blocks.length > 0) {
      text = blocks
        .filter((block) => block !== null && typeof block === 'object' && block.type === 'text' && typeof block.text === 'string')
        .map((block) => block.text)
        .join('')
    }
    if (finish !== null && typeof finish === 'object' && (finish.kind === 'error' || finish.kind === 'aborted')) {
      const message =
        typeof finish.failure?.message === 'string' && finish.failure.message !== '' ? finish.failure.message : 'AI 调用失败'
      throw createError('AI_CALL_FAILED', message)
    }
    if (text.trim() === '') throw createError('AI_EMPTY_RESPONSE', 'AI 没有返回任何文本')
    return { text, model: route.model, provider: route.provider }
  } catch (error) {
    // 取消/超时原样抛出，让调用方区分“用户取消”与“模型失败”。
    if (isAbortError(error)) throw error
    if (error instanceof Error && typeof error.code === 'string' && error.code.startsWith('AI_')) throw error
    const message = error instanceof Error && error.message !== '' ? error.message : String(error)
    throw createError('AI_CALL_FAILED', message)
  }
}
