# 更新日志 / Changelog

## [1.4.4] - 2026-10-30

正式版，汇总 1.4.4-beta.1 ~ beta.6 的全部改动。

### 中文

**官网识别**
- 只认**官网首页**：`ir.baidu.com` 股价页、搜索结果页、文章页不算官网
- 内置品牌从 50+ 扩充到 **258 个**（必应 / Steam / 米哈游 / 原神 / ChatGPT / 通义 等）
- 检索结果没有官网首页时，第 1 页补一条首页；「综合」置顶「官方」分组

**设置**
- 设置侧栏「AI 搜索」换成**放大镜图标**（导航行标记 + CSS mask，跟随主题色）
- 官网识别映射：**不限条数**，支持 **Excel（.xlsx）/ CSV 导入**
- 新增「**自定义 API 和模型**」：
  - 自定义搜索 API：Tavily / 博查 / SearXNG / Serper
  - 自定义思考模型：OpenAI 兼容接口 + 思考强度（跟随模型 / 低 / 中 / 高）
  - 默认都用 Harness 自带服务，打开开关才生效

**浏览模式**
- 图片板块像视频一样用 `site:` 定向多个图片站（Pexels / Pixabay / Unsplash / 花瓣 / 堆糖等）
- 图片板块只放抓到缩略图的条目；没图的降级为文字条目，不出现空图占位
- 卡片缩略图「有才显示」：直链图片直接用、YouTube / Vimeo / B 站按平台推导封面，
  B 站接口失败会重试，首屏缺图的视频在页面渲染后逐条懒补
- 视频封面尝试上限 12 条，缩略图预算提高到 12s，减少限流导致的「同站部分有图」

**测试**
- 7 个自测套件全部通过（libs / custom-api / stores / modes / search-service / client-render / routes）

### English

Stable release consolidating 1.4.4-beta.1 ~ beta.6.

**Official sites**
- Only the **official homepage** counts (`ir.baidu.com` stock pages, search result pages and article
  pages are no longer treated as the official site)
- Built-in brand map expanded from 50+ to **258 entries** (Bing / Steam / miHoYo / Genshin Impact /
  ChatGPT / Tongyi and more)
- Page 1 gets a synthetic homepage entry when missing; the All board pins an "Official" group

**Settings**
- The "AI Search" settings nav row now shows a **magnifier icon** (row marker + CSS mask, theme-aware)
- Official-site mapping editor: **no entry limit**, **Excel (.xlsx) / CSV import**
- New **"Custom API & models"**:
  - Custom search API: Tavily / Bocha / SearXNG / Serper
  - Custom thinking model: OpenAI-compatible endpoint + thinking effort (model default / low / medium / high)
  - Harness services are used by default; each switch opts in

**Browse**
- Image board now targets multiple image sites with `site:` (Pexels / Pixabay / Unsplash / Huaban /
  Duitang and more)
- Only items with thumbnails stay in the image board; imageless ones degrade to text entries
- Thumbnails only render when available: direct image URLs, derived covers for YouTube / Vimeo /
  Bilibili (with retry), and lazy per-item cover enrichment after render for missing video covers
- Video cover cap raised to 12, thumbnail budget to 12s to reduce rate-limit gaps

**Testing**
- All 7 test suites pass (libs / custom-api / stores / modes / search-service / client-render / routes)

## [1.4.4-beta.6] - 2026-10-30

### 中文

**新增**
- 设置侧栏里的「AI 搜索」现在有自己的**放大镜图标**（`settings.section` 契约不带 icon，
  用导航行标记 + CSS mask 适配，颜色自动跟随主题）
- 设置新增「**自定义 API 和模型**」：
  - **自定义搜索 API**：可切换 Tavily / 博查（Bocha）/ SearXNG / Serper，填接口地址与 API Key，
    替换默认联网搜索（正文抓取仍用 Harness）
  - **自定义思考模型**：OpenAI 兼容接口（Base URL + API Key + 模型名），用于摘要 / 评分 / 百科生成，
    支持**思考强度**（跟随模型 / 低 / 中 / 高）
  - 两者默认都使用 **Harness 自带服务**，只有打开对应开关才生效；保存前会校验必填项

**测试**
- 7 个自测套件全部通过；新增自定义 API 归一化/校验、四种搜索平台请求映射、
  思考模型 stream 适配、服务层接入（自定义搜索 + 自定义模型）等断言

### English

**Added**
- The "AI Search" settings nav row now shows its own **magnifier icon** (the `settings.section`
  contract has no icon field, so it marks its row and swaps the glyph with a CSS mask; colors follow
  the theme)
- New **"Custom API & models"** settings:
  - **Custom search API**: switch to Tavily / Bocha / SearXNG / Serper with a custom endpoint and key,
    replacing the default web search (page fetching still uses Harness)
  - **Custom thinking model**: any OpenAI-compatible endpoint (base URL + key + model) used for
    summaries / scoring / encyclopedia, with **thinking effort** (model default / low / medium / high)
  - Both stay on Harness services by default and only apply when their switch is on; required fields
    are validated before saving

**Testing**
- All 7 test suites pass; added assertions for custom-API normalization/validation, request mapping
  for all four search platforms, thinking-model stream adaptation, and service-level integration

## [1.4.4-beta.5] - 2026-10-30

### 中文

**修复**
- 视频封面统一按站点获取，解决「同站视频有的有图、有的没图」：
  - B 站走公开 view 接口取 `data.pic` 封面（不再只靠抓页面 HTML），接口失败自动重试
  - Vimeo 直接用 vumbnail 生成封面
  - YouTube 继续用 i.ytimg.com 推导
- 视频封面抓取上限从 6 条提高到 12 条（与视频栏上限一致），缩略图总预算 5s → 12s，
  并发限制 5 路，减少被搜索服务限流导致的「部分有图」
- 首屏批量抓取后仍缺图的视频，浏览页渲染完会**逐条懒补封面**（Host 接口 + 重试；
  B 站再兜底用浏览器直连公开接口），补齐后自动更新卡片

**测试**
- 6 个自测套件全部通过；新增 B 站接口封面、Vimeo 推导、8 条同站视频全部有封面、
  `/cover` 补抓接口等断言

### English

**Fixed**
- Video covers are now resolved per platform, fixing "some videos on the same site have covers
  while others don't":
  - Bilibili covers come from the public view API (`data.pic`) instead of only scraping HTML,
    with automatic retry
  - Vimeo covers are derived via vumbnail
  - YouTube keeps using i.ytimg.com
- Video cover target cap raised from 6 to 12 (same as the video board limit), thumbnail budget from
  5s to 12s and concurrency limited to 5, so rate limiting no longer leaves half the videos empty
- Videos still missing a cover after the first batch are lazily enriched after the page renders
  (host `/cover` endpoint with retries; Bilibili additionally falls back to the browser calling the
  public API directly), updating cards as covers arrive

**Testing**
- All 6 test suites pass; added assertions for Bilibili API covers, Vimeo derivation, 8 videos on one
  page all getting covers, and the `/cover` enrichment endpoint

## [1.4.4-beta.4] - 2026-10-30

### 中文

**新增**
- 官网识别映射**取消数量上限**，并支持从 **Excel（.xlsx）/ CSV** 导入：表格列为
  品牌名 | 别名（逗号分隔）| 官网首页，导入时自动去重、合并进现有映射
- 浏览模式**图片板块多源检索**：像视频一样用 `site:` 定向图片站（Unsplash / Pexels / Pixabay /
  花瓣 / 堆糖 等按页轮换），图片类型只认图片站，减少普通网页混入

**改进**
- **缩略图有才显示**：拿不到图的卡片不再显示空图片框，改为纯文字卡片；
  图片 URL 直链直接当缩略图（省一次抓取），YouTube 仍自动推导封面，其余抓 `og:image`
- **图片板块只放有图的条目**：没抓到缩略图的图片条目降级为普通条目（文字展示），不再出现空图占位

**测试**
- 6 个自测套件全部通过；新增「无图条目降级」「直链图片不抓取」「图片栏只含有图条目」
  「CSV/XLSX 导入解析」「映射不限量」等断言

### English

**Added**
- The official-site mapping editor now has **no entry limit** and supports **Excel (.xlsx) / CSV
  import**: columns are brand | aliases (comma separated) | homepage; duplicates are merged into the
  existing mapping
- Browse **image board now searches multiple image sites** with `site:` targeting (Unsplash / Pexels /
  Pixabay / Huaban / Duitang, rotated per page) and only accepts image sites for the image kind

**Changed**
- **Thumbnails are only rendered when available**: cards without a thumbnail no longer show an empty
  image box and fall back to a text-only card; direct image URLs are used as thumbnails without an
  extra fetch, YouTube covers are derived, others use `og:image`
- **The image board only contains items with images**: image items without a thumbnail are degraded
  to regular (text) items instead of leaving empty placeholders

**Testing**
- All 6 test suites pass; added assertions for imageless-item degradation, direct image URLs not
  being fetched, image board filtering, CSV/XLSX import parsing, and unlimited mapping entries

## [1.4.4-beta.3] - 2026-10-30

### 中文

**新增**
- 内置官网映射从 50+ 扩充到 **200+ 品牌**：新增必应、Steam、Epic、米哈游、原神、崩坏系列、
  任天堂/PlayStation/Xbox、腾讯云/阿里云/华为云、ChatGPT/Claude/Gemini/通义/文心一言/豆包/Kimi、
  汽车/银行/餐饮/零售/媒体/教育等常见品牌
- 设置里新增**「官网识别映射」编辑器**：可自定义品牌名、别名（逗号分隔）与官网首页 URL，
  可添加多个、可删除；自定义映射优先于内置表，保存后立即生效
- 浏览模式的官网识别现在会读取设置里的自定义映射（Host 侧每次检索实时使用）

**测试**
- 6 个自测套件全部通过；新增必应/Steam/米哈游/原神映射、自定义映射优先、设置保存/非法项/清空、
  自定义映射接入浏览模式等断言

### English

**Added**
- Built-in official-site map expanded from 50+ to **200+ brands**: Bing, Steam, Epic, miHoYo,
  Genshin Impact, Honkai series, Nintendo/PlayStation/Xbox, Tencent Cloud/Alibaba Cloud/Huawei Cloud,
  ChatGPT/Claude/Gemini/Tongyi/ERNIE/Doubao/Kimi, plus auto/bank/food/retail/media/education brands
- New **"Official-site mappings" editor** in Settings: add a brand name, comma-separated aliases and
  an official homepage URL; entries can be added or deleted and take priority over the built-in map
  immediately after saving
- Browse-mode official recognition now reads the custom mappings from settings on every search

**Testing**
- All 6 test suites pass; added assertions for Bing/Steam/miHoYo/Genshin mappings, custom-map
  priority, settings validation/clear, and custom mappings being applied in browse mode

## [1.4.4-beta.2] - 2026-10-30

### 中文

**修复**
- 官网识别改为**只认官网首页**：只把品牌官网首页（如 `www.baidu.com`）置顶并标「官方」；
  官网域名下的其它页面（如 `ir.baidu.com` 股价页、`www.baidu.com/s?wd=` 搜索页）不再被当成官网
- 保证第 1 页一定有官网首页：检索结果里没有首页时补一条首页条目；第 2 页起不重复

**测试**
- 6 个自测套件全部通过；新增「股价页不算官网」「搜索页不算官网」「补首页并置顶」等断言

### English

**Fixed**
- Official-site recognition now only accepts the **official homepage** (e.g. `www.baidu.com`):
  other pages on the official domain (the `ir.baidu.com` stock page, `www.baidu.com/s?wd=` search
  pages) are no longer treated as the official site
- Page 1 is guaranteed to contain the official homepage: if search results lack it, a homepage entry
  is added (not repeated on later pages)

**Testing**
- All 6 test suites pass; added assertions for stock/search pages not counting as the homepage and
  for the synthetic homepage being pinned

## [1.4.4-beta.1] - 2026-10-30

### 中文

**新增**
- 浏览模式**官网识别**：内置常见品牌 → 官方域名映射（微信、淘宝、京东、抖音、百度、DeepSeek、
  Google、微软等 50+ 品牌），品牌词搜索时官网结果置顶并标「官方」
- 检索结果里没有官网时，第 1 页自动补一条官网首页（第 2 页起不重复），卡片与工具输出都带官方标识
- 「综合」板块新增「官方」置顶分组；分栏内官网条目同样置顶

**改进**
- `curated_search` 工具输出新增 `browse.items[].official` 字段，渲染为「· 官方」

**测试**
- 6 个自测套件全部通过；新增官网映射、子域名识别、置顶排序、补官网首页、非品牌词不误标等断言

### English

**Added**
- Browse mode **official-site recognition**: a curated brand → official-domain map (WeChat, Taobao,
  JD, Douyin, Baidu, DeepSeek, Google, Microsoft and 50+ more). Brand queries pin the official site
  first and badge it "Official"
- When search results contain no official site, page 1 adds a synthetic official homepage entry
  (not repeated on later pages); cards and tool output both show the official marker
- The All board renders a pinned "Official" group first; official items are also pinned inside boards

**Changed**
- `curated_search` output gains `browse.items[].official`, rendered as "· 官方"/"· Official"

**Testing**
- All 6 test suites pass; added assertions for the brand map, subdomain recognition, pinning order,
  synthetic official homepage, and no false positives on non-brand queries

## [1.4.3-fix1] - 2026-10-30

### 中文

**修复**
- `package.json` 补齐 `repository` / `homepage` / `bugs` / `license`（MIT）/ `keywords` / `author`，
  npm 页面现在能链接回 GitHub 仓库
- 答疑模式的「精读」口径：新增 `fetchAttempted` / `fetchFailed` / `curationBasis` 统计，
  正文未读取或只读到部分时，界面与工具文案改为「精读 x/y 篇」或「未读取正文（摘要基于检索片段）」，
  不再出现「精读 0 篇」却仍有摘要的误导
- `curated_search` 工具补齐 `exclude` 参数并在浏览模式翻页时透传，翻页可以按 URL 去重
  （此前只有客户端会传 exclude）
- 浏览模式：「综合」改为全部候选（最多 36 条）按加权分排序，文章 / 视频 / 图片分栏是它的
  子集（各最多 12 条），修复「分栏里出现综合中没有的条目」

**测试**
- 6 个自测套件全部通过；新增了分栏 ⊆ 综合、工具 exclude 透传、精读口径提示等断言

### English

**Fixed**
- Added `repository` / `homepage` / `bugs` / `license` (MIT) / `keywords` / `author` to
  `package.json`, so the npm page links back to the GitHub repository
- Q&A "pages read" reporting: new `fetchAttempted` / `fetchFailed` / `curationBasis` stats; when page
  text could not be read (or only partly), the UI and tool text now say "x/y pages read" or "no page
  text read (summary from search snippets)" instead of a misleading "0 pages read" with a summary
- `curated_search` now declares and forwards the `exclude` parameter for browse pagination, so pages
  can be deduplicated by URL from the tool as well (previously only the UI passed it)
- Browse: the All board is now the full candidate list (up to 36) sorted by weighted score, and the
  article/video/image boards are subsets of it (up to 12 each), fixing board items missing from All

**Testing**
- All 6 test suites pass; added assertions for board-subset invariants, tool `exclude` forwarding and
  the new pages-read wording

## [1.4.3] - 2026-10-29

### 中文

**新增**
- **更好的侧边栏（dsh-better-sidebar）适配**：在宿主右侧栏注册「AI 搜索」页签（可在设置里关闭）
- 侧边栏里的搜索页左侧带**引擎栏**：AI 搜索（默认）/ 百度 / 必应 / Google / 搜狗 + 自定义引擎
- **像浏览器一样多开**：右侧栏可同时打开多个 AI 搜索页签，每个页签有独立的输入、模式、结果与板块
- 结果 / 来源 / 图片 / 浏览卡片默认在**侧边栏浏览器**里打开，也可改为系统默认浏览器
- 设置里可添加**多个自定义搜索引擎**（名称 + 网址模板，`*#*#*#*` 代替搜索词），可删除、可设为默认
- 统一风格的引擎图标（24×24 单色）：百度 / Google 用官方 logo 路径，必应 / 搜狗同风格手绘，
  自定义引擎用首字母方块

**改进**
- 切换到非 AI 引擎时自动隐藏三模式（答疑 / 百科 / 浏览）切换
- 删除正在使用的自定义引擎后，默认引擎自动回落 AI 搜索
- 没有安装 better-sidebar 的用户完全不受影响（可选注入，检测不到就跳过）

**Beta 过程**
- `1.4.3-beta.1`：侧边栏适配初版（页签、左侧引擎栏、链接打开方式、适配开关）
- `1.4.3-beta.2`：统一引擎图标；自定义搜索引擎；页签多开的第一版（描述符层）
- `1.4.3-beta.3`：改用宿主 `sidebarRightTabs` 的 `multiple: true`，实现真正的浏览器式多开，
  并按页签 id 隔离页面状态

**测试**
- 6 个自测套件全部通过；新增了原生页签注册（multiple / guide / 页签实体槽）、
  多实例渲染、自定义引擎增删与校验、引擎栏图标等断言

### English

**Added**
- **dsh-better-sidebar integration**: registers an "AI Search" tab in the host right sidebar
  (can be turned off in Settings)
- The sidebar search page has a **left engine rail**: AI Search (default) / Baidu / Bing / Google /
  Sogou, plus custom engines
- **Browser-like multi-tab**: several AI Search tabs can be open at once in the right sidebar, each
  with independent input, mode, results and board
- Result/source/image/feed cards open in the **sidebar browser** by default; switchable to the
  system browser
- Add **multiple custom search engines** in Settings (name + URL template with `*#*#*#*` as the query
  placeholder); deletable and usable as the default engine
- Unified 24×24 monochrome engine icons: official logo paths for Baidu/Google, hand-drawn matching
  glyphs for Bing/Sogou, letter tiles for custom engines

**Changed**
- The three mode tabs (Answers / Encyclopedia / Browse) hide automatically for non-AI engines
- Removing the custom engine in use resets the default engine to AI Search
- Users without dsh-better-sidebar are unaffected (optional injection, skipped when absent)

**Beta history**
- `1.4.3-beta.1`: first sidebar integration (tab, engine rail, link opening, adapt toggle)
- `1.4.3-beta.2`: unified engine icons; custom search engines; first multi-tab attempt at the
  descriptor level
- `1.4.3-beta.3`: switched to the host's `sidebarRightTabs` with `multiple: true` for real
  browser-like multi-tab, with per-tab state isolation

**Testing**
- All 6 test suites pass; added assertions for native tab registration (multiple/guide/body slot),
  multi-instance rendering, custom-engine add/remove/validation, and the engine rail icons

## [1.4.2] - 2026-10-28

### 中文
- **安全加固**：移除无来源守卫的 `GET /search` 调试接口；所有接口要求本地客户端请求头
  `x-dsh-ai-search: 1`，并校验回环 Host/Origin（防跨站与 DNS rebinding）；搜索限流 10 次/分钟；
  响应加 `nosniff` / `no-referrer`，不输出 CORS 头
- 破坏性变更：`GET /search` 不再可用；本机 curl 调试需带请求头；升级后刷新页面

### English
- **Security hardening**: removed the unguarded `GET /search` debug endpoint; every endpoint now
  requires the local-client header `x-dsh-ai-search: 1` plus loopback Host/Origin validation
  (cross-site and DNS-rebinding protection); search is rate-limited to 10/min; responses add
  `nosniff` / `no-referrer` and never emit CORS headers
- Breaking: `GET /search` is gone; local curl debugging needs the header; refresh the page after
  upgrading

## [1.4.1] - 2026-10-27

### 中文
- 站点上限按类型区分（视频/图片站 10 条，普通站 5 条），超出只标「已精简」，不再算广告
- 放宽广告判定：去掉佣金/返利/领券/优惠券码/限时特惠等弱信号，移除 newsbreak.com

### English
- Per-site caps by type (video/image sites 10, ordinary sites 5); overflow is labeled "trimmed"
  instead of being counted as ads
- Relaxed ad detection: dropped weak signals (commission/cashback/coupons/flash sales) and removed
  newsbreak.com from the blocklist

## [1.4.0] - 2026-10-27

### 中文
- 新增设置「切换页面时保留结果」；「综合」板块固定按 文章 → 视频 → 图片 排列
- 视频只认大型视频站并以 `site:` 定向检索，卡片标出来源平台

### English
- New "Keep results across panel switches" setting; the All board uses a fixed
  Articles → Videos → Images order
- Videos only come from major platforms and are searched with `site:`; cards show the source platform

## [1.3.0] - 2026-10-27

### 中文
- 三种搜索模式：答疑 / 百科 / 浏览；百科词条（档位可调）、浏览四板块与三指标权重、下一页去重
- `curated_search` 工具支持 `mode` / `page`

### English
- Three modes: Answers / Encyclopedia / Browse; encyclopedia entries with detail tiers, browse
  boards with three weighted metrics and deduplicated pagination
- `curated_search` gains `mode` / `page`

## [1.2.0] - 2026-10-27

### 中文
- 改名「AI 搜索」；开始页精简；独立设置页（结果语言跟随 Harness）；搜索历史

### English
- Renamed to "AI Search"; simplified start page; standalone settings page (result language follows
  Harness); search history

## [1.1.0] - 2026-10-27

### 中文
- 精读预算 6 秒、只读前 2 篇；补充追踪参数清理；摘要去重多语言版本

### English
- 6-second reading budget, top-2 pages only; extra tracking params stripped; deduplicate language
  variants in summaries

## [1.0.0] - 2026-10-27

### 中文
- 首个版本：联网检索 → 广告过滤 → 精读 → AI 汇总排序；`curated_search` 工具；HTTP 接口

### English
- Initial release: retrieval → ad filtering → page reading → AI curation; `curated_search` tool;
  HTTP API