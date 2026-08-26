const test = require('node:test');
const assert = require('node:assert/strict');
const WitchTown = require('../server/games/witchtown');
const WitchTownEngine = require('../server/games/witchtown/engine');

function players(ids) { return ids.map(id => ({ id, name: `玩家${id}` })); }

function seededRandom(seed) {
    let value = seed >>> 0;
    return () => {
        value = (value * 1664525 + 1013904223) >>> 0;
        return value / 0x100000000;
    };
}

function chooseBlackCat(session) {
    const game = session.engine;
    if (game.phase === 'dossier_review') {
        for (const player of game._alive()) assert.equal(session.handleAction(player.id, { kind: 'confirmDossier' }).success, true);
    }
    for (const witch of game.players.filter(player => game._isWitch(player))) {
        assert.equal(session.handleAction(witch.id, { kind: 'chooseBlackCat', targetId: game.players[0].id }).success, true);
    }
}

function confirmDossiers(session) {
    const game = session.engine;
    for (const player of game._alive().filter(item => !game.dossierReview?.confirmations[item.id])) {
        assert.equal(session.handleAction(player.id, { kind: 'confirmDossier' }).success, true);
    }
}

function passConfessionWindow(session) {
    const game = session.engine;
    for (const player of game._alive().filter(item => !game.nightActions.confessions[item.id])) {
        assert.equal(session.handleAction(player.id, { kind: 'passConfession' }).success, true);
    }
}

test('Witch Town uses the official 4–12 player setup table and guards session restart', () => {
    const expected = {
        4: [18, 1, 1, 5], 5: [23, 1, 1, 5], 6: [27, 2, 1, 5], 7: [32, 2, 1, 5],
        8: [29, 2, 1, 4], 9: [33, 2, 1, 4], 10: [27, 2, 1, 3], 11: [30, 2, 1, 3], 12: [33, 2, 1, 3],
    };
    for (const [count, [town, witch, constable, cards]] of Object.entries(expected)) {
        const ids = Array.from({ length: Number(count) }, (_, index) => `p${index}`);
        const session = WitchTown.create(`setup-${count}`, players(ids), { random: seededRandom(Number(count)) });
        assert.equal(session.start().success, true, `${count} 人局必须能开始`);
        const game = session.engine;
        assert.equal(game.totalWitches, witch);
        assert.equal(game.players.flatMap(player => player.trialCards).filter(card => card.type === 'town').length, town);
        assert.equal(game.players.flatMap(player => player.trialCards).filter(card => card.type === 'witch').length, witch);
        assert.equal(game.players.flatMap(player => player.trialCards).filter(card => card.type === 'constable').length, constable);
        assert.ok(game.players.every(player => player.trialCards.length === cards));
        assert.equal(game.players.flatMap(player => player.hand).length, Number(count) * 3);
        assert.equal(game.deck.length + game.players.flatMap(player => player.hand).length, 59 - 1, '黑猫不进入牌库，其他 59 张牌应分布在牌库和起始手牌');
        assert.equal(session.start().success, false, '同一局不能重复开始');
    }
});

test('Witch Town seals the opening dossier until every player confirms it', () => {
    const session = WitchTown.create('dossier-gate', players(['a', 'b', 'c', 'd']), { random: seededRandom(31) });
    assert.equal(session.start().success, true);
    const game = session.engine;
    assert.equal(game.phase, 'dossier_review');
    assert.equal(session.getPlayerState('a').availableActions.confirmDossier, true);
    assert.equal(session.getPlayerState('a').dossierProgress.required, 4);
    assert.equal(session.handleAction('a', { kind: 'confirmDossier' }).success, true);
    assert.equal(session.handleAction('a', { kind: 'confirmDossier' }).success, false, '同一份档案不能重复确认');
    assert.equal(game.phase, 'dossier_review');
    for (const id of ['b', 'c', 'd']) assert.equal(session.handleAction(id, { kind: 'confirmDossier' }).success, true);
    assert.equal(game.phase, 'dawn', '全员确认后应自动唤醒女巫选择黑猫');
});

test('Witch Town publishes revealed Trial evidence without leaking face-down cards', () => {
    const session = WitchTown.create('public-trial', players(['a', 'b', 'c', 'd']), { random: seededRandom(32) });
    session.start();
    const game = session.engine;
    const target = game.players.find(player => player.trialCards.some(card => card.type === 'town'));
    const trial = target.trialCards.find(card => card.type === 'town');
    game._revealTrial(target, trial.id, 'manual');
    const observer = session.getPlayerState(game.players.find(player => player.id !== target.id).id);
    const publicTarget = observer.players.find(player => player.id === target.id);
    assert.deepEqual(publicTarget.revealedTrialCards, [{ id: trial.id, type: 'town' }]);
    assert.equal(publicTarget.revealedTrialCards.length, 1);
    assert.equal(observer.lastTrialReveal.playerId, target.id);
    assert.equal(observer.lastTrialReveal.type, 'town');
    assert.equal(publicTarget.trialCount > publicTarget.revealedTrialCards.length, true, '未揭示牌只能公开数量');
});

test('Witch Town keeps Trial cards private but lets each owner inspect them and enforces the day choice', () => {
    const session = WitchTown.create('private-day', players(['a', 'b', 'c', 'd']), { random: seededRandom(44) });
    assert.equal(session.start().success, true);
    chooseBlackCat(session);
    const game = session.engine;
    const first = game.currentTurnId;
    const own = session.getPlayerState(first).myTrialCards;
    assert.ok(own.every(card => ['town', 'witch', 'constable'].includes(card.type)), '玩家应能查看自己的审判牌类型');
    const otherView = session.getPlayerState(first).players.find(player => player.id !== first);
    assert.equal(otherView.identity, null);
    assert.equal(session.handleAction(first, { kind: 'endTurn' }).success, false, '未摸牌或出牌不能直接结束白天回合');
    assert.equal(session.handleAction(first, { kind: 'drawCards' }).success, true);
    assert.notEqual(game.currentTurnId, first, '摸两张牌后应自动轮到下一位');

    const second = game.currentTurnId;
    game.players.find(player => player.id === second).hand = [{ id: 'accuse-day', kind: 'accusation', name: '指控', color: 'red', value: 1 }];
    assert.equal(session.handleAction(second, { kind: 'playCard', cardId: 'accuse-day', targetId: game.players.find(player => player.id !== second).id }).success, true);
    assert.equal(session.handleAction(second, { kind: 'endTurn' }).success, true, '打出至少一张牌后可以结束白天回合');
});

test('Witch Town automatically advances through every Witch, the Constable, and the confession window', () => {
    const session = WitchTown.create('night-gate', players(['a', 'b', 'c', 'd', 'e', 'f']), { random: seededRandom(63) });
    assert.equal(session.start().success, true);
    chooseBlackCat(session);
    const game = session.engine;
    game._startNight();
    const initialWitches = game.players.filter(player => game._isWitch(player));
    // The official deck may place both Witch Trial cards on one player.  For
    // this gate test, move one card to a second seat so two living Witch
    // players must submit independently while keeping the total at two.
    if (initialWitches.length === 1) {
        const source = initialWitches[0];
        const witchCard = source.trialCards.find(card => card.type === 'witch');
        const recipient = game.players.find(player => player.id !== source.id);
        const townIndex = recipient.trialCards.findIndex(card => card.type === 'town');
        const townCard = recipient.trialCards[townIndex];
        recipient.trialCards[townIndex] = witchCard;
        source.trialCards[source.trialCards.indexOf(witchCard)] = townCard;
        recipient.everWitch = true; recipient.identity = 'witch';
        source.everWitch = source.trialCards.some(card => card.type === 'witch'); source.identity = game._identityFor(source);
    }
    const witches = game._alive().filter(player => game._isWitch(player));
    const constable = game._alive().find(player => game._isConstable(player));
    assert.equal(witches.length, 2);
    const target = game._alive().find(player => !game._isWitch(player) && player.id !== constable.id);
    assert.equal(session.handleAction(witches[0].id, { kind: 'nightKill', targetId: target.id }).success, true);
    assert.equal(game.nightStep, 'witches', '还有女巫未提交时应继续等待');
    assert.equal(session.handleAction(witches[1].id, { kind: 'nightKill', targetId: target.id }).success, true);
    assert.equal(game.nightStep, 'constable', '女巫全部提交后应自动唤醒警长');
    assert.equal(session.handleAction(constable.id, { kind: 'nightProtect', targetId: target.id }).success, true);
    assert.equal(game.nightStep, 'confession', '警长完成后应自动进入全员认罪窗口');
    passConfessionWindow(session);
    assert.equal(game.phase, 'day', '所有人决定后应自动天亮');
    assert.equal(target.eliminated, false, 'Gavel 保护应阻止本夜击杀');
});

test('William Phips may confess once without revealing a Trial card', () => {
    const session = WitchTown.create('phips-confession', players(['a', 'b', 'c', 'd']), { random: seededRandom(65) });
    session.start();
    const game = session.engine;
    game.players.forEach(player => {
        player.everWitch = false; player.everConstable = false; player.identity = 'villager';
        player.trialCards.forEach(card => { card.type = 'town'; card.revealed = false; });
    });
    const phips = game.players[0];
    phips.townHall = { id: 'william-phips', name: 'William Phips', description: '' };
    const before = phips.trialCards.filter(card => card.revealed).length;
    game._startNight();
    assert.equal(game.nightStep, 'confession');
    assert.equal(session.getPlayerState(phips.id).availableActions.confessFree, true);
    assert.equal(session.handleAction(phips.id, { kind: 'confessFree' }).success, true);
    assert.equal(phips.trialCards.filter(card => card.revealed).length, before);
    assert.equal(phips.confessed, true);
    assert.equal(session.handleAction(phips.id, { kind: 'confessFree' }).success, false);
    passConfessionWindow(session);
    assert.equal(game.phase, 'day');
});

test('Witch Town removes a dead Black Cat seat before Conspiracy passing', () => {
    const session = WitchTown.create('conspiracy-dead-seat', players(['a', 'b', 'c', 'd', 'e', 'f']), { random: seededRandom(77) });
    assert.equal(session.start().success, true);
    const game = session.engine;
    const witchPlayers = game.players.filter(player => game._isWitch(player));
    let witch = witchPlayers[0];
    // Ensure the Black Cat owner has exactly one Witch card, leaving another
    // hidden Witch card alive so the post-reveal Conspiracy can finish.
    if (witch.trialCards.filter(card => card.type === 'witch').length > 1) {
        const extra = witch.trialCards.find(card => card.type === 'witch');
        const recipient = game.players.find(player => player.id !== witch.id);
        const townIndex = recipient.trialCards.findIndex(card => card.type === 'town');
        const townCard = recipient.trialCards[townIndex];
        witch.trialCards[witch.trialCards.indexOf(extra)] = townCard;
        recipient.trialCards[townIndex] = extra;
        recipient.everWitch = true; recipient.identity = 'witch';
    }
    witch.townHall = { id: 'sarah-good', name: 'Sarah Good', description: '' };
    game.blackCatOwnerId = witch.id;
    game.players.find(player => player.id === witch.id).blueCards.push(game.blackCatCard);
    const triggerId = game.players.find(player => player.id !== witch.id).id;
    game._startConspiracy(triggerId);
    assert.equal(game.phase, 'conspiracy_reveal');
    const owner = game.playerMap[game.blackCatOwnerId];
    assert.equal(session.handleAction(triggerId, { kind: 'revealConspiracyTrial', trialId: owner.trialCards.find(card => card.type === 'witch').id }).success, true);
    assert.equal(game.phase, 'conspiracy');
    assert.equal(game.currentConspiracy.order.includes(witch.id), false, '出局的黑猫持有者不应继续参加阴谋交换');
    for (const id of game.currentConspiracy.order) {
        const state = session.getPlayerState(id);
        assert.ok(state.conspiracyOptions.length);
        assert.equal(session.handleAction(id, { kind: 'passTrial', trialId: state.conspiracyOptions[0].id }).success, true);
    }
    assert.equal(game.phase, 'dossier_review');
    confirmDossiers(session);
    assert.equal(game.phase, 'day');
});

function playMaxGame(seed) {
    const ids = 'abcdefghijkl'.split('');
    const session = WitchTown.create(`witchtown-max-${seed}`, players(ids), { random: seededRandom(seed) });
    assert.equal(session.start().success, true);
    const game = session.engine;
    let steps = 0;
    while (game.status === 'playing' && steps < 10000) {
        let result;
        if (game.phase === 'dossier_review') {
            const player = game._alive().find(item => !game.dossierReview.confirmations[item.id]);
            result = session.handleAction(player.id, { kind: 'confirmDossier' });
        } else if (game.phase === 'dawn') {
            const witch = game.players.find(player => game._isWitch(player) && !game.dawnVotes[player.id]);
            result = session.handleAction(witch.id, { kind: 'chooseBlackCat', targetId: 'a' });
        } else if (game.phase === 'conspiracy_reveal') {
            const owner = game.playerMap[game.blackCatOwnerId];
            result = session.handleAction(game.currentConspiracy.triggerId, { kind: 'revealConspiracyTrial', trialId: owner.trialCards.find(card => !card.revealed)?.id });
        } else if (game.phase === 'conspiracy') {
            const id = game.currentConspiracy.order[game.currentConspiracy.index];
            const state = session.getPlayerState(id);
            result = session.handleAction(id, { kind: 'passTrial', trialId: state.conspiracyOptions[0].id });
        } else if (game.phase === 'night') {
            if (game.nightStep === 'witches') {
                const witch = game._alive().find(player => game._isWitch(player) && !game.nightActions.kills[player.id]);
                const target = game._alive().find(player => !game._isWitch(player) && player.id !== witch.id)
                    || game._alive().find(player => player.id !== witch.id) || witch;
                result = session.handleAction(witch.id, { kind: 'nightKill', targetId: target.id });
            } else if (game.nightStep === 'constable') {
                const constable = game._alive().find(player => game._isConstable(player));
                const target = game._alive().find(player => player.id !== constable.id);
                result = session.handleAction(constable.id, { kind: 'nightProtect', targetId: target.id });
            } else {
                const player = game._alive().find(item => !game.nightActions.confessions[item.id]);
                result = session.handleAction(player.id, { kind: 'passConfession' });
            }
        } else if (game.phase === 'day') {
            const player = game.playerMap[game.currentTurnId];
            const red = player.hand.find(card => ['accusation', 'evidence', 'witness'].includes(card.kind));
            if (red) {
                const target = game._alive().find(item => item.id !== player.id && !game._hasBlue(item, 'piety'))
                    || game._alive().find(item => item.id !== player.id);
                result = target ? session.handleAction(player.id, { kind: 'playCard', cardId: red.id, targetId: target.id }) : session.handleAction(player.id, { kind: 'drawCards' });
            } else if (!game.dayTurn.played && !game.dayTurn.drew) result = session.handleAction(player.id, { kind: 'drawCards' });
            else if (game.dayTurn.played) result = session.handleAction(player.id, { kind: 'endTurn' });
        }
        assert.equal(result?.success, true, `${result?.message || `步骤 ${steps} 没有合法动作`}（阶段 ${game.phase}/${game.nightStep || '-'}，当前 ${game.currentTurnId || '-'}，种子 ${seed}）`);
        steps += 1;
    }
    assert.equal(game.status, 'ended', `${seed} 的 12 人局必须结束`);
    assert.ok(game.winner);
    assert.ok(game.night >= 1, `${seed} 应至少完整经历一夜`);
    return { steps, night: game.night, winner: game.winner.faction, deaths: game.players.filter(player => player.eliminated).length };
}

test('Witch Town completes three independent maximum-player games', () => {
    const results = [801, 802, 803].map(playMaxGame);
    assert.ok(results.every(result => result.steps < 10000));
    assert.ok(results.every(result => result.night >= 1));
});
