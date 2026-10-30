/**
 * 官网识别：把常见品牌名/别名映射到官方域名。
 *
 * 用途：浏览模式搜索品牌词（如「微信」「淘宝」「DeepSeek」）时，
 * 识别结果里的官网（含子域名）并在「综合」最前面展示 + 标「官方」；
 * 若检索结果里没有官网，则在第 1 页补一条官网条目（只补已知品牌，避免瞎猜）。
 *
 * 映射是"高精度优先"的：宁可漏认，也不把第三方站点标成官方。
 */

/** 品牌 → 别名 + 官方域名。别名不区分大小写；中文按子串匹配，英文按词边界匹配。 */
const OFFICIAL_SITES = [
  { name: '微信', aliases: ['微信', 'wechat', 'weixin'], domains: ['weixin.qq.com'] },
  { name: 'QQ', aliases: ['qq'], domains: ['qq.com'] },
  { name: '腾讯', aliases: ['腾讯', 'tencent'], domains: ['tencent.com'] },
  { name: '淘宝', aliases: ['淘宝', 'taobao'], domains: ['taobao.com'] },
  { name: '天猫', aliases: ['天猫', 'tmall'], domains: ['tmall.com'] },
  { name: '支付宝', aliases: ['支付宝', 'alipay'], domains: ['alipay.com'] },
  { name: '阿里巴巴', aliases: ['阿里巴巴', 'alibaba'], domains: ['alibaba.com'] },
  { name: '京东', aliases: ['京东', 'jd'], domains: ['jd.com'] },
  { name: '拼多多', aliases: ['拼多多', 'pinduoduo'], domains: ['pinduoduo.com'] },
  { name: '抖音', aliases: ['抖音', 'douyin'], domains: ['douyin.com'] },
  { name: 'TikTok', aliases: ['tiktok'], domains: ['tiktok.com'] },
  { name: '快手', aliases: ['快手', 'kuaishou'], domains: ['kuaishou.com'] },
  { name: '小红书', aliases: ['小红书', 'xiaohongshu'], domains: ['xiaohongshu.com'] },
  { name: '微博', aliases: ['微博', 'weibo'], domains: ['weibo.com'] },
  { name: '知乎', aliases: ['知乎', 'zhihu'], domains: ['zhihu.com'] },
  { name: '哔哩哔哩', aliases: ['哔哩哔哩', 'b站', 'bilibili'], domains: ['bilibili.com'] },
  { name: '百度', aliases: ['百度', 'baidu'], domains: ['baidu.com'] },
  { name: '美团', aliases: ['美团', 'meituan'], domains: ['meituan.com'] },
  { name: '大众点评', aliases: ['大众点评', 'dianping'], domains: ['dianping.com'] },
  { name: '饿了么', aliases: ['饿了么', 'eleme', 'ele.me'], domains: ['ele.me'] },
  { name: '滴滴', aliases: ['滴滴', 'didi'], domains: ['didiglobal.com'] },
  { name: '高德地图', aliases: ['高德', '高德地图', 'amap'], domains: ['amap.com'] },
  { name: '携程', aliases: ['携程', 'ctrip'], domains: ['ctrip.com'] },
  { name: '去哪儿', aliases: ['去哪儿', 'qunar'], domains: ['qunar.com'] },
  { name: '网易', aliases: ['网易', 'netease'], domains: ['163.com'] },
  { name: '小米', aliases: ['小米', 'xiaomi'], domains: ['mi.com'] },
  { name: '华为', aliases: ['华为', 'huawei'], domains: ['huawei.com'] },
  { name: '荣耀', aliases: ['荣耀', 'honor'], domains: ['honor.com'] },
  { name: '联想', aliases: ['联想', 'lenovo'], domains: ['lenovo.com'] },
  { name: '字节跳动', aliases: ['字节跳动', 'bytedance'], domains: ['bytedance.com'] },
  { name: '今日头条', aliases: ['今日头条', 'toutiao'], domains: ['toutiao.com'] },
  { name: '飞书', aliases: ['飞书', 'feishu'], domains: ['feishu.cn'] },
  { name: '钉钉', aliases: ['钉钉', 'dingtalk'], domains: ['dingtalk.com'] },
  { name: 'WPS', aliases: ['wps', '金山办公'], domains: ['wps.cn'] },
  { name: 'DeepSeek', aliases: ['deepseek', '深度求索'], domains: ['deepseek.com'] },
  { name: 'OpenAI', aliases: ['openai'], domains: ['openai.com'] },
  { name: 'Google', aliases: ['google', '谷歌'], domains: ['google.com'] },
  { name: '微软', aliases: ['微软', 'microsoft'], domains: ['microsoft.com'] },
  { name: '苹果', aliases: ['苹果', 'apple'], domains: ['apple.com'] },
  { name: 'GitHub', aliases: ['github'], domains: ['github.com'] },
  { name: 'YouTube', aliases: ['youtube'], domains: ['youtube.com'] },
  { name: '亚马逊', aliases: ['亚马逊', 'amazon'], domains: ['amazon.com'] },
  { name: '英伟达', aliases: ['英伟达', 'nvidia'], domains: ['nvidia.com'] },
  { name: '特斯拉', aliases: ['特斯拉', 'tesla'], domains: ['tesla.com'] },
  { name: '三星', aliases: ['三星', 'samsung'], domains: ['samsung.com'] },
  { name: '索尼', aliases: ['索尼', 'sony'], domains: ['sony.com'] },
  { name: '耐克', aliases: ['耐克', 'nike'], domains: ['nike.com'] },
  { name: '星巴克', aliases: ['星巴克', 'starbucks'], domains: ['starbucks.com'] },
  { name: '招商银行', aliases: ['招商银行', 'cmbchina'], domains: ['cmbchina.com'] },
  { name: '工商银行', aliases: ['工商银行', 'icbc'], domains: ['icbc.com.cn'] },
  { name: '建设银行', aliases: ['建设银行', 'ccb'], domains: ['ccb.com'] },
  { name: '中国移动', aliases: ['中国移动', '10086'], domains: ['10086.cn'] },
  { name: '中国联通', aliases: ['中国联通', 'chinaunicom'], domains: ['chinaunicom.com'] },
  { name: '中国电信', aliases: ['中国电信', 'chinatelecom'], domains: ['chinatelecom.com.cn'] },
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
 * 从查询里识别品牌官网。
 *
 * @param {unknown} query
 * @returns {{ name: string, domains: string[] } | null} 命中时返回品牌名与官方域名；否则 null
 */
export function officialInfoForQuery(query) {
  const normalized = typeof query === 'string' ? query.toLowerCase().replace(/\s+/g, ' ').trim() : ''
  if (normalized === '') return null
  let best = null
  for (const site of OFFICIAL_SITES) {
    for (const alias of site.aliases) {
      const lowered = alias.toLowerCase()
      if (!aliasMatches(normalized, lowered)) continue
      if (best === null || lowered.length > best.aliasLength) {
        best = { name: site.name, domains: site.domains, aliasLength: lowered.length }
      }
    }
  }
  return best === null ? null : { name: best.name, domains: best.domains }
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
