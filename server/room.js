const games = require('./games/registry');

const ROOM_NAME_MAX_LENGTH = 24;

const STUDY_SIDE_LABELS = {
    chess: { white: '白方', black: '黑方' },
    xiangqi: { red: '红方', black: '黑方' },
    jungle: { red: '红方', blue: '蓝方' },
    junqi: { red: '红方', blue: '蓝方' },
    gobang: { black: '黑方', white: '白方' },
    checkers: { red: '红方', blue: '蓝方', green: '绿方', yellow: '黄方', purple: '紫方', orange: '橙方' },
};

function studySideLabel(gameType, color, fallback = '当前阵营') {
    return STUDY_SIDE_LABELS[gameType]?.[color] || fallback || (color ? `${color}方` : '当前阵营');
}

function normalizeRoomName(value, hostName, gameName) {
    const clean = String(value ?? '')
        .replace(/[\u0000-\u001f\u007f]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if ([...clean].length > ROOM_NAME_MAX_LENGTH) {
        throw new Error(`房间名称不能超过 ${ROOM_NAME_MAX_LENGTH} 个字符`);
    }
    if (clean) return clean;
    return [...`${hostName || '房主'}的${gameName}房间`].slice(0, ROOM_NAME_MAX_LENGTH).join('');
}

function normalizeRoomSettingDefinitions(definitions) {
    if (!Array.isArray(definitions)) return [];
    return definitions
        .filter(definition => definition && typeof definition.key === 'string' && /^[a-zA-Z][\w-]*$/.test(definition.key))
        .map(definition => ({
            key: definition.key,
            label: String(definition.label || definition.key),
            kind: definition.kind === 'toggle' ? 'toggle' : 'choice',
            defaultValue: definition.defaultValue,
            description: definition.description ? String(definition.description) : '',
            requiredBeforeJoin: definition.requiredBeforeJoin === true,
            options: Array.isArray(definition.options)
                ? definition.options
                    .filter(option => option && option.value != null)
                    .map(option => ({
                        value: option.value,
                        title: String(option.title || option.value),
                        copy: option.copy ? String(option.copy) : '',
                    }))
                : [],
        }));
}

class Room {
    constructor(roomId, hostId, hostName, gameType = 'loveletter', gameOptions = {}, roomProperties = {}) {
        const gameModule = games.getGame(gameType);
        if (!gameModule) {
            throw new Error(`\u672a\u77e5\u6e38\u620f\u7c7b\u578b: ${gameType}`);
        }

        this.id = roomId;
        this.gameType = gameType;
        this.gameName = gameModule.metadata.name;
        this.gameModule = gameModule;
        this.gameOptions = gameOptions && typeof gameOptions === 'object' ? { ...gameOptions } : {};
        // Board games can opt into a single-player study table.  The room
        // still uses the normal authoritative game engine; the study layer
        // only supplies virtual seats and routes the host's actions to the
        // currently selected perspective.
        this.studyModeSupported = gameModule.metadata.studyMode === true;
        if (this.studyModeSupported) {
            this.gameOptions.gameMode = this.gameOptions.gameMode === 'study' ? 'study' : 'match';
        }
        const properties = roomProperties && typeof roomProperties === 'object' ? roomProperties : {};
        this.roomSettingDefinitions = normalizeRoomSettingDefinitions(gameModule.metadata.roomSettings);
        // The browser-facing app enables this gate. Direct Room adapters can
        // still start immediately, which keeps them useful as game harnesses.
        this.readyCheckEnabled = properties.readyCheckEnabled === true;
        this.roomName = normalizeRoomName(properties.roomName, hostName, this.gameName);
        this.isPublic = properties.isPublic !== false;
        this.hostId = hostId;
        this.players = [];
        this.status = 'waiting';
        this.baseMinPlayers = gameModule.metadata.minPlayers || 2;
        this.baseMaxPlayers = gameModule.metadata.maxPlayers || 4;
        this.minPlayers = this.baseMinPlayers;
        this.maxPlayers = this.baseMaxPlayers;
        const playerCountSetting = this._settingDefinition('playerCount');
        const encryptorModeSetting = this._settingDefinition('encryptorMode');
        this.allowedPlayerCounts = playerCountSetting?.options?.length
            ? [...new Set(playerCountSetting.options.map(option => Number(option.value)).filter(Number.isInteger))]
            : Array.isArray(gameModule.metadata.playerCounts)
                ? [...new Set(gameModule.metadata.playerCounts.map(Number).filter(Number.isInteger))]
                : [];
        this.allowedEncryptorModes = encryptorModeSetting?.options?.length
            ? [...new Set(encryptorModeSetting.options.map(option => String(option.value)))]
            : Array.isArray(gameModule.metadata.encryptorModes)
                ? [...new Set(gameModule.metadata.encryptorModes.map(String))]
                : [];
        if (!this.allowedPlayerCounts.length && properties.seatLimit != null) {
            const seatLimit = Number(properties.seatLimit);
            const minimumSeatLimit = this.studyModeSupported && this.gameOptions.gameMode === 'study' ? 1 : this.minPlayers;
            if (!Number.isInteger(seatLimit) || seatLimit < minimumSeatLimit || seatLimit > this.maxPlayers) {
                throw new Error(`房间人数上限必须在 ${minimumSeatLimit}–${this.maxPlayers} 人之间`);
            }
            this.maxPlayers = seatLimit;
        }
        this.configurationRequired = this.allowedPlayerCounts.length > 0 || this.allowedEncryptorModes.length > 0;
        this.configurationConfirmed = !this.configurationRequired;
        this.targetPlayers = null;
        if (this.configurationRequired && this.gameOptions.playerCount != null) {
            const configured = this._setPlayerCount(this.gameOptions.playerCount);
            if (!configured.success) throw new Error(configured.message);
        }
        if (this.allowedEncryptorModes.length && this.gameOptions.encryptorMode != null) {
            const configured = this._setEncryptorMode(this.gameOptions.encryptorMode);
            if (!configured.success) throw new Error(configured.message);
        }
        this._refreshConfiguration();
        this._refreshStudyLimits();
        this.game = null;
        this.createdAt = Date.now();
        this.messages = [];
        // A dropped connection keeps its seat and freezes the whole game until
        // that player's connection is restored.  This is intentionally kept
        // at the room layer so individual games cannot auto-skip or forfeit a
        // player during the reconnect test.
        this.disconnectedPlayers = new Map();
        this.studyControl = new Map();
        this.studyPhase = null;
        this.studySetupSelection = new Map();
    }

    _refreshStudyLimits() {
        if (!this.studyModeSupported) return;
        if (this.gameOptions.gameMode === 'study') {
            this.minPlayers = 1;
            this.maxPlayers = 1;
            this.targetPlayers = 1;
        } else {
            this.minPlayers = this.baseMinPlayers;
            this.maxPlayers = this.baseMaxPlayers;
            if (!this.allowedPlayerCounts.length) this.targetPlayers = null;
        }
    }

    addPlayer(player) {
        if (this.configurationRequired && !this.configurationConfirmed && player.id !== this.hostId) {
            return { success: false, message: '房主尚未确认房间设置' };
        }
        if (this.players.length >= this.maxPlayers) {
            return { success: false, message: '\u623f\u95f4\u5df2\u6ee1' };
        }
        if (this.players.find(p => p.id === player.id)) {
            return { success: false, message: '\u4f60\u5df2\u7ecf\u5728\u8fd9\u4e2a\u623f\u95f4\u4e2d' };
        }
        if (this.status === 'playing') {
            return { success: false, message: '\u6e38\u620f\u5df2\u5f00\u59cb\uff0c\u65e0\u6cd5\u52a0\u5165' };
        }
        const occupiedSeats = new Set(this.players.map(item => item.seatIndex));
        let seatIndex = 0;
        while (occupiedSeats.has(seatIndex)) seatIndex += 1;
        if (seatIndex >= this.maxPlayers) {
            return { success: false, message: '\u623f\u95f4\u5df2\u6ee1' };
        }
        // Everyone enters the room ready. The host is never part of the
        // readiness quorum, but keeping a true value on the host makes the
        // public player snapshot easy for clients to render consistently.
        const seatedPlayer = { ...player, seatIndex, ready: true };
        this.players.push(seatedPlayer);
        return { success: true, message: '\u52a0\u5165\u6210\u529f', seatIndex };
    }

    _settingDefinition(key) {
        return this.roomSettingDefinitions.find(definition => definition.key === key) || null;
    }

    _validateRoomSettings(settings) {
        const source = settings && typeof settings === 'object' ? settings : {};
        const entries = Object.entries(source).filter(([, value]) => value !== undefined);
        if (!entries.length) return { success: false, message: '没有可更新的房间设置' };
        const normalized = {};
        for (const [key, value] of entries) {
            const definition = this._settingDefinition(key);
            if (!definition) return { success: false, message: `不支持房间设置“${key}”` };
            if (definition.kind === 'toggle') {
                if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
                    return { success: false, message: `${definition.label}的值无效` };
                }
                normalized[key] = value === true || value === 'true';
                continue;
            }
            const option = definition.options.find(item => String(item.value) === String(value));
            if (!option) return { success: false, message: `请选择有效的${definition.label}` };
            normalized[key] = option.value;
        }
        if (normalized.gameMode !== undefined && this.studyModeSupported) {
            const value = String(normalized.gameMode);
            if (!['match', 'study'].includes(value)) return { success: false, message: '请选择有效的游戏模式' };
            if (value === 'study' && this.players.length > 1) return { success: false, message: '摆谱模式只需要房主一人，请先移出其他玩家' };
            normalized.gameMode = value;
        }
        if (normalized.playerCount !== undefined) {
            const target = Number(normalized.playerCount);
            if (!this.allowedPlayerCounts.includes(target)) {
                return { success: false, message: `人数只能选择 ${this.allowedPlayerCounts.join(' 或 ')} 人` };
            }
            if (this.players.length > target) {
                return { success: false, message: `当前已有 ${this.players.length} 人，无法设置为 ${target} 人` };
            }
            normalized.playerCount = target;
        }
        return { success: true, settings: normalized };
    }

    _applyRoomSettings(settings) {
        for (const [key, value] of Object.entries(settings)) {
            if (key === 'playerCount') this._setPlayerCount(value);
            else if (key === 'encryptorMode') this._setEncryptorMode(value);
            else this.gameOptions[key] = value;
        }
        this._refreshStudyLimits();
        this._refreshConfiguration();
    }

    _setPlayerCount(playerCount) {
        const target = Number(playerCount);
        if (!this.allowedPlayerCounts.includes(target)) {
            return { success: false, message: `人数只能选择 ${this.allowedPlayerCounts.join(' 或 ')} 人` };
        }
        if (this.players.length > target) {
            return { success: false, message: `当前已有 ${this.players.length} 人，无法设置为 ${target} 人` };
        }
        this.targetPlayers = target;
        this.minPlayers = target;
        this.maxPlayers = target;
        this.gameOptions.playerCount = target;
        this._refreshConfiguration();
        return { success: true, message: `已确认 ${target} 人房间` };
    }

    _setEncryptorMode(mode) {
        const value = String(mode || '');
        if (!this.allowedEncryptorModes.includes(value)) return { success: false, message: '请选择有效的加密员产生方式' };
        this.gameOptions.encryptorMode = value;
        this._refreshConfiguration();
        const labels = { fixed_vote: '固定投票', rotation: '轮流', random: '每轮随机' };
        return { success: true, message: `已选择“${labels[value] || value}”加密员规则` };
    }

    _refreshConfiguration() {
        const playerCountReady = !this.allowedPlayerCounts.length || this.targetPlayers != null;
        const encryptorModeReady = !this.allowedEncryptorModes.length || this.allowedEncryptorModes.includes(this.gameOptions.encryptorMode);
        this.configurationConfirmed = playerCountReady && encryptorModeReady;
    }

    configure(playerId, options = {}) {
        if (!this.configurationRequired) return { success: false, message: '该游戏无需额外设置' };
        if (playerId !== this.hostId) return { success: false, message: '只有房主可以确认房间设置' };
        if (this.status !== 'waiting') return { success: false, message: '游戏已开始，无法修改设置' };
        if (this.configurationConfirmed) return { success: false, message: '房间设置已经确认' };
        const settings = { ...(options.settings && typeof options.settings === 'object' ? options.settings : {}) };
        for (const key of ['playerCount', 'encryptorMode', ...this.roomSettingDefinitions.map(definition => definition.key)]) {
            if (options[key] !== undefined) settings[key] = options[key];
        }
        if (this.allowedPlayerCounts.length && settings.playerCount === undefined) return { success: false, message: '缺少房间人数设置' };
        if (this.allowedEncryptorModes.length && settings.encryptorMode === undefined) return { success: false, message: '缺少加密员产生方式设置' };
        const validation = this._validateRoomSettings(settings);
        if (!validation.success) return validation;
        this._applyRoomSettings(validation.settings);
        return { success: true, message: '房间设置已确认' };
    }

    updateSettings(playerId, settings = {}) {
        if (playerId !== this.hostId) return { success: false, message: '只有房主可以修改房间设置' };
        if (this.status !== 'waiting') return { success: false, message: '游戏已开始，无法修改设置' };
        if (this.configurationRequired && !this.configurationConfirmed) return { success: false, message: '请先确认初始房间设置' };
        const validation = this._validateRoomSettings(settings);
        if (!validation.success) return validation;
        this._applyRoomSettings(validation.settings);
        this.players.forEach(player => { player.ready = player.id === this.hostId; });
        return { success: true, message: '房间设置已更新，成员需要重新准备', settings: { ...this.gameOptions } };
    }

    setPlayerReady(playerId, ready) {
        if (this.status !== 'waiting') return { success: false, message: '游戏已开始，无法修改准备状态' };
        const player = this.players.find(item => item.id === playerId);
        if (!player) return { success: false, message: '玩家不存在' };
        if (player.id === this.hostId) return { success: false, message: '房主无需准备' };
        if (player.connected === false) return { success: false, message: '断线玩家不能准备' };
        player.ready = Boolean(ready);
        const connectedPlayers = this.players.filter(item => item.connected !== false && item.id !== this.hostId);
        return {
            success: true,
            player,
            readyCount: connectedPlayers.filter(item => item.ready === true).length,
            totalCount: connectedPlayers.length,
        };
    }

    isListed() {
        return this.configurationConfirmed && this.isPublic && this.status === 'waiting';
    }

    removePlayer(playerId) {
        const index = this.players.findIndex(p => p.id === playerId);
        if (index === -1) return null;

        const removed = this.players.splice(index, 1)[0];
        this.disconnectedPlayers.delete(playerId);
        if (this.hostId === playerId && this.players.length > 0) {
            this.hostId = this.players[0].id;
            this.players[0].ready = true;
        }
        if (this.players.length === 0) {
            this.status = 'ended';
        }
        return removed;
    }

    getPlayerInfo() {
        return [...this.players].sort((a, b) => a.seatIndex - b.seatIndex).map(p => ({
            id: p.id,
            name: p.name,
            isHost: p.id === this.hostId,
            seatIndex: p.seatIndex,
            isOnline: p.connected !== false,
            ready: p.ready === true,
        }));
    }

    getConnectionState() {
        const disconnected = [...this.disconnectedPlayers.values()].map(player => ({
            id: player.id,
            name: player.name,
            since: player.since,
        }));
        return {
            paused: disconnected.length > 0,
            disconnected,
        };
    }

    markPlayerDisconnected(playerId) {
        const player = this.players.find(item => item.id === playerId);
        if (!player) return { success: false, message: '玩家不存在' };
        player.connected = false;
        if (this.status === 'playing') {
            this.disconnectedPlayers.set(playerId, { id: player.id, name: player.name, since: Date.now() });
        }
        return { success: true, player };
    }

    markPlayerReconnected(playerId) {
        const player = this.players.find(item => item.id === playerId);
        if (!player) return { success: false, message: '玩家不存在' };
        player.connected = true;
        this.disconnectedPlayers.delete(playerId);
        return { success: true, player, connectionState: this.getConnectionState() };
    }

    getInfo() {
        return {
            id: this.id,
            gameType: this.gameType,
            gameName: this.gameName,
            roomName: this.roomName,
            isPublic: this.isPublic,
            gameOptions: { ...this.gameOptions },
            hostId: this.hostId,
            status: this.status,
            playerCount: this.players.length,
            connectedPlayerCount: this.players.filter(player => player.connected !== false).length,
            minPlayers: this.minPlayers,
            maxPlayers: this.maxPlayers,
            baseMinPlayers: this.baseMinPlayers,
            baseMaxPlayers: this.baseMaxPlayers,
            studyModeSupported: this.studyModeSupported,
            studyMode: this.studyModeSupported && this.gameOptions.gameMode === 'study',
            targetPlayers: this.targetPlayers,
            allowedPlayerCounts: this.allowedPlayerCounts.slice(),
            allowedEncryptorModes: this.allowedEncryptorModes.slice(),
            roomSettings: this.roomSettingDefinitions.map(definition => ({
                ...definition,
                options: definition.options.map(option => ({ ...option })),
            })),
            readyCheckEnabled: this.readyCheckEnabled,
            configurationRequired: this.configurationRequired,
            configurationConfirmed: this.configurationConfirmed,
            connectionState: this.getConnectionState(),
            players: this.getPlayerInfo(),
            createdAt: this.createdAt,
        };
    }

    startGame() {
        if (this.status === 'playing') {
            return { success: false, message: '\u6e38\u620f\u5df2\u5f00\u59cb' };
        }
        if (this.configurationRequired && !this.configurationConfirmed) {
            return { success: false, message: this.allowedPlayerCounts.length ? '请先确认房间人数' : '请先确认房间设置' };
        }
        const connectedPlayers = this.players.filter(player => player.connected !== false);
        if (this.targetPlayers && connectedPlayers.length !== this.targetPlayers) {
            return { success: false, message: `需要 ${this.targetPlayers} 名玩家全部到齐才能开始（当前 ${connectedPlayers.length}/${this.targetPlayers}）` };
        }
        if (connectedPlayers.length < this.minPlayers) {
            return { success: false, message: `\u81f3\u5c11\u9700\u8981 ${this.minPlayers} \u540d\u73a9\u5bb6` };
        }
        if (connectedPlayers.length > this.maxPlayers) {
            return { success: false, message: `\u6700\u591a\u652f\u6301 ${this.maxPlayers} \u540d\u73a9\u5bb6` };
        }

        if (this.readyCheckEnabled) {
            const requiredPlayers = connectedPlayers.filter(player => player.id !== this.hostId);
            const unreadyPlayers = requiredPlayers.filter(player => player.ready !== true);
            if (unreadyPlayers.length) {
                return { success: false, message: `请等待所有成员准备（已准备 ${requiredPlayers.length - unreadyPlayers.length}/${requiredPlayers.length}）` };
            }
        }

        try {
            // The optional third argument lets games with an inter-round
            // pause authorize the room host without changing older adapters.
            const seatedPlayers = [...this.players].sort((a, b) => a.seatIndex - b.seatIndex);
            const enginePlayers = this._enginePlayersForStart(seatedPlayers);
            this.game = this.gameModule.create(this.id, enginePlayers, this.hostId, this.gameOptions);
            const result = this.game.start();
            if (!result.success) return result;
            if (this.studyModeSupported && this.gameOptions.gameMode === 'study') {
                this.studyControl.set(this.hostId, 0);
                // Junqi already has a server-validated hidden-piece setup
                // phase.  The other study boards enter a lightweight editor
                // before normal rules are enabled.
                this.studyPhase = this.gameType === 'junqi' ? 'engine-setup' : 'setup';
            }
            this.status = 'playing';
            if (this.studyModeSupported && this.gameOptions.gameMode === 'study') return { ...result, state: this.getPlayerGameState(this.hostId) };
            return result;
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    handleGameAction(playerId, action) {
        if (!this.game) {
            return { success: false, message: '\u6e38\u620f\u672a\u5f00\u59cb' };
        }
        // Perspective changes are read-only and remain available after a
        // study table reaches a terminal position, so the author can inspect
        // the final board from either side.
        if (this.studyModeSupported && this.gameOptions.gameMode === 'study'
            && (action?.kind === 'studySwitchSeat' || action?.kind === 'switchPerspective')) {
            return this._switchStudySeat(playerId, action);
        }
        if (this.status !== 'playing') return { success: false, message: '\u6e38\u620f\u5df2结束' };
        if (this.disconnectedPlayers.size) {
            const names = [...this.disconnectedPlayers.values()].map(player => player.name).join('、');
            return { success: false, message: `${names} 已断线，游戏暂时暂停，等待重连` };
        }

        if (this.studyModeSupported && this.gameOptions.gameMode === 'study') {
            const enginePlayerId = this._studyEnginePlayerId(playerId);
            if (!enginePlayerId) return { success: false, message: '研究执棋方尚未准备好' };
            if (this.studyPhase === 'setup' && action?.kind === 'studyConfirmSetup') {
                const selected = this._studyPlayers()[Number(this.studyControl.get(playerId) ?? 0)];
                if (selected && typeof this.game.handleStudySetup === 'function') {
                    const turnResult = this.game.handleStudySetup(enginePlayerId, { kind: 'setTurn', color: selected.color });
                    if (!turnResult.success) return turnResult;
                }
                this.studyPhase = 'play';
                return { success: true, message: '摆棋完成，可以开始推演', state: this.getPlayerGameState(playerId), action: { kind: 'studyConfirmSetup' } };
            }
            if (this.studyPhase === 'setup') {
                if (this.gameType === 'checkers' && action?.kind === 'selectPiece') {
                    this.studySetupSelection.set(playerId, String(action.pieceId || ''));
                    return { success: true, message: '已选中棋子', state: this.getPlayerGameState(playerId), action: { kind: 'studySelectPiece', pieceId: String(action.pieceId || '') } };
                }
                if (this.gameType === 'checkers' && action?.kind === 'movePiece') {
                    const selectedId = this.studySetupSelection.get(playerId);
                    const selected = this.getPlayerGameState(playerId)?.pieces?.find(piece => piece.id === selectedId);
                    if (!selected) return { success: false, message: '请先选择要摆放的棋子', state: this.getPlayerGameState(playerId) };
                    this.studySetupSelection.delete(playerId);
                    action = { kind: 'move', from: { x: selected.x, y: selected.y }, to: action.to || { x: action.x, y: action.y } };
                }
                const setupResult = this._handleStudySetup(enginePlayerId, action, playerId);
                if (setupResult) {
                    if (setupResult.success && setupResult.state) setupResult.state = this.getPlayerGameState(playerId);
                    return setupResult;
                }
            }
            const result = this.game.handleAction(enginePlayerId, action);
            if (this.gameType === 'junqi' && result?.success && result.state?.phase === 'play') this.studyPhase = 'play';
            if (result?.success && result.state) result.state = this.getPlayerGameState(playerId);
            return this._finishGameAction(result);
        }
        const result = this.game.handleAction(playerId, action);
        return this._finishGameAction(result);
    }

    _finishGameAction(result) {
        if (result.success && result.ended) {
            this.status = 'ended';
        }
        return result;
    }

    _enginePlayersForStart(seatedPlayers) {
        if (!(this.studyModeSupported && this.gameOptions.gameMode === 'study')) return seatedPlayers;
        const count = Number(this.gameModule.metadata.studyPlayerCount || this.gameModule.metadata.minPlayers || 2);
        const players = seatedPlayers.slice(0, count);
        const names = this.gameModule.metadata.studySeatNames || [];
        for (let index = players.length; index < count; index += 1) {
            players.push({
                id: `study-${this.id}-${index + 1}`,
                name: names[index] || `研究方 ${index + 1}`,
                seatIndex: index,
                connected: true,
            });
        }
        return players;
    }

    _studyPlayers() {
        return this.game?.engine?.players || [];
    }

    _studyEnginePlayerId(playerId) {
        const players = this._studyPlayers();
        const index = Number(this.studyControl.get(playerId) ?? 0);
        return players[index]?.id || null;
    }

    _studyViewerForEngine(enginePlayerId) {
        for (const [viewerId] of this.studyControl) if (this._studyEnginePlayerId(viewerId) === enginePlayerId) return viewerId;
        return this.hostId;
    }

    _switchStudySeat(playerId, action = {}) {
        const players = this._studyPlayers();
        if (!players.length) return { success: false, message: '研究棋局尚未准备好' };
        let index = Number.isInteger(action.seatIndex) ? action.seatIndex : NaN;
        if (!Number.isInteger(index) && action.color) index = players.findIndex(player => player.color === action.color);
        if (!Number.isInteger(index)) {
            const current = Number(this.studyControl.get(playerId) ?? 0);
            index = (current + 1) % players.length;
        }
        if (index < 0 || index >= players.length) return { success: false, message: '研究阵营不存在' };
        this.studyControl.set(playerId, index);
        const selected = players[index];
        const side = studySideLabel(this.gameType, selected.color, selected.name);
        return {
            success: true,
            message: `已切换到${side}`,
            state: this.getPlayerGameState(playerId),
            action: { kind: 'studySwitchSeat', seatIndex: index, color: selected.color, side, playerName: selected.name },
        };
    }

    _handleStudySetup(enginePlayerId, action = {}, viewerId) {
        if (!action || typeof action !== 'object') return null;
        if (action.kind === 'studySetup') action = { ...action, kind: action.op || action.operation };
        if (!['move', 'place', 'remove', 'clear', 'reset', 'setTurn'].includes(action.kind)) return null;
        if (typeof this.game.handleStudySetup !== 'function') {
            return { success: false, message: `${this.gameName} 的摆棋编辑器尚未支持该操作`, state: this.getPlayerGameState(viewerId) };
        }
        // A study action is routed to the currently selected virtual seat.
        // Do not let a crafted payload place or move the other side without
        // switching perspective first.
        const enginePlayer = this._studyPlayers().find(player => player.id === enginePlayerId);
        if (enginePlayer && (action.kind === 'place' || action.kind === 'move')) action = { ...action, color: enginePlayer.color };
        return this.game.handleStudySetup(enginePlayerId, action);
    }

    _applyStudySetupActions(state, enginePlayerId) {
        if (!state || this.studyPhase !== 'setup') return;
        state.myIsCurrentTurn = true;
        state.availableActions = { canMove: true, canPlace: true, canSetup: true };
        const player = state.players?.find(item => item.id === enginePlayerId);
        if (!player) return;
        const pieces = state.pieces || [];
        const empty = [];
        const board = state.rules?.board || {};
        const dimensions = {
            chess: [8, 8],
            xiangqi: [9, 10],
            jungle: [7, 9],
            gobang: [15, 15],
        }[this.gameType] || [Number(board.width || 0), Number(board.height || 0)];
        const width = Number(board.width || dimensions[0] || 0);
        const height = Number(board.height || dimensions[1] || 0);
        if (width && height) for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) if (!pieces.some(piece => piece.x === x && piece.y === y)) empty.push({ x, y });
        if (this.gameType === 'gobang') {
            state.legalMoves = { place: empty };
            return;
        }
        if (this.gameType === 'checkers') {
            const grid = [];
            for (let y = 0; y <= 16; y += 1) for (let x = 0; x <= 24; x += 1) if (!pieces.some(piece => piece.x === x && piece.y === y)) grid.push({ x, y });
            const own = pieces.filter(piece => piece.color === player.color);
            const viewerId = this._studyViewerForEngine(enginePlayerId);
            const selectedId = this.studySetupSelection.get(viewerId);
            state.legalMoves = { select: own.map(piece => piece.id), step: grid, jump: [] };
            const selected = own.find(piece => piece.id === selectedId);
            state.selectedPiece = selected ? { pieceId: selected.id, x: selected.x, y: selected.y, current: { x: selected.x, y: selected.y } } : null;
            return;
        }
        const own = pieces.filter(piece => piece.color === player.color);
        const targets = empty;
        state.legalMoves = Object.fromEntries(own.map(piece => [piece.id, targets.map(target => ({ ...target }))]));
    }

    handleSystemTick() {
        if (this.status !== 'playing' || this.disconnectedPlayers.size || !this.game?.handleSystemTick) return null;
        const result = this.game.handleSystemTick();
        if (result?.success && result.ended) this.status = 'ended';
        return result;
    }

    getPlayerGameState(playerId) {
        if (!this.game) {
            return null;
        }
        const enginePlayerId = this.studyModeSupported && this.gameOptions.gameMode === 'study'
            ? this._studyEnginePlayerId(playerId)
            : playerId;
        const state = this.game.getPlayerState(enginePlayerId || playerId);
        if (!state) return state;
        if (this.studyModeSupported && this.gameOptions.gameMode === 'study') {
            const players = this._studyPlayers();
            const seatIndex = Number(this.studyControl.get(playerId) ?? 0);
            state.studyMode = true;
            state.studyViewerId = playerId;
            state.studySeatIndex = seatIndex;
            state.studySeatCount = players.length;
            state.studySeatNames = players.map(player => ({ id: player.id, name: player.name, color: player.color, seatIndex: players.indexOf(player) }));
            state.studyPhase = this.gameType === 'junqi'
                ? (state.phase === 'setup' ? 'setup' : 'play')
                : this.studyPhase || 'play';
            this._applyStudySetupActions(state, enginePlayerId);
        }
        return { ...state, roomConnection: this.getConnectionState() };
    }

    getPlayerGameAction(action, playerId) {
        if (!this.game || !this.game.getPlayerAction) return action;
        return this.game.getPlayerAction(action, playerId);
    }

    getWinner() {
        return this.game ? this.game.getWinner() : null;
    }
}

module.exports = Room;
