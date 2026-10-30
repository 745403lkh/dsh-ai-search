# 鏇存柊鏃ュ織 / Changelog

## [1.4.4-beta.4] - 2026-10-30

### 涓枃

**鏂板**
- 瀹樼綉璇嗗埆鏄犲皠**鍙栨秷鏁伴噺涓婇檺**锛屽苟鏀寔浠?**Excel锛?xlsx锛? CSV** 瀵煎叆锛氳〃鏍煎垪涓?  鍝佺墝鍚?| 鍒悕锛堥€楀彿鍒嗛殧锛墊 瀹樼綉棣栭〉锛屽鍏ユ椂鑷姩鍘婚噸銆佸悎骞惰繘鐜版湁鏄犲皠
- 娴忚妯″紡**鍥剧墖鏉垮潡澶氭簮妫€绱?*锛氬儚瑙嗛涓€鏍风敤 `site:` 瀹氬悜鍥剧墖绔欙紙Unsplash / Pexels / Pixabay /
  鑺辩摚 / 鍫嗙硸 绛夋寜椤佃疆鎹級锛屽浘鐗囩被鍨嬪彧璁ゅ浘鐗囩珯锛屽噺灏戞櫘閫氱綉椤垫贩鍏?
**鏀硅繘**
- **缂╃暐鍥炬湁鎵嶆樉绀?*锛氭嬁涓嶅埌鍥剧殑鍗＄墖涓嶅啀鏄剧ず绌哄浘鐗囨锛屾敼涓虹函鏂囧瓧鍗＄墖锛?  鍥剧墖 URL 鐩撮摼鐩存帴褰撶缉鐣ュ浘锛堢渷涓€娆℃姄鍙栵級锛孻ouTube 浠嶈嚜鍔ㄦ帹瀵煎皝闈紝鍏朵綑鎶?`og:image`
- **鍥剧墖鏉垮潡鍙斁鏈夊浘鐨勬潯鐩?*锛氭病鎶撳埌缂╃暐鍥剧殑鍥剧墖鏉＄洰闄嶇骇涓烘櫘閫氭潯鐩紙鏂囧瓧灞曠ず锛夛紝涓嶅啀鍑虹幇绌哄浘鍗犱綅

**娴嬭瘯**
- 6 涓嚜娴嬪浠跺叏閮ㄩ€氳繃锛涙柊澧炪€屾棤鍥炬潯鐩檷绾с€嶃€岀洿閾惧浘鐗囦笉鎶撳彇銆嶃€屽浘鐗囨爮鍙惈鏈夊浘鏉＄洰銆?  銆孋SV/XLSX 瀵煎叆瑙ｆ瀽銆嶃€屾槧灏勪笉闄愰噺銆嶇瓑鏂█

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

### 涓枃

**鏂板**
- 鍐呯疆瀹樼綉鏄犲皠浠?50+ 鎵╁厖鍒?**200+ 鍝佺墝**锛氭柊澧炲繀搴斻€丼team銆丒pic銆佺背鍝堟父銆佸師绁炪€佸穿鍧忕郴鍒椼€?  浠诲ぉ鍫?PlayStation/Xbox銆佽吘璁簯/闃块噷浜?鍗庝负浜戙€丆hatGPT/Claude/Gemini/閫氫箟/鏂囧績涓€瑷€/璞嗗寘/Kimi銆?  姹借溅/閾惰/椁愰ギ/闆跺敭/濯掍綋/鏁欒偛绛夊父瑙佸搧鐗?- 璁剧疆閲屾柊澧?*銆屽畼缃戣瘑鍒槧灏勩€嶇紪杈戝櫒**锛氬彲鑷畾涔夊搧鐗屽悕銆佸埆鍚嶏紙閫楀彿鍒嗛殧锛変笌瀹樼綉棣栭〉 URL锛?  鍙坊鍔犲涓€佸彲鍒犻櫎锛涜嚜瀹氫箟鏄犲皠浼樺厛浜庡唴缃〃锛屼繚瀛樺悗绔嬪嵆鐢熸晥
- 娴忚妯″紡鐨勫畼缃戣瘑鍒幇鍦ㄤ細璇诲彇璁剧疆閲岀殑鑷畾涔夋槧灏勶紙Host 渚ф瘡娆℃绱㈠疄鏃朵娇鐢級

**娴嬭瘯**
- 6 涓嚜娴嬪浠跺叏閮ㄩ€氳繃锛涙柊澧炲繀搴?Steam/绫冲搱娓?鍘熺鏄犲皠銆佽嚜瀹氫箟鏄犲皠浼樺厛銆佽缃繚瀛?闈炴硶椤?娓呯┖銆?  鑷畾涔夋槧灏勬帴鍏ユ祻瑙堟ā寮忕瓑鏂█

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

### 涓枃

**淇**
- 瀹樼綉璇嗗埆鏀逛负**鍙瀹樼綉棣栭〉**锛氬彧鎶婂搧鐗屽畼缃戦椤碉紙濡?`www.baidu.com`锛夌疆椤跺苟鏍囥€屽畼鏂广€嶏紱
  瀹樼綉鍩熷悕涓嬬殑鍏跺畠椤甸潰锛堝 `ir.baidu.com` 鑲′环椤点€乣www.baidu.com/s?wd=` 鎼滅储椤碉級涓嶅啀琚綋鎴愬畼缃?- 淇濊瘉绗?1 椤典竴瀹氭湁瀹樼綉棣栭〉锛氭绱㈢粨鏋滈噷娌℃湁棣栭〉鏃惰ˉ涓€鏉￠椤垫潯鐩紱绗?2 椤佃捣涓嶉噸澶?
**娴嬭瘯**
- 6 涓嚜娴嬪浠跺叏閮ㄩ€氳繃锛涙柊澧炪€岃偂浠烽〉涓嶇畻瀹樼綉銆嶃€屾悳绱㈤〉涓嶇畻瀹樼綉銆嶃€岃ˉ棣栭〉骞剁疆椤躲€嶇瓑鏂█

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

### 涓枃

**鏂板**
- 娴忚妯″紡**瀹樼綉璇嗗埆**锛氬唴缃父瑙佸搧鐗?鈫?瀹樻柟鍩熷悕鏄犲皠锛堝井淇°€佹窐瀹濄€佷含涓溿€佹姈闊炽€佺櫨搴︺€丏eepSeek銆?  Google銆佸井杞瓑 50+ 鍝佺墝锛夛紝鍝佺墝璇嶆悳绱㈡椂瀹樼綉缁撴灉缃《骞舵爣銆屽畼鏂广€?- 妫€绱㈢粨鏋滈噷娌℃湁瀹樼綉鏃讹紝绗?1 椤佃嚜鍔ㄨˉ涓€鏉″畼缃戦椤碉紙绗?2 椤佃捣涓嶉噸澶嶏級锛屽崱鐗囦笌宸ュ叿杈撳嚭閮藉甫瀹樻柟鏍囪瘑
- 銆岀患鍚堛€嶆澘鍧楁柊澧炪€屽畼鏂广€嶇疆椤跺垎缁勶紱鍒嗘爮鍐呭畼缃戞潯鐩悓鏍风疆椤?
**鏀硅繘**
- `curated_search` 宸ュ叿杈撳嚭鏂板 `browse.items[].official` 瀛楁锛屾覆鏌撲负銆屄?瀹樻柟銆?
**娴嬭瘯**
- 6 涓嚜娴嬪浠跺叏閮ㄩ€氳繃锛涙柊澧炲畼缃戞槧灏勩€佸瓙鍩熷悕璇嗗埆銆佺疆椤舵帓搴忋€佽ˉ瀹樼綉棣栭〉銆侀潪鍝佺墝璇嶄笉璇爣绛夋柇瑷€

### English

**Added**
- Browse mode **official-site recognition**: a curated brand 鈫?official-domain map (WeChat, Taobao,
  JD, Douyin, Baidu, DeepSeek, Google, Microsoft and 50+ more). Brand queries pin the official site
  first and badge it "Official"
- When search results contain no official site, page 1 adds a synthetic official homepage entry
  (not repeated on later pages); cards and tool output both show the official marker
- The All board renders a pinned "Official" group first; official items are also pinned inside boards

**Changed**
- `curated_search` output gains `browse.items[].official`, rendered as "路 瀹樻柟"/"路 Official"

**Testing**
- All 6 test suites pass; added assertions for the brand map, subdomain recognition, pinning order,
  synthetic official homepage, and no false positives on non-brand queries

## [1.4.3-fix1] - 2026-10-30

### 涓枃

**淇**
- `package.json` 琛ラ綈 `repository` / `homepage` / `bugs` / `license`锛圡IT锛? `keywords` / `author`锛?  npm 椤甸潰鐜板湪鑳介摼鎺ュ洖 GitHub 浠撳簱
- 绛旂枒妯″紡鐨勩€岀簿璇汇€嶅彛寰勶細鏂板 `fetchAttempted` / `fetchFailed` / `curationBasis` 缁熻锛?  姝ｆ枃鏈鍙栨垨鍙鍒伴儴鍒嗘椂锛岀晫闈笌宸ュ叿鏂囨鏀逛负銆岀簿璇?x/y 绡囥€嶆垨銆屾湭璇诲彇姝ｆ枃锛堟憳瑕佸熀浜庢绱㈢墖娈碉級銆嶏紝
  涓嶅啀鍑虹幇銆岀簿璇?0 绡囥€嶅嵈浠嶆湁鎽樿鐨勮瀵?- `curated_search` 宸ュ叿琛ラ綈 `exclude` 鍙傛暟骞跺湪娴忚妯″紡缈婚〉鏃堕€忎紶锛岀炕椤靛彲浠ユ寜 URL 鍘婚噸
  锛堟鍓嶅彧鏈夊鎴风浼氫紶 exclude锛?- 娴忚妯″紡锛氥€岀患鍚堛€嶆敼涓哄叏閮ㄥ€欓€夛紙鏈€澶?36 鏉★級鎸夊姞鏉冨垎鎺掑簭锛屾枃绔?/ 瑙嗛 / 鍥剧墖鍒嗘爮鏄畠鐨?  瀛愰泦锛堝悇鏈€澶?12 鏉★級锛屼慨澶嶃€屽垎鏍忛噷鍑虹幇缁煎悎涓病鏈夌殑鏉＄洰銆?
**娴嬭瘯**
- 6 涓嚜娴嬪浠跺叏閮ㄩ€氳繃锛涙柊澧炰簡鍒嗘爮 鈯?缁煎悎銆佸伐鍏?exclude 閫忎紶銆佺簿璇诲彛寰勬彁绀虹瓑鏂█

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

### 涓枃

**鏂板**
- **鏇村ソ鐨勪晶杈规爮锛坉sh-better-sidebar锛夐€傞厤**锛氬湪瀹夸富鍙充晶鏍忔敞鍐屻€孉I 鎼滅储銆嶉〉绛撅紙鍙湪璁剧疆閲屽叧闂級
- 渚ц竟鏍忛噷鐨勬悳绱㈤〉宸︿晶甯?*寮曟搸鏍?*锛欰I 鎼滅储锛堥粯璁わ級/ 鐧惧害 / 蹇呭簲 / Google / 鎼滅嫍 + 鑷畾涔夊紩鎿?- **鍍忔祻瑙堝櫒涓€鏍峰寮€**锛氬彸渚ф爮鍙悓鏃舵墦寮€澶氫釜 AI 鎼滅储椤电锛屾瘡涓〉绛炬湁鐙珛鐨勮緭鍏ャ€佹ā寮忋€佺粨鏋滀笌鏉垮潡
- 缁撴灉 / 鏉ユ簮 / 鍥剧墖 / 娴忚鍗＄墖榛樿鍦?*渚ц竟鏍忔祻瑙堝櫒**閲屾墦寮€锛屼篃鍙敼涓虹郴缁熼粯璁ゆ祻瑙堝櫒
- 璁剧疆閲屽彲娣诲姞**澶氫釜鑷畾涔夋悳绱㈠紩鎿?*锛堝悕绉?+ 缃戝潃妯℃澘锛宍*#*#*#*` 浠ｆ浛鎼滅储璇嶏級锛屽彲鍒犻櫎銆佸彲璁句负榛樿
- 缁熶竴椋庢牸鐨勫紩鎿庡浘鏍囷紙24脳24 鍗曡壊锛夛細鐧惧害 / Google 鐢ㄥ畼鏂?logo 璺緞锛屽繀搴?/ 鎼滅嫍鍚岄鏍兼墜缁橈紝
  鑷畾涔夊紩鎿庣敤棣栧瓧姣嶆柟鍧?
**鏀硅繘**
- 鍒囨崲鍒伴潪 AI 寮曟搸鏃惰嚜鍔ㄩ殣钘忎笁妯″紡锛堢瓟鐤?/ 鐧剧 / 娴忚锛夊垏鎹?- 鍒犻櫎姝ｅ湪浣跨敤鐨勮嚜瀹氫箟寮曟搸鍚庯紝榛樿寮曟搸鑷姩鍥炶惤 AI 鎼滅储
- 娌℃湁瀹夎 better-sidebar 鐨勭敤鎴峰畬鍏ㄤ笉鍙楀奖鍝嶏紙鍙€夋敞鍏ワ紝妫€娴嬩笉鍒板氨璺宠繃锛?
**Beta 杩囩▼**
- `1.4.3-beta.1`锛氫晶杈规爮閫傞厤鍒濈増锛堥〉绛俱€佸乏渚у紩鎿庢爮銆侀摼鎺ユ墦寮€鏂瑰紡銆侀€傞厤寮€鍏筹級
- `1.4.3-beta.2`锛氱粺涓€寮曟搸鍥炬爣锛涜嚜瀹氫箟鎼滅储寮曟搸锛涢〉绛惧寮€鐨勭涓€鐗堬紙鎻忚堪绗﹀眰锛?- `1.4.3-beta.3`锛氭敼鐢ㄥ涓?`sidebarRightTabs` 鐨?`multiple: true`锛屽疄鐜扮湡姝ｇ殑娴忚鍣ㄥ紡澶氬紑锛?  骞舵寜椤电 id 闅旂椤甸潰鐘舵€?
**娴嬭瘯**
- 6 涓嚜娴嬪浠跺叏閮ㄩ€氳繃锛涙柊澧炰簡鍘熺敓椤电娉ㄥ唽锛坢ultiple / guide / 椤电瀹炰綋妲斤級銆?  澶氬疄渚嬫覆鏌撱€佽嚜瀹氫箟寮曟搸澧炲垹涓庢牎楠屻€佸紩鎿庢爮鍥炬爣绛夋柇瑷€

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
- Unified 24脳24 monochrome engine icons: official logo paths for Baidu/Google, hand-drawn matching
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

### 涓枃
- **瀹夊叏鍔犲浐**锛氱Щ闄ゆ棤鏉ユ簮瀹堝崼鐨?`GET /search` 璋冭瘯鎺ュ彛锛涙墍鏈夋帴鍙ｈ姹傛湰鍦板鎴风璇锋眰澶?  `x-dsh-ai-search: 1`锛屽苟鏍￠獙鍥炵幆 Host/Origin锛堥槻璺ㄧ珯涓?DNS rebinding锛夛紱鎼滅储闄愭祦 10 娆?鍒嗛挓锛?  鍝嶅簲鍔?`nosniff` / `no-referrer`锛屼笉杈撳嚭 CORS 澶?- 鐮村潖鎬у彉鏇达細`GET /search` 涓嶅啀鍙敤锛涙湰鏈?curl 璋冭瘯闇€甯﹁姹傚ご锛涘崌绾у悗鍒锋柊椤甸潰

### English
- **Security hardening**: removed the unguarded `GET /search` debug endpoint; every endpoint now
  requires the local-client header `x-dsh-ai-search: 1` plus loopback Host/Origin validation
  (cross-site and DNS-rebinding protection); search is rate-limited to 10/min; responses add
  `nosniff` / `no-referrer` and never emit CORS headers
- Breaking: `GET /search` is gone; local curl debugging needs the header; refresh the page after
  upgrading

## [1.4.1] - 2026-10-27

### 涓枃
- 绔欑偣涓婇檺鎸夌被鍨嬪尯鍒嗭紙瑙嗛/鍥剧墖绔?10 鏉★紝鏅€氱珯 5 鏉★級锛岃秴鍑哄彧鏍囥€屽凡绮剧畝銆嶏紝涓嶅啀绠楀箍鍛?- 鏀惧骞垮憡鍒ゅ畾锛氬幓鎺変剑閲?杩斿埄/棰嗗埜/浼樻儬鍒哥爜/闄愭椂鐗规儬绛夊急淇″彿锛岀Щ闄?newsbreak.com

### English
- Per-site caps by type (video/image sites 10, ordinary sites 5); overflow is labeled "trimmed"
  instead of being counted as ads
- Relaxed ad detection: dropped weak signals (commission/cashback/coupons/flash sales) and removed
  newsbreak.com from the blocklist

## [1.4.0] - 2026-10-27

### 涓枃
- 鏂板璁剧疆銆屽垏鎹㈤〉闈㈡椂淇濈暀缁撴灉銆嶏紱銆岀患鍚堛€嶆澘鍧楀浐瀹氭寜 鏂囩珷 鈫?瑙嗛 鈫?鍥剧墖 鎺掑垪
- 瑙嗛鍙澶у瀷瑙嗛绔欏苟浠?`site:` 瀹氬悜妫€绱紝鍗＄墖鏍囧嚭鏉ユ簮骞冲彴

### English
- New "Keep results across panel switches" setting; the All board uses a fixed
  Articles 鈫?Videos 鈫?Images order
- Videos only come from major platforms and are searched with `site:`; cards show the source platform

## [1.3.0] - 2026-10-27

### 涓枃
- 涓夌鎼滅储妯″紡锛氱瓟鐤?/ 鐧剧 / 娴忚锛涚櫨绉戣瘝鏉★紙妗ｄ綅鍙皟锛夈€佹祻瑙堝洓鏉垮潡涓庝笁鎸囨爣鏉冮噸銆佷笅涓€椤靛幓閲?- `curated_search` 宸ュ叿鏀寔 `mode` / `page`

### English
- Three modes: Answers / Encyclopedia / Browse; encyclopedia entries with detail tiers, browse
  boards with three weighted metrics and deduplicated pagination
- `curated_search` gains `mode` / `page`

## [1.2.0] - 2026-10-27

### 涓枃
- 鏀瑰悕銆孉I 鎼滅储銆嶏紱寮€濮嬮〉绮剧畝锛涚嫭绔嬭缃〉锛堢粨鏋滆瑷€璺熼殢 Harness锛夛紱鎼滅储鍘嗗彶

### English
- Renamed to "AI Search"; simplified start page; standalone settings page (result language follows
  Harness); search history

## [1.1.0] - 2026-10-27

### 涓枃
- 绮捐棰勭畻 6 绉掋€佸彧璇诲墠 2 绡囷紱琛ュ厖杩借釜鍙傛暟娓呯悊锛涙憳瑕佸幓閲嶅璇█鐗堟湰

### English
- 6-second reading budget, top-2 pages only; extra tracking params stripped; deduplicate language
  variants in summaries

## [1.0.0] - 2026-10-27

### 涓枃
- 棣栦釜鐗堟湰锛氳仈缃戞绱?鈫?骞垮憡杩囨护 鈫?绮捐 鈫?AI 姹囨€绘帓搴忥紱`curated_search` 宸ュ叿锛汬TTP 鎺ュ彛

### English
- Initial release: retrieval 鈫?ad filtering 鈫?page reading 鈫?AI curation; `curated_search` tool;
  HTTP API

