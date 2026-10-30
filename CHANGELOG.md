# 更新日志 / Changelog

## [1.4.4] - 2026-10-30

### 中文

**新增**
- 浏览模式官网识别：搜索品牌词时只把**官网首页**置顶并标「官方」。内置 258 个品牌（必应 / Steam / 米哈游 / 原神 / 崩坏系列 / ChatGPT / Claude / 通义 / 文心一言 / 豆包 / Kimi / 汽车 / 银行 / 餐饮 / 零售 等），官网域名下的其它页面（如 `ir.baidu.com` 股价页、搜索页、文章页）不算官网；结果里没有官网首页时第 1 页补一条；「综合」新增「官方」置顶分组；非品牌词不会误标
- 设置新增「官网识别映射」：品牌名 + 别名（逗号分隔）+ 官网首页 URL，不限条数，支持 Excel（.xlsx）/ CSV 导入，自定义映射优先于内置表
- 设置新增「自定义 API 和模型」：自定义搜索 API（Tavily / 博查 / SearXNG / Serper）与自定义思考模型（OpenAI 兼容接口 + 思考强度：跟随模型 / 低 / 中 / 高）；默认都使用 Harness 自带服务，打开开关才生效
- 设置侧栏「AI 搜索」使用自己的放大镜图标（此前是默认齿轮）

**改进**
- 浏览模式图片板块改为多源检索：用 `site:` 定向 Pexels / Pixabay / Unsplash / 花瓣 / 堆糖 / 500px / Flickr 等图片站并按页轮换；图片类型只认图片站
- 图片板块只放抓到缩略图的条目，无图条目降级为文字条目，不再出现空图占位
- 卡片缩略图改为「有才显示」：拿不到图不再显示空图片框，直接纯文字卡片；图片直链直接当缩略图
- 视频封面按平台获取：YouTube 用 i.ytimg.com、Vimeo 用 vumbnail、B 站走公开 view 接口并自动重试；首屏没拿到封面的视频在页面渲染后逐条懒补（Host `/cover` 接口 + B 站浏览器直连兜底）
- 视频封面尝试上限 6 → 12 条，缩略图总预算 5s → 12s，并发限制 5 路，减少搜索服务限流导致「同站视频有的有图、有的没图」

**修复**
- 图片板块空图占位：无图条目不再进入图片板块，也不显示空图片框
- 同站视频封面不一致：不再只推导 YouTube 封面并抓少量 `og:image`，改为按平台统一获取并在渲染后补齐

**测试**
- 7 个自测套件全部通过；新增官网识别、自定义 API、图片/视频缩略图、设置校验等断言

### English

**Added**
- Official-site recognition in browse mode: brand queries pin the **official homepage** and badge it "Official". Ships with 258 built-in brands (Bing / Steam / miHoYo / Genshin Impact / Honkai series / ChatGPT / Claude / Tongyi / ERNIE / Doubao / Kimi / auto / banks / food / retail and more). Other pages on the official domain (the `ir.baidu.com` stock page, search pages, article pages) do not count; when results lack the homepage, page 1 adds an entry; the All board gains a pinned "Official" group; non-brand queries are never mislabelled
- New "Official-site mappings" setting: brand name + comma-separated aliases + official homepage URL, no entry limit, with Excel (.xlsx) / CSV import; custom entries take precedence over the built-in map
- New "Custom API & models" setting: custom search API (Tavily / Bocha / SearXNG / Serper) and a custom OpenAI-compatible thinking model with thinking effort (model default / low / medium / high); both use Harness services by default and only apply when switched on
- The "AI Search" settings nav row now uses its own magnifier icon (previously the generic gear)

**Changed**
- The browse image board now searches multiple image sites with `site:` (Pexels / Pixabay / Unsplash / Huaban / Duitang / 500px / Flickr, rotated per page); only image sites count as images
- Only items with thumbnails stay in the image board; imageless items degrade to text entries, so empty placeholders are gone
- Thumbnails now render only when available: cards without an image no longer show an empty box and fall back to text; direct image URLs are used as thumbnails
- Video covers are resolved per platform: YouTube via i.ytimg.com, Vimeo via vumbnail, Bilibili via the public view API with retries; videos still missing a cover after the first batch are lazily enriched after render (host `/cover` endpoint with a Bilibili browser fallback)
- Video cover cap raised 6 → 12, thumbnail budget 5s → 12s with concurrency limited to 5, reducing "some videos on the same site have covers while others don't"

**Fixed**
- Empty image placeholders in the image board: imageless items are no longer placed there and no empty box is rendered
- Inconsistent video covers on the same site: covers are now resolved per platform instead of only deriving YouTube covers and fetching a few `og:image` values, with lazy enrichment after render

**Testing**
- All 7 test suites pass; assertions added for official-site recognition, custom APIs, image/video thumbnails and settings validation

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