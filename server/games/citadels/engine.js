// 富饶之城（Citadels）经典基础版 —— 按官方规则实现
// 参考：官方经典版规则书（Hans im Glück 2000 / FFG 2003，8 基础角色 + 67 张官方城区牌）
const COLORS = ['yellow', 'blue', 'green', 'red', 'purple'];
const ROLES = [
    { id: 'assassin', rank: 1, name: '刺客', color: null },
    { id: 'thief', rank: 2, name: '盗贼', color: null },
    { id: 'magician', rank: 3, name: '魔术师', color: null },
    { id: 'king', rank: 4, name: '国王', color: 'yellow' },
    { id: 'bishop', rank: 5, name: '主教', color: 'blue' },
    { id: 'merchant', rank: 6, name: '商人', color: 'green' },
    { id: 'architect', rank: 7, name: '建筑师', color: null },
    { id: 'warlord', rank: 8, name: '军阀', color: 'red' },
];
// 官方经典版城区牌：54 张四色常规区 + 13 张紫色独特区 = 67 张
// 字段：id, name(中文), color, cost, count, points(可选，默认=cost), effect(可选)
const DISTRICT_TYPES = [
    // 贵族区（黄色）12 张
    { id: 'manor', name: '庄园', color: 'yellow', cost: 3, count: 5 },
    { id: 'castle', name: '城堡', color: 'yellow', cost: 4, count: 4 },
    { id: 'palace', name: '宫殿', color: 'yellow', cost: 5, count: 3 },
    // 宗教区（蓝色）11 张
    { id: 'temple', name: '神庙', color: 'blue', cost: 1, count: 3 },
    { id: 'church', name: '教堂', color: 'blue', cost: 2, count: 3 },
    { id: 'monastery', name: '修道院', color: 'blue', cost: 3, count: 3 },
    { id: 'cathedral', name: '大教堂', color: 'blue', cost: 5, count: 2 },
    // 商业区（绿色）20 张
    { id: 'tavern', name: '酒馆', color: 'green', cost: 1, count: 5 },
    { id: 'market', name: '集市', color: 'green', cost: 2, count: 4 },
    { id: 'tradingpost', name: '商栈', color: 'green', cost: 2, count: 3 },
    { id: 'docks', name: '船坞', color: 'green', cost: 3, count: 3 },
    { id: 'harbor', name: '港口', color: 'green', cost: 4, count: 3 },
    { id: 'townhall', name: '市政厅', color: 'green', cost: 5, count: 2 },
    // 军事区（红色）11 张
    { id: 'watchtower', name: '瞭望塔', color: 'red', cost: 1, count: 3 },
    { id: 'prison', name: '监狱', color: 'red', cost: 2, count: 3 },
    { id: 'battlefield', name: '战场', color: 'red', cost: 3, count: 3 },
    { id: 'fortress', name: '要塞', color: 'red', cost: 5, count: 2 },
    // 独特区（紫色）13 张
    { id: 'haunted-city', name: '鬼城', color: 'purple', cost: 2, count: 1, effect: 'hauntedCity' },
    { id: 'keep', name: '堡垒', color: 'purple', cost: 3, count: 1, effect: 'keep' },
    { id: 'imperial-treasury', name: '帝国宝库', color: 'purple', cost: 4, count: 1, effect: 'imperialTreasury' },
    { id: 'map-room', name: '地图室', color: 'purple', cost: 5, count: 1, effect: 'mapRoom' },
    { id: 'laboratory', name: '实验室', color: 'purple', cost: 5, count: 1, effect: 'laboratory' },
    { id: 'observatory', name: '天文台', color: 'purple', cost: 5, count: 1, effect: 'observatory' },
    { id: 'smithy', name: '铁匠铺', color: 'purple', cost: 5, count: 1, effect: 'smithy' },
    { id: 'graveyard', name: '墓地', color: 'purple', cost: 5, count: 1, effect: 'graveyard' },
    { id: 'library', name: '图书馆', color: 'purple', cost: 6, count: 1, effect: 'library' },
    { id: 'school-of-magic', name: '魔法学院', color: 'purple', cost: 6, count: 1, effect: 'schoolOfMagic' },
    { id: 'university', name: '大学', color: 'purple', cost: 6, count: 1, points: 8 },
    { id: 'dragon-gate', name: '巨龙门', color: 'purple', cost: 6, count: 1, points: 8 },
    { id: 'great-wall', name: '长城', color: 'purple', cost: 6, count: 1, effect: 'greatWall' },
];
const EFFECT_NAMES = {
    hauntedCity: '计分时可视为任意一种颜色（终局轮建成的除外）',
    keep: '军阀无法摧毁本区',
    imperialTreasury: '终局每持有 1 枚金币 +1 分',
    mapRoom: '终局每持有 1 张手牌 +1 分',
    laboratory: '每回合一次：弃 1 张手牌换 1 枚金币',
    observatory: '回合开始摸牌时摸 3 张保留 1 张',
    smithy: '每回合一次：支付 3 金摸 2 张城区牌',
    graveyard: '城区被军阀摧毁时，可付 1 金收回手牌（不能救墓地本身）',
    library: '回合开始摸牌时保留两张',
    schoolOfMagic: '计算金币收入时可视为任意颜色',
    greatWall: '军阀摧毁你的城区需多付 1 枚金币',
};

function shuffle(values, random = Math.random) {
    const source = typeof random === 'function' ? random : Math.random;
    for (let i = values.length - 1; i > 0; i -= 1) {
        const j = Math.floor(source() * (i + 1));
        [values[i], values[j]] = [values[j], values[i]];
    }
    return values;
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

class CitadelsEngine {
    constructor(roomId, players, random = Math.random) {
        this.roomId = roomId;
        this.random = typeof random === 'function' ? random : Math.random;
        this.players = players.map(player => ({ id: player.id, name: player.name, gold: 2, hand: [], city: [], roles: [], revealedRoles: [], murdered: false, isOnline: true }));
        this.playerMap = Object.fromEntries(this.players.map(player => [player.id, player]));
        this.status = 'waiting';
        this.phase = 'role_selection';
        this.round = 0;
        this.crownHolderId = this.players[0]?.id || null;
        this.roleDeck = [];
        this.faceUpRoles = [];
        this.faceDownRoles = [];
        this.draftSteps = [];
        this.draftIndex = 0;
        this.draftDiscarding = false;
        this.discardOptions = [];
        this.selectedRoles = {};
        this.killedRole = null;
        this.pendingRobRole = null;
        this.currentRoleRank = null;
        this.currentPlayerId = null;
        this.turn = null;
        this.drawOptions = {};
        this.drawKeepCount = {};
        this.pendingGraveyard = null;
        this.drawPile = [];
        this.endRoundRequested = false;
        this.finalRound = 0;
        this.firstFinisherId = null;
        this.lastAction = null;
        this.actionLog = [];
        this.winner = null;
        this.winners = [];
        this.scores = [];
        this.presentationSequence = 0;
        this.transactionSequence = 0;
        this.eventSequence = 0;
        this.presentation = null;
    }

    static buildDistrictDeck(random = Math.random) {
        const deck = [];
        let index = 0;
        for (const type of DISTRICT_TYPES) {
            for (let i = 0; i < type.count; i += 1) {
                index += 1;
                deck.push({ id: `district-${type.id}-${index}`, name: type.name, color: type.color, cost: type.cost, points: type.points || type.cost, effect: type.effect || null });
            }
        }
        return shuffle(deck, random);
    }

    start() {
        if (this.status !== 'waiting') return { success: false, message: '游戏已经开始或已经结束' };
        if (this.players.length < 2 || this.players.length > 7) return { success: false, message: '富饶之城经典基础版支持 2–7 名玩家' };
        this.status = 'playing';
        this.drawPile = CitadelsEngine.buildDistrictDeck(this.random);
        this.players.forEach(player => { player.hand = this._draw(4); });
        this.round = 1;
        this._prepareRoleDraft();
        return this._success('富饶之城开始');
    }

    _shuffle(values) { return shuffle(values, this.random); }
    _draw(count) { const cards = []; while (cards.length < count && this.drawPile.length) cards.push(this.drawPile.pop()); return cards; }
    _role(id) { return ROLES.find(role => role.id === id) || null; }
    _player(id) { return this.playerMap[id] || null; }
    _roleName(id) { return this._role(id)?.name || id; }
    _publicRole(id) { const role = this._role(id); return role ? { ...role } : null; }
    _publicCard(card) { return card ? { ...card } : null; }
    _orderFrom(id) {
        const start = Math.max(0, this.players.findIndex(player => player.id === id));
        return this.players.slice(start).concat(this.players.slice(0, start)).map(player => player.id);
    }

    // ============ 选角阶段 ============
    _prepareRoleDraft() {
        this.phase = 'role_selection';
        this.selectedRoles = {};
        this.killedRole = null;
        this.pendingRobRole = null;
        this.currentRoleRank = null;
        this.currentPlayerId = null;
        this.turn = null;
        this.drawOptions = {};
        this.drawKeepCount = {};
        this.pendingGraveyard = null;
        this.players.forEach(player => { player.roles = []; player.revealedRoles = []; player.murdered = false; });
        this.roleDeck = this._shuffle(ROLES.map(role => role.id));
        this.faceUpRoles = [];
        this.faceDownRoles = [];
        // 第一步：先暗置 1 张角色牌（所有人数都一样）
        this.faceDownRoles.push(this.roleDeck.pop());
        // 第二步：按人数明置若干张（国王不能被明置）
        const faceUpCount = { 4: 2, 5: 1, 6: 0, 7: 0 }[this.players.length] || 0;
        for (let i = 0; i < faceUpCount; i += 1) {
            const card = this.roleDeck.pop();
            if (card === 'king') {
                const replacement = this.roleDeck.pop();
                this.faceUpRoles.push(replacement);
                this.roleDeck = this._shuffle(this.roleDeck.concat(card)); // 国王必须洗回角色牌堆
            } else {
                this.faceUpRoles.push(card);
            }
        }
        this.draftSteps = this._buildDraftSteps();
        this.draftIndex = 0;
        this.draftDiscarding = false;
        this.discardOptions = [];
        const crownName = this._player(this.crownHolderId)?.name || '玩家';
        this.actionLog.push(`第 ${this.round} 轮：${crownName} 持有皇冠，开始秘密选角`);
        if (this.faceUpRoles.length) this.actionLog.push(`本轮明置角色：${this.faceUpRoles.map(id => this._roleName(id)).join('、')}`);
        this._appendPresentationEvent(this._player(this.crownHolderId), 'roleDraftStart', {
            round: this.round,
            crownHolderId: this.crownHolderId,
            crownHolderName: crownName,
            faceUpRoles: this.faceUpRoles.map(id => this._publicRole(id)),
        });
    }

    _buildDraftSteps() {
        const n = this.players.length;
        const order = this._orderFrom(this.crownHolderId);
        const steps = [];
        if (n === 2) {
            // 2 人：每人两个角色，A(王冠) 先暗置 1 张后依次 A→B→A→B
            steps.push({ playerId: order[0] });
            steps.push({ playerId: order[1], discardChoice: true });
            steps.push({ playerId: order[0], discardChoice: true });
            steps.push({ playerId: order[1], discardLast: true });
        } else if (n === 3) {
            // 3 人：每人两个角色，王冠暗置 1 张后按座位循环 6 次
            for (let i = 0; i < 6; i += 1) {
                steps.push({ playerId: order[i % 3], discardLast: i === 5 });
            }
        } else {
            // 4–7 人：每人一个角色
            for (let i = 0; i < n; i += 1) {
                steps.push({ playerId: order[i], discardLast: i === n - 1, useFaceDown: n === 7 && i === n - 1 });
            }
        }
        return steps;
    }

    _draftOptions(playerId) {
        if (this.phase !== 'role_selection') return [];
        if (this.draftDiscarding) {
            if (this.draftSteps[this.draftIndex]?.playerId !== playerId) return [];
            return this.discardOptions.slice();
        }
        const step = this.draftSteps[this.draftIndex];
        if (!step || step.playerId !== playerId) return [];
        const options = this.roleDeck.slice();
        if (step.useFaceDown) options.push(...this.faceDownRoles);
        return options;
    }

    _advanceDraft() {
        const step = this.draftSteps[this.draftIndex];
        if (!step) {
            // 选角结束：剩余牌全部暗置
            this.faceDownRoles.push(...this.roleDeck);
            this.roleDeck = [];
            this.phase = 'character_turn';
            this.currentRoleRank = 1;
            this._appendPresentationEvent(null, 'roleSummoningStart', { round: this.round });
            this._advanceCharacter();
            return;
        }
        this.draftDiscarding = false;
        this.discardOptions = [];
    }

    _afterDraftPick(playerId, roleId) {
        const step = this.draftSteps[this.draftIndex];
        const player = this._player(playerId);
        player.roles.push(this._role(roleId));
        this.selectedRoles[roleId] = playerId;
        this.actionLog.push(`${player.name} 秘密选择了一个角色`);
        if (step.discardChoice) {
            // 2 人局：还要再选一张暗置弃掉
            this.draftDiscarding = true;
            this.discardOptions = this.roleDeck.slice();
            return;
        }
        if (step.discardLast) {
            this.faceDownRoles.push(...this.roleDeck);
            this.roleDeck = [];
        }
        this.draftIndex += 1;
        this._advanceDraft();
    }

    _draft(playerId, action) {
        if (this.draftDiscarding) {
            const step = this.draftSteps[this.draftIndex];
            if (!step || step.playerId !== playerId) return { success: false, message: '还没轮到你操作', state: this.getPlayerState(playerId) };
            if (action.kind !== 'discardRole' || !this.discardOptions.includes(action.roleId)) return { success: false, message: '请选择要暗置弃掉的角色', state: this.getPlayerState(playerId) };
            this.roleDeck = this.roleDeck.filter(id => id !== action.roleId);
            this.faceDownRoles.push(action.roleId);
            this.draftDiscarding = false;
            this.discardOptions = [];
            this.actionLog.push(`${this._player(playerId).name} 暗置弃掉了一张角色牌`);
            this._startPresentation(this._player(playerId), 'roleDraftProgress', {
                action: 'discard',
                selectedCount: Object.keys(this.selectedRoles).length,
                remainingCount: Math.max(0, this.roleDeck.length),
            });
            this.draftIndex += 1;
            this._advanceDraft();
            return this._success('角色已暗置弃掉');
        }
        const step = this.draftSteps[this.draftIndex];
        if (!step || step.playerId !== playerId) return { success: false, message: '还没轮到你选择角色', state: this.getPlayerState(playerId) };
        if (action.kind !== 'chooseRole') return { success: false, message: '请选择角色', state: this.getPlayerState(playerId) };
        const options = this._draftOptions(playerId);
        if (!options.includes(action.roleId)) return { success: false, message: '请选择仍然可用的角色', state: this.getPlayerState(playerId) };
        if (this.faceDownRoles.includes(action.roleId)) {
            this.faceDownRoles = this.faceDownRoles.filter(id => id !== action.roleId);
        } else {
            this.roleDeck = this.roleDeck.filter(id => id !== action.roleId);
        }
        this._startPresentation(this._player(playerId), 'roleDraftProgress', {
            action: 'choose',
            selectedCount: Object.keys(this.selectedRoles).length + 1,
            remainingCount: Math.max(0, this.roleDeck.length),
        });
        this._afterDraftPick(playerId, action.roleId);
        return this._success('角色选择完成');
    }

    // ============ 角色行动阶段 ============
    _advanceCharacter() {
        while (this.currentRoleRank <= 8) {
            const roleId = ROLES.find(role => role.rank === this.currentRoleRank)?.id;
            const ownerId = this.selectedRoles[roleId];
            if (!ownerId) {
                this._appendPresentationEvent(null, 'roleUnanswered', { role: this._publicRole(roleId), round: this.round });
                this.currentRoleRank += 1;
                continue;
            }
            const player = this._player(ownerId);
            if (this.killedRole === roleId) {
                player.murdered = true;
                if (!player.revealedRoles.includes(roleId)) player.revealedRoles.push(roleId);
                this.actionLog.push(`${this._roleName(roleId)} 被刺客暗杀，本轮缺席`);
                this._appendPresentationEvent(player, 'assassinationResolved', { role: this._publicRole(roleId) });
                this.currentRoleRank += 1;
                continue;
            }
            if (!player.revealedRoles.includes(roleId)) player.revealedRoles.push(roleId);
            this._appendPresentationEvent(player, 'roleCall', { role: this._publicRole(roleId) });
            // 盗贼：目标角色被呼叫并亮明时，拿走其全部金币
            if (this.pendingRobRole === roleId) {
                const thief = this._player(this.selectedRoles.thief);
                if (thief && thief.id !== player.id) {
                    const amount = player.gold;
                    thief.gold += amount;
                    player.gold = 0;
                    this.actionLog.push(`盗贼取走了 ${player.name} 的全部金币`);
                    this._appendPresentationEvent(thief, 'robberyResolved', {
                        targetPlayerId: player.id,
                        targetPlayerName: player.name,
                        targetRole: this._publicRole(roleId),
                        amount,
                    });
                }
                this.pendingRobRole = null;
            }
            this.currentPlayerId = player.id;
            this.turn = { roleId, incomeTaken: false, incomeCollected: false, merchantBonusCollected: false, architectBonusDrawn: false, built: 0, buildPhaseClosed: false, powerUsed: false, laboratoryUsed: false, smithyUsed: false };
            if (roleId === 'king') {
                this.crownHolderId = player.id;
                this._appendPresentationEvent(player, 'crownAcquired', { role: this._publicRole(roleId), round: this.round });
            }
            this.actionLog.push(`呼叫角色：${this._roleName(roleId)}（${player.name}）`);
            return;
        }
        this._endRound();
    }

    _collectIncome(player, roleId) {
        const role = this._role(roleId);
        let income = 0;
        if (role.color) {
            for (const card of player.city) {
                if (card.color === role.color) income += 1;
                if (card.effect === 'schoolOfMagic') income += 1; // 魔法学院在计算收入时视为任意颜色
            }
        }
        player.gold += income;
        return income;
    }

    _collectArchitectBonus(player) {
        if (this.turn?.roleId !== 'architect' || this.turn.architectBonusDrawn) return 0;
        const drawn = this._draw(2);
        player.hand.push(...drawn);
        this.turn.architectBonusDrawn = true;
        this.actionLog.push(`建筑师完成资源行动，额外摸 ${drawn.length} 张城区牌`);
        return drawn.length;
    }

    _collectMerchantBonus(player) {
        if (this.turn?.roleId !== 'merchant' || this.turn.merchantBonusCollected || !this.turn.incomeTaken) return 0;
        player.gold += 1;
        this.turn.merchantBonusCollected = true;
        return 1;
    }

    _drawKeepCount(player) {
        const hasLibrary = player.city.some(card => card.effect === 'library');
        const hasObservatory = player.city.some(card => card.effect === 'observatory');
        if (hasLibrary && hasObservatory) return { draw: 3, keep: 2 };
        if (hasLibrary) return { draw: 2, keep: 2 };
        if (hasObservatory) return { draw: 3, keep: 1 };
        return { draw: 2, keep: 1 };
    }

    _characterAction(playerId, action) {
        // 墓地的回收反应：由被摧毁城区的主人处理（不要求是当前行动玩家）
        if (this.pendingGraveyard) {
            const owner = this._player(this.pendingGraveyard.ownerId);
            if (playerId !== this.pendingGraveyard.ownerId) return { success: false, message: '等待被摧毁城区的玩家决定是否用墓地回收', state: this.getPlayerState(playerId) };
            if (action.kind === 'graveyardRecover') {
                const target = this.pendingGraveyard.card;
                if (owner.gold < 1) return { success: false, message: '金币不足，无法支付 1 金回收', state: this.getPlayerState(playerId) };
                owner.gold -= 1;
                owner.hand.push(target);
                this.pendingGraveyard = null;
                this._startPresentation(owner, 'graveyardRecovered', { card: this._publicCard(target), cost: 1 });
                return this._success(`墓地支付 1 金，回收了被摧毁的${target.name}`);
            }
            if (action.kind === 'declineGraveyard') {
                const target = this.pendingGraveyard.card;
                this.pendingGraveyard = null;
                this._startPresentation(owner, 'graveyardDeclined', { card: this._publicCard(target) });
                return this._success('放弃用墓地回收城区');
            }
            return { success: false, message: '请选择是否用墓地回收城区', state: this.getPlayerState(playerId) };
        }
        if (playerId !== this.currentPlayerId || !this.turn || this.turn.killed) return { success: false, message: '当前不是你的角色回合', state: this.getPlayerState(playerId) };
        const player = this._player(playerId);
        const role = this._role(this.turn.roleId);

        if (action.kind === 'assassinate') {
            if (role.id !== 'assassin' || this.turn.powerUsed) return { success: false, message: '当前不能使用刺杀', state: this.getPlayerState(playerId) };
            const target = this._role(action.roleId);
            if (!target || target.id === role.id) return { success: false, message: '请选择其他角色', state: this.getPlayerState(playerId) };
            this.killedRole = target.id;
            this.turn.powerUsed = true;
            this._startPresentation(player, 'assassinationDeclared', { targetRole: this._publicRole(target.id) });
            return this._success(`刺客宣布暗杀「${target.name}」`);
        }
        if (action.kind === 'rob') {
            if (role.id !== 'thief' || this.turn.powerUsed) return { success: false, message: '当前不能使用盗窃', state: this.getPlayerState(playerId) };
            const target = this._role(action.roleId);
            if (!target || ['assassin', 'thief'].includes(target.id) || target.id === this.killedRole) return { success: false, message: '盗贼不能选择刺客、自己或被暗杀的角色', state: this.getPlayerState(playerId) };
            this.pendingRobRole = target.id;
            this.turn.powerUsed = true;
            this._startPresentation(player, 'robberyDeclared', { targetRole: this._publicRole(target.id) });
            return this._success(`盗贼决定洗劫「${target.name}」`);
        }
        if (action.kind === 'magicianExchange') {
            if (role.id !== 'magician' || this.turn.powerUsed) return { success: false, message: '当前不能使用交换手牌', state: this.getPlayerState(playerId) };
            const target = this._player(action.targetId);
            if (!target || target.id === playerId) return { success: false, message: '请选择其他玩家交换手牌', state: this.getPlayerState(playerId) };
            const mine = player.hand;
            const mineCount = mine.length;
            const targetCount = target.hand.length;
            player.hand = target.hand;
            target.hand = mine;
            this.turn.powerUsed = true;
            this._startPresentation(player, 'magicianExchange', { targetPlayerId: target.id, targetPlayerName: target.name, actorCardCount: mineCount, targetCardCount: targetCount });
            return this._success(`魔术师与 ${target.name} 交换了全部手牌`);
        }
        if (action.kind === 'magicianSwap') {
            if (role.id !== 'magician' || this.turn.powerUsed) return { success: false, message: '当前不能使用换牌', state: this.getPlayerState(playerId) };
            const cardIds = Array.isArray(action.cardIds) ? action.cardIds : [];
            const handIds = player.hand.map(card => card.id);
            if (!cardIds.every(id => handIds.includes(id)) || new Set(cardIds).size !== cardIds.length) return { success: false, message: '请选择自己手牌中的城区牌', state: this.getPlayerState(playerId) };
            const discarded = player.hand.filter(card => cardIds.includes(card.id));
            player.hand = player.hand.filter(card => !cardIds.includes(card.id));
            this.drawPile.unshift(...discarded); // 弃到牌堆底部
            const drawn = this._draw(discarded.length);
            player.hand.push(...drawn);
            this.turn.powerUsed = true;
            this._startPresentation(player, 'magicianSwap', { discardedCount: discarded.length, drawnCount: drawn.length });
            return this._success(`魔术师弃掉 ${discarded.length} 张手牌并摸回 ${drawn.length} 张`);
        }
        if (action.kind === 'collectIncome') {
            if (this.turn.incomeCollected) return { success: false, message: '本回合已经领取过角色收入', state: this.getPlayerState(playerId) };
            const income = this._collectIncome(player, this.turn.roleId);
            if (this.turn.incomeTaken) this._collectMerchantBonus(player);
            this.turn.incomeCollected = true;
            this._startPresentation(player, 'incomeCollected', { role: this._publicRole(role.id), amount: income, color: role.color });
            return this._success(`${role.name} 领取角色收入 +${income} 金`);
        }
        if (action.kind === 'takeGold') {
            if (this.turn.incomeTaken) return { success: false, message: '本回合已经选择过资源', state: this.getPlayerState(playerId) };
            player.gold += 2;
            this.turn.incomeTaken = true;
            const merchantBonus = this._collectMerchantBonus(player);
            const architectCards = this._collectArchitectBonus(player);
            this._startPresentation(player, 'takeGold', { amount: 2, merchantBonus, architectCards });
            return this._success('获得 2 枚金币');
        }
        if (action.kind === 'drawDistrict') {
            if (this.turn.incomeTaken || this.drawOptions[playerId]) return { success: false, message: '当前不能再摸牌', state: this.getPlayerState(playerId) };
            const plan = this._drawKeepCount(player);
            const cards = this._draw(plan.draw);
            this.turn.incomeTaken = true;
            const merchantBonus = this._collectMerchantBonus(player);
            const architectCards = this._collectArchitectBonus(player);
            if (!cards.length) {
                this._startPresentation(player, 'drawDistrict', { count: 0, keepCount: 0, merchantBonus, architectCards });
                return this._success('城区牌堆已空，本回合没有可摸的牌');
            }
            this.drawOptions[playerId] = cards;
            this.drawKeepCount[playerId] = Math.min(plan.keep, cards.length);
            this._startPresentation(player, 'drawDistrict', { count: cards.length, keepCount: this.drawKeepCount[playerId], merchantBonus, architectCards });
            return this._success(`摸到 ${cards.length} 张城区牌，保留 ${this.drawKeepCount[playerId]} 张`);
        }
        if (action.kind === 'keepDistrict') {
            const options = this.drawOptions[playerId] || [];
            const keepCount = this.drawKeepCount[playerId] || 1;
            const cardIds = Array.isArray(action.cardIds) ? action.cardIds : (action.cardId ? [action.cardId] : []);
            if (cardIds.length !== keepCount || !cardIds.every(id => options.some(card => card.id === id)) || new Set(cardIds).size !== cardIds.length) {
                return { success: false, message: `请选择保留 ${keepCount} 张城区牌`, state: this.getPlayerState(playerId) };
            }
            const kept = options.filter(card => cardIds.includes(card.id));
            const discarded = options.filter(card => !cardIds.includes(card.id));
            player.hand.push(...kept);
            this.drawPile.unshift(...discarded);
            delete this.drawOptions[playerId];
            delete this.drawKeepCount[playerId];
            this._startPresentation(player, 'keepDistrict', { keptCount: kept.length, returnedCount: discarded.length });
            return this._success(`保留了 ${kept.map(card => card.name).join('、')}`);
        }
        if (action.kind === 'buildDistrict') {
            if (!this.turn.incomeTaken || this.drawOptions[playerId] || this.turn.buildPhaseClosed) return { success: false, message: '请先完成回合开始时的资源选择，且建造阶段尚未结束', state: this.getPlayerState(playerId) };
            const limit = role.id === 'architect' ? 3 : 1;
            if (this.turn.built >= limit) return { success: false, message: `本回合最多建造 ${limit} 座城区`, state: this.getPlayerState(playerId) };
            const card = player.hand.find(item => item.id === action.cardId);
            if (!card || player.gold < card.cost || player.city.some(item => item.name === card.name)) return { success: false, message: '金币不足、没有这张牌，或城市中已有同名城区', state: this.getPlayerState(playerId) };
            player.gold -= card.cost;
            player.hand = player.hand.filter(item => item.id !== card.id);
            const builtCard = { ...card, builtRound: this.round };
            player.city.push(builtCard);
            this.turn.built += 1;
            this._startPresentation(player, 'buildDistrict', { card: this._publicCard(builtCard), cost: card.cost, cityCount: player.city.length });
            if (player.city.length >= 8 && !this.endRoundRequested) {
                this.endRoundRequested = true;
                this.finalRound = this.round;
                this.firstFinisherId = player.id;
                this.actionLog.push(`${player.name} 建成了第 8 座城区，本轮结束后游戏结束`);
                this._appendPresentationEvent(player, 'finalRoundTriggered', { round: this.round, cityCount: player.city.length, card: this._publicCard(builtCard) });
            }
            return this._success(`${player.name} 建造了${card.name}`);
        }
        if (action.kind === 'closeBuild') {
            if (role.id !== 'warlord' || !this.turn.incomeTaken || this.drawOptions[playerId] || this.turn.buildPhaseClosed) {
                return { success: false, message: '当前不能结束建造阶段', state: this.getPlayerState(playerId) };
            }
            this.turn.buildPhaseClosed = true;
            this._startPresentation(player, 'buildPhaseClosed', { role: this._publicRole(role.id) });
            return this._success('军阀结束建造阶段，可以选择摧毁城区');
        }
        if (action.kind === 'laboratory') {
            const hasLab = player.city.some(card => card.effect === 'laboratory');
            if (!hasLab || this.turn.laboratoryUsed) return { success: false, message: '本回合已使用过实验室，或城市中没有实验室', state: this.getPlayerState(playerId) };
            const card = player.hand.find(item => item.id === action.cardId);
            if (!card) return { success: false, message: '请选择要弃掉的手牌', state: this.getPlayerState(playerId) };
            player.hand = player.hand.filter(item => item.id !== card.id);
            player.gold += 1;
            this.turn.laboratoryUsed = true;
            this._startPresentation(player, 'laboratory', { card: this._publicCard(card), gold: 1 });
            return this._success(`实验室：弃掉${card.name}，获得 1 枚金币`);
        }
        if (action.kind === 'smithy') {
            const hasSmithy = player.city.some(card => card.effect === 'smithy');
            if (!hasSmithy || this.turn.smithyUsed) return { success: false, message: '本回合已使用过铁匠铺，或城市中没有铁匠铺', state: this.getPlayerState(playerId) };
            if (player.gold < 3) return { success: false, message: '金币不足，铁匠铺需要 3 金', state: this.getPlayerState(playerId) };
            player.gold -= 3;
            const drawn = this._draw(2);
            player.hand.push(...drawn);
            this.turn.smithyUsed = true;
            this._startPresentation(player, 'smithy', { cost: 3, drawnCount: drawn.length });
            return this._success(`铁匠铺：支付 3 金，摸 ${drawn.length} 张城区牌`);
        }
        if (action.kind === 'destroyDistrict') {
            if (role.id !== 'warlord' || this.turn.powerUsed || !this.turn.incomeTaken || !this.turn.buildPhaseClosed) return { success: false, message: '军阀只能在结束建造阶段后（回合末）摧毁城区', state: this.getPlayerState(playerId) };
            const target = this._player(action.targetId);
            const card = target?.city.find(item => item.id === action.cardId);
            if (!target || !card) return { success: false, message: '请选择要摧毁的城区', state: this.getPlayerState(playerId) };
            if (target.city.length >= 8) return { success: false, message: '不能攻击已经建成 8 座城区的城市', state: this.getPlayerState(playerId) };
            if (card.effect === 'keep') return { success: false, message: '堡垒不能被军阀摧毁', state: this.getPlayerState(playerId) };
            // 2–3 人局一名玩家可能同时持有两个角色；只有本轮未被刺杀的主教
            // 才能保护城市，不能用玩家级 murdered 标记误伤另一角色。
            if (target.roles.some(item => item.id === 'bishop') && this.killedRole !== 'bishop') return { success: false, message: '主教的城市受保护，军阀不能攻击', state: this.getPlayerState(playerId) };
            // 长城只增加“其他城区”的摧毁成本；摧毁长城本身不应自我加价。
            const greatWall = target.city.some(item => item.effect === 'greatWall' && item.id !== card.id);
            const cost = Math.max(0, card.cost - 1) + (greatWall ? 1 : 0);
            if (player.gold < cost) return { success: false, message: `摧毁${card.name}需要 ${cost} 枚金币`, state: this.getPlayerState(playerId) };
            player.gold -= cost;
            target.city = target.city.filter(item => item.id !== card.id);
            this.turn.powerUsed = true;
            this.actionLog.push(`军阀摧毁了 ${target.name} 的${card.name}`);
            const canRecover = target.id !== player.id && card.effect !== 'graveyard' && target.city.some(item => item.effect === 'graveyard');
            this._startPresentation(player, 'destroyDistrict', {
                targetPlayerId: target.id,
                targetPlayerName: target.name,
                card: this._publicCard(card),
                cost,
                graveyardPending: canRecover,
            });
            if (canRecover) {
                this.pendingGraveyard = { ownerId: target.id, attackerId: player.id, card, cost };
                return this._success(`军阀摧毁了${card.name}，${target.name} 可以支付 1 金用墓地回收`);
            }
            return this._success(`军阀摧毁了 ${target.name} 的${card.name}`);
        }
        if (action.kind === 'endTurn') {
            if (this.drawOptions[playerId]) return { success: false, message: '请先完成保留城区牌的选择', state: this.getPlayerState(playerId) };
            if (this.pendingGraveyard) return { success: false, message: '等待被摧毁城区的玩家决定是否用墓地回收', state: this.getPlayerState(playerId) };
            if (!this.turn.incomeTaken) return { success: false, message: '回合开始时必须先选择拿金币或摸牌', state: this.getPlayerState(playerId) };
            if (role.id === 'warlord' && !this.turn.buildPhaseClosed) return { success: false, message: '请先结束建造阶段，再决定是否摧毁城区', state: this.getPlayerState(playerId) };
            if (!this.turn.incomeCollected) {
                const income = this._collectIncome(player, this.turn.roleId);
                this._collectMerchantBonus(player);
                if (income) this.actionLog.push(`${role.name} 自动领取角色收入 +${income} 金`);
            } else {
                const bonus = this._collectMerchantBonus(player);
                if (bonus) this.actionLog.push('商人完成资源行动，额外获得 +1 金');
            }
            this.actionLog.push(`${player.name} 的${role.name}回合结束`);
            this._startPresentation(player, 'turnEnded', { role: this._publicRole(role.id) });
            this.currentRoleRank += 1;
            this._advanceCharacter();
            return this._success('回合结束');
        }
        return { success: false, message: '未知的富饶之城动作', state: this.getPlayerState(playerId) };
    }

    // ============ 回合结束与计分 ============
    _endRound() {
        // 国王若被暗杀，本轮结束后仍取得皇冠
        if (this.killedRole === 'king' && this.selectedRoles.king) {
            this.crownHolderId = this.selectedRoles.king;
            this.actionLog.push('被暗杀的国王在本轮结束后取得皇冠');
        }
        if (this.endRoundRequested) {
            this._finish();
            return;
        }
        this._appendPresentationEvent(null, 'roundTransition', { completedRound: this.round, nextRound: this.round + 1, crownHolderId: this.crownHolderId, crownHolderName: this._player(this.crownHolderId)?.name || null });
        this.round += 1;
        this._prepareRoleDraft();
    }

    _colorBonus(player) {
        const colors = new Set(player.city.map(card => card.color));
        if (colors.size >= 5) return true;
        const missing = COLORS.filter(color => !colors.has(color));
        if (missing.length === 1) {
            return player.city.some(card => card.effect === 'hauntedCity' && card.builtRound !== this.finalRound);
        }
        return false;
    }

    _finish() {
        this.status = 'ended';
        this.phase = 'ended';
        const results = this.players.map(player => {
            const districtSum = player.city.reduce((sum, card) => sum + card.points, 0);
            const firstBonus = player.id === this.firstFinisherId ? 4 : 0;
            const eightBonus = player.id !== this.firstFinisherId && player.city.length >= 8 ? 2 : 0;
            const colorBonus = this._colorBonus(player) ? 3 : 0;
            const treasury = player.city.some(card => card.effect === 'imperialTreasury') ? player.gold : 0;
            const mapRoom = player.city.some(card => card.effect === 'mapRoom') ? player.hand.length : 0;
            return { player, districtSum, firstFinisherBonus: firstBonus, eightCityBonus: eightBonus, colorBonus, treasuryBonus: treasury, mapRoomBonus: mapRoom, score: districtSum + firstBonus + eightBonus + colorBonus + treasury + mapRoom, gold: player.gold };
        });
        results.sort((a, b) => b.score - a.score || b.districtSum - a.districtSum || b.gold - a.gold);
        const top = results[0];
        this.winner = top?.player || null;
        this.winners = results.filter(item => top && item.score === top.score && item.districtSum === top.districtSum && item.gold === top.gold).map(item => item.player);
        this.scores = results.map(item => ({ id: item.player.id, name: item.player.name, score: item.score, districtSum: item.districtSum, firstFinisherBonus: item.firstFinisherBonus, eightCityBonus: item.eightCityBonus, colorBonus: item.colorBonus, treasuryBonus: item.treasuryBonus, mapRoomBonus: item.mapRoomBonus, gold: item.gold }));
        this.actionLog.push(this.winners.length > 1 ? `终局并列冠军：${this.winners.map(player => player.name).join('、')}` : `终局：${this.winner?.name || '无人'} 建成最辉煌的城市`);
        this._appendPresentationEvent(this.winner, 'finalSettlement', { standings: this.scores, winners: this.winners.map(player => ({ id: player.id, name: player.name })) });
        this._updatePresentation({ resolved: true, ended: true, standings: this.scores, winner: this.winner ? { id: this.winner.id, name: this.winner.name } : null });
    }

    // ============ 对外接口 ============
    _success(message) {
        this.lastAction = { message, sequence: this.presentation?.sequence || 0 };
        return { success: true, message, state: this.getPublicState(), ended: this.status === 'ended', winner: this.winner ? { id: this.winner.id, name: this.winner.name } : null };
    }

    _startPresentation(player, kind, data = {}) {
        this.presentation = {
            sequence: ++this.presentationSequence,
            transactionId: ++this.transactionSequence,
            events: [],
            resolved: false,
            ended: false,
        };
        return this._appendPresentationEvent(player, kind, data);
    }

    _appendPresentationEvent(player, kind, data = {}) {
        if (!this.presentation) return this._startPresentation(player, kind, data);
        this.presentation.events.push({
            eventId: ++this.eventSequence,
            kind,
            playerId: player?.id || null,
            playerName: player?.name || null,
            ...clone(data),
        });
        return this.presentation;
    }

    _updatePresentation(values = {}) {
        if (this.presentation) Object.assign(this.presentation, clone(values));
    }

    handleAction(playerId, action = {}) {
        if (this.status !== 'playing') return { success: false, message: '游戏尚未开始或已经结束' };
        if (!this._player(playerId)?.isOnline) return { success: false, message: '玩家不存在或已离线' };
        if (this.phase === 'role_selection') return this._draft(playerId, action);
        if (this.phase === 'character_turn') return this._characterAction(playerId, action);
        return { success: false, message: '当前阶段不能操作' };
    }

    getPublicState() {
        const currentRole = this._activeRole();
        return {
            roomId: this.roomId,
            status: this.status,
            phase: this.phase,
            round: this.round,
            crownHolderId: this.crownHolderId,
            currentRoleRank: this.currentRoleRank,
            currentRoleName: currentRole?.name || null,
            currentPlayerId: this.currentPlayerId,
            draftPlayerId: this.phase === 'role_selection' ? this.draftSteps[this.draftIndex]?.playerId || null : null,
            draftDiscarding: this.phase === 'role_selection' && this.draftDiscarding,
            faceUpRoles: this.faceUpRoles.map(id => this._role(id)),
            faceDownCount: this.faceDownRoles.length,
            roleDeckCount: this.roleDeck.length,
            players: this.players.map(player => ({
                id: player.id,
                name: player.name,
                gold: player.gold,
                handCount: player.hand.length,
                city: player.city.map(card => ({ ...card })),
                cityCount: player.city.length,
                murdered: player.murdered,
                murderedRoles: player.revealedRoles.filter(id => id === this.killedRole).map(id => this._role(id)),
                isOnline: player.isOnline,
                isCurrentTurn: player.id === this.currentPlayerId,
                roles: player.revealedRoles.map(id => this._role(id)),
                role: player.revealedRoles.length ? this._role(player.revealedRoles[0]) : null,
            })),
            districtDeckCount: this.drawPile.length,
            selectedRoleCount: Object.keys(this.selectedRoles).length,
            endRoundRequested: this.endRoundRequested,
            finalRound: this.finalRound,
            killedRole: this.killedRole,
            pendingRobRole: this.pendingRobRole,
            pendingGraveyard: this.pendingGraveyard ? { ownerId: this.pendingGraveyard.ownerId, attackerId: this.pendingGraveyard.attackerId, cardId: this.pendingGraveyard.card.id, cardName: this.pendingGraveyard.card.name, card: this._publicCard(this.pendingGraveyard.card), cost: this.pendingGraveyard.cost } : null,
            lastAction: this.lastAction,
            actionLog: this.actionLog.slice(-18),
            presentation: this.presentation ? clone(this.presentation) : null,
            winner: this.winner ? { id: this.winner.id, name: this.winner.name } : null,
            winners: this.winners.map(player => ({ id: player.id, name: player.name })),
            scores: this.scores,
        };
    }

    _activeRole() {
        return this._role(Object.keys(this.selectedRoles).find(roleId => this._role(roleId)?.rank === this.currentRoleRank));
    }

    getPlayerState(playerId) {
        const state = this.getPublicState();
        const player = this._player(playerId);
        state.myId = playerId;
        state.myRoles = player?.roles?.map(role => ({ ...role })) || [];
        state.myRole = player?.roles?.[0] ? { ...player.roles[0] } : null;
        state.myHand = player?.hand?.map(card => ({ ...card })) || [];
        state.myDrawOptions = this.drawOptions[playerId]?.map(card => ({ ...card })) || [];
        state.myDrawKeepCount = this.drawKeepCount[playerId] || 1;
        state.availableRoles = this._draftOptions(playerId).map(id => this._role(id));
        state.discardOptions = this.draftDiscarding && this.draftSteps[this.draftIndex]?.playerId === playerId ? this.discardOptions.map(id => this._role(id)) : null;
        state.availableActions = this._availableActions(playerId);
        state.destroyTargets = this._destroyTargets(playerId);
        return state;
    }

    _destroyTargets(playerId) {
        if (this.phase !== 'character_turn' || this.currentPlayerId !== playerId || this.turn?.roleId !== 'warlord' || this.turn.powerUsed || !this.turn.incomeTaken || !this.turn.buildPhaseClosed) return [];
        const player = this._player(playerId);
        if (!player) return [];
        const targets = [];
        for (const target of this.players) {
            if (target.city.length >= 8) continue;
            if (target.roles.some(item => item.id === 'bishop') && this.killedRole !== 'bishop') continue;
            for (const card of target.city) {
                if (card.effect === 'keep') continue;
                const greatWall = target.city.some(item => item.effect === 'greatWall' && item.id !== card.id);
                const cost = Math.max(0, card.cost - 1) + (greatWall ? 1 : 0);
                if (player.gold < cost) continue;
                targets.push({ targetId: target.id, targetName: target.name, card: this._publicCard(card), cost, greatWall });
            }
        }
        return targets;
    }

    _availableActions(playerId) {
        if (this.phase === 'role_selection') {
            const step = this.draftSteps[this.draftIndex];
            return { chooseRole: !this.draftDiscarding && step?.playerId === playerId, discardRole: this.draftDiscarding && step?.playerId === playerId };
        }
        if (this.phase !== 'character_turn') return {};
        if (this.pendingGraveyard) {
            const owner = this._player(this.pendingGraveyard.ownerId);
            return this.pendingGraveyard.ownerId === playerId ? { graveyardRecover: owner.gold >= 1, declineGraveyard: true } : {};
        }
        if (this.currentPlayerId !== playerId || !this.turn) return {};
        const player = this._player(playerId);
        const role = this._role(this.turn.roleId);
        const hasLaboratory = player.city.some(card => card.effect === 'laboratory');
        const hasSmithy = player.city.some(card => card.effect === 'smithy');
        return {
            assassinate: role.id === 'assassin' && !this.turn.powerUsed,
            rob: role.id === 'thief' && !this.turn.powerUsed,
            magicianExchange: role.id === 'magician' && !this.turn.powerUsed,
            magicianSwap: role.id === 'magician' && !this.turn.powerUsed,
            collectIncome: !this.turn.incomeCollected && role.color != null,
            takeGold: !this.turn.incomeTaken,
            drawDistrict: !this.turn.incomeTaken,
            keepDistrict: Boolean(this.drawOptions[playerId]),
            buildDistrict: this.turn.incomeTaken && !this.drawOptions[playerId] && this.turn.built < (role.id === 'architect' ? 3 : 1),
            laboratory: hasLaboratory && !this.turn.laboratoryUsed,
            smithy: hasSmithy && !this.turn.smithyUsed && player.gold >= 3,
            closeBuild: role.id === 'warlord' && this.turn.incomeTaken && !this.drawOptions[playerId] && !this.turn.buildPhaseClosed,
            destroyDistrict: role.id === 'warlord' && !this.turn.powerUsed && this.turn.incomeTaken && this.turn.buildPhaseClosed,
            endTurn: !this.drawOptions[playerId] && !this.pendingGraveyard && (role.id !== 'warlord' || this.turn.buildPhaseClosed),
        };
    }

    handlePlayerLeave(playerId) {
        const player = this._player(playerId);
        if (!player) return { success: false, message: '玩家不存在' };
        player.isOnline = false;
        if (this.status === 'playing') {
            this.status = 'ended';
            this.winner = this.players.find(other => other.id !== playerId && other.isOnline) || null;
        }
        return this._success(`${player.name} 离开了游戏`);
    }

    getWinner() {
        return this.winner ? { id: this.winner.id, name: this.winner.name } : null;
    }
}
module.exports = CitadelsEngine;
module.exports.ROLES = ROLES;
module.exports.COLORS = COLORS;
module.exports.DISTRICT_TYPES = DISTRICT_TYPES;
module.exports.EFFECT_NAMES = EFFECT_NAMES;
