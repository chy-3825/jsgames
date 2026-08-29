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

test('Jungle keeps water and trap capture rules explicit', () => {
    const session = Jungle.create('jungle-rules', players(['a', 'b'])); session.start(); const game = session.engine;
    game.board = new Map([
        ['1,3', { id: 'rat-a', x: 1, y: 3, type: 'r', color: 'red' }],
        ['2,3', { id: 'rat-b', x: 2, y: 3, type: 'r', color: 'blue' }],
        ['0,0', { id: 'den-b', x: 0, y: 0, type: 'e', color: 'blue' }],
    ]);
    assert.ok(game._legalMoves(game.board.get('1,3')).some(move => move.to.x === 2 && move.to.y === 3));
    assert.equal(game._canCapture({ type: 'e', color: 'red', x: 0, y: 1 }, { type: 'r', color: 'blue', x: 0, y: 2 }, { x: 0, y: 2 }), false);
    assert.equal(game._canCapture({ type: 'c', color: 'red', x: 1, y: 1 }, { type: 'r', color: 'blue', x: 2, y: 0 }, { x: 2, y: 0 }), true);
});

test('Jungle completes a full deterministic game through den capture', () => {
    const session = Jungle.create('jungle-full', players(['a', 'b'])); session.start(); const game = session.engine;
    let guard = 0;
    while (game.status === 'playing' && guard++ < 600) {
        const player = game.players.find(item => item.color === game.turn);
        const options = [...game.board.values()].filter(piece => piece.color === game.turn).flatMap(piece => game._legalMoves(piece).map(move => ({ move })));
        assert.ok(options.length);
        const choice = options[guard % options.length].move;
        assert.equal(session.handleAction(player.id, { kind: 'move', from: choice.from, to: choice.to }).success, true);
    }
    assert.equal(game.status, 'ended'); assert.ok(game.winner); assert.ok(guard < 600);
});

