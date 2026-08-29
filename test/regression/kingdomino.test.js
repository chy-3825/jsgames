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

test('Kingdomino creates a 48-tile draft and validates connected placement', () => {
    assert.equal(KingdominoEngine.buildDominoes().length, 48);
    const session = Kingdomino.create('kingdomino', players(['a', 'b']));
    assert.equal(session.start().success, true);
    const game = session.engine;
    assert.equal(game.draft.length, 4);
    const tile = game.draft[0];
    const first = game.currentQueue[game.currentQueueIndex].playerId;
    assert.equal(session.handleAction(first, { kind: 'selectDomino', dominoId: tile.id }).success, true);
    const second = game.currentQueue[game.currentQueueIndex].playerId;
    assert.equal(session.handleAction(second, { kind: 'selectDomino', dominoId: game.draft[1].id }).success, true);
    const third = game.currentQueue[game.currentQueueIndex].playerId;
    assert.equal(session.handleAction(third, { kind: 'selectDomino', dominoId: game.draft[2].id }).success, true);
    const fourth = game.currentQueue[game.currentQueueIndex].playerId;
    assert.equal(session.handleAction(fourth, { kind: 'selectDomino', dominoId: game.draft[3].id }).success, true);
    assert.equal(game.phase, 'placing');
    assert.equal(session.handleAction(game.currentQueue[0].playerId, { kind: 'placeDomino', x1: 2, y1: 3, x2: 2, y2: 4 }).success, true);
});

test('Kingdomino scales the draft and discards unchosen tiles in three-player games', () => {
    const session = Kingdomino.create('kingdomino-three', players(['a', 'b', 'c']));
    assert.equal(session.start().success, true);
    const game = session.engine;
    assert.equal(game.draft.length, 3);
    for (const tile of [game.draft[0], game.draft[1], game.draft[2]]) {
        const current = game.currentQueue[game.currentQueueIndex];
        assert.equal(session.handleAction(current.playerId, { kind: 'selectDomino', dominoId: tile.id }).success, true);
    }
    assert.equal(game.phase, 'placing');
    assert.equal(game.discarded.length, 0);
});

test('Kingdomino rejects selecting a domino already claimed by another player', () => {
    const session = Kingdomino.create('kingdomino-duplicate', players(['a', 'b']));
    assert.equal(session.start().success, true);
    const game = session.engine;
    const tile = game.draft[0];
    const firstPlayer = game.currentQueue[game.currentQueueIndex].playerId;
    const secondPlayer = game.currentQueue[(game.currentQueueIndex + 1) % game.currentQueue.length].playerId;
    assert.equal(session.handleAction(firstPlayer, { kind: 'selectDomino', dominoId: tile.id }).success, true);
    assert.equal(session.handleAction(secondPlayer, { kind: 'selectDomino', dominoId: tile.id }).success, false);
    assert.equal(game.selected.size, 1);
});

test('Kingdomino completes a deterministic four-player twelve-round kingdom', () => {
    const game = new KingdominoEngine('kingdomino-full', players(['a', 'b', 'c', 'd']), () => 0);
    assert.equal(game.start().success, true);
    let steps = 0;
    while (game.status === 'playing' && steps < 2000) {
        if (game.phase === 'selecting') {
            const token = game.currentQueue[game.currentQueueIndex];
            const used = new Set([...game.selected.values()].map(tile => tile.id));
            const tile = game.draft.find(candidate => !used.has(candidate.id));
            assert.ok(tile);
            assert.equal(game.handleAction(token.playerId, { kind: 'selectDomino', dominoId: tile.id }).success, true);
        } else {
            const token = game.currentQueue[game.currentQueueIndex];
            const tile = game.selected.get(game._tokenKey(token));
            const player = game.playerMap[token.playerId];
            let placement = null;
            for (let x = 0; x < game.boardSize && !placement; x += 1) for (let y = 0; y < game.boardSize && !placement; y += 1) for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
                const candidate = { first: { x, y }, second: { x: x + dx, y: y + dy } };
                if (game._canPlace(player, tile, candidate)) placement = candidate;
            }
            const result = placement
                ? game.handleAction(player.id, { kind: 'placeDomino', x1: placement.first.x, y1: placement.first.y, x2: placement.second.x, y2: placement.second.y })
                : game.handleAction(player.id, { kind: 'discardDomino' });
            assert.equal(result.success, true, result.message);
        }
        steps += 1;
    }
    assert.equal(game.status, 'ended'); assert.equal(game.round, 12); assert.ok(game.winner); assert.ok(steps < 2000);
});

