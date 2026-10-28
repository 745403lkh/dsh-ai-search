/**
 * 搜索历史：记录最近成功完成的搜索（页面与 Agent 工具共用同一份）。
 *
 * - 存在 DSH home 下的 `ai-search/history.json`，最多 20 条，按最近使用排序；
 * - 同一问题（忽略大小写）只保留一条，再次搜索会移到最前；
 * - 历史写入是「尽力而为」：磁盘出错只记日志，绝不让搜索失败。
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { resolveDataFile } from './paths.js'

/** 保留的历史条数。 */
export const HISTORY_LIMIT = 20

/** 单条历史的问题长度上限，防止脏数据撑大文件。 */
const MAX_QUERY_CHARS = 300

/**
 * 归一化一条历史记录；不可用时返回 null。
 * @param {unknown} raw
 * @returns {{ query: string, at: number, ai: boolean, kept: number } | null}
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
  }
}

/**
 * 摘要化一条记录给浏览器（时间用 ISO 字符串，避免客户端依赖时区推断）。
 * @param {{ query: string, at: number, ai: boolean, kept: number }} entry
 * @returns {{ query: string, at: string, ai: boolean, kept: number }}
 */
function presentEntry(entry) {
  return {
    query: entry.query,
    at: new Date(entry.at).toISOString(),
    ai: entry.ai,
    kept: entry.kept,
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
   * 读取历史；坏文件回退空列表。
   * @returns {Array<{ query: string, at: number, ai: boolean, kept: number }>}
   */
  function read() {
    if (cache !== null) return cache
    let entries = []
    try {
      const parsed = JSON.parse(readFileSync(filePath(), 'utf8'))
      if (Array.isArray(parsed)) {
        entries = parsed.map(normalizeEntry).filter((entry) => entry !== null)
      }
    } catch {
      entries = []
    }
    cache = entries.slice(0, HISTORY_LIMIT)
    return cache
  }

  /**
   * 写入历史；失败只告警。
   * @param {Array<{ query: string, at: number, ai: boolean, kept: number }>} entries
   */
  function persist(entries) {
    try {
      mkdirSync(dirname(filePath()), { recursive: true })
      writeFileSync(filePath(), `${JSON.stringify(entries, null, 2)}\n`, 'utf8')
    } catch (error) {
      console.warn('[dsh-ai-search] 写搜索历史失败：', error)
    }
  }

  /**
   * 记录一次搜索。不抛出，调用方不必 try/catch。
   * @param {{ query: unknown, ai?: unknown, kept?: unknown }} input
   */
  function record(input) {
    try {
      const entry = normalizeEntry({
        query: input?.query,
        at: Date.now(),
        ai: input?.ai === true,
        kept: input?.kept,
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
   * @returns {Array<{ query: string, at: string, ai: boolean, kept: number }>}
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
   * 给 HTTP 接口与设置页用的快照。
   * @returns {object}
   */
  function describe() {
    return { items: list(), limit: HISTORY_LIMIT }
  }

  return { record, list, clear, describe, filePath }
}
