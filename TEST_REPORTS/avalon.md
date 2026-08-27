# 阿瓦隆

## 本轮验收结论：10/10，已通过

- 以 10 人为最大人数完成三局独立完整对局：三项任务成功后刺客误刺善良、三项任务失败、连续五次组队拒绝，三种终局均正常收束。
- 全套回归测试 `262/262` 通过；本轮新增 `test/avalon-official.test.js` 共 6 项专项。

## 规则状态

- 已固定基础版 5–10 人任务人数表：5 人 `[2,3,2,3,3]`、6 人 `[2,3,4,3,4]`、7–10 人按官方表执行。
- 好坏阵营数量按人数固定；基础角色为梅林、刺客、爪牙和忠臣，派西维尔/莫甘娜/莫德雷德/奥伯伦为可选角色。
- 队长顺时针轮换；全员公开投票，严格过半才通过，连续五次拒绝队伍则邪恶获胜；任务中善良只能提交成功，邪恶可提交成功或失败；7 人以上第 4 项任务需要两张失败牌才失败。
- 三项任务成功后进入刺客阶段，刺客可以选择任意玩家；猜中梅林则邪恶胜，否则善良胜；三项任务失败立即邪恶胜。
- 修复可选角色配置超出该人数邪恶槽位时静默增加邪恶人数的问题，现在返回明确错误。
- 修复信息规则：梅林看见邪恶阵营但看不见莫德雷德和奥伯伦；派西维尔看到梅林/莫甘娜二选一；奥伯伦不认识其他邪恶，其他邪恶也不认识奥伯伦。
- 修复终局刺杀目标校验：刺客只能选择善良阵营玩家，不能通过协议直接指定邪恶角色；刺客视角只显示合法善良目标。
- 修复大厅适配层未转发 `gameOptions` 的问题；通过房间配置启用派西维尔、莫甘娜等可选角色后，引擎实际使用该配置。
- 修复重复开始会重置对局、无效/重复玩家 ID 和超过 10 人被静默截断的问题，均改为明确拒绝。

## 完整对局测试

- 人数：5 人（A–E），固定每轮提议队伍、全员通过、任务队员提交成功，连续完成前三项任务。
- 流程：队长组建 2 人、3 人、2 人队伍；每轮经过全员投票和秘密任务牌；第三项任务成功后进入刺客阶段；刺客选择真实梅林，邪恶获胜。
- 另测 5 人局失败任务：队伍含邪恶角色并提交失败牌，失败计数和任务历史正确。
- 结果：队伍大小、投票过半判定、任务秘密结果、三次成功触发刺杀、刺杀胜负和角色私密信息全部正常。

## 自动化验收

- `Avalon keeps roles private and resolves a failed mission after team approval`
- `Avalon enters assassin phase after three successes and evil wins when Merlin is found`
- `Avalon completes a five-player good run and assassin endgame`
- `Avalon uses the core hidden-role distribution and supports optional roles`
- `Avalon rejects invalid rosters and does not silently truncate or restart`
- `Avalon enforces official mission sizes and the two-fail fourth mission`
- `Avalon enforces private role knowledge and optional role visibility rules`
- `Avalon only allows the assassin to target a good player`
- `Avalon completes three independent maximum-player games from start to finish`
- `Avalon room adapter forwards game options and resolves an optional setup`

本轮未发现阻断性 bug。规则核对参考 [Avalon 官方规则页面](https://avalon-game.com/wiki/rules/) 和 [官方规则书 PDF](https://cdn.1j1ju.com/medias/a6/dc/c1-the-resistance-avalon-rulebook.pdf)；任务人数、7 人以上第四项任务需要两张失败牌、梅林/派西维尔/莫甘娜/莫德雷德/奥伯伦的隐藏信息均按基础版规则执行。大厅当前默认基础角色配置，可通过房间 `gameOptions` 启用可选角色。

## 第五批移动端验收（2026-08-27）

- 短横屏将圆桌、任务状态、组队/投票/任务牌/刺杀决策和玩家席位固定在可用高度内；玩家列表、任务历史和日志仅在内部滚动。
- 当前玩家存在可用动作时切换 `is-my-action`，阶段写入 `data-phase`，资源版本更新为 `20260826-mobile-games-5`。
- 已加入身份确认、组队投票和刺杀阶段的视觉 fixture；规则层从统一顶栏下方开始，页面本身不依赖上下或左右翻页。
- 回归测试与语法检查通过；当前全量 `npm test` 为 **372/372 通过**。另补充永久离开身份确认、队长、投票和任务牌的回归覆盖。Firefox 154 已完成 390×844、844×390、667×375 三档真实截图复验；两个短横屏通过核心决策同屏。

## 本次 BGG 视觉接入

- `avalon/detail.jpg` 确认为身份牌、任务板和标记物实物合照，已接入规则浮层和大厅组件图入口。
- 没有把整张合照重复铺到身份面板或玩家卡片上；线上身份私密性、队伍投票、任务牌和刺杀流程保持由实时状态控制。
- 已移除身份面板的通用合照内嵌层，避免组件照片泄露或遮挡线上信息。

## BGG 角色牌与统一身份焦点重构（2026-08-27）

- 从 BGG 图片 `1453098` / `1453075` 裁切出忠臣、梅林、派西维尔、爪牙、刺客、莫甘娜、莫德雷德、奥伯伦 8 张本地角色图，统一为 `720×900` WebP；来源、上传者和用途记录在 `public/assets/bgg/avalon/README.md` 与 `SOURCES.md`。
- 角色名称、阵营、能力和私密线索继续由实时 HTML 渲染，图片只承担人物美术；所有候选角色图在开局时一起预加载，不会通过单张网络请求暴露玩家身份。
- 身份牌改为大幅纵向人物画面，保留“按住查看，松开/移出/失焦立即遮住”的私密交互；当前有必须决策时，移动端优先保留行动区，身份牌收紧但不消失。
- 与狼人杀、猎巫镇共用 `hidden-role-focus.css` 的身份焦点边框、画面遮罩和阵营变量，但保留阿瓦隆金蓝/暗红的自身语汇。
- 实机验收发现并修复了矮屏下旧 `order/grid-column` 残留导致三栏重叠的问题。`390×844` 竖屏、`844×390` 和 `667×375` 横屏均无横向溢出；两个横屏尺寸的席位、任务、身份焦点和当前决策均通过同屏断言。
- 全量 `npm test` **384/384 通过、0 失败**；新增自动验证覆盖 8 张 BGG 资源、角色映射、全量预加载、统一身份焦点和响应式尺寸。
