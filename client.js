/**
 * dsh-ai-search 的浏览器半侧。
 *
 * 座位：
 * - `sidebar.panellist`：左侧栏「AI 搜索」面板图标（id 与 main 的 key 相同）；
 * - `main`（keyed by id）：AI 搜索页面（三个模式：答疑 / 百科 / 浏览）；
 * - `settings.section`：设置里的独立「AI 搜索」页（结果语言 / 百科档位 / 浏览权重 / 搜索历史）。
 *
 * 说明：设置左侧导航的图标由外壳按固定 section id 映射，插件无法自定义；
 * 独立设置页沿用外壳对未知 section 的默认导航图标。
 *
 * 这个文件是外部 classic script，由 shell 以 `window.__ModuleLoader__.load` 加载，
 * 因此整体包在 IIFE 里：重新求值同一份文件时不会重复声明顶层词法变量。
 */

(function () {
  window.__ModuleLoader__.load({
    id: 'dsh-ai-search',
    factory: function (require) {
      var React = require('react')
      var h = React.createElement
      var NS = 'dsh-ai-search'
      var ROUTE = '/.dsh-ai-search'

      var MODES = ['qa', 'encyclopedia', 'browse']
      var BOARDS = ['all', 'article', 'video', 'image']
      var KIND_LABELS = { article: 'kindArticle', video: 'kindVideo', image: 'kindImage', all: 'kindAll' }

      /** 页面状态是否跨挂载保留（来自设置 preserveState，默认开）。 */
      var PRESERVE_STATE = true
      /** 每个搜索页实例（左侧主面板 / 更好的侧边栏里的各个页签）最近一次快照。 */
      var LAST_SEARCH_STATES = {}

      // ------------------------------------------------------------------
      // 更好的侧边栏（dsh-better-sidebar）适配
      // ------------------------------------------------------------------
      /** 自定义引擎网址模板里的搜索词占位符。 */
      var ENGINE_TOKEN = '*#*#*#*'

      /** 侧边栏内置搜索引擎：ai 走插件自己的三模式，其余直接跳转对应搜索引擎。 */
      var ENGINES = [
        { id: 'ai', label: 'engineAi' },
        { id: 'baidu', label: 'engineBaidu', url: 'https://www.baidu.com/s?wd=' },
        { id: 'bing', label: 'engineBing', url: 'https://www.bing.com/search?q=' },
        { id: 'google', label: 'engineGoogle', url: 'https://www.google.com/search?q=' },
        { id: 'sogou', label: 'engineSogou', url: 'https://www.sogou.com/web?query=' },
      ]

      /**
       * 内置引擎图标（统一 24×24 单色 filled path）：
       * Baidu / Google 取自 Simple Icons（CC0）的官方 logo 路径，Bing / Sogou 为同风格手绘近似。
       */
      var ENGINE_ICON_PATHS = {
        baidu:
          'M9.154 0C7.71 0 6.54 1.658 6.54 3.707c0 2.051 1.171 3.71 2.615 3.71 1.446 0 2.614-1.659 2.614-3.71C11.768 1.658 10.6 0 9.154 0zm7.025.594C14.86.58 13.347 2.589 13.2 3.927c-.187 1.745.25 3.487 2.179 3.735 1.933.25 3.175-1.806 3.422-3.364.252-1.555-.995-3.364-2.362-3.674a1.218 1.218 0 0 0-.261-.03zM3.582 5.535a2.811 2.811 0 0 0-.156.008c-2.118.19-2.428 3.24-2.428 3.24-.287 1.41.686 4.425 3.297 3.864 2.617-.561 2.262-3.68 2.183-4.362-.125-1.018-1.292-2.773-2.896-2.75zm16.534 1.753c-2.308 0-2.617 2.119-2.617 3.616 0 1.43.121 3.425 2.988 3.362 2.867-.063 2.553-3.238 2.553-3.988 0-.745-.62-2.99-2.924-2.99zm-8.264 2.478c-1.424.014-2.708.925-3.323 1.947-1.118 1.868-2.863 3.05-3.112 3.363-.25.309-3.61 2.116-2.864 5.42.746 3.301 3.365 3.237 3.365 3.237s1.93.19 4.171-.31c2.24-.495 4.17.123 4.17.123s5.233 1.748 6.665-1.616c1.43-3.364-.808-5.109-.808-5.109s-2.99-2.306-4.736-4.798c-1.072-1.665-2.348-2.268-3.528-2.257zm-2.234 3.84 1.542.024v8.197H7.758c-1.47-.291-2.055-1.292-2.13-1.462-.072-.173-.488-.976-.268-2.343.635-2.049 2.447-2.196 2.447-2.196h1.81zm3.964 2.39v3.881c.096.413.612.488.612.488h1.614v-4.343h1.689v5.782h-3.915c-1.517-.39-1.59-1.465-1.59-1.465v-4.317zm-5.458 1.147c-.66.197-.978.708-1.05.928-.076.22-.247.78-.1 1.269.294 1.095 1.248 1.144 1.248 1.144h1.37v-3.34z',
        google:
          'M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z',
        bing: 'M5.2 2.6h3.9v18.8H5.2zm9.4 6.1a6.2 6.2 0 1 0 0 12.4 6.2 6.2 0 0 0 0-12.4zm0 3.4a2.8 2.8 0 1 1 0 5.6 2.8 2.8 0 0 1 0-5.6z',
        sogou:
          'M12.2 3.1c-4.7 0-7.7 2.5-7.7 6 0 3.2 2.5 5.1 6.4 6 3.1.7 4.2 1.6 4.2 2.9 0 1.5-1.6 2.5-3.9 2.5-2.6 0-5-1.2-6.6-3.2l-2.4 2.6c2 2.6 5.4 4 8.9 4 4.5 0 7.5-2.5 7.5-6.1 0-3.2-2.3-5-6.1-5.9-2.9-.7-4-1.6-4-2.8 0-1.3 1.3-2.2 3.4-2.2 2.1 0 4.1 1 5.4 2.5l2.3-2.5c-1.9-2.2-4.2-2.9-6.9-2.9z',
      }
      /** 手绘路径需要 evenodd 才能挖出镂空（Bing 的字母 b 内环）。 */
      var ENGINE_ICON_FILL_RULES = { bing: 'evenodd' }

      /** 用户自定义搜索引擎（与设置同步；侧栏引擎栏订阅其变化）。 */
      var CUSTOM_ENGINES = []
      var CUSTOM_ENGINE_LISTENERS = []

      /** 更新自定义引擎列表并通知订阅者（设置页保存后立即反映到引擎栏）。 */
      function setCustomEngines(list) {
        CUSTOM_ENGINES = Array.isArray(list) ? list.slice() : []
        for (var index = 0; index < CUSTOM_ENGINE_LISTENERS.length; index += 1) {
          try {
            CUSTOM_ENGINE_LISTENERS[index]()
          } catch (notifyError) {
            /* 订阅方异常不影响保存 */
          }
        }
      }

      /** 订阅自定义引擎列表变化；返回取消订阅函数。 */
      function subscribeCustomEngines(fn) {
        CUSTOM_ENGINE_LISTENERS.push(fn)
        return function () {
          var at = CUSTOM_ENGINE_LISTENERS.indexOf(fn)
          if (at !== -1) CUSTOM_ENGINE_LISTENERS.splice(at, 1)
        }
      }

      /** 是否启用更好的侧边栏适配（来自设置 betterSidebar）。 */
      var ADAPT = true
      /** 结果链接是否默认在侧边栏浏览器打开（来自设置 openLinksInSidebar）。 */
      var OPEN_IN_SIDEBAR = true
      /** 默认搜索引擎（来自设置 defaultEngine）。 */
      var DEFAULT_ENGINE = 'ai'
      /** 是否检测到 dsh-better-sidebar（仅用于设置页提示）。 */
      var HAS_BETTER_SIDEBAR = false
      /** 由宿主 sidebarRight 服务提供的打开函数（在侧边栏浏览器里打开 URL）。 */
      var openInSidebarBrowser = null
      /** 原生右侧栏页签的注册/注销开关（设置变化时重新同步；由 apply 注入）。 */
      var NATIVE_SYNC = null

      /** 按 id 取搜索引擎定义（内置或自定义）。 */
      function engineOf(id) {
        for (var index = 0; index < ENGINES.length; index += 1) {
          if (ENGINES[index].id === id) return ENGINES[index]
        }
        if (typeof id === 'string' && id.indexOf('custom:') === 0) {
          var customId = id.slice('custom:'.length)
          for (var at = 0; at < CUSTOM_ENGINES.length; at += 1) {
            var custom = CUSTOM_ENGINES[at]
            if (custom.id === customId) {
              return { id: 'custom:' + custom.id, label: custom.name, custom: true, url: custom.urlTemplate }
            }
          }
        }
        return ENGINES[0]
      }

      /** 把搜索词套进引擎的网址（内置引擎直接拼接，自定义引擎替换占位符）。 */
      function engineSearchUrl(engine, query) {
        if (engine === null || engine === undefined || typeof engine.url !== 'string') return ''
        var encoded = encodeURIComponent(query)
        if (engine.custom === true) return engine.url.split(ENGINE_TOKEN).join(encoded)
        return engine.url + encoded
      }

      /** 用系统默认浏览器打开（兜底）。 */
      function openExternal(url) {
        try {
          window.open(url, '_blank', 'noopener,noreferrer')
        } catch (openError) {
          /* 被拦截时静默失败 */
        }
      }

      /** 按设置打开 URL：优先侧边栏浏览器，否则系统浏览器。 */
      function openUrl(url) {
        if (typeof url !== 'string' || url === '') return
        if (ADAPT === true && OPEN_IN_SIDEBAR === true && typeof openInSidebarBrowser === 'function') {
          try {
            openInSidebarBrowser(url)
            return
          } catch (openError) {
            /* 侧边栏浏览器不可用时退回外部浏览器 */
          }
        }
        openExternal(url)
      }

      /** 结果链接的公共属性：适配开启时接管点击，改在侧边栏浏览器打开。 */
      function linkProps(className, url, title) {
        var props = { className: className, href: url, target: '_blank', rel: 'noreferrer noopener', title: title }
        if (ADAPT === true && OPEN_IN_SIDEBAR === true) {
          props.onClick = function (event) {
            if (event && typeof event.preventDefault === 'function') event.preventDefault()
            openUrl(url)
          }
        }
        return props
      }

      // ------------------------------------------------------------------
      // 文案字典（跟随宿主 locale；注册到 ctx.locale）
      // ------------------------------------------------------------------
      var zh = {
        nav: 'AI 搜索',
        title: 'AI 搜索',
        placeholder: '搜索点什么…',
        search: '搜索',
        cancel: '取消',
        modeQa: '答疑',
        modeEncyclopedia: '百科',
        modeBrowse: '浏览',
        modeQaHint: '摘要 + 推荐排序',
        modeEncyclopediaHint: '百科体例词条',
        modeBrowseHint: '信息流 · 三指标排序',
        stageSearch: '联网检索',
        stageFilter: '过滤广告',
        stageRead: '精读正文',
        stageCurate: 'AI 整理',
        stageEncSearch: '联网检索',
        stageEncFilter: '筛选百科来源',
        stageEncRead: '精读资料',
        stageEncWrite: '撰写词条',
        stageBrSearch: '多路检索',
        stageBrFilter: '过滤广告',
        stageBrScore: 'AI 评估三指标',
        stageBrRank: '加权排序',
        searchingHint: '正在检索并整理，通常需要 10–30 秒…',
        aiSummary: 'AI 摘要',
        heuristicSummary: '启发式摘要',
        copy: '复制摘要',
        copyArticle: '复制词条',
        copied: '已复制',
        picksTitle: '推荐结果',
        picksCount: '{n} 条',
        removedTitle: '已过滤 {n} 条（广告 / 推广 / 重复 / 精简）',
        sourcesTitle: '全部来源（{n}）',
        trusted: '权威来源',
        score: '评分 {n}',
        metaSources: '{n} 个来源',
        metaFetched: '精读 {n} 篇',
        metaFetchedPartial: '精读 {read}/{attempted} 篇',
        metaFetchedNone: '未读取正文（摘要基于检索片段）',
        metaRemoved: '过滤 {n} 条',
        metaElapsed: '用时 {s}s',
        metaModel: '{model}',
        errorTitle: '搜索失败',
        retry: '重试',
        errorHint: '可以换个说法，或稍后重试。',
        emptyQuery: '请输入要搜索的问题',
        aiOff: 'AI 排序未启用',
        alertTitle: '提醒',
        noPicks: '这次没有找到足够的推荐结果，可以换个更具体的问法。',
        newSearch: '新搜索',
        historyTitle: '最近搜索',
        historyClear: '清空',
        detailBrief: '简明',
        detailStandard: '标准',
        detailDetailed: '详尽',
        detailLabel: '档位：{name}',
        articleTitle: '词条',
        referencesTitle: '参考来源（{n}）',
        articleAlert: 'AI 词条生成不可用，以下为资料摘要。',
        weightsTitle: '排序权重',
        weightPercent: '{name} {n}%',
        weightRelevance: '相关性',
        weightTimeliness: '时效性',
        weightHeat: '热度',
        aiScored: 'AI 已参与评分',
        heuristicScored: '启发式评分',
        kindAll: '综合',
        kindArticle: '文章',
        kindVideo: '视频',
        kindImage: '图片',
        metricLine: '相关 {r} · 时效 {t} · 热度 {h}',
        totalScore: '综合 {n}',
        nextPage: '下一页',
        loadingNext: '加载中…',
        noMore: '没有更多了',
        pageCount: '已加载 {n} 页',
        emptyBoard: '这个板块暂时没有结果，可以继续下一页。',
        browseNoResults: '没有找到结果，可以继续下一页或换个问法。',
        browseHint: '已剔除竞价/推广结果',
        officialLabel: '官方',
        officialSectionTitle: '官方',
        groupHeading: '{name} · {n}',
        settingsTitle: 'AI 搜索',
        settingsLead: 'AI 搜索的偏好设置，修改后立即生效。',
        languageLabel: '结果语言',
        languageHint: 'AI 摘要、推荐理由与提醒使用的语言；只影响输出，不改变检索内容。',
        langAuto: '跟随 Harness',
        langZh: '中文',
        langEn: 'English',
        detailPrefLabel: '百科模式详细程度',
        detailPrefHint: '控制百科词条的章节数量与篇幅。',
        weightsPrefLabel: '浏览模式指标权重',
        weightsPrefHint: '三项自动归一化；例如只看相关性可把其它两项拉到 0。',
        historyLabel: '搜索历史',
        historyHint: '保存在本机，最多保留 20 条。',
        preserveStateLabel: '切换页面时保留结果',
        preserveStateHint: '在对话与搜索之间切换、或切换工作区后返回，保留原来的结果和板块（默认开启）。',
        historyClear: '清空搜索历史',
        historyCleared: '已清空',
        historyCount: '{n} 条记录',
        saving: '保存中…',
        saved: '已保存',
        saveFailed: '保存失败：{message}',
        loadFailed: '读取设置失败，已使用默认值',
        loadingSettings: '正在读取设置…',
        navIconNote: '设置导航图标由 Harness 外壳统一提供。',
        engineRailLabel: '搜索引擎',
        engineAi: 'AI 搜索',
        engineBaidu: '百度',
        engineBing: '必应',
        engineGoogle: 'Google',
        engineSogou: '搜狗',
        engineCustomHint: '自定义',
        customEngineSection: '自定义搜索引擎',
        customEngineHint: '名称 + 搜索网址模板，用 *#*#*#* 代替搜索词，可添加多个。',
        customEngineNamePlaceholder: '名称，例如 知乎',
        customEngineUrlPlaceholder: 'https://example.com/search?q=*#*#*#*',
        customEngineAdd: '添加',
        customEngineEmpty: '还没有自定义搜索引擎',
        customEngineDelete: '删除',
        customEngineInvalid: '请填写名称，并在网址中用 *#*#*#* 代替搜索词',
        officialMapLabel: '官网识别映射',
        officialMapHint: '自定义品牌 → 官网首页；品牌词搜索时官网会置顶并标「官方」。别名用逗号分隔。',
        officialMapEmpty: '还没有自定义官网映射',
        officialMapNamePlaceholder: '品牌名，例如 米哈游',
        officialMapAliasesPlaceholder: '别名，逗号分隔，例如 米哈游,miHoYo',
        officialMapHomepagePlaceholder: '官网首页，例如 https://www.mihoyo.com/',
        officialMapAdd: '添加',
        officialMapDelete: '删除',
        officialMapInvalid: '请填写品牌名，并给出合法的 http(s) 官网首页',
        officialMapImport: '导入 Excel / CSV',
        officialMapImportHint: '表格列：品牌名 | 别名（逗号分隔）| 官网首页；支持 .xlsx 和 .csv',
        officialMapImported: '已导入 {n} 条',
        officialMapImportEmpty: '文件里没有可导入的行（需要品牌名 + http(s) 官网首页）',
        officialMapImportError: '导入失败：{message}',
        customApiSection: '自定义 API 和模型',
        customApiHint: '默认使用 Harness 自带的搜索与模型服务；只有打开对应开关才走自己填写的接口。',
        searchApiToggle: '自定义搜索 API',
        searchApiToggleHint: '用它替换默认联网搜索（抓取正文仍用 Harness）。',
        searchApiProvider: '搜索平台',
        searchApiBaseUrl: '接口地址',
        searchApiBaseUrlPlaceholder: '留空使用平台默认地址',
        searchApiKey: 'API Key',
        searchApiKeyPlaceholder: '搜索平台的 API Key（SearXNG 可留空）',
        thinkingApiToggle: '自定义思考模型',
        thinkingApiToggleHint: '用它替换 Harness 默认模型，用于摘要 / 评分 / 百科生成。',
        thinkingBaseUrl: '接口地址（OpenAI 兼容）',
        thinkingBaseUrlPlaceholder: '例如 https://api.deepseek.com/v1',
        thinkingApiKey: 'API Key',
        thinkingModel: '模型名',
        thinkingModelPlaceholder: '例如 deepseek-chat',
        thinkingEffort: '思考强度',
        thinkingEffortAuto: '跟随模型',
        thinkingEffortLow: '低',
        thinkingEffortMedium: '中',
        thinkingEffortHigh: '高',
        customApiSave: '保存 API 设置',
        customApiSaved: '已保存',
        customApiInvalid: '保存失败：{message}',
        betterSidebarTabTitle: 'AI 搜索',
        betterSidebarTabDesc: '搜索网页并整理结果',
        betterSidebarLabel: '适配更好的侧边栏',
        betterSidebarHint: '在 dsh-better-sidebar 中注册「AI 搜索」页签；未安装该插件时自动忽略。',
        betterSidebarMissing: '未检测到 dsh-better-sidebar（安装后自动生效）',
        openLinksLabel: '结果链接默认在侧边栏浏览器打开',
        openLinksHint: '关闭后，点击结果改用系统默认浏览器打开。',
        defaultEngineLabel: '默认搜索引擎',
        defaultEngineHint: '侧边栏页面左侧可随时切换；选择非 AI 引擎时三模式切换会隐藏。',
      }
      var en = {
        nav: 'AI Search',
        title: 'AI Search',
        placeholder: 'Search anything…',
        search: 'Search',
        cancel: 'Cancel',
        modeQa: 'Answers',
        modeEncyclopedia: 'Encyclopedia',
        modeBrowse: 'Browse',
        modeQaHint: 'Summary + ranked picks',
        modeEncyclopediaHint: 'Encyclopedia-style entry',
        modeBrowseHint: 'Feed · 3-metric ranking',
        stageSearch: 'Retrieving',
        stageFilter: 'Filtering ads',
        stageRead: 'Reading pages',
        stageCurate: 'AI curating',
        stageEncSearch: 'Retrieving',
        stageEncFilter: 'Picking sources',
        stageEncRead: 'Reading sources',
        stageEncWrite: 'Writing entry',
        stageBrSearch: 'Multi-query retrieval',
        stageBrFilter: 'Filtering ads',
        stageBrScore: 'AI scoring',
        stageBrRank: 'Weighted ranking',
        searchingHint: 'Searching and curating — this usually takes 10–30 seconds…',
        aiSummary: 'AI summary',
        heuristicSummary: 'Heuristic summary',
        copy: 'Copy summary',
        copyArticle: 'Copy entry',
        copied: 'Copied',
        picksTitle: 'Recommended',
        picksCount: '{n}',
        removedTitle: 'Filtered out {n} items (ads / promos / duplicates / trimmed)',
        sourcesTitle: 'All sources ({n})',
        trusted: 'Authoritative',
        score: 'Score {n}',
        metaSources: '{n} sources',
        metaFetched: '{n} pages read',
        metaFetchedPartial: '{read}/{attempted} pages read',
        metaFetchedNone: 'No page text read (summary from search snippets)',
        metaRemoved: '{n} filtered',
        metaElapsed: '{s}s',
        metaModel: '{model}',
        errorTitle: 'Search failed',
        retry: 'Retry',
        errorHint: 'Rephrase the question or retry later.',
        emptyQuery: 'Type a question first',
        aiOff: 'AI ranking unavailable',
        alertTitle: 'Note',
        noPicks: 'No recommendations this time — try a more specific question.',
        newSearch: 'New search',
        historyTitle: 'Recent searches',
        historyClear: 'Clear',
        detailBrief: 'Brief',
        detailStandard: 'Standard',
        detailDetailed: 'Detailed',
        detailLabel: 'Detail: {name}',
        articleTitle: 'Entry',
        referencesTitle: 'References ({n})',
        articleAlert: 'AI entry generation is unavailable; showing source summaries.',
        weightsTitle: 'Ranking weights',
        weightPercent: '{name} {n}%',
        weightRelevance: 'Relevance',
        weightTimeliness: 'Freshness',
        weightHeat: 'Heat',
        aiScored: 'AI scored',
        heuristicScored: 'Heuristic scores',
        kindAll: 'All',
        kindArticle: 'Articles',
        kindVideo: 'Videos',
        kindImage: 'Images',
        metricLine: 'Rel {r} · Fresh {t} · Heat {h}',
        totalScore: 'Score {n}',
        nextPage: 'Next page',
        loadingNext: 'Loading…',
        noMore: 'No more results',
        pageCount: '{n} page(s) loaded',
        emptyBoard: 'Nothing in this section yet — try the next page.',
        browseNoResults: 'No results — try the next page or another wording.',
        browseHint: 'Bid/promoted results excluded',
        officialLabel: 'Official',
        officialSectionTitle: 'Official',
        groupHeading: '{name} · {n}',
        settingsTitle: 'AI Search',
        settingsLead: 'Preferences for AI Search; changes apply immediately.',
        languageLabel: 'Result language',
        languageHint: 'Language used for summaries, reasons and notes; it does not change what is retrieved.',
        langAuto: 'Follow Harness',
        langZh: '中文',
        langEn: 'English',
        detailPrefLabel: 'Encyclopedia detail level',
        detailPrefHint: 'Controls the number and depth of sections in encyclopedia entries.',
        weightsPrefLabel: 'Browse mode weights',
        weightsPrefHint: 'The three metrics are normalized; set the others to 0 to rank by relevance only.',
        historyLabel: 'Search history',
        historyHint: 'Stored on this machine, up to 20 entries.',
        preserveStateLabel: 'Keep results across panel switches',
        preserveStateHint: 'Keep the current results and section when switching between chat and search, or between workspaces (on by default).',
        historyClear: 'Clear search history',
        historyCleared: 'Cleared',
        historyCount: '{n} entries',
        saving: 'Saving…',
        saved: 'Saved',
        saveFailed: 'Save failed: {message}',
        loadFailed: 'Could not load settings; defaults are shown',
        loadingSettings: 'Loading settings…',
        navIconNote: 'The settings navigation icon is provided by the Harness shell.',
        engineRailLabel: 'Search engine',
        engineAi: 'AI Search',
        engineBaidu: 'Baidu',
        engineBing: 'Bing',
        engineGoogle: 'Google',
        engineSogou: 'Sogou',
        engineCustomHint: 'Custom',
        customEngineSection: 'Custom search engines',
        customEngineHint: 'Name + URL template with *#*#*#* as the query placeholder; add as many as you like.',
        customEngineNamePlaceholder: 'Name, e.g. Zhihu',
        customEngineUrlPlaceholder: 'https://example.com/search?q=*#*#*#*',
        customEngineAdd: 'Add',
        customEngineEmpty: 'No custom search engines yet',
        customEngineDelete: 'Delete',
        customEngineInvalid: 'Enter a name and use *#*#*#* in the URL as the query placeholder',
        officialMapLabel: 'Official-site mappings',
        officialMapHint: 'Custom brand → official homepage; the homepage is pinned and badged "Official" for brand queries. Separate aliases with commas.',
        officialMapEmpty: 'No custom official-site mappings yet',
        officialMapNamePlaceholder: 'Brand, e.g. miHoYo',
        officialMapAliasesPlaceholder: 'Aliases, comma separated, e.g. miHoYo,hoyoverse',
        officialMapHomepagePlaceholder: 'Homepage, e.g. https://www.mihoyo.com/',
        officialMapAdd: 'Add',
        officialMapDelete: 'Delete',
        officialMapInvalid: 'Enter a brand name and a valid http(s) homepage URL',
        officialMapImport: 'Import Excel / CSV',
        officialMapImportHint: 'Columns: brand | aliases (comma separated) | homepage; supports .xlsx and .csv',
        officialMapImported: 'Imported {n} entries',
        officialMapImportEmpty: 'No importable rows (need a brand name and an http(s) homepage)',
        officialMapImportError: 'Import failed: {message}',
        customApiSection: 'Custom API & models',
        customApiHint: 'Harness services are used by default; the endpoints below apply only when the matching switch is on.',
        searchApiToggle: 'Custom search API',
        searchApiToggleHint: 'Replaces the default web search (page fetching still uses Harness).',
        searchApiProvider: 'Search platform',
        searchApiBaseUrl: 'Endpoint',
        searchApiBaseUrlPlaceholder: 'Leave empty to use the platform default',
        searchApiKey: 'API key',
        searchApiKeyPlaceholder: 'API key of the search platform (optional for SearXNG)',
        thinkingApiToggle: 'Custom thinking model',
        thinkingApiToggleHint: 'Replaces the Harness default model for summaries / scoring / encyclopedia.',
        thinkingBaseUrl: 'Endpoint (OpenAI compatible)',
        thinkingBaseUrlPlaceholder: 'e.g. https://api.deepseek.com/v1',
        thinkingApiKey: 'API key',
        thinkingModel: 'Model',
        thinkingModelPlaceholder: 'e.g. deepseek-chat',
        thinkingEffort: 'Thinking effort',
        thinkingEffortAuto: 'Model default',
        thinkingEffortLow: 'Low',
        thinkingEffortMedium: 'Medium',
        thinkingEffortHigh: 'High',
        customApiSave: 'Save API settings',
        customApiSaved: 'Saved',
        customApiInvalid: 'Save failed: {message}',
        betterSidebarTabTitle: 'AI Search',
        betterSidebarTabDesc: 'Search the web with AI curation',
        betterSidebarLabel: 'Better Sidebar integration',
        betterSidebarHint: 'Registers an AI Search tab inside dsh-better-sidebar; ignored when that plugin is absent.',
        betterSidebarMissing: 'dsh-better-sidebar not detected (takes effect once installed)',
        openLinksLabel: 'Open result links in the sidebar browser',
        openLinksHint: 'Turn off to open results with the system browser instead.',
        defaultEngineLabel: 'Default search engine',
        defaultEngineHint: 'Switchable from the rail inside the sidebar page; non-AI engines hide the three mode tabs.',
      }
      var DICTS = { zh: zh, en: en }
      var SUGGESTIONS = {
        zh: [
          'DeepSeek 最新模型有哪些',
          '2025 年降噪耳机怎么选',
          '新能源车电池技术路线对比',
          '如何评价 MCP 协议',
          '2025 年值得关注的开源项目',
        ],
        en: [
          'What models does DeepSeek release in 2025',
          'Best noise-cancelling headphones in 2025',
          'EV battery technology comparison',
          'What is the MCP protocol',
          'Open source projects worth watching',
        ],
      }
      var DETAIL_OPTIONS = ['brief', 'standard', 'detailed']

      var STAGE_KEYS = {
        qa: ['stageSearch', 'stageFilter', 'stageRead', 'stageCurate'],
        encyclopedia: ['stageEncSearch', 'stageEncFilter', 'stageEncRead', 'stageEncWrite'],
        browse: ['stageBrSearch', 'stageBrFilter', 'stageBrScore', 'stageBrRank'],
      }

      // ------------------------------------------------------------------
      // 样式：只使用宿主主题 token，深浅色跟随宿主
      // ------------------------------------------------------------------
      var CSS = [
        '.ais-page{box-sizing:border-box;height:100%;width:100%;overflow-y:auto;overflow-x:hidden;display:flex;flex-direction:column;align-items:center;padding:0 clamp(24px,4vw,48px) 56px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);scrollbar-gutter:stable}',
        '.ais-inner{width:100%;max-width:900px;display:flex;flex-direction:column;gap:14px;padding-top:22px}',
        '[data-platform=darwin] .ais-inner{padding-top:calc(22px + var(--dsh-frame-top-clearance,0px))}',
        '.ais-head{display:flex;align-items:center;gap:10px;min-width:0}',
        '.ais-head-action{margin-left:auto;flex:none}',
        '.ais-logo{width:30px;height:30px;flex:none;border-radius:9px;display:flex;align-items:center;justify-content:center;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-brand-primary)}',
        '.ais-title{margin:0;font-size:16px;font-weight:600;line-height:24px}',
        '.ais-hero{width:100%;max-width:720px;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding-bottom:10vh}',
        '.ais-hero-logo{width:60px;height:60px;border-radius:18px;display:flex;align-items:center;justify-content:center;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-brand-primary)}',
        '.ais-hero-title{margin:0;font-size:23px;font-weight:600;line-height:32px;letter-spacing:.2px}',
        '.ais-hero-search{width:100%}',
        '.ais-hero-chips{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;width:100%}',
        '.ais-hero-history{display:flex;flex-direction:column;align-items:center;gap:8px;width:100%}',
        '.ais-history-label{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}',
        '.ais-history-clear{border:0;background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:12px;line-height:18px;cursor:pointer;padding:2px 8px;border-radius:6px}',
        '.ais-history-clear:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-2))}',
        '.ais-history-clear:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}',
        '.ais-modes{display:inline-flex;align-items:center;gap:2px;padding:3px;border-radius:12px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1)}',
        '.ais-mode-btn{display:inline-flex;flex-direction:column;align-items:center;gap:1px;padding:6px 14px;border:0;border-radius:9px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer;transition:background .15s ease,color .15s ease}',
        '.ais-mode-btn:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-2))}',
        '.ais-mode-btn[aria-pressed=true]{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);box-shadow:inset 0 0 0 1px var(--dsw-alias-border-l1)}',
        '.ais-mode-name{font-size:13px;line-height:19px;font-weight:600}',
        '.ais-mode-hint{font-size:10px;line-height:14px;color:var(--dsw-alias-label-tertiary);white-space:nowrap}',
        '.ais-mode-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}',
        '.ais-mode-bar{display:flex;justify-content:center;width:100%}',
        '.ais-search{display:flex;align-items:center;gap:10px;box-sizing:border-box;padding:6px 6px 6px 16px;border-radius:15px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);transition:border-color .15s ease,box-shadow .15s ease}',
        '.ais-search:focus-within{border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-brand-primary) 16%,transparent)}',
        '.ais-search-icon{flex:none;color:var(--dsw-alias-label-secondary);display:flex;align-items:center}',
        '.ais-input{flex:1;min-width:0;border:0;outline:0;background:transparent;color:inherit;font:inherit;font-size:15px;line-height:24px;padding:9px 0}',
        '.ais-input::placeholder{color:var(--dsw-alias-label-secondary)}',
        '.ais-submit{flex:none;display:inline-flex;align-items:center;gap:6px;height:38px;padding:0 16px;border-radius:11px;border:1px solid transparent;cursor:pointer;font:inherit;font-size:14px;font-weight:500;color:var(--dsw-alias-label-primary-inverted,#fff);background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary));transition:background .15s ease,opacity .15s ease}',
        '.ais-submit:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover,var(--dsw-alias-brand-primary))}',
        '.ais-submit:disabled{opacity:.55;cursor:default}',
        '.ais-submit:focus-visible,.ais-ghost:focus-visible,.ais-chip:focus-visible,.ais-iconbtn:focus-visible,.ais-collapse-head:focus-visible,.ais-board-tab:focus-visible,.ais-more:focus-visible,.ais-seg-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}',
        '.ais-ghost{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:10px;border:1px solid var(--dsw-alias-border-l1);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;cursor:pointer;transition:background .15s ease,color .15s ease}',
        '.ais-ghost:hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-label-primary)}',
        '.ais-section{display:flex;flex-direction:column;gap:10px}',
        '.ais-section-head{display:flex;align-items:center;gap:8px;min-height:24px}',
        '.ais-section-title{margin:0;font-size:15px;font-weight:600;line-height:22px}',
        '.ais-section-count{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}',
        '.ais-chip{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);border-radius:999px;padding:6px 12px;font:inherit;font-size:13px;line-height:20px;cursor:pointer;transition:background .15s ease,color .15s ease,border-color .15s ease;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
        '.ais-chip:hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l2)}',
        '.ais-card{box-sizing:border-box;border-radius:14px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);padding:16px}',
        '.ais-answer{position:relative;overflow:hidden}',
        '.ais-answer:before{content:"";position:absolute;left:0;right:0;top:0;height:2px;background:linear-gradient(90deg,var(--dsw-alias-brand-primary),transparent)}',
        '.ais-answer-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
        '.ais-answer-label{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:var(--dsw-alias-brand-primary)}',
        '.ais-answer-tags{margin-left:auto;display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
        '.ais-tag{font-size:11px;line-height:17px;padding:2px 8px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2)}',
        '.ais-tag-ai{color:var(--dsw-alias-brand-primary);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 34%,transparent);background:transparent}',
        '.ais-tag-warn{color:var(--dsw-alias-state-warn-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 40%,transparent);background:transparent}',
        '.ais-answer-text{margin:12px 0 0;font-size:14px;line-height:24px;white-space:pre-wrap;word-break:break-word}',
        '.ais-alert{margin-top:12px;display:flex;gap:8px;align-items:flex-start;padding:9px 12px;border-radius:10px;font-size:12px;line-height:19px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1)}',
        '.ais-meta{margin-top:12px;display:flex;flex-wrap:wrap;gap:6px 8px;align-items:center}',
        '.ais-meta-item{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}',
        '.ais-meta-sep{color:var(--dsw-alias-state-idle-primary);font-size:11px}',
        '.ais-answer-foot{margin-top:12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
        '.ais-iconbtn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:28px;padding:0 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer;transition:background .15s ease,color .15s ease}',
        '.ais-iconbtn:hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-label-primary)}',
        '.ais-picks{display:flex;flex-direction:column;gap:10px}',
        '.ais-pick{display:flex;gap:12px;padding:14px 16px;border-radius:13px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);transition:border-color .15s ease}',
        '.ais-pick:hover{border-color:var(--dsw-alias-border-l2)}',
        '.ais-rank{flex:none;width:26px;height:26px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary-inverted,#fff);background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary))}',
        '.ais-pick-body{min-width:0;flex:1;display:flex;flex-direction:column;gap:6px}',
        '.ais-pick-top{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}',
        '.ais-pick-title{font-size:15px;line-height:22px;font-weight:600;color:var(--dsw-alias-label-primary);text-decoration:none;word-break:break-word}',
        '.ais-pick-title:hover{color:var(--dsw-alias-brand-primary);text-decoration:underline}',
        '.ais-domain{font-size:11px;line-height:17px;color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l1);border-radius:999px;padding:1px 8px;background:var(--dsw-alias-bg-layer-2);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
        '.ais-trusted{font-size:11px;line-height:17px;color:var(--dsw-alias-state-success-primary)}',
        '.ais-pick-score{margin-left:auto;font-size:11px;line-height:17px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}',
        '.ais-pick-excerpt{margin:0;font-size:13px;line-height:21px;color:var(--dsw-alias-label-secondary);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word}',
        '.ais-pick-reason{margin:0;display:flex;gap:6px;align-items:flex-start;font-size:12px;line-height:19px;color:var(--dsw-alias-label-primary)}',
        '.ais-pick-reason-icon{flex:none;margin-top:2px;color:var(--dsw-alias-brand-primary);display:flex}',
        '.ais-article-title{margin:0;font-size:20px;line-height:30px;font-weight:600;word-break:break-word}',
        '.ais-article-lead{margin:12px 0 0;font-size:14px;line-height:24px;white-space:pre-wrap;word-break:break-word}',
        '.ais-article-section{margin-top:16px;display:flex;flex-direction:column;gap:6px}',
        '.ais-article-heading{margin:0;font-size:15px;line-height:23px;font-weight:600;color:var(--dsw-alias-label-primary)}',
        '.ais-article-body{margin:0;font-size:14px;line-height:24px;white-space:pre-wrap;word-break:break-word;color:var(--dsw-alias-label-primary)}',
        '.ais-browse-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}',
        '.ais-browse-bar-label{font-weight:600;color:var(--dsw-alias-label-primary)}',
        '.ais-boards{display:flex;align-items:center;gap:4px;flex-wrap:wrap;padding:3px;border-radius:12px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);align-self:flex-start}',
        '.ais-board-tab{border:0;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;line-height:20px;padding:6px 14px;border-radius:9px;cursor:pointer;display:inline-flex;align-items:center;gap:6px}',
        '.ais-board-tab:hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-label-primary)}',
        '.ais-board-tab[aria-selected=true]{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-weight:600}',
        '.ais-board-count{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary)}',
        '.ais-feed{display:flex;flex-direction:column;gap:10px}',
        '.ais-feed-card{display:flex;gap:12px;padding:14px 16px;border-radius:13px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1)}',
        '.ais-feed-card-text{}',
        '.ais-feed-card:hover{border-color:var(--dsw-alias-border-l2)}',
        '.ais-feed-thumb{flex:none;width:112px;height:74px;border-radius:9px;overflow:hidden;background:var(--dsw-alias-bg-layer-2);display:flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-tertiary)}',
        '.ais-feed-thumb img{width:100%;height:100%;object-fit:cover;display:block}',
        '.ais-feed-body{min-width:0;flex:1;display:flex;flex-direction:column;gap:5px}',
        '.ais-feed-top{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}',
        '.ais-feed-title{font-size:15px;line-height:22px;font-weight:600;color:var(--dsw-alias-label-primary);text-decoration:none;word-break:break-word}',
        '.ais-feed-title:hover{color:var(--dsw-alias-brand-primary);text-decoration:underline}',
        '.ais-kind{font-size:10px;line-height:16px;padding:1px 7px;border-radius:999px;color:var(--dsw-alias-brand-primary);border:1px solid color-mix(in srgb,var(--dsw-alias-brand-primary) 32%,transparent)}',
        '.ais-official{flex:none;font-size:10px;line-height:16px;padding:1px 7px;border-radius:999px;font-weight:600;color:var(--dsw-alias-brand-primary);border:1px solid color-mix(in srgb,var(--dsw-alias-brand-primary) 48%,transparent);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 12%,transparent)}',
        '.ais-feed-snippet{margin:0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word}',
        '.ais-metrics{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:11px;line-height:17px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}',
        '.ais-metrics-total{margin-left:auto;font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary)}',
        '.ais-image-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px}',
        '.ais-image-card{display:flex;flex-direction:column;border-radius:12px;overflow:hidden;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);text-decoration:none;color:inherit}',
        '.ais-image-card:hover{border-color:var(--dsw-alias-border-l2)}',
        '.ais-image-box{width:100%;aspect-ratio:4/3;background:var(--dsw-alias-bg-layer-2);display:flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-tertiary);overflow:hidden}',
        '.ais-image-box img{width:100%;height:100%;object-fit:cover;display:block}',
        '.ais-image-info{display:flex;flex-direction:column;gap:2px;padding:8px 10px 10px}',
        '.ais-image-title{font-size:12px;line-height:18px;color:var(--dsw-alias-label-primary);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word}',
        '.ais-image-meta{font-size:10px;line-height:15px;color:var(--dsw-alias-label-tertiary);display:flex;gap:6px;justify-content:space-between}',
        '.ais-more{display:inline-flex;align-items:center;justify-content:center;gap:8px;align-self:center;margin-top:6px;height:36px;padding:0 22px;border-radius:11px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;cursor:pointer;transition:background .15s ease}',
        '.ais-more:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-2))}',
        '.ais-more:disabled{opacity:.6;cursor:default}',
        '.ais-more-note{align-self:center;font-size:11px;line-height:17px;color:var(--dsw-alias-label-tertiary)}',
        '.ais-empty-board{padding:22px;border-radius:12px;border:1px dashed var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px;text-align:center}',
        '.ais-group{display:flex;flex-direction:column;gap:8px}',
        '.ais-group-head{display:flex;align-items:center;gap:8px;padding:2px 0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}',
        '.ais-group-title{font-weight:600;color:var(--dsw-alias-label-primary)}',
        '.ais-group-count{color:var(--dsw-alias-label-tertiary)}',
        '.ais-switch{box-sizing:border-box;position:relative;flex:none;width:36px;height:20px;padding:2px;border:0;border-radius:999px;background:var(--dsw-alias-border-l3);cursor:pointer;transition:background .12s ease}',
        '.ais-switch:after{content:"";display:block;width:16px;height:16px;border-radius:50%;background:var(--dsw-alias-label-primary-foreground,#fff);transition:transform .12s ease}',
        '.ais-switch[aria-checked=true]{background:var(--dsw-alias-brand-primary)}',
        '.ais-switch[aria-checked=true]:after{transform:translateX(16px)}',
        '.ais-switch:disabled{opacity:.5;cursor:default}',
        '.ais-switch:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}',
        '.ais-collapse{border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1);overflow:hidden}',
        '.ais-collapse-head{display:flex;align-items:center;gap:8px;width:100%;box-sizing:border-box;padding:11px 14px;border:0;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;line-height:20px;text-align:left;cursor:pointer}',
        '.ais-collapse-head:hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-2))}',
        '.ais-collapse-title{flex:1;min-width:0}',
        '.ais-collapse-body{border-top:1px solid var(--dsw-alias-border-l1);padding:8px 10px}',
        '.ais-row{display:flex;align-items:center;gap:10px;padding:7px 6px;border-radius:8px;min-width:0}',
        '.ais-row:hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-2))}',
        '.ais-row-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}',
        '.ais-row-title{font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary);text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
        '.ais-row-title:hover{text-decoration:underline}',
        '.ais-row-muted{font-size:11px;line-height:17px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
        '.ais-row-strike{color:var(--dsw-alias-label-secondary);text-decoration:line-through;font-size:13px;line-height:20px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
        '.ais-reason{flex:none;font-size:11px;line-height:17px;color:var(--dsw-alias-state-warn-primary);border:1px solid color-mix(in srgb,var(--dsw-alias-state-warn-primary) 34%,transparent);border-radius:999px;padding:1px 8px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
        '.ais-dot{flex:none;width:22px;height:22px;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);text-transform:uppercase}',
        '.ais-stages{display:flex;flex-direction:column;gap:10px}',
        '.ais-stage{display:flex;align-items:center;gap:10px;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary)}',
        '.ais-stage-active{color:var(--dsw-alias-label-primary)}',
        '.ais-stage-done{color:var(--dsw-alias-label-primary)}',
        '.ais-stage-mark{flex:none;width:20px;height:20px;display:flex;align-items:center;justify-content:center}',
        '.ais-spinner{width:14px;height:14px;border-radius:50%;border:2px solid var(--dsw-alias-border-l2);border-top-color:var(--dsw-alias-brand-primary);animation:ais-spin .8s linear infinite}',
        '.ais-pending{width:7px;height:7px;border-radius:50%;background:var(--dsw-alias-state-idle-primary)}',
        '.ais-check{color:var(--dsw-alias-state-success-primary);display:flex}',
        '@keyframes ais-spin{to{transform:rotate(360deg)}}',
        '@media (prefers-reduced-motion:reduce){.ais-spinner{animation:none}}',
        '.ais-skeleton{display:flex;flex-direction:column;gap:10px}',
        '.ais-skel-line{height:12px;border-radius:6px;background:var(--dsw-alias-bg-skeleton,var(--dsw-alias-bg-layer-2))}',
        '.ais-skel-card{height:76px;border-radius:13px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1)}',
        '.ais-error{display:flex;flex-direction:column;gap:12px;padding:20px;border-radius:14px;border:1px solid color-mix(in srgb,var(--dsw-alias-state-error-primary) 34%,var(--dsw-alias-border-l1));background:var(--dsw-alias-bg-layer-1)}',
        '.ais-error-title{display:flex;align-items:center;gap:8px;font-size:15px;font-weight:600;line-height:22px;color:var(--dsw-alias-state-error-primary)}',
        '.ais-error-msg{margin:0;font-size:13px;line-height:21px;color:var(--dsw-alias-label-primary);white-space:pre-wrap;word-break:break-word}',
        '.ais-error-hint{margin:0;font-size:12px;line-height:19px;color:var(--dsw-alias-label-secondary)}',
        /* 独立设置页 */
        '.ais-settings-page{box-sizing:border-box;height:100%;width:100%;overflow-y:auto;display:flex;justify-content:center;color:var(--dsw-alias-label-primary)}',
        '.ais-settings{box-sizing:border-box;width:100%;max-width:680px;display:flex;flex-direction:column;gap:14px;padding:8px clamp(20px,4vw,36px) 40px;font-size:13px;line-height:1.5}',
        '[data-platform=darwin] .ais-settings{padding-top:calc(8px + var(--dsh-frame-top-clearance,0px))}',
        '.ais-settings-head{display:flex;flex-direction:column;gap:4px}',
        '.ais-settings-head-row{display:flex;align-items:center;gap:8px}',
        '.ais-settings-head-icon{flex:none;width:26px;height:26px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-brand-primary)}',
        '.ais-settings-title{margin:0;font-size:16px;font-weight:600;line-height:1.4}',
        '.ais-settings-lead{margin:0;font-size:12px;line-height:1.6;color:var(--dsw-alias-label-tertiary)}',
        '.ais-pref{box-sizing:border-box;width:100%;display:flex;flex-direction:column;gap:4px;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-primary)}',
        '.ais-pref-group{display:flex;flex-direction:column;gap:8px;padding:12px 0;border-top:0.5px solid var(--dsw-alias-border-l2)}',
        '.ais-pref-group:first-of-type{border-top:0}',
        '.ais-pref-label-block{display:flex;flex-direction:column;gap:4px;min-width:0}',
        '.ais-pref-label{font-size:13px;font-weight:500;line-height:1.5}',
        '.ais-pref-hint{margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}',
        '.ais-seg{display:inline-flex;align-items:center;gap:2px;padding:2px;border-radius:9px;background:var(--dsw-alias-bg-layer-2);align-self:flex-start;flex-wrap:wrap}',
        '.ais-seg-btn{border:0;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:18px;padding:5px 12px;border-radius:7px;cursor:pointer}',
        '.ais-seg-btn:hover{color:var(--dsw-alias-label-primary)}',
        '.ais-seg-btn[aria-pressed=true]{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);box-shadow:0 1px 2px rgba(0,0,0,.08);font-weight:600}',
        '.ais-sliders{display:flex;flex-direction:column;gap:8px}',
        '.ais-slider-row{display:flex;align-items:center;gap:10px}',
        '.ais-slider-name{flex:none;width:52px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}',
        '.ais-slider{flex:1;min-width:0;accent-color:var(--dsw-alias-brand-primary);cursor:pointer}',
        '.ais-slider-value{flex:none;width:64px;text-align:right;font-size:12px;line-height:18px;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums}',
        '.ais-pref-inline{display:flex;align-items:center;justify-content:space-between;gap:16px;padding-top:2px}',
        '.ais-pref-button{flex:none;display:inline-flex;align-items:center;justify-content:center;height:28px;padding:0 10px;border:0.5px solid var(--dsw-alias-border-l3);border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;line-height:18px;cursor:pointer}',
        '.ais-pref-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-2))}',
        '.ais-pref-button:disabled{opacity:.45;cursor:default}',
        '.ais-pref-button:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}',
        '.ais-pref-status{margin:0;min-height:18px;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}',
        '.ais-pref-status-ok{color:var(--dsw-alias-state-success-primary)}',
        '.ais-pref-status-error{color:var(--dsw-alias-state-error-primary)}',
        '.ais-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}',
        '.ais-embed{display:flex;height:100%;min-height:0;width:100%;background:var(--dsw-alias-bg-base)}',
        '.ais-embed-body{flex:1;min-width:0;height:100%;display:flex;flex-direction:column;overflow:hidden}',
        '.ais-rail{flex:none;width:76px;display:flex;flex-direction:column;align-items:stretch;gap:6px;padding:10px 8px;border-right:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);overflow-y:auto}',
        '.ais-rail-btn{display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 2px;border:1px solid transparent;border-radius:10px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;font:inherit;font-size:11px;line-height:1.2}',
        '.ais-rail-btn:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}',
        '.ais-rail-btn.is-active{background:var(--dsw-alias-bg-layer-1);border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}',
        '.ais-rail-icon{display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:9px;background:var(--dsw-alias-bg-layer-2);font-size:11px;font-weight:600}',
        '.ais-rail-label{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
        '.ais-rail-letter{display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;letter-spacing:-.3px}',
        '.ais-custom-list{display:flex;flex-direction:column;gap:6px}',
        '.ais-custom-row{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:8px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);min-width:0}',
        '.ais-custom-name{flex:none;font-size:12px;line-height:18px;font-weight:600}',
        '.ais-custom-alias{flex:none;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;line-height:17px;color:var(--dsw-alias-label-secondary)}',
        '[data-dsh-ai-search-settings-nav] > svg:first-child{display:none}',
        '[data-dsh-ai-search-settings-nav]::before{content:\'\';flex:none;width:16px;height:16px;background:currentColor;-webkit-mask:url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Ccircle%20cx%3D%2211%22%20cy%3D%2211%22%20r%3D%228%22%2F%3E%3Cpath%20d%3D%22m21%2021-4.3-4.3%22%2F%3E%3C%2Fsvg%3E") center / contain no-repeat;mask:url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Ccircle%20cx%3D%2211%22%20cy%3D%2211%22%20r%3D%228%22%2F%3E%3Cpath%20d%3D%22m21%2021-4.3-4.3%22%2F%3E%3C%2Fsvg%3E") center / contain no-repeat}',
        '.ais-custom-url{flex:1;min-width:0;font-size:11px;line-height:17px;color:var(--dsw-alias-label-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
        '.ais-custom-form{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:2px}',
        '.ais-custom-input{box-sizing:border-box;height:30px;padding:0 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;line-height:18px;min-width:110px;flex:1 1 130px}',
        '.ais-custom-input-url{flex:2 1 240px}',
        '.ais-custom-input:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}',
      ].join('\n')

      // ------------------------------------------------------------------
      // 基础工具
      // ------------------------------------------------------------------
      function format(template, params) {
        if (typeof template !== 'string') return ''
        if (params === undefined || params === null) return template
        return template.replace(/\{(\w+)\}/g, function (match, key) {
          var value = params[key]
          return value === undefined || value === null ? match : String(value)
        })
      }

      function pickLang(locale) {
        try {
          var snapshot = locale && typeof locale.getSnapshot === 'function' ? locale.getSnapshot() : null
          var active = snapshot && typeof snapshot.active === 'string' ? snapshot.active : ''
          if (active === 'en') return 'en'
          if (active === 'zh') return 'zh'
        } catch (error) {
          /* locale 服务不可用时退回中文 */
        }
        try {
          var tag = typeof document !== 'undefined' && document.documentElement ? document.documentElement.lang : ''
          if (typeof tag === 'string' && tag.toLowerCase().indexOf('en') === 0) return 'en'
        } catch (error) {
          /* 忽略 */
        }
        return 'zh'
      }

      function useLocale(locale) {
        var state = React.useState(0)
        var bump = state[1]
        React.useEffect(function () {
          if (!locale || typeof locale.subscribe !== 'function') return undefined
          var dispose = locale.subscribe(function () {
            bump(function (value) {
              return value + 1
            })
          })
          return function () {
            if (typeof dispose === 'function') dispose()
          }
        }, [locale])
        var lang = pickLang(locale)
        var dict = DICTS[lang]
        var t = React.useCallback(
          function (key, params) {
            var value = dict[key]
            return format(value === undefined ? key : value, params)
          },
          [dict],
        )
        return { lang: lang, t: t }
      }

      function formatSeconds(ms) {
        var seconds = Math.max(0, Math.round(Number(ms || 0) / 100) / 10)
        return seconds >= 10 ? String(Math.round(seconds)) : seconds.toFixed(1).replace(/\.0$/, '')
      }

      function copyText(text) {
        try {
          if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            return navigator.clipboard.writeText(text).then(
              function () {
                return true
              },
              function () {
                return legacyCopy(text)
              },
            )
          }
        } catch (error) {
          /* 落到底层方案 */
        }
        return Promise.resolve(legacyCopy(text))
      }

      function legacyCopy(text) {
        try {
          var area = document.createElement('textarea')
          area.value = text
          area.setAttribute('readonly', 'readonly')
          area.style.position = 'fixed'
          area.style.top = '-1000px'
          document.body.appendChild(area)
          area.select()
          var ok = document.execCommand('copy')
          document.body.removeChild(area)
          return ok
        } catch (error) {
          return false
        }
      }

      function requestJson(path, options) {
        // 所有请求都带本地客户端请求头：服务端据此拒绝第三方网页的跨站简单请求。
        var init = { cache: 'no-store', headers: { 'x-dsh-ai-search': '1' } }
        if (options !== undefined) {
          if (options.method !== undefined) init.method = options.method
          if (options.body !== undefined) {
            init.headers['content-type'] = 'application/json'
            init.body = JSON.stringify(options.body)
          }
        }
        return fetch(ROUTE + path, init).then(function (response) {
          return response
            .json()
            .catch(function () {
              return null
            })
            .then(function (payload) {
              if (!response.ok || payload === null || payload.ok !== true) {
                var message = payload && payload.error && payload.error.message ? payload.error.message : 'HTTP ' + response.status
                throw new Error(message)
              }
              return payload
            })
        })
      }

      function percentWeights(weights) {
        var total = (weights.relevance || 0) + (weights.timeliness || 0) + (weights.heat || 0)
        if (total <= 0) return { relevance: 100, timeliness: 0, heat: 0 }
        return {
          relevance: Math.round(((weights.relevance || 0) / total) * 100),
          timeliness: Math.round(((weights.timeliness || 0) / total) * 100),
          heat: Math.round(((weights.heat || 0) / total) * 100),
        }
      }

      function htmlTime(value) {
        var date = new Date(value)
        if (Number.isNaN(date.getTime())) return ''
        try {
          return date.toLocaleString()
        } catch (error) {
          return date.toISOString()
        }
      }

      // ------------------------------------------------------------------
      // 图标
      // ------------------------------------------------------------------
      function svg(props, children) {
        return h(
          'svg',
          {
            width: props.size || 16,
            height: props.size || 16,
            viewBox: '0 0 16 16',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: props.strokeWidth || 1.4,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            'aria-hidden': 'true',
            focusable: 'false',
            style: props.style,
          },
          children,
        )
      }

      function SearchGlyph(props) {
        return h(
          'svg',
          {
            width: (props && props.size) || 16,
            height: (props && props.size) || 16,
            viewBox: '0 0 16 16',
            fill: 'none',
            'aria-hidden': 'true',
            focusable: 'false',
          },
          h('circle', { cx: '7', cy: '7', r: '4.6', stroke: 'currentColor', strokeWidth: '1.5' }),
          h('path', { d: 'M10.4 10.4 L14 14', stroke: 'currentColor', strokeWidth: '1.7', strokeLinecap: 'round' }),
          h('path', {
            d: 'M12.1 2.2 L12.7 3.8 L14.3 4.4 L12.7 5 L12.1 6.6 L11.5 5 L9.9 4.4 L11.5 3.8 Z',
            fill: 'currentColor',
            stroke: 'none',
          }),
        )
      }

      function SparkGlyph(props) {
        return svg({ size: (props && props.size) || 14 }, [
          h('path', {
            key: '1',
            d: 'M8 1.5 L9.4 6.1 L14 7.5 L9.4 8.9 L8 13.5 L6.6 8.9 L2 7.5 L6.6 6.1 Z',
            fill: 'currentColor',
            stroke: 'none',
          }),
        ])
      }

      function ShieldGlyph(props) {
        return svg({ size: (props && props.size) || 16 }, [
          h('path', { key: '1', d: 'M8 1.8 L13 3.6 V7.6 C13 11 10.8 13.2 8 14.2 C5.2 13.2 3 11 3 7.6 V3.6 Z' }),
          h('path', { key: '2', d: 'M5.8 8.1 L7.3 9.6 L10.3 6.4' }),
        ])
      }

      function CopyGlyph(props) {
        return svg({ size: (props && props.size) || 13 }, [
          h('rect', { key: '1', x: '5.2', y: '5.2', width: '8', height: '8', rx: '1.8' }),
          h('path', {
            key: '2',
            d: 'M10.8 5.2 V4.2 A1.8 1.8 0 0 0 9 2.4 H4.2 A1.8 1.8 0 0 0 2.4 4.2 V9 A1.8 1.8 0 0 0 4.2 10.8 H5.2',
          }),
        ])
      }

      function CheckGlyph(props) {
        return svg({ size: (props && props.size) || 14, strokeWidth: 1.8 }, [h('path', { key: '1', d: 'M3 8.4 L6.3 11.6 L13 4.6' })])
      }

      function ChevronGlyph(props) {
        var open = props && props.open === true
        var down = props && props.down === true
        var style = { transition: 'transform .15s ease' }
        if (down) style.transform = 'rotate(90deg)'
        else if (open) style.transform = 'rotate(180deg)'
        return svg({ size: 13, strokeWidth: 1.6, style: style }, [h('path', { key: '1', d: 'M3.5 6 L8 10.5 L12.5 6' })])
      }

      function WarnGlyph(props) {
        return svg({ size: (props && props.size) || 15 }, [
          h('circle', { key: '1', cx: '8', cy: '8', r: '6.2' }),
          h('path', { key: '2', d: 'M8 5 V8.6' }),
          h('path', { key: '3', d: 'M8 11.2 V11.3' }),
        ])
      }

      function ExternalGlyph(props) {
        return svg({ size: (props && props.size) || 12 }, [
          h('path', { key: '1', d: 'M6.4 3.4 H3.4 V12.6 H12.6 V9.6' }),
          h('path', { key: '2', d: 'M9.4 2.6 H13.4 V6.6' }),
          h('path', { key: '3', d: 'M13.4 2.6 L7.6 8.4' }),
        ])
      }

      function ImageGlyph(props) {
        return svg({ size: (props && props.size) || 18 }, [
          h('rect', { key: '1', x: '2.2', y: '3.2', width: '11.6', height: '9.6', rx: '1.6' }),
          h('circle', { key: '2', cx: '5.9', cy: '6.4', r: '1.1' }),
          h('path', { key: '3', d: 'M2.6 11.2 L6.2 8.2 L8.6 10.2 L10.4 8.8 L13.4 11.2' }),
        ])
      }

      // ------------------------------------------------------------------
      // 通用小组件
      // ------------------------------------------------------------------
      function ModeTabs(props) {
        var t = props.t
        var items = [
          { value: 'qa', label: 'modeQa', hint: 'modeQaHint' },
          { value: 'encyclopedia', label: 'modeEncyclopedia', hint: 'modeEncyclopediaHint' },
          { value: 'browse', label: 'modeBrowse', hint: 'modeBrowseHint' },
        ]
        return h(
          'div',
          { className: 'ais-modes', role: 'group', 'aria-label': t('title') },
          items.map(function (item) {
            return h(
              'button',
              {
                key: item.value,
                type: 'button',
                className: 'ais-mode-btn',
                'aria-pressed': props.mode === item.value ? 'true' : 'false',
                title: t(item.hint),
                onClick: function () {
                  props.onChange(item.value)
                },
              },
              h('span', { className: 'ais-mode-name' }, t(item.label)),
              h('span', { className: 'ais-mode-hint' }, t(item.hint)),
            )
          }),
        )
      }

      function SearchBar(props) {
        var t = props.t
        var loading = props.loading === true
        function onChange(event) {
          props.onChange(event.target.value)
        }
        function onKeyDown(event) {
          if (event.key !== 'Enter') return
          if (event.nativeEvent && event.nativeEvent.isComposing) return
          event.preventDefault()
          props.onSubmit()
        }
        return h(
          'div',
          { className: 'ais-search' },
          h('span', { className: 'ais-search-icon' }, h(SearchGlyph, { size: 17 })),
          h('input', {
            className: 'ais-input',
            type: 'text',
            value: props.value,
            placeholder: t('placeholder'),
            'aria-label': t('title'),
            autoComplete: 'off',
            spellCheck: false,
            onChange: onChange,
            onKeyDown: onKeyDown,
            disabled: loading,
            autoFocus: true,
          }),
          loading
            ? h('button', { type: 'button', className: 'ais-ghost', onClick: props.onCancel }, t('cancel'))
            : h('button', { type: 'button', className: 'ais-submit', onClick: props.onSubmit, disabled: String(props.value || '').trim() === '' }, t('search')),
        )
      }

      function SuggestionList(props) {
        return props.items.map(function (item) {
          return h(
            'button',
            {
              key: item,
              type: 'button',
              className: 'ais-chip',
              title: item,
              onClick: function () {
                props.onPick(item)
              },
            },
            item,
          )
        })
      }

      function StageRow(props) {
        var mark
        if (props.state === 'done') mark = h('span', { className: 'ais-check' }, h(CheckGlyph, { size: 14 }))
        else if (props.state === 'active') mark = h('span', { className: 'ais-spinner' })
        else mark = h('span', { className: 'ais-pending' })
        var className = 'ais-stage' + (props.state === 'active' ? ' ais-stage-active' : props.state === 'done' ? ' ais-stage-done' : '')
        return h('div', { className: className }, h('span', { className: 'ais-stage-mark' }, mark), h('span', null, props.label))
      }

      function LoadingView(props) {
        var t = props.t
        var stage = props.stage
        var keys = STAGE_KEYS[props.mode] || STAGE_KEYS.qa
        return h(
          'div',
          { className: 'ais-section' },
          h(
            'div',
            { className: 'ais-card ais-stages' },
            keys.map(function (key, index) {
              return h(StageRow, { key: key, label: t(key), state: index < stage ? 'done' : index === stage ? 'active' : 'pending' })
            }),
            h('div', { className: 'ais-meta' }, h('span', { className: 'ais-meta-item' }, t('searchingHint'))),
          ),
          h(
            'div',
            { className: 'ais-skeleton' },
            h('div', { className: 'ais-skel-line', style: { width: '82%' } }),
            h('div', { className: 'ais-skel-line', style: { width: '64%' } }),
            h('div', { className: 'ais-skel-card' }),
            h('div', { className: 'ais-skel-card' }),
          ),
        )
      }

      function MetaRow(props) {
        var result = props.result
        var t = props.t
        var stats = result.stats || {}
        var fetched = typeof stats.fetched === 'number' ? stats.fetched : 0
        var fetchAttempted = typeof stats.fetchAttempted === 'number' ? stats.fetchAttempted : 0
        var fetchLabel = ''
        if (fetchAttempted > 0 && fetched === 0) fetchLabel = t('metaFetchedNone')
        else if (fetchAttempted > 0 && fetched < fetchAttempted) fetchLabel = format(t('metaFetchedPartial'), { read: fetched, attempted: fetchAttempted })
        else fetchLabel = format(t('metaFetched'), { n: fetched })
        var items = [
          format(t('metaSources'), { n: stats.kept === undefined ? (result.sources || []).length : stats.kept }),
          fetchLabel,
          format(t('metaRemoved'), { n: stats.removed === undefined ? (result.removed || []).length : stats.removed }),
          format(t('metaElapsed'), { s: formatSeconds(stats.elapsedMs) }),
        ]
        if (result.aiModel) items.push(format(t('metaModel'), { model: result.aiModel }))
        var nodes = []
        items.forEach(function (item, index) {
          if (index > 0) nodes.push(h('span', { key: 'sep' + index, className: 'ais-meta-sep' }, '·'))
          nodes.push(h('span', { key: 'item' + index, className: 'ais-meta-item' }, item))
        })
        return h('div', { className: 'ais-meta' }, nodes)
      }

      function RemovedPanel(props) {
        var t = props.t
        var removed = props.removed || []
        var open = props.open
        if (removed.length === 0) return null
        return h(
          'section',
          { className: 'ais-collapse' },
          h(
            'button',
            { type: 'button', className: 'ais-collapse-head', 'aria-expanded': open ? 'true' : 'false', onClick: props.onToggle },
            h(ShieldGlyph, { size: 14 }),
            h('span', { className: 'ais-collapse-title' }, format(t('removedTitle'), { n: removed.length })),
            h(ChevronGlyph, { open: open }),
          ),
          open
            ? h(
                'div',
                { className: 'ais-collapse-body' },
                removed.slice(0, 24).map(function (entry, index) {
                  return h(
                    'div',
                    { className: 'ais-row', key: entry.url + '#' + index },
                    h('span', { className: 'ais-dot' }, (entry.domain || '?').slice(0, 1)),
                    h(
                      'div',
                      { className: 'ais-row-main' },
                      entry.url
                        ? h(
                            'a',
                            linkProps('ais-row-strike', entry.url, entry.url),
                            entry.title || entry.url,
                          )
                        : h('span', { className: 'ais-row-strike' }, entry.title || '(无标题)'),
                      h('span', { className: 'ais-row-muted' }, entry.domain || ''),
                    ),
                    h('span', { className: 'ais-reason', title: entry.reason }, entry.reason),
                  )
                }),
              )
            : null,
        )
      }

      function SourcesPanel(props) {
        var t = props.t
        var sources = props.sources || []
        var open = props.open
        if (sources.length === 0) return null
        return h(
          'section',
          { className: 'ais-collapse' },
          h(
            'button',
            { type: 'button', className: 'ais-collapse-head', 'aria-expanded': open ? 'true' : 'false', onClick: props.onToggle },
            h(ExternalGlyph, { size: 13 }),
            h('span', { className: 'ais-collapse-title' }, format(t('sourcesTitle'), { n: sources.length })),
            h(ChevronGlyph, { open: open }),
          ),
          open
            ? h(
                'div',
                { className: 'ais-collapse-body' },
                sources.map(function (source, index) {
                  return h(
                    'div',
                    { className: 'ais-row', key: source.url + '#' + index },
                    h('span', { className: 'ais-dot' }, (source.domain || '?').slice(0, 1)),
                    h(
                      'div',
                      { className: 'ais-row-main' },
                      h(
                        'a',
                        linkProps('ais-row-title', source.url, source.url),
                        source.title || source.url,
                      ),
                      h('span', { className: 'ais-row-muted' }, source.domain + (source.publishedAt ? ' · ' + source.publishedAt : '')),
                    ),
                  )
                }),
              )
            : null,
        )
      }

      function ErrorView(props) {
        var t = props.t
        return h(
          'div',
          { className: 'ais-error', role: 'alert' },
          h('div', { className: 'ais-error-title' }, h(WarnGlyph, { size: 16 }), t('errorTitle')),
          h('p', { className: 'ais-error-msg' }, props.message),
          h('p', { className: 'ais-error-hint' }, t('errorHint')),
          h(
            'div',
            { style: { display: 'flex', gap: '8px' } },
            h('button', { type: 'button', className: 'ais-submit', style: { height: '34px', padding: '0 14px' }, onClick: props.onRetry }, t('retry')),
          ),
        )
      }

      // ------------------------------------------------------------------
      // 答疑模式结果
      // ------------------------------------------------------------------
      function buildCopyText(result) {
        var lines = [result.answer || '']
        if (result.picks && result.picks.length > 0) {
          lines.push('')
          result.picks.forEach(function (pick, index) {
            lines.push(index + 1 + '. ' + pick.title + ' — ' + pick.url)
            if (pick.reason) lines.push('   ' + pick.reason)
          })
        }
        return lines.join('\n')
      }

      function CopyButton(props) {
        var t = props.t
        var copied = props.copied === true
        return h(
          'button',
          { type: 'button', className: 'ais-iconbtn', onClick: props.onCopy },
          copied ? h(CheckGlyph, { size: 13 }) : h(CopyGlyph, { size: 13 }),
          copied ? t('copied') : props.label,
        )
      }

      function AnswerCard(props) {
        var t = props.t
        var result = props.result
        return h(
          'section',
          { className: 'ais-card ais-answer', 'aria-label': t('aiSummary') },
          h(
            'div',
            { className: 'ais-answer-head' },
            h('span', { className: 'ais-answer-label' }, h(SparkGlyph, { size: 14 }), t(result.ai ? 'aiSummary' : 'heuristicSummary')),
            h(
              'div',
              { className: 'ais-answer-tags' },
              result.ai ? h('span', { className: 'ais-tag ais-tag-ai' }, 'AI') : h('span', { className: 'ais-tag ais-tag-warn' }, t('aiOff')),
            ),
          ),
          h('p', { className: 'ais-answer-text' }, result.answer || ''),
          result.alert
            ? h('div', { className: 'ais-alert' }, h(WarnGlyph, { size: 14 }), h('span', null, h('strong', null, t('alertTitle') + '：'), result.alert))
            : null,
          h(MetaRow, { t: t, result: result }),
          h('div', { className: 'ais-answer-foot' }, h(CopyButton, { t: t, copied: props.copied, label: t('copy'), onCopy: props.onCopy })),
        )
      }

      function PickCard(props) {
        var t = props.t
        var pick = props.pick
        return h(
          'article',
          { className: 'ais-pick' },
          h('span', { className: 'ais-rank', 'aria-hidden': 'true' }, String(props.index + 1)),
          h(
            'div',
            { className: 'ais-pick-body' },
            h(
              'div',
              { className: 'ais-pick-top' },
              h('a', linkProps('ais-pick-title', pick.url, pick.url), pick.title),
              h('span', { className: 'ais-domain', title: pick.url }, pick.domain),
              pick.trusted ? h('span', { className: 'ais-trusted' }, t('trusted')) : null,
              typeof pick.score === 'number' ? h('span', { className: 'ais-pick-score' }, format(t('score'), { n: pick.score })) : null,
            ),
            pick.excerpt || pick.snippet ? h('p', { className: 'ais-pick-excerpt' }, pick.excerpt || pick.snippet) : null,
            pick.reason
              ? h('p', { className: 'ais-pick-reason' }, h('span', { className: 'ais-pick-reason-icon' }, h(SparkGlyph, { size: 12 })), h('span', null, pick.reason))
              : null,
          ),
        )
      }

      function QaResultView(props) {
        var t = props.t
        var result = props.result
        var picks = result.picks || []
        return h(
          'div',
          { className: 'ais-section' },
          h(AnswerCard, {
            t: t,
            result: result,
            copied: props.copied,
            onCopy: function () {
              copyText(buildCopyText(result)).then(props.onCopied)
            },
          }),
          h(
            'section',
            { className: 'ais-section', 'aria-label': t('picksTitle') },
            h(
              'div',
              { className: 'ais-section-head' },
              h('h2', { className: 'ais-section-title' }, t('picksTitle')),
              h('span', { className: 'ais-section-count' }, format(t('picksCount'), { n: picks.length })),
            ),
            picks.length === 0
              ? h('div', { className: 'ais-card', style: { fontSize: '13px', lineHeight: '21px', color: 'var(--dsw-alias-label-secondary)' } }, t('noPicks'))
              : h(
                  'div',
                  { className: 'ais-picks' },
                  picks.map(function (pick, index) {
                    return h(PickCard, { key: pick.url + '#' + index, t: t, pick: pick, index: index })
                  }),
                ),
          ),
          h(RemovedPanel, { t: t, removed: result.removed || [], open: props.removedOpen, onToggle: props.onRemovedToggle }),
          h(SourcesPanel, { t: t, sources: result.sources || [], open: props.sourcesOpen, onToggle: props.onSourcesToggle }),
        )
      }

      // ------------------------------------------------------------------
      // 百科模式结果
      // ------------------------------------------------------------------
      function buildArticleText(result) {
        var lines = ['# ' + (result.title || result.query), '', result.lead || '']
        for (const section of result.sections || []) lines.push('', '## ' + section.heading, '', section.body)
        if ((result.references || []).length > 0) {
          lines.push('', '## 参考来源')
          for (const reference of result.references) lines.push('- [' + reference.title + '](' + reference.url + ')')
        }
        return lines.join('\n')
      }

      function EncyclopediaView(props) {
        var t = props.t
        var result = props.result
        var detailKey = result.detail === 'brief' ? 'detailBrief' : result.detail === 'detailed' ? 'detailDetailed' : 'detailStandard'
        return h(
          'div',
          { className: 'ais-section' },
          h(
            'article',
            { className: 'ais-card ais-answer' },
            h(
              'div',
              { className: 'ais-answer-head' },
              h('span', { className: 'ais-answer-label' }, h(SparkGlyph, { size: 14 }), t('articleTitle')),
              h(
                'div',
                { className: 'ais-answer-tags' },
                result.ai ? h('span', { className: 'ais-tag ais-tag-ai' }, 'AI') : h('span', { className: 'ais-tag ais-tag-warn' }, t('aiOff')),
                h('span', { className: 'ais-tag' }, format(t('detailLabel'), { name: t(detailKey) })),
              ),
            ),
            h('h2', { className: 'ais-article-title', style: { marginTop: '12px' } }, result.title || result.query),
            h('p', { className: 'ais-article-lead' }, result.lead || ''),
            (result.sections || []).map(function (section, index) {
              return h(
                'section',
                { className: 'ais-article-section', key: 'sec' + index },
                h('h3', { className: 'ais-article-heading' }, section.heading),
                h('p', { className: 'ais-article-body' }, section.body),
              )
            }),
            result.aiError ? h('div', { className: 'ais-alert' }, h(WarnGlyph, { size: 14 }), h('span', null, t('articleAlert'))) : null,
            h(MetaRow, { t: t, result: result }),
            h(
              'div',
              { className: 'ais-answer-foot' },
              h(CopyButton, {
                t: t,
                copied: props.copied,
                label: t('copyArticle'),
                onCopy: function () {
                  copyText(buildArticleText(result)).then(props.onCopied)
                },
              }),
            ),
          ),
          h(
            'section',
            { className: 'ais-section', 'aria-label': t('referencesTitle') },
            h('div', { className: 'ais-section-head' }, h('h2', { className: 'ais-section-title' }, format(t('referencesTitle'), { n: (result.references || []).length }))),
            (result.references || []).length === 0
              ? h('div', { className: 'ais-empty-board' }, t('noPicks'))
              : h(
                  'div',
                  { className: 'ais-picks' },
                  (result.references || []).map(function (reference, index) {
                    return h(PickCard, {
                      key: reference.url + '#' + index,
                      t: t,
                      index: index,
                      pick: {
                        url: reference.url,
                        title: reference.title,
                        domain: reference.domain,
                        snippet: '',
                        excerpt: '',
                        reason: '',
                        score: undefined,
                        trusted: reference.trusted === true,
                      },
                    })
                  }),
                ),
          ),
          h(RemovedPanel, { t: t, removed: result.removed || [], open: props.removedOpen, onToggle: props.onRemovedToggle }),
          h(SourcesPanel, { t: t, sources: result.sources || [], open: props.sourcesOpen, onToggle: props.onSourcesToggle }),
        )
      }

      // ------------------------------------------------------------------
      // 浏览模式结果
      // ------------------------------------------------------------------
      function FeedCard(props) {
        var t = props.t
        var item = props.item
        var kindKey = KIND_LABELS[item.kind] || 'kindArticle'
        return h(
          'article',
          { className: 'ais-feed-card' + (item.thumbnail ? '' : ' ais-feed-card-text') },
          item.thumbnail
            ? h(
                'div',
                { className: 'ais-feed-thumb' },
                h('img', { src: item.thumbnail, alt: '', loading: 'lazy', referrerPolicy: 'no-referrer' }),
              )
            : null,
          h(
            'div',
            { className: 'ais-feed-body' },
            h(
              'div',
              { className: 'ais-feed-top' },
              h('a', linkProps('ais-feed-title', item.url, item.url), item.title),
              h('span', { className: 'ais-kind' }, item.kind === 'video' && item.sourcePlatform ? t(kindKey) + ' · ' + item.sourcePlatform : t(kindKey)),
              item.official === true ? h('span', { className: 'ais-official' }, t('officialLabel')) : null,
              h('span', { className: 'ais-domain', title: item.url }, item.domain),
            ),
            item.snippet ? h('p', { className: 'ais-feed-snippet' }, item.snippet) : null,
            h(
              'div',
              { className: 'ais-metrics' },
              format(t('metricLine'), { r: item.metrics.relevance, t: item.metrics.timeliness, h: item.metrics.heat }),
              h('span', { className: 'ais-metrics-total' }, format(t('totalScore'), { n: item.score })),
            ),
          ),
        )
      }

      function ImageCard(props) {
        var t = props.t
        var item = props.item
        if (!item.thumbnail) return null
        return h(
          'a',
          linkProps('ais-image-card', item.url, item.url),
          h(
            'div',
            { className: 'ais-image-box' },
            h('img', { src: item.thumbnail, alt: '', loading: 'lazy', referrerPolicy: 'no-referrer' }),
          ),
          h(
            'div',
            { className: 'ais-image-info' },
            h('span', { className: 'ais-image-title' }, item.title),
            h(
              'span',
              { className: 'ais-image-meta' },
              h('span', null, item.domain),
              item.official === true ? h('span', { className: 'ais-official' }, t('officialLabel')) : null,
              h('span', null, format(t('totalScore'), { n: item.score })),
            ),
          ),
        )
      }

      function BoardTabs(props) {
        var t = props.t
        var counts = props.counts || {}
        return h(
          'div',
          { className: 'ais-boards', role: 'tablist' },
          BOARDS.map(function (board) {
            var count = counts[board] || 0
            return h(
              'button',
              {
                key: board,
                type: 'button',
                role: 'tab',
                className: 'ais-board-tab',
                'aria-selected': props.board === board ? 'true' : 'false',
                onClick: function () {
                  props.onChange(board)
                },
              },
              t(KIND_LABELS[board] || 'kindAll'),
              h('span', { className: 'ais-board-count' }, String(count)),
            )
          }),
        )
      }

      /** 某个板块的正文：综合板块固定按「文章 → 视频 → 图片」分组，顺序不随数量变化。 */
      function BrowseBoardContent(props) {
        var t = props.t
        var board = props.board
        var items = props.items || []
        if (items.length === 0) {
          return h('div', { className: 'ais-empty-board' }, t(board === 'all' ? 'browseNoResults' : 'emptyBoard'))
        }
        if (board === 'image') {
          return h(
            'div',
            { className: 'ais-image-grid' },
            items.map(function (item, index) {
              return h(ImageCard, { key: item.url + '#' + index, t: t, item: item })
            }),
          )
        }
        if (board === 'all') {
          var officialItems = items.filter(function (item) {
            return item.official === true
          })
          var restItems = items.filter(function (item) {
            return item.official !== true
          })
          var groups = ['article', 'video', 'image'].map(function (kind) {
            var group = restItems.filter(function (item) {
              return item.kind === kind
            })
            if (group.length === 0) return null
            return h(
              'section',
              { className: 'ais-group', key: 'group-' + kind },
              h(
                'div',
                { className: 'ais-group-head' },
                h('span', { className: 'ais-group-title' }, t(KIND_LABELS[kind])),
                h('span', { className: 'ais-group-count' }, format(t('groupHeading'), { name: '', n: group.length }).replace(/^\s*·\s*/, '')),
              ),
              kind === 'image'
                ? h(
                    'div',
                    { className: 'ais-image-grid' },
                    group.map(function (item, index) {
                      return h(ImageCard, { key: item.url + '#' + index, t: t, item: item })
                    }),
                  )
                : h(
                    'div',
                    { className: 'ais-feed' },
                    group.map(function (item, index) {
                      return h(FeedCard, { key: item.url + '#' + index, t: t, item: item })
                    }),
                  ),
            )
          })
          return h(
            React.Fragment,
            null,
            officialItems.length > 0
              ? h(
                  'section',
                  { className: 'ais-group', key: 'group-official' },
                  h(
                    'div',
                    { className: 'ais-group-head' },
                    h('span', { className: 'ais-group-title' }, t('officialSectionTitle')),
                    h('span', { className: 'ais-group-count' }, String(officialItems.length)),
                  ),
                  h(
                    'div',
                    { className: 'ais-feed' },
                    officialItems.map(function (item, index) {
                      return h(FeedCard, { key: item.url + '#' + index, t: t, item: item })
                    }),
                  ),
                )
              : null,
            groups,
          )
        }
        return h(
          'div',
          { className: 'ais-feed' },
          items.map(function (item, index) {
            return h(FeedCard, { key: item.url + '#' + index, t: t, item: item })
          }),
        )
      }

      function BrowseView(props) {
        var t = props.t
        var result = props.result
        var board = props.board
        var items = (result.boards && result.boards[board]) || []
        var counts = {}
        for (const key of BOARDS) counts[key] = ((result.boards && result.boards[key]) || []).length
        var weights = percentWeights(result.weights || { relevance: 0, timeliness: 0, heat: 0 })
        var hasMore = result.hasMore === true
        return h(
          'div',
          { className: 'ais-section' },
          h(
            'div',
            { className: 'ais-browse-bar' },
            h('span', { className: 'ais-browse-bar-label' }, t('weightsTitle')),
            h('span', null, format(t('weightPercent'), { name: t('weightRelevance'), n: weights.relevance })),
            h('span', null, format(t('weightPercent'), { name: t('weightTimeliness'), n: weights.timeliness })),
            h('span', null, format(t('weightPercent'), { name: t('weightHeat'), n: weights.heat })),
            result.ai ? h('span', { className: 'ais-tag ais-tag-ai' }, t('aiScored')) : h('span', { className: 'ais-tag ais-tag-warn' }, t('heuristicScored')),
            h('span', { className: 'ais-tag' }, t('browseHint')),
          ),
          h(BoardTabs, { t: t, board: board, counts: counts, onChange: props.onBoardChange }),
          h(BrowseBoardContent, { t: t, board: board, items: items }),
          props.loadingMore
            ? h('div', { className: 'ais-more-note' }, t('loadingNext'))
            : hasMore
              ? h('button', { type: 'button', className: 'ais-more', onClick: props.onNextPage }, t('nextPage'), h(ChevronGlyph, { down: true }))
              : h('div', { className: 'ais-more-note' }, items.length === 0 ? t('browseNoResults') : t('noMore')),
          props.nextError ? h('div', { className: 'ais-alert' }, h(WarnGlyph, { size: 14 }), h('span', null, props.nextError)) : null,
          h('div', { className: 'ais-more-note' }, format(t('pageCount'), { n: result.page || 1 })),
          h(RemovedPanel, { t: t, removed: result.removed || [], open: props.removedOpen, onToggle: props.onRemovedToggle }),
        )
      }

      // ------------------------------------------------------------------
      // 搜索页
      // ------------------------------------------------------------------
      function mergeBrowseResults(previous, next) {
        if (previous === null) return next
        var seen = new Set()
        var mergedItems = []
        function pushAll(list) {
          for (const item of list || []) {
            if (seen.has(item.url)) continue
            seen.add(item.url)
            mergedItems.push(item)
          }
        }
        pushAll(previous.items)
        pushAll(next.items)
        var boards = {}
        for (const key of BOARDS) {
          var boardSeen = new Set()
          var merged = []
          var sources = [].concat(previous.boards && previous.boards[key] ? previous.boards[key] : [], next.boards && next.boards[key] ? next.boards[key] : [])
          for (const item of sources) {
            if (boardSeen.has(item.url)) continue
            boardSeen.add(item.url)
            merged.push(item)
          }
          boards[key] = merged
        }
        var removed = []
        var removedSeen = new Set()
        for (const entry of [].concat(previous.removed || [], next.removed || [])) {
          var key = entry.url + '|' + entry.reason
          if (removedSeen.has(key)) continue
          removedSeen.add(key)
          removed.push(entry)
        }
        var stats = {
          raw: (previous.stats && previous.stats.raw ? previous.stats.raw : 0) + (next.stats && next.stats.raw ? next.stats.raw : 0),
          kept: (previous.stats && previous.stats.kept ? previous.stats.kept : 0) + (next.stats && next.stats.kept ? next.stats.kept : 0),
          removed: removed.length,
          fetched: (previous.stats && previous.stats.fetched ? previous.stats.fetched : 0) + (next.stats && next.stats.fetched ? next.stats.fetched : 0),
          elapsedMs: (previous.stats && previous.stats.elapsedMs ? previous.stats.elapsedMs : 0) + (next.stats && next.stats.elapsedMs ? next.stats.elapsedMs : 0),
          page: next.page,
        }
        return {
          ...next,
          items: mergedItems,
          boards: boards,
          removed: removed,
          stats: stats,
          page: next.page,
          hasMore: next.hasMore === true,
          aiModel: next.aiModel || previous.aiModel,
        }
      }

      function collectSeenUrls(result) {
        var seen = new Set()
        function add(list) {
          for (const item of list || []) if (item && typeof item.url === 'string') seen.add(item.url)
        }
        add(result.items)
        if (result.boards) for (const key of BOARDS) add(result.boards[key])
        return [...seen]
      }

      /** 统一的引擎图标：内置用 24×24 单色路径，自定义引擎用首字母方块。 */
      function EngineGlyph(props) {
        var id = props && props.id
        var size = (props && props.size) || 18
        if (id === 'ai') return h(SearchGlyph, { size: size })
        var path = ENGINE_ICON_PATHS[id]
        if (path !== undefined) {
          return h(
            'svg',
            {
              width: size,
              height: size,
              viewBox: '0 0 24 24',
              fill: 'currentColor',
              fillRule: ENGINE_ICON_FILL_RULES[id] || 'nonzero',
              'aria-hidden': 'true',
              focusable: 'false',
            },
            h('path', { d: path }),
          )
        }
        var letter = props && props.letter ? String(props.letter) : '?'
        return h('span', { className: 'ais-rail-letter' }, letter.slice(0, 2))
      }

      /** 侧边栏左侧的搜索引擎竖排按钮（只在更好的侧边栏页签里显示）。 */
      function EngineRail(props) {
        var t = props.t
        var engine = props.engine
        var bumpState = React.useState(0)
        var bump = bumpState[1]
        React.useEffect(function () {
          return subscribeCustomEngines(function () {
            bump(function (value) {
              return value + 1
            })
          })
        }, [])
        var entries = []
        for (var index = 0; index < ENGINES.length; index += 1) {
          entries.push({ id: ENGINES[index].id, label: t(ENGINES[index].label) })
        }
        for (var at = 0; at < CUSTOM_ENGINES.length; at += 1) {
          entries.push({ id: 'custom:' + CUSTOM_ENGINES[at].id, label: CUSTOM_ENGINES[at].name, custom: true })
        }
        return h(
          'nav',
          { className: 'ais-rail', 'aria-label': t('engineRailLabel') },
          entries.map(function (entry) {
            var active = engine === entry.id
            return h(
              'button',
              {
                key: entry.id,
                type: 'button',
                className: 'ais-rail-btn' + (active ? ' is-active' : ''),
                'aria-pressed': active ? 'true' : 'false',
                title: entry.label,
                onClick: function () {
                  props.onChange(entry.id)
                },
              },
              h('span', { className: 'ais-rail-icon' }, h(EngineGlyph, { id: entry.custom === true ? entry.id : entry.id, size: 18, letter: entry.label })),
              h('span', { className: 'ais-rail-label' }, entry.label),
            )
          }),
        )
      }

      /** 宿主右侧栏页签的实体：把该页签的唯一 id 交给搜索页，多开时互不干扰。 */
      function NativeAiSearchBody(props) {
        var info = null
        try {
          info = props !== undefined && props !== null && typeof props.useTabInfo === 'function' ? props.useTabInfo() : null
        } catch (hookError) {
          info = null
        }
        var tabId =
          info !== null && info !== undefined && info.tab !== undefined && info.tab !== null && typeof info.tab.id === 'string' ? info.tab.id : NS
        return h(SearchPage, { embedded: true, instanceId: 'native:' + tabId })
      }

      /** 原生页签的 guide 图标（宿主以函数形式渲染）。 */
      function NativeGuideIcon(props) {
        return h(SearchGlyph, { size: (props && props.size) || 16 })
      }

      function SearchPage(props) {
        var locale = props && props.locale
        var embedded = props !== undefined && props !== null && props.embedded === true
        /** 页面实例标识：主面板固定 'main'，更好的侧边栏里每个页签用 tab.id（互不干扰）。 */
        var instanceId =
          props !== undefined && props !== null && typeof props.instanceId === 'string' && props.instanceId !== '' ? props.instanceId : 'main'
        var localized = useLocale(locale)
        var t = localized.t
        var lang = localized.lang
        var restore = PRESERVE_STATE === true && LAST_SEARCH_STATES[instanceId] !== undefined ? LAST_SEARCH_STATES[instanceId] : null
        var draftState = React.useState(restore === null ? '' : restore.draft || '')
        var draft = draftState[0]
        var setDraft = draftState[1]
        var modeState = React.useState(restore === null ? 'qa' : restore.mode || 'qa')
        var mode = modeState[0]
        var setMode = modeState[1]
        var statusState = React.useState(restore === null ? 'idle' : restore.status === 'loading' ? 'idle' : restore.status || 'idle')
        var status = statusState[0]
        var setStatus = statusState[1]
        var resultState = React.useState(restore === null ? null : restore.result || null)
        var result = resultState[0]
        var setResult = resultState[1]
        var coverRequestedRef = React.useRef({})
        var errorState = React.useState(restore === null ? '' : restore.error || '')
        var error = errorState[0]
        var setError = errorState[1]
        var stageState = React.useState(0)
        var stage = stageState[0]
        var setStage = stageState[1]
        var copiedState = React.useState(false)
        var copied = copiedState[0]
        var setCopied = copiedState[1]
        var removedOpenState = React.useState(false)
        var removedOpen = removedOpenState[0]
        var setRemovedOpen = removedOpenState[1]
        var sourcesOpenState = React.useState(false)
        var sourcesOpen = sourcesOpenState[0]
        var setSourcesOpen = sourcesOpenState[1]
        var historyState = React.useState([])
        var historyItems = historyState[0]
        var setHistoryItems = historyState[1]
        var boardState = React.useState(restore === null ? 'all' : restore.board || 'all')
        var board = boardState[0]
        var setBoard = boardState[1]
        var nextLoadingState = React.useState(false)
        var nextLoading = nextLoadingState[0]
        var setNextLoading = nextLoadingState[1]
        var nextErrorState = React.useState('')
        var nextError = nextErrorState[0]
        var setNextError = nextErrorState[1]
        var engineState = React.useState(embedded ? DEFAULT_ENGINE : 'ai')
        var engine = engineState[0]
        var setEngine = engineState[1]
        var showModes = engine === 'ai'
        var requestRef = React.useRef(null)
        var timerRef = React.useRef(null)
        var mountedRef = React.useRef(true)
        var lastQueryRef = React.useRef('')
        var lastModeRef = React.useRef('qa')

        React.useEffect(function () {
          return function () {
            mountedRef.current = false
            if (timerRef.current !== null) {
              clearInterval(timerRef.current)
              timerRef.current = null
            }
            if (requestRef.current !== null) {
              try {
                requestRef.current.abort()
              } catch (abortError) {
                /* 忽略 */
              }
              requestRef.current = null
            }
          }
        }, [])

        // 面板卸载（切到对话/工作区）后仍保留当前结果与板块，回来时恢复；
        // 加载中的中间态不覆盖快照，避免回来看到永远加载中的页面。
        React.useEffect(
          function () {
            if (PRESERVE_STATE !== true) {
              LAST_SEARCH_STATES = {}
              return
            }
            if (status === 'loading') return
            LAST_SEARCH_STATES[instanceId] = { draft: draft, mode: mode, status: status, result: result, error: error, board: board }
          },
          [draft, mode, status, result, error, board, instanceId],
        )

        // 视频封面懒补齐：首屏批量抓取可能被限流，渲染后对缺图视频逐条补一次，
        // 保证同站视频最终都有封面（拿不到才保持纯文字卡片）。
        React.useEffect(
          function () {
            if (result === null || result.mode !== 'browse') return undefined
            var missing = (result.items || [])
              .filter(function (item) {
                return item.kind === 'video' && item.thumbnail === '' && coverRequestedRef.current[item.url] !== true
              })
              .slice(0, 12)
            if (missing.length === 0) return undefined
            var cancelled = false
            Promise.resolve().then(async function () {
              for (var index = 0; index < missing.length; index += 1) {
                if (cancelled || !mountedRef.current) return
                var target = missing[index]
                coverRequestedRef.current[target.url] = true
                var cover = ''
                for (var attempt = 0; attempt < 2 && cover === ''; attempt += 1) {
                  if (cancelled || !mountedRef.current) return
                  try {
                    var payload = await requestJson('/cover', { method: 'POST', body: { url: target.url } })
                    cover = payload && typeof payload.thumbnail === 'string' ? payload.thumbnail : ''
                  } catch (coverError) {
                    cover = ''
                  }
                  if (cover === '' && attempt === 0) {
                    await new Promise(function (resolve) {
                      setTimeout(resolve, 800)
                    })
                  }
                }
                // Host 侧被限流时，B 站封面改用浏览器直连公开接口再试一次（不经过搜索代理）。
                if (cover === '' && /bilibili\.com/.test(target.url)) {
                  var bvidMatch = /\/video\/(BV[0-9A-Za-z]{10})/.exec(target.url) || /[?&]bvid=(BV[0-9A-Za-z]{10})/.exec(target.url)
                  if (bvidMatch !== null && typeof fetch === 'function') {
                    try {
                      var biliResponse = await fetch('https://api.bilibili.com/x/web-interface/view?bvid=' + bvidMatch[1], { credentials: 'omit' })
                      if (biliResponse.ok) {
                        var biliData = await biliResponse.json()
                        var pic = biliData && biliData.data ? biliData.data.pic : ''
                        if (typeof pic === 'string' && pic !== '') {
                          cover = pic.startsWith('//') ? 'https:' + pic : pic.replace(/^http:\/\//, 'https://')
                        }
                      }
                    } catch (directError) {
                      cover = ''
                    }
                  }
                }
                if (cancelled || !mountedRef.current || cover === '') continue
                setResult(function (previous) {
                  if (previous === null || previous.mode !== 'browse') return previous
                  function patch(list) {
                    return (list || []).map(function (item) {
                      return item.url === target.url ? { ...item, thumbnail: cover } : item
                    })
                  }
                  var nextBoards = {}
                  Object.keys(previous.boards || {}).forEach(function (key) {
                    nextBoards[key] = patch(previous.boards[key])
                  })
                  return { ...previous, items: patch(previous.items), boards: nextBoards }
                })
              }
            })
            return function () {
              cancelled = true
            }
          },
          [result],
        )

        var clearTimer = React.useCallback(function () {
          if (timerRef.current !== null) {
            clearInterval(timerRef.current)
            timerRef.current = null
          }
        }, [])

        var loadHistory = React.useCallback(function () {
          return requestJson('/history')
            .then(function (payload) {
              if (!mountedRef.current) return
              setHistoryItems(Array.isArray(payload.items) ? payload.items : [])
            })
            .catch(function () {
              /* 历史加载失败不影响搜索 */
            })
        }, [])

        React.useEffect(function () {
          void loadHistory()
          return undefined
        }, [loadHistory])

        var clearHistory = React.useCallback(function () {
          requestJson('/history', { method: 'POST', body: { action: 'clear' } })
            .then(function () {
              if (mountedRef.current) setHistoryItems([])
            })
            .catch(function () {
              /* 忽略 */
            })
        }, [])

        var abortCurrent = React.useCallback(
          function () {
            if (requestRef.current !== null) {
              try {
                requestRef.current.abort()
              } catch (abortError) {
                /* 忽略 */
              }
              requestRef.current = null
            }
            clearTimer()
          },
          [clearTimer],
        )

        var newSearch = React.useCallback(
          function () {
            abortCurrent()
            setStatus('idle')
            setResult(null)
            setError('')
            setNextError('')
            void loadHistory()
          },
          [abortCurrent, loadHistory],
        )

        var runSearch = React.useCallback(
          function (rawQuery, nextMode) {
            var query = String(rawQuery === undefined ? draft : rawQuery).trim()
            var activeMode = MODES.indexOf(nextMode) === -1 ? mode : nextMode
            if (query === '') {
              setError(t('emptyQuery'))
              setStatus('error')
              return
            }
            abortCurrent()
            lastQueryRef.current = query
            lastModeRef.current = activeMode
            setDraft(query)
            if (activeMode !== mode) setMode(activeMode)
            setStatus('loading')
            setStage(0)
            setError('')
            setResult(null)
            setCopied(false)
            setRemovedOpen(false)
            setSourcesOpen(false)
            setBoard('all')
            setNextError('')
            setNextLoading(false)
            var controller = new AbortController()
            requestRef.current = controller
            var startedAt = Date.now()
            timerRef.current = setInterval(function () {
              var elapsed = Date.now() - startedAt
              if (!mountedRef.current) return
              setStage(elapsed < 2600 ? 0 : elapsed < 9000 ? 1 : elapsed < 17000 ? 2 : 3)
            }, 350)
            requestJson('/search', { method: 'POST', body: { query: query, mode: activeMode, uiLanguage: lang } })
              .then(function (payload) {
                if (!mountedRef.current) return
                setStage(3)
                setResult(payload)
                setStatus('ready')
                void loadHistory()
              })
              .catch(function (fetchError) {
                if (!mountedRef.current) return
                if (fetchError && fetchError.name === 'AbortError') {
                  setStatus('idle')
                  return
                }
                setError(fetchError && fetchError.message ? fetchError.message : String(fetchError))
                setStatus('error')
              })
              .then(function () {
                if (!mountedRef.current) return
                clearTimer()
                if (requestRef.current === controller) requestRef.current = null
              })
          },
          [draft, mode, t, lang, abortCurrent, clearTimer, loadHistory],
        )

        var cancelSearch = React.useCallback(
          function () {
            abortCurrent()
            setStatus('idle')
          },
          [abortCurrent],
        )

        var changeEngine = React.useCallback(function (next) {
          if (engineOf(next).id === engine) return
          setEngine(next)
          DEFAULT_ENGINE = next
          requestJson('/settings', { method: 'POST', body: { defaultEngine: next } }).catch(function () {
            /* 持久化失败不影响当前切换 */
          })
        }, [engine])

        var onSubmit = React.useCallback(
          function () {
            var current = engineOf(engine)
            if (current.id !== 'ai') {
              var query = String(draft === undefined ? '' : draft).trim()
              if (query === '') {
                setError(t('emptyQuery'))
                setStatus('error')
                return
              }
              setDraft(query)
              openUrl(engineSearchUrl(current, query))
              return
            }
            runSearch(draft, mode)
          },
          [runSearch, draft, mode, engine, t],
        )

        /** 嵌入更好的侧边栏时，页面外面包一层竖向搜索引擎栏。 */
        function withRail(core) {
          if (!embedded) return core
          return h(
            'div',
            { className: 'ais-embed' },
            h(EngineRail, { t: t, engine: engine, onChange: changeEngine }),
            h('div', { className: 'ais-embed-body' }, core),
          )
        }

        var onChip = React.useCallback(
          function (item) {
            setDraft(item)
            var current = engineOf(engine)
            if (current.id !== 'ai') {
              openUrl(engineSearchUrl(current, item))
              return
            }
            runSearch(item, mode)
          },
          [runSearch, mode, engine],
        )

        var onModeChange = React.useCallback(
          function (nextMode) {
            if (nextMode === mode) return
            abortCurrent()
            setMode(nextMode)
            setStatus('idle')
            setResult(null)
            setError('')
            setNextError('')
          },
          [mode, abortCurrent],
        )

        var onCopied = React.useCallback(function (ok) {
          setCopied(ok)
          if (ok) {
            setTimeout(function () {
              if (mountedRef.current) setCopied(false)
            }, 2200)
          }
        }, [])

        var retry = React.useCallback(
          function () {
            runSearch(lastQueryRef.current || draft, lastModeRef.current || mode)
          },
          [runSearch, draft, mode],
        )

        var onNextPage = React.useCallback(
          function () {
            if (nextLoading === true || result === null || result.mode !== 'browse' || result.hasMore !== true) return
            var exclude = collectSeenUrls(result)
            setNextLoading(true)
            setNextError('')
            requestJson('/search', {
              method: 'POST',
              body: { query: result.query, mode: 'browse', page: (result.page || 1) + 1, exclude: exclude, uiLanguage: lang },
            })
              .then(function (payload) {
                if (!mountedRef.current) return
                setResult(function (previous) {
                  return mergeBrowseResults(previous, payload)
                })
                setNextLoading(false)
              })
              .catch(function (fetchError) {
                if (!mountedRef.current) return
                setNextLoading(false)
                setNextError(fetchError && fetchError.message ? fetchError.message : String(fetchError))
              })
          },
          [nextLoading, result, lang],
        )

        var suggestions = SUGGESTIONS[lang] || SUGGESTIONS.zh
        var loading = status === 'loading'
        var searchBar = h(SearchBar, { t: t, value: draft, loading: loading, onChange: setDraft, onSubmit: onSubmit, onCancel: cancelSearch })
        var modeTabs = showModes ? h(ModeTabs, { t: t, mode: mode, onChange: onModeChange }) : null

        if (status === 'idle') {
          return withRail(
            h(
              'div',
              { className: 'ais-page' },
              h(
                'div',
                { className: 'ais-hero' },
                h('div', { className: 'ais-hero-logo' }, h(SearchGlyph, { size: 28 })),
                h('h1', { className: 'ais-hero-title' }, t('title')),
                modeTabs,
                h('div', { className: 'ais-hero-search' }, searchBar),
                historyItems.length > 0
                  ? h(
                      'div',
                      { className: 'ais-hero-history' },
                      h('span', { className: 'ais-history-label' }, t('historyTitle')),
                      h(
                        'div',
                        { className: 'ais-hero-chips' },
                        historyItems.slice(0, 6).map(function (entry) {
                          return h(
                            'button',
                            {
                              key: entry.query,
                              type: 'button',
                              className: 'ais-chip',
                              title: entry.at ? entry.query + ' · ' + htmlTime(entry.at) : entry.query,
                              onClick: function () {
                                onChip(entry.query)
                              },
                            },
                            entry.query,
                          )
                        }),
                      ),
                      h('button', { type: 'button', className: 'ais-history-clear', onClick: clearHistory }, t('historyClear')),
                    )
                  : h('div', { className: 'ais-hero-chips' }, h(SuggestionList, { t: t, items: suggestions, onPick: onChip })),
              ),
            ),
          )
        }

        var content = null
        if (loading) content = h(LoadingView, { t: t, stage: stage, mode: mode })
        else if (status === 'error') content = h(ErrorView, { t: t, message: error, onRetry: retry })
        else if (status === 'ready' && result !== null) {
          if (result.mode === 'encyclopedia') {
            content = h(EncyclopediaView, {
              t: t,
              result: result,
              copied: copied,
              onCopied: onCopied,
              removedOpen: removedOpen,
              onRemovedToggle: function () {
                setRemovedOpen(function (value) {
                  return !value
                })
              },
              sourcesOpen: sourcesOpen,
              onSourcesToggle: function () {
                setSourcesOpen(function (value) {
                  return !value
                })
              },
            })
          } else if (result.mode === 'browse') {
            content = h(BrowseView, {
              t: t,
              result: result,
              board: board,
              onBoardChange: setBoard,
              loadingMore: nextLoading,
              nextError: nextError,
              onNextPage: onNextPage,
              removedOpen: removedOpen,
              onRemovedToggle: function () {
                setRemovedOpen(function (value) {
                  return !value
                })
              },
            })
          } else {
            content = h(QaResultView, {
              t: t,
              result: result,
              copied: copied,
              onCopied: onCopied,
              removedOpen: removedOpen,
              onRemovedToggle: function () {
                setRemovedOpen(function (value) {
                  return !value
                })
              },
              sourcesOpen: sourcesOpen,
              onSourcesToggle: function () {
                setSourcesOpen(function (value) {
                  return !value
                })
              },
            })
          }
        }

        return withRail(
          h(
            'div',
            { className: 'ais-page' },
            h(
              'div',
              { className: 'ais-inner' },
              h(
                'header',
                { className: 'ais-head' },
                h('div', { className: 'ais-logo' }, h(SearchGlyph, { size: 17 })),
                h('h1', { className: 'ais-title' }, t('title')),
                h('button', { type: 'button', className: 'ais-ghost ais-head-action', onClick: newSearch }, t('newSearch')),
              ),
              showModes ? h('div', { className: 'ais-mode-bar' }, modeTabs) : null,
              searchBar,
              content,
            ),
          ),
        )
      }

      /** 左侧栏图标：只用 currentColor，选中态由宿主的按钮样式负责。 */
      function PanelIcon(props) {
        var size = props && typeof props.size === 'number' ? props.size : 16
        return h(
          'span',
          { style: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size } },
          h(SearchGlyph, { size: size }),
        )
      }

      // ------------------------------------------------------------------
      // 设置页：结果语言 / 百科档位 / 浏览权重 / 搜索历史
      // ------------------------------------------------------------------
      // ------------------------------------------------------------------
      // 官网映射导入：CSV / XLSX（浏览器端解析，不依赖第三方库）
      // ------------------------------------------------------------------
      function xmlDecodeText(value) {
        return String(value === undefined || value === null ? '' : value)
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'")
          .replace(/&#(\d+);/g, function (match, code) {
            return String.fromCharCode(Number(code))
          })
          .replace(/&#x([0-9a-f]+);/gi, function (match, code) {
            return String.fromCharCode(Number.parseInt(code, 16))
          })
          .replace(/&amp;/g, '&')
      }

      function splitSheetLine(line) {
        var cells = []
        var current = ''
        var quoted = false
        for (var index = 0; index < line.length; index += 1) {
          var ch = line[index]
          if (quoted) {
            if (ch === '"') {
              if (line[index + 1] === '"') {
                current += '"'
                index += 1
              } else {
                quoted = false
              }
            } else {
              current += ch
            }
          } else if (ch === '"') {
            quoted = true
          } else if (ch === ',' || ch === '\t') {
            cells.push(current)
            current = ''
          } else {
            current += ch
          }
        }
        cells.push(current)
        return cells
      }

      /** 行数组 → [{ name, aliases, homepage }]；首行是表头时跳过。 */
      function rowsToOfficialSheet(rows) {
        var list = Array.isArray(rows) ? rows : []
        var start = 0
        if (list.length > 0) {
          var header = (list[0] || []).map(function (cell) {
            return String(cell || '').trim().toLowerCase()
          })
          var looksLikeHeader = header.some(function (cell) {
            return cell.indexOf('品牌') >= 0 || cell.indexOf('名称') >= 0 || cell.indexOf('name') >= 0 || cell.indexOf('官网') >= 0 || cell.indexOf('homepage') >= 0
          })
          if (looksLikeHeader) start = 1
        }
        var out = []
        for (var index = start; index < list.length; index += 1) {
          var row = list[index] || []
          var name = String(row[0] === undefined ? '' : row[0]).trim()
          if (name === '') continue
          var aliases = String(row[1] === undefined ? '' : row[1])
            .split(/[,，、;；]/)
            .map(function (entry) {
              return entry.trim()
            })
            .filter(function (entry) {
              return entry !== ''
            })
          var homepage = String(row[2] === undefined ? '' : row[2]).trim()
          if (!/^https?:\/\//i.test(homepage)) continue
          try {
            var parsed = new URL(homepage)
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') continue
          } catch (parseError) {
            continue
          }
          out.push({ name: name, aliases: aliases, homepage: homepage })
        }
        return out
      }

      /** 解析 CSV / TSV 文本。 */
      function parseOfficialSheetCsv(text) {
        var clean = String(text === undefined || text === null ? '' : text).replace(/^\uFEFF/, '')
        var rows = clean
          .split(/\r?\n/)
          .filter(function (line) {
            return line.trim() !== ''
          })
          .map(splitSheetLine)
        return rowsToOfficialSheet(rows)
      }

      /** deflate-raw 解压（xlsx 内部是 zip，条目多为 deflate）。 */
      async function inflateRawBytes(bytes) {
        if (typeof DecompressionStream !== 'function') throw new Error('当前环境不支持解压 xlsx，请另存为 CSV 再导入')
        var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
        var buffer = await new Response(stream).arrayBuffer()
        return new Uint8Array(buffer)
      }

      /** 读取 zip（xlsx）内部条目：name → Uint8Array。 */
      async function readZipEntries(buffer) {
        var view = new DataView(buffer)
        var bytes = new Uint8Array(buffer)
        var eocd = -1
        var minOffset = Math.max(0, bytes.length - 22 - 65535)
        for (var index = bytes.length - 22; index >= minOffset; index -= 1) {
          if (view.getUint32(index, true) === 0x06054b50) {
            eocd = index
            break
          }
        }
        if (eocd < 0) throw new Error('不是有效的 xlsx 文件')
        var count = view.getUint16(eocd + 10, true)
        var centralOffset = view.getUint32(eocd + 16, true)
        var entries = {}
        var pointer = centralOffset
        for (var entryIndex = 0; entryIndex < count; entryIndex += 1) {
          if (view.getUint32(pointer, true) !== 0x02014b50) break
          var method = view.getUint16(pointer + 10, true)
          var compressedSize = view.getUint32(pointer + 20, true)
          var nameLength = view.getUint16(pointer + 28, true)
          var extraLength = view.getUint16(pointer + 30, true)
          var commentLength = view.getUint16(pointer + 32, true)
          var localOffset = view.getUint32(pointer + 42, true)
          var name = new TextDecoder().decode(bytes.slice(pointer + 46, pointer + 46 + nameLength))
          var localNameLength = view.getUint16(localOffset + 26, true)
          var localExtraLength = view.getUint16(localOffset + 28, true)
          var dataStart = localOffset + 30 + localNameLength + localExtraLength
          var data = bytes.slice(dataStart, dataStart + compressedSize)
          if (method === 0) entries[name] = data
          else if (method === 8) entries[name] = await inflateRawBytes(data)
          pointer += 46 + nameLength + extraLength + commentLength
        }
        return entries
      }

      /** 解析 xlsx：取第一个工作表，转成行数组后复用 CSV 的列映射。 */
      async function parseOfficialSheetXlsx(buffer) {
        var entries = await readZipEntries(buffer)
        var decoder = new TextDecoder()
        var shared = []
        if (entries['xl/sharedStrings.xml'] !== undefined) {
          var sharedXml = decoder.decode(entries['xl/sharedStrings.xml'])
          var sharedItems = sharedXml.match(/<si>[\s\S]*?<\/si>/g) || []
          sharedItems.forEach(function (item) {
            var parts = item.match(/<t[^>]*>[\s\S]*?<\/t>/g) || []
            shared.push(
              parts
                .map(function (part) {
                  return xmlDecodeText(part.replace(/<[^>]+>/g, ''))
                })
                .join(''),
            )
          })
        }
        var sheetKey = Object.keys(entries)
          .filter(function (key) {
            return /^xl\/worksheets\/sheet\d+\.xml$/.test(key)
          })
          .sort()[0]
        if (sheetKey === undefined) throw new Error('xlsx 里没有工作表')
        var sheetXml = decoder.decode(entries[sheetKey])
        var rows = []
        var rowItems = sheetXml.match(/<row[^>]*>[\s\S]*?<\/row>/g) || []
        rowItems.forEach(function (rowXml) {
          var cells = {}
          var cellRegex = /<c([^>]*)>([\s\S]*?)<\/c>/g
          var match = cellRegex.exec(rowXml)
          while (match !== null) {
            var attrs = match[1]
            var inner = match[2]
            var refMatch = /r="([A-Z]+)\d+"/.exec(attrs)
            if (refMatch !== null) {
              var column = 0
              var letters = refMatch[1]
              for (var letterIndex = 0; letterIndex < letters.length; letterIndex += 1) {
                column = column * 26 + (letters.charCodeAt(letterIndex) - 64)
              }
              var typeMatch = /t="([^"]+)"/.exec(attrs)
              var type = typeMatch === null ? '' : typeMatch[1]
              var value = ''
              if (type === 's') {
                var sharedValue = /<v>([\s\S]*?)<\/v>/.exec(inner)
                if (sharedValue !== null) value = shared[Number(sharedValue[1])] || ''
              } else if (type === 'inlineStr') {
                var parts = inner.match(/<t[^>]*>[\s\S]*?<\/t>/g) || []
                value = parts
                  .map(function (part) {
                    return xmlDecodeText(part.replace(/<[^>]+>/g, ''))
                  })
                  .join('')
              } else {
                var rawValue = /<v>([\s\S]*?)<\/v>/.exec(inner)
                value = rawValue === null ? '' : xmlDecodeText(rawValue[1])
              }
              cells[column - 1] = value.trim()
            }
            match = cellRegex.exec(rowXml)
          }
          var maxIndex = -1
          Object.keys(cells).forEach(function (key) {
            maxIndex = Math.max(maxIndex, Number(key))
          })
          var row = []
          for (var cellIndex = 0; cellIndex <= maxIndex; cellIndex += 1) row.push(cells[cellIndex] === undefined ? '' : cells[cellIndex])
          rows.push(row)
        })
        return rowsToOfficialSheet(rows)
      }

      // ------------------------------------------------------------------
      // 设置导航图标：settings.section 契约没有 icon 字段，只能给导航行打标记，
      // 由 CSS mask 替换成放大镜（与 dsh-better-sidebar 同款适配）。
      // ------------------------------------------------------------------
      var SETTINGS_NAV_MARKER = 'data-dsh-ai-search-settings-nav'

      function registerSettingsNavIcon(labelGetter) {
        if (typeof document === 'undefined' || typeof MutationObserver !== 'function') return function () {}
        var disposed = false
        var frame = null
        function sync() {
          if (disposed) return
          var label = typeof labelGetter === 'function' ? String(labelGetter() || '').trim() : ''
          var buttons = document.querySelectorAll('[role="dialog"] nav button')
          for (var index = 0; index < buttons.length; index += 1) {
            var button = buttons[index]
            if (label !== '' && String(button.textContent || '').trim() === label) button.setAttribute(SETTINGS_NAV_MARKER, '')
            else button.removeAttribute(SETTINGS_NAV_MARKER)
          }
        }
        function schedule() {
          if (disposed || frame !== null || typeof requestAnimationFrame !== 'function') return
          frame = requestAnimationFrame(function () {
            frame = null
            sync()
          })
        }
        sync()
        var observer = new MutationObserver(schedule)
        observer.observe(document.body, { childList: true, subtree: true })
        return function () {
          disposed = true
          observer.disconnect()
          if (frame !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame)
          frame = null
          var marked = document.querySelectorAll('[' + SETTINGS_NAV_MARKER + ']')
          for (var index = 0; index < marked.length; index += 1) marked[index].removeAttribute(SETTINGS_NAV_MARKER)
        }
      }

      /** 把服务端返回的 customApi 归一化成设置页状态（字段缺失时给默认值）。 */
      function normalizeApiSnapshot(value) {
        var raw = value !== null && typeof value === 'object' ? value : {}
        var search = raw.search !== null && typeof raw.search === 'object' ? raw.search : {}
        var thinking = raw.thinking !== null && typeof raw.thinking === 'object' ? raw.thinking : {}
        return {
          search: {
            mode: search.mode === 'custom' ? 'custom' : 'harness',
            provider: typeof search.provider === 'string' ? search.provider : 'tavily',
            baseUrl: typeof search.baseUrl === 'string' ? search.baseUrl : '',
            apiKey: typeof search.apiKey === 'string' ? search.apiKey : '',
          },
          thinking: {
            mode: thinking.mode === 'custom' ? 'custom' : 'harness',
            baseUrl: typeof thinking.baseUrl === 'string' ? thinking.baseUrl : '',
            apiKey: typeof thinking.apiKey === 'string' ? thinking.apiKey : '',
            model: typeof thinking.model === 'string' ? thinking.model : '',
            reasoningEffort: ['auto', 'low', 'medium', 'high'].indexOf(thinking.reasoningEffort) >= 0 ? thinking.reasoningEffort : 'auto',
          },
        }
      }

      function SettingsPage(props) {
        var locale = props && props.locale
        var localized = useLocale(locale)
        var t = localized.t
        var state = React.useState({
          loading: true,
          language: 'auto',
          encyclopediaDetail: 'standard',
          browseWeights: { relevance: 40, timeliness: 30, heat: 30 },
          preserveState: true,
          betterSidebar: true,
          openLinksInSidebar: true,
          defaultEngine: 'ai',
          customEngines: [],
          customName: '',
          customUrl: '',
          customError: '',
          customOfficialSites: [],
          customSiteName: '',
          customSiteAliases: '',
          customSiteHomepage: '',
          customSiteError: '',
          importMessage: '',
          importError: '',
          customApi: normalizeApiSnapshot(null),
          apiSaving: false,
          apiMessage: '',
          apiError: '',
          saving: false,
          saved: false,
          error: '',
        })
        var settings = state[0]
        var setSettings = state[1]
        var historyState = React.useState({ count: 0, cleared: false, clearing: false })
        var historyInfo = historyState[0]
        var setHistoryInfo = historyState[1]
        var aliveRef = React.useRef(true)
        var saveSeqRef = React.useRef(0)
        var weightsTimerRef = React.useRef(null)
        var loadedRef = React.useRef(false)
        var importInputRef = React.useRef(null)

        React.useEffect(function () {
          aliveRef.current = true
          requestJson('/settings')
            .then(function (payload) {
              if (!aliveRef.current) return
              var next = payload.settings || {}
              loadedRef.current = true
              PRESERVE_STATE = next.preserveState !== false
              ADAPT = next.betterSidebar !== false
              OPEN_IN_SIDEBAR = next.openLinksInSidebar !== false
              DEFAULT_ENGINE = next.defaultEngine || 'ai'
              setCustomEngines(Array.isArray(next.customEngines) ? next.customEngines : [])
              setSettings(function (previous) {
                return {
                  ...previous,
                  loading: false,
                  language: next.language || 'auto',
                  encyclopediaDetail: next.encyclopediaDetail || 'standard',
                  browseWeights: next.browseWeights || previous.browseWeights,
                  preserveState: next.preserveState !== false,
                  betterSidebar: next.betterSidebar !== false,
                  openLinksInSidebar: next.openLinksInSidebar !== false,
                  defaultEngine: next.defaultEngine || 'ai',
                  customEngines: Array.isArray(next.customEngines) ? next.customEngines : [],
                  customOfficialSites: Array.isArray(next.customOfficialSites) ? next.customOfficialSites : [],
                  customApi: normalizeApiSnapshot(next.customApi),
                }
              })
            })
            .catch(function () {
              if (!aliveRef.current) return
              setSettings(function (previous) {
                return { ...previous, loading: false, error: 'loadFailed' }
              })
            })
          requestJson('/history')
            .then(function (payload) {
              if (!aliveRef.current) return
              var items = payload && Array.isArray(payload.items) ? payload.items : []
              setHistoryInfo(function (previous) {
                return { ...previous, count: items.length }
              })
            })
            .catch(function () {
              /* 忽略 */
            })
          return function () {
            aliveRef.current = false
            if (weightsTimerRef.current !== null) clearTimeout(weightsTimerRef.current)
          }
        }, [])

        var save = React.useCallback(function (patch) {
          var seq = saveSeqRef.current + 1
          saveSeqRef.current = seq
          setSettings(function (previous) {
            return { ...previous, saving: true, saved: false, error: '' }
          })
          return requestJson('/settings', { method: 'POST', body: patch })
            .then(function (payload) {
              if (!aliveRef.current || saveSeqRef.current !== seq) return null
              if (payload && payload.settings) {
                DEFAULT_ENGINE = payload.settings.defaultEngine || DEFAULT_ENGINE
                setCustomEngines(Array.isArray(payload.settings.customEngines) ? payload.settings.customEngines : [])
              }
              setSettings(function (previous) {
                var next = { ...previous, saving: false, saved: true }
                if (payload && payload.settings) {
                  next.defaultEngine = payload.settings.defaultEngine || previous.defaultEngine
                  next.customEngines = Array.isArray(payload.settings.customEngines) ? payload.settings.customEngines : previous.customEngines
                  next.customOfficialSites = Array.isArray(payload.settings.customOfficialSites)
                    ? payload.settings.customOfficialSites
                    : previous.customOfficialSites
                  next.customApi = normalizeApiSnapshot(payload.settings.customApi)
                }
                return next
              })
              return payload
            })
            .catch(function (failure) {
              if (!aliveRef.current || saveSeqRef.current !== seq) return null
              setSettings(function (previous) {
                return { ...previous, saving: false, error: failure && failure.message ? failure.message : String(failure) }
              })
              return null
            })
        }, [])

        var chooseLanguage = React.useCallback(
          function (language) {
            if (language === settings.language) return
            setSettings(function (previous) {
              return { ...previous, language: language }
            })
            save({ language: language })
          },
          [settings.language, save],
        )

        var chooseDetail = React.useCallback(
          function (detail) {
            if (detail === settings.encyclopediaDetail) return
            setSettings(function (previous) {
              return { ...previous, encyclopediaDetail: detail }
            })
            save({ encyclopediaDetail: detail })
          },
          [settings.encyclopediaDetail, save],
        )

        var changeWeight = React.useCallback(function (key, value) {
          var numeric = Math.max(0, Math.min(100, Math.round(Number(value) || 0)))
          setSettings(function (previous) {
            var weights = { ...previous.browseWeights, [key]: numeric }
            return { ...previous, browseWeights: weights }
          })
        }, [])

        var choosePreserve = React.useCallback(
          function (next) {
            setSettings(function (previous) {
              return { ...previous, preserveState: next }
            })
            PRESERVE_STATE = next
            if (next === false) LAST_SEARCH_STATES = {}
            save({ preserveState: next })
          },
          [save],
        )

        var chooseBetterSidebar = React.useCallback(
          function (next) {
            setSettings(function (previous) {
              return { ...previous, betterSidebar: next }
            })
            ADAPT = next
            if (typeof NATIVE_SYNC === 'function') NATIVE_SYNC()
            save({ betterSidebar: next })
          },
          [save],
        )

        var chooseOpenLinks = React.useCallback(
          function (next) {
            setSettings(function (previous) {
              return { ...previous, openLinksInSidebar: next }
            })
            OPEN_IN_SIDEBAR = next
            save({ openLinksInSidebar: next })
          },
          [save],
        )

        var chooseEngine = React.useCallback(
          function (next) {
            setSettings(function (previous) {
              return { ...previous, defaultEngine: next }
            })
            DEFAULT_ENGINE = next
            save({ defaultEngine: next })
          },
          [save],
        )

        var addCustomEngine = React.useCallback(
          function () {
            var name = String(settings.customName || '').trim()
            var urlTemplate = String(settings.customUrl || '').trim()
            if (name === '' || urlTemplate.length < 12 || !/^https?:\/\//i.test(urlTemplate) || urlTemplate.indexOf(ENGINE_TOKEN) === -1) {
              setSettings(function (previous) {
                return { ...previous, customError: t('customEngineInvalid') }
              })
              return
            }
            var nextList = (settings.customEngines || []).concat([{ name: name, urlTemplate: urlTemplate }])
            setSettings(function (previous) {
              return { ...previous, customEngines: nextList, customName: '', customUrl: '', customError: '' }
            })
            setCustomEngines(nextList)
            save({ customEngines: nextList })
          },
          [settings.customEngines, settings.customName, settings.customUrl, save, t],
        )

        var removeCustomEngine = React.useCallback(
          function (engineId) {
            var nextList = (settings.customEngines || []).filter(function (entry) {
              return entry.id !== engineId
            })
            var patch = { customEngines: nextList }
            if (settings.defaultEngine === 'custom:' + engineId) patch.defaultEngine = 'ai'
            setSettings(function (previous) {
              var next = { ...previous, customEngines: nextList }
              if (next.defaultEngine === 'custom:' + engineId) next.defaultEngine = 'ai'
              return next
            })
            setCustomEngines(nextList)
            save(patch)
          },
          [settings.customEngines, settings.defaultEngine, save],
        )

        var addOfficialSite = React.useCallback(
          function () {
            var name = String(settings.customSiteName || '').trim()
            var homepage = String(settings.customSiteHomepage || '').trim()
            var aliases = String(settings.customSiteAliases || '')
              .split(/[,，、;；]/)
              .map(function (entry) {
                return entry.trim()
              })
              .filter(function (entry) {
                return entry !== ''
              })
            var validHomepage = false
            try {
              var parsed = new URL(homepage)
              validHomepage = parsed.protocol === 'http:' || parsed.protocol === 'https:'
            } catch (parseError) {
              validHomepage = false
            }
            if (name === '' || !validHomepage) {
              setSettings(function (previous) {
                return { ...previous, customSiteError: t('officialMapInvalid') }
              })
              return
            }
            var nextList = (settings.customOfficialSites || []).concat([{ name: name, aliases: aliases, homepage: homepage }])
            setSettings(function (previous) {
              return {
                ...previous,
                customOfficialSites: nextList,
                customSiteName: '',
                customSiteAliases: '',
                customSiteHomepage: '',
                customSiteError: '',
              }
            })
            save({ customOfficialSites: nextList })
          },
          [settings.customOfficialSites, settings.customSiteName, settings.customSiteAliases, settings.customSiteHomepage, save, t],
        )

        var removeOfficialSite = React.useCallback(
          function (homepage) {
            var nextList = (settings.customOfficialSites || []).filter(function (entry) {
              return entry.homepage !== homepage
            })
            setSettings(function (previous) {
              return { ...previous, customOfficialSites: nextList }
            })
            save({ customOfficialSites: nextList })
          },
          [settings.customOfficialSites, save],
        )

        var onImportOfficialFile = React.useCallback(
          function (event) {
            var input = event && event.target ? event.target : null
            var file = input && input.files && input.files.length > 0 ? input.files[0] : null
            if (!file) return
            var fileName = String(file.name || '').toLowerCase()
            var parsedPromise
            try {
              if (fileName.endsWith('.xlsx')) parsedPromise = file.arrayBuffer().then(parseOfficialSheetXlsx)
              else parsedPromise = file.text().then(parseOfficialSheetCsv)
            } catch (readError) {
              parsedPromise = Promise.reject(readError)
            }
            setSettings(function (previous) {
              return { ...previous, importMessage: '', importError: '' }
            })
            parsedPromise
              .then(function (rows) {
                var imported = Array.isArray(rows) ? rows : []
                if (imported.length === 0) {
                  setSettings(function (previous) {
                    return { ...previous, importError: t('officialMapImportEmpty') }
                  })
                  return
                }
                var currentList = settings.customOfficialSites || []
                var seen = {}
                currentList.forEach(function (entry) {
                  seen[String(entry.homepage || '').toLowerCase()] = true
                })
                var nextList = currentList.slice()
                var added = 0
                imported.forEach(function (row) {
                  var key = String(row.homepage).toLowerCase()
                  if (seen[key]) return
                  seen[key] = true
                  nextList.push(row)
                  added += 1
                })
                setSettings(function (previous) {
                  return {
                    ...previous,
                    customOfficialSites: nextList,
                    importMessage: format(t('officialMapImported'), { n: added }),
                    importError: '',
                  }
                })
                save({ customOfficialSites: nextList })
              })
              .catch(function (importFailure) {
                var message = importFailure && importFailure.message ? importFailure.message : String(importFailure)
                setSettings(function (previous) {
                  return { ...previous, importError: format(t('officialMapImportError'), { message: message }) }
                })
              })
            if (input) input.value = ''
          },
          [settings.customOfficialSites, save, t],
        )

        React.useEffect(
          function () {
            if (!loadedRef.current) return undefined
            if (weightsTimerRef.current !== null) clearTimeout(weightsTimerRef.current)
            weightsTimerRef.current = setTimeout(function () {
              weightsTimerRef.current = null
              if (!aliveRef.current) return
              save({ browseWeights: settings.browseWeights })
            }, 600)
            return function () {
              if (weightsTimerRef.current !== null) {
                clearTimeout(weightsTimerRef.current)
                weightsTimerRef.current = null
              }
            }
          },
          [settings.browseWeights, save],
        )

        function updateApiField(kind, key, value) {
          setSettings(function (previous) {
            var next = normalizeApiSnapshot(previous.customApi)
            next[kind][key] = value
            return { ...previous, customApi: next, apiMessage: '', apiError: '' }
          })
        }

        function saveCustomApi() {
          if (settings.apiSaving) return
          setSettings(function (previous) {
            return { ...previous, apiSaving: true, apiMessage: '', apiError: '' }
          })
          save({ customApi: normalizeApiSnapshot(settings.customApi) })
            .then(function () {
              if (!aliveRef.current) return
              setSettings(function (previous) {
                return { ...previous, apiSaving: false, apiMessage: t('customApiSaved') }
              })
            })
            .catch(function (error) {
              if (!aliveRef.current) return
              var message = error && error.message ? error.message : String(error)
              setSettings(function (previous) {
                return { ...previous, apiSaving: false, apiError: format(t('customApiInvalid'), { message: message }) }
              })
            })
        }

        function clearHistory() {
          if (historyInfo.clearing) return
          setHistoryInfo(function (previous) {
            return { ...previous, clearing: true }
          })
          requestJson('/history', { method: 'POST', body: { action: 'clear' } })
            .then(function () {
              if (!aliveRef.current) return
              setHistoryInfo({ count: 0, cleared: true, clearing: false })
            })
            .catch(function () {
              if (!aliveRef.current) return
              setHistoryInfo(function (previous) {
                return { ...previous, clearing: false }
              })
            })
        }

        var statusText = ''
        var statusClass = 'ais-pref-status'
        if (settings.saving) statusText = t('saving')
        else if (settings.error === 'loadFailed') {
          statusText = t('loadFailed')
          statusClass += ' ais-pref-status-error'
        } else if (settings.error !== '') {
          statusText = format(t('saveFailed'), { message: settings.error })
          statusClass += ' ais-pref-status-error'
        } else if (settings.saved) {
          statusText = t('saved')
          statusClass += ' ais-pref-status-ok'
        } else if (settings.loading) statusText = t('loadingSettings')

        var weightPercentMap = percentWeights(settings.browseWeights)
        var weightKeys = [
          { key: 'relevance', label: 'weightRelevance' },
          { key: 'timeliness', label: 'weightTimeliness' },
          { key: 'heat', label: 'weightHeat' },
        ]

        return h(
          'div',
          { className: 'ais-settings-page' },
          h(
            'div',
            { className: 'ais-settings' },
            h(
              'div',
              { className: 'ais-settings-head' },
              h(
                'div',
                { className: 'ais-settings-head-row' },
                h('span', { className: 'ais-settings-head-icon' }, h(SearchGlyph, { size: 15 })),
                h('h2', { className: 'ais-settings-title' }, t('settingsTitle')),
              ),
              h('p', { className: 'ais-settings-lead' }, t('settingsLead')),
            ),
            h(
              'div',
              { className: 'ais-pref' },
              h(
                'div',
                { className: 'ais-pref-group' },
                h('div', { className: 'ais-pref-label' }, t('languageLabel')),
                h('p', { className: 'ais-pref-hint' }, t('languageHint')),
                h(
                  'div',
                  { className: 'ais-seg', role: 'group' },
                  [
                    { value: 'auto', label: 'langAuto' },
                    { value: 'zh', label: 'langZh' },
                    { value: 'en', label: 'langEn' },
                  ].map(function (option) {
                    return h(
                      'button',
                      {
                        key: option.value,
                        type: 'button',
                        className: 'ais-seg-btn',
                        'aria-pressed': settings.language === option.value ? 'true' : 'false',
                        onClick: function () {
                          chooseLanguage(option.value)
                        },
                      },
                      t(option.label),
                    )
                  }),
                ),
              ),
              h(
                'div',
                { className: 'ais-pref-group' },
                h('div', { className: 'ais-pref-label' }, t('detailPrefLabel')),
                h('p', { className: 'ais-pref-hint' }, t('detailPrefHint')),
                h(
                  'div',
                  { className: 'ais-seg', role: 'group' },
                  DETAIL_OPTIONS.map(function (value) {
                    return h(
                      'button',
                      {
                        key: value,
                        type: 'button',
                        className: 'ais-seg-btn',
                        'aria-pressed': settings.encyclopediaDetail === value ? 'true' : 'false',
                        onClick: function () {
                          chooseDetail(value)
                        },
                      },
                      t(value === 'brief' ? 'detailBrief' : value === 'detailed' ? 'detailDetailed' : 'detailStandard'),
                    )
                  }),
                ),
              ),
              h(
                'div',
                { className: 'ais-pref-group' },
                h('div', { className: 'ais-pref-label' }, t('weightsPrefLabel')),
                h('p', { className: 'ais-pref-hint' }, t('weightsPrefHint')),
                h(
                  'div',
                  { className: 'ais-sliders' },
                  weightKeys.map(function (entry) {
                    return h(
                      'div',
                      { className: 'ais-slider-row', key: entry.key },
                      h('span', { className: 'ais-slider-name' }, t(entry.label)),
                      h('input', {
                        className: 'ais-slider',
                        type: 'range',
                        min: 0,
                        max: 100,
                        step: 5,
                        value: settings.browseWeights[entry.key],
                        'aria-label': t(entry.label),
                        onChange: function (event) {
                          changeWeight(entry.key, event.target.value)
                        },
                      }),
                      h('span', { className: 'ais-slider-value' }, String(settings.browseWeights[entry.key]) + ' · ' + weightPercentMap[entry.key] + '%'),
                    )
                  }),
                ),
              ),
              h(
                'div',
                { className: 'ais-pref-group' },
                h(
                  'div',
                  { className: 'ais-pref-inline' },
                  h(
                    'div',
                    { className: 'ais-pref-label-block' },
                    h('div', { className: 'ais-pref-label' }, t('preserveStateLabel')),
                    h('p', { className: 'ais-pref-hint' }, t('preserveStateHint')),
                  ),
                  h('button', {
                    type: 'button',
                    role: 'switch',
                    className: 'ais-switch',
                    'aria-checked': settings.preserveState ? 'true' : 'false',
                    'aria-label': t('preserveStateLabel'),
                    onClick: function () {
                      choosePreserve(!settings.preserveState)
                    },
                  }),
                ),
              ),
              h(
                'div',
                { className: 'ais-pref-group' },
                h(
                  'div',
                  { className: 'ais-pref-inline' },
                  h(
                    'div',
                    { className: 'ais-pref-label-block' },
                    h('div', { className: 'ais-pref-label' }, t('betterSidebarLabel')),
                    h('p', { className: 'ais-pref-hint' }, t('betterSidebarHint')),
                    HAS_BETTER_SIDEBAR ? null : h('p', { className: 'ais-pref-hint' }, t('betterSidebarMissing')),
                  ),
                  h('button', {
                    type: 'button',
                    role: 'switch',
                    className: 'ais-switch',
                    'aria-checked': settings.betterSidebar ? 'true' : 'false',
                    'aria-label': t('betterSidebarLabel'),
                    onClick: function () {
                      chooseBetterSidebar(!settings.betterSidebar)
                    },
                  }),
                ),
              ),
              h(
                'div',
                { className: 'ais-pref-group' },
                h(
                  'div',
                  { className: 'ais-pref-inline' },
                  h(
                    'div',
                    { className: 'ais-pref-label-block' },
                    h('div', { className: 'ais-pref-label' }, t('openLinksLabel')),
                    h('p', { className: 'ais-pref-hint' }, t('openLinksHint')),
                  ),
                  h('button', {
                    type: 'button',
                    role: 'switch',
                    className: 'ais-switch',
                    'aria-checked': settings.openLinksInSidebar ? 'true' : 'false',
                    'aria-label': t('openLinksLabel'),
                    onClick: function () {
                      chooseOpenLinks(!settings.openLinksInSidebar)
                    },
                  }),
                ),
              ),
              h(
                'div',
                { className: 'ais-pref-group' },
                h('div', { className: 'ais-pref-label' }, t('defaultEngineLabel')),
                h('p', { className: 'ais-pref-hint' }, t('defaultEngineHint')),
                h(
                  'div',
                  { className: 'ais-seg', role: 'group' },
                  ENGINES.map(function (entry) {
                    return h(
                      'button',
                      {
                        key: entry.id,
                        type: 'button',
                        className: 'ais-seg-btn',
                        'aria-pressed': settings.defaultEngine === entry.id ? 'true' : 'false',
                        onClick: function () {
                          chooseEngine(entry.id)
                        },
                      },
                      t(entry.label),
                    )
                  }),
                ),
              ),
              h(
                'div',
                { className: 'ais-pref-group' },
                h('div', { className: 'ais-pref-label' }, t('customEngineSection')),
                h('p', { className: 'ais-pref-hint' }, t('customEngineHint')),
                (settings.customEngines || []).length === 0
                  ? h('p', { className: 'ais-pref-hint' }, t('customEngineEmpty'))
                  : h(
                      'div',
                      { className: 'ais-custom-list' },
                      (settings.customEngines || []).map(function (engine) {
                        return h(
                          'div',
                          { className: 'ais-custom-row', key: engine.id || engine.name },
                          h('span', { className: 'ais-custom-name' }, engine.name),
                          h('span', { className: 'ais-custom-url', title: engine.urlTemplate }, engine.urlTemplate),
                          h(
                            'button',
                            { type: 'button', className: 'ais-pref-button', onClick: function () { removeCustomEngine(engine.id) } },
                            t('customEngineDelete'),
                          ),
                        )
                      }),
                    ),
                h(
                  'div',
                  { className: 'ais-custom-form' },
                  h('input', {
                    className: 'ais-custom-input',
                    type: 'text',
                    value: settings.customName,
                    placeholder: t('customEngineNamePlaceholder'),
                    'aria-label': t('customEngineNamePlaceholder'),
                    onChange: function (event) {
                      var value = event.target.value
                      setSettings(function (previous) {
                        return { ...previous, customName: value }
                      })
                    },
                  }),
                  h('input', {
                    className: 'ais-custom-input ais-custom-input-url',
                    type: 'text',
                    value: settings.customUrl,
                    placeholder: t('customEngineUrlPlaceholder'),
                    'aria-label': t('customEngineUrlPlaceholder'),
                    onChange: function (event) {
                      var value = event.target.value
                      setSettings(function (previous) {
                        return { ...previous, customUrl: value }
                      })
                    },
                  }),
                  h('button', { type: 'button', className: 'ais-pref-button', onClick: addCustomEngine }, t('customEngineAdd')),
                ),
                settings.customError !== '' ? h('p', { className: 'ais-pref-hint ais-pref-status-error' }, settings.customError) : null,
              ),
              h(
                'div',
                { className: 'ais-pref-group' },
                h('div', { className: 'ais-pref-label' }, t('officialMapLabel')),
                h('p', { className: 'ais-pref-hint' }, t('officialMapHint')),
                (settings.customOfficialSites || []).length === 0
                  ? h('p', { className: 'ais-pref-hint' }, t('officialMapEmpty'))
                  : h(
                      'div',
                      { className: 'ais-custom-list' },
                      (settings.customOfficialSites || []).map(function (site) {
                        return h(
                          'div',
                          { className: 'ais-custom-row', key: site.homepage },
                          h('span', { className: 'ais-custom-name' }, site.name),
                          h('span', { className: 'ais-custom-alias', title: (site.aliases || []).join(', ') }, (site.aliases || []).join('、')),
                          h('span', { className: 'ais-custom-url', title: site.homepage }, site.homepage),
                          h(
                            'button',
                            { type: 'button', className: 'ais-pref-button', onClick: function () { removeOfficialSite(site.homepage) } },
                            t('officialMapDelete'),
                          ),
                        )
                      }),
                    ),
                h(
                  'div',
                  { className: 'ais-custom-form' },
                  h('input', {
                    className: 'ais-custom-input',
                    type: 'text',
                    value: settings.customSiteName,
                    placeholder: t('officialMapNamePlaceholder'),
                    'aria-label': t('officialMapNamePlaceholder'),
                    onChange: function (event) {
                      var value = event.target.value
                      setSettings(function (previous) {
                        return { ...previous, customSiteName: value }
                      })
                    },
                  }),
                  h('input', {
                    className: 'ais-custom-input',
                    type: 'text',
                    value: settings.customSiteAliases,
                    placeholder: t('officialMapAliasesPlaceholder'),
                    'aria-label': t('officialMapAliasesPlaceholder'),
                    onChange: function (event) {
                      var value = event.target.value
                      setSettings(function (previous) {
                        return { ...previous, customSiteAliases: value }
                      })
                    },
                  }),
                  h('input', {
                    className: 'ais-custom-input ais-custom-input-url',
                    type: 'text',
                    value: settings.customSiteHomepage,
                    placeholder: t('officialMapHomepagePlaceholder'),
                    'aria-label': t('officialMapHomepagePlaceholder'),
                    onChange: function (event) {
                      var value = event.target.value
                      setSettings(function (previous) {
                        return { ...previous, customSiteHomepage: value }
                      })
                    },
                  }),
                  h('button', { type: 'button', className: 'ais-pref-button', onClick: addOfficialSite }, t('officialMapAdd')),
                ),
                h(
                  'div',
                  { className: 'ais-custom-form' },
                  h('input', {
                    type: 'file',
                    accept: '.xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    style: { display: 'none' },
                    ref: importInputRef,
                    onChange: onImportOfficialFile,
                  }),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'ais-pref-button',
                      onClick: function () {
                        if (importInputRef.current && typeof importInputRef.current.click === 'function') importInputRef.current.click()
                      },
                    },
                    t('officialMapImport'),
                  ),
                  h('span', { className: 'ais-pref-hint' }, t('officialMapImportHint')),
                ),
                settings.importMessage !== '' ? h('p', { className: 'ais-pref-hint' }, settings.importMessage) : null,
                settings.importError !== '' ? h('p', { className: 'ais-pref-hint ais-pref-status-error' }, settings.importError) : null,
                settings.customSiteError !== '' ? h('p', { className: 'ais-pref-hint ais-pref-status-error' }, settings.customSiteError) : null,
              ),
              h(
                'div',
                { className: 'ais-pref-group' },
                h('div', { className: 'ais-pref-label' }, t('customApiSection')),
                h('p', { className: 'ais-pref-hint' }, t('customApiHint')),
                h(
                  'div',
                  { className: 'ais-pref-inline' },
                  h(
                    'div',
                    { className: 'ais-pref-label-block' },
                    h('div', { className: 'ais-pref-label' }, t('searchApiToggle')),
                    h('p', { className: 'ais-pref-hint' }, t('searchApiToggleHint')),
                  ),
                  h('button', {
                    type: 'button',
                    role: 'switch',
                    className: 'ais-switch',
                    'aria-checked': settings.customApi.search.mode === 'custom' ? 'true' : 'false',
                    'aria-label': t('searchApiToggle'),
                    onClick: function () {
                      updateApiField('search', 'mode', settings.customApi.search.mode === 'custom' ? 'harness' : 'custom')
                    },
                  }),
                ),
                settings.customApi.search.mode === 'custom'
                  ? h(
                      'div',
                      null,
                      h(
                        'div',
                        { className: 'ais-custom-form' },
                        h(
                          'select',
                          {
                            className: 'ais-custom-input',
                            value: settings.customApi.search.provider,
                            'aria-label': t('searchApiProvider'),
                            onChange: function (event) {
                              updateApiField('search', 'provider', event.target.value)
                            },
                          },
                          ['tavily', 'bocha', 'searxng', 'serper'].map(function (option) {
                            return h('option', { key: option, value: option }, option)
                          }),
                        ),
                        h('input', {
                          className: 'ais-custom-input ais-custom-input-url',
                          type: 'text',
                          value: settings.customApi.search.baseUrl,
                          placeholder: t('searchApiBaseUrl'),
                          'aria-label': t('searchApiBaseUrl'),
                          onChange: function (event) {
                            updateApiField('search', 'baseUrl', event.target.value)
                          },
                        }),
                        h('input', {
                          className: 'ais-custom-input',
                          type: 'password',
                          value: settings.customApi.search.apiKey,
                          placeholder: t('searchApiKeyPlaceholder'),
                          'aria-label': t('searchApiKey'),
                          onChange: function (event) {
                            updateApiField('search', 'apiKey', event.target.value)
                          },
                        }),
                      ),
                    )
                  : null,
                h(
                  'div',
                  { className: 'ais-pref-inline' },
                  h(
                    'div',
                    { className: 'ais-pref-label-block' },
                    h('div', { className: 'ais-pref-label' }, t('thinkingApiToggle')),
                    h('p', { className: 'ais-pref-hint' }, t('thinkingApiToggleHint')),
                  ),
                  h('button', {
                    type: 'button',
                    role: 'switch',
                    className: 'ais-switch',
                    'aria-checked': settings.customApi.thinking.mode === 'custom' ? 'true' : 'false',
                    'aria-label': t('thinkingApiToggle'),
                    onClick: function () {
                      updateApiField('thinking', 'mode', settings.customApi.thinking.mode === 'custom' ? 'harness' : 'custom')
                    },
                  }),
                ),
                settings.customApi.thinking.mode === 'custom'
                  ? h(
                      'div',
                      null,
                      h(
                        'div',
                        { className: 'ais-custom-form' },
                        h('input', {
                          className: 'ais-custom-input ais-custom-input-url',
                          type: 'text',
                          value: settings.customApi.thinking.baseUrl,
                          placeholder: t('thinkingBaseUrl'),
                          'aria-label': t('thinkingBaseUrl'),
                          onChange: function (event) {
                            updateApiField('thinking', 'baseUrl', event.target.value)
                          },
                        }),
                        h('input', {
                          className: 'ais-custom-input',
                          type: 'password',
                          value: settings.customApi.thinking.apiKey,
                          placeholder: t('thinkingApiKey'),
                          'aria-label': t('thinkingApiKey'),
                          onChange: function (event) {
                            updateApiField('thinking', 'apiKey', event.target.value)
                          },
                        }),
                        h('input', {
                          className: 'ais-custom-input',
                          type: 'text',
                          value: settings.customApi.thinking.model,
                          placeholder: t('thinkingModelPlaceholder'),
                          'aria-label': t('thinkingModel'),
                          onChange: function (event) {
                            updateApiField('thinking', 'model', event.target.value)
                          },
                        }),
                        h(
                          'select',
                          {
                            className: 'ais-custom-input',
                            value: settings.customApi.thinking.reasoningEffort,
                            'aria-label': t('thinkingEffort'),
                            onChange: function (event) {
                              updateApiField('thinking', 'reasoningEffort', event.target.value)
                            },
                          },
                          [
                            ['auto', 'thinkingEffortAuto'],
                            ['low', 'thinkingEffortLow'],
                            ['medium', 'thinkingEffortMedium'],
                            ['high', 'thinkingEffortHigh'],
                          ].map(function (entry) {
                            return h('option', { key: entry[0], value: entry[0] }, t(entry[1]))
                          }),
                        ),
                      ),
                    )
                  : null,
                h(
                  'div',
                  { className: 'ais-pref-inline' },
                  h(
                    'button',
                    { type: 'button', className: 'ais-pref-button', disabled: settings.apiSaving, onClick: saveCustomApi },
                    t('customApiSave'),
                  ),
                  settings.apiMessage !== '' ? h('span', { className: 'ais-pref-hint' }, settings.apiMessage) : null,
                ),
                settings.apiError !== '' ? h('p', { className: 'ais-pref-hint ais-pref-status-error' }, settings.apiError) : null,
              ),
              h(
                'div',
                { className: 'ais-pref-group' },
                h('div', { className: 'ais-pref-label' }, t('historyLabel')),
                h('p', { className: 'ais-pref-hint' }, t('historyHint')),
                h(
                  'div',
                  { className: 'ais-pref-inline' },
                  h('span', { className: 'ais-pref-hint' }, historyInfo.cleared ? t('historyCleared') : format(t('historyCount'), { n: historyInfo.count })),
                  h(
                    'button',
                    { type: 'button', className: 'ais-pref-button', disabled: historyInfo.clearing || historyInfo.count === 0, onClick: clearHistory },
                    t('historyClear'),
                  ),
                ),
              ),
              h('p', { className: statusClass, role: 'status' }, statusText),
            ),
          ),
        )
      }

      // ------------------------------------------------------------------
      // Cordis Client 插件
      // ------------------------------------------------------------------
      var name = NS
      var inject = ['slots', 'locale']

      function apply(ctx) {
        ctx.effect(function () {
          var disposeDict = ctx.locale.register(NS, { zh: zh, en: en })
          var styleElement = document.createElement('style')
          styleElement.setAttribute('data-dsh-ai-search', '')
          styleElement.textContent = CSS
          document.head.appendChild(styleElement)

          function panelLabel() {
            return (DICTS[pickLang(ctx.locale)] || zh).nav
          }

          // 设置导航里的「AI 搜索」用放大镜图标（settings.section 契约不带 icon，只能打标记 + CSS 替换）。
          var disposeSettingsNavIcon = registerSettingsNavIcon(panelLabel)

          function injectLocale() {
            return { locale: ctx.locale }
          }

          function dictLabel(key) {
            return (DICTS[pickLang(ctx.locale)] || zh)[key] || key
          }

          /** 安全地订阅一个可选客户端服务：服务不存在或上下文不支持时静默跳过。 */
          function safeInject(services, callback) {
            try {
              if (typeof ctx.inject !== 'function') return null
              return ctx.inject(services, callback)
            } catch (error) {
              return null
            }
          }

          // 更好的侧边栏适配：直接在宿主右侧栏注册「AI 搜索」页签类型（multiple=true，可像浏览器一样多开）。
          // 页签实体由 NativeAiSearchBody 渲染；未安装 dsh-better-sidebar 时保持原形态。
          var nativeSeat = null
          var disposeSidebarTabs = safeInject(['sidebarRightTabs'], function (injected) {
            var tabs = injected.get('sidebarRightTabs')
            if (tabs === undefined || tabs === null || typeof tabs.register !== 'function') return
            function registerSeat() {
              var disposers = []
              try {
                disposers.push(
                  tabs.register({
                    id: NS + ':native',
                    kind: NS,
                    multiple: true,
                    keepMounted: true,
                    title: function () {
                      return dictLabel('betterSidebarTabTitle')
                    },
                    guide: [
                      {
                        id: NS,
                        order: 15,
                        title: function () {
                          return dictLabel('betterSidebarTabTitle')
                        },
                        description: function () {
                          return dictLabel('betterSidebarTabDesc')
                        },
                        icon: NativeGuideIcon,
                      },
                    ],
                  }),
                )
                disposers.push(
                  ctx.slots.inject('sidebar.right.pane.tab', function () {
                    return ctx.slots.register({ name: 'sidebar.right.pane.tab', key: NS + ':native' }, NativeAiSearchBody)
                  }),
                )
              } catch (registerError) {
                /* 注册失败不影响面板与设置 */
              }
              return function () {
                for (var index = disposers.length - 1; index >= 0; index -= 1) {
                  try {
                    disposers[index]()
                  } catch (disposeError) {
                    /* 忽略 */
                  }
                }
              }
            }
            NATIVE_SYNC = function () {
              var want = ADAPT === true && HAS_BETTER_SIDEBAR === true
              if (want && nativeSeat === null) nativeSeat = registerSeat()
              else if (!want && nativeSeat !== null) {
                nativeSeat()
                nativeSeat = null
              }
            }
            NATIVE_SYNC()
            return function () {
              if (nativeSeat !== null) {
                nativeSeat()
                nativeSeat = null
              }
              NATIVE_SYNC = null
            }
          })

          // 检测 dsh-better-sidebar：服务出现/消失时重新同步原生页签。
          var disposeBetterSidebar = safeInject(['betterSidebar'], function () {
            HAS_BETTER_SIDEBAR = true
            if (typeof NATIVE_SYNC === 'function') NATIVE_SYNC()
            return function () {
              HAS_BETTER_SIDEBAR = false
              if (typeof NATIVE_SYNC === 'function') NATIVE_SYNC()
            }
          })

          // 宿主右侧栏的浏览器：结果链接 / 外部搜索引擎默认在侧边栏浏览器里打开。
          var disposeSidebarBrowser = safeInject(['sidebarRight'], function (injected) {
            var service = injected.get('sidebarRight')
            if (service === undefined || service === null || typeof service.openTab !== 'function') return
            openInSidebarBrowser = function (url) {
              service.openTab('browser', { params: { url: url } })
            }
            return function () {
              openInSidebarBrowser = null
            }
          })

          var disposePanel = ctx.slots.inject('sidebar.panellist', function () {
            return ctx.slots.register(
              {
                name: 'sidebar.panellist',
                id: NS,
                order: 20,
                label: panelLabel,
              },
              PanelIcon,
            )
          })

          // 首次加载设置：保留状态 / 更好的侧边栏适配 / 链接打开方式 / 默认搜索引擎。
          void requestJson('/settings')
            .then(function (payload) {
              if (payload && payload.settings) {
                PRESERVE_STATE = payload.settings.preserveState !== false
                ADAPT = payload.settings.betterSidebar !== false
                OPEN_IN_SIDEBAR = payload.settings.openLinksInSidebar !== false
                DEFAULT_ENGINE = payload.settings.defaultEngine || 'ai'
                setCustomEngines(Array.isArray(payload.settings.customEngines) ? payload.settings.customEngines : [])
                if (typeof NATIVE_SYNC === 'function') NATIVE_SYNC()
              }
            })
            .catch(function () {
              PRESERVE_STATE = true
            })

          var disposePage = ctx.slots.inject('main', function () {
            return ctx.slots.register(
              {
                name: 'main',
                key: NS,
                locale: NS,
                inject: injectLocale,
              },
              SearchPage,
            )
          })

          var disposeSettings = ctx.slots.inject('settings.section', function () {
            return ctx.slots.register(
              {
                name: 'settings.section',
                id: 'ai-search',
                order: 70,
                label: panelLabel,
                locale: NS,
                inject: injectLocale,
              },
              SettingsPage,
            )
          })

          return function () {
            if (typeof disposeSettings === 'function') disposeSettings()
            if (typeof disposePage === 'function') disposePage()
            if (typeof disposePanel === 'function') disposePanel()
            if (typeof disposeBetterSidebar === 'function') disposeBetterSidebar()
            if (typeof disposeSidebarTabs === 'function') disposeSidebarTabs()
            if (typeof disposeSidebarBrowser === 'function') disposeSidebarBrowser()
            if (typeof disposeSettingsNavIcon === 'function') disposeSettingsNavIcon()
            if (typeof disposeDict === 'function') disposeDict()
            if (styleElement.parentNode !== null) styleElement.parentNode.removeChild(styleElement)
          }
        }, NS + ': panel, page and settings')
      }

      return { name: name, inject: inject, apply: apply, parseOfficialSheetCsv: parseOfficialSheetCsv, parseOfficialSheetXlsx: parseOfficialSheetXlsx }
    },
  })
})()
