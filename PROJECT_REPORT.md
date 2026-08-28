# jsgames 游戏大厅接入教程

这份文档说明游戏大厅的文件结构、网络消息、服务端接口、前端接口，以及新增游戏时应该怎么接入。重点不是某个具体游戏怎么写，而是所有游戏都必须遵守同一套大厅协议。

## 1. 核心原则

大厅负责通用能力：玩家连接、玩家 ID、玩家名字、房间、房主、创建房间、加入房间、离开房间、开始游戏、WebSocket 广播。

具体游戏只负责规则和界面：根据大厅传入的玩家数组创建游戏状态，处理玩家动作，给每个玩家返回他能看到的状态。

新游戏不要自己创建 WebSocket，不要自己生成玩家，不要自己实现创建房间/加入房间，不要让前端决定当前玩家是谁。玩家身份永远以大厅传给服务端的 `playerId` 为准。

## 2. 推荐目录结构

新增一个游戏时，建议按职责拆成这些文件：

```text
server/games/mygame/
  index.js      # 服务端适配层，必须导出 metadata 和 create
  engine.js     # 游戏规则，可选但强烈建议单独放

public/games/mygame/
  client.js     # 协议入口和生命周期，必须导出 createGameClient
  state.js      # 可变视图模型和派生状态
  template.js   # 静态 HTML 模板
  render.js     # DOM/2D 渲染
  scene.js      # 动画、场景或 GPU 资源
  actions.js    # 输入和动作提交
  constants.js  # 常量，可选
  cards.js      # 卡牌数据/牌面，可选
  style.css     # 游戏专用样式，可选
```

这套 8 个前端文件是默认骨架，不要求每款游戏都机械填满所有文件：`constants.js` 和 `cards.js` 可以按需省略（例如牛头王把牌面辅助集中在 `cards.js`）。3D 棋类由 `scene.js` 持有 Three.js 场景、GPU 资源和动画，`actions.js` 负责事件绑定，`render.js` 只提供 DOM/2D 渲染门面；入口 `client.js` 不再承载大段界面代码。

然后只改一个注册文件：

```text
server/games/registry.js
```

一般不需要修改 `app.js`、`server/room.js`、`public/script.js`。如果每加一个游戏都要改大厅主逻辑，说明游戏没有按协议接入。

## 3. 大厅 WebSocket 消息

前端大厅已经建立 WebSocket，游戏前端不需要也不应该再次 `new WebSocket()`。

浏览器发给服务器的通用消息如下：

```js
{ type: 'setName', name: '玩家名' }
{
  type: 'createRoom',
  gameType: 'mygame',
  roomName: '周五桌游局',
  isPublic: true,
  seatLimit: 4,
  gameOptions: {}
}
{ type: 'joinRoom', roomId: '1234' }
{ type: 'leaveRoom' }
{ type: 'startGame' }
{ type: 'chat', message: '聊天内容' }
{ type: 'gameAction', action: { kind: '动作名' } }
{ type: 'resumeSession', sessionToken: '浏览器保存的会话令牌' }
{ type: 'reconnectRoom', roomId: '123456', playerId: 'P1A2B3C4' }
{ type: 'gameAction', action: { kind: 'studySwitchSeat', seatIndex: 1 } }
{ type: 'gameAction', action: { kind: 'studySetup', op: 'place', x: 4, y: 4, pieceType: 'q', color: 'white' } }
{ type: 'gameAction', action: { kind: 'studyConfirmSetup' } }
```

服务器连接时会先发送 `session`。大厅把令牌保存到当前标签页的 `sessionStorage`；连接意外断开后，30 秒内可发送 `resumeSession` 恢复原玩家、房间和游戏状态。若另一个仍在线的窗口提交同一令牌，服务器拒绝接管并保留新窗口的临时身份。主动 `leaveRoom` 会结束席位，不应继续尝试恢复该房间。

当前还提供一条便于无账号环境测试的手动重连链路：玩家进入房间后会看到服务端生成的访客 `playerId`。游戏开始后，普通 `joinRoom` 只返回 `reconnectRequired`，客户端再发送房间号和断线玩家 ID；服务端只允许恢复同一房间内已经断开的成员。在线 ID 会收到 `reconnectFailed`，不会顶掉原连接或产生重复玩家。非主动断线会保留座位并暂停房间动作与系统推进，恢复全部断线成员后广播 `roomResumed`。这条链路暂不执行强制认输；账号系统接入后可将 `playerId` 换成账号 ID。

新游戏通常只需要发送 `gameAction`：

```js
send({
  type: 'gameAction',
  action: {
    kind: 'playCard',
    cardIndex: 0,
    targetId: '目标玩家ID',
  },
});
```

### 棋谱模式

棋类游戏可在 metadata 中声明 `studyMode: true` 和 `studyPlayerCount: 2`，并提供 `gameMode` 房间选项。房间选择 `gameMode: 'study'` 后只允许房主入座，`Room` 会创建双方虚拟引擎席位，同时在每个 `getPlayerGameState()` 中返回 `studySeatIndex`、`studySeatNames`、`studyPhase` 和当前执棋方对应的 `myColor`。前端的切换按钮按具体棋类显示并发送“切换到红方/黑方”等目标执棋方的 `studySwitchSeat`；自定义摆棋引擎通过会话适配层提供 `handleStudySetup(enginePlayerId, action, actorId)`，接受 `place`、`move`、`remove`、`clear`、`reset`、`setTurn` 等操作。`enginePlayerId` 只表示当前控制的虚拟阵营，`actorId` 才是真实权限主体。房间层必须拒绝非房主，规则引擎也应保存由大厅传入的可信 `gameMode`、`ownerId` 并再次鉴权。摆棋完成后发送 `studyConfirmSetup`；支持自定义局面的引擎应先执行 `validateStudyPosition()`，通过后才恢复正常回合校验。飞行棋与大富翁不声明该能力。

注意：`action` 里不要传自己的 `playerId` 来证明身份。大厅服务端会根据 WebSocket 连接找到真实玩家，然后调用：

```js
room.handleGameAction(player.id, action)
```

所以服务端游戏一定要相信参数里的 `playerId`，不要相信前端 action 里伪造的身份字段。

正式大厅不会在点击游戏卡片时立即创建房间。它先从 `public/game-details.js` 展示规则摘要，再让房主设置房间名称、人数上限、公开状态和游戏专属选项；只有最后确认时才发送 `createRoom`。`seatLimit` 必须位于游戏 `minPlayers` 与 `maxPlayers` 之间；仅邀请房间不会出现在公开列表，但仍可通过房间号或邀请链接加入。狼人杀的 `playerCount`、`sheriffEnabled`、`winCondition` 和谍报风云的 `encryptorMode` 均放在 `gameOptions` 中，由服务端再次验证。

## 4. 服务器会发给前端哪些消息

### `gameList`

连接成功后发送，告诉大厅有哪些可创建的游戏。

```js
{
  type: 'gameList',
  games: [
    { type: 'mygame', name: '我的游戏', minPlayers: 2, maxPlayers: 4 }
  ]
}
```

### `roomList`

房间列表变化时发送。

```js
{
  type: 'roomList',
  rooms: [
    {
      id: '1234',
      gameType: 'mygame',
      gameName: '我的游戏',
      hostId: 'p1',
      status: 'waiting',
      playerCount: 2,
      minPlayers: 2,
      maxPlayers: 4,
      players: [{ id: 'p1', name: 'A', isHost: true }]
    }
  ]
}
```

### `roomCreated`

创建房间成功后只发给创建者。

```js
{
  type: 'roomCreated',
  playerId: 'p1',
  roomId: '1234',
  room: { /* roomInfo */ }
}
```

### `joinSuccess` / `playerJoined` / `playerLeft`

加入成功、其他玩家加入、其他玩家离开时发送，用于更新等待房间。

### `gameStarted`

房主点击开始后，大厅会加载对应游戏前端，并把每个玩家自己的游戏状态发给他。

```js
{
  type: 'gameStarted',
  gameType: 'mygame',
  state: { /* 这个玩家能看到的状态 */ },
  action: { /* 可选动作信息 */ }
}
```

### `gameState`

任何玩家操作成功后，大厅会重新给房间内每个玩家发送各自视角的状态。

```js
{
  type: 'gameState',
  gameType: 'mygame',
  state: { /* 这个玩家能看到的状态 */ },
  action: { /* 这个玩家能看到的动作结果 */ }
}
```

### `gameEnded`

游戏结束时发送。

```js
{
  type: 'gameEnded',
  winner: { id: 'p1', name: 'A' },
  room: { /* roomInfo */ },
  action: { /* 可选动作信息 */ }
}
```

### `error`

操作失败时发送。

```js
{ type: 'error', message: '错误原因' }
```

如果失败后游戏仍处于等待玩家继续选择的阶段，服务端游戏最好在失败结果里附带当前玩家视角的 state，避免前端按钮消失后无法恢复。

```js
return {
  success: false,
  message: '不能这样操作，请重新选择',
  state: this.getPlayerState(playerId),
};
```

## 5. 服务端游戏接口

每个游戏服务端入口必须放在：

```text
server/games/mygame/index.js
```

它必须导出：

```js
module.exports = {
  metadata,
  create(roomId, players, ownerId, settings) {
    return new MyGameSession(roomId, players, ownerId, settings);
  },
};
```

### `metadata`

用于告诉大厅这个游戏叫什么、几个人能玩。

```js
const metadata = {
  type: 'mygame',
  name: '我的游戏',
  minPlayers: 2,
  maxPlayers: 4,
};
```

`type` 非常重要，它同时决定：

```text
server/games/mygame/
public/games/mygame/
createRoom 时传入的 gameType
registry.js 里的注册 key
```

这些名字必须一致。

### `create(roomId, players, ownerId, settings)`

大厅开始游戏时会调用它。

```js
create(roomId, players, ownerId, settings) {
  return new MyGameSession(roomId, players, ownerId, settings);
}
```

`ownerId` 和 `settings` 来自房间服务，是棋谱模式、局间控制或其他特权动作的可信上下文。普通游戏可以不使用，但不得改为信任客户端 action 中的同名字段。

`players` 是大厅房间里的真实玩家数组，形状大致是：

```js
[
  { id: 'p1', name: '玩家A', ws: WebSocket对象 },
  { id: 'p2', name: '玩家B', ws: WebSocket对象 }
]
```

游戏逻辑只应该保存 `id` 和 `name`，不要操作 `ws`。

## 6. GameSession 必须提供的方法

`create()` 返回的对象需要提供下面这些方法。

### `start()`

开始游戏，初始化牌堆、棋盘、回合、玩家状态。

```js
start() {
  this.engine.init();
  return {
    success: true,
    message: '游戏已开始',
    state: this.engine.getState(),
  };
}
```

大厅不直接使用这里的 `state` 给所有人统一广播。真正发给每个人的状态会通过 `getPlayerState(playerId)` 重新获取。

### `handleAction(playerId, action)`

处理一个玩家动作。

```js
handleAction(playerId, action) {
  if (!action || !action.kind) {
    return { success: false, message: '未知动作' };
  }

  if (action.kind === 'rollDice') {
    return this.engine.rollDice(playerId);
  }

  if (action.kind === 'movePiece') {
    return this.engine.movePiece(playerId, action.pieceIndex);
  }

  return { success: false, message: '未知动作' };
}
```

这里的 `playerId` 是大厅确认过的真实操作者。不要让前端传 `playerId`，也不要用 action 里的玩家字段覆盖它。

返回值约定：

```js
{ success: true, message: '操作成功', state, ended, winner }
{ success: false, message: '失败原因' }
```

如果 `success: true`，大厅会调用 `getPlayerState(playerId)` 给房间里每个玩家分别发状态。

如果 `ended: true`，大厅会把房间状态改为结束，并发送 `gameEnded`。

### `getPlayerState(playerId)`

返回某个玩家视角能看到的状态。这是隐藏信息游戏最重要的接口。

```js
getPlayerState(playerId) {
  return {
    myId: playerId,
    roomId: this.roomId,
    phase: this.phase,
    currentTurn: this.currentTurn,
    players: this.players.map(player => ({
      id: player.id,
      name: player.name,
      score: player.score,
      handCount: player.hand.length,
      hand: player.id === playerId ? player.hand : undefined,
    })),
  };
}
```

原则：

- 自己能看的手牌，只发给自己。
- 别人的隐藏牌，只发数量、背面状态或 `undefined`。
- 公共信息可以发给所有人。
- `myId` 建议永远带上，前端判断“我是谁”会很方便。
- 不要把完整内部状态直接发给所有玩家。

### `getPlayerAction(action, playerId)`

可选，但建议提供。用于给不同玩家返回不同的动作结果。

```js
getPlayerAction(action, playerId) {
  if (!action) return action;

  if (action.privateFor && action.privateFor !== playerId) {
    return {
      ...action,
      secretCard: null,
      message: action.publicMessage,
    };
  }

  return action;
}
```

大厅发送 `gameState` 时会对每个玩家调用它。

### `getWinner()`

游戏结束后返回胜者。

```js
getWinner() {
  return this.winner ? { id: this.winner.id, name: this.winner.name } : null;
}
```

## 7. 前端游戏接口

每个游戏前端入口必须放在：

```text
public/games/mygame/client.js
```

必须导出：

```js
export function createGameClient({ mount, send, addLog }) {
  return {
    gameType: 'mygame',
    handleMessage(message) {},
    destroy() {},
  };
}
```

大厅会在游戏开始时自动加载：

```js
import(`/games/${gameType}/client.js?v=${Date.now()}`)
```

所以文件路径必须和 `metadata.type` 对上。

入口只负责资源加载、模板组装、协议转发和销毁。收到状态后应更新 `state.js` 的模型，再调用 `render.js`；指针、按钮和键盘事件由 `actions.js` 绑定，长生命周期动画或 WebGL 资源由 `scene.js` 管理。

### `mount`

游戏界面的挂载点。你应该把游戏 HTML 写进去：

```js
mount.innerHTML = `
  <section class="mygame">
    <div class="board"></div>
    <button class="action-btn">行动</button>
  </section>
`;
```

不要直接替换整个 `document.body`，不要删除大厅外层结构。

### `send`

通过大厅 WebSocket 发送消息。

```js
send({
  type: 'gameAction',
  action: { kind: 'rollDice' },
});
```

### `addLog`

向大厅日志输出文字。

```js
addLog('你掷出了 6 点', 'info');
addLog('操作失败', 'error');
```

### `handleMessage(message)`

接收大厅发来的 `gameStarted`、`gameState`、`gameEnded`、`error`。

```js
function handleMessage(message) {
  if (message.state) {
    latestState = message.state;
    render();
  }

  if (message.type === 'error') {
    addLog(message.message || '操作失败', 'error');
    render();
  }

  if (message.message && message.type !== 'error') {
    addLog(message.message, 'info');
  }
}
```

如果点击按钮后你临时把按钮改成“等待服务器更新”，错误时一定要重新 render，否则按钮可能消失。

### `destroy()`

离开房间或切换游戏时大厅会调用。这里应该清理事件、样式、定时器。

```js
function destroy() {
  styleLink?.remove();
  mount.innerHTML = '';
}
```

## 8. 最小服务端模板

可以从这个模板开始写新游戏。

```js
// server/games/mygame/index.js
const metadata = {
  type: 'mygame',
  name: '我的游戏',
  minPlayers: 2,
  maxPlayers: 4,
};

class MyGameSession {
  constructor(roomId, players) {
    this.roomId = roomId;
    this.players = players.map(player => ({
      id: player.id,
      name: player.name,
      score: 0,
      hand: [],
      isAlive: true,
    }));
    this.currentTurnIndex = 0;
    this.status = 'waiting';
    this.winner = null;
  }

  start() {
    this.status = 'playing';
    return {
      success: true,
      message: '游戏已开始',
      state: this.getPublicState(),
    };
  }

  handleAction(playerId, action) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return { success: false, message: '玩家不存在' };
    if (this.players[this.currentTurnIndex]?.id !== playerId) {
      return { success: false, message: '还没轮到你' };
    }

    if (action.kind === 'gainPoint') {
      player.score += 1;
      this.nextTurn();
      return {
        success: true,
        message: `${player.name} 得到 1 分`,
        state: this.getPublicState(),
      };
    }

    return { success: false, message: '未知动作' };
  }

  getPlayerState(playerId) {
    return {
      ...this.getPublicState(),
      myId: playerId,
      players: this.players.map(player => ({
        id: player.id,
        name: player.name,
        score: player.score,
        handCount: player.hand.length,
        hand: player.id === playerId ? player.hand : undefined,
        isAlive: player.isAlive,
      })),
    };
  }

  getPublicState() {
    return {
      roomId: this.roomId,
      status: this.status,
      currentTurn: this.players[this.currentTurnIndex]?.id || null,
      winner: this.winner,
    };
  }

  getPlayerAction(action, playerId) {
    return action;
  }

  getWinner() {
    return this.winner;
  }

  nextTurn() {
    this.currentTurnIndex = (this.currentTurnIndex + 1) % this.players.length;
  }
}

module.exports = {
  metadata,
  create(roomId, players, ownerId, settings) {
    return new MyGameSession(roomId, players, ownerId, settings);
  },
};
```

## 9. 最小前端模板

```js
// public/games/mygame/client.js
export function createGameClient({ mount, send, addLog }) {
  const style = document.createElement('link');
  style.rel = 'stylesheet';
  style.href = `/games/mygame/style.css?v=${Date.now()}`;
  document.head.appendChild(style);

  let state = null;

  mount.innerHTML = `
    <section class="mygame">
      <header>
        <h2>我的游戏</h2>
        <div class="status"></div>
      </header>
      <main class="players"></main>
      <button class="gain-btn" type="button">得分</button>
    </section>
  `;

  const statusEl = mount.querySelector('.status');
  const playersEl = mount.querySelector('.players');
  const gainBtn = mount.querySelector('.gain-btn');

  gainBtn.addEventListener('click', () => {
    gainBtn.disabled = true;
    send({ type: 'gameAction', action: { kind: 'gainPoint' } });
  });

  function handleMessage(message) {
    if (message.state) {
      state = message.state;
      render();
    }

    if (message.type === 'error') {
      addLog(message.message || '操作失败', 'error');
      render();
    } else if (message.message) {
      addLog(message.message, 'info');
    }
  }

  function render() {
    if (!state) return;
    const isMyTurn = state.currentTurn === state.myId;
    statusEl.textContent = isMyTurn ? '轮到你行动' : '等待其他玩家';
    gainBtn.disabled = !isMyTurn;

    playersEl.innerHTML = state.players.map(player => `
      <div class="player ${player.id === state.myId ? 'self' : ''}">
        <span>${escapeHtml(player.name)}</span>
        <span>${player.score} 分</span>
      </div>
    `).join('');
  }

  function destroy() {
    style.remove();
    mount.innerHTML = '';
  }

  return {
    gameType: 'mygame',
    handleMessage,
    destroy,
  };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
```

## 10. 注册新游戏

编辑：

```text
server/games/registry.js
```

加入：

```js
const mygame = require('./mygame');
```

并把它放入 Map。实际项目里如果已经有其他游戏，就在原来的列表后面追加，不要删掉已有项。

```js
const games = new Map([
  [mygame.metadata.type, mygame],
]);
```

注册后，刷新网页，游戏类型下拉框会从 `gameList` 自动出现这个游戏。

## 11. 从外部游戏接入大厅的步骤

如果你已经在外面写好了一个单机 HTML/JS 游戏，不建议直接整包塞进大厅。推荐这样拆：

1. 把纯界面 HTML 放进 `template.js`，由 `client.js` 挂载。
2. 把可变视图状态放进 `state.js`，把 DOM 输出放进 `render.js`。
3. 把指针、按钮和键盘事件放进 `actions.js`；需要动画或 WebGL 时放进 `scene.js`。
4. 把原来的 CSS 放进 `public/games/mygame/style.css`。
5. 把规则逻辑移到 `server/games/mygame/engine.js`。
6. 把原来前端里的“当前玩家”“所有玩家”“轮到谁”删除，改成使用 `message.state`。
7. 把原来按钮事件里的本地函数调用，改成 `send({ type: 'gameAction', action })`。
8. 在服务端 `handleAction(playerId, action)` 和 `getPlayerState(playerId)` 中处理动作与隐私。
9. 注册到 `registry.js`，实现 `destroy()` 并运行 `npm test`。

外部游戏里如果原本有这些代码，接入大厅时通常要删掉或改掉：

```js
new WebSocket(...)
const players = [...]
const myPlayer = players[0]
createRoom()
joinRoom()
startGame()
```

这些都是大厅已经负责的事情。

## 12. 常见错误和原因

### 创建了两个角色，但自己不能控制

通常原因是游戏自己又创建了一套玩家。正确做法是使用 `create(roomId, players, ownerId, settings)` 传进来的玩家数组，并且用 `handleAction(playerId, action)` 的 `playerId` 判断操作者；需要房主权限时使用可信的 `ownerId`，不要读取 action 中伪造的身份。

### 前端能看到别人手牌

通常原因是 `getPlayerState(playerId)` 直接返回了完整内部状态。应该按玩家过滤隐藏信息。

### 点击按钮后界面一直等待

通常原因是前端点击后把按钮清空了，但后端返回 `success: false` 时没有新 state。前端错误时应该 `render()` 恢复界面；后端在需要继续选择时应该返回 `state: this.getPlayerState(playerId)`。

### 新游戏没有出现在下拉框

检查三处名字是否一致：

```text
metadata.type
public/games/<type>/client.js
server/games/<type>/index.js
```

再检查 `server/games/registry.js` 是否注册。

### 游戏界面加载失败

检查 `public/games/<type>/client.js` 是否导出了：

```js
export function createGameClient({ mount, send, addLog }) {}
```

还要检查浏览器控制台和大厅日志里的错误，例如语法错误、路径错误、没有导出函数。

### 操作别人也能替我行动

不要相信前端传来的 `playerId`。服务端只使用大厅传入的 `handleAction(playerId, action)` 里的 `playerId`。

## 13. 开发新游戏的检查清单

- `metadata.type` 使用英文小写，不带空格。
- `server/games/<type>/index.js` 导出 `metadata` 和 `create`。
- `create(roomId, players, ownerId, settings)` 使用大厅传入的玩家与可信房间上下文，不自己造真实玩家。
- `handleAction(playerId, action)` 只信任参数 `playerId`。
- `getPlayerState(playerId)` 按玩家视角隐藏信息。
- `public/games/<type>/client.js` 导出 `createGameClient`。
- 前端只用大厅传入的 `send`，不自己创建 WebSocket。
- 前端收到 `message.state` 后重新渲染。
- 前端收到 `error` 后恢复按钮或重新渲染。
- `registry.js` 已注册新游戏。
- 运行 `node --check server/games/<type>/index.js` 检查语法。
- 浏览器刷新后能创建房间、加入房间、开始游戏、执行动作、离开房间。

## 14. 本轮工作清单验收

本轮已接入大厅的五款新增桌游：

- **并购（Acquire）**：6 张私有地块、9×12 城市地图、酒店集团创建/合并、股东多数/少数分红、最多三股购买、现金加股票市值结算。
- **牛头王（Take Five）**：104 张牌、同时选牌、按顺序接入四行、第六张收行、低于所有行尾时选择收取牌行、十轮计分。
- **璀璨宝石（Splendor）**：三层市场、贵族、五色宝石与黄金、预留/购买、折扣、十枚筹码上限和最终回合。
- **花火（Hanabi）**：50 张牌、提示令牌、引信、烟花进度、牌库耗尽最后回合；玩家看不到自己的牌，队友视角可见牌面。
- **多米诺王国（Kingdomino）**：48 块多米诺、按顺序选牌、5×5 王国摆放校验、区域×王冠计分、无法摆放时弃置。

另外完成了狼人杀线下辅助首版：服务端隔离私密身份，记录守卫、狼人、预言家、女巫的夜间行动及白天放逐投票。当房间只有 1 名真实用户时启用 9 座位自由切换的测试导演模式。

大厅侧已统一使用动态 `gameList` 注册、游戏专属主题、响应式布局、键盘焦点和减少动效；游戏状态广播按玩家视角生成，避免花火等隐藏信息在离开或结算广播时泄露。

后续规则化验收已补齐军棋的暗棋布阵、铁路/行营与军旗结算，并核验斗兽棋的官方河流、陷阱、兽穴和鼠象关系。

验证命令：

```bash
npm test
for f in server/games/*/*.js; do node --check "$f"; done
for f in public/games/*/*.js; do node --check "$f"; done
node --check public/games/werewolf/client.js
```

当前全量测试共 493 项，全部通过；其中包含房间名称、人数上限、公开/仅邀请、创建前特殊配置、双页创建浮窗、移动端核心布局、封面懒加载、隐藏信息游戏离场收束、四款背牌身份严格按住查看、谍报风云推理笔记、解密类分组、棋谱模式、28 款游戏前端模块骨架审计和本地字体资源审计。国际象棋另覆盖普通/棋谱模式隔离、房主鉴权、非法摆棋、状态重建、重复局面键、重复启动和玩家身份完整性。各游戏的官方规则专项、完整对局和隐私边界仍由对应 `test/*-official.test.js`、`test/*-frontend.test.js` 与 `test/regression.test.js` 持续验证。

## 15. BGG 美术资源接入

项目早期从 BoardGameGeek 图片接口下载并接入了 19 款游戏的本地视觉资源，每款包含 `cover` 和组件/牌面参考图 `detail`，统一存放在 `public/assets/bgg/<game>/`。当前创建房间规则浮窗与预开局房间使用 `public/assets/covers/` 下 28 张独立艺术方向的高清横版封面；大厅卡片和公开房间列表使用 `public/assets/covers/thumbs/` 下同名 640×360 缩略图，并按视口懒加载。旧 BGG cover 作为历史参考保留。进入对应游戏后仍可按既有逻辑查看或使用组件参考图，情书仍会把 detail 合照裁切成独立角色牌。不会把组件合照默认铺成大厅封面，也不会在运行时请求 BGG。

具体图片 ID、条目链接、用途和替换约定记录在 [public/assets/bgg/SOURCES.md](public/assets/bgg/SOURCES.md)。大厅底部保留了 BGG 来源链接；逐张牌面应优先使用独立裁切资源或项目自制图标、文字和版式，避免把组件合照直接当作可编辑牌面。

情书已完成美术试点并正式切换默认入口：类型仍为 `loveletter`，客户端加载 BGG cover/detail 素材，并从 detail 合照裁切出 8 张角色牌直接替换手牌、猜牌和弃牌缩略卡面；服务端规则适配层不变。大厅不再展示独立的 BGG 试点卡，用户点击原情书即可使用新版牌面。

阿瓦隆已从 BGG 图片 `1453098` / `1453075` 裁切并本地化 8 张 `720×900` WebP 角色图，对应忠臣、梅林、派西维尔、爪牙、刺客、莫甘娜、莫德雷德和奥伯伦。所有角色图随客户端一起预加载，避免通过单张资源请求推测私密身份；图片不包办线上能力文本和私密线索，这些内容继续由玩家视角状态实时渲染。

## 16. 阵营推理游戏身份焦点契约

狼人杀、阿瓦隆和猎巫镇共用 `public/games/common/hidden-role-focus.css` 中的 `.social-role-focus` / `.social-role-focus-art` 契约。共用层只管理身份区顶边、柔光、人物图裁切和底部遮罩；三款游戏在自身 CSS 中定义 `--role-focus-accent` / `--role-focus-glow` 并保留独立题材风格。

隐私边界不能为了视觉统一而改变：

- 狼人杀和阿瓦隆的私密身份仍需要按住查看，松开、移出、窗口失焦或页面隐藏必须立即遮住。
- 猎巫镇 Town Hall 是始终公开身份，不得放进私密档案；阵营、未揭示 Trial 牌、调查结果和秘密选择才可封存。
- 桌面端应让身份牌成为主视觉之一；竖屏有当前必须行动时先保证决策可用，短横屏将身份、行动和必要公开信息放入同一可用高度，次要内容才使用内部滚动。

响应式变更至少要使用 `public/__game_shell_visual_test.html` 覆盖 `390×844`、`844×390`、`667×375` 三档。短横屏必须同时通过页面宽高、身份焦点可见、当前决策同屏与猎巫镇公开区可见性断言。

## 17. 谍报风云线上推理交互约定

谍报风云按 `online` 分类：游戏房间保管双方关键词、加密员密码、公开线索、两份封存答案、标记和终局。远程游玩建议使用所有人都在的公共语音，因为加密员给出的信息必须同时向对手公开；当前项目不内建音视频服务。

前端的主要推理结构是“数字—线索笔记”：已揭晓电报必须按队伍和正确数字 `1–4` 聚合，而不能只提供逐轮日志。短横屏可以用弹层保留这份笔记，但不得为它牺牲当前密码、线索和答案操作的同屏可用性。关键词可由玩家选择切页自动遮盖或常显；加密员密码必须始终保持按住查看。

## 18. 大厅主分组约定

大厅主分组由 `server/games/groups.js` 唯一定义，registry 将 `group`、`groupName`、`groupDescription`、`groupOrder` 和组内 `sortOrder` 附加到游戏元数据。浏览器按服务端顺序渲染，不应在 HTML 中手写重复的游戏清单。

当前顺序为“社交推理与流程辅助 → 解密类 → 棋类与棋盘游戏 → 卡牌与策略桌游”。`codebreaking` 对应“解密类”，包含完整线上的谍报风云和单人猜数字。分类只负责大厅展示与筛选，不得改变游戏的 `playMode`、房间协议或引擎规则；每次迁移都要同步 `GAME_GROUPS.md` 并回归总数、各组数量和组内顺序。

## 19. 背牌身份隐私交互约定

狼人杀、阿瓦隆、猎巫镇和政变的未公开身份必须采用 momentary reveal：只有鼠标、触控或键盘持续按住查看控件期间可见，松开、移出、取消、失焦或页面隐藏时立即恢复牌背。身份显示与封存不得使用透明度延迟，以免释放后仍残留可读内容。

公开信息不应被该交互误封存：猎巫镇 Town Hall、已揭示审判牌和桌面公开牌始终可见；政变已揭示影响力、角色速查和公开声明始终可见。需要从私牌中选择时，先按住核对并记住编号，松开后再使用独立编号按钮提交，查看控件本身不得兼任选择动作。
