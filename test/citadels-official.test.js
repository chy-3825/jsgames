const test = require('node:test');
const assert = require('node:assert/strict');
const CitadelsEngine = require('../server/games/citadels/engine');
const Citadels = require('../server/games/citadels');

function players(ids) { return ids.map(id => ({ id, name: `玩家${id}` })); }

function seededRandom(seed) {
    let value = seed >>> 0;
    return () => {
        value = (value * 1664525 + 1013904223) >>> 0;
        return value / 0x100000000;
    };
}

function playRoleDraft(game) {
    let guard = 0;
    while (game.phase === 'role_selection' && guard++ < 40) {
        const step = game.draftSteps[game.draftIndex];
        assert.ok(step, '选角阶段必须有当前步骤');
        const options = game._draftOptions(step.playerId);
        assert.ok(options.length, '当前玩家必须有可选角色');
        const action = game.draftDiscarding
            ? { kind: 'discardRole', roleId: options[0] }
            : { kind: 'chooseRole', roleId: options[0] };
        assert.equal(game.handleAction(step.playerId, action).success, true);
    }
    assert.equal(game.phase, 'character_turn');
}

function playMaxGame(seed) {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const game = new CitadelsEngine(`citadels-7-${seed}`, players(ids), seededRandom(seed));
    assert.equal(game.start().success, true);
    let actions = 0;
    const kinds = {};
    while (game.status === 'playing' && actions < 10000) {
        let result;
        if (game.phase === 'role_selection') {
            const step = game.draftSteps[game.draftIndex];
            const options = game._draftOptions(step.playerId);
            result = game.handleAction(step.playerId, game.draftDiscarding
                ? { kind: 'discardRole', roleId: options[0] }
                : { kind: 'chooseRole', roleId: options[0] });
        } else if (game.pendingGraveyard) {
            const owner = game.pendingGraveyard.ownerId;
            result = game.handleAction(owner, { kind: game.playerMap[owner].gold > 0 ? 'graveyardRecover' : 'declineGraveyard' });
        } else {
            const pid = game.currentPlayerId;
            const player = game.playerMap[pid];
            const available = game._availableActions(pid);
            if (available.assassinate) result = game.handleAction(pid, { kind: 'assassinate', roleId: 'king' });
            else if (available.rob) result = game.handleAction(pid, { kind: 'rob', roleId: 'merchant' });
            else if (available.magicianExchange) {
                const target = game.players.find(item => item.id !== pid);
                result = game.handleAction(pid, { kind: 'magicianExchange', targetId: target.id });
            } else if (available.magicianSwap && player.hand.length >= 2) {
                result = game.handleAction(pid, { kind: 'magicianSwap', cardIds: player.hand.slice(0, 2).map(card => card.id) });
            } else if (available.collectIncome) result = game.handleAction(pid, { kind: 'collectIncome' });
            else if (available.laboratory && player.hand.length) result = game.handleAction(pid, { kind: 'laboratory', cardId: player.hand[0].id });
            else if (available.smithy) result = game.handleAction(pid, { kind: 'smithy' });
            else if (available.takeGold && game.drawPile.length < 2) result = game.handleAction(pid, { kind: 'takeGold' });
            else if (available.drawDistrict) result = game.handleAction(pid, { kind: 'drawDistrict' });
            else if (available.keepDistrict) {
                const count = game.drawKeepCount[pid] || 1;
                result = game.handleAction(pid, { kind: 'keepDistrict', cardIds: game.drawOptions[pid].slice(0, count).map(card => card.id) });
            } else if (available.buildDistrict) {
                const card = player.hand
                    .filter(item => item.cost <= player.gold && !player.city.some(existing => existing.name === item.name))
                    .sort((a, b) => a.cost - b.cost)[0];
                result = card ? game.handleAction(pid, { kind: 'buildDistrict', cardId: card.id }) : (available.closeBuild ? game.handleAction(pid, { kind: 'closeBuild' }) : game.handleAction(pid, { kind: 'endTurn' }));
            } else if (available.closeBuild) result = game.handleAction(pid, { kind: 'closeBuild' });
            else if (available.destroyDistrict) {
                const candidates = game.players.filter(target => target.city.length && target.city.length < 8
                    && !(target.roles.some(role => role.id === 'bishop') && game.killedRole !== 'bishop'));
                let target;
                let card;
                for (const candidate of candidates) {
                    const found = candidate.city.find(item => item.effect !== 'keep'
                        && player.gold >= Math.max(0, item.cost - 1) + (candidate.city.some(x => x.effect === 'greatWall') ? 1 : 0));
                    if (found) { target = candidate; card = found; break; }
                }
                result = target ? game.handleAction(pid, { kind: 'destroyDistrict', targetId: target.id, cardId: card.id }) : game.handleAction(pid, { kind: 'endTurn' });
            } else result = game.handleAction(pid, { kind: 'endTurn' });
        }
        assert.equal(result.success, true, result.message);
        kinds[result.message?.split(' ')[0] || 'action'] = (kinds[result.message?.split(' ')[0] || 'action'] || 0) + 1;
        actions += 1;
    }
    assert.equal(game.status, 'ended', `7 人局应在 ${actions} 步内结束`);
    assert.ok(game.winner);
    assert.equal(game.scores.length, 7);
    return { game, actions, kinds };
}

test('Citadels classic deck and session start are deterministic and guarded', () => {
    const first = CitadelsEngine.buildDistrictDeck(seededRandom(1)).map(card => card.id);
    const second = CitadelsEngine.buildDistrictDeck(seededRandom(1)).map(card => card.id);
    const other = CitadelsEngine.buildDistrictDeck(seededRandom(2)).map(card => card.id);
    assert.deepEqual(first, second);
    assert.notDeepEqual(first, other);
    const session = Citadels.create('session', players(['a', 'b']), { random: seededRandom(8) });
    assert.equal(session.start().success, true);
    const opening = session.engine.presentation.events[0];
    assert.equal(opening.kind, 'roleDraftStart');
    assert.equal(opening.crownHolderId, session.engine.crownHolderId);
    assert.deepEqual(opening.faceUpRoles.map(role => role.id), session.engine.faceUpRoles);
    assert.equal(session.start().success, false);
    const tooMany = new CitadelsEngine('eight', players(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']));
    assert.equal(tooMany.start().success, false);
    assert.equal(tooMany.players.length, 8, '引擎不应静默截断玩家，必须明确拒绝超出基础版人数');
});

test('Citadels publishes unanswered role calls and awards the crown after the King is revealed', () => {
    const game = new CitadelsEngine('summoning-ceremony', players(['a', 'b', 'c', 'd']), seededRandom(33));
    assert.equal(game.start().success, true);
    game.phase = 'character_turn';
    game.presentation = null;
    game.selectedRoles = { thief: 'b' };
    game.currentRoleRank = 1;
    game._advanceCharacter();
    assert.deepEqual(game.presentation.events.map(event => event.kind), ['roleUnanswered', 'roleCall']);
    assert.equal(game.presentation.events[0].role.id, 'assassin');
    assert.equal(game.presentation.events[1].role.id, 'thief');

    game.presentation = null;
    game.selectedRoles = { king: 'a' };
    game.currentRoleRank = 4;
    game._advanceCharacter();
    assert.deepEqual(game.presentation.events.map(event => event.kind), ['roleCall', 'crownAcquired']);
    assert.equal(game.crownHolderId, 'a');
});

test('Citadels hides private hands and roles while exposing only revealed roles', () => {
    const game = new CitadelsEngine('privacy', players(['a', 'b', 'c', 'd']), seededRandom(3));
    assert.equal(game.start().success, true);
    const first = game.draftSteps[game.draftIndex].playerId;
    const options = game._draftOptions(first);
    assert.equal(game.handleAction(first, { kind: 'chooseRole', roleId: options[0] }).success, true);
    const publicState = game.getPublicState();
    assert.ok(publicState.players.every(player => player.role === null));
    assert.equal(Object.prototype.hasOwnProperty.call(publicState.players[0], 'hand'), false);
    assert.equal(game.getPlayerState('a').myHand.length, 4);
});

test('Citadels presentation keeps draft identities private and reveals roles only when called', () => {
    const game = new CitadelsEngine('presentation-privacy', players(['a', 'b', 'c', 'd']), seededRandom(31));
    assert.equal(game.start().success, true);
    const first = game.draftSteps[game.draftIndex].playerId;
    const secretRoleId = game._draftOptions(first)[0];
    assert.equal(game.handleAction(first, { kind: 'chooseRole', roleId: secretRoleId }).success, true);
    const draftPresentation = game.getPublicState().presentation;
    assert.deepEqual(draftPresentation.events.map(event => event.kind), ['roleDraftProgress']);
    assert.equal(JSON.stringify(draftPresentation).includes(secretRoleId), false, '公共选角演出不得包含秘密角色 ID');

    playRoleDraft(game);
    const revealEvents = game.getPublicState().presentation.events;
    assert.ok(revealEvents.some(event => event.kind === 'roleSummoningStart'));
    const roleCall = revealEvents.find(event => event.kind === 'roleCall');
    assert.ok(roleCall?.role?.id, '角色只在按编号召集时公开');
    assert.equal(roleCall.playerId, game.currentPlayerId);
});

test('Citadels exposes authoritative warlord costs and complete score breakdowns', () => {
    const game = new CitadelsEngine('presentation-details', players(['a', 'b']), seededRandom(32));
    assert.equal(game.start().success, true);
    const warlord = game.playerMap.a;
    const target = game.playerMap.b;
    warlord.roles = [game._role('warlord')];
    warlord.gold = 6;
    target.city = [
        { id: 'target-market', name: '集市', color: 'green', cost: 2, points: 2, effect: null },
        { id: 'target-wall', name: '长城', color: 'purple', cost: 6, points: 6, effect: 'greatWall' },
    ];
    game.selectedRoles = { warlord: 'a' };
    game.phase = 'character_turn';
    game.currentRoleRank = 8;
    game._advanceCharacter();
    game.turn.incomeTaken = true;
    game.turn.buildPhaseClosed = true;
    const playerState = game.getPlayerState('a');
    const marketTarget = playerState.destroyTargets.find(item => item.card.id === 'target-market');
    const wallTarget = playerState.destroyTargets.find(item => item.card.id === 'target-wall');
    assert.equal(marketTarget.cost, 2, '集市原价减一后应再加长城费用');
    assert.equal(wallTarget.cost, 5, '摧毁长城本身不应自我加价');

    game.firstFinisherId = 'a';
    warlord.city = [
        { id: 'treasury', name: '帝国宝库', color: 'purple', cost: 4, points: 4, effect: 'imperialTreasury' },
        { id: 'noble', name: '庄园', color: 'yellow', cost: 3, points: 3, effect: null },
    ];
    game._finish();
    const score = game.scores.find(item => item.id === 'a');
    assert.equal(score.firstFinisherBonus, 4);
    assert.equal(score.treasuryBonus, warlord.gold);
    assert.ok(['districtSum', 'eightCityBonus', 'colorBonus', 'mapRoomBonus'].every(key => Object.prototype.hasOwnProperty.call(score, key)));
    assert.equal(game.presentation.events.at(-1).kind, 'finalSettlement');
});

test('Citadels murdered Bishop loses protection, but a live Bishop still protects in 2-role games', () => {
    const game = new CitadelsEngine('bishop-murder', players(['a', 'b']), seededRandom(4));
    assert.equal(game.start().success, true);
    const card = { id: 'district-1', name: '酒馆', color: 'green', cost: 1, points: 1, effect: null };
    const warlord = game.playerMap.a;
    const bishopOwner = game.playerMap.b;
    warlord.roles = [game._role('warlord')];
    bishopOwner.roles = [game._role('bishop'), game._role('merchant')];
    game.selectedRoles = { warlord: 'a', bishop: 'b', merchant: 'b' };
    game.phase = 'character_turn';
    game.currentRoleRank = 8;
    game._advanceCharacter();
    game.turn.incomeTaken = true;
    game.turn.buildPhaseClosed = false;
    warlord.gold = 3;
    bishopOwner.city = [{ ...card }];
    game.killedRole = 'merchant';
    assert.equal(game.handleAction('a', { kind: 'destroyDistrict', targetId: 'b', cardId: card.id }).success, false);
    game.killedRole = 'bishop';
    game.turn.powerUsed = false;
    warlord.gold = 3;
    assert.equal(game.handleAction('a', { kind: 'destroyDistrict', targetId: 'b', cardId: card.id }).success, false, '军阀必须先结束建造阶段');
    assert.equal(game.handleAction('a', { kind: 'closeBuild' }).success, true);
    assert.equal(game.handleAction('a', { kind: 'destroyDistrict', targetId: 'b', cardId: card.id }).success, true);
});

test('Citadels Merchant bonus is paid only after the resource action', () => {
    const game = new CitadelsEngine('merchant-timing', players(['a', 'b']), seededRandom(5));
    assert.equal(game.start().success, true);
    const merchant = game.playerMap.a;
    merchant.roles = [game._role('merchant')];
    merchant.city = [{ id: 'green-1', name: '酒馆', color: 'green', cost: 1, points: 1, effect: null }];
    game.selectedRoles = { merchant: 'a' };
    game.phase = 'character_turn';
    game.currentRoleRank = 6;
    game._advanceCharacter();
    assert.equal(game.handleAction('a', { kind: 'collectIncome' }).success, true);
    assert.equal(merchant.gold, 3, '资源行动前只能领取绿色城区收入');
    assert.equal(game.handleAction('a', { kind: 'takeGold' }).success, true);
    assert.equal(merchant.gold, 6, '拿 2 金后再获得商人的额外 1 金');

    // 另一局验证“先拿资源、后领角色收入”时，商人奖励也只发一次。
    const afterResource = new CitadelsEngine('merchant-timing-after-resource', players(['a', 'b']), seededRandom(55));
    assert.equal(afterResource.start().success, true);
    const merchantAfterResource = afterResource.playerMap.a;
    merchantAfterResource.roles = [afterResource._role('merchant')];
    merchantAfterResource.city = [{ id: 'green-1', name: '酒馆', color: 'green', cost: 1, points: 1, effect: null }];
    afterResource.selectedRoles = { merchant: 'a' };
    afterResource.phase = 'character_turn';
    afterResource.currentRoleRank = 6;
    afterResource._advanceCharacter();
    assert.equal(afterResource.handleAction('a', { kind: 'takeGold' }).success, true);
    assert.equal(merchantAfterResource.gold, 5, '资源行动立即获得基础金币与一次商人奖励');
    assert.equal(afterResource.handleAction('a', { kind: 'collectIncome' }).success, true);
    assert.equal(merchantAfterResource.gold, 6, '之后领取绿色城区收入不得再次获得商人奖励');
    assert.equal(afterResource.handleAction('a', { kind: 'collectIncome' }).success, false);
});

test('Citadels Architect draws the two bonus cards only after taking the resource action', () => {
    const game = new CitadelsEngine('architect-timing', players(['a', 'b', 'c']), seededRandom(6));
    assert.equal(game.start().success, true);
    const architect = game.playerMap.a;
    architect.roles = [game._role('architect')];
    game.selectedRoles = { architect: 'a' };
    game.phase = 'character_turn';
    game.currentRoleRank = 7;
    game._advanceCharacter();
    assert.equal(architect.hand.length, 4, '呼叫建筑师时不应提前摸额外牌');
    assert.equal(game.handleAction('a', { kind: 'takeGold' }).success, true);
    assert.equal(architect.hand.length, 6, '完成拿金币动作后应额外摸两张牌');
});

test('Citadels completes three independent seven-player classic games', () => {
    const runs = [playMaxGame(701), playMaxGame(702), playMaxGame(703)];
    assert.ok(runs.every(run => run.actions > 0 && run.actions < 10000));
    assert.ok(runs.every(run => run.game.scores.some(score => score.score > 0)));
});
