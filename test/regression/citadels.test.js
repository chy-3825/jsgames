'use strict';

const {
    assert,
    test,
    fs,
    Room,
    LoveLetter,
    LoveLetterEngine,
    Coup,
    Chess,
    Xiangqi,
    Jungle,
    Gobang,
    Checkers,
    Monopoly,
    MonopolyDeal,
    MonopolyDealEngine,
    GuessNumber,
    Aeroplane,
    Junqi,
    TakeFive,
    TakeFiveEngine,
    Splendor,
    SplendorEngine,
    Hanabi,
    HanabiEngine,
    Kingdomino,
    KingdominoEngine,
    Acquire,
    AcquireEngine,
    Citadels,
    CitadelsEngine,
    Witchtown,
    WitchtownEngine,
    LasVegas,
    LasVegasEngine,
    Avalon,
    AvalonEngine,
    Scout,
    ScoutEngine,
    Decrypto,
    DecryptoEngine,
    Manila,
    ManilaEngine,
    ModernArt,
    ModernArtEngine,
    CamelUp,
    CamelUpEngine,
    MagicalAthlete,
    MagicalAthleteEngine,
    Werewolf,
    WerewolfEngine,
    registry,
    GROUP_DEFINITIONS,
    GAME_GROUPS,
    players,
    readFrontendSource,
    readWitchtownClient,
    confirmAvalonRoles,
    confirmDecryptoKeys,
    confirmWitchtownDossiers,
    passWitchtownConfessions,
    confirmedWerewolfNightAction,
    chessEngine,
    maAthlete,
    maDraft,
    maRaceSelect,
    maResolvePrompts,
    maAutoPlay
} = require("../support/regression.helper");

test('Citadels uses the official 67-card classic deck and 8 base roles', () => {
    const deck = CitadelsEngine.buildDistrictDeck();
    assert.equal(deck.length, 67);
    assert.equal(CitadelsEngine.ROLES.length, 8);
    assert.equal(new Set(deck.map(card => card.id)).size, 67);
    const byColor = deck.reduce((map, card) => { map[card.color] = (map[card.color] || 0) + 1; return map; }, {});
    assert.equal(byColor.yellow, 12);
    assert.equal(byColor.blue, 11);
    assert.equal(byColor.green, 20);
    assert.equal(byColor.red, 11);
    assert.equal(byColor.purple, 13);
    const effects = new Set(deck.filter(card => card.effect).map(card => card.effect));
    for (const effect of ['hauntedCity', 'keep', 'imperialTreasury', 'mapRoom', 'laboratory', 'observatory', 'smithy', 'graveyard', 'library', 'schoolOfMagic', 'greatWall']) {
        assert.ok(effects.has(effect), `${effect} 应在官方牌组中`);
    }
});

test('Citadels drafts roles with official face-up and face-down removal per player count', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const expectations = {
        2: { faceUp: 0, faceDown: 4, picked: 4 },
        3: { faceUp: 0, faceDown: 2, picked: 6 },
        4: { faceUp: 2, faceDown: 2, picked: 4 },
        5: { faceUp: 1, faceDown: 2, picked: 5 },
        6: { faceUp: 0, faceDown: 2, picked: 6 },
        7: { faceUp: 0, faceDown: 1, picked: 7 },
    };
    for (const n of [2, 3, 4, 5, 6, 7]) {
        const game = new CitadelsEngine(`draft-${n}`, players(ids.slice(0, n)), () => 0.5);
        assert.equal(game.start().success, true);
        let guard = 0;
        while (game.phase === 'role_selection' && guard++ < 30) {
            const pid = game.draftSteps[game.draftIndex].playerId;
            const options = game._draftOptions(pid);
            assert.ok(options.length);
            const result = game.draftDiscarding
                ? game.handleAction(pid, { kind: 'discardRole', roleId: options[0] })
                : game.handleAction(pid, { kind: 'chooseRole', roleId: options[0] });
            assert.equal(result.success, true, result.message);
        }
        const expected = expectations[n];
        assert.equal(game.faceUpRoles.length, expected.faceUp, `${n} 人明置数`);
        assert.equal(game.faceDownRoles.length, expected.faceDown, `${n} 人暗置数`);
        assert.equal(Object.keys(game.selectedRoles).length, expected.picked, `${n} 人选中角色数`);
        assert.equal(game.phase, 'character_turn');
        if (n === 2 || n === 3) {
            assert.equal(game.players[0].roles.length, 2);
            assert.equal(game.players[1].roles.length, 2);
        }
    }
});

test('Citadels never leaves the King face-up and replays the 2-3 player draft round', () => {
    let kingFaceUp = 0;
    for (let i = 0; i < 200; i += 1) {
        const game = new CitadelsEngine('king-faceup', players(['a', 'b', 'c', 'd']), () => Math.random());
        game.start();
        if (game.faceUpRoles.includes('king')) kingFaceUp += 1;
    }
    assert.equal(kingFaceUp, 0);
    // 2 人局：完整跑一轮后进入下一轮选角
    const game = new CitadelsEngine('two-round', players(['a', 'b']), () => 0.31);
    game.start();
    let guard = 0;
    while (game.phase === 'role_selection' && guard++ < 20) {
        const pid = game.draftSteps[game.draftIndex].playerId;
        const options = game._draftOptions(pid);
        const result = game.draftDiscarding
            ? game.handleAction(pid, { kind: 'discardRole', roleId: options[0] })
            : game.handleAction(pid, { kind: 'chooseRole', roleId: options[0] });
        assert.equal(result.success, true);
    }
    while (game.round === 1 && game.status === 'playing' && guard++ < 400) {
        let result;
        if (game.phase === 'role_selection') {
            const pid = game.draftSteps[game.draftIndex].playerId;
            const options = game._draftOptions(pid);
            result = game.draftDiscarding
                ? game.handleAction(pid, { kind: 'discardRole', roleId: options[0] })
                : game.handleAction(pid, { kind: 'chooseRole', roleId: options[0] });
            assert.equal(result.success, true, result.message);
            continue;
        }
        const pid = game.currentPlayerId;
        const player = game.playerMap[pid];
        const actions = game._availableActions(pid);
        if (game.pendingGraveyard) result = game.handleAction(game.pendingGraveyard.ownerId, { kind: 'declineGraveyard' });
        else if (actions.assassinate) result = game.handleAction(pid, { kind: 'assassinate', roleId: 'thief' });
        else if (actions.rob) result = game.handleAction(pid, { kind: 'rob', roleId: 'merchant' });
        else if (actions.drawDistrict) result = game.handleAction(pid, { kind: 'drawDistrict' });
        else if (actions.keepDistrict) { const count = game.drawKeepCount[pid] || 1; result = game.handleAction(pid, { kind: 'keepDistrict', cardIds: game.drawOptions[pid].slice(0, count).map(card => card.id) }); }
        else if (actions.buildDistrict) { const card = player.hand.find(item => item.cost <= player.gold && !player.city.some(existing => existing.name === item.name)); result = card ? game.handleAction(pid, { kind: 'buildDistrict', cardId: card.id }) : game.handleAction(pid, { kind: 'endTurn' }); }
        else result = game.handleAction(pid, { kind: 'endTurn' });
        assert.equal(result.success, true, result.message);
    }
    assert.equal(game.round, 2);
    assert.equal(game.phase, 'role_selection');
});

test('Citadels Magician can exchange hands or discard for the same number of cards', () => {
    const game = new CitadelsEngine('magician', players(['a', 'b', 'c']), () => 0.5);
    game.start();
    game.players[0].roles = [game._role('magician')];
    game.players[1].roles = [game._role('king')];
    game.players[2].roles = [game._role('merchant')];
    game.selectedRoles = { magician: 'a', king: 'b', merchant: 'c' };
    game.phase = 'character_turn';
    game.currentRoleRank = 3;
    game._advanceCharacter();
    const magician = game.players[0];
    const target = game.players[1];
    target.townHall = { id: 'mary-warren', name: 'Mary Warren', description: '' };
    magician.hand = [{ id: 'm1', name: 'M1', color: 'green', cost: 1, points: 1 }];
    target.hand = [{ id: 'k1', name: 'K1', color: 'blue', cost: 2, points: 2 }, { id: 'k2', name: 'K2', color: 'blue', cost: 2, points: 2 }];
    assert.equal(game.handleAction('a', { kind: 'magicianExchange', targetId: 'b' }).success, true);
    assert.equal(magician.hand.length, 2);
    assert.equal(target.hand.length, 1);
    // 已使用能力后不能再次交换
    assert.equal(game.handleAction('a', { kind: 'magicianExchange', targetId: 'b' }).success, false);
    // 换牌：弃 N 张手牌，摸回同数量
    const game2 = new CitadelsEngine('magician-swap', players(['a', 'b']), () => 0.5);
    game2.start();
    game2.players[0].roles = [game2._role('magician')];
    game2.selectedRoles = { magician: 'a', king: 'b' };
    game2.phase = 'character_turn';
    game2.currentRoleRank = 3;
    game2._advanceCharacter();
    const magician2 = game2.players[0];
    magician2.hand = [{ id: 'x1', name: 'X1', color: 'green', cost: 1, points: 1 }, { id: 'x2', name: 'X2', color: 'green', cost: 1, points: 1 }];
    game2.drawPile = [{ id: 'd1', name: 'D1', color: 'red', cost: 1, points: 1 }, { id: 'd2', name: 'D2', color: 'red', cost: 1, points: 1 }, { id: 'd3', name: 'D3', color: 'red', cost: 1, points: 1 }];
    const result = game2.handleAction('a', { kind: 'magicianSwap', cardIds: ['x1', 'x2'] });
    assert.equal(result.success, true);
    assert.equal(magician2.hand.length, 2);
    assert.equal(magician2.hand[0].id, 'd3');
    assert.equal(magician2.hand[1].id, 'd2');
});

test('Citadels Warlord obeys bishop, finished-city, Great Wall, Keep and own-city rules', () => {
    const game = new CitadelsEngine('warlord', players(['a', 'b']), () => 0.5);
    game.start();
    const warlord = game.players[0];
    const target = game.players[1];
    warlord.roles = [game._role('warlord')];
    game.selectedRoles = { warlord: 'a', merchant: 'b' };
    game.phase = 'character_turn';
    game.currentRoleRank = 8;
    game._advanceCharacter();
    game.turn.incomeTaken = true;
    game.turn.buildPhaseClosed = true;
    warlord.gold = 20;
    const card = (id, name, color, cost, extra = {}) => ({ id, name, color, cost, points: extra.points || cost, effect: extra.effect || null });
    // 主教保护
    target.roles = [game._role('bishop')];
    game.selectedRoles.bishop = 'b';
    target.city = [card('c1', '庄园', 'yellow', 3)];
    assert.equal(game.handleAction('a', { kind: 'destroyDistrict', targetId: 'b', cardId: 'c1' }).success, false);
    // 已建成 8 座的城市受保护
    target.roles = [game._role('merchant')];
    delete game.selectedRoles.bishop;
    target.city = Array.from({ length: 8 }, (_, index) => card(`c8-${index}`, `D${index}`, index % 2 ? 'yellow' : 'blue', 2));
    game.turn.powerUsed = false;
    assert.equal(game.handleAction('a', { kind: 'destroyDistrict', targetId: 'b', cardId: 'c8-0' }).success, false);
    // 长城使摧毁费用 +1
    target.city = [card('c2', '庄园', 'yellow', 3), card('wall', '长城', 'purple', 6, { effect: 'greatWall' })];
    warlord.gold = 2;
    game.turn.powerUsed = false;
    assert.equal(game.handleAction('a', { kind: 'destroyDistrict', targetId: 'b', cardId: 'c2' }).success, false);
    warlord.gold = 3;
    game.turn.powerUsed = false;
    assert.equal(game.handleAction('a', { kind: 'destroyDistrict', targetId: 'b', cardId: 'c2' }).success, true);
    assert.equal(warlord.gold, 0);
    // 摧毁长城本身不应把长城的 +1 成本算到自己身上（费用为 cost-1）。
    target.city = [card('wall-self', '长城', 'purple', 6, { effect: 'greatWall' })];
    warlord.gold = 5;
    game.turn.powerUsed = false;
    assert.equal(game.handleAction('a', { kind: 'destroyDistrict', targetId: 'b', cardId: 'wall-self' }).success, true);
    assert.equal(warlord.gold, 0);
    // 堡垒不可摧毁
    target.city = [card('keep', '堡垒', 'purple', 3, { effect: 'keep' })];
    warlord.gold = 20;
    game.turn.powerUsed = false;
    assert.equal(game.handleAction('a', { kind: 'destroyDistrict', targetId: 'b', cardId: 'keep' }).success, false);
    // 军阀可以攻击自己的城市
    warlord.city = [card('own', '酒馆', 'green', 1)];
    game.turn.powerUsed = false;
    assert.equal(game.handleAction('a', { kind: 'destroyDistrict', targetId: 'a', cardId: 'own' }).success, true);
    assert.equal(warlord.city.length, 0);
    // 墓地回收：被摧毁城区的主人可付 1 金收回
    target.city = [card('church', '教堂', 'blue', 2), card('grave', '墓地', 'purple', 5, { effect: 'graveyard' })];
    target.gold = 1;
    game.turn.powerUsed = false;
    assert.equal(game.handleAction('a', { kind: 'destroyDistrict', targetId: 'b', cardId: 'church' }).success, true);
    assert.ok(game.pendingGraveyard);
    assert.equal(game.getPlayerState('b').availableActions.graveyardRecover, true);
    assert.equal(game.handleAction('b', { kind: 'graveyardRecover' }).success, true);
    assert.equal(target.hand.some(item => item.id === 'church'), true);
    assert.equal(target.gold, 0);
});

test('Citadels scores five colors, first finisher, purple districts and treasury/map room', () => {
    const card = (id, name, color, cost, extra = {}) => ({ id, name, color, cost, points: extra.points || cost, effect: extra.effect || null, builtRound: extra.builtRound || 1 });
    const game = new CitadelsEngine('scoring', players(['a', 'b']), () => 0.5);
    game.start();
    const a = game.players[0];
    const b = game.players[1];
    a.city = [card('a1', '大学', 'purple', 6, { points: 8 }), card('a2', '庄园', 'yellow', 3), card('a3', '神庙', 'blue', 1), card('a4', '酒馆', 'green', 1), card('a5', '瞭望塔', 'red', 1)];
    b.city = [card('b1', '巨龙门', 'purple', 6, { points: 8 }), card('b2', '城堡', 'yellow', 4), card('b3', '教堂', 'blue', 2), card('b4', '集市', 'green', 2), card('b5', '神殿', 'blue', 1), card('b6', '庄园', 'yellow', 3), card('b7', '酒馆', 'green', 1), card('b8', '瞭望塔', 'red', 1)];
    game.firstFinisherId = 'a';
    game.finalRound = 2;
    game._finish();
    const scoreA = game.scores.find(item => item.id === 'a');
    const scoreB = game.scores.find(item => item.id === 'b');
    assert.equal(scoreA.score, 8 + 3 + 1 + 1 + 1 + 4 + 3);
    assert.equal(scoreB.score, 8 + 4 + 2 + 2 + 1 + 3 + 1 + 1 + 2 + 3);
    // 帝国宝库 + 金币，地图室 + 手牌，鬼城补缺色
    const game2 = new CitadelsEngine('scoring2', players(['a', 'b']), () => 0.5);
    game2.start();
    const a2 = game2.players[0];
    a2.city = [card('t1', '帝国宝库', 'purple', 4, { effect: 'imperialTreasury' }), card('t2', '地图室', 'purple', 5, { effect: 'mapRoom' }), card('t3', '鬼城', 'purple', 2, { effect: 'hauntedCity' }), card('t4', '庄园', 'yellow', 3), card('t5', '神庙', 'blue', 1), card('t6', '酒馆', 'green', 1)];
    a2.gold = 7;
    a2.hand = [{ id: 'h1', name: 'H1', color: 'green', cost: 1, points: 1 }, { id: 'h2', name: 'H2', color: 'green', cost: 1, points: 1 }, { id: 'h3', name: 'H3', color: 'green', cost: 1, points: 1 }];
    game2.firstFinisherId = 'a';
    game2.finalRound = 2;
    game2._finish();
    const scoreA2 = game2.scores.find(item => item.id === 'a');
    assert.equal(scoreA2.districtSum, 4 + 5 + 2 + 3 + 1 + 1);
    assert.equal(scoreA2.score, scoreA2.districtSum + 7 + 3 + 3 + 4);
    // 鬼城在终局轮建成不能补缺色
    const game3 = new CitadelsEngine('scoring3', players(['a', 'b']), () => 0.5);
    game3.start();
    const a3 = game3.players[0];
    a3.city = [card('h1', '鬼城', 'purple', 2, { effect: 'hauntedCity', builtRound: 2 }), card('h2', '庄园', 'yellow', 3), card('h3', '神庙', 'blue', 1), card('h4', '酒馆', 'green', 1)];
    game3.firstFinisherId = 'a';
    game3.finalRound = 2;
    game3._finish();
    assert.equal(game3.scores.find(item => item.id === 'a').score, 2 + 3 + 1 + 1 + 4);
});

test('Citadels Architect draws two extra cards and may build three districts', () => {
    const game = new CitadelsEngine('architect', players(['a', 'b', 'c']), () => 0.5);
    game.start();
    const architect = game.players[0];
    architect.roles = [game._role('architect')];
    game.selectedRoles = { architect: 'a' };
    game.phase = 'character_turn';
    game.currentRoleRank = 7;
    game._advanceCharacter();
    assert.equal(architect.hand.length, 4, '建筑师额外牌应在完成资源行动后获得');
    assert.equal(game.handleAction('a', { kind: 'takeGold' }).success, true);
    assert.equal(architect.hand.length, 6);
    game.turn.incomeTaken = true;
    architect.gold = 30;
    architect.hand = [1, 2, 3, 4].map(cost => ({ id: `b-${cost}`, name: `B${cost}`, color: 'green', cost, points: cost }));
    for (let i = 0; i < 3; i += 1) {
        assert.equal(game.handleAction('a', { kind: 'buildDistrict', cardId: `b-${i + 1}` }).success, true);
    }
    assert.equal(game.handleAction('a', { kind: 'buildDistrict', cardId: 'b-4' }).success, false);
    assert.equal(architect.city.length, 3);
});

test('Citadels completes deterministic full games for every player count', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    for (const n of [2, 3, 4, 5, 6, 7]) {
        const game = new CitadelsEngine(`full-${n}`, players(ids.slice(0, n)), () => 0.42);
        assert.equal(game.start().success, true);
        let steps = 0;
        while (game.status === 'playing' && steps < 8000) {
            let result;
            if (game.phase === 'role_selection') {
                const pid = game.draftSteps[game.draftIndex].playerId;
                const options = game._draftOptions(pid);
                result = game.draftDiscarding
                    ? game.handleAction(pid, { kind: 'discardRole', roleId: options[0] })
                    : game.handleAction(pid, { kind: 'chooseRole', roleId: options[0] });
            } else {
                const pid = game.currentPlayerId;
                const player = game.playerMap[pid];
                const actions = game._availableActions(pid);
                if (game.pendingGraveyard) {
                    result = game.handleAction(game.pendingGraveyard.ownerId, { kind: actions.graveyardRecover ? 'graveyardRecover' : 'declineGraveyard' });
                } else if (actions.assassinate) result = game.handleAction(pid, { kind: 'assassinate', roleId: 'king' });
                else if (actions.rob) result = game.handleAction(pid, { kind: 'rob', roleId: 'merchant' });
                else if (actions.magicianExchange) { const target = game.players.find(item => item.id !== pid); result = game.handleAction(pid, { kind: 'magicianExchange', targetId: target.id }); }
                else if (actions.magicianSwap && player.hand.length >= 2) result = game.handleAction(pid, { kind: 'magicianSwap', cardIds: player.hand.slice(0, 2).map(card => card.id) });
                else if (actions.collectIncome) result = game.handleAction(pid, { kind: 'collectIncome' });
                else if (actions.laboratory && player.hand.length) result = game.handleAction(pid, { kind: 'laboratory', cardId: player.hand[0].id });
                else if (actions.smithy) result = game.handleAction(pid, { kind: 'smithy' });
                // 牌堆可能因玩家长期保留手牌而耗尽；此时按规则选择 2 金，
                // 让自动对局继续以合法方式建城，而不是把“摸空牌堆”当作资源。
                else if (actions.takeGold && game.drawPile.length < 2) result = game.handleAction(pid, { kind: 'takeGold' });
                else if (actions.drawDistrict) result = game.handleAction(pid, { kind: 'drawDistrict' });
                else if (actions.keepDistrict) { const count = game.drawKeepCount[pid] || 1; result = game.handleAction(pid, { kind: 'keepDistrict', cardIds: game.drawOptions[pid].slice(0, count).map(card => card.id) }); }
                else if (actions.buildDistrict) {
                    const card = player.hand.find(item => item.cost <= player.gold && !player.city.some(existing => existing.name === item.name));
                    result = card ? game.handleAction(pid, { kind: 'buildDistrict', cardId: card.id }) : (actions.closeBuild ? game.handleAction(pid, { kind: 'closeBuild' }) : game.handleAction(pid, { kind: 'endTurn' }));
                } else if (actions.closeBuild) result = game.handleAction(pid, { kind: 'closeBuild' });
                else if (actions.destroyDistrict) {
                    const candidates = game.players.filter(item => item.id !== pid && item.city.length && item.city.length < 8 && !(item.roles.some(role => role.id === 'bishop') && game.killedRole !== 'bishop'));
                    let target = null;
                    let card = null;
                    for (const candidate of candidates) {
                        const found = candidate.city.find(item => item.effect !== 'keep' && player.gold >= Math.max(0, item.cost - 1) + (candidate.city.some(x => x.effect === 'greatWall') ? 1 : 0));
                        if (found) { target = candidate; card = found; break; }
                    }
                    result = target && card ? game.handleAction(pid, { kind: 'destroyDistrict', targetId: target.id, cardId: card.id }) : game.handleAction(pid, { kind: 'endTurn' });
                } else {
                    result = game.handleAction(pid, { kind: 'endTurn' });
                }
            }
            assert.equal(result.success, true, `${n} 人局失败: ${result.message}`);
            steps += 1;
        }
        assert.equal(game.status, 'ended', `${n} 人局应正常结束`);
        assert.ok(game.winner);
        assert.ok(game.scores.length === n);
        assert.ok(steps < 8000);
    }
});

