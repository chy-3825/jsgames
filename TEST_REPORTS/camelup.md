# 狂野骆驼（Camel Up 2014 基础版）

最近复验：2026-08-30

## 当前验收状态

2014 基础版 3–8 人规则已通过服务端状态机和自动化回归验收；当前规则专项 15/15、前端契约 8/8。实现包括 5 匹骆驼、16 格赛道、40 张终局下注牌、15 张赛段下注牌、5 张金字塔牌和 8 个可移动沙漠板块；未加入 Second Edition 的 Crazy Camels、伙伴牌或其他扩展。

## 规则核对

- **准备**：开局按五枚骰子的 1–3 点把骆驼放在 1–3 号格并正确叠放；每位玩家获得 3 金币、一个玩家色标识和同一角色的一组 5 张私密终局下注牌（每匹骆驼各一张）。多余角色牌不进入本局。
- **四种动作**：每回合严格执行一个动作：拿任意骆驼的顶层赛段下注牌、放置/移动自己的绿洲或海市蜃楼板块、拿一张金字塔牌并移动一匹骆驼、从自己的终局牌中放一张冠军或垫底下注牌。
- **骆驼堆**：被移动骆驼会携带其上方全部骆驼；落到其他骆驼所在格时叠到最上方。绿洲使移动组再前进 1 格并置于目标组上方，海市蜃楼使其后退 1 格并置于目标组下方。
- **赛段结算**：五枚骰子全部取出后结算。领先骆驼的赛段牌按 5/3/2 金币，第二名每张 +1，其他骆驼每张 −1；每张金字塔牌 +1，现金不会低于 0。随后收回赛段牌、金字塔牌和沙漠板块，进入新赛段。
- **终局下注**：每张终局牌只能使用一次，放入冠军或垫底下注区后不能收回；牌按各下注区的实际放置顺序叠放。冲线后分别结算冠军和垫底：正确牌按正确牌的顺序获得 8/5/3/2/1，错误牌 −1。
- **即时终局**：第一匹骆驼越过 16 格立刻结束比赛；先进行最后一个赛段结算，再进行冠军/垫底结算。终点同格时最上方是冠军，最下方是垫底，不会错误创建一个“幽灵下一赛段”。
- **并列胜者**：终局现金最高的所有玩家共同获胜；状态和前端会显示全部并列赢家。

## 完整对局与专项测试

- **完整流程**：3–5 人测试从开局骰子布置开始，轮流执行取赛段牌、放板块、取金字塔和放终局牌，处理多次叠骆驼移动，直到第一匹骆驼冲线并完成两类最终结算。
- **下注牌隐私**：每位玩家初始有 5 张私密终局牌；公共视角只显示已放置数量和金币，不会泄露未使用的骆驼颜色；同一张牌重复提交会被拒绝。
- **板块边界**：不能放在 1 号格、骆驼所在格、已有板块格或相邻格；自己的板块可以移动，移动前的格会释放。
- **结算边界**：赛段牌数量有限；错误全场下注扣 1；多个错误牌不会挤占正确牌的 8/5/3/2/1 奖励位；最终赛段结算不清空未结束比赛的状态。
- **房间边界**：人数严格限制为 3–8，不再静默截断第 9 名玩家；当前玩家离线时顺时针跳过，避免赛局卡死；公共播报未结束时房间拒绝下一步动作。

## 自动化验收

- `Camel Up moves stacked camels and gives each player a private bet view`
- `Camel Up final leg scoring does not create a phantom next leg`
- `Camel Up uses finite leg betting tiles and enforces non-adjacent desert tiles`
- `Camel Up uses official starting rolls, movable spectator tiles, and winner/loser bets`
- `Camel Up applies the official pyramid, leg, tile, and stack rules`
- `Camel Up orders overall bets globally and crowns the top finish-line camel`
- `Camel Up enforces the official 3-8 player setup and private five-card hands`
- `Camel Up applies stacked movement, oasis/mirage order and finite leg rewards`
- `Camel Up settles overall winner/loser cards in placement order and shares tied victories`
- `Camel Up allows a desert tile on any empty track space except space 1`
- `Camel Up completes three independent maximum-player races from start to shared end scoring`
- `Camel Up publishes the die, carried stack and desert-tile movement in order`
- `Camel Up keeps an overall bet face down until the race is finished`
- `Camel Up publishes a complete leg settlement and the next-leg curtain`
- `Camel Up reveals terminal bets in placement order before publishing final standings`
- `Camel Up schedules public presentations on one absolute server timeline`
- `Camel Up room gate rejects actions until the authoritative presentation deadline`
- `Camel Up projects sole and tied winners into the same final presentation slot`
- `Camel Up retains private overall bets in every queued batch`
- `Camel Up converts server presentation timestamps for a late or reconnecting viewer`
- `Camel Up ends the public race on departure and keeps the winner in the shared final slot`

本轮专项测试扩充为 15 项，前端契约测试 8 项；既有回归中的 6 项 Camel Up 测试也全部通过。三局 8 人最大人数对局均从开局、连续赛段、骆驼堆叠和终局下注推进到最终结算，没有卡在无效回合或幽灵赛段。新增覆盖骰子揭晓、整叠骆驼移动、沙漠板块二段移动、终局暗注隐私、赛段结算事件、终局翻牌顺序、服务端绝对时间轴、房间播报锁、重连追赶、离场终局和个人胜利视角。

## 本轮修复

1. 启动状态增加防重复开始，并保留完整房间名单，非法人数会明确拒绝。
2. 会话接入房间随机数选项，完整对局可稳定复现。
3. 终局现金相同时记录全部共同赢家，前端不再只显示第一名。
4. 当前玩家离线时自动顺时针跳过；赛段结束也会跳过离线座位。
5. 沙漠板块按官方规则允许放在 16 号空格（仍禁止 1 号格、骆驼格、重叠和相邻格）；16 号绿洲/海市蜃楼效果会在终局判断前结算。
6. 修复终局暗注虽以卡背入堆，公共日志却直接写出骆驼颜色的隐私泄露；现在公开状态只显示发起人、冠军/垫底区和入堆顺序，颜色只对出牌本人可见，冲线后才公开。

## 沉浸式赛事演出

- 开局先以全屏播报展示起跑骰生成的 1–3 号格真实驼队堆叠和首位行动玩家，随后宣布第一赛段开始；开局状态由服务端事件保存，所有玩家看到一致结果。
- 服务端新增带序号的 `presentation` 事件链，分别保留骰子揭晓、骆驼堆移动、沙漠板块触发、赛段/终局下注、赛段结算、冲线、暗注翻牌和最终排名。
- 摇骰时从当前玩家席位指向中央骰塔，先揭晓骆驼颜色与 1–3 点，再按服务端快照移动被掷骆驼及其上方整叠骆驼。
- 驼队落到绿洲或海市蜃楼时播放第二段 `+1/−1` 移动，再从触发格向板块主人席位显示 1 金币奖励线。
- 赛段下注牌从公共牌架飞向玩家席位；终局下注始终以卡背飞入冠军或垫底公共区，只有出牌本人在本机演出中能看到自己选择的颜色。
- 放置或移动沙漠板块时，玩家席位与目标赛道格连线，板块实体飞入目标格。
- 普通行动只使用局部、轻量演出；第五枚骰子后的赛段闭幕才使用全屏模糊，展示驼队顺位、赛段牌奖惩、金字塔奖励和每位玩家的金币变化。
- 冲线后先播放最后赛段结算，再按实际入堆顺序逐张翻开冠军与垫底暗注，显示命中/失败及 `+8/+5/+3/+2/+1/−1`；最后的全屏结算直接宣布单独赢家或全部共享冠军，并显示支持并列冠军的金币排名。
- 所有公共批次由服务端排定统一的 `startedAt`/`endsAt`，事件带有 `durationMs`、`contentDurationMs`、`blocking` 和全局序号；同一动作与连续动作都进入串行队列，房间在最后一个批次结束前拒绝新操作。
- 客户端接收 `presentations` 队列并将服务端时钟映射到本地时钟；迟到或重连只播放仍在有效时隙内的剩余内容，不因本地重绘、网络延迟或“减少动画”缩短公共结束时间。
- “跳过演出”只隐藏本机画面，仍保留服务端截止锁；规则弹层会在公共演出开始时关闭，演出层位于规则层之上，避免连线和全屏播报被遮挡。
- 终局赢家在同一 `finalSettlement` 时隙看到“您已获胜”，其他玩家看到公开赢家；个人投影与公共事件保持完全一致的开始/结束时间。狂野骆驼没有角色出局阶段，离场导致的终局同样生成共享终局批次。
- 终局暗注的私密牌面按事件序号保留在每个排队批次中，只发送给对应持牌者；公共视角和其他玩家不会因队列扩展而泄露颜色。

规则依据：[Camel Up Official Rules](https://images-cdn.zmangames.com/us-east-1/filer_public/88/09/8809b7bb-3a30-44ea-88db-a4683056794c/zm7480_camel_up_rules.pdf) 与 [Camel Up 规则汇总](https://cdn.ultraboardgames.com/camel-up/game-rules.php)。

## 本次 BGG 视觉接入

- `camelup/detail.jpg` 确认为骆驼、赛道、下注牌和骰子的实物组件合照，已接入规则浮层和大厅组件图入口。
- 没有把整张合照重复铺到赛道或下注卡片上；线上叠骆驼、赛段位置、板块和下注状态继续由实时规则绘制。
- 已移除狂野骆驼赛道卡片的通用合照内嵌层，避免照片遮挡位置与赛道状态。

## 本次界面优化

- 2026-08-24 将五条进度线式展示重构为 16 格环形沙漠赛道；桌面端围绕中央骰塔顺时针推进，手机端改为四行蛇形赛道，格号顺序与服务端位置完全对应。
- 骆驼改为自绘矢量组件，同格骆驼依据 `order` 从下到上叠放；当前顺位条同步显示五匹骆驼，冠军与垫底不再依赖纯文字推断。
- 赛段下注牌和五色终局牌全部改为自制中文卡面，移除卡片上的装饰性英文；卡面完整展示剩余数量、当前冠军收益和终局用途，没有使用裁切的实体照片充当牌面。
- 四种行动统一为“选择行动—选择目标—查看后果—确认执行”。摇骰、赛段下注、冠军/垫底下注和板块放置在确认前都不会向服务端发送操作，提交中也会阻止重复发送。
- 提交后现在会锁定全部按钮、赛道格和选项，保留已发送的骆驼、终局牌、冠军/垫底方向或板块位置摘要，避免等待期间界面与实际载荷不一致。
- 操作失败改为界面内持续 `role="alert"` 告警，保留原行动方案以便重试；应用同步公布 `aria-busy` 状态。
- 规则对话框补全 `aria-hidden`、背景 `inert`、Tab 焦点循环和关闭后焦点归还。
- 放置板块时直接在赛道上高亮由当前公开状态推导出的合法格；客户端只提供提示，服务端仍负责最终合法性校验。绿洲、海市蜃楼、已有板块和骆驼占位均可直接辨认。
- 钱袋、私人下注摘要、玩家公开筹码和赛场记录重新分层；终局牌颜色仍只对持有者显示，对手区域只显示公开数量，没有扩大隐藏信息。
- 大厅将 `camelup` 纳入自绘游戏视觉名单，不再把竖版 BGG 封面强行裁成横幅；实体组件照仅保留在规则浮层中作为参考。
- 新增 `__camelup_visual_test.html`。浏览器实测 `1440×900`、`1366×768`、`390×844` 三种视口均无页面横向溢出；16 个赛道格和 9 张当前可见下注牌均完整渲染。
- 新增短横屏固定视口布局，同屏保留当前状态、16 格赛道和策略帐篷；玩家账簿和上赛段摘要在该极端高度下收起。
- 统一视觉夹具新增待选择、摇骰、赛段注、冠军/垫底暗注、绿洲/海市蜃楼、骰子揭晓、骆驼移动、暗注入堆、赛段结算、终局翻牌和最终排名共 13 种状态，并持续补充前端播报契约测试。
- 浏览器交互验收已覆盖四种动作的确认载荷及规则浮层键盘关闭；15 项狂野骆驼专项规则测试、8 项前端契约、6 项既有 Camel Up 回归和 BGG 资源边界测试均通过。
- 2026-08-26 新增 Firefox 演出验收场景：骰塔揭晓、骆驼移动、终局暗注入堆、赛段闭幕、终局翻牌和最终排名。桌面端及 390×844 手机端均无 JavaScript 错误和页面横向溢出，赛段、翻牌与排名主体无需内部滚动。
- `node --test test/camelup-frontend.test.js test/camelup-official.test.js test/regression/camelup.test.js`：29/29 通过；`npm run test:syntax`：396 个文件通过；`npm run test:presentation`：PASS。当前工作区全量门禁仍有既有问题：串行 `node --test --test-concurrency=1` 为 558/559 通过，唯一失败是 `test/regression/core.test.js` 对狼人杀旧资源版本的断言；并行 `npm test` 还会叠加该工作区既有改动造成的时序失败。这些失败不属于本轮狂野骆驼改造，故不将全量结果误报为通过。该结果代表狂野骆驼专项自动化与既有浏览器验收通过，不扩大表述为所有未覆盖的官方规则情形都已经 100% 人工验收；当前统一回归基线见 [`release-baseline.md`](./release-baseline.md)。
