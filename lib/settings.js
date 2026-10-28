/**
 * 插件设置的持久化。
 *
 * 项：
 * - language：结果语言（auto 跟随 Harness / zh / en）
 * - encyclopediaDetail：百科模式详细程度（brief / standard / detailed）
 * - browseWeights：浏览模式三指标权重（相关性 / 时效性 / 热度，0–100，使用前归一化）
 *
 * 存在 DSH home 下的 `ai-search/settings.json`，重启后仍然生效；读取失败时回退到默认值，
 * 不让一个坏文件拖垮搜索。
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { resolveDataFile } from './paths.js'

/** 可选的结果语言：auto = 跟随 Harness 界面语言（Agent 调用时按问题语言推断）。 */
export const LANGUAGE_OPTIONS = ['auto', 'zh', 'en']

/** 百科模式详细程度选项。 */
export const ENCYCLOPEDIA_DETAIL_OPTIONS = ['brief', 'standard', 'detailed']

/** 浏览模式的三项排序指标。 */
export const BROWSE_WEIGHT_KEYS = ['relevance', 'timeliness', 'heat']

/** 默认设置。 */
export const SETTINGS_DEFAULTS = {
  language: 'auto',
  encyclopediaDetail: 'standard',
  browseWeights: { relevance: 40, timeliness: 30, heat: 30 },
  /** 切换工作区 / 对话时是否保留搜索页状态（默认保留）。 */
  preserveState: true,
}

/**
 * 校验语言取值。
 * @param {unknown} value
 * @returns {'auto' | 'zh' | 'en' | null}
 */
export function normalizeLanguageSetting(value) {
  return typeof value === 'string' && LANGUAGE_OPTIONS.includes(value) ? value : null
}

/**
 * 校验百科详细程度。
 * @param {unknown} value
 * @returns {'brief' | 'standard' | 'detailed' | null}
 */
export function normalizeEncyclopediaDetail(value) {
  return typeof value === 'string' && ENCYCLOPEDIA_DETAIL_OPTIONS.includes(value) ? value : null
}

/**
 * 归一化三指标权重：缺失项取默认值，非法项取默认值，每项夹到 0–100 的整数；
 * 三项全为 0 时保持 0（由打分逻辑按“只看相关性”处理）。
 * @param {unknown} value
 * @returns {{ relevance: number, timeliness: number, heat: number }}
 */
export function normalizeBrowseWeights(value) {
  const input = value !== null && typeof value === 'object' ? value : {}
  const next = {}
  for (const key of BROWSE_WEIGHT_KEYS) {
    const raw = input[key]
    const numeric = typeof raw === 'number' ? raw : Number.parseFloat(String(raw ?? ''))
    next[key] = Number.isFinite(numeric) ? Math.max(0, Math.min(100, Math.round(numeric))) : SETTINGS_DEFAULTS.browseWeights[key]
  }
  return next
}

/**
 * 读取时把任意存储值收敛成合法设置对象。
 * @param {unknown} stored
 * @returns {{ language: string, encyclopediaDetail: string, browseWeights: { relevance: number, timeliness: number, heat: number } }}
 */
function normalizeStored(stored) {
  const record = stored !== null && typeof stored === 'object' ? stored : {}
  return {
    language: normalizeLanguageSetting(record.language) ?? SETTINGS_DEFAULTS.language,
    encyclopediaDetail: normalizeEncyclopediaDetail(record.encyclopediaDetail) ?? SETTINGS_DEFAULTS.encyclopediaDetail,
    browseWeights: normalizeBrowseWeights(record.browseWeights),
    preserveState: typeof record.preserveState === 'boolean' ? record.preserveState : SETTINGS_DEFAULTS.preserveState,
  }
}

/**
 * 创建设置存储（带进程内缓存，文件只在首次读取与保存时访问）。
 *
 * @param {object} ctx Host 上下文，用于解析 DSH home。
 * @returns {{ get: Function, save: Function, describe: Function, filePath: Function }}
 */
export function createSettingsStore(ctx) {
  /** @type {ReturnType<typeof normalizeStored> | null} */
  let cache = null

  /**
   * 设置文件路径。
   * @returns {string}
   */
  function filePath() {
    return resolveDataFile(ctx, 'settings.json')
  }

  /**
   * 读取设置；坏文件/未知取值回退默认值。
   * @returns {{ language: string, encyclopediaDetail: string, browseWeights: { relevance: number, timeliness: number, heat: number } }}
   */
  function get() {
    if (cache !== null) return cache
    let stored = null
    try {
      stored = JSON.parse(readFileSync(filePath(), 'utf8'))
    } catch {
      stored = null
    }
    cache = normalizeStored(stored)
    return cache
  }

  /**
   * 保存设置（部分更新，未提供的项保持不变）。写入失败抛出可读错误。
   * @param {{ language?: unknown, encyclopediaDetail?: unknown, browseWeights?: unknown }} input
   * @returns {ReturnType<typeof normalizeStored>}
   */
  function save(input) {
    if (input === null || typeof input !== 'object') throw new Error('设置必须是一个对象')
    const current = get()
    const next = { ...current }
    if (Object.prototype.hasOwnProperty.call(input, 'language')) {
      const language = normalizeLanguageSetting(input.language)
      if (language === null) throw new Error('language 必须是 auto / zh / en 之一')
      next.language = language
    }
    if (Object.prototype.hasOwnProperty.call(input, 'encyclopediaDetail')) {
      const detail = normalizeEncyclopediaDetail(input.encyclopediaDetail)
      if (detail === null) throw new Error('encyclopediaDetail 必须是 brief / standard / detailed 之一')
      next.encyclopediaDetail = detail
    }
    if (Object.prototype.hasOwnProperty.call(input, 'browseWeights')) {
      next.browseWeights = normalizeBrowseWeights(input.browseWeights)
    }
    if (Object.prototype.hasOwnProperty.call(input, 'preserveState')) {
      if (typeof input.preserveState !== 'boolean') throw new Error('preserveState 必须是布尔值')
      next.preserveState = input.preserveState
    }
    const target = filePath()
    try {
      mkdirSync(dirname(target), { recursive: true })
      writeFileSync(target, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
    } catch (error) {
      throw new Error(`保存设置失败：${error instanceof Error ? error.message : String(error)}`)
    }
    cache = next
    return next
  }

  /**
   * 暴露给浏览器设置页与健康检查。
   * @returns {object}
   */
  function describe() {
    return {
      settings: JSON.parse(JSON.stringify(get())),
      options: {
        language: [...LANGUAGE_OPTIONS],
        encyclopediaDetail: [...ENCYCLOPEDIA_DETAIL_OPTIONS],
      },
      weightKeys: [...BROWSE_WEIGHT_KEYS],
      weightMax: 100,
      defaults: JSON.parse(JSON.stringify(SETTINGS_DEFAULTS)),
    }
  }

  return { get, save, describe, filePath }
}
