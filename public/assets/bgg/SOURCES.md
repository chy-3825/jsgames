# BGG 美术资源来源

本目录保存用于本项目界面设计与展示的 BGG 图片资源。图片由 BoardGameGeek
图片接口取得，最近一次补充时间为 2026-08-23。用户已确认项目获得 BGG 使用许可；
仍保留原条目、图片 ID 和图片作者信息，便于后续核对具体授权范围。

文件命名约定：

- `cover.*`：BGG 条目的代表图，用于大厅卡片、游戏标题区和经过暗色遮罩处理的桌面背景。
- `detail.*`：现行游戏实际使用的组件、牌面或实物图，只能由对应游戏按组件类型使用；情书另有独立牌面裁切，不能默认当作整张游戏背景。
- 情书的 `cards/*.jpg`：从 `loveletter/detail.jpg` 的 4×2 牌面合照中按角色牌边界裁切，供默认 `loveletter` 直接显示为牌面，不再作为卡片背景。

除非授权文件另有约定，不要把这些图片用于项目外的再分发。需要替换或删除
某张图片时，先更新本表和对应的前端引用。

| 游戏 | BGG 条目 | cover 图片 | 组件/裁切来源图片 | 说明 |
|---|---|---:|---:|---|
| 情书 | [129622](https://boardgamegeek.com/boardgame/129622/love-letter) | 1401448 | 1455645 | The cards |
| 政变 | [131357](https://boardgamegeek.com/boardgame/131357/coup) | 2016054 | 1825154 / 1816069 | Kickstarter 现代版角色牌 / Artwork card reverse |
| 大富翁纸牌 | [40398](https://boardgamegeek.com/boardgame/40398/monopoly-deal-card-game) | 4595026 | 424917 / 424924 / 424915 | Property / action / money cards |
| 环城大富翁 | [1406](https://boardgamegeek.com/boardgame/1406/monopoly) | 5786795 | — | 当前香港棋盘使用原创分层素材 |
| 牛头王 | [432](https://boardgamegeek.com/boardgame/432/beat-the-heat) | 8632998 | — | 当前牌面和卡背由 HTML/CSS 绘制 |
| 花火 | [98778](https://boardgamegeek.com/boardgame/98778/hanabi) | 2007286 | — | 当前牌面和卡背由 HTML/CSS 绘制 |
| 璀璨宝石 | [148228](https://boardgamegeek.com/boardgame/148228/splendor) | 1904079 | 1783782 | Various illustrations used for the cards |
| 多米诺王国 | [204583](https://boardgamegeek.com/boardgame/204583/kingdomino) | 8443569 | 3327248 | 当前编号地形裁切的来源 |
| 并购 | [5](https://boardgamegeek.com/boardgame/5/acquire) | 8483227 | — | 当前 60 周年视觉不混用旧版组件照 |
| 富饶之城 | [478](https://boardgamegeek.com/boardgame/478/citadels) | 636868 | 98564 | Character fronts and abilities; classic role back references image 451100 |
| 拉斯维加斯 | [117959](https://boardgamegeek.com/boardgame/117959/las-vegas) | 1261796 | 1405556 | All components |
| 阿瓦隆 | [128882](https://boardgamegeek.com/boardgame/128882/the-resistance-avalon) | 1398895 | 1435197 | Components and promos |
| 马戏星探 | [291453](https://boardgamegeek.com/boardgame/291453/scout) | 6398727 | 6513802 | 2021 Oink components |
| 谍报风云 | [225694](https://boardgamegeek.com/boardgame/225694/decrypto) | 3759421 | 4082078 | Box and components |
| 马尼拉 | [15817](https://boardgamegeek.com/boardgame/15817/manila) | 902372 | 262639 | Boat / game component photo |
| 现代艺术 | [118](https://boardgamegeek.com/boardgame/118/modern-art) | 3458036 | 3833818 | 2018 edition components |
| 狂野骆驼 | [153938](https://boardgamegeek.com/boardgame/153938/camel-up) | 1918028 | 2087147 | Box and components |
| 胡闹运动会 | [454103](https://boardgamegeek.com/boardgame/454103/magical-athlete) | 9106864 | 9107654 | Sample racers |

情书试点的牌面裁切文件：`guard.jpg`、`priest.jpg`、`baron.jpg`、`handmaid.jpg`、
`prince.jpg`、`king.jpg`、`countess.jpg`、`princess.jpg`。裁切只保留原图中的
完整角色牌框和文字，不对原始图片做内容重绘；后续如果更换授权素材，应同步替换
这些文件并更新前端的角色映射。

补充的正式牌面参考：大富翁纸牌使用 BGG 图片 424917（地产牌）、424924（行动牌）和
424915（现金牌），原始合集保存为 `monopolydeal/cards.jpg`、`action-cards.jpg`、
`money-cards.jpg`，并裁出单张牌面 `property-card.jpg`、`action-card.jpg`、
`money-card.jpg` 供手牌直接显示。牛头王大厅封面使用 BGG 图片
[8632998](https://boardgamegeek.com/image/8632998/take-5) 的 2023 英文版盒面，并以
`contain` 完整显示；BGG 图片 [57767](https://boardgamegeek.com/image/57767/take-5)
当前数字牌、规则样例和卡背均由 HTML/CSS 按实时数据绘制，统一采用 2023 封面的
黄、红、黑牛头主题；其他版本的实物照和裁图不保留在现行目录。

政变的当前牌面统一使用 Kickstarter 现代版美术。`coup/modern-roles.jpg`
来自 BGG 图片 [1825154](https://boardgamegeek.com/image/1825154/coup)（Kickstarter Edition
exclusive content），`modern-{assassin,ambassador,duke,captain,contessa}.jpg` 是从其中按
完整牌边界裁出的 600×900 牌面。`modern-back.jpg` 来自 BGG 图片
[1816069](https://boardgamegeek.com/image/1816069/coup)（Artwork card reverse + Assassin
card）中的白灰色现代卡背。大厅继续使用 BGG 图片
[2016054](https://boardgamegeek.com/image/2016054/coup) 的现代版盒面，但改为完整
`contain` 展示，不再强制横向裁切。前端的中文角色名、能力和失效状态仍是
可维护的实时 HTML 数据层。2012 Coup: City State 的旧角色牌、合集和卡背已从
现行目录移除，避免两个版本再次混用。

璀璨宝石大厅使用 BGG 图片 [1904079](https://boardgamegeek.com/image/1904079/splendor)
（Splendor, Space Cowboys, 2014，出版方提供）的原版盒面。`splendor/illustrations.jpg`
来自 BGG 图片 1783782（Various illustrations used for the cards），并裁为 `art-1.jpg`
至 `art-8.jpg` 八张纯插画。发展卡按等级使用互不重复的插画池，点数、永久折扣和费用始终
来自当前牌库数据，因此不会把实物照片里的示例数值误当成实际游戏数据。贵族肖像从同代的
`detail.jpg` 实物组件图中按人物区域显示。十周年盒面和未接入的组件布局图不保留在现行目录。

花火大厅封面使用 BGG 图片 [2007286](https://boardgamegeek.com/image/2007286/hanabi)
的 R&R Games 2013 英文初版盒面，并以 `contain` 完整显示。当前公开牌、提示状态、
规则样例和三类卡背均由 HTML/CSS 按实时数据绘制，统一采用英文初版的深蓝夜空、
五色烟花与日式屋檐语言；德国版组件照、法国版参考图和旧裁图不保留在现行目录。
多米诺王国大厅使用 BGG 图片 [8443569](https://boardgamegeek.com/image/8443569/kingdomino)
的盒面，并以 `contain` 完整显示。游戏内基于 BGG 图片
[3327248](https://boardgamegeek.com/image/3327248/kingdomino) 重新裁出
`kingdomino/{forest,wheat,meadow,sea,swamp}-1..4.jpg` 和 `mine-1..3.jpg`；所有裁图都避开
地块边界和原图自带王冠，并按多米诺编号稳定选择变体。旧的单张地形裁图和来源原图
不保留在现行目录。城堡、未揭示地块背面、王冠和规则示例
由 HTML/CSS 按实时状态绘制，地形名称、王冠数量、编号、剩余牌数和合法摆放均来自游戏状态。

其余清单内游戏的 `detail.*` 资源通过大厅的 BGG inline-art 层进入对应的卡牌、地块、角色、
船只、赌场或运动员组件：使用真实 `<img>` 视觉层和轻微遮罩，牌名、费用、颜色、位置、
关键词等仍由实时状态覆盖；没有资源的棋类和猜数字等项目不加载这套层。

BGG 图片作者、出版方和条目版权信息以对应图片页及授权文件为准；这里的
`detail` 资源优先作为视觉参考，重新绘制的牌面、图标和文字应继续保持项目
自己的可维护设计系统。
