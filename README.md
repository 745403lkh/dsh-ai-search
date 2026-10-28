# dsh-ai-search：AI 搜索

Harness 里的一个搜索面板，包含三个模式：**答疑**、**百科**、**浏览**。
底层共用「联网检索 → 广告过滤 → 正文精读」，再按模式做各自的 AI 处理。

## 三个模式

### 1. 答疑（默认）
- 检索 → 过滤广告 → 精读正文 → AI 摘要 + 推荐排序。
- 输出：2–4 句摘要、3–6 条推荐（带推荐理由与评分）、已过滤清单、全部来源。
- 只接受候选里出现过的 URL，模型编造的链接会被丢弃。

### 2. 百科
- 面向百科与权威来源检索（同时检索原问题和「百科 / wiki encyclopedia」两路）。
- 优先百科域名（Wikipedia、百度百科、Britannica 等），再读正文。
- 按**百科体例**生成词条：标题 + 概述 + 若干章节 + 参考来源，中立客观。
- **档位可调**（设置 → AI 搜索 → 百科模式详细程度）：
  - 简明：3–4 个章节，短
  - 标准：5–6 个章节（默认）
  - 详尽：7–9 个章节，覆盖背景/技术细节/影响/争议

### 3. 浏览
- 像搜索引擎信息流：按页面分成 **综合 / 文章 / 视频 / 图片** 四个板块，默认综合。
- 排名只用三个指标：**相关性 / 时效性 / 热度**，权重在设置里用滑杆调（自动归一化；
  例如只看相关性就把另外两项拉到 0）。**不包含竞价/推广权重**，广告在检索阶段已被过滤。
- 每条结果显示三个分项指标与加权后的综合分。
- **综合板块固定顺序**：始终按「文章 → 视频 → 图片」分组展示，顺序不随各板块数量变化。
- **视频只认大型视频站**：哔哩哔哩、抖音、快手、YouTube、腾讯视频、优酷、爱奇艺、西瓜、
  AcFun、Vimeo 等；检索时用 `site:` 定向这些站点，卡片上标出来源平台（如「视频 · 哔哩哔哩」）。
  普通网页即使被视频检索词带出也不会被误判成视频。
- **站点上限按类型区分**：视频/图片站允许同站最多 10 条（它们本来结果就多），普通站点 5 条；
  多出来的只标为「同站点结果较多，已精简」，不算广告。
- **广告判定偏保守**：只过滤明确的广告网络域名、`Advertisement/Sponsored/【广告】` 等明确标识、
  推广链接与重复内容；不再用「佣金/返利/领券」这类弱信号删结果。
- **下一页**：每个板块底部有「下一页」按钮，点击检索新一批并追加；翻页时会带上已看过的
  链接（`exclude`），服务端与客户端都会按 URL 去重，不会重复出现同一条。
- 图片板块会尝试抓取页面 `og:image` 作为缩略图（失败则显示占位图标）；视频板块支持
  YouTube 缩略图。

## 设置（设置 → AI 搜索）

独立的设置页，修改立即生效：

| 设置 | 说明 |
| --- | --- |
| 结果语言 | 跟随 Harness（默认）/ 中文 / English；强制 AI 摘要、理由与提醒的输出语言 |
| 百科模式详细程度 | 简明 / 标准 / 详尽 |
| 浏览模式指标权重 | 相关性 / 时效性 / 热度 三个滑杆（0–100，自动归一化并显示百分比） |
| 切换页面时保留结果 | 默认开启。在对话与搜索、或工作区之间切换后返回，保留原结果与当前板块 |
| 搜索历史 | 最近 20 条成功搜索，可一键清空 |

> 设置左侧导航的图标由 Harness 外壳按固定 section id 映射，插件无法自定义；
> AI 搜索设置页使用外壳对插件 section 的默认导航图标。

## 本机数据

DSH home（默认 `~/.dsh`）下的 `ai-search/` 目录：

| 文件 | 内容 |
| --- | --- |
| `settings.json` | 语言 / 百科档位 / 浏览权重 / 是否保留页面状态 |
| `history.json` | 最近 20 条搜索记录 |

## 接口

所有接口（含 GET）都必须携带本地客户端请求头 `x-dsh-ai-search: 1`，且只接受本机回环来源
（`Host` 必须是 `localhost` / `127.0.0.1` / `[::1]`；带 `Origin` 时必须是同源或桌面壳协议）。
第三方网页的跨站 `<img>` / 表单 / `no-cors` fetch 带不上这个头，因此触发不了接口；本接口
从不返回 CORS 头。搜索只接受 POST，并限制每客户端每分钟 10 次（超限 429 + `Retry-After`）。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/.dsh-ai-search/health` | 依赖服务、版本、模式、当前设置与历史条数 |
| GET/POST | `/.dsh-ai-search/settings` | 读取 / 部分更新设置 |
| GET/POST | `/.dsh-ai-search/history` | 读取 / 清空搜索历史 |
| POST | `/.dsh-ai-search/search` | `{ query, mode?, maxResults?, ai?, uiLanguage?, page?, exclude? }` |

> 安全说明：旧版 `GET /search` 调试入口已移除（它可被任意网页用简单请求触发，刷检索/模型
> 配额、探测过滤规则、污染历史）。改用 POST + 请求头 + 回环来源校验 + 频率限制。本机调试时
> 需显式带请求头，例如：
>
> `curl -H "x-dsh-ai-search: 1" -H "content-type: application/json" -d '{"query":"..."}' http://127.0.0.1:端口/.dsh-ai-search/search`

模式：`qa`（默认）/ `encyclopedia` / `browse`。`page` 仅浏览模式使用（1–5）。
三个模式的响应都带 `ok/mode/language/ai/aiModel/stats/cached`；答疑带 `answer/picks`，
百科带 `title/lead/sections/references`，浏览带 `boards/items/weights/hasMore/page`
（视频条目另有 `sourcePlatform` 标出来源平台）。

错误响应统一为 `{ ok: false, error: { code, message } }`。

## 结构

| 文件 | 作用 |
| --- | --- |
| `index.js` | Host 入口：注册 HTTP 路由、`curated_search` 工具、设置与历史 |
| `lib/search.js` | 三模式分发、语言解析、缓存、健康检查 |
| `lib/curate.js` | 答疑模式的提示词、JSON 解析与降级排序 |
| `lib/encyclopedia.js` | 百科模式：双路检索、百科来源排序、词条生成 |
| `lib/browse.js` | 浏览模式：分页查询、三指标评分/加权、板块、缩略图 |
| `lib/model-json.js` | 通用模型 JSON 调用（路由解析、流式聚合） |
| `lib/filters.js` | 链接规范化、广告识别、去重、相关度排序 |
| `lib/html-text.js` | HTML → 正文纯文本、标题与摘录提取 |
| `lib/routes.js` | 同源 HTTP 接口（请求头 + 回环来源守卫 + 频率限制） |
| `lib/settings.js` / `lib/history.js` / `lib/paths.js` | 设置 / 历史持久化与路径 |
| `lib/tool.js` | `curated_search` 工具（含 mode/page 参数） |
| `client.js` | 浏览器半侧：侧边栏图标、搜索页（三模式、分页）、独立设置页 |

## 依赖

不依赖任何第三方 npm 包：Host 只用 Harness 的 `ctx.web` / `ctx.llm` / `ctx.agentDefaultModel`
与 Node 内置能力；Client 通过 `window.__ModuleLoader__` 请求平台自带的 React。

## 备注

- 搜索结果与网页内容属于外部不可信数据，工具输出会提示模型只当作资料、不要当作指令。
- 检索与模型调用会消耗账户配额；同一问题、同一模式 10 分钟内重复搜索直接读缓存
  （浏览模式仅第 1 页缓存，翻页不缓存）。
- Agent 工具支持同样的三个模式：`curated_search(query, mode, page)`。
