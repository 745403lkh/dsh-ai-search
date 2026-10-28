/**
 * 插件数据文件路径解析：统一放在 DSH home 下的 `ai-search/` 目录，
 * 与其它插件把状态放在 `~/.dsh/<plugin>/` 的做法一致。
 */

import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * 解析 DSH home：优先 homePaths 服务，其次 $DSH_HOME，最后 ~/.dsh。
 * @param {object} ctx Host 上下文。
 * @returns {string}
 */
export function resolveDshHome(ctx) {
  try {
    const homePaths = ctx.get('homePaths')
    if (homePaths !== undefined && homePaths !== null && typeof homePaths.home === 'string' && homePaths.home !== '') {
      return homePaths.home
    }
  } catch {
    /* 服务不可用就走环境变量 */
  }
  return process.env.DSH_HOME ?? join(homedir(), '.dsh')
}

/**
 * 解析插件数据文件路径。
 * @param {object} ctx Host 上下文。
 * @param {string} fileName 文件名，例如 settings.json。
 * @returns {string}
 */
export function resolveDataFile(ctx, fileName) {
  return join(resolveDshHome(ctx), 'ai-search', fileName)
}
