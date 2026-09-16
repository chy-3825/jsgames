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

test('two-player Love Letter sets aside three public cards', () => {
    const session = LoveLetter.create('ll', players(['a', 'b']));
    const result = session.start();
    assert.equal(result.state.setAsideCards.length, 3);
    assert.equal(result.state.setAsideCount, 3);
    assert.equal(result.state.setAsideCards.every(card => Number.isInteger(card.id)), true);
    assert.equal(Object.hasOwn(result.state, 'reservedCard'), false, '暗置预留牌不能公开');
});

test('Love Letter permits a protected player to use Prince on themself', () => {
    const session = LoveLetter.create('protected-prince', players(['a', 'b'])); session.start(); const game = session.engine;
    game.currentTurnIndex = 0; game.players[0].hand = [{ id: 5, name: '王子', value: 5, cardId: 'prince' }, { id: 4, name: '侍女', value: 4, cardId: 'handmaid' }]; game.players[0].isProtected = true; game.players[1].hand = [{ id: 1, name: '侍卫', value: 1, cardId: 'guard' }];
    assert.equal(game.playCard('a', 0, 'a').success, true); assert.equal(game.players[0].hand.length, 1);
});

test('Love Letter rejects the non-standard face-down discard action', () => {
    const session = LoveLetter.create('standard-discard', players(['a', 'b']));
    session.start();
    const result = session.handleAction('a', { kind: 'discardCard', cardIndex: 0 });
    assert.equal(result.success, false);
    assert.match(result.message, /必须打出/);
});

test('Love Letter showdown awards every player tied for highest hand', () => {
    const session = LoveLetter.create('tie', players(['a', 'b']));
    const game = session.engine;
    game.status = 'playing'; game.deck = []; game.players[1].favorTokens = game.targetFavor - 1;
    game.players[0].hand = [{ id: 6, name: '国王', value: 6 }];
    game.players[1].hand = [{ id: 6, name: '国王', value: 6 }];
    game.publicDiscard = [{ ownerId: 'a', card: { value: 1 } }, { ownerId: 'b', card: { value: 5 } }];
    assert.equal(game.checkGameEnd(), true);
    assert.deepEqual(game.winners.map(player => player.id), ['b']);
    assert.deepEqual(game.roundWinners.map(player => player.id), ['a', 'b']);
});

test('Love Letter priest reveal stays private to the acting player', () => {
    const session = LoveLetter.create('private-priest', players(['a', 'b']));
    session.start();
    session.engine.players[0].hand = [{ id: 2, value: 2, name: '神父' }];
    session.engine.players[1].hand = [{ id: 8, value: 8, name: '公主' }];
    session.engine.currentTurnIndex = 0;
    const announced = session.handleAction('a', { kind: 'playCard', cardIndex: 0, targetId: 'b' });
    assert.equal(announced.pendingAcknowledgement, true);
    assert.equal(session.getPlayerState('a').lastAction.result.revealedCard, undefined);
    session.engine.pendingAction.availableAt = Date.now() - 1;
    assert.equal(session.handleAction('b', { kind: 'acknowledgeAction', actionId: announced.action.actionId }).success, true);
    assert.equal(session.getPlayerState('a').lastAction.result.revealedCard.name, '公主');
    assert.equal(session.getPlayerState('b').lastAction.result.revealedCard, null);
});

test('Love Letter plays a target card with no effect when every opponent is protected', () => {
    const session = LoveLetter.create('protected-targets', players(['a', 'b', 'c']));
    session.start();
    const game = session.engine;
    game.currentTurnIndex = 0;
    game.players[0].hand = [{ id: 1, value: 1, name: '侍卫' }, { id: 2, value: 2, name: '牧师' }];
    game.players[1].hand = [{ id: 8, value: 8, name: '公主' }]; game.players[1].isProtected = true;
    game.players[2].hand = [{ id: 6, value: 6, name: '国王' }]; game.players[2].isProtected = true;
    const result = game.playCard('a', 0, null, null);
    assert.equal(result.success, true);
    assert.equal(result.noEffect, true);
    assert.equal(game.players[0].hand.length, 1);
});

test('Love Letter completes an official four-player match across rounds', () => {
    const game = new LoveLetterEngine('ll-full', players(['a', 'b', 'c', 'd']));
    game.init();
    assert.equal(game.targetFavor, 4);
    assert.equal(game.deck.length + game.players.reduce((sum, player) => sum + player.hand.length, 0) + 1, 16);

    let steps = 0;
    while (game.status !== 'ended' && steps++ < 5000) {
        if (game.pendingAction) {
            const pending = game.pendingAction;
            pending.availableAt = Date.now() - 1;
            assert.equal(game.acknowledgeAction(pending.targetId, pending.actionId).success, true);
            continue;
        }
        if (game.status === 'round_end') {
            assert.ok(game.roundWinner);
            for (const player of game.players) assert.equal(game.startNextRound(player.id).success, true);
            continue;
        }
        const current = game.getCurrentPlayer();
        assert.ok(current, 'playing game must always have a current player');
        const mustCountess = current.hand.some(card => card.id === 7) && current.hand.some(card => card.id === 5 || card.id === 6);
        const candidates = current.hand
            .map((card, index) => ({ card, index }))
            .filter(({ card }) => !mustCountess || card.id === 7);
        let played = false;
        for (const { card, index } of candidates) {
            const alive = game.getAlivePlayers().filter(player => !player.isProtected);
            const other = alive.find(player => player.id !== current.id);
            const targetId = card.id === 5 ? current.id : other?.id;
            const targetRequired = [1, 2, 3, 5, 6].includes(card.id);
            const noTargetableOpponent = game.getAlivePlayers().every(player => player.id === current.id || player.isProtected);
            if (targetRequired && !targetId && !(noTargetableOpponent && [1, 2, 3, 6].includes(card.id))) continue;
            const result = game.playCard(current.id, index, targetId, card.id === 1 ? 2 : undefined);
            if (result.success) { played = true; break; }
        }
        assert.equal(played, true, `no legal action for ${current.name}`);
    }

    assert.equal(game.status, 'ended');
    assert.ok(game.winner);
    assert.ok(game.round >= game.targetFavor);
    assert.ok(game.getState().players.every(player => Array.isArray(player.hand)));
    assert.ok(steps < 5000);
});

test('Love Letter pauses at round end until every player is ready', () => {
    const session = LoveLetter.create('ll-round-pause', players(['a', 'b', 'c']));
    session.start();
    const game = session.engine;
    game.deck = [];
    game.players[0].hand = [{ id: 2, value: 2, name: '牧师' }];
    game.players[1].hand = [{ id: 6, value: 6, name: '国王' }];
    game.players[2].hand = [{ id: 3, value: 3, name: '男爵' }];
    assert.equal(game.checkGameEnd(), true);
    assert.equal(game.status, 'round_end');
    assert.equal(game.roundWinner.id, 'b');
    assert.ok(Array.isArray(session.getPlayerState('a').players[0].hand));
    assert.equal(session.handleAction('c', { kind: 'startNextRound' }).success, true);
    assert.equal(game.status, 'round_end');
    assert.equal(session.handleAction('b', { kind: 'startNextRound' }).success, true);
    assert.equal(game.status, 'round_end');
    assert.equal(session.getPlayerState('a').nextRoundReadyCount, 2);
    assert.equal(session.handleAction('a', { kind: 'startNextRound' }).success, true);
    assert.equal(game.status, 'playing');
    assert.equal(game.currentTurnIndex, 1);
});
