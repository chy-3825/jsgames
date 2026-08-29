# jsgames 文件目录与用途

> 盘点日期：2026-08-29
> 盘点范围：`/home/chy/桌面/jsgames`，不包含可由 `npm install` 重新生成的 `node_modules/`，也不包含 `.git/`。  
> 当前共有 676 个项目文件（不含 `node_modules/`、`.git/`、被忽略的 `tmp/` 和按需生成的 `TEST_REPORTS/artifacts/*.json`）；另保留 1 份正在使用的 `tmp/junqi-v5-final-prompts.md`。

## 1. 状态说明

- **运行必需**：正式大厅、服务器或游戏会直接加载。
- **测试必需**：不参与线上运行，但 `npm test` 或专项验收需要。
- **开发资料**：规则说明、授权来源、验收记录和视觉测试页。

本目录已经清除明确的旧备份、退役兼容入口、旧版/中间态美术和未启用脚手架；
下表只描述现行版本及其测试、验收和来源资料。

## 2. 根目录与启动入口

| 文件 | 状态 | 用途 |
| --- | --- | --- |
| `.gitignore` | 开发资料 | 排除依赖、日志、环境变量、构建产物和编辑器缓存。 |
| `.vscode/launch.json` | 开发资料 | VS Code 中启动 Node 服务或浏览器调试的现行配置。 |
| `FILE_CATALOG.md` | 开发资料 | 本文件；记录项目文件用途和清理边界。 |
| `app.js` | 运行必需 | Express 静态站点和 WebSocket 兼容入口；默认实时服务由 `createRealtimeServer()` 提供。 |
| `bin/www` | 运行必需 | `npm start` 启动脚本；创建 HTTP 服务、挂接 WebSocket 并监听 3000 端口。 |
| `package.json` | 运行必需 | npm 元数据、`start`/`test` 命令和依赖声明。 |
| `package-lock.json` | 运行必需 | 锁定依赖的确切版本，保证重新安装结果一致。 |
| `eslint.config.js` | 开发资料 | 混合 CommonJS/ES 模块的 JavaScript 正确性门禁配置。 |
| `tsconfig.check.json` | 开发资料 | 渐进式 `checkJs` 类型检查范围；不产生构建输出。 |
| `scripts/complexity-audit.js` | 测试必需 | 对已识别的大厅、实时服务、房间和高密度样式热点执行复杂度增长门禁。 |
| `scripts/complexity-baseline.json` | 开发资料 | 复杂度棘轮的当前行数预算；只允许通过后续有证据的拆分降低或调整。 |
| `README.md` | 开发资料 | 项目概览、游戏清单、启动方法和核心目录说明；测试数量文字需要随版本更新。 |
| `PROJECT_REPORT.md` | 开发资料 | 新游戏接入教程；定义大厅消息、服务端会话接口和前端客户端接口。 |
| `GAME_GROUPS.md` | 开发资料 | 大厅四大分组、`playMode` 和分类维护规范。 |
| `BGG_CARD_RESOURCES.md` | 开发资料 | 卡牌游戏的 BGG 美术资源选择、来源和使用记录。 |
| `RELEASE_CHECKLIST.md` | 开发资料 | 发布前版本、自动化门禁、人工签字、预发布检查和回滚纪律。 |
| `.github/workflows/verify.yml` | 开发资料 | 推送/合并请求的 Node 20/22 质量、回归、性能/清理、发布元数据审计和 Firefox/Chromium 浏览器烟测。 |

项目外还有 `/home/chy/桌面/jsgames综合开发与验收报告.md`，它是综合审计报告，不属于运行仓库。

## 3. 大厅前端

| 文件 | 状态 | 用途 |
| --- | --- | --- |
| `public/index.html` | 运行必需 | 正式大厅 HTML；包含玩家名、游戏目录、房间、聊天和游戏挂载容器。 |
| `public/script.js` | 运行必需 | 大厅组合入口；串联会话、房间协议、游戏加载和页面状态，不再承载目录、传输、弹层和等待桌的实现细节。 |
| `public/game-details.js` | 运行必需 | 28 款游戏的玩家向规则摘要，供“规则说明 → 房间设置”双页创建浮窗使用。 |
| `public/assets/covers/*.webp` | 运行必需 | 与注册表一一对应的 28 张现行高清横版封面，供创建房间规则浮窗使用。 |
| `public/assets/covers/thumbs/*.webp` | 运行必需 | 与高清封面同名的 28 张大厅缩略图。 |
| `public/style.css` | 运行必需 | 正式大厅、游戏卡片、双页创建浮窗和通用游戏外壳的基础样式；等待房间层见 `public/lobby/waiting-room.css`。 |
| `public/lobby/waiting-room.css` | 运行必需 | 等待房间控制、座位火焰、入场转场、魔法阵和移动端覆盖层；由大厅入口紧随全局样式加载。 |
| `public/lobby/catalog-data.js` | 前端必需 | 大厅游戏、分组、模式与美术元数据的单一来源。 |
| `public/lobby/catalog-view.js` | 前端必需 | 游戏目录、公开房间、筛选和卡片事件的视图层；通过状态访问器与协议解耦。 |
| `public/lobby/game-loader.js` | 前端必需 | 游戏客户端与样式的懒加载、预加载、缓存和资源状态。 |
| `public/lobby/transport.js` | 前端必需 | 大厅 WebSocket 生命周期、消息解码、发送和错误回调封装。 |
| `public/lobby/artwork.js` | 前端必需 | 封面预加载、懒加载、卡片入场观察器和减少动效处理。 |
| `public/lobby/room-dialog.js` | 前端必需 | 创建房间规则/设置双页弹层、元数据驱动选项和表单采集。 |
| `public/lobby/waiting-room-scene.js` | 前端必需 | 等待房间状态派生、座位几何、准备状态和桌面魔法阵渲染。 |
| `public/lobby/game-entry-transition.js` | 前端必需 | 等待桌到游戏桌的座位分组、能量汇聚和转场生命周期。 |
| `public/lobby/study-controls.js` | 前端必需 | 棋谱模式的执棋方切换、公开摆棋和确认控件。 |

## 4. 通用服务端

| 文件 | 状态 | 用途 |
| --- | --- | --- |
| `server/room.js` | 运行必需 | 通用房间生命周期；校验房间名称、可见性、人数上限与游戏专属设置，创建游戏会话、转发动作、系统 tick 和玩家视角状态。 |
| `server/realtime/create-realtime-server.js` | 运行必需 | 可实例化的实时大厅服务；封装 WebSocket 协议、会话/重连、房间路由、广播和定时 tick，每个实例拥有独立状态。 |
| `server/realtime/protocol.js` | 运行必需 | 纯消息边界；归一化历史卡牌动作并把已验证的消息分派到实时服务处理器。 |
| `server/realtime/broadcast.js` | 运行必需 | 实时广播边界；集中处理大厅/房间 JSON 编码和开放连接过滤。 |
| `server/realtime/lan-ip.js` | 运行必需 | 局域网地址筛选与 `/api/ip` 使用的纯工具。 |
| `server/realtime/security.js` | 运行必需 | WebSocket Origin、负载/JSON 结构、消息/聊天限流、IP 归一化和文本清洗策略。 |
| `server/games/registry.js` | 运行必需 | 28 个正式游戏的唯一运行时注册表。 |
| `server/games/groups.js` | 运行必需 | 为注册游戏附加大厅分组、排序和使用模式。 |

## 5. 游戏模块

除表中特例外，每个正式游戏都有四个文件：

- `public/games/<type>/client.js`：浏览器渲染、交互、动作提交和资源清理。
- `public/games/<type>/style.css`：该游戏独立主题、组件和手机端样式。
- `server/games/<type>/engine.js`：服务端权威规则、状态、合法性、隐私和胜负计算。
- `server/games/<type>/index.js`：大厅适配层，导出 `metadata` 和 `create()`。

复杂游戏的 `style.css` 只保留基础主题与外壳；版图、私有信息、交互、场景和响应式覆盖按需拆为同目录 CSS，并由 `public/games/common/game-manifest.js` 以固定顺序加载。拆分不改变选择器或客户端接口。

| type | 中文名 | 四类文件的具体职责 |
| --- | --- | --- |
| `acquire` | 并购 | `client.js`/`style.css` 显示酒店集团、股票和合并决策；`engine.js`/`index.js` 实现地块、建集团、合并、股东奖金、购股和清算。 |
| `aeroplane` | 飞行棋 | 前端显示经典棋盘、飞机和移动动画；服务端处理起飞、主航道、跳跃、飞行线、捕获和回家。 |
| `avalon` | 阿瓦隆 | 前端显示身份、组队、投票和任务；服务端处理角色知识、队长轮换、任务成败与刺杀梅林。 |
| `camelup` | 狂野骆驼 | 前端显示立体赛道、骆驼堆叠和下注牌；服务端处理金字塔、腿赛、观众板和终局下注。 |
| `checkers` | 中国跳棋 | 前端显示六角星棋盘和连续跳跃；服务端处理 121 孔棋盘、移动链、目标角和终局。 |
| `citadels` | 富饶之城 | 前端显示角色、城区和资源；服务端处理秘密选角、角色能力、建城和经典版计分。 |
| `coup` | 政变 | 前端使用现代角色牌和卡背显示声明、质疑、阻挡；服务端处理金币、影响力、交换和淘汰。 |
| `decrypto` | 谍报风云 | 前端显示关键词、密码和线索；服务端隔离队伍私密信息并处理截获/误导得分。 |
| `gobang` | 五子棋 | 前端显示棋盘、落子和胜负；服务端处理无禁手、长连算胜的自由五子棋。 |
| `guessnumber` | 猜数字 | 前端显示输入、历史和 A/B 反馈；服务端保存秘密答案并校验不重复四位数。 |
| `hanabi` | 花火 | 前端从持牌者视角隐藏自己的牌并显示提示知识；服务端处理提示、出牌、弃牌和终局轮。 |
| `jungle` | 斗兽棋 | 前端在通用网格组件上叠加河流、陷阱和兽穴；服务端处理兽阶、地形和占领兽穴。 |
| `junqi` | 军棋 | 前端显示暗棋布阵、铁路和行营；服务端处理军阶、工兵、地雷、炸弹和夺旗。 |
| `kingdomino` | 多米诺王国 | 前端显示选牌列、地形多米诺和 5×5 王国；服务端处理王冠顺序、摆放合法性和区域计分。 |
| `lasvegas` | 拉斯维加斯 | 前端显示赌场、骰子和钞票；服务端处理四轮掷骰、多数争夺、平票取消和派奖。 |
| `loveletter` | 情书 | 正式情书前端直接使用八张 BGG 裁切牌面；服务端处理基础版牌组、角色效果、保护、摊牌和爱心胜利。 |
| `magicalathlete` | 胡闹运动会 | 前端显示 36 名运动员、选秀、暗置卡背和 30 格赛道；服务端处理蛇形选角、四场竞速和角色能力。 |
| `manila` | 马尼拉 | 前端显示港口、货船、股份和投机位；服务端处理拍卖、装船、领航、海盗、保险和航程结算。 |
| `modernart` | 现代艺术 | 前端绘制艺术作品和五类拍卖；服务端处理四季市场、第五幅终止、成交和艺术家价值。 |
| `monopoly` | 环城大富翁 | 前端显示香港主题 40 格棋盘、棋子、地产和换肤；服务端处理置业、租金、拍卖、建筑、抵押、监狱和破产。 |
| `monopolydeal` | 大富翁纸牌 | 前端显示手牌、地产组、银行和支付选择；服务端处理正式牌组、三次行动、收租、交易、说不和三组胜利。 |
| `scout` | 马戏星探 | 前端显示不可重排、可翻转的双数字牌；服务端处理 Scout、Show、Scout & Show 和轮次计分。 |
| `splendor` | 璀璨宝石 | 前端显示宝石筹码、发展卡、预留牌和贵族；服务端处理拿宝石、购买、折扣、黄金、贵族和终局。 |
| `takefive` | 牛头王 | 前端显示数字牌、四行牌列和牛头；服务端处理同时选牌、升序结算、第六张收行和 66 分终局。 |
| `werewolf` | 狼人杀自动辅助 | 前端提供九/十二座手机身份、夜间技能、发言和投票；服务端自动推进昼夜、警长、死亡和胜负。 |
| `witchtown` | 猎巫镇 | 前端显示审判桌、身份、昼夜和牌区；服务端处理审判牌、阴谋传递、女巫行动、Constable/Gavel 与胜负。 |
| `xiangqi` | 中国象棋 | 前端提供 2D/Three.js 棋桌、中文字体和走棋动画；服务端处理棋子走法、将军、困毙和重复局面。 |

### 6.1 游戏模块特例文件

| 文件 | 状态 | 用途 |
| --- | --- | --- |
| `public/games/common/grid-client.js` | 运行必需 | 斗兽棋等规则网格游戏可复用的浏览器棋盘组件。 |
| `public/games/common/grid-client.css` | 运行必需 | 通用网格棋盘的布局和交互样式。 |
| `public/games/chess/lobby-client.js` | 运行必需 | 国际象棋大厅桥接器；创建 iframe 并转发大厅消息。 |
| `public/games/chess/room-frame.html` | 运行必需 | 国际象棋隔离运行文档，避免 Three.js/WebGL 受大厅布局影响。 |
| `public/games/chess/client.js` | 运行必需 | iframe 内的国际象棋 2D/3D 渲染和交互。 |
| `public/games/chess/chess3d.css` | 运行必需 | 国际象棋 2D/3D 棋室样式。 |
| `public/games/chess/standalone.html` | 开发资料 | 不连接大厅的国际象棋独立视觉测试页。 |
| `public/games/monopolydeal/choice.css` | 运行必需 | 大富翁纸牌颜色、支付和交换选择弹窗的补充样式。 |
| `public/games/acquire/board.css` | 运行必需 | 并购地图、地块、集团标记和手牌层；按清单在基础样式后加载。 |
| `public/games/acquire/rail.css` | 运行必需 | 并购股票、玩家侧栏和购买控件；按清单在版图层后加载。 |
| `public/games/acquire/scenes.css` | 运行必需 | 并购规则弹层、行动演出和响应式覆盖；按清单最后加载。 |
| `public/games/avalon/scenes.css` | 运行必需 | 阿瓦隆规则弹层、任务演出和响应式覆盖；按清单在基础样式后加载。 |
| `public/games/citadels/roles.css` | 运行必需 | 富饶之城角色牌、角色艺术和身份焦点层。 |
| `public/games/citadels/interactions.css` | 运行必需 | 富饶之城选角、回合行动和规则交互层。 |
| `public/games/citadels/responsive.css` | 运行必需 | 富饶之城平板、手机和短横屏布局覆盖。 |
| `public/games/citadels/scenes.css` | 运行必需 | 富饶之城行动确认、场景演出和减少动效覆盖。 |
| `public/games/coup/private.css` | 运行必需 | 政变私有影响力、卡背和牌面控制层。 |
| `public/games/coup/scenes.css` | 运行必需 | 政变行动控制台、质疑/阻挡演出和对话框。 |
| `public/games/coup/responsive.css` | 运行必需 | 政变手机、平板和短横屏布局覆盖。 |

## 6. 飞行棋专用素材

| 文件 | 状态 | 用途 |
| --- | --- | --- |
| `public/games/aeroplane/assets/SOURCE.txt` | 开发资料 | 记录棋盘来源、派生图和原创 SVG 棋子说明。 |
| `public/games/aeroplane/assets/board-sharp.png` | 运行必需 | 当前前端实际加载的高清经典飞行棋棋盘。 |
| `public/games/aeroplane/assets/blue-plane.svg` | 运行必需 | 蓝色玩家的矢量飞机棋子。 |
| `public/games/aeroplane/assets/green-plane.svg` | 运行必需 | 绿色玩家的矢量飞机棋子。 |
| `public/games/aeroplane/assets/red-plane.svg` | 运行必需 | 红色玩家的矢量飞机棋子。 |
| `public/games/aeroplane/assets/yellow-plane.svg` | 运行必需 | 黄色玩家的矢量飞机棋子。 |

## 7. 字体

| 文件 | 状态 | 用途 |
| --- | --- | --- |
| `public/fonts/HanWangLiSuMedium.ttf` | 运行必需 | 中国象棋棋子和标题使用的隶书字体。 |
| `public/fonts/HanWangLiSu-NOTICE.txt` | 开发资料 | 汉王中隶书字体来源/许可提示。 |
| `public/fonts/ZhiMangXing-Regular.ttf` | 运行必需 | 中国象棋“楚河汉界”等河界书法字体。 |
| `public/fonts/ZhiMangXing-OFL.txt` | 开发资料 | Zhi Mang Xing 字体的 OFL 许可文本。 |

## 8. 浏览器视觉验收页

这些页面可直接通过本地服务器访问，只注入固定状态，不进入正式大厅。

| 文件 | 状态 | 用途 |
| --- | --- | --- |
| `public/__camelup_visual_test.html` | 开发资料 | 狂野骆驼桌面/手机赛道与下注视觉验收。 |
| `public/__cardfaces_visual_test.html` | 开发资料 | 七款卡牌游戏的集中卡面验收。 |
| `public/__checkers_visual_test.html` | 开发资料 | 中国跳棋六角星棋盘视觉验收。 |
| `public/__coup_cards_visual_test.html` | 开发资料 | 政变现代版角色牌和卡背验收。 |
| `public/__magicalathlete_visual_test.html` | 开发资料 | 胡闹运动会选秀、卡面、卡背和赛道验收。 |
| `public/__manila_visual_test.html` | 开发资料 | 马尼拉航线、货船、码头和决策区验收。 |
| `public/__modernart_visual_test.html` | 开发资料 | 现代艺术作品卡和拍卖区验收。 |
| `public/__monopoly_alignment_test.html` | 开发资料 | 环城大富翁 40 格点击层与底图对齐检查。 |
| `public/__monopoly_skin_visual_test.html` | 开发资料 | 环城大富翁中央场景换肤检查。 |
| `public/__remaining_cards_visual_test.html` | 开发资料 | 其余卡牌/凭证组件的集中视觉验收。 |
| `public/__game_shell_visual_test.html` | 开发资料 | 统一游戏外壳视觉验收运行器；保留 `game` 与各游戏 `*State` URL 参数。 |
| `public/visual-fixtures/fixture-state.js` | 开发资料 | 28 款游戏的基础视觉状态构造器。 |
| `public/visual-fixtures/fixture-scenarios.js` | 开发资料 | URL 场景变体、演示事件和交互种子；由外壳运行器注入依赖调用。 |

## 9. 自动化测试

| 文件 | 状态 | 用途 |
| --- | --- | --- |
| `test/regression/*.test.js` | 测试必需 | 按核心协议与游戏域拆分的全项目综合回归；保留原有测试标题与断言。 |
| `test/support/regression.helper` | 测试必需 | 综合回归共享夹具、引擎导入和通用推进辅助；使用无扩展名避免被 Node 测试发现器误当成测试文件。 |
| `test/acquire-official.test.js` | 测试必需 | 并购设置、集团、股票、合并、红利和完整对局。 |
| `test/avalon-official.test.js` | 测试必需 | 阿瓦隆人数、任务配置、身份隐私、刺杀和完整对局。 |
| `test/camelup-official.test.js` | 测试必需 | 狂野骆驼堆叠、观众板、腿赛/终局下注和完整对局。 |
| `test/checkers.test.js` | 测试必需 | 中国跳棋棋盘、方向、合法移动、连续跳跃、断线和房间适配。 |
| `test/citadels-official.test.js` | 测试必需 | 富饶之城经典牌库、角色隐私、角色能力和七人完整对局。 |
| `test/coup-official.test.js` | 测试必需 | 政变牌组、行动、质疑、阻挡、交换和六人完整对局。 |
| `test/decrypto-official.test.js` | 测试必需 | 谍报风云密码隐私、线索限制、截获和三人变体。 |
| `test/gobang.test.js` | 测试必需 | 五子棋轮次、非法落子、各方向胜利和完整对局。 |
| `test/guessnumber-official.test.js` | 测试必需 | 猜数字生命周期、格式、重复猜测和隐私。 |
| `test/hanabi-official.test.js` | 测试必需 | 花火牌组、持牌视角、提示、令牌、失误和终局轮。 |
| `test/kingdomino-official.test.js` | 测试必需 | 多米诺王国选牌、翻转、摆放、弃置、计分和完整对局。 |
| `test/lasvegas-official.test.js` | 测试必需 | 拉斯维加斯设置、平票派奖和五人完整四轮。 |
| `test/loveletter-official.test.js` | 测试必需 | 情书全部角色、非法动作、隐私、轮末和完整比赛。 |
| `test/magicalathlete-official.test.js` | 测试必需 | 胡闹运动会赛道、能力、隐私、暗置状态和完整锦标赛。 |
| `test/manila-official.test.js` | 测试必需 | 马尼拉股份、拍卖、领航、海盗、保险和最终资产。 |
| `test/modernart-official.test.js` | 测试必需 | 现代艺术设置、双重/定价拍卖、四季和三人变体。 |
| `test/monopoly-official.test.js` | 测试必需 | 环城大富翁设置、建筑银行、抵押和完整破产对局。 |
| `test/monopolydeal-official.test.js` | 测试必需 | 大富翁纸牌牌组、回合、地产、收租、支付和完整胜利。 |
| `test/scout-official.test.js` | 测试必需 | 马戏星探牌组、组合、Scout & Show 回滚和完整对局。 |
| `test/splendor-official.test.js` | 测试必需 | 璀璨宝石牌库、筹码、购买、预留、贵族和终局。 |
| `test/takefive-official.test.js` | 测试必需 | 牛头王牌组、同时选择、低牌选行和十人完整牌局。 |
| `test/witchtown-official.test.js` | 测试必需 | 猎巫镇人数、审判牌隐私、夜间流程、黑猫和完整对局。 |

## 10. 专项验收脚本

| 文件 | 状态 | 用途 |
| --- | --- | --- |
| `scripts/checkers-acceptance.js` | 测试必需 | 自动跑中国跳棋正常、规则边界和随机复现局，并写出 JSON 记录。 |
| `scripts/gobang-acceptance.js` | 测试必需 | 自动跑五子棋正常、规则、和棋和随机复现局，并写出 JSON 记录。 |
| `scripts/syntax-check.js` | 测试必需 | 对首方 `app.js`、服务端、前端、脚本和测试文件执行 `node --check` 语法门禁。 |
| `scripts/browser-runtime-smoke.js` | 测试必需 | 自启临时 HTTP/WebSocket 与 Firefox，导入 28 个客户端，执行公开/私密房间、核心落子、传输断线自动重连、刷新恢复和离场资源释放的双标签生命周期，复核花火/谍报风云隐私隔离与四款身份牌的键盘/触屏收束，并跑 24 款游戏四档视口运行时烟测。 |
| `scripts/chromium-runtime-smoke.js` | 测试必需 | 使用 Chromium DevTools Protocol 复核 28 个客户端导入、72 个桌面/移动视口，以及四款身份牌、花火和谍报风云的隐私/输入收束；需通过 `CHROMIUM_BIN` 或 `CHROME_BIN` 提供浏览器。 |
| `scripts/performance-smoke.js` | 测试必需 | 检查首方静态资源体积、本地静态请求并发，以及大厅连接和多房间创建/加入/离开后的 WebSocket/房间清理；这是有界烟测，不是生产容量压测。 |
| `scripts/report-audit.js` | 测试必需 | 从运行时注册表核对 28 份游戏报告、当前报告入口和规则矩阵，并检查 JSON 工件边界。 |
| `scripts/release-audit.js` | 测试必需 | 检查版本与锁文件同步、必需发布脚本、systemd/Nginx 部署模板、`.gitignore` 和 Git 跟踪文件卫生。 |
| `scripts/deployment-smoke.js` | 测试必需 | 以生产环境变量启动真实 `bin/www`，检查健康检查、安全响应头、WebSocket 建房和 SIGTERM 优雅退出。 |
| `scripts/acceptance-gate.js` | 测试必需 | 按固定顺序执行依赖、语法、回归、Firefox、性能/清理、报告、发布和生产形态部署门禁，最后检查 `git diff --check`。 |

## 11. 测试与验收报告

| 文件 | 状态 | 用途 |
| --- | --- | --- |
| `TEST_REPORTS/README.md` | 开发资料 | 所有验收报告的总览和口径。 |
| `TEST_REPORTS/lobby.md` | 开发资料 | 大厅、房间、注册表和多人协议验收。 |
| `TEST_REPORTS/lobby-history.md` | 开发资料 | 大厅历次批次日志，仅用于历史追溯，不作为当前状态来源。 |
| `TEST_REPORTS/phase4-runtime.md` | 开发资料 | 浏览器运行时、性能预算、清理门禁和发布模板验收。 |
| `TEST_REPORTS/artifacts.md` | 开发资料 | 说明跳棋/五子棋 JSON 动作追踪的生成位置和保留策略。 |
| `TEST_REPORTS/rule-acceptance-matrix.md` | 开发资料 | 28 款游戏的规则版本、状态分级和正式验收入口。 |
| `TEST_REPORTS/security.md` | 开发资料 | WebSocket、会话、私密信息和公网发布前安全风险清单。 |
| `TEST_REPORTS/asset-license-clearance.md` | 开发资料 | BGG、网易、字体和原创素材的授权签字清单。 |
| `TEST_REPORTS/release-baseline.md` | 开发资料 | 版本、提交、门禁输出和发布前人工签字基线。 |
| `TEST_REPORTS/acquire.md` | 开发资料 | 并购规则与完整对局报告。 |
| `TEST_REPORTS/aeroplane.md` | 开发资料 | 飞行棋规则、已知变体和验收记录。 |
| `TEST_REPORTS/avalon.md` | 开发资料 | 阿瓦隆身份、任务和刺杀流程报告。 |
| `TEST_REPORTS/camelup.md` | 开发资料 | 狂野骆驼正式规则与视觉验收报告。 |
| `TEST_REPORTS/checkers.md` | 开发资料 | 中国跳棋规则和完整对局验收报告。 |
| `TEST_REPORTS/chess.md` | 开发资料 | 国际象棋规则、3D 前端和边界报告。 |
| `TEST_REPORTS/citadels.md` | 开发资料 | 富饶之城经典版验收报告。 |
| `TEST_REPORTS/coup.md` | 开发资料 | 政变规则、隐私与前端验收报告。 |
| `TEST_REPORTS/decrypto.md` | 开发资料 | 谍报风云正式规则和隐私验收报告。 |
| `TEST_REPORTS/gobang.md` | 开发资料 | 五子棋核心规则和完整对局报告。 |
| `TEST_REPORTS/guessnumber.md` | 开发资料 | 猜数字格式、隐私和终局报告。 |
| `TEST_REPORTS/hanabi.md` | 开发资料 | 花火正式牌组、提示与终局报告。 |
| `TEST_REPORTS/jungle.md` | 开发资料 | 斗兽棋地形与走子报告。 |
| `TEST_REPORTS/junqi.md` | 开发资料 | 军棋暗棋、布阵、铁路和战斗报告。 |
| `TEST_REPORTS/kingdomino.md` | 开发资料 | 多米诺王国选牌、摆放和计分报告。 |
| `TEST_REPORTS/lasvegas.md` | 开发资料 | 拉斯维加斯设置、派奖和完整对局报告。 |
| `TEST_REPORTS/loveletter.md` | 开发资料 | 情书经典基础版正式规则报告。 |
| `TEST_REPORTS/magicalathlete.md` | 开发资料 | 胡闹运动会规则、赛道和视觉报告。 |
| `TEST_REPORTS/manila.md` | 开发资料 | 马尼拉航程、经济、隐私和视觉报告。 |
| `TEST_REPORTS/modernart.md` | 开发资料 | 现代艺术拍卖、市场和视觉报告。 |
| `TEST_REPORTS/monopoly.md` | 开发资料 | 环城大富翁正式规则与棋盘报告。 |
| `TEST_REPORTS/monopolydeal.md` | 开发资料 | 大富翁纸牌正式牌组和行动报告。 |
| `TEST_REPORTS/scout.md` | 开发资料 | 马戏星探正式规则和完整对局报告。 |
| `TEST_REPORTS/splendor.md` | 开发资料 | 璀璨宝石规则、隐私和完整对局报告。 |
| `TEST_REPORTS/takefive.md` | 开发资料 | 牛头王正式牌组和多人完整对局报告。 |
| `TEST_REPORTS/werewolf.md` | 开发资料 | 狼人杀自动流程、座位、断线和隐私报告。 |
| `TEST_REPORTS/witchtown.md` | 开发资料 | 猎巫镇审判、夜间和终局报告。 |
| `TEST_REPORTS/xiangqi.md` | 开发资料 | 中国象棋走法、将军和重复局面报告。 |
| `TEST_REPORTS/artifacts/*.json` | 测试工件（不入 Git） | 跳棋/五子棋专项脚本按需生成的完整动作与复现数据。 |

## 12. BGG 资源总说明

当前大厅只加载 `public/assets/covers/` 下与注册表同名的 28 张高清封面和 28 张缩略图。BGG 目录只保留现行客户端直接加载的素材，以及仍需随项目保存的来源记录；15 张不参与运行的原始合集、示例和纯参考图已移到桌面归档。

`public/assets/bgg/SOURCES.md` 是全部 BGG 图片的来源、图片 ID、版本和用途总表。一般命名规则：

- `cover.*`：旧版盒面/封面参考，不再是大厅默认封面。
- `detail.*`：规则弹窗、组件参考或组件视觉来源。
- `reference-*`：仍需随项目保存的美术设计参考；不再需要的参考图放在桌面归档。
- 裁切单图：供正式牌面、地形或角色直接加载。

### 12.1 按游戏逐文件说明

- `public/assets/bgg/acquire/cover.jpg`：并购当前 60 周年版大厅封面。
- `public/assets/bgg/avalon/cover.jpg`：阿瓦隆大厅封面；`detail.jpg`：身份牌和任务组件参考。
- `public/assets/bgg/camelup/cover.jpg`：狂野骆驼大厅封面；`detail.jpg`：赛道和下注组件参考。
- `public/assets/bgg/citadels/cover.jpg`：富饶之城来源封面；`detail.jpg`：角色牌组件参考；`reference-role-front-back.jpg`：角色正反面和卡背参考。
- `public/assets/bgg/decrypto/cover.jpg`：谍报风云大厅封面；`detail.png`：密码板和组件参考。
- `public/assets/bgg/lasvegas/cover.jpg`：拉斯维加斯大厅封面；`detail.jpg`：赌场、骰子和钞票参考。
- `public/assets/bgg/magicalathlete/cover.png`：胡闹运动会大厅封面；`detail.png`：运动员牌和赛道组件参考。
- `public/assets/bgg/manila/cover.jpg`：马尼拉大厅封面；`detail.jpg`：货船和港口组件参考。
- `public/assets/bgg/monopoly/cover.jpg`：环城大富翁大厅封面；游戏内使用原创香港棋盘分层素材。
- `public/assets/bgg/scout/cover.png`：马戏星探大厅封面；`detail.jpg`：双数字牌和筹码参考。

#### 政变

- `public/assets/bgg/coup/cover.jpg`：大厅封面。
- `modern-duke.jpg`、`modern-assassin.jpg`、`modern-captain.jpg`、`modern-ambassador.jpg`、`modern-contessa.jpg`：当前正式五种角色牌面。
- `modern-back.jpg`：当前正式卡背。
- `modern-roles.jpg`：现代版角色牌合照和大厅组件参考。

#### 情书

- `public/assets/bgg/loveletter/cover.jpg`：大厅封面。
- `detail.jpg`：八张角色牌的原始 4×2 合照。
- `cards/guard.jpg`、`priest.jpg`、`baron.jpg`、`handmaid.jpg`、`prince.jpg`、`king.jpg`、`countess.jpg`、`princess.jpg`：正式前端使用的八张完整角色牌裁图。

#### 花火

- `public/assets/bgg/hanabi/cover.jpg`：大厅封面。
- 正式牌面、提示状态和卡背均由 HTML/CSS 按实时状态绘制。

#### 多米诺王国

- `public/assets/bgg/kingdomino/README.md`：地形图来源与现行文件说明。
- `cover.png`：大厅封面。
- `forest-1.jpg`、`forest-2.jpg`、`forest-3.jpg`、`forest-4.jpg`：正式森林地形四种变化。
- `wheat-1.jpg`、`wheat-2.jpg`、`wheat-3.jpg`、`wheat-4.jpg`：正式麦田地形四种变化。
- `meadow-1.jpg`、`meadow-2.jpg`、`meadow-3.jpg`、`meadow-4.jpg`：正式草地地形四种变化。
- `sea-1.jpg`、`sea-2.jpg`、`sea-3.jpg`、`sea-4.jpg`：正式海洋地形四种变化。
- `swamp-1.jpg`、`swamp-2.jpg`、`swamp-3.jpg`、`swamp-4.jpg`：正式沼泽地形四种变化。
- `mine-1.jpg`、`mine-2.jpg`、`mine-3.jpg`：正式矿山地形三种变化。

#### 现代艺术

- `public/assets/bgg/modernart/cover.png`：大厅封面。
- `detail.jpg`：作品与拍卖组件参考。
- 当前作品卡由 HTML/CSS 重绘；五张不参与运行的艺术家风格参考图已归档。

#### 大富翁纸牌

- `public/assets/bgg/monopolydeal/cover.jpg`：大厅封面。
- `detail.jpg`：规则弹窗中的组件参考。
- `card-back.jpg`：正式前端使用的卡背。
- 地产、行动和现金牌面由 HTML/CSS 绘制；六张不参与运行的原始合集与示例牌已归档。

#### 璀璨宝石

- `public/assets/bgg/splendor/original-cover.jpg`：当前大厅使用的原版盒面。
- `art-1.jpg` 至 `art-8.jpg`：正式发展卡按等级分配使用的八张插画。
- `detail.jpg`：贵族和组件参考。

#### 牛头王

- `public/assets/bgg/takefive/cover.jpg`：当前大厅使用的盒面。
- 当前数字牌和卡背由 HTML/CSS 按实时状态绘制。

## 13. 游戏生成图与精灵图

| 文件 | 状态 | 用途 |
| --- | --- | --- |
| `public/assets/games/magicalathlete/athlete-sprites-alpha.png` | 运行必需 | 36 名运动员的透明 6×6 精灵图，所有卡面和赛道头像实际加载。 |
| `public/assets/games/witchtown/townhall-sprites-alpha.png` | 运行必需 | 猎巫镇地点/市政厅组件透明精灵图，正式前端实际加载。 |

## 14. 环城大富翁原创素材

| 文件 | 状态 | 用途 |
| --- | --- | --- |
| `public/assets/monopoly/README.md` | 开发资料 | 棋盘分层、换肤、坐标和棋子素材说明。 |
| `hong-kong-board-frame.png` | 运行必需 | 正式棋盘外圈、格子文字和透明中央框。 |
| `hong-kong-board-center.png` | 运行必需 | 默认“维港纪念”中央场景。 |
| `hong-kong-board-center-neon.png` | 运行必需 | 可选“霓虹雨夜”中央场景。 |
| `tokens/2d-{tram,ferry,junk,taxi,lantern,bauhinia,cable-car,dim-sum}.png` | 运行必需 | 2D 棋盘使用的八枚玩家棋子。 |
| `tokens/3d-{tram,ferry,junk,taxi,lantern,bauhinia,cable-car,dim-sum}.png` | 运行必需 | 3D 棋盘使用的八枚玩家棋子。 |

上述未写完整前缀的文件均位于 `public/assets/monopoly/`；旧的无前缀棋子和两张生成图集已归档。

## 15. 狼人杀网易角色图

| 文件 | 状态 | 用途 |
| --- | --- | --- |
| `public/assets/werewolf-netease/README.md` | 开发资料 | 角色图来源、下载日期和授权风险说明。 |
| `characters/langr.png` | 运行必需 | 狼人立绘。 |
| `characters/yyj.png` | 运行必需 | 预言家立绘。 |
| `characters/nw.png` | 运行必需 | 女巫立绘。 |
| `characters/lr.png` | 运行必需 | 猎人立绘。 |
| `characters/sw.png` | 运行必需 | 守卫立绘。 |
| `characters/pm.png` | 运行必需 | 平民立绘。 |

当前九/十二人基础流程只加载以上六种角色图；39 张未启用扩展角色图和旧索引已归档。公开或商业发布前仍需再次确认网易图片授权。

## 16. 核心路径索引

下面逐项列出需要单独说明的入口、测试和美术资源；成套封面、重复结构的游戏模块等使用前文通配规则，不再逐个展开。详细背景以前述章节为准。

- `.gitignore` — 排除依赖、日志、环境变量、构建产物和编辑器缓存。
- `.vscode/launch.json` — VS Code 的服务端和浏览器调试配置。
- `BGG_CARD_RESOURCES.md` — BGG 卡牌美术选择与来源清单。
- `FILE_CATALOG.md` — 本目录与用途清单。
- `GAME_GROUPS.md` — 大厅分组与 playMode 规范。
- `PROJECT_REPORT.md` — 新游戏接入协议和开发教程。
- `README.md` — 项目概览、启动和开发说明。
- `TEST_REPORTS/README.md` — 专项测试报告总览。
- `TEST_REPORTS/artifacts.md` — 专项 JSON 工件的生成和归档说明。
- `TEST_REPORTS/asset-license-clearance.md` — 美术与字体授权清单。
- `TEST_REPORTS/lobby.md` — 大厅当前协议、权限、隐私和自动化基线。
- `TEST_REPORTS/lobby-history.md` — 大厅历次批次日志，仅用于追溯。
- `TEST_REPORTS/phase4-runtime.md` — 浏览器运行时、性能预算和清理门禁。
- `TEST_REPORTS/acquire.md` — 并购的规则、隐私、完整对局或视觉验收报告。
- `TEST_REPORTS/aeroplane.md` — 飞行棋的规则、隐私、完整对局或视觉验收报告。
- `TEST_REPORTS/avalon.md` — 阿瓦隆的规则、隐私、完整对局或视觉验收报告。
- `TEST_REPORTS/camelup.md` — 狂野骆驼的规则、隐私、完整对局或视觉验收报告。
- `TEST_REPORTS/checkers.md` — 中国跳棋的规则、隐私、完整对局或视觉验收报告。
- `TEST_REPORTS/chess.md` — 国际象棋的规则、隐私、完整对局或视觉验收报告。
- `TEST_REPORTS/citadels.md` — 富饶之城的规则、隐私、完整对局或视觉验收报告。
- `TEST_REPORTS/coup.md` — 政变的规则、隐私、完整对局或视觉验收报告。
- `TEST_REPORTS/decrypto.md` — 谍报风云的规则、隐私、完整对局或视觉验收报告。
- `TEST_REPORTS/release-baseline.md` — 发布基线、门禁结果和人工签字清单。
- `TEST_REPORTS/gobang.md` — 五子棋的规则、隐私、完整对局或视觉验收报告。
- `TEST_REPORTS/guessnumber.md` — 猜数字的规则、隐私、完整对局或视觉验收报告。
- `TEST_REPORTS/hanabi.md` — 花火的规则、隐私、完整对局或视觉验收报告。
- `TEST_REPORTS/jungle.md` — 斗兽棋的规则、隐私、完整对局或视觉验收报告。
- `TEST_REPORTS/junqi.md` — 军棋的规则、隐私、完整对局或视觉验收报告。
- `TEST_REPORTS/kingdomino.md` — 多米诺王国的规则、隐私、完整对局或视觉验收报告。
- `TEST_REPORTS/lasvegas.md` — 拉斯维加斯的规则、隐私、完整对局或视觉验收报告。
- `TEST_REPORTS/loveletter.md` — 情书的规则、隐私、完整对局或视觉验收报告。
- `TEST_REPORTS/magicalathlete.md` — 胡闹运动会的规则、隐私、完整对局或视觉验收报告。
- `TEST_REPORTS/manila.md` — 马尼拉的规则、隐私、完整对局或视觉验收报告。
- `TEST_REPORTS/modernart.md` — 现代艺术的规则、隐私、完整对局或视觉验收报告。
- `TEST_REPORTS/monopoly.md` — 环城大富翁的规则、隐私、完整对局或视觉验收报告。
- `TEST_REPORTS/monopolydeal.md` — 大富翁纸牌的规则、隐私、完整对局或视觉验收报告。
- `TEST_REPORTS/scout.md` — 马戏星探的规则、隐私、完整对局或视觉验收报告。
- `TEST_REPORTS/splendor.md` — 璀璨宝石的规则、隐私、完整对局或视觉验收报告。
- `TEST_REPORTS/takefive.md` — 牛头王的规则、隐私、完整对局或视觉验收报告。
- `TEST_REPORTS/werewolf.md` — 狼人杀自动辅助的规则、隐私、完整对局或视觉验收报告。
- `TEST_REPORTS/witchtown.md` — 猎巫镇的规则、隐私、完整对局或视觉验收报告。
- `TEST_REPORTS/xiangqi.md` — 中国象棋的规则、隐私、完整对局或视觉验收报告。
- `TEST_REPORTS/rule-acceptance-matrix.md` — 28 款游戏规则验收矩阵。
- `TEST_REPORTS/security.md` — 应用层安全验收与发布前风险清单。
- `app.js` — Express 静态站点、WebSocket、玩家会话和房间广播总入口。
- `bin/www` — 创建 HTTP 服务并启动 app.js 的 npm start 入口。
- `package-lock.json` — 锁定 npm 依赖版本。
- `package.json` — npm 命令和依赖声明。
- `public/__camelup_visual_test.html` — 狂野骆驼前端视觉验收页
- `public/__cardfaces_visual_test.html` — 七款卡牌集中视觉验收页
- `public/__checkers_visual_test.html` — 中国跳棋棋盘视觉验收页
- `public/__coup_cards_visual_test.html` — 政变现代卡面视觉验收页
- `public/__magicalathlete_visual_test.html` — 胡闹运动会卡面、卡背和赛道视觉验收页
- `public/__manila_visual_test.html` — 马尼拉前端视觉验收页
- `public/__modernart_visual_test.html` — 现代艺术前端视觉验收页
- `public/__monopoly_alignment_test.html` — 环城大富翁棋盘对齐检查页
- `public/__monopoly_skin_visual_test.html` — 环城大富翁换肤检查页
- `public/__remaining_cards_visual_test.html` — 其余卡牌组件集中视觉验收页
- `public/assets/bgg/SOURCES.md` — 全部 BGG 图片来源、版本和用途说明。
- `public/assets/bgg/acquire/cover.jpg` — 并购的大厅盒面/封面素材。
- `public/assets/bgg/avalon/cover.jpg` — 阿瓦隆的大厅盒面/封面素材。
- `public/assets/bgg/avalon/detail.jpg` — 阿瓦隆的 BGG 组件、牌面或实物参考图。
- `public/assets/bgg/camelup/cover.jpg` — 狂野骆驼的大厅盒面/封面素材。
- `public/assets/bgg/camelup/detail.jpg` — 狂野骆驼的 BGG 组件、牌面或实物参考图。
- `public/assets/bgg/citadels/cover.jpg` — 富饶之城的大厅盒面/封面素材。
- `public/assets/bgg/citadels/detail.jpg` — 富饶之城的 BGG 组件、牌面或实物参考图。
- `public/assets/bgg/citadels/reference-role-front-back.jpg` — 富饶之城的版本美术参考图。
- `public/assets/bgg/coup/cover.jpg` — 政变的大厅盒面/封面素材。
- `public/assets/bgg/coup/modern-ambassador.jpg` — 政变的现行牌面、卡背、地形或插画素材；具体用途见第 12 节。
- `public/assets/bgg/coup/modern-assassin.jpg` — 政变的现行牌面、卡背、地形或插画素材；具体用途见第 12 节。
- `public/assets/bgg/coup/modern-back.jpg` — 政变的现行牌面、卡背、地形或插画素材；具体用途见第 12 节。
- `public/assets/bgg/coup/modern-captain.jpg` — 政变的现行牌面、卡背、地形或插画素材；具体用途见第 12 节。
- `public/assets/bgg/coup/modern-contessa.jpg` — 政变的现行牌面、卡背、地形或插画素材；具体用途见第 12 节。
- `public/assets/bgg/coup/modern-duke.jpg` — 政变的现行牌面、卡背、地形或插画素材；具体用途见第 12 节。
- `public/assets/bgg/coup/modern-roles.jpg` — 政变的现行牌面、卡背、地形或插画素材；具体用途见第 12 节。
- `public/assets/bgg/decrypto/cover.jpg` — 谍报风云的大厅盒面/封面素材。
- `public/assets/bgg/decrypto/detail.png` — 谍报风云的 BGG 组件、牌面或实物参考图。
- `public/assets/bgg/hanabi/cover.jpg` — 花火的大厅盒面/封面素材。
- `public/assets/bgg/kingdomino/README.md` — 多米诺王国地形裁图来源和版本说明。
- `public/assets/bgg/kingdomino/cover.png` — 多米诺王国的大厅盒面/封面素材。
- `public/assets/bgg/kingdomino/forest-1.jpg` — 多米诺王国的现行牌面、卡背、地形或插画素材；具体用途见第 12 节。
- `public/assets/bgg/kingdomino/forest-2.jpg` — 多米诺王国的现行牌面、卡背、地形或插画素材；具体用途见第 12 节。
- `public/assets/bgg/kingdomino/forest-3.jpg` — 多米诺王国的现行牌面、卡背、地形或插画素材；具体用途见第 12 节。
- `public/assets/bgg/kingdomino/forest-4.jpg` — 多米诺王国的现行牌面、卡背、地形或插画素材；具体用途见第 12 节。
- `public/assets/bgg/kingdomino/meadow-1.jpg` — 多米诺王国的现行牌面、卡背、地形或插画素材；具体用途见第 12 节。
- `public/assets/bgg/kingdomino/meadow-2.jpg` — 多米诺王国的现行牌面、卡背、地形或插画素材；具体用途见第 12 节。
- `public/assets/bgg/kingdomino/meadow-3.jpg` — 多米诺王国的现行牌面、卡背、地形或插画素材；具体用途见第 12 节。
- `public/assets/bgg/kingdomino/meadow-4.jpg` — 多米诺王国的现行牌面、卡背、地形或插画素材；具体用途见第 12 节。
- `public/assets/bgg/kingdomino/mine-1.jpg` — 多米诺王国的现行牌面、卡背、地形或插画素材；具体用途见第 12 节。
- `public/assets/bgg/kingdomino/mine-2.jpg` — 多米诺王国的现行牌面、卡背、地形或插画素材；具体用途见第 12 节。
- `public/assets/bgg/kingdomino/mine-3.jpg` — 多米诺王国的现行牌面、卡背、地形或插画素材；具体用途见第 12 节。
- `public/assets/bgg/kingdomino/sea-1.jpg` — 多米诺王国的现行牌面、卡背、地形或插画素材；具体用途见第 12 节。
- `public/assets/bgg/kingdomino/sea-2.jpg` — 多米诺王国的现行牌面、卡背、地形或插画素材；具体用途见第 12 节。
- `public/assets/bgg/kingdomino/sea-3.jpg` — 多米诺王国的现行牌面、卡背、地形或插画素材；具体用途见第 12 节。
- `public/assets/bgg/kingdomino/sea-4.jpg` — 多米诺王国的现行牌面、卡背、地形或插画素材；具体用途见第 12 节。
- `public/assets/bgg/kingdomino/swamp-1.jpg` — 多米诺王国的现行牌面、卡背、地形或插画素材；具体用途见第 12 节。
- `public/assets/bgg/kingdomino/swamp-2.jpg` — 多米诺王国的现行牌面、卡背、地形或插画素材；具体用途见第 12 节。
- `public/assets/bgg/kingdomino/swamp-3.jpg` — 多米诺王国的现行牌面、卡背、地形或插画素材；具体用途见第 12 节。
- `public/assets/bgg/kingdomino/swamp-4.jpg` — 多米诺王国的现行牌面、卡背、地形或插画素材；具体用途见第 12 节。
- `public/assets/bgg/kingdomino/wheat-1.jpg` — 多米诺王国的现行牌面、卡背、地形或插画素材；具体用途见第 12 节。
- `public/assets/bgg/kingdomino/wheat-2.jpg` — 多米诺王国的现行牌面、卡背、地形或插画素材；具体用途见第 12 节。
- `public/assets/bgg/kingdomino/wheat-3.jpg` — 多米诺王国的现行牌面、卡背、地形或插画素材；具体用途见第 12 节。
- `public/assets/bgg/kingdomino/wheat-4.jpg` — 多米诺王国的现行牌面、卡背、地形或插画素材；具体用途见第 12 节。
- `public/assets/bgg/lasvegas/cover.jpg` — 拉斯维加斯的大厅盒面/封面素材。
- `public/assets/bgg/lasvegas/detail.jpg` — 拉斯维加斯的 BGG 组件、牌面或实物参考图。
- `public/assets/bgg/loveletter/cards/baron.jpg` — 情书的现行牌面、卡背、地形或插画素材；具体用途见第 12 节。
- `public/assets/bgg/loveletter/cards/countess.jpg` — 情书的现行牌面、卡背、地形或插画素材；具体用途见第 12 节。
- `public/assets/bgg/loveletter/cards/guard.jpg` — 情书的现行牌面、卡背、地形或插画素材；具体用途见第 12 节。
- `public/assets/bgg/loveletter/cards/handmaid.jpg` — 情书的现行牌面、卡背、地形或插画素材；具体用途见第 12 节。
- `public/assets/bgg/loveletter/cards/king.jpg` — 情书的现行牌面、卡背、地形或插画素材；具体用途见第 12 节。
- `public/assets/bgg/loveletter/cards/priest.jpg` — 情书的现行牌面、卡背、地形或插画素材；具体用途见第 12 节。
- `public/assets/bgg/loveletter/cards/prince.jpg` — 情书的现行牌面、卡背、地形或插画素材；具体用途见第 12 节。
- `public/assets/bgg/loveletter/cards/princess.jpg` — 情书的现行牌面、卡背、地形或插画素材；具体用途见第 12 节。
- `public/assets/bgg/loveletter/cover.jpg` — 情书的大厅盒面/封面素材。
- `public/assets/bgg/loveletter/detail.jpg` — 情书的 BGG 组件、牌面或实物参考图。
- `public/assets/bgg/magicalathlete/cover.png` — 胡闹运动会的大厅盒面/封面素材。
- `public/assets/bgg/magicalathlete/detail.png` — 胡闹运动会的 BGG 组件、牌面或实物参考图。
- `public/assets/bgg/manila/cover.jpg` — 马尼拉的大厅盒面/封面素材。
- `public/assets/bgg/manila/detail.jpg` — 马尼拉的 BGG 组件、牌面或实物参考图。
- `public/assets/bgg/modernart/cover.png` — 现代艺术的大厅盒面/封面素材。
- `public/assets/bgg/modernart/detail.jpg` — 现代艺术的 BGG 组件、牌面或实物参考图。
- `public/assets/bgg/monopoly/cover.jpg` — 环城大富翁的大厅盒面/封面素材。
- `public/assets/bgg/monopolydeal/card-back.jpg` — 大富翁纸牌的现行牌面、卡背、地形或插画素材；具体用途见第 12 节。
- `public/assets/bgg/monopolydeal/cover.jpg` — 大富翁纸牌的大厅盒面/封面素材。
- `public/assets/bgg/monopolydeal/detail.jpg` — 大富翁纸牌的 BGG 组件、牌面或实物参考图。
- `public/assets/bgg/scout/cover.png` — 马戏星探的大厅盒面/封面素材。
- `public/assets/bgg/scout/detail.jpg` — 马戏星探的 BGG 组件、牌面或实物参考图。
- `public/assets/bgg/splendor/art-1.jpg` — 璀璨宝石的现行牌面、卡背、地形或插画素材；具体用途见第 12 节。
- `public/assets/bgg/splendor/art-2.jpg` — 璀璨宝石的现行牌面、卡背、地形或插画素材；具体用途见第 12 节。
- `public/assets/bgg/splendor/art-3.jpg` — 璀璨宝石的现行牌面、卡背、地形或插画素材；具体用途见第 12 节。
- `public/assets/bgg/splendor/art-4.jpg` — 璀璨宝石的现行牌面、卡背、地形或插画素材；具体用途见第 12 节。
- `public/assets/bgg/splendor/art-5.jpg` — 璀璨宝石的现行牌面、卡背、地形或插画素材；具体用途见第 12 节。
- `public/assets/bgg/splendor/art-6.jpg` — 璀璨宝石的现行牌面、卡背、地形或插画素材；具体用途见第 12 节。
- `public/assets/bgg/splendor/art-7.jpg` — 璀璨宝石的现行牌面、卡背、地形或插画素材；具体用途见第 12 节。
- `public/assets/bgg/splendor/art-8.jpg` — 璀璨宝石的现行牌面、卡背、地形或插画素材；具体用途见第 12 节。
- `public/assets/bgg/splendor/detail.jpg` — 璀璨宝石的 BGG 组件、牌面或实物参考图。
- `public/assets/bgg/splendor/original-cover.jpg` — 璀璨宝石的大厅盒面/封面素材。
- `public/assets/bgg/takefive/cover.jpg` — 牛头王的大厅盒面/封面素材。
- `public/assets/games/magicalathlete/athlete-sprites-alpha.png` — 胡闹运动会正式使用的透明 36 人精灵图。
- `public/assets/games/witchtown/townhall-sprites-alpha.png` — 猎巫镇正式使用的透明地点精灵图。
- `public/assets/monopoly/README.md` — 香港主题棋盘分层、换肤和棋子素材说明。
- `public/assets/monopoly/hong-kong-board-center-neon.png` — 环城大富翁香港棋盘的运行图层、皮肤或可再加工源文件；具体见第 14 节。
- `public/assets/monopoly/hong-kong-board-center.png` — 环城大富翁香港棋盘的运行图层、皮肤或可再加工源文件；具体见第 14 节。
- `public/assets/monopoly/hong-kong-board-frame.png` — 环城大富翁香港棋盘的运行图层、皮肤或可再加工源文件；具体见第 14 节。
- `public/assets/monopoly/tokens/2d-bauhinia.png` — 环城大富翁 2D 洋紫荆棋子。
- `public/assets/monopoly/tokens/2d-cable-car.png` — 环城大富翁 2D 缆车棋子。
- `public/assets/monopoly/tokens/2d-dim-sum.png` — 环城大富翁 2D 点心笼棋子。
- `public/assets/monopoly/tokens/2d-ferry.png` — 环城大富翁 2D 渡轮棋子。
- `public/assets/monopoly/tokens/2d-junk.png` — 环城大富翁 2D 帆船棋子。
- `public/assets/monopoly/tokens/2d-lantern.png` — 环城大富翁 2D 灯笼棋子。
- `public/assets/monopoly/tokens/2d-taxi.png` — 环城大富翁 2D 的士棋子。
- `public/assets/monopoly/tokens/2d-tram.png` — 环城大富翁 2D 电车棋子。
- `public/assets/monopoly/tokens/3d-bauhinia.png` — 环城大富翁 3D 洋紫荆棋子。
- `public/assets/monopoly/tokens/3d-cable-car.png` — 环城大富翁 3D 缆车棋子。
- `public/assets/monopoly/tokens/3d-dim-sum.png` — 环城大富翁 3D 点心笼棋子。
- `public/assets/monopoly/tokens/3d-ferry.png` — 环城大富翁 3D 渡轮棋子。
- `public/assets/monopoly/tokens/3d-junk.png` — 环城大富翁 3D 帆船棋子。
- `public/assets/monopoly/tokens/3d-lantern.png` — 环城大富翁 3D 灯笼棋子。
- `public/assets/monopoly/tokens/3d-taxi.png` — 环城大富翁 3D 的士棋子。
- `public/assets/monopoly/tokens/3d-tram.png` — 环城大富翁 3D 电车棋子。
- `public/assets/werewolf-netease/README.md` — 网易狼人杀角色图来源与授权风险说明。
- `public/assets/werewolf-netease/characters/langr.png` — 网易狼人杀角色立绘；文件名与中文角色对应见第 15 节。
- `public/assets/werewolf-netease/characters/lr.png` — 网易狼人杀角色立绘；文件名与中文角色对应见第 15 节。
- `public/assets/werewolf-netease/characters/nw.png` — 网易狼人杀角色立绘；文件名与中文角色对应见第 15 节。
- `public/assets/werewolf-netease/characters/pm.png` — 网易狼人杀角色立绘；文件名与中文角色对应见第 15 节。
- `public/assets/werewolf-netease/characters/sw.png` — 网易狼人杀角色立绘；文件名与中文角色对应见第 15 节。
- `public/assets/werewolf-netease/characters/yyj.png` — 网易狼人杀角色立绘；文件名与中文角色对应见第 15 节。
- `public/fonts/HanWangLiSu-NOTICE.txt` — 汉王中隶书字体说明。
- `public/fonts/HanWangLiSuMedium.ttf` — 中国象棋棋子使用的隶书字体。
- `public/fonts/ZhiMangXing-OFL.txt` — Zhi Mang Xing 字体 OFL 许可。
- `public/fonts/ZhiMangXing-Regular.ttf` — 中国象棋河界书法字体。
- `public/games/acquire/client.js` — 并购的浏览器客户端、渲染和交互。
- `public/games/acquire/style.css` — 并购基础主题、外壳和通用组件样式。
- `public/games/acquire/board.css` — 并购地图、地块、集团标记和手牌层。
- `public/games/acquire/rail.css` — 并购股票、玩家侧栏和购买控件层。
- `public/games/acquire/scenes.css` — 并购规则弹层、行动演出和响应式覆盖层。
- `public/games/aeroplane/assets/SOURCE.txt` — 飞行棋棋盘和棋子素材来源说明。
- `public/games/aeroplane/assets/blue-plane.svg` — 飞行棋正式使用的矢量飞机棋子。
- `public/games/aeroplane/assets/board-sharp.png` — 飞行棋正式使用的高清棋盘。
- `public/games/aeroplane/assets/green-plane.svg` — 飞行棋正式使用的矢量飞机棋子。
- `public/games/aeroplane/assets/red-plane.svg` — 飞行棋正式使用的矢量飞机棋子。
- `public/games/aeroplane/assets/yellow-plane.svg` — 飞行棋正式使用的矢量飞机棋子。
- `public/games/aeroplane/client.js` — 飞行棋的浏览器客户端、渲染和交互。
- `public/games/aeroplane/style.css` — 飞行棋的专用界面样式。
- `public/games/avalon/client.js` — 阿瓦隆的浏览器客户端、渲染和交互。
- `public/games/avalon/style.css` — 阿瓦隆的专用界面样式。
- `public/games/avalon/scenes.css` — 阿瓦隆规则弹层、任务演出和响应式覆盖层。
- `public/games/camelup/client.js` — 狂野骆驼的浏览器客户端、渲染和交互。
- `public/games/camelup/style.css` — 狂野骆驼的专用界面样式。
- `public/games/checkers/client.js` — 中国跳棋的浏览器客户端、渲染和交互。
- `public/games/checkers/style.css` — 中国跳棋的专用界面样式。
- `public/games/chess/chess3d.css` — 国际象棋 2D/3D 棋室样式。
- `public/games/chess/client.js` — 国际象棋的浏览器客户端、渲染和交互。
- `public/games/chess/lobby-client.js` — 国际象棋 iframe 大厅桥接器。
- `public/games/chess/room-frame.html` — 国际象棋正式隔离运行文档。
- `public/games/chess/standalone.html` — 国际象棋不联网独立视觉测试页。
- `public/games/citadels/client.js` — 富饶之城的浏览器客户端、渲染和交互。
- `public/games/citadels/style.css` — 富饶之城基础主题、桌面和通用组件样式。
- `public/games/citadels/roles.css` — 富饶之城角色牌、角色艺术和身份焦点层。
- `public/games/citadels/interactions.css` — 富饶之城选角、回合行动和规则交互层。
- `public/games/citadels/responsive.css` — 富饶之城平板、手机和短横屏覆盖层。
- `public/games/citadels/scenes.css` — 富饶之城行动确认、场景演出和减少动效覆盖层。
- `public/games/common/grid-client.css` — 通用网格棋盘组件样式。
- `public/games/common/grid-client.js` — 规则网格游戏的通用浏览器棋盘组件。
- `public/games/coup/client.js` — 政变的浏览器客户端、渲染和交互。
- `public/games/coup/style.css` — 政变基础主题、桌面和通用组件样式。
- `public/games/coup/private.css` — 政变私有影响力、卡背和牌面控制层。
- `public/games/coup/scenes.css` — 政变行动控制台、质疑/阻挡演出和对话框。
- `public/games/coup/responsive.css` — 政变手机、平板和短横屏覆盖层。
- `public/games/decrypto/client.js` — 谍报风云的浏览器客户端、渲染和交互。
- `public/games/decrypto/style.css` — 谍报风云的专用界面样式。
- `public/games/gobang/client.js` — 五子棋的浏览器客户端、渲染和交互。
- `public/games/gobang/style.css` — 五子棋的专用界面样式。
- `public/games/guessnumber/client.js` — 猜数字的浏览器客户端、渲染和交互。
- `public/games/guessnumber/style.css` — 猜数字的专用界面样式。
- `public/games/hanabi/client.js` — 花火的浏览器客户端、渲染和交互。
- `public/games/hanabi/style.css` — 花火的专用界面样式。
- `public/games/jungle/client.js` — 斗兽棋的浏览器客户端、渲染和交互。
- `public/games/jungle/style.css` — 斗兽棋的专用界面样式。
- `public/games/junqi/client.js` — 军棋的浏览器客户端、渲染和交互。
- `public/games/junqi/style.css` — 军棋的专用界面样式。
- `public/games/kingdomino/client.js` — 多米诺王国的浏览器客户端、渲染和交互。
- `public/games/kingdomino/style.css` — 多米诺王国的专用界面样式。
- `public/games/lasvegas/client.js` — 拉斯维加斯的浏览器客户端、渲染和交互。
- `public/games/lasvegas/style.css` — 拉斯维加斯基础主题、赌场版图和操作区样式。
- `public/games/lasvegas/scenes.css` — 拉斯维加斯演出、派奖结算和响应式后置覆盖；按资源清单在基础样式后加载。
- `public/games/loveletter/client.js` — 情书的浏览器客户端、渲染和交互。
- `public/games/loveletter/style.css` — 情书的专用界面样式。
- `public/games/magicalathlete/client.js` — 胡闹运动会的浏览器客户端、渲染和交互。
- `public/games/magicalathlete/style.css` — 胡闹运动会的专用界面样式。
- `public/games/manila/client.js` — 马尼拉的浏览器客户端、渲染和交互。
- `public/games/manila/style.css` — 马尼拉的专用界面样式。
- `public/games/modernart/client.js` — 现代艺术的浏览器客户端、渲染和交互。
- `public/games/modernart/style.css` — 现代艺术的专用界面样式。
- `public/games/monopoly/client.js` — 环城大富翁的浏览器客户端、渲染和交互。
- `public/games/monopoly/style.css` — 环城大富翁的专用界面样式。
- `public/games/monopolydeal/choice.css` — 大富翁纸牌颜色、交换和支付弹窗补充样式。
- `public/games/monopolydeal/client.js` — 大富翁纸牌的浏览器客户端、渲染和交互。
- `public/games/monopolydeal/style.css` — 大富翁纸牌的专用界面样式。
- `public/games/scout/client.js` — 马戏星探的浏览器客户端、渲染和交互。
- `public/games/scout/style.css` — 马戏星探的专用界面样式。
- `public/games/splendor/client.js` — 璀璨宝石的浏览器客户端、渲染和交互。
- `public/games/splendor/style.css` — 璀璨宝石的专用界面样式。
- `public/games/takefive/client.js` — 牛头王的浏览器客户端、渲染和交互。
- `public/games/takefive/style.css` — 牛头王的专用界面样式。
- `public/games/werewolf/client.js` — 狼人杀自动辅助的浏览器客户端、渲染和交互。
- `public/games/werewolf/style.css` — 狼人杀自动辅助的专用界面样式。
- `public/games/witchtown/client.js` — 猎巫镇的浏览器客户端、渲染和交互。
- `public/games/witchtown/style.css` — 猎巫镇基础主题、审判桌和档案操作样式。
- `public/games/witchtown/scenes.css` — 猎巫镇视觉重写、演出、结算和响应式后置覆盖；按资源清单在基础样式后加载。
- `public/games/xiangqi/client.js` — 中国象棋的浏览器客户端、渲染和交互。
- `public/games/xiangqi/style.css` — 中国象棋的专用界面样式。
- `public/index.html` — 正式大厅 HTML。
- `public/game-details.js` — 28 款游戏在创建房间前展示的规则摘要。
- `public/script.js` — 正式大厅组合入口，编排 WebSocket、双页创建浮窗、房间和动态游戏加载逻辑。
- `public/style.css` — 正式大厅基础样式；等待房间覆盖层位于 `public/lobby/waiting-room.css`。
- `public/lobby/waiting-room.css` — 等待房间专用控制、座位、转场和移动端样式。
- `public/lobby/catalog-data.js` — 大厅游戏、分组、模式与美术元数据。
- `public/lobby/catalog-view.js` — 游戏目录、公开房间和筛选视图。
- `public/lobby/game-loader.js` — 游戏客户端与样式的懒加载和缓存。
- `public/lobby/transport.js` — 大厅 WebSocket 生命周期和消息封装。
- `public/lobby/artwork.js` — 封面懒加载、卡片观察器和动效处理。
- `public/lobby/room-dialog.js` — 创建房间规则/设置双页弹层和表单采集。
- `public/lobby/waiting-room-scene.js` — 等待房间状态、座位几何和魔法阵渲染。
- `public/lobby/game-entry-transition.js` — 等待桌到游戏桌的入场转场。
- `public/lobby/study-controls.js` — 棋谱模式执棋方和公开摆棋控件。
- `test/realtime-isolation.test.js` — 两个实时服务实例的房间、会话、编号和清理隔离验收。
- `test/realtime-protocol.test.js` — 历史动作归一化和实时消息路由的纯单元验收。
- `test/realtime-broadcast.test.js` — 大厅/房间广播的连接过滤和 JSON 编码验收。
- `scripts/checkers-acceptance.js` — 中国跳棋完整对局验收与复现数据生成脚本。
- `scripts/gobang-acceptance.js` — 五子棋完整对局验收与复现数据生成脚本。
- `scripts/chromium-runtime-smoke.js` — Chromium 模块、视口、隐私和输入收束烟测。
- `scripts/performance-smoke.js` — 静态资源预算、并发请求和 WebSocket 房间/连接清理烟测。
- `scripts/release-audit.js` — 版本、锁文件、部署模板和发布文件卫生审计。
- `scripts/deployment-smoke.js` — 生产形态进程、健康检查、WebSocket 建房和优雅退出烟测。
- `scripts/acceptance-gate.js` — 最终本机验收门禁聚合入口。
- `server/games/acquire/engine.js` — 并购的服务端权威规则引擎。
- `server/games/acquire/index.js` — 并购的大厅 metadata/create 适配层。
- `server/games/aeroplane/engine.js` — 飞行棋的服务端权威规则引擎。
- `server/games/aeroplane/index.js` — 飞行棋的大厅 metadata/create 适配层。
- `server/games/avalon/engine.js` — 阿瓦隆的服务端权威规则引擎。
- `server/games/avalon/index.js` — 阿瓦隆的大厅 metadata/create 适配层。
- `server/games/camelup/engine.js` — 狂野骆驼的服务端权威规则引擎。
- `server/games/camelup/index.js` — 狂野骆驼的大厅 metadata/create 适配层。
- `server/games/checkers/engine.js` — 中国跳棋的服务端权威规则引擎。
- `server/games/checkers/index.js` — 中国跳棋的大厅 metadata/create 适配层。
- `server/games/chess/engine.js` — 国际象棋的服务端权威规则引擎。
- `server/games/chess/index.js` — 国际象棋的大厅 metadata/create 适配层。
- `server/games/citadels/engine.js` — 富饶之城的服务端权威规则引擎。
- `server/games/citadels/constants.js` — 富饶之城角色、城区牌和紫区效果的纯规则数据。
- `server/games/citadels/role-actions.js` — 富饶之城角色行动事务处理；引擎保留阶段推进与状态投影。
- `server/games/citadels/index.js` — 富饶之城的大厅 metadata/create 适配层。
- `server/games/coup/engine.js` — 政变的服务端权威规则引擎。
- `server/games/coup/index.js` — 政变的大厅 metadata/create 适配层。
- `server/games/decrypto/engine.js` — 谍报风云的服务端权威规则引擎。
- `server/games/decrypto/index.js` — 谍报风云的大厅 metadata/create 适配层。
- `server/games/gobang/engine.js` — 五子棋的服务端权威规则引擎。
- `server/games/gobang/index.js` — 五子棋的大厅 metadata/create 适配层。
- `server/games/groups.js` — 大厅游戏分组、顺序和模式配置。
- `server/games/guessnumber/engine.js` — 猜数字的服务端权威规则引擎。
- `server/games/guessnumber/index.js` — 猜数字的大厅 metadata/create 适配层。
- `server/games/hanabi/engine.js` — 花火的服务端权威规则引擎。
- `server/games/hanabi/index.js` — 花火的大厅 metadata/create 适配层。
- `server/games/jungle/engine.js` — 斗兽棋的服务端权威规则引擎。
- `server/games/jungle/index.js` — 斗兽棋的大厅 metadata/create 适配层。
- `server/games/junqi/engine.js` — 军棋的服务端权威规则引擎。
- `server/games/junqi/index.js` — 军棋的大厅 metadata/create 适配层。
- `server/games/kingdomino/engine.js` — 多米诺王国的服务端权威规则引擎。
- `server/games/kingdomino/index.js` — 多米诺王国的大厅 metadata/create 适配层。
- `server/games/lasvegas/engine.js` — 拉斯维加斯的服务端权威规则引擎。
- `server/games/lasvegas/index.js` — 拉斯维加斯的大厅 metadata/create 适配层。
- `server/games/loveletter/engine.js` — 情书的服务端权威规则引擎。
- `server/games/loveletter/index.js` — 情书的大厅 metadata/create 适配层。
- `server/games/magicalathlete/engine.js` — 胡闹运动会的服务端权威规则引擎。
- `server/games/magicalathlete/constants.js` — 胡闹运动会 CMYK 版赛道、计分、特殊格和 36 名运动员数据。
- `server/games/magicalathlete/turn-resolution.js` — 胡闹运动会回合阶段、掷骰、能力提示和终局结算。
- `server/games/magicalathlete/movement.js` — 胡闹运动会赛道移动、越过、停靠和特殊格效果。
- `server/games/magicalathlete/state.js` — 胡闹运动会公开/私有状态投影和赢家计算。
- `server/games/magicalathlete/index.js` — 胡闹运动会的大厅 metadata/create 适配层。
- `server/games/manila/engine.js` — 马尼拉的服务端权威规则引擎。
- `server/games/manila/index.js` — 马尼拉的大厅 metadata/create 适配层。
- `server/games/modernart/engine.js` — 现代艺术的服务端权威规则引擎。
- `server/games/modernart/index.js` — 现代艺术的大厅 metadata/create 适配层。
- `server/games/monopoly/engine.js` — 环城大富翁的服务端权威规则引擎。
- `server/games/monopoly/index.js` — 环城大富翁的大厅 metadata/create 适配层。
- `server/games/monopolydeal/engine.js` — 大富翁纸牌的服务端权威规则引擎。
- `server/games/monopolydeal/index.js` — 大富翁纸牌的大厅 metadata/create 适配层。
- `server/games/registry.js` — 28 个正式游戏的运行时注册表。
- `server/games/scout/engine.js` — 马戏星探的服务端权威规则引擎。
- `server/games/scout/index.js` — 马戏星探的大厅 metadata/create 适配层。
- `server/games/splendor/engine.js` — 璀璨宝石的服务端权威规则引擎。
- `server/games/splendor/index.js` — 璀璨宝石的大厅 metadata/create 适配层。
- `server/games/takefive/engine.js` — 牛头王的服务端权威规则引擎。
- `server/games/takefive/index.js` — 牛头王的大厅 metadata/create 适配层。
- `server/games/werewolf/engine.js` — 狼人杀自动辅助的服务端权威规则引擎。
- `server/games/werewolf/index.js` — 狼人杀自动辅助的大厅 metadata/create 适配层。
- `server/games/witchtown/engine.js` — 猎巫镇的服务端权威规则引擎。
- `server/games/witchtown/index.js` — 猎巫镇的大厅 metadata/create 适配层。
- `server/games/xiangqi/engine.js` — 中国象棋的服务端权威规则引擎。
- `server/games/xiangqi/index.js` — 中国象棋的大厅 metadata/create 适配层。
- `server/room.js` — 通用房间生命周期和游戏动作转发。
- `test/acquire-official.test.js` — 并购专项自动化规则测试。
- `test/avalon-official.test.js` — 阿瓦隆专项自动化规则测试。
- `test/camelup-official.test.js` — 狂野骆驼专项自动化规则测试。
- `test/checkers.test.js` — 中国跳棋专项自动化规则测试。
- `test/citadels-official.test.js` — 富饶之城专项自动化规则测试。
- `test/coup-official.test.js` — 政变专项自动化规则测试。
- `test/decrypto-official.test.js` — 谍报风云专项自动化规则测试。
- `test/gobang.test.js` — 五子棋专项自动化规则测试。
- `test/guessnumber-official.test.js` — 猜数字专项自动化规则测试。
- `test/hanabi-official.test.js` — 花火专项自动化规则测试。
- `test/kingdomino-official.test.js` — 多米诺王国专项自动化规则测试。
- `test/lasvegas-official.test.js` — 拉斯维加斯专项自动化规则测试。
- `test/loveletter-official.test.js` — 情书专项自动化规则测试。
- `test/magicalathlete-official.test.js` — 胡闹运动会专项自动化规则测试。
- `test/manila-official.test.js` — 马尼拉专项自动化规则测试。
- `test/modernart-official.test.js` — 现代艺术专项自动化规则测试。
- `test/monopoly-official.test.js` — 环城大富翁专项自动化规则测试。
- `test/monopolydeal-official.test.js` — 大富翁纸牌专项自动化规则测试。
- `test/regression/*.test.js` — 按游戏域拆分的全项目注册表、房间协议和游戏规则综合回归测试；共享夹具位于 `test/support/regression.helper`。
- `test/scout-official.test.js` — 马戏星探专项自动化规则测试。
- `test/splendor-official.test.js` — 璀璨宝石专项自动化规则测试。
- `test/takefive-official.test.js` — 牛头王专项自动化规则测试。
- `test/witchtown-official.test.js` — 猎巫镇专项自动化规则测试。
