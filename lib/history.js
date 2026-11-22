/**
 * 搜索历史：记录最近成功完成的搜索（页面与 Agent 工具共用同一份）。
 *
 * - 存在 DSH home 下的 `ai-search/history.json`，最多 20 条，按最近使用排序；
 * - 文件格式：`{ version: 2, items: [...] }`；旧版纯数组文件读取时自动迁移；
 * - 每条带 `source`：page（页面搜索）/ tool（Agent 工具调用）/ legacy（旧数据，界面显示为「历史」）；
 * - 同一问题（忽略大小写）只保留一条，再次搜索会移到最前；
 * - 历史写入是「尽力而为」：磁盘出错只记日志，绝不让搜索失败。
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { resolveDataFile } from './paths.js'

/** 保留的历史条数。 */
export const HISTORY_LIMIT = 20

/** 历史文件结构版本：2 起为 { version, items }，旧版是纯数组。 */
export const HISTORY_SCHEMA_VERSION = 2

/** 历史来源：页面搜索 / Agent 工具调用 / 旧数据（不参与筛选，只作展示）。 */
export const HISTORY_SOURCES = ['page', 'tool', 'legacy']

/** 单条历史的问题长度上限，防止脏数据撑大文件。 */
const MAX_QUERY_CHARS = 300

/**
 * 归一化一条历史记录；不可用时返回 null。旧数据（无 source / unknown）归为 legacy。
 * @param {unknown} raw
 * @returns {{ query: string, at: number, ai: boolean, kept: number, source: 'page' | 'tool' | 'legacy' } | null}
 */
function normalizeEntry(raw) {
  if (raw === null || typeof raw !== 'object') return null
  const record = /** @type {Record<string, unknown>} */ (raw)
  if (typeof record.query !== 'string') return null
  const query = record.query.replace(/\s+/g, ' ').trim()
  if (query === '' || query.length > MAX_QUERY_CHARS) return null
  const at = typeof record.at === 'number' && Number.isFinite(record.at) ? record.at : Date.now()
  return {
    query,
    at,
    ai: record.ai === true,
    kept: typeof record.kept === 'number' && Number.isFinite(record.kept) ? Math.max(0, Math.round(record.kept)) : 0,
    source: record.source === 'page' || record.source === 'tool' ? record.source : 'legacy',
  }
}

/**
 * 摘要化一条记录给浏览器（时间用 ISO 字符串，避免客户端依赖时区推断）。
 * @param {{ query: string, at: number, ai: boolean, kept: number, source: 'page' | 'tool' | 'legacy' }} entry
 * @returns {{ query: string, at: string, ai: boolean, kept: number, source: 'page' | 'tool' | 'legacy' }}
 */
function presentEntry(entry) {
  return {
    query: entry.query,
    at: new Date(entry.at).toISOString(),
    ai: entry.ai,
    kept: entry.kept,
    source: entry.source,
  }
}

/**
 * 创建搜索历史存储（进程内缓存，读写文件失败不抛出）。
 *
 * @param {object} ctx Host 上下文。
 * @returns {{ record: (input: { query: unknown, ai?: unknown, kept?: unknown }) => void, list: () => Array<object>, clear: () => void, describe: () => object, filePath: () => string }}
 */
export function createHistoryStore(ctx) {
  /** @type {Array<{ query: string, at: number, ai: boolean, kept: number }> | null} */
  let cache = null

  /**
   * 历史文件路径。
   * @returns {string}
   */
  function filePath() {
    return resolveDataFile(ctx, 'history.json')
  }

  /**
   * 读取历史；坏文件回退空列表。兼容两种格式：
   * - version 2：{ version: 2, items: [...] }
   * - legacy：纯数组（无版本号，条目无 source 的归为 legacy）
   * @returns {Array<{ query: string, at: number, ai: boolean, kept: number, source: 'page' | 'tool' | 'legacy' }>}
   */
  function read() {
    if (cache !== null) return cache
    let entries = []
    try {
      const parsed = JSON.parse(readFileSync(filePath(), 'utf8'))
      const rawItems = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.items) ? parsed.items : []
      entries = rawItems.map(normalizeEntry).filter((entry) => entry !== null)
    } catch {
      entries = []
    }
    cache = entries.slice(0, HISTORY_LIMIT)
    return cache
  }

  /**
   * 写入历史；失败只告警。始终写 version 2 结构。
   * @param {Array<{ query: string, at: number, ai: boolean, kept: number, source: 'page' | 'tool' | 'legacy' }>} entries
   */
  function persist(entries) {
    try {
      mkdirSync(dirname(filePath()), { recursive: true })
      writeFileSync(
        filePath(),
        `${JSON.stringify({ version: HISTORY_SCHEMA_VERSION, items: entries }, null, 2)}\n`,
        'utf8',
      )
    } catch (error) {
      console.warn('[dsh-ai-search] 写搜索历史失败：', error)
    }
  }

  /**
   * 记录一次搜索。不抛出，调用方不必 try/catch。
   * @param {{ query: unknown, ai?: unknown, kept?: unknown, source?: unknown }} input
   */
  function record(input) {
    try {
      const entry = normalizeEntry({
        query: input?.query,
        at: Date.now(),
        ai: input?.ai === true,
        kept: input?.kept,
        source: input?.source,
      })
      if (entry === null) return
      const key = entry.query.toLowerCase()
      const next = [entry, ...read().filter((existing) => existing.query.toLowerCase() !== key)].slice(0, HISTORY_LIMIT)
      cache = next
      persist(next)
    } catch (error) {
      console.warn('[dsh-ai-search] 记录搜索历史失败：', error)
    }
  }

  /**
   * 列出历史（最近的在前）。
   * @returns {Array<{ query: string, at: string, ai: boolean, kept: number, source: 'page' | 'tool' | 'legacy' }>}
   */
  function list() {
    return read().map(presentEntry)
  }

  /** 清空历史。 */
  function clear() {
    cache = []
    persist([])
  }

  /**
   * 删除一条历史（按问题文本、忽略大小写）。
   * @param {unknown} query
   * @returns {boolean} 是否删除了记录
   */
  function remove(query) {
    const text = typeof query === 'string' ? query.replace(/\s+/g, ' ').trim() : ''
    if (text === '') return false
    const key = text.toLowerCase()
    const previous = read()
    const next = previous.filter((entry) => entry.query.toLowerCase() !== key)
    if (next.length === previous.length) return false
    cache = next
    persist(next)
    return true
  }

  /**
   * 给 HTTP 接口与设置页用的快照：条目 + 总数 + 按来源分类的数量。
   * legacy 只出现在「全部」里，不作为独立筛选项。
   * @returns {{ items: Array<object>, limit: number, counts: { page: number, tool: number, legacy: number, total: number } }}
   */
  function describe() {
    const items = list()
    const counts = { page: 0, tool: 0, legacy: 0, total: items.length }
    for (const item of items) counts[item.source] += 1
    return { items, limit: HISTORY_LIMIT, counts }
  }

  return { record, list, clear, remove, describe, filePath }
}
