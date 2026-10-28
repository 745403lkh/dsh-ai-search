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
      /** 最近一次搜索页快照：面板卸载（切换对话/工作区）后仍然保留。 */
      var LAST_SEARCH_STATE = null

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
        '.ais-feed-card:hover{border-color:var(--dsw-alias-border-l2)}',
        '.ais-feed-thumb{flex:none;width:112px;height:74px;border-radius:9px;overflow:hidden;background:var(--dsw-alias-bg-layer-2);display:flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-tertiary)}',
        '.ais-feed-thumb img{width:100%;height:100%;object-fit:cover;display:block}',
        '.ais-feed-body{min-width:0;flex:1;display:flex;flex-direction:column;gap:5px}',
        '.ais-feed-top{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}',
        '.ais-feed-title{font-size:15px;line-height:22px;font-weight:600;color:var(--dsw-alias-label-primary);text-decoration:none;word-break:break-word}',
        '.ais-feed-title:hover{color:var(--dsw-alias-brand-primary);text-decoration:underline}',
        '.ais-kind{font-size:10px;line-height:16px;padding:1px 7px;border-radius:999px;color:var(--dsw-alias-brand-primary);border:1px solid color-mix(in srgb,var(--dsw-alias-brand-primary) 32%,transparent)}',
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
        var items = [
          format(t('metaSources'), { n: stats.kept === undefined ? (result.sources || []).length : stats.kept }),
          format(t('metaFetched'), { n: stats.fetched || 0 }),
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
                            { className: 'ais-row-strike', href: entry.url, target: '_blank', rel: 'noreferrer noopener', title: entry.url },
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
                        { className: 'ais-row-title', href: source.url, target: '_blank', rel: 'noreferrer noopener', title: source.url },
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
              h('a', { className: 'ais-pick-title', href: pick.url, target: '_blank', rel: 'noreferrer noopener', title: pick.url }, pick.title),
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
          { className: 'ais-feed-card' },
          h(
            'div',
            { className: 'ais-feed-thumb' },
            item.thumbnail ? h('img', { src: item.thumbnail, alt: '', loading: 'lazy', referrerPolicy: 'no-referrer' }) : h(ImageGlyph, { size: 20 }),
          ),
          h(
            'div',
            { className: 'ais-feed-body' },
            h(
              'div',
              { className: 'ais-feed-top' },
              h('a', { className: 'ais-feed-title', href: item.url, target: '_blank', rel: 'noreferrer noopener', title: item.url }, item.title),
              h('span', { className: 'ais-kind' }, item.kind === 'video' && item.sourcePlatform ? t(kindKey) + ' · ' + item.sourcePlatform : t(kindKey)),
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
        return h(
          'a',
          { className: 'ais-image-card', href: item.url, target: '_blank', rel: 'noreferrer noopener', title: item.url },
          h('div', { className: 'ais-image-box' }, item.thumbnail ? h('img', { src: item.thumbnail, alt: '', loading: 'lazy', referrerPolicy: 'no-referrer' }) : h(ImageGlyph, { size: 22 })),
          h(
            'div',
            { className: 'ais-image-info' },
            h('span', { className: 'ais-image-title' }, item.title),
            h('span', { className: 'ais-image-meta' }, h('span', null, item.domain), h('span', null, format(t('totalScore'), { n: item.score }))),
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
          return h(
            React.Fragment,
            null,
            ['article', 'video', 'image'].map(function (kind) {
              var group = items.filter(function (item) {
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
            }),
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

      function SearchPage(props) {
        var locale = props && props.locale
        var localized = useLocale(locale)
        var t = localized.t
        var lang = localized.lang
        var restore = PRESERVE_STATE === true && LAST_SEARCH_STATE !== null ? LAST_SEARCH_STATE : null
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
              LAST_SEARCH_STATE = null
              return
            }
            if (status === 'loading') return
            LAST_SEARCH_STATE = { draft: draft, mode: mode, status: status, result: result, error: error, board: board }
          },
          [draft, mode, status, result, error, board],
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

        var onSubmit = React.useCallback(
          function () {
            runSearch(draft, mode)
          },
          [runSearch, draft, mode],
        )

        var onChip = React.useCallback(
          function (item) {
            setDraft(item)
            runSearch(item, mode)
          },
          [runSearch, mode],
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
        var modeTabs = h(ModeTabs, { t: t, mode: mode, onChange: onModeChange })

        if (status === 'idle') {
          return h(
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

        return h(
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
            h('div', { className: 'ais-mode-bar' }, modeTabs),
            searchBar,
            content,
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

        React.useEffect(function () {
          aliveRef.current = true
          requestJson('/settings')
            .then(function (payload) {
              if (!aliveRef.current) return
              var next = payload.settings || {}
              loadedRef.current = true
              PRESERVE_STATE = next.preserveState !== false
              setSettings(function (previous) {
                return {
                  ...previous,
                  loading: false,
                  language: next.language || 'auto',
                  encyclopediaDetail: next.encyclopediaDetail || 'standard',
                  browseWeights: next.browseWeights || previous.browseWeights,
                  preserveState: next.preserveState !== false,
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
          requestJson('/settings', { method: 'POST', body: patch })
            .then(function () {
              if (!aliveRef.current || saveSeqRef.current !== seq) return
              setSettings(function (previous) {
                return { ...previous, saving: false, saved: true }
              })
            })
            .catch(function (failure) {
              if (!aliveRef.current || saveSeqRef.current !== seq) return
              setSettings(function (previous) {
                return { ...previous, saving: false, error: failure && failure.message ? failure.message : String(failure) }
              })
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
            if (next === false) LAST_SEARCH_STATE = null
            save({ preserveState: next })
          },
          [save],
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

          function injectLocale() {
            return { locale: ctx.locale }
          }

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

          // 首次加载设置：决定搜索页是否跨挂载保留状态（默认保留）。
          void requestJson('/settings')
            .then(function (payload) {
              if (payload && payload.settings) PRESERVE_STATE = payload.settings.preserveState !== false
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
            if (typeof disposeDict === 'function') disposeDict()
            if (styleElement.parentNode !== null) styleElement.parentNode.removeChild(styleElement)
          }
        }, NS + ': panel, page and settings')
      }

      return { name: name, inject: inject, apply: apply }
    },
  })
})()
