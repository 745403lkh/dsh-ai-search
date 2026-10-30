/**
 * 插件设置的持久化。
 *
 * 项：
 * - language：结果语言（auto 跟随 Harness / zh / en）
 * - encyclopediaDetail：百科模式详细程度（brief / standard / detailed）
 * - browseWeights：浏览模式三指标权重（相关性 / 时效性 / 热度，0–100，使用前归一化）
 * - preserveState：切换页面/工作区时是否保留搜索页状态
 * - betterSidebar：是否适配 dsh-better-sidebar（注册侧边栏页签、结果链接在侧边栏浏览器打开）
 * - openLinksInSidebar：结果链接默认在侧边栏浏览器打开（否则用系统浏览器）
 * - defaultEngine：默认搜索引擎（内置 ai / baidu / bing / google / sogou，或 custom:<id>）
 * - customEngines：用户自定义搜索引擎 [{ id, name, urlTemplate }]，urlTemplate 用 *#*#*#* 代替搜索词
 * - customOfficialSites：用户自定义官网识别映射 [{ name, aliases, homepage }]
 *
 * 存在 DSH home 下的 `ai-search/settings.json`，重启后仍然生效；读取失败时回退到默认值，
 * 不让一个坏文件拖垮搜索。
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { resolveDataFile } from './paths.js'
import { normalizeCustomOfficialSites } from './official.js'

/** 可选的结果语言：auto = 跟随 Harness 界面语言（Agent 调用时按问题语言推断）。 */
export const LANGUAGE_OPTIONS = ['auto', 'zh', 'en']

/** 百科模式详细程度选项。 */
export const ENCYCLOPEDIA_DETAIL_OPTIONS = ['brief', 'standard', 'detailed']

/** 浏览模式的三项排序指标。 */
export const BROWSE_WEIGHT_KEYS = ['relevance', 'timeliness', 'heat']

/** 侧边栏内置搜索引擎：ai 走插件自己的三模式，其余直接跳转对应搜索引擎。 */
export const ENGINE_OPTIONS = ['ai', 'baidu', 'bing', 'google', 'sogou']

/** 自定义搜索引擎里代表搜索词的占位符（用户按此格式填写网址模板）。 */
export const CUSTOM_ENGINE_TOKEN = '*#*#*#*'

/** 自定义搜索引擎的数量上限。 */
export const CUSTOM_ENGINE_LIMIT = 12

/** 自定义官网识别映射的数量上限。 */
export const CUSTOM_OFFICIAL_SITE_LIMIT = 100

/** 默认设置。 */
export const SETTINGS_DEFAULTS = {
  language: 'auto',
  encyclopediaDetail: 'standard',
  browseWeights: { relevance: 40, timeliness: 30, heat: 30 },
  /** 切换工作区 / 对话时是否保留搜索页状态（默认保留）。 */
  preserveState: true,
  /** 是否适配 dsh-better-sidebar（未安装该插件时自动忽略）。 */
  betterSidebar: true,
  /** 结果链接默认在侧边栏浏览器打开；关闭则用系统默认浏览器。 */
  openLinksInSidebar: true,
  /** 默认搜索引擎（侧边栏内的 AI 搜索页左侧可随时切换）。 */
  defaultEngine: 'ai',
  /** 用户自定义搜索引擎。 */
  customEngines: [],
  /** 用户自定义官网识别映射。 */
  customOfficialSites: [],
}

/**
 * 严格校验自定义官网映射（保存时使用）：任意一项不合法直接抛错。
 * @param {unknown} value
 * @returns {Array<{ name: string, aliases: string[], domains: string[], homepage: string }>}
 */
export function validateCustomOfficialSites(value) {
  if (!Array.isArray(value)) throw new Error('customOfficialSites 必须是数组')
  if (value.length > CUSTOM_OFFICIAL_SITE_LIMIT) throw new Error(`官网识别映射最多 ${CUSTOM_OFFICIAL_SITE_LIMIT} 条`)
  const normalized = normalizeCustomOfficialSites(value)
  if (normalized.length !== value.length) {
    throw new Error('官网识别映射里存在无效项：需要品牌名，且官网首页是合法的 http(s) 链接')
  }
  return normalized
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
 * 校验内置默认搜索引擎。
 * @param {unknown} value
 * @returns {string | null}
 */
export function normalizeEngineSetting(value) {
  return typeof value === 'string' && ENGINE_OPTIONS.includes(value) ? value : null
}

/**
 * 自定义引擎的网址模板是否合法：http(s)、含搜索词占位符、长度合理。
 * @param {unknown} urlTemplate
 * @returns {boolean}
 */
function isValidCustomEngineUrl(urlTemplate) {
  return (
    typeof urlTemplate === 'string' &&
    urlTemplate.length >= 12 &&
    urlTemplate.length <= 500 &&
    /^https?:\/\//i.test(urlTemplate) &&
    urlTemplate.includes(CUSTOM_ENGINE_TOKEN)
  )
}

/**
 * 宽松归一化自定义搜索引擎列表：丢弃格式不合法的项，自动补 id，限制数量。
 * 用于读取旧设置，不让一条坏数据让整个设置页失败。
 *
 * @param {unknown} value
 * @returns {Array<{ id: string, name: string, urlTemplate: string }>}
 */
export function normalizeCustomEngines(value) {
  if (!Array.isArray(value)) return []
  const out = []
  const ids = new Set()
  for (const raw of value.slice(0, CUSTOM_ENGINE_LIMIT)) {
    if (raw === null || typeof raw !== 'object') continue
    const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, 40) : ''
    const urlTemplate = typeof raw.urlTemplate === 'string' ? raw.urlTemplate.trim() : ''
    if (name === '' || !isValidCustomEngineUrl(urlTemplate)) continue
    let id = typeof raw.id === 'string' ? raw.id.trim().toLowerCase() : ''
    if (!/^[a-z0-9-]{1,40}$/.test(id) || ids.has(id)) id = `e${out.length + 1}-${Math.random().toString(36).slice(2, 8)}`
    ids.add(id)
    out.push({ id, name, urlTemplate })
  }
  return out
}

/**
 * 严格校验（保存时使用）：任意一项不合法直接抛出可读错误。
 * @param {unknown} value
 * @returns {Array<{ id: string, name: string, urlTemplate: string }>}
 */
export function validateCustomEngines(value) {
  if (!Array.isArray(value)) throw new Error('customEngines 必须是数组')
  if (value.length > CUSTOM_ENGINE_LIMIT) throw new Error(`自定义搜索引擎最多 ${CUSTOM_ENGINE_LIMIT} 个`)
  const out = []
  const ids = new Set()
  for (const raw of value) {
    if (raw === null || typeof raw !== 'object') throw new Error('自定义搜索引擎必须是对象')
    const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, 40) : ''
    const urlTemplate = typeof raw.urlTemplate === 'string' ? raw.urlTemplate.trim() : ''
    if (name === '') throw new Error('自定义搜索引擎必须有名称')
    if (!isValidCustomEngineUrl(urlTemplate)) {
      throw new Error(`自定义搜索引擎「${name}」的网址模板无效：需要 http(s) 开头，且用 ${CUSTOM_ENGINE_TOKEN} 代替搜索词`)
    }
    let id = typeof raw.id === 'string' ? raw.id.trim().toLowerCase() : ''
    if (!/^[a-z0-9-]{1,40}$/.test(id) || ids.has(id)) id = `e${out.length + 1}-${Math.random().toString(36).slice(2, 8)}`
    ids.add(id)
    out.push({ id, name, urlTemplate })
  }
  return out
}

/**
 * 读取时把任意存储值收敛成合法设置对象。
 * @param {unknown} stored
 * @returns {{
 *   language: string,
 *   encyclopediaDetail: string,
 *   browseWeights: { relevance: number, timeliness: number, heat: number },
 *   preserveState: boolean,
 *   betterSidebar: boolean,
 *   openLinksInSidebar: boolean,
 *   defaultEngine: string,
 *   customEngines: Array<{ id: string, name: string, urlTemplate: string }>,
 * }}
 */
function normalizeStored(stored) {
  const record = stored !== null && typeof stored === 'object' ? stored : {}
  const customEngines = normalizeCustomEngines(record.customEngines)
  const requestedEngine = typeof record.defaultEngine === 'string' ? record.defaultEngine : ''
  const customEngineId = requestedEngine.startsWith('custom:') ? requestedEngine.slice('custom:'.length) : ''
  const engineAllowed =
    normalizeEngineSetting(requestedEngine) !== null ||
    (customEngineId !== '' && customEngines.some((engine) => engine.id === customEngineId))
  return {
    language: normalizeLanguageSetting(record.language) ?? SETTINGS_DEFAULTS.language,
    encyclopediaDetail: normalizeEncyclopediaDetail(record.encyclopediaDetail) ?? SETTINGS_DEFAULTS.encyclopediaDetail,
    browseWeights: normalizeBrowseWeights(record.browseWeights),
    preserveState: typeof record.preserveState === 'boolean' ? record.preserveState : SETTINGS_DEFAULTS.preserveState,
    betterSidebar: typeof record.betterSidebar === 'boolean' ? record.betterSidebar : SETTINGS_DEFAULTS.betterSidebar,
    openLinksInSidebar:
      typeof record.openLinksInSidebar === 'boolean' ? record.openLinksInSidebar : SETTINGS_DEFAULTS.openLinksInSidebar,
    defaultEngine: engineAllowed ? requestedEngine : SETTINGS_DEFAULTS.defaultEngine,
    customEngines,
    customOfficialSites: normalizeCustomOfficialSites(record.customOfficialSites),
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
   * @returns {ReturnType<typeof normalizeStored>}
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
   * @param {object} input
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
    if (Object.prototype.hasOwnProperty.call(input, 'betterSidebar')) {
      if (typeof input.betterSidebar !== 'boolean') throw new Error('betterSidebar 必须是布尔值')
      next.betterSidebar = input.betterSidebar
    }
    if (Object.prototype.hasOwnProperty.call(input, 'openLinksInSidebar')) {
      if (typeof input.openLinksInSidebar !== 'boolean') throw new Error('openLinksInSidebar 必须是布尔值')
      next.openLinksInSidebar = input.openLinksInSidebar
    }
    if (Object.prototype.hasOwnProperty.call(input, 'customEngines')) {
      next.customEngines = validateCustomEngines(input.customEngines)
      // 默认引擎指向被删掉的自定义引擎时，自动回落到 AI 搜索。
      if (
        next.defaultEngine.startsWith('custom:') &&
        !next.customEngines.some((engine) => `custom:${engine.id}` === next.defaultEngine)
      ) {
        next.defaultEngine = SETTINGS_DEFAULTS.defaultEngine
      }
    }
    if (Object.prototype.hasOwnProperty.call(input, 'defaultEngine')) {
      const builtin = normalizeEngineSetting(input.defaultEngine)
      const customId =
        typeof input.defaultEngine === 'string' && input.defaultEngine.startsWith('custom:')
          ? input.defaultEngine.slice('custom:'.length)
          : ''
      const customAllowed = customId !== '' && next.customEngines.some((engine) => engine.id === customId)
      if (builtin === null && !customAllowed) {
        throw new Error(`defaultEngine 必须是内置引擎（${ENGINE_OPTIONS.join(' / ')}）或任一自定义引擎`)
      }
      next.defaultEngine = builtin ?? input.defaultEngine
    }
    if (Object.prototype.hasOwnProperty.call(input, 'customOfficialSites')) {
      next.customOfficialSites = validateCustomOfficialSites(input.customOfficialSites)
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
        defaultEngine: [...ENGINE_OPTIONS],
        customEngineToken: CUSTOM_ENGINE_TOKEN,
        customEngineLimit: CUSTOM_ENGINE_LIMIT,
        customOfficialSiteLimit: CUSTOM_OFFICIAL_SITE_LIMIT,
      },
      weightKeys: [...BROWSE_WEIGHT_KEYS],
      weightMax: 100,
      defaults: JSON.parse(JSON.stringify(SETTINGS_DEFAULTS)),
    }
  }

  return { get, save, describe, filePath }
}
