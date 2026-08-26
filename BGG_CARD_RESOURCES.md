# BGG 卡面资源清单

复核日期：2026-08-22

本清单只覆盖本轮审计的 7 款卡牌游戏。资源分为两类：

- **本地参考**：已经被现行界面直接使用，或仍服务于当前版本的美术设计。
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
- 本地五组画家样本：
  - `reference-artist-sari-tanni.jpg`：https://boardgamegeek.com/image/372270/modern-art
  - `reference-artist-bruno-maximus.jpg`：https://boardgamegeek.com/image/372268/modern-art
  - `reference-artist-aimo-taleva.jpg`：https://boardgamegeek.com/image/372269/modern-art
  - `reference-artist-hannu-leimu.jpg`：https://boardgamegeek.com/image/372266/modern-art
  - `reference-artist-jari-jarnstrom.jpg`：https://boardgamegeek.com/image/372264/modern-art
- 70 张旧版作品全览（仅参考）：https://boardgamegeek.com/image/61765/modern-art
- 结论：这些资源适合研究“同一画家保持风格、同组作品仍有变化”的系统，不能直接对应项目当前的马蒂斯、卡萨特、吉田、勃鲁盖尔和克里福特名称。后续应为每位线上画家建立 4–6 个原创构图变体。

## 大富翁纸牌（Monopoly Deal）

- BGG 游戏页：https://boardgamegeek.com/boardgame/40398/monopoly-deal-card-game
- 项目现有行动牌合集与 BGG 图片 424924 核对一致：https://boardgamegeek.com/image/424924/monopoly-deal-card-game
- 地产牌参考：https://boardgamegeek.com/image/424917/monopoly-deal-card-game
- 金钱牌参考：https://boardgamegeek.com/image/424915/monopoly-deal-card-game
- 当前 2008 版正式牌背（项目已使用）：https://boardgamegeek.com/image/424925/monopoly-deal-card-game
- 其他版本牌背参考：https://boardgamegeek.com/image/1003319/monopoly-deal-card-game
- 可修改筛选中的双语版布局参考：https://boardgamegeek.com/image/692790/monopoly-deal-card-game
- 结论：项目并不缺分类参考，真正缺的是逐卡视觉映射。现有一张行动图、一张地产图和一张金钱图不应覆盖所有同类牌；正式改造时应为收租、拒绝、强制交易、拆迁、生日、房屋和酒店分别设计原创图形。

## 富饶之城（Citadels）

- BGG 游戏页：https://boardgamegeek.com/boardgame/478/citadels
- 本地使用：`public/assets/bgg/citadels/reference-role-front-back.jpg`，角色正反面参考；其中蓝金国王牌背用于秘密选角牌堆：https://boardgamegeek.com/image/451100/citadels
- 本地候选：`public/assets/bgg/citadels/reference-color-icons.jpg`，建筑颜色/符号参考：https://boardgamegeek.com/image/1044275/citadels
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
- 本地候选：`public/assets/bgg/witchtown/reference-components.jpg`，BGG 图片 3721695：https://boardgamegeek.com/image/3721695/salem-1692
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
