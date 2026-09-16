const COLORS = [
    // Keep player order aligned with the authorized classic board artwork:
    // top-left blue, top-right green, bottom-right red, bottom-left yellow.
    { id: 'blue', name: '蓝方', start: 0 },
    { id: 'green', name: '绿方', start: 13 },
    { id: 'red', name: '红方', start: 26 },
    { id: 'yellow', name: '黄方', start: 39 },
];

const TRACK_LENGTH = 52;
// The shared ring contains 52 cells, but each colour turns into its home lane
// after traversing 50 of them. The two cells beyond that entrance belong to
// the other side of that colour's starting area.
const SHARED_ROUTE_STEPS = 50;
const LAST_ROUTE_PROGRESS = SHARED_ROUTE_STEPS - 1;
const FINISH_PROGRESS = 55;
// Progress is measured from each player's own starting square (0 = start).
// These are the same-colour leap squares on the classic 52-cell board; the
// flight-line entrance is progress 17 and carries the plane to progress 29.
const JUMP_OFFSETS = new Set([1, 5, 9, 13, 21, 25, 29, 33, 37, 41, 45]);
const FLIGHT_PROGRESS = 17;
const FLIGHT_DISTANCE = 12;

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

class AeroplaneEngine {
    constructor(roomId, players, random = Math.random) {
        this.roomId = roomId; this.random = random;
        // 不在构造阶段静默截断玩家；由 start() 统一校验 2–4 人，便于大厅和测试发现人数配置错误。
        this.players = players.map(player => ({ id: player.id, name: player.name, color: null, colorName: '未选择', isOnline: true }));
        this.playerMap = Object.fromEntries(this.players.map(player => [player.id, player]));
        this.status = 'waiting';
        this.currentTurnIndex = 0;
        this.phase = 'waiting';
        this.dice = null;
        this.movablePlaneIds = [];
        this.planes = this.players.flatMap(player => Array.from({ length: 4 }, (_, index) => ({
            id: `${player.id}-plane-${index + 1}`,
            playerId: player.id,
            color: player.color,
            number: index + 1,
            progress: -1,
            status: 'base',
            globalPosition: null,
        })));
        this.lastMove = null;
        this.lastAction = null;
        this.rollSequence = 0;
        this.actionLog = [];
        this.winner = null;
    }

    start() {
        if (this.status !== 'waiting') return { success: false, message: '飞行棋已经开始或已经结束' };
        if (this.players.length < 2 || this.players.length > 4) return { success: false, message: '飞行棋需要 2 至 4 名玩家' };
        this.status = 'selecting_color';
        this.phase = 'select_color';
        this.currentTurnIndex = 0;
        this._log('请每位玩家选择一个颜色');
        return this._success('请选择颜色');
    }

    handleAction(playerId, action = {}) {
        const player = this.playerMap[playerId];
        if (!player || !player.isOnline) return { success: false, message: '玩家不存在或已离线' };
        if (action.kind === 'selectColor') return this._selectColor(player, action.color);
        if (this.status !== 'playing') return { success: false, message: '请等待所有玩家选好颜色' };
        const current = this.getCurrentPlayer();
        if (!current || current.id !== playerId) return { success: false, message: '还没轮到你', state: this.getPlayerState(playerId) };

        const kind = action.kind === 'roll' ? 'rollDice' : action.kind === 'move' ? 'movePlane' : action.kind;
        if (kind === 'rollDice') return this._rollDice(player);
        if (kind === 'movePlane') return this._movePlane(player, action.planeId);
        return { success: false, message: '未知操作', state: this.getPlayerState(playerId) };
    }

    _selectColor(player, colorId) {
        if (this.status !== 'selecting_color') return { success: false, message: '选色阶段已经结束' };
        const color = COLORS.find(item => item.id === colorId);
        if (!color) return { success: false, message: '请选择有效颜色' };
        const occupied = this.players.find(item => item.id !== player.id && item.color === color.id);
        if (occupied) return { success: false, message: `${color.name}已被 ${occupied.name} 选择`, state: this.getPlayerState(player.id) };
        player.color = color.id;
        player.colorName = color.name;
        this.planes.filter(plane => plane.playerId === player.id).forEach(plane => { plane.color = color.id; });
        this._log(`${player.name} 选择了${color.name}`);
        this._beginPlayWhenColorsReady();
        return this._success(`${player.name} 已选择${color.name}`);
    }

    _beginPlayWhenColorsReady() {
        const active = this.players.filter(player => player.isOnline);
        if (this.status !== 'selecting_color' || active.length < 2 || !active.every(player => player.color)) return false;
        this.status = 'playing';
        this.phase = 'await_roll';
        this.currentTurnIndex = this.players.findIndex(player => player.isOnline);
        this._log(`${this.getCurrentPlayer().name} 先手，请掷骰子`);
        return true;
    }

    _rollDice(player) {
        if (this.phase !== 'await_roll') return { success: false, message: '请先完成这次掷骰后的移动' };
        this.dice = Math.floor(this.random() * 6) + 1;
        this.movablePlaneIds = this._movablePlanes(player, this.dice).map(plane => plane.id);
        this.lastAction = { kind: 'rollDice', rollId: ++this.rollSequence, playerId: player.id, playerName: player.name, dice: this.dice, message: `${player.name} 掷出 ${this.dice} 点` };
        this._log(this.lastAction.message);
        if (!this.movablePlaneIds.length) {
            const extra = this.dice === 6;
            this._log(extra ? `${player.name} 没有可移动的飞机，再掷一次` : `${player.name} 没有可移动的飞机，回合交给下一位`);
            this.dice = null;
            this.movablePlaneIds = [];
            if (extra) this.phase = 'await_roll';
            else this._advanceTurn();
            return this._success(extra ? '六点奖励：再掷一次' : '没有可移动的飞机');
        }
        this.phase = 'choose_plane';
        return this._success(`${player.name} 请选择一架飞机`);
    }

    _movePlane(player, planeId) {
        if (this.phase !== 'choose_plane' || !this.dice) return { success: false, message: '请先掷骰子' };
        if (!this.movablePlaneIds.includes(planeId)) return { success: false, message: '这架飞机不能按当前点数移动' };
        const plane = this.planes.find(item => item.id === planeId && item.playerId === player.id);
        if (!plane) return { success: false, message: '飞机不存在' };
        const dice = this.dice;
        const from = { progress: plane.progress, globalPosition: plane.globalPosition, status: plane.status };
        const events = [];
        const path = [];
        const addPathFrame = progress => {
            const status = progress === FINISH_PROGRESS ? 'finished' : progress > LAST_ROUTE_PROGRESS ? 'home' : 'flying';
            path.push({
                progress,
                status,
                globalPosition: status === 'flying' ? this._globalPosition(player.color, progress) : null,
            });
        };
        if (plane.status === 'base') {
            plane.progress = -1;
            plane.status = 'ready';
            plane.globalPosition = null;
            path.push({ progress: -1, status: 'ready', globalPosition: null });
            events.push('进入起飞等待点');
        } else {
            // The waiting point sits immediately before the first main-track
            // square. The first square therefore counts as step one.
            const nextProgress = plane.status === 'ready' ? dice - 1 : plane.progress + dice;
            if (nextProgress > FINISH_PROGRESS) return { success: false, message: '需要刚好到达终点，不能飞过终点' };

            plane.progress = nextProgress;
            plane.status = nextProgress === FINISH_PROGRESS ? 'finished' : nextProgress > LAST_ROUTE_PROGRESS ? 'home' : 'flying';
            plane.globalPosition = this._globalPosition(player.color, nextProgress);
            const startProgress = from.status === 'ready' ? -1 : from.progress;
            for (let progress = startProgress + 1; progress <= nextProgress; progress += 1) addPathFrame(progress);

            if (plane.status === 'flying') {
                const landedByDice = plane.progress;
                let jumpedToFlight = false;
                const offset = this._colorOffset(player.color, plane.globalPosition);
                if (JUMP_OFFSETS.has(offset)) {
                    plane.progress = Math.min(plane.progress + 4, LAST_ROUTE_PROGRESS);
                    plane.globalPosition = this._globalPosition(player.color, plane.progress);
                    addPathFrame(plane.progress);
                    events.push('同色跳跃');
                    jumpedToFlight = plane.progress === FLIGHT_PROGRESS;
                }
                if (plane.progress === FLIGHT_PROGRESS) {
                    plane.progress = Math.min(plane.progress + FLIGHT_DISTANCE, LAST_ROUTE_PROGRESS);
                    plane.globalPosition = this._globalPosition(player.color, plane.progress);
                    addPathFrame(plane.progress);
                    events.push('飞行线捷径');
                    // A direct landing on the dashed-line start continues to the
                    // next same-colour square; arriving there by a normal jump
                    // stops after the flight, matching the physical rule.
                    if (!jumpedToFlight && landedByDice <= LAST_ROUTE_PROGRESS && plane.progress < LAST_ROUTE_PROGRESS && JUMP_OFFSETS.has(this._colorOffset(player.color, plane.globalPosition))) {
                        plane.progress = Math.min(plane.progress + 4, LAST_ROUTE_PROGRESS);
                        plane.globalPosition = this._globalPosition(player.color, plane.progress);
                        addPathFrame(plane.progress);
                        events.push('飞行后同色跳跃');
                    }
                }
                const captured = this._captureAt(plane, player);
                if (captured.length) events.push(`击落 ${captured.length} 架敌机`);
            }
            if (plane.status === 'finished') events.push('抵达终点');
        }
        this.lastMove = { planeId: plane.id, playerId: player.id, dice, from, to: { progress: plane.progress, globalPosition: plane.globalPosition, status: plane.status }, path, events };
        this.lastAction = { kind: 'movePlane', playerId: player.id, playerName: player.name, planeId: plane.id, dice, events, message: `${player.name} 的 ${plane.number} 号飞机${events.length ? `：${events.join('、')}` : '完成移动'}` };
        this._log(this.lastAction.message);
        this.dice = null;
        this.movablePlaneIds = [];

        if (this._hasWon(player)) {
            this.status = 'ended';
            this.phase = 'ended';
            this.winner = player;
            this._log(`${player.name} 的四架飞机全部抵达终点，获胜！`);
            return this._success(`${player.name} 获胜`);
        }
        if (dice === 6) {
            this.phase = 'await_roll';
            this._log(`${player.name} 掷出六点，再掷一次`);
        } else {
            this._advanceTurn();
        }
        return this._success(this.lastAction.message);
    }

    _captureAt(plane, player) {
        const enemies = this.planes.filter(other => other.playerId !== player.id && other.status === 'flying' && other.globalPosition === plane.globalPosition);
        // Two or more enemy planes on one square form a protected stack in the
        // physical game; a single landing plane cannot knock that stack home.
        if (enemies.length > 1) return [];
        const captured = [];
        for (const other of enemies) {
            other.progress = -1;
            other.status = 'base';
            other.globalPosition = null;
            captured.push(other);
        }
        return captured;
    }

    _movablePlanes(player, dice) {
        return this.planes.filter(plane => {
            if (plane.playerId !== player.id || plane.status === 'finished') return false;
            if (plane.status === 'base') return dice === 6;
            if (plane.status === 'ready') return true;
            return plane.progress + dice <= FINISH_PROGRESS;
        });
    }

    _hasWon(player) {
        return this.planes.filter(plane => plane.playerId === player.id && plane.status === 'finished').length === 4;
    }

    _globalPosition(color, progress) {
        if (progress < 0 || progress > LAST_ROUTE_PROGRESS) return null;
        const start = COLORS.find(item => item.id === color)?.start || 0;
        return (start + progress) % TRACK_LENGTH;
    }

    _colorOffset(color, globalPosition) {
        const start = COLORS.find(item => item.id === color)?.start || 0;
        return (globalPosition - start + TRACK_LENGTH) % TRACK_LENGTH;
    }

    _advanceTurn() {
        const active = this.players.filter(player => player.isOnline);
        if (active.length <= 1) {
            this.status = 'ended';
            this.phase = 'ended';
            this.winner = active[0] || null;
            return;
        }
        let next = this.currentTurnIndex;
        for (let i = 0; i < this.players.length; i += 1) {
            next = (next + 1) % this.players.length;
            if (this.players[next].isOnline) break;
        }
        this.currentTurnIndex = next;
        this.phase = 'await_roll';
        this._log(`${this.getCurrentPlayer().name} 的回合`);
    }

    getCurrentPlayer() {
        return this.players[this.currentTurnIndex] || null;
    }

    _log(message) {
        this.actionLog.push(message);
        if (this.actionLog.length > 18) this.actionLog.shift();
    }

    getPublicState() {
        const current = this.getCurrentPlayer();
        return {
            roomId: this.roomId,
            status: this.status,
            phase: this.phase,
            currentTurn: current?.id || null,
            currentTurnName: current?.name || null,
            dice: this.dice,
            players: this.players.map(player => ({
                id: player.id,
                name: player.name,
                color: player.color,
                colorName: player.colorName,
                isOnline: player.isOnline,
                isCurrentTurn: player.id === current?.id,
            })),
            planes: clone(this.planes),
            movablePlaneIds: this.movablePlaneIds.slice(),
            lastMove: clone(this.lastMove),
            lastAction: clone(this.lastAction),
            actionLog: this.actionLog.slice(-18),
            winner: this.winner ? { id: this.winner.id, name: this.winner.name, color: this.winner.color } : null,
            availableColors: COLORS.map(color => ({ id: color.id, name: color.name, occupiedBy: this.players.find(player => player.color === color.id)?.id || null })),
            rules: {
                trackLength: TRACK_LENGTH,
                sharedRouteSteps: SHARED_ROUTE_STEPS,
                finishProgress: FINISH_PROGRESS,
                jumpProgress: Array.from(JUMP_OFFSETS).sort((a, b) => a - b),
                flightProgress: FLIGHT_PROGRESS,
                flightDistance: FLIGHT_DISTANCE,
                launchToReadyOnSix: true,
                extraRollOnSix: true,
                exactFinish: true,
            },
        };
    }

    getPlayerState(playerId) {
        const state = this.getPublicState();
        const player = this.playerMap[playerId];
        state.myId = playerId;
        state.myColor = player?.color || null;
        state.myIsCurrentTurn = state.currentTurn === playerId;
        state.availableActions = {
            canRoll: state.myIsCurrentTurn && state.phase === 'await_roll' && state.status === 'playing',
            canChoosePlane: state.myIsCurrentTurn && state.phase === 'choose_plane' && state.status === 'playing',
            movablePlaneIds: state.myIsCurrentTurn ? this.movablePlaneIds.slice() : [],
        };
        if (!state.myIsCurrentTurn) state.movablePlaneIds = [];
        return state;
    }

    handlePlayerLeave(playerId) {
        const player = this.playerMap[playerId];
        if (!player) return { success: false, message: '玩家不存在' };
        const wasPlaying = this.status === 'playing';
        player.isOnline = false;
        const activePlayers = this.players.filter(item => item.isOnline);
        if (this.status === 'selecting_color') {
            player.color = null; player.colorName = '未选择';
            this.planes.filter(plane => plane.playerId === playerId).forEach(plane => { plane.color = null; });
            if (activePlayers.length <= 1) {
                this.status = 'ended'; this.phase = 'ended'; this.winner = activePlayers[0] || null;
            } else {
                this._log(`${player.name} 离开，颜色已释放`);
                this._beginPlayWhenColorsReady();
            }
        } else if (this.status === 'playing' && activePlayers.length <= 1) {
            this.status = 'ended'; this.phase = 'ended'; this.winner = this.players.find(item => item.isOnline) || null;
        } else if (this.status === 'playing' && this.getCurrentPlayer()?.id === playerId) this._advanceTurn();
        if (wasPlaying && this.status === 'playing') this._log(`${player.name} 离开了飞行棋`);
        return this._success(`${player.name} 离开棋局`);
    }

    _success(message) {
        return {
            success: true,
            message,
            state: this.getPublicState(),
            ended: this.status === 'ended',
            winner: this.winner ? { id: this.winner.id, name: this.winner.name } : null,
        };
    }

    getWinner() {
        return this.winner ? { id: this.winner.id, name: this.winner.name } : null;
    }
}

module.exports = AeroplaneEngine;
module.exports.COLORS = COLORS;
