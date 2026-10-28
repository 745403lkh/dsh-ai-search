/**
 * dsh-ai-search 的 Host 入口。
 *
 * 提供四样东西，都建立在同一条流水线（lib/search.js）与同一份本机数据上：
 * - 同源 HTTP 接口 `/.dsh-ai-search/*`：供 Web UI 的「AI 搜索」面板与设置页调用；
 * - `curated_search` 工具：供会话里的 Agent 主动使用；
 * - 设置持久化：结果语言（跟随 Harness / 中文 / English），页面与工具共用；
 * - 搜索历史：最近 20 条成功搜索，页面与工具共用。
 *
 * 依赖通过 ctx.inject 延迟等待：webServer 与 tools 在组合里稍后才就绪，
 * 直接读 ctx.get() 可能拿到 undefined。
 */

import { createHistoryStore } from './lib/history.js'
import { createSearchRouteHandler, ROUTE_PREFIX } from './lib/routes.js'
import { createSearchService } from './lib/search.js'
import { createSettingsStore } from './lib/settings.js'
import { registerCuratedSearchTool } from './lib/tool.js'

/** Loader 行 id、包名、Client 模块 id 三者保持一致。 */
export const name = 'dsh-ai-search'

/**
 * 挂载插件。
 * @param {object} ctx Host Cordis 上下文。
 */
export function apply(ctx) {
  const settings = createSettingsStore(ctx)
  const history = createHistoryStore(ctx)
  const service = createSearchService(ctx, { settings, history })

  ctx.inject(['webServer'], (host) => {
    host.effect(() => {
      try {
        return host.webServer.register({
          kind: 'prefix',
          path: ROUTE_PREFIX,
          handler: createSearchRouteHandler(service, settings, history),
        })
      } catch (error) {
        console.error(`[${name}] HTTP 路由注册失败：`, error)
        return () => {}
      }
    }, `${name}: http routes`)
  })

  ctx.inject(['tools'], (host) => {
    host.effect(() => {
      try {
        return registerCuratedSearchTool(host.tools, service)
      } catch (error) {
        console.error(`[${name}] curated_search 工具注册失败：`, error)
        return () => {}
      }
    }, `${name}: curated_search tool`)
  })
}
