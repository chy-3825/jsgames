## 当前更新：全部地产已接入原图汉化

中央出牌区和资产区的 28 张普通地产、11 张万能地产均使用 BGG 原始照片/扫描加 SVG 中文文字，整副牌不再出现“原图待补”。手牌仍使用自绘三段式简版。

普通街道复用 424917 中同颜色、同金额、同租金表的官方底图，中文地名使用现有牌库名称；这是原图模板汉化，并非每张都有同名美版扫描。电力公司采用 4906537 中带灯泡的对应牌；浅蓝/铁路、绿/铁路采用 4906542；其余万能地产继续使用 424919。所有原图文件保持原始字节，照片的色温、倾斜和版本差异仍可见。

验证：48 项相关测试通过，覆盖全部 39 张地产的原图、手牌分离以及接入原图的 SHA-256；已检查浏览器预览并修正新卡文字覆盖位置。以下为历史检索和实施记录，其中“未接入”“缺图 20 张”的描述已被本次更新取代。

## 2026-09-08 地产补充检索：已找到可用原图

纠正此前“缺少原图”的表述：此前运行时仅匹配两张英文素材表及完全相同的美版地名，不能据此判断 BGG 没有其他可用素材。本次重新检查图库并下载原尺寸图，找到以下资源；目前保存为参考素材，尚未接入卡面渲染。

| BGG 图片 | 内容 | 版本与用途 |
| --- | --- | --- |
| [1069206](https://boardgamegeek.com/image/1069206/monopoly-deal-card-game) | 全部 11 张万能地产，含浅蓝/铁路、绿/铁路 | 俄文 2008 版实体牌照片，接近当前旧版样式；各牌无叠压，可裁切，需校正拍摄角度及汉化 |
| [562522](https://boardgamegeek.com/image/562522/monopoly-deal-card-game) | 红/黄、浅蓝/铁路、粉/橙、十色万能 | 荷法双语 2008 版扫描，浅蓝/铁路较清晰 |
| [4906537](https://boardgamegeek.com/image/4906537/monopoly-deal-card-game) | 棕色 2、深蓝 2、公用事业 2 | 荷法双语红盒版 |
| [4906538](https://boardgamegeek.com/image/4906538/monopoly-deal-card-game) | 黄色 3、绿色 3 | 同版 |
| [4906539](https://boardgamegeek.com/image/4906539/monopoly-deal-card-game) | 粉色 3、浅蓝 3 | 同版 |
| [4906540](https://boardgamegeek.com/image/4906540/monopoly-deal-card-game) | 铁路 4 | 同版 |
| [4906541](https://boardgamegeek.com/image/4906541/monopoly-deal-card-game) | 红色 3、橙色 3 | 同版；以上五图合计 28 张普通地产 |
| [4906542](https://boardgamegeek.com/image/4906542/monopoly-deal-card-game) | 7 种双色万能地产 | 同版，含此前缺的两种；另有牌背 |

原图保存在 `public/assets/bgg/monopolydeal/reference/`，原始下载地址、尺寸和 SHA-256 记录于其中的 `sources.json`。这些是 BGG 用户上传的实体牌照片/扫描，不是官方提供的印刷源文件。红盒版地名与当前美版牌库不同，且排版与旧版不同；汉化时应明确采用原地区译名还是沿用游戏现有中文名称，不能把两者称作同名原卡。手牌仍按已确定的自绘简版处理。

# BGG 卡面资源清单

复核日期：2026-08-22

本清单只覆盖本轮审计的 7 款卡牌游戏。资源分为三类：

- **本地参考**：已经被现行界面直接使用，或仍服务于当前版本的美术设计。
- **已归档参考**：运行时未使用，已移出部署仓库，但来源链接和用途继续保留。
- **仅参考**：BGG 有清晰实物图，但未在本次检索中确认允许修改。只登记链接，不应裁切后直接作为线上成品牌面。

即使 BGG 标记允许修改，公开发布前仍应再次核对上传者说明、原出版社美术权利和项目用途。BGG 图片页是素材来源记录，不等于出版社自动授权。

## 马戏星探（SCOUT）

- BGG 游戏页：https://boardgamegeek.com/boardgame/291453/scout
- 项目现有 `detail.jpg` 已与 BGG 图片 6513802 核对一致，包含数字牌、牌背和筹码：https://boardgamegeek.com/image/6513802/scout
- 牌面设计参考：https://boardgamegeek.com/image/6397227/scout
- 牌背参考：https://boardgamegeek.com/image/7375969/scout
- 结论：现有资源已足够。线上牌面应继续由代码绘制，保持上下数字、颜色分区和翻转语义，不需要用照片裁牌。

## 花火（Hanabi）

- BGG 游戏页：https://boardgamegeek.com/boardgame/98778/hanabi
- 当前大厅封面：BGG 图片 2007286：https://boardgamegeek.com/image/2007286/hanabi
- 出版社样始牌参考：https://boardgamegeek.com/image/1365444/hanabi
- 结论：现行牌面和卡背由代码绘制，采用深蓝夜空、五色烟花和屋檐语言；旧版本地参考图已移除，避免与当前版混用。

## 现代艺术（Modern Art）

- BGG 游戏页：https://boardgamegeek.com/boardgame/118/modern-art
- 项目现有 `detail.jpg` 已与 BGG 图片 3833818 核对一致：https://boardgamegeek.com/image/3833818/modern-art
- 已归档的五组画家样本（桌面 `tmp/jsgames-unused-20260828/legacy-assets/bgg/modernart/`）：
  - `reference-artist-sari-tanni.jpg`：https://boardgamegeek.com/image/372270/modern-art
  - `reference-artist-bruno-maximus.jpg`：https://boardgamegeek.com/image/372268/modern-art
  - `reference-artist-aimo-taleva.jpg`：https://boardgamegeek.com/image/372269/modern-art
  - `reference-artist-hannu-leimu.jpg`：https://boardgamegeek.com/image/372266/modern-art
  - `reference-artist-jari-jarnstrom.jpg`：https://boardgamegeek.com/image/372264/modern-art
- 70 张旧版作品全览（仅参考）：https://boardgamegeek.com/image/61765/modern-art
- 结论：这些资源适合研究“同一画家保持风格、同组作品仍有变化”的系统，不能直接对应项目当前的马蒂斯、卡萨特、吉田、勃鲁盖尔和克里福特名称。后续应为每位线上画家建立 4–6 个原创构图变体。

## 大富翁纸牌（Monopoly Deal）

### 当前地产实现（2026-09-08，替代下面的历史方案）

- 手牌继续使用自绘色块、牌型与金额；110 张牌的手牌 HTML 与本轮修改前逐张比较一致。
- 中央/资产区仅使用未重绘的 BGG 原始扫描：普通地产 [424917](https://boardgamegeek.com/image/424917/monopoly-deal-card-game)，万能地产 [424919](https://boardgamegeek.com/image/424919/monopoly-deal-card-game)。中文由 SVG 文字层覆盖英文区域，金额、租金数字、插图和叠牌图标仍来自扫描图；金额圆标区域受遮罩保护。
- `property-sheet.jpg` SHA-256：`e90eb551dcb3e333acfa3395250f40086cf7d3591bfdddbc1150052fb76b9e3f`。
- `property-wild-sheet.jpg` SHA-256：`71f3f417aa8ddfb04841672fb58ea709b102aecbe25416d4034291633d859d1e`。
- `property-original.js` 按实际地产名称及万能牌颜色组合匹配，不将同色其他地产套用为当前牌。覆盖十个普通地产名称、五种双色万能和十色万能，共 19 张牌（含重复副本）。缺少原图的 20 张以“原图待补”显示，清单见 `TEST_REPORTS/monopolydeal-original-properties.md`。
- 运行时不再引用 `property-official-zh.png`、`property-paper.png`，也不再自绘完整版万能地产表格。历史生成文件仅保留备查，不代表官方中文素材。

### 历史处理记录

- 2026-09-08 体检修正：`action-zh-pilot.png` 的“做出反对”原生成角标误为 3M，实际牌库为 4M；运行时两个角标已改由服务端面额覆盖显示，素材本身未重新生成。

- 2026-09-08 原版布局修正：普通地产完整卡面改用 `property-official-zh.png`（以 BGG 424917 中文化编辑的 5×2 图集），恢复原版叠牌数量图标、虚线租金及色带/金额布局；中文名称按实际地产动态填入，覆盖所有普通地产。手牌保持简洁色块版。此图为原版参考编辑图，不是官方发布的中文版。万能地产生成候选有数值错误，未接入，暂保留现有中文布局。

- 2026-09-08 中文地产修订：停止直接显示十张英文地产扫描图。`property-paper.png` 为基于 BGG 424917 经 imagegen 清理的纸张边框，所有普通地产与万能地产在完整牌面使用实际中文名称和数据排版，长地名按“大道／广场／花园”分行、金额独立留位、租金按行对齐。地产手牌恢复色块＋较小“地产”文字＋角落金额。可通过 `__deal_property_review.html` 查看代表性长名称、铁路、万能地产与手牌。

- 2026-09-08：地产原图试用 `property-sheet.jpg`，直接来自 BGG 424917（1000 × 611）。只对图中十个准确名称接入原图：地中海大道、康涅狄格大道、圣查尔斯广场、圣詹姆斯广场、雷丁铁路、肯塔基大道、大西洋大道、北卡罗来纳大道、木板路、自来水厂。用于手牌和完整公共/资产卡面，保留英文与租金表；其他地产及万能地产维持现状，避免将同颜色的不同地产错配。

- 2026-09-08：`rent-zh.png` 以 BGG 图片 424924 中的双色、全色租金样式为参考，经 imagegen 中文化并扩展为六种组合（不是六张官方扫描图）。3 列 × 2 行：浅蓝/棕、粉/橙、红/黄、深蓝/绿、铁路/公用事业、全色；前五种价值 1M，全色 3M。移除牌内规则说明，手牌和完整公共卡面共用，按实际卡片边界排除图集间隔。

- 2026-09-08 后续：货币手牌也共用 `money-sheet.jpg` 六种原版面额图，旋转 90° 后铺满竖向手牌，替代纯文字金额；中央展示和银行仍保留横向布局。

- 2026-09-08：全十种行动牌已完成同风格中文化，并在行动手牌与完整公共卡面共用。新增 `action-zh-rest.png` 为 4 列 × 2 行图集，依次是物业接管 5M、通行证 1M、双倍租金 1M、我的生日 2M、盗取 3M、强制交易 3M、房子 3M、酒店 4M；原两张样牌继续使用 `action-zh-pilot.png`。租金、地产及货币手牌未改动。

- 2026-09-08：行动牌中文化样牌 `public/assets/bgg/monopolydeal/action-zh-pilot.png`，以 BGG 图片 424924 为参考通过 imagegen 编辑生成；左侧为收取债务，右侧为做出反对，两者牌面价值均为 3M。保留原版风格、去掉牌内说明、中文化标题，用于完整公共卡面；并非未经修改的官方中文扫描图。其余行动牌暂未替换。

- 2026-09-08：按用户要求，完整版货币牌直接使用图片 424915 的六种原版面额；本地文件 `public/assets/bgg/monopolydeal/money-sheet.jpg`（800 × 822），通过 CSS 窗口分别展示 1、2、3、4、5、10M，保留横向比例。用于公共卡面和银行面额汇总，手牌仍使用简洁金额版。此项替代下文关于货币牌使用代码绘制的旧结论。

- BGG 游戏页：https://boardgamegeek.com/boardgame/40398/monopoly-deal-card-game
- 已归档的行动牌合集曾与 BGG 图片 424924 核对一致：https://boardgamegeek.com/image/424924/monopoly-deal-card-game
- 地产牌参考：https://boardgamegeek.com/image/424917/monopoly-deal-card-game
- 金钱牌参考：https://boardgamegeek.com/image/424915/monopoly-deal-card-game
- 当前 2008 版正式牌背（项目已使用）：https://boardgamegeek.com/image/424925/monopoly-deal-card-game
- 其他版本牌背参考：https://boardgamegeek.com/image/1003319/monopoly-deal-card-game
- 可修改筛选中的双语版布局参考：https://boardgamegeek.com/image/692790/monopoly-deal-card-game
- 结论：归档中的行动、地产和金钱示例图不应覆盖所有同类牌；运行时目前使用正式牌背并由 HTML/CSS 绘制卡面。后续应为收租、拒绝、强制交易、拆迁、生日、房屋和酒店分别设计原创图形。

## 富饶之城（Citadels）

- BGG 游戏页：https://boardgamegeek.com/boardgame/478/citadels
- 本地使用：`public/assets/bgg/citadels/reference-role-front-back.jpg`，角色正反面参考；其中蓝金国王牌背用于秘密选角牌堆：https://boardgamegeek.com/image/451100/citadels
- 已归档候选：`reference-color-icons.jpg`，建筑颜色/符号参考：https://boardgamegeek.com/image/1044275/citadels
- 绿色普通建筑合集（仅参考）：https://boardgamegeek.com/image/147402/citadels
- 紫色特殊建筑合集（仅参考）：https://boardgamegeek.com/image/147403/citadels
- 普通建筑正面与牌背（仅参考）：https://boardgamegeek.com/image/97071/citadels
- 结论：角色牌资源已经充足，下一步重点是建筑牌。可以沿用黑色厚边框、左上金币成本、底部建筑名和五类宝石色，但建筑插画应原创重绘，避免所有建筑继续复用同一城市剪影。

## 胡闹运动会（Magical Athlete，2025 CMYK 版）

- BGG 游戏页：https://boardgamegeek.com/boardgame/454103/magical-athlete
- 项目现有 `detail.png` 已与出版社样始牌 9107654 核对一致，并出现在 BGG 可修改筛选结果中：https://boardgamegeek.com/image/9107654/magical-athlete
- 36 名运动员与骰子全览（仅参考）：https://boardgamegeek.com/image/9131735/magical-athlete
- 赛道参考：https://boardgamegeek.com/image/9107655/magical-athlete
- 结论：BGG 只有香蕉、决斗家和催眠师三张干净样始牌，无法提供完整 36 张独立牌面。后续应以圆角彩色边框、大面积怪诞角色、底部白色能力区为模板，为其余运动员绘制原创角色图，不能把全体米宝照片拆成牌面。

## 猎巫镇（Salem 1692）

- BGG 游戏页：https://boardgamegeek.com/boardgame/175549/salem-1692
- 已归档候选：`reference-components.jpg`，BGG 图片 3721695：https://boardgamegeek.com/image/3721695/salem-1692
- 15 张 Town Hall 人物牌（仅参考）：https://boardgamegeek.com/image/3730883/salem-1692
- Salem 行动牌与 Tryal 审判牌（仅参考）：https://boardgamegeek.com/image/3730890/salem-1692
- Tryal 牌正面（仅参考）：https://boardgamegeek.com/image/3730889/salem-1692
- 行动牌样本，包括两张黑色即时牌（仅参考）：https://boardgamegeek.com/image/2464284/salem-1692
- 结论：BGG 已足以确认正确视觉方向：旧纸、清教徒肖像、几何牌背、红绿蓝黑四色行动牌、单独的 Tryal 牌系。但完整卡图没有确认修改许可，成品应按这些层级原创重绘，而不是直接截图裁牌。

## 后续落地顺序

1. 猎巫镇：先建立原创 Town Hall 人物牌、Tryal 三种身份牌和四色行动牌模板。
2. 胡闹运动会：按现有三张出版社样牌建立 36 名角色的统一原创卡框和插画体系。
3. 富饶之城：为普通建筑与紫色特殊建筑制作独立插画池。
4. 现代艺术：每位画家至少准备 4–6 种构图，而不是一位画家只复用一张图。
5. 大富翁纸牌：补齐不同动作的独立视觉符号；马戏星探和花火只需小幅增强，不应推倒重做。
