# jsgames 游戏大厅

一个基于 Express、WebSocket 和原生 JavaScript 的在线桌游大厅。大厅统一处理玩家连接、房间、聊天、创建/加入房间和开始游戏；每个游戏只负责自己的规则引擎和界面。

## 项目位置

当前项目目录：

```text
/home/chy/桌面/jsgames
```

## 当前游戏

| 游戏 | 类型 | 人数 |
| --- | --- | --- |
| 情书 | `loveletter` | 2–4 |
| 政变 | `coup` | 2–6 |
| 猜数字 | `guessnumber` | 单人 |
| 环城大富翁 | `monopoly` | 2–6 |
| 大富翁纸牌 | `monopolydeal` | 2–5 |
| 飞行棋 | `aeroplane` | 2–4 |
| 五子棋 | `gobang` | 2 |
| 跳棋 | `checkers` | 2–6 |
| 国际象棋 | `chess` | 2 |
| 中国象棋 | `xiangqi` | 2 |
| 斗兽棋 | `jungle` | 2 |
| 军棋 | `junqi` | 2 |
| 牛头王 | `takefive` | 2–10 |
| 花火 | `hanabi` | 2–5 |
| 璀璨宝石 | `splendor` | 2–4 |
| 多米诺王国 | `kingdomino` | 2–4 |
| 并购 | `acquire` | 2–6 |
| 富饶之城 | `citadels` | 2–7 |
| 猎巫镇 | `witchtown` | 4–12 |
| 拉斯维加斯 | `lasvegas` | 2–5 |
| 阿瓦隆 | `avalon` | 5–10 |
| 马戏星探 | `scout` | 2–5 |
| 谍报风云 | `decrypto` | 3–8 |
| 马尼拉 | `manila` | 3–5 |
| 现代艺术 | `modernart` | 3–5 |
| 狂野骆驼 | `camelup` | 3–8 |
| 胡闹运动会 | `magicalathlete` | 2–6 |
| 狼人杀线下辅助 | `werewolf` | 9 或 12 |

大厅当前展示 28 个项目，依次分为“社交推理与流程辅助”“解密类”“棋类与棋盘游戏”“卡牌与策略桌游”四组；“解密类”包含谍报风云和猜数字。狼人杀线下辅助支持每人用自己的手机加入，房间必须明确选择 9 人或 12 人局；单人研究模式不属于该游戏的线上人数范围。情书默认使用 BGG 许可牌面，类型仍为 `loveletter`。

## 启动

在项目目录执行：

```bash
npm install
npm start
```

然后打开：

```text
http://localhost:3000
```

运行自动化回归测试（2026-08-29 当前 512 项全部通过）：

```bash
npm test
```

依赖安全门禁（高危漏洞直接失败）：

```bash
npm run test:audit
```

只做首方 JavaScript 语法门禁：

```bash
npm run test:syntax
```

运行浏览器模块、公开/私密房间、双标签对局恢复、传输断线自动重连、离场资源释放、隐藏信息和键盘/触屏输入烟测（需要 Firefox，2026-08-29 为 28 个模块导入通过、双标签生命周期通过、传输重连通过、隐私输入检查通过、96/96 个视口通过）：

```bash
npm run test:browser
```

可选地用 Chromium 复核同一组模块、72 个桌面/移动视口和隐私输入边界（需要提供 Chromium 路径）：

```bash
CHROMIUM_BIN=/path/to/chromium npm run test:browser:chromium
```

运行性能预算、静态资源并发和 WebSocket 房间/连接清理烟测（本地有界压力，不替代生产容量压测）：

```bash
npm run test:performance
```

执行工程质量门禁：

```bash
npm run test:lint
npm run test:type
npm run test:coverage
npm run test:complexity
```

其中类型检查目前采用渐进式 `checkJs` 范围，覆盖实时安全策略和大厅目录数据；随着模块收口再扩大范围。

检查运行时注册表、28 份游戏报告、当前报告入口、规则矩阵和验收 JSON 工件边界：

```bash
npm run test:reports
```

检查版本号、锁文件、部署模板和仓库发布卫生：

```bash
npm run test:release
```

以生产环境变量启动真实 `bin/www`，检查 `/healthz`、安全头、WebSocket 建房和 SIGTERM 优雅退出：

```bash
npm run test:deploy
```

执行最终验收的本机可复现聚合门禁（不包含 `npm ci`、Chromium 可选门禁和目标环境操作）：

```bash
npm run test:acceptance
```

服务探活地址为 `/healthz`；生产反代前请设置 `JSGAMES_ALLOWED_ORIGINS` 为实际 HTTPS Origin。默认 WebSocket 会话要求重连令牌，消息、聊天、负载和 JSON 结构均有服务端上限。

完整记录见 [`TEST_REPORTS/phase4-runtime.md`](./TEST_REPORTS/phase4-runtime.md)。

发布前按 [`RELEASE_CHECKLIST.md`](./RELEASE_CHECKLIST.md) 执行版本、门禁、人工签字和回滚准备。

仓库的 `.github/workflows/verify.yml` 会在推送或合并请求时执行 Node 20/22 语法、ESLint、渐进式类型、复杂度棘轮、依赖安全、覆盖率、性能/清理、报告目录、发布元数据、生产形态部署和回归门禁，并执行 Firefox、Chromium 浏览器烟测与差异检查。

大厅会为当前浏览器标签页保存短期会话令牌。网络短暂断开后，页面会在 30 秒宽限期内自动恢复原玩家、房间和游戏视角；复制窗口不会抢占已在线窗口，而是保留新的玩家身份。人工输入玩家 ID 重连时，服务端还会校验原会话令牌，避免仅凭可见 ID 接管席位。也可以使用 `/?room=000001` 邀请链接或大厅里的 6 位房间号输入框直达房间。主动点击“离开房间”会结束该玩家在本局的席位。

点击游戏卡片会先打开完整的规则摘要，再进入房间属性设置。所有游戏都可设置房间名称、人数上限和公开/仅邀请；狼人杀另可设置 9/12 人、警长流程与胜利条件，谍报风云另可设置加密员产生方式。只有点击“确定创建”后，浏览器才会向服务器创建房间。

谍报风云可完整线上游玩：网页负责关键词、密码、答案和判定，远程玩家建议进入同一公共语音。已揭晓线索会自动按队伍与 `1–4` 号归类，供后续截获使用。

## 目录结构

```text
app.js                         # Express 静态资源和实时服务兼容入口
server/realtime/               # 可实例化实时服务、房间命令、WebSocket 生命周期、广播和存储边界
server/realtime/create-realtime-server.js # 实时服务组合根与依赖装配
server/realtime/room-handlers.js # 创建/加入/重连、设置、准备和对局命令
server/realtime/socket-lifecycle.js # WebSocket 建连、心跳、消息接收和清理
server/realtime/protocol.js    # 实时消息归一化与路由边界
server/realtime/broadcast.js   # 大厅/房间广播边界
server/room.js                 # 通用房间生命周期与对局编排
server/room-study.js           # 棋谱模式虚拟座位、摆棋和视角控制
server/games/registry.js       # 游戏注册表
server/games/<game>/index.js   # 游戏大厅适配层
server/games/<game>/engine.js  # 游戏规则引擎
public/index.html              # 大厅页面
public/script.js               # 大厅组合入口：状态、连接、房间和游戏加载编排（约 890 行）
public/lobby/message-handler.js # WebSocket 消息到大厅状态/反馈动作的转换
public/lobby/event-bindings.js # 大厅入口、房间、棋谱和弹层 DOM 事件绑定
public/game-details.js         # 28 款游戏的创建前规则摘要
public/assets/covers/          # 28 张高清横版封面与 thumbs/ 下的大厅缩略图
deploy/                        # systemd、Nginx 与云安全组部署模板
scripts/complexity-audit.js    # 热点文件复杂度增长门禁
public/style.css               # 大厅基础 tokens、入口和目录样式
public/lobby/*.css             # 游戏壳层、共享原语和响应式样式层
public/lobby/                  # 大厅目录、传输、加载器、视图、弹层、等待房间和转场模块
public/games/<game>/           # 每款游戏的独立前端模块
  client.js                    # 协议入口与生命周期，导出 createGameClient
  state.js                     # 可变视图模型与派生状态
  template.js                  # 静态 HTML 模板
  render.js                    # DOM/2D 渲染门面
  scene.js                     # 动画、场景或 GPU 资源
  actions.js                   # 输入、按钮和提交动作
  constants.js                 # 常量（可选；牛头王由 cards.js 集中维护）
  cards.js                     # 卡牌数据/牌面标记（卡牌游戏可选）
  style.css                    # 游戏基础样式（可选）
  board.css / scenes.css       # 按职责拆出的版图、场景或响应式样式（可选）
public/games/common/           # 可复用的网格游戏前端组件
test/regression/*.test.js      # 按域拆分的规则和大厅协议回归测试
test/support/regression.helper # 综合回归共享夹具（不参与测试发现）
test/*-official.test.js        # 各游戏官方规则专项测试
PROJECT_REPORT.md              # 新游戏开发和大厅协议说明
```

需要多层呈现的游戏会在 `game-manifest.js` 中按固定级联顺序加载基础、版图/私有信息、交互、场景和响应式样式；例如猎巫镇、拉斯维加斯、花火、大富翁纸牌、并购、富饶之城、政变和阿瓦隆的后置样式不会再塞回单一 `style.css`。花火额外保留场景后的移动端后置层，以维持原有响应式覆盖顺序；大富翁纸牌的选择弹窗继续作为独立交互层加载。大厅全局样式同样按基础、游戏壳层、共享原语、响应式和等待房间顺序加载。胡闹运动会服务端还将常量、移动/特殊格、回合结算和状态投影分别放在同目录模块中，`engine.js` 只负责组装权威流程。

国际象棋使用了额外的渲染隔离层：

```text
public/games/chess/lobby-client.js  # 大厅与棋盘 iframe 的桥接
public/games/chess/room-frame.html  # 独立 3D 棋盘文档
public/games/chess/client.js        # 资源、模板和协议生命周期
public/games/chess/scene.js         # Three.js 棋盘、GPU 资源和动画
public/games/chess/actions.js       # 3D/2D 输入绑定
```

这是为了避免 WebGL 画布受到大厅布局和尺寸监听影响，不改变大厅的 WebSocket 和身份协议。中国象棋、军棋也使用同样的 `client → actions/render → scene` 边界；3D 场景例外保留在 `scene.js`，不再把所有职责堆回 `client.js`。

军棋使用标准 12×5 暗棋棋盘，开局必须完成双方各 25 枚棋子的合法布阵；自己的棋子可见，对方棋子在交战前显示背面，服务端负责铁路/行营/战斗和军旗结算。

中国象棋和军棋都使用轻量 Three.js 棋桌：棋盘、中文棋子纹理、镜头缩放/拖拽和走棋动画在浏览器端完成，规则和合法着法仍由服务端裁决。

六种棋类（国际象棋、中国象棋、斗兽棋、军棋、五子棋、跳棋）支持创建房间时选择“对弈模式”或“棋谱模式”；飞行棋和大富翁保持普通对局。棋谱模式只占用房主一个真实席位，服务端为双方建立虚拟座位，左侧按钮会明确显示“切换到白方/黑方”“切换到红方/蓝方”等下一执棋方，并同步棋盘代入方向，开始后还可以在 2D 棋盘上摆放、移动、删除或清空公开局面，再确认下一手进行推演。军棋复用已有的双方暗棋布阵流程。

富饶之城按官方经典基础版规则实现：8 个基础角色、67 张官方城区牌（含 13 张紫色独特区）、按人数明置/暗置弃角色、国王不可明置、魔术师换牌、2–3 人双角色共用一座城市、五色 +3 与首位建成 +4 的官方计分。

猎巫镇按《Salem 1692》核心流程实现审判牌、女巫转移、阴谋牌、夜幕、Constable/Gavel、认罪免疫和正式胜负条件。

## 新游戏开发方式

新游戏按照 [PROJECT_REPORT.md](./PROJECT_REPORT.md) 中的开发方法和大厅协议接入。核心原则是：

- 服务端使用 `server/games/<type>/index.js` 作为适配层，使用 `engine.js` 保存规则。
- `index.js` 导出 `metadata` 和 `create(roomId, players, ownerId, settings)`；后两个参数由大厅提供，普通游戏可以忽略。
- 游戏会话提供 `start()`、`handleAction(playerId, action)`、`getPlayerState(playerId)` 和 `getWinner()`。
- 前端 `client.js` 导出 `createGameClient({ mount, send, addLog })`；大厅统一提供离开房间入口。
- 前端只通过大厅传入的 `send` 发送 `gameAction`，不自行创建 WebSocket、房间或玩家身份。
- 服务端以大厅传入的真实 `playerId` 为准，不信任前端 action 中伪造的身份。
- 棋谱或管理员类动作必须同时在房间层和规则引擎层检查可信模式与真实操作者，虚拟席位不能替代权限主体。
- 隐藏信息必须在 `getPlayerState(playerId)` 中按玩家分别过滤。
- 游戏退出或切换时，前端必须在 `destroy()` 中清理事件、定时器、样式和渲染资源。
- 新游戏必须加入 `server/games/registry.js`，并保持 `metadata.type`、目录名和注册 key 一致。

因此，情书、政变、猜数字、大富翁、象棋类游戏的服务端入口和前端入口，整体都是按这套方法接入的。当前存在两个有意的工程例外：

1. 国际象棋为了隔离 Three.js/WebGL，使用 `lobby-client.js` 和 `room-frame.html` 做桥接。
2. 斗兽棋复用了 `public/games/common/` 的网格游戏组件，并额外加载了自己的地形和棋子样式；仍然遵守同一个 `createGameClient` 接口和大厅消息协议。

## 新增游戏清单

以 `mygame` 为例：

```text
server/games/mygame/index.js
server/games/mygame/engine.js
public/games/mygame/client.js
public/games/mygame/state.js
public/games/mygame/template.js
public/games/mygame/render.js
public/games/mygame/scene.js
public/games/mygame/actions.js
public/games/mygame/constants.js    # 可选
public/games/mygame/cards.js        # 卡牌游戏可选
public/games/mygame/style.css       # 可选
```

实现顺序建议：

1. 先写规则引擎和服务端状态，不依赖 WebSocket 对象。
2. 为 `start()`、合法动作、非法动作、回合变化和终局添加测试。
3. 写 `index.js` 适配大厅接口。
4. 在 `registry.js` 注册游戏。
5. 写 `client.js`，从 `message.state` 渲染界面，通过 `send()` 提交动作。
6. 处理 `gameStarted`、`gameState`、`gameEnded` 和 `error`。
7. 实现 `destroy()` 并运行 `npm test`。

## 通用消息

客户端创建或加入房间由大厅处理，游戏前端通常只需要发送：

```js
send({
  type: 'gameAction',
  action: {
    kind: 'yourAction',
  },
});
```

服务端成功动作后，大厅会给房间内每个玩家发送各自视角的 `gameState`。游戏不能把完整内部状态直接广播给所有玩家。

## 规则实现注意事项

规则引擎应当是服务端权威状态，前端只负责显示和提交意图。涉及隐藏信息、回合、合法动作、终局、和棋、玩家离线和重连时，都必须在服务端再次校验。

国际象棋目前已经覆盖王安全、将军、将死、逼和、王车易位、吃过路兵、四种升变、重复局面和回合和棋等核心规则。对弈模式与棋谱编辑在房间层和引擎层双重隔离；棋谱仅允许房主控制双方，确认前验证王、兵、棋子数量和非行动方被将状态。详细结果见 [国际象棋测试与安全验收报告](./TEST_REPORTS/chess.md)。计时、认输、双方协商和棋、PGN/FEN 与 AI 属于后续功能。
