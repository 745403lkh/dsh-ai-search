/**
 * 官网识别：常见品牌 → 官方域名 + 官网首页。
 *
 * 用途：浏览模式搜索品牌词（如「百度」「原神」「Steam」）时，只把**官网首页**
 * 置顶并标「官方」；官网域名下的其它页面（如 ir.baidu.com 股价页、搜索页、文章页）
 * 不算官网首页，不会被置顶/标官方。检索结果里没有官网首页时，第 1 页补一条官网首页。
 *
 * 数据分两部分：
 * - 内置品牌表（覆盖面尽量广，人工维护、高精度优先）；
 * - 设置里的自定义映射（用户在「设置 → AI 搜索 → 官网识别映射」里增删，运行时优先匹配）。
 */

/** 品牌 → 别名 + 官方域名 + 官网首页。别名不区分大小写；中文按子串匹配，英文按词边界匹配。 */
const OFFICIAL_SITES = [
  // ---- 中文互联网 / 科技 ----
  { name: '微信', aliases: ['微信', 'wechat', 'weixin'], domains: ['weixin.qq.com'], homepage: 'https://weixin.qq.com/' },
  { name: 'QQ', aliases: ['qq'], domains: ['qq.com'], homepage: 'https://www.qq.com/' },
  { name: '腾讯', aliases: ['腾讯', 'tencent'], domains: ['tencent.com'], homepage: 'https://www.tencent.com/' },
  { name: '淘宝', aliases: ['淘宝', 'taobao'], domains: ['taobao.com'], homepage: 'https://www.taobao.com/' },
  { name: '天猫', aliases: ['天猫', 'tmall'], domains: ['tmall.com'], homepage: 'https://www.tmall.com/' },
  { name: '支付宝', aliases: ['支付宝', 'alipay'], domains: ['alipay.com'], homepage: 'https://www.alipay.com/' },
  { name: '阿里巴巴', aliases: ['阿里巴巴', 'alibaba'], domains: ['alibaba.com'], homepage: 'https://www.alibaba.com/' },
  { name: '京东', aliases: ['京东', 'jd'], domains: ['jd.com'], homepage: 'https://www.jd.com/' },
  { name: '拼多多', aliases: ['拼多多', 'pinduoduo'], domains: ['pinduoduo.com'], homepage: 'https://www.pinduoduo.com/' },
  { name: '抖音', aliases: ['抖音', 'douyin'], domains: ['douyin.com'], homepage: 'https://www.douyin.com/' },
  { name: 'TikTok', aliases: ['tiktok'], domains: ['tiktok.com'], homepage: 'https://www.tiktok.com/' },
  { name: '快手', aliases: ['快手', 'kuaishou'], domains: ['kuaishou.com'], homepage: 'https://www.kuaishou.com/' },
  { name: '小红书', aliases: ['小红书', 'xiaohongshu'], domains: ['xiaohongshu.com'], homepage: 'https://www.xiaohongshu.com/' },
  { name: '微博', aliases: ['微博', 'weibo'], domains: ['weibo.com'], homepage: 'https://weibo.com/' },
  { name: '知乎', aliases: ['知乎', 'zhihu'], domains: ['zhihu.com'], homepage: 'https://www.zhihu.com/' },
  { name: '哔哩哔哩', aliases: ['哔哩哔哩', 'b站', 'bilibili'], domains: ['bilibili.com'], homepage: 'https://www.bilibili.com/' },
  { name: '百度', aliases: ['百度', 'baidu'], domains: ['baidu.com'], homepage: 'https://www.baidu.com/' },
  { name: '必应', aliases: ['必应', 'bing'], domains: ['bing.com'], homepage: 'https://www.bing.com/' },
  { name: '美团', aliases: ['美团', 'meituan'], domains: ['meituan.com'], homepage: 'https://www.meituan.com/' },
  { name: '大众点评', aliases: ['大众点评', 'dianping'], domains: ['dianping.com'], homepage: 'https://www.dianping.com/' },
  { name: '饿了么', aliases: ['饿了么', 'eleme'], domains: ['ele.me'], homepage: 'https://www.ele.me/' },
  { name: '滴滴', aliases: ['滴滴', 'didi'], domains: ['didiglobal.com'], homepage: 'https://www.didiglobal.com/' },
  { name: '高德地图', aliases: ['高德', '高德地图', 'amap'], domains: ['amap.com'], homepage: 'https://www.amap.com/' },
  { name: '携程', aliases: ['携程', 'ctrip'], domains: ['ctrip.com'], homepage: 'https://www.ctrip.com/' },
  { name: '去哪儿', aliases: ['去哪儿', 'qunar'], domains: ['qunar.com'], homepage: 'https://www.qunar.com/' },
  { name: '网易', aliases: ['网易', 'netease'], domains: ['163.com'], homepage: 'https://www.163.com/' },
  { name: '网易云音乐', aliases: ['网易云音乐'], domains: ['music.163.com'], homepage: 'https://music.163.com/' },
  { name: 'QQ音乐', aliases: ['qq音乐'], domains: ['y.qq.com'], homepage: 'https://y.qq.com/' },
  { name: '酷狗音乐', aliases: ['酷狗', 'kugou'], domains: ['kugou.com'], homepage: 'https://www.kugou.com/' },
  { name: '酷我音乐', aliases: ['酷我', 'kuwo'], domains: ['kuwo.cn'], homepage: 'https://www.kuwo.cn/' },
  { name: '小米', aliases: ['小米', 'xiaomi'], domains: ['mi.com'], homepage: 'https://www.mi.com/' },
  { name: '华为', aliases: ['华为', 'huawei'], domains: ['huawei.com'], homepage: 'https://www.huawei.com/' },
  { name: '荣耀', aliases: ['荣耀', 'honor'], domains: ['honor.com'], homepage: 'https://www.honor.com/' },
  { name: '联想', aliases: ['联想', 'lenovo'], domains: ['lenovo.com'], homepage: 'https://www.lenovo.com/' },
  { name: 'OPPO', aliases: ['oppo'], domains: ['oppo.com'], homepage: 'https://www.oppo.com/' },
  { name: 'vivo', aliases: ['vivo'], domains: ['vivo.com'], homepage: 'https://www.vivo.com/' },
  { name: '一加', aliases: ['一加', 'oneplus'], domains: ['oneplus.com'], homepage: 'https://www.oneplus.com/' },
  { name: '魅族', aliases: ['魅族', 'meizu'], domains: ['meizu.com'], homepage: 'https://www.meizu.com/' },
  { name: '中兴', aliases: ['中兴', 'zte'], domains: ['zte.com.cn'], homepage: 'https://www.zte.com.cn/' },
  { name: '字节跳动', aliases: ['字节跳动', 'bytedance'], domains: ['bytedance.com'], homepage: 'https://www.bytedance.com/' },
  { name: '今日头条', aliases: ['今日头条', 'toutiao'], domains: ['toutiao.com'], homepage: 'https://www.toutiao.com/' },
  { name: '飞书', aliases: ['飞书', 'feishu'], domains: ['feishu.cn'], homepage: 'https://www.feishu.cn/' },
  { name: '钉钉', aliases: ['钉钉', 'dingtalk'], domains: ['dingtalk.com'], homepage: 'https://www.dingtalk.com/' },
  { name: 'WPS', aliases: ['wps', '金山办公'], domains: ['wps.cn'], homepage: 'https://www.wps.cn/' },
  { name: '金山软件', aliases: ['金山软件'], domains: ['kingsoft.com'], homepage: 'https://www.kingsoft.com/' },
  { name: '迅雷', aliases: ['迅雷', 'xunlei'], domains: ['xunlei.com'], homepage: 'https://www.xunlei.com/' },
  { name: '360', aliases: ['360手机卫士', '360安全'], domains: ['360.cn'], homepage: 'https://www.360.cn/' },
  { name: '小红书商城', aliases: ['小红书商城'], domains: ['xiaohongshu.com'], homepage: 'https://www.xiaohongshu.com/' },
  { name: '豆瓣', aliases: ['豆瓣', 'douban'], domains: ['douban.com'], homepage: 'https://www.douban.com/' },
  { name: '虎扑', aliases: ['虎扑', 'hupu'], domains: ['hupu.com'], homepage: 'https://www.hupu.com/' },
  { name: '贴吧', aliases: ['百度贴吧', '贴吧', 'tieba'], domains: ['tieba.baidu.com'], homepage: 'https://tieba.baidu.com/' },
  { name: '百度百科', aliases: ['百度百科'], domains: ['baike.baidu.com'], homepage: 'https://baike.baidu.com/' },
  { name: '小红书创作', aliases: ['小红书创作'], domains: ['creator.xiaohongshu.com'], homepage: 'https://creator.xiaohongshu.com/' },
  { name: '微信公众平台', aliases: ['微信公众平台', '公众号平台'], domains: ['mp.weixin.qq.com'], homepage: 'https://mp.weixin.qq.com/' },
  { name: '微信支付', aliases: ['微信支付'], domains: ['pay.weixin.qq.com'], homepage: 'https://pay.weixin.qq.com/' },
  { name: '腾讯云', aliases: ['腾讯云'], domains: ['cloud.tencent.com'], homepage: 'https://cloud.tencent.com/' },
  { name: '阿里云', aliases: ['阿里云', 'aliyun'], domains: ['aliyun.com'], homepage: 'https://www.aliyun.com/' },
  { name: '华为云', aliases: ['华为云'], domains: ['huaweicloud.com'], homepage: 'https://www.huaweicloud.com/' },
  { name: '百度智能云', aliases: ['百度智能云'], domains: ['cloud.baidu.com'], homepage: 'https://cloud.baidu.com/' },
  { name: '火山引擎', aliases: ['火山引擎', 'volcengine'], domains: ['volcengine.com'], homepage: 'https://www.volcengine.com/' },
  // ---- AI / 大模型 ----
  { name: 'DeepSeek', aliases: ['deepseek', '深度求索'], domains: ['deepseek.com'], homepage: 'https://www.deepseek.com/' },
  { name: 'OpenAI', aliases: ['openai'], domains: ['openai.com'], homepage: 'https://openai.com/' },
  { name: 'ChatGPT', aliases: ['chatgpt'], domains: ['chatgpt.com'], homepage: 'https://chatgpt.com/' },
  { name: 'Anthropic', aliases: ['anthropic', 'claude'], domains: ['anthropic.com'], homepage: 'https://www.anthropic.com/' },
  { name: 'Google', aliases: ['google', '谷歌'], domains: ['google.com'], homepage: 'https://www.google.com/' },
  { name: 'Gemini', aliases: ['gemini'], domains: ['gemini.google.com'], homepage: 'https://gemini.google.com/' },
  { name: 'Microsoft Copilot', aliases: ['copilot'], domains: ['copilot.microsoft.com'], homepage: 'https://copilot.microsoft.com/' },
  { name: '通义', aliases: ['通义', '通义千问', 'qwen'], domains: ['tongyi.aliyun.com'], homepage: 'https://tongyi.aliyun.com/' },
  { name: '文心一言', aliases: ['文心一言', '文心'], domains: ['yiyan.baidu.com'], homepage: 'https://yiyan.baidu.com/' },
  { name: '豆包', aliases: ['豆包', 'doubao'], domains: ['doubao.com'], homepage: 'https://www.doubao.com/' },
  { name: 'Kimi', aliases: ['kimi', '月之暗面', 'moonshot'], domains: ['kimi.moonshot.cn'], homepage: 'https://kimi.moonshot.cn/' },
  { name: '智谱', aliases: ['智谱', 'zhipu', 'chatglm'], domains: ['zhipuai.cn'], homepage: 'https://www.zhipuai.cn/' },
  { name: '讯飞星火', aliases: ['讯飞星火', '星火', 'iflytek'], domains: ['xinghuo.xfyun.cn'], homepage: 'https://xinghuo.xfyun.cn/' },
  { name: '百川智能', aliases: ['百川智能', 'baichuan'], domains: ['baichuan-ai.com'], homepage: 'https://www.baichuan-ai.com/' },
  // ---- 游戏 ----
  { name: '米哈游', aliases: ['米哈游', 'mihoyo', 'hoyoverse'], domains: ['mihoyo.com'], homepage: 'https://www.mihoyo.com/' },
  { name: '原神', aliases: ['原神', 'genshin', 'genshin impact'], domains: ['ys.mihoyo.com'], homepage: 'https://ys.mihoyo.com/' },
  { name: '崩坏3', aliases: ['崩坏3', '崩坏三'], domains: ['bh3.mihoyo.com'], homepage: 'https://bh3.mihoyo.com/' },
  { name: '崩坏星穹铁道', aliases: ['崩坏星穹铁道', '星穹铁道', 'star rail'], domains: ['sr.mihoyo.com'], homepage: 'https://sr.mihoyo.com/' },
  { name: '绝区零', aliases: ['绝区零', 'zenless'], domains: ['zenless.hoyoverse.com'], homepage: 'https://zenless.hoyoverse.com/' },
  { name: 'Steam', aliases: ['steam', '蒸汽平台', 'steampowered'], domains: ['steampowered.com'], homepage: 'https://store.steampowered.com/' },
  { name: 'Epic Games', aliases: ['epic', 'epic games', 'epicgames'], domains: ['epicgames.com'], homepage: 'https://store.epicgames.com/' },
  { name: '育碧', aliases: ['育碧', 'ubisoft'], domains: ['ubisoft.com'], homepage: 'https://www.ubisoft.com/' },
  { name: '暴雪', aliases: ['暴雪', 'blizzard'], domains: ['blizzard.com'], homepage: 'https://www.blizzard.com/' },
  { name: '拳头游戏', aliases: ['拳头游戏', 'riot', 'riotgames'], domains: ['riotgames.com'], homepage: 'https://www.riotgames.com/' },
  { name: '任天堂', aliases: ['任天堂', 'nintendo'], domains: ['nintendo.com'], homepage: 'https://www.nintendo.com/' },
  { name: 'PlayStation', aliases: ['playstation', 'ps5'], domains: ['playstation.com'], homepage: 'https://www.playstation.com/' },
  { name: 'Xbox', aliases: ['xbox'], domains: ['xbox.com'], homepage: 'https://www.xbox.com/' },
  { name: '网易游戏', aliases: ['网易游戏'], domains: ['game.163.com'], homepage: 'https://game.163.com/' },
  { name: '腾讯游戏', aliases: ['腾讯游戏'], domains: ['game.qq.com'], homepage: 'https://game.qq.com/' },
  { name: 'WeGame', aliases: ['wegame'], domains: ['wegame.com.cn'], homepage: 'https://www.wegame.com.cn/' },
  { name: '完美世界', aliases: ['完美世界'], domains: ['wanmei.com'], homepage: 'https://www.wanmei.com/' },
  { name: '莉莉丝', aliases: ['莉莉丝游戏', 'lilith'], domains: ['lilithgames.com'], homepage: 'https://www.lilithgames.com/' },
  { name: '鹰角网络', aliases: ['鹰角网络', '鹰角', 'hypergryph'], domains: ['hypergryph.com'], homepage: 'https://www.hypergryph.com/' },
  { name: '库洛游戏', aliases: ['库洛游戏', '库洛', 'kuro games'], domains: ['kurogame.com'], homepage: 'https://www.kurogame.com/' },
  { name: '叠纸游戏', aliases: ['叠纸游戏', '叠纸', 'papergames'], domains: ['papergames.cn'], homepage: 'https://www.papergames.cn/' },
  { name: '西山居', aliases: ['西山居', 'seasun'], domains: ['seasungames.com'], homepage: 'https://www.seasungames.com/' },
  { name: 'TapTap', aliases: ['taptap'], domains: ['taptap.cn'], homepage: 'https://www.taptap.cn/' },
  { name: '4399', aliases: ['4399'], domains: ['4399.com'], homepage: 'https://www.4399.com/' },
  { name: '游民星空', aliases: ['游民星空', 'gamersky'], domains: ['gamersky.com'], homepage: 'https://www.gamersky.com/' },
  { name: '3DM', aliases: ['3dm', '3dmgame'], domains: ['3dmgame.com'], homepage: 'https://www.3dmgame.com/' },
  { name: '游侠网', aliases: ['游侠网', 'ali213'], domains: ['ali213.net'], homepage: 'https://www.ali213.net/' },
  { name: 'NGA', aliases: ['nga'], domains: ['nga.cn'], homepage: 'https://bbs.nga.cn/' },
  // ---- 国际科技 / 平台 ----
  { name: '微软', aliases: ['微软', 'microsoft'], domains: ['microsoft.com'], homepage: 'https://www.microsoft.com/' },
  { name: 'Windows', aliases: ['windows'], domains: ['windows.com'], homepage: 'https://www.microsoft.com/windows/' },
  { name: '苹果', aliases: ['苹果', 'apple'], domains: ['apple.com'], homepage: 'https://www.apple.com/' },
  { name: 'GitHub', aliases: ['github'], domains: ['github.com'], homepage: 'https://github.com/' },
  { name: 'GitLab', aliases: ['gitlab'], domains: ['gitlab.com'], homepage: 'https://gitlab.com/' },
  { name: 'YouTube', aliases: ['youtube'], domains: ['youtube.com'], homepage: 'https://www.youtube.com/' },
  { name: 'Meta', aliases: ['meta', 'facebook'], domains: ['meta.com'], homepage: 'https://www.meta.com/' },
  { name: 'Instagram', aliases: ['instagram', 'ig'], domains: ['instagram.com'], homepage: 'https://www.instagram.com/' },
  { name: 'X', aliases: ['twitter', '推特'], domains: ['x.com'], homepage: 'https://x.com/' },
  { name: 'LinkedIn', aliases: ['linkedin', '领英'], domains: ['linkedin.com'], homepage: 'https://www.linkedin.com/' },
  { name: 'Netflix', aliases: ['netflix', '奈飞'], domains: ['netflix.com'], homepage: 'https://www.netflix.com/' },
  { name: 'Spotify', aliases: ['spotify'], domains: ['spotify.com'], homepage: 'https://www.spotify.com/' },
  { name: '亚马逊', aliases: ['亚马逊', 'amazon'], domains: ['amazon.com'], homepage: 'https://www.amazon.com/' },
  { name: 'eBay', aliases: ['ebay'], domains: ['ebay.com'], homepage: 'https://www.ebay.com/' },
  { name: 'PayPal', aliases: ['paypal'], domains: ['paypal.com'], homepage: 'https://www.paypal.com/' },
  { name: 'Adobe', aliases: ['adobe'], domains: ['adobe.com'], homepage: 'https://www.adobe.com/' },
  { name: 'Oracle', aliases: ['oracle'], domains: ['oracle.com'], homepage: 'https://www.oracle.com/' },
  { name: 'SAP', aliases: ['sap'], domains: ['sap.com'], homepage: 'https://www.sap.com/' },
  { name: 'IBM', aliases: ['ibm'], domains: ['ibm.com'], homepage: 'https://www.ibm.com/' },
  { name: 'Salesforce', aliases: ['salesforce'], domains: ['salesforce.com'], homepage: 'https://www.salesforce.com/' },
  { name: 'Zoom', aliases: ['zoom'], domains: ['zoom.us'], homepage: 'https://zoom.us/' },
  { name: 'Slack', aliases: ['slack'], domains: ['slack.com'], homepage: 'https://slack.com/' },
  { name: 'Notion', aliases: ['notion'], domains: ['notion.so'], homepage: 'https://www.notion.so/' },
  { name: 'Figma', aliases: ['figma'], domains: ['figma.com'], homepage: 'https://www.figma.com/' },
  { name: 'Canva', aliases: ['canva'], domains: ['canva.com'], homepage: 'https://www.canva.com/' },
  { name: 'Dropbox', aliases: ['dropbox'], domains: ['dropbox.com'], homepage: 'https://www.dropbox.com/' },
  { name: 'Shopify', aliases: ['shopify'], domains: ['shopify.com'], homepage: 'https://www.shopify.com/' },
  { name: 'Airbnb', aliases: ['airbnb', '爱彼迎'], domains: ['airbnb.com'], homepage: 'https://www.airbnb.com/' },
  { name: 'Uber', aliases: ['uber'], domains: ['uber.com'], homepage: 'https://www.uber.com/' },
  { name: 'Booking', aliases: ['booking'], domains: ['booking.com'], homepage: 'https://www.booking.com/' },
  { name: 'Tripadvisor', aliases: ['tripadvisor', '猫途鹰'], domains: ['tripadvisor.com'], homepage: 'https://www.tripadvisor.com/' },
  { name: 'Wikipedia', aliases: ['wikipedia', '维基百科'], domains: ['wikipedia.org'], homepage: 'https://www.wikipedia.org/' },
  { name: 'AWS', aliases: ['aws', '亚马逊云'], domains: ['aws.amazon.com'], homepage: 'https://aws.amazon.com/' },
  { name: 'Azure', aliases: ['azure'], domains: ['azure.microsoft.com'], homepage: 'https://azure.microsoft.com/' },
  { name: 'Google Cloud', aliases: ['google cloud'], domains: ['cloud.google.com'], homepage: 'https://cloud.google.com/' },
  { name: '英伟达', aliases: ['英伟达', 'nvidia'], domains: ['nvidia.com'], homepage: 'https://www.nvidia.com/' },
  { name: '英特尔', aliases: ['英特尔', 'intel'], domains: ['intel.com'], homepage: 'https://www.intel.com/' },
  { name: 'AMD', aliases: ['amd'], domains: ['amd.com'], homepage: 'https://www.amd.com/' },
  { name: '高通', aliases: ['高通', 'qualcomm'], domains: ['qualcomm.com'], homepage: 'https://www.qualcomm.com/' },
  { name: '台积电', aliases: ['台积电', 'tsmc'], domains: ['tsmc.com'], homepage: 'https://www.tsmc.com/' },
  { name: '联发科', aliases: ['联发科', 'mediatek'], domains: ['mediatek.com'], homepage: 'https://www.mediatek.com/' },
  { name: '三星', aliases: ['三星', 'samsung'], domains: ['samsung.com'], homepage: 'https://www.samsung.com/' },
  { name: 'LG', aliases: ['lg'], domains: ['lg.com'], homepage: 'https://www.lg.com/' },
  { name: '索尼', aliases: ['索尼', 'sony'], domains: ['sony.com'], homepage: 'https://www.sony.com/' },
  { name: '松下', aliases: ['松下', 'panasonic'], domains: ['panasonic.com'], homepage: 'https://www.panasonic.com/' },
  { name: '飞利浦', aliases: ['飞利浦', 'philips'], domains: ['philips.com'], homepage: 'https://www.philips.com/' },
  { name: '戴尔', aliases: ['戴尔', 'dell'], domains: ['dell.com'], homepage: 'https://www.dell.com/' },
  { name: '惠普', aliases: ['惠普', 'hp'], domains: ['hp.com'], homepage: 'https://www.hp.com/' },
  { name: '华硕', aliases: ['华硕', 'asus'], domains: ['asus.com'], homepage: 'https://www.asus.com/' },
  { name: '微星', aliases: ['微星', 'msi'], domains: ['msi.com'], homepage: 'https://www.msi.com/' },
  { name: '技嘉', aliases: ['技嘉', 'gigabyte'], domains: ['gigabyte.com'], homepage: 'https://www.gigabyte.com/' },
  { name: '罗技', aliases: ['罗技', 'logitech'], domains: ['logitech.com'], homepage: 'https://www.logitech.com/' },
  { name: '雷蛇', aliases: ['雷蛇', 'razer'], domains: ['razer.com'], homepage: 'https://www.razer.com/' },
  { name: '金士顿', aliases: ['金士顿', 'kingston'], domains: ['kingston.com'], homepage: 'https://www.kingston.com/' },
  { name: '希捷', aliases: ['希捷', 'seagate'], domains: ['seagate.com'], homepage: 'https://www.seagate.com/' },
  { name: '西部数据', aliases: ['西部数据', 'westerndigital', 'wd'], domains: ['westerndigital.com'], homepage: 'https://www.westerndigital.com/' },
  // ---- 汽车 / 出行 ----
  { name: '特斯拉', aliases: ['特斯拉', 'tesla'], domains: ['tesla.com'], homepage: 'https://www.tesla.com/' },
  { name: '比亚迪', aliases: ['比亚迪', 'byd'], domains: ['byd.com'], homepage: 'https://www.byd.com/' },
  { name: '蔚来', aliases: ['蔚来', 'nio'], domains: ['nio.com'], homepage: 'https://www.nio.com/' },
  { name: '理想汽车', aliases: ['理想汽车', '理想', 'li auto'], domains: ['lixiang.com'], homepage: 'https://www.lixiang.com/' },
  { name: '小鹏汽车', aliases: ['小鹏汽车', '小鹏', 'xpeng'], domains: ['xpeng.com'], homepage: 'https://www.xpeng.com/' },
  { name: '吉利汽车', aliases: ['吉利汽车', '吉利', 'geely'], domains: ['geely.com'], homepage: 'https://www.geely.com/' },
  { name: '长城汽车', aliases: ['长城汽车', 'gwm'], domains: ['gwm.com.cn'], homepage: 'https://www.gwm.com.cn/' },
  { name: '奇瑞汽车', aliases: ['奇瑞', 'chery'], domains: ['chery.cn'], homepage: 'https://www.chery.cn/' },
  { name: '上汽集团', aliases: ['上汽集团', '上汽', 'saic'], domains: ['saicmotor.com'], homepage: 'https://www.saicmotor.com/' },
  { name: '广汽集团', aliases: ['广汽集团', '广汽', 'gac'], domains: ['gac.com.cn'], homepage: 'https://www.gac.com.cn/' },
  { name: '宁德时代', aliases: ['宁德时代', 'catl'], domains: ['catl.com'], homepage: 'https://www.catl.com/' },
  { name: '丰田', aliases: ['丰田', 'toyota'], domains: ['toyota.com'], homepage: 'https://www.toyota.com/' },
  { name: '大众汽车', aliases: ['大众汽车', 'volkswagen'], domains: ['volkswagen.com'], homepage: 'https://www.volkswagen.com/' },
  { name: '宝马', aliases: ['宝马', 'bmw'], domains: ['bmw.com'], homepage: 'https://www.bmw.com/' },
  { name: '奔驰', aliases: ['奔驰', 'mercedes-benz'], domains: ['mercedes-benz.com'], homepage: 'https://www.mercedes-benz.com/' },
  // ---- 金融 / 银行 ----
  { name: '中国银行', aliases: ['中国银行', 'boc'], domains: ['boc.cn'], homepage: 'https://www.boc.cn/' },
  { name: '工商银行', aliases: ['工商银行', 'icbc'], domains: ['icbc.com.cn'], homepage: 'https://www.icbc.com.cn/' },
  { name: '建设银行', aliases: ['建设银行', 'ccb'], domains: ['ccb.com'], homepage: 'https://www.ccb.com/' },
  { name: '农业银行', aliases: ['农业银行', 'abchina'], domains: ['abchina.com'], homepage: 'https://www.abchina.com/' },
  { name: '交通银行', aliases: ['交通银行', 'bankcomm'], domains: ['bankcomm.com'], homepage: 'https://www.bankcomm.com/' },
  { name: '招商银行', aliases: ['招商银行', 'cmbchina'], domains: ['cmbchina.com'], homepage: 'https://www.cmbchina.com/' },
  { name: '中信银行', aliases: ['中信银行', 'citicbank'], domains: ['citicbank.com'], homepage: 'https://www.citicbank.com/' },
  { name: '浦发银行', aliases: ['浦发银行', 'spdb'], domains: ['spdb.com.cn'], homepage: 'https://www.spdb.com.cn/' },
  { name: '民生银行', aliases: ['民生银行', 'cmbc'], domains: ['cmbc.com.cn'], homepage: 'https://www.cmbc.com.cn/' },
  { name: '兴业银行', aliases: ['兴业银行', 'cib'], domains: ['cib.com.cn'], homepage: 'https://www.cib.com.cn/' },
  { name: '平安银行', aliases: ['平安银行'], domains: ['bank.pingan.com'], homepage: 'https://bank.pingan.com/' },
  { name: '邮储银行', aliases: ['邮储银行', 'psbc'], domains: ['psbc.com'], homepage: 'https://www.psbc.com/' },
  { name: '中国银联', aliases: ['中国银联', 'unionpay'], domains: ['unionpay.com'], homepage: 'https://www.unionpay.com/' },
  { name: '东方财富', aliases: ['东方财富', 'eastmoney'], domains: ['eastmoney.com'], homepage: 'https://www.eastmoney.com/' },
  { name: '同花顺', aliases: ['同花顺', '10jqka'], domains: ['10jqka.com.cn'], homepage: 'https://www.10jqka.com.cn/' },
  { name: '雪球', aliases: ['雪球', 'xueqiu'], domains: ['xueqiu.com'], homepage: 'https://xueqiu.com/' },
  // ---- 生活 / 消费 / 零售 ----
  { name: '海底捞', aliases: ['海底捞', 'haidilao'], domains: ['haidilao.com'], homepage: 'https://www.haidilao.com/' },
  { name: '瑞幸咖啡', aliases: ['瑞幸', 'luckin'], domains: ['luckincoffee.com'], homepage: 'https://www.luckincoffee.com/' },
  { name: '喜茶', aliases: ['喜茶', 'heytea'], domains: ['heytea.com'], homepage: 'https://www.heytea.com/' },
  { name: '星巴克', aliases: ['星巴克', 'starbucks'], domains: ['starbucks.com'], homepage: 'https://www.starbucks.com/' },
  { name: '肯德基', aliases: ['肯德基', 'kfc'], domains: ['kfc.com.cn'], homepage: 'https://www.kfc.com.cn/' },
  { name: '麦当劳', aliases: ['麦当劳', 'mcdonalds'], domains: ['mcdonalds.com.cn'], homepage: 'https://www.mcdonalds.com.cn/' },
  { name: '必胜客', aliases: ['必胜客', 'pizzahut'], domains: ['pizzahut.com.cn'], homepage: 'https://www.pizzahut.com.cn/' },
  { name: '可口可乐', aliases: ['可口可乐', 'cocacola'], domains: ['cocacola.com.cn'], homepage: 'https://www.cocacola.com.cn/' },
  { name: '百事可乐', aliases: ['百事可乐', 'pepsi'], domains: ['pepsi.com.cn'], homepage: 'https://www.pepsi.com.cn/' },
  { name: '农夫山泉', aliases: ['农夫山泉', 'nongfuspring'], domains: ['nongfuspring.com'], homepage: 'https://www.nongfuspring.com/' },
  { name: '伊利', aliases: ['伊利', 'yili'], domains: ['yili.com'], homepage: 'https://www.yili.com/' },
  { name: '蒙牛', aliases: ['蒙牛', 'mengniu'], domains: ['mengniu.com'], homepage: 'https://www.mengniu.com/' },
  { name: '茅台', aliases: ['茅台', 'moutai'], domains: ['moutai.com.cn'], homepage: 'https://www.moutai.com.cn/' },
  { name: '五粮液', aliases: ['五粮液', 'wuliangye'], domains: ['wuliangye.com.cn'], homepage: 'https://www.wuliangye.com.cn/' },
  { name: '盒马', aliases: ['盒马', 'freshippo'], domains: ['freshippo.com'], homepage: 'https://www.freshippo.com/' },
  { name: '宜家', aliases: ['宜家', 'ikea'], domains: ['ikea.com'], homepage: 'https://www.ikea.com/' },
  { name: '无印良品', aliases: ['无印良品', 'muji'], domains: ['muji.com'], homepage: 'https://www.muji.com/' },
  { name: '优衣库', aliases: ['优衣库', 'uniqlo'], domains: ['uniqlo.com'], homepage: 'https://www.uniqlo.com/' },
  { name: '耐克', aliases: ['耐克', 'nike'], domains: ['nike.com'], homepage: 'https://www.nike.com/' },
  { name: '阿迪达斯', aliases: ['阿迪达斯', 'adidas'], domains: ['adidas.com'], homepage: 'https://www.adidas.com/' },
  { name: '李宁', aliases: ['李宁', 'lining'], domains: ['lining.com'], homepage: 'https://www.lining.com/' },
  { name: '安踏', aliases: ['安踏', 'anta'], domains: ['anta.com'], homepage: 'https://www.anta.com/' },
  { name: '顺丰', aliases: ['顺丰', 'sf-express'], domains: ['sf-express.com'], homepage: 'https://www.sf-express.com/' },
  { name: '菜鸟', aliases: ['菜鸟', 'cainiao'], domains: ['cainiao.com'], homepage: 'https://www.cainiao.com/' },
  { name: '京东物流', aliases: ['京东物流', 'jdl'], domains: ['jdl.cn'], homepage: 'https://www.jdl.cn/' },
  // ---- 房产 / 生活服务 ----
  { name: '贝壳找房', aliases: ['贝壳找房', '贝壳', 'ke.com'], domains: ['ke.com'], homepage: 'https://www.ke.com/' },
  { name: '链家', aliases: ['链家', 'lianjia'], domains: ['lianjia.com'], homepage: 'https://www.lianjia.com/' },
  { name: '自如', aliases: ['自如', 'ziroom'], domains: ['ziroom.com'], homepage: 'https://www.ziroom.com/' },
  { name: '58同城', aliases: ['58同城', '58.com'], domains: ['58.com'], homepage: 'https://www.58.com/' },
  { name: '安居客', aliases: ['安居客', 'anjuke'], domains: ['anjuke.com'], homepage: 'https://www.anjuke.com/' },
  { name: '飞猪', aliases: ['飞猪', 'fliggy'], domains: ['fliggy.com'], homepage: 'https://www.fliggy.com/' },
  { name: '马蜂窝', aliases: ['马蜂窝', 'mafengwo'], domains: ['mafengwo.cn'], homepage: 'https://www.mafengwo.cn/' },
  { name: '12306', aliases: ['12306', '铁路12306'], domains: ['12306.cn'], homepage: 'https://www.12306.cn/' },
  // ---- 媒体 / 资讯 ----
  { name: '36氪', aliases: ['36氪', '36kr'], domains: ['36kr.com'], homepage: 'https://36kr.com/' },
  { name: '虎嗅', aliases: ['虎嗅', 'huxiu'], domains: ['huxiu.com'], homepage: 'https://www.huxiu.com/' },
  { name: '钛媒体', aliases: ['钛媒体', 'tmtpost'], domains: ['tmtpost.com'], homepage: 'https://www.tmtpost.com/' },
  { name: '机器之心', aliases: ['机器之心', 'jiqizhixin'], domains: ['jiqizhixin.com'], homepage: 'https://www.jiqizhixin.com/' },
  { name: '量子位', aliases: ['量子位', 'qbitai'], domains: ['qbitai.com'], homepage: 'https://www.qbitai.com/' },
  { name: '少数派', aliases: ['少数派', 'sspai'], domains: ['sspai.com'], homepage: 'https://sspai.com/' },
  { name: '爱范儿', aliases: ['爱范儿', 'ifanr'], domains: ['ifanr.com'], homepage: 'https://www.ifanr.com/' },
  { name: '极客公园', aliases: ['极客公园', 'geekpark'], domains: ['geekpark.net'], homepage: 'https://www.geekpark.net/' },
  { name: 'IT之家', aliases: ['it之家', 'ithome'], domains: ['ithome.com'], homepage: 'https://www.ithome.com/' },
  { name: '中关村在线', aliases: ['中关村在线', 'zol'], domains: ['zol.com.cn'], homepage: 'https://www.zol.com.cn/' },
  { name: '太平洋电脑网', aliases: ['太平洋电脑网', 'pconline'], domains: ['pconline.com.cn'], homepage: 'https://www.pconline.com.cn/' },
  { name: '澎湃新闻', aliases: ['澎湃新闻', '澎湃', 'thepaper'], domains: ['thepaper.cn'], homepage: 'https://www.thepaper.cn/' },
  { name: '财新', aliases: ['财新', 'caixin'], domains: ['caixin.com'], homepage: 'https://www.caixin.com/' },
  { name: '第一财经', aliases: ['第一财经', 'yicai'], domains: ['yicai.com'], homepage: 'https://www.yicai.com/' },
  { name: '新浪', aliases: ['新浪', 'sina'], domains: ['sina.com.cn'], homepage: 'https://www.sina.com.cn/' },
  { name: '搜狐', aliases: ['搜狐', 'sohu'], domains: ['sohu.com'], homepage: 'https://www.sohu.com/' },
  { name: '凤凰网', aliases: ['凤凰网', 'ifeng'], domains: ['ifeng.com'], homepage: 'https://www.ifeng.com/' },
  { name: '新华网', aliases: ['新华网', 'xinhua'], domains: ['xinhuanet.com'], homepage: 'https://www.xinhuanet.com/' },
  { name: '人民网', aliases: ['人民网', 'people'], domains: ['people.com.cn'], homepage: 'https://www.people.com.cn/' },
  { name: '央视网', aliases: ['央视网', '央视', 'cctv'], domains: ['cctv.com'], homepage: 'https://www.cctv.com/' },
  { name: '中国新闻网', aliases: ['中国新闻网', '中新网', 'chinanews'], domains: ['chinanews.com.cn'], homepage: 'https://www.chinanews.com.cn/' },
  { name: '环球网', aliases: ['环球网', 'huanqiu'], domains: ['huanqiu.com'], homepage: 'https://www.huanqiu.com/' },
  { name: '观察者网', aliases: ['观察者网', 'guancha'], domains: ['guancha.cn'], homepage: 'https://www.guancha.cn/' },
  // ---- 阅读 / 教育 ----
  { name: '起点中文网', aliases: ['起点中文网', '起点', 'qidian'], domains: ['qidian.com'], homepage: 'https://www.qidian.com/' },
  { name: '晋江文学城', aliases: ['晋江文学城', '晋江', 'jjwxc'], domains: ['jjwxc.net'], homepage: 'https://www.jjwxc.net/' },
  { name: '番茄小说', aliases: ['番茄小说', 'fanqie'], domains: ['fanqienovel.com'], homepage: 'https://fanqienovel.com/' },
  { name: '微信读书', aliases: ['微信读书'], domains: ['weread.qq.com'], homepage: 'https://weread.qq.com/' },
  { name: '喜马拉雅', aliases: ['喜马拉雅', 'ximalaya'], domains: ['ximalaya.com'], homepage: 'https://www.ximalaya.com/' },
  { name: '得到', aliases: ['得到', 'dedao'], domains: ['dedao.cn'], homepage: 'https://www.dedao.cn/' },
  { name: '新东方', aliases: ['新东方', 'xdf'], domains: ['xdf.cn'], homepage: 'https://www.xdf.cn/' },
  { name: '学而思', aliases: ['学而思', 'xueersi'], domains: ['xueersi.com'], homepage: 'https://www.xueersi.com/' },
  { name: '猿辅导', aliases: ['猿辅导', 'yuanfudao'], domains: ['yuanfudao.com'], homepage: 'https://www.yuanfudao.com/' },
  { name: '作业帮', aliases: ['作业帮', 'zuoyebang'], domains: ['zuoyebang.com'], homepage: 'https://www.zuoyebang.com/' },
  { name: '中国大学MOOC', aliases: ['中国大学mooc', 'icourse163'], domains: ['icourse163.org'], homepage: 'https://www.icourse163.org/' },
  { name: '网易有道', aliases: ['网易有道', '有道', 'youdao'], domains: ['youdao.com'], homepage: 'https://www.youdao.com/' },
  { name: '京东读书', aliases: ['京东读书'], domains: ['e.jd.com'], homepage: 'https://e.jd.com/' },
]

/**
 * 匹配别名：中文按子串，英文按词边界（避免 "ai" 这类词根误伤）。
 * @param {string} query 已小写化的查询
 * @param {string} alias 已小写化的别名
 * @returns {boolean}
 */
function aliasMatches(query, alias) {
  if (alias === '') return false
  if (/[\u4e00-\u9fff]/.test(alias)) return query.includes(alias)
  if (alias.length < 2) return false
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(query)
}

/**
 * 主机名归一化：去掉 www. 前缀并小写。
 * @param {string} hostname
 * @returns {string}
 */
function rootHost(hostname) {
  return hostname.toLowerCase().replace(/^www\./, '')
}

/**
 * 把设置里的自定义映射归一化成内置表同构的条目；非法项跳过。
 * @param {unknown} extraSites
 * @returns {Array<{ name: string, aliases: string[], domains: string[], homepage: string }>}
 */
export function normalizeCustomOfficialSites(extraSites) {
  if (!Array.isArray(extraSites)) return []
  const out = []
  for (const raw of extraSites) {
    if (raw === null || typeof raw !== 'object') continue
    const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, 40) : ''
    if (name === '') continue
    const homepage = typeof raw.homepage === 'string' ? raw.homepage.trim() : ''
    let parsed = null
    try {
      parsed = new URL(homepage)
    } catch {
      continue
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') continue
    const aliasInput = Array.isArray(raw.aliases)
      ? raw.aliases
      : typeof raw.aliases === 'string'
        ? raw.aliases.split(/[,，、;；]/)
        : []
    const aliases = []
    for (const alias of aliasInput) {
      const text = typeof alias === 'string' ? alias.trim() : ''
      if (text !== '' && !aliases.includes(text)) aliases.push(text.slice(0, 40))
      if (aliases.length >= 10) break
    }
    if (aliases.length === 0) aliases.push(name)
    const host = parsed.hostname
    out.push({ name, aliases, domains: [...new Set([rootHost(host), host])], homepage })
    if (out.length >= 100) break
  }
  return out
}

/**
 * 从查询里识别品牌官网。自定义映射优先于内置表（同长度别名时）。
 *
 * @param {unknown} query
 * @param {ReadonlyArray<object>} [extraSites] 设置里的自定义映射
 * @returns {{ name: string, domains: string[], homepage: string } | null} 命中时返回品牌名、官方域名与官网首页；否则 null
 */
export function officialInfoForQuery(query, extraSites) {
  const normalized = typeof query === 'string' ? query.toLowerCase().replace(/\s+/g, ' ').trim() : ''
  if (normalized === '') return null
  const sites = normalizeCustomOfficialSites(extraSites).concat(OFFICIAL_SITES)
  let best = null
  for (const site of sites) {
    for (const alias of site.aliases) {
      const lowered = alias.toLowerCase()
      if (!aliasMatches(normalized, lowered)) continue
      if (best === null || lowered.length > best.aliasLength) {
        best = { name: site.name, domains: site.domains, homepage: site.homepage, aliasLength: lowered.length }
      }
    }
  }
  return best === null ? null : { name: best.name, domains: best.domains, homepage: best.homepage }
}

/**
 * 域名是否属于官方域名（含子域名，如 mp.weixin.qq.com 属于 weixin.qq.com）。
 *
 * @param {string} domain
 * @param {ReadonlyArray<string>} officialDomains
 * @returns {boolean}
 */
export function isOfficialDomain(domain, officialDomains) {
  if (typeof domain !== 'string' || !Array.isArray(officialDomains)) return false
  const lowered = domain.toLowerCase()
  return officialDomains.some((entry) => lowered === entry || lowered.endsWith(`.${entry}`))
}

/**
 * 判断一个 URL 是否就是这个品牌的**官网首页**：根域名（忽略 www）+ 根路径。
 * 官网域名下的其它页面（股价、文章、下载页）不算。
 *
 * @param {unknown} url
 * @param {{ homepage: string } | null | undefined} info officialInfoForQuery 的返回值
 * @returns {boolean}
 */
export function isOfficialHomepage(url, info) {
  if (info === null || info === undefined || typeof info.homepage !== 'string') return false
  if (typeof url !== 'string' || url === '') return false
  let target = null
  let expected = null
  try {
    target = new URL(url)
    expected = new URL(info.homepage)
  } catch {
    return false
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') return false
  const path = target.pathname.replace(/\/+$/, '') || '/'
  if (path !== '/' && path !== '/index.html' && path !== '/index.htm') return false
  return rootHost(target.hostname) === rootHost(expected.hostname)
}
