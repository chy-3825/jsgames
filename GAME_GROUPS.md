# 游戏大厅分组规范

这份文档是游戏大厅分组的维护清单。运行时分组字段由
`server/games/groups.js` 提供，`server/games/registry.js` 会把它附加到
游戏元数据；不要在 `public/index.html` 里重复写游戏分组。

## 分组定义

| ID | 大厅名称 | 说明 |
|---|---|---|
| `social-assist` | 社交推理与流程辅助 | 身份、沟通与自动流程 |
| `codebreaking` | 解密类 | 密码、线索与逻辑破译 |
| `board` | 棋类与棋盘游戏 | 棋盘对弈与路线竞赛 |
| `tabletop` | 卡牌与策略桌游 | 卡牌、经营、竞价与策略 |

## 使用方式

| `playMode` | 大厅标签 | 含义 |
|---|---|---|
| `online` | 完整线上 | 游戏流程可以在房间内完成 |
| `hybrid` | 线上操作+队伍讨论 | 需要队伍私聊、语音或线下讨论 |
| `host-assist` | 主持辅助 | 手机辅助线下主持，不创建普通联机对局 |
| `auto-assist` | 自动流程辅助 | 系统代理阶段播报与结算，无需专职主持人 |
| `solo` | 单人游戏 | 不需要创建多人房间 |

## 当前分组

### 社交推理与流程辅助

| type | 名称 | playMode | 人数 | 排序 |
|---|---|---|---:|---:|
| `werewolf` | 狼人杀自动辅助 | `auto-assist` | 9 或 12 | 1 |
| `avalon` | 阿瓦隆 | `online` | 5–10 | 2 |
| `witchtown` | 猎巫镇 | `online` | 4–12 | 3 |

### 解密类

| type | 名称 | playMode | 人数 | 排序 |
|---|---|---|---:|---:|
| `decrypto` | 谍报风云 | `online` | 3–8 | 1 |
| `guessnumber` | 猜数字 | `solo` | 1 | 2 |

### 棋类与棋盘游戏

| type | 名称 | playMode | 人数 | 排序 |
|---|---|---|---:|---:|
| `chess` | 国际象棋 | `online` | 2 | 1 |
| `xiangqi` | 中国象棋 | `online` | 2 | 2 |
| `jungle` | 斗兽棋 | `online` | 2 | 3 |
| `junqi` | 军棋 | `online` | 2 | 4 |
| `aeroplane` | 飞行棋 | `online` | 2–4 | 5 |
| `gobang` | 五子棋 | `online` | 2 | 6 |
| `checkers` | 跳棋 | `online` | 2–6 | 7 |
| `monopoly` | 环城大富翁 | `online` | 2–8 | 8 |

### 卡牌与策略桌游

| type | 名称 | playMode | 人数 | 排序 |
|---|---|---|---:|---:|
| `loveletter` | 情书（默认 BGG 美术版） | `online` | 2–4 | 1 |
| `coup` | 政变 | `online` | 2–6 | 2 |
| `monopolydeal` | 大富翁纸牌 | `online` | 2–5 | 4 |
| `takefive` | 牛头王 | `online` | 2–10 | 5 |
| `hanabi` | 花火 | `online` | 2–5 | 6 |
| `splendor` | 璀璨宝石 | `online` | 2–4 | 7 |
| `kingdomino` | 多米诺王国 | `online` | 2–4 | 8 |
| `acquire` | 并购 | `online` | 2–6 | 9 |
| `citadels` | 富饶之城 | `online` | 2–7 | 10 |
| `lasvegas` | 拉斯维加斯 | `online` | 2–5 | 12 |
| `scout` | 马戏星探 | `online` | 2–5 | 13 |
| `manila` | 马尼拉 | `online` | 3–5 | 14 |
| `modernart` | 现代艺术 | `online` | 3–5 | 15 |
| `camelup` | 狂野骆驼 | `online` | 3–8 | 16 |
| `magicalathlete` | 胡闹运动会 | `online` | 2–6 | 17 |

## 维护规则

1. 每个服务器游戏必须且只能属于一个主分组。
2. 新增游戏时，同时在 `server/games/groups.js` 和本文档登记。
3. `werewolf` 是面向线下聚会的服务器房间辅助工具；线上房间只接受元数据定义的 9 人或 12 人局。
4. 分组只影响大厅展示和筛选，不改变游戏规则、房间协议或引擎逻辑。
5. 修改分类后，必须检查游戏总数、每组数量和所有游戏卡片是否仍能选择。

当前完整大厅目录为 28 项，全部通过服务器 registry 注册。
