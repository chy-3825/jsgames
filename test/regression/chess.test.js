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

test('Room propagates a chess move through the game adapter', () => {
    const room = new Room('chess', 'a', 'a', 'chess'); room.addPlayer({ id: 'a', name: 'a' }); room.addPlayer({ id: 'b', name: 'b' });
    assert.equal(room.startGame().success, true);
    const result = room.handleGameAction('a', { kind: 'move', from: { x: 4, y: 6 }, to: { x: 4, y: 4 } });
    assert.equal(result.success, true); assert.equal(room.getPlayerGameState('b').turn, 'black');
});

test('Chess study editor requires study mode and the trusted room owner', () => {
    const match = Chess.create('chess-match-auth', players(['a', 'b']), 'a', { gameMode: 'match' });
    assert.equal(match.start().success, true);
    assert.equal(match.handleStudySetup('a', { kind: 'clear' }, 'a').success, false);
    assert.equal(match.engine.board.size, 32);

    const study = Chess.create('chess-study-auth', players(['host', 'virtual-black']), 'host', { gameMode: 'study' });
    assert.equal(study.start().success, true);
    assert.equal(study.handleStudySetup('host', { kind: 'clear' }, 'intruder').success, false);
    assert.equal(study.engine.board.size, 32);
    assert.equal(study.handleStudySetup('virtual-black', { kind: 'clear' }, 'host').success, true);
    assert.equal(study.handleStudySetup('virtual-black', { kind: 'place', x: 4, y: 0, color: 'black', pieceType: 'k' }, 'host').success, true);
    assert.equal(study.engine.board.get('4,0').color, 'black');
});

test('Chess validates study positions and rebuilds metadata when the turn changes', () => {
    const study = Chess.create('chess-study-position', players(['host', 'virtual-black']), 'host', { gameMode: 'study' });
    assert.equal(study.start().success, true);
    assert.equal(study.handleStudySetup('host', { kind: 'clear' }, 'host').success, true);
    assert.equal(study.validateStudyPosition().success, false);
    assert.equal(study.handleStudySetup('host', { kind: 'place', x: 4, y: 7, color: 'white', pieceType: 'k' }, 'host').success, true);
    assert.equal(study.handleStudySetup('host', { kind: 'place', x: 4, y: 6, color: 'black', pieceType: 'k' }, 'host').success, true);
    assert.equal(study.validateStudyPosition().success, false);
    assert.equal(study.handleStudySetup('host', { kind: 'move', from: { x: 4, y: 6 }, to: { x: 4, y: 0 } }, 'host').success, false);
    assert.equal(study.handleStudySetup('virtual-black', { kind: 'move', from: { x: 4, y: 6 }, to: { x: 4, y: 0 } }, 'host').success, true);
    study.engine.enPassant = { x: 3, y: 2 };
    study.engine.lastMove = { piece: { type: 'p' } };
    study.engine.halfmoveClock = 99;
    assert.equal(study.handleStudySetup('host', { kind: 'setTurn', color: 'black' }, 'host').success, true);
    assert.equal(study.engine.enPassant, null);
    assert.equal(study.engine.lastMove, null);
    assert.equal(study.engine.halfmoveClock, 0);
    assert.equal(study.validateStudyPosition().success, true);
});

test('Chess repetition key ignores an en-passant target with no legal capture', () => {
    const engine = chessEngine();
    engine.board = new Map([
        ['4,7', { id: 'wk', type: 'k', color: 'white', moved: false }],
        ['4,3', { id: 'wp', type: 'p', color: 'white', moved: false }],
        ['4,0', { id: 'br', type: 'r', color: 'black', moved: false }],
        ['0,0', { id: 'bk', type: 'k', color: 'black', moved: false }],
        ['3,3', { id: 'bp', type: 'p', color: 'black', moved: true }],
    ]);
    engine.turn = 'white'; engine.currentTurnIndex = 0;
    engine.lastMove = { from: { x: 3, y: 1 }, to: { x: 3, y: 3 }, piece: { id: 'bp', type: 'p', color: 'black' } };
    engine.enPassant = { x: 3, y: 2 };
    const withUnavailableTarget = engine._positionKey();
    engine.enPassant = null;
    assert.equal(withUnavailableTarget, engine._positionKey());
});

test('Chess rejects duplicate players and repeated starts', () => {
    assert.throws(() => Chess.create('chess-duplicate', players(['same', 'same'])), /玩家 ID 不能重复/);
    const session = Chess.create('chess-start-once', players(['a', 'b']));
    assert.equal(session.start().success, true);
    assert.equal(session.start().success, false);
});

test('Chess only applies promotion on the last rank', () => {
    const invalid = chessEngine();
    assert.equal(invalid.handleAction('white', { kind: 'move', from: { x: 4, y: 6 }, to: { x: 4, y: 4 }, promotion: 'q' }).success, true);
    assert.equal(invalid.board.get('4,4').type, 'p');

    const ordinary = chessEngine();
    assert.equal(ordinary.handleAction('white', { kind: 'move', from: { x: 4, y: 6 }, to: { x: 4, y: 4 } }).success, true);
    assert.equal(ordinary.board.get('4,4').type, 'p');
});

test('Chess rejects moves that expose or move the king into check', () => {
    const engine = chessEngine();
    engine.board = new Map([
        ['4,7', { id: 'wk', type: 'k', color: 'white', moved: false }],
        ['4,6', { id: 'wr', type: 'r', color: 'white', moved: false }],
        ['4,0', { id: 'br', type: 'r', color: 'black', moved: false }],
        ['0,0', { id: 'bk', type: 'k', color: 'black', moved: false }],
    ]);
    assert.equal(engine.handleAction('white', { kind: 'move', from: { x: 4, y: 6 }, to: { x: 5, y: 6 } }).success, false);
    assert.equal(engine.handleAction('white', { kind: 'move', from: { x: 4, y: 7 }, to: { x: 4, y: 6 } }).success, false);
});

test('Chess en passant is immediate and removes the passed pawn', () => {
    const engine = chessEngine();
    engine.board = new Map([
        ['4,7', { id: 'wk', type: 'k', color: 'white', moved: false }],
        ['4,0', { id: 'bk', type: 'k', color: 'black', moved: false }],
        ['4,3', { id: 'wp', type: 'p', color: 'white', moved: false }],
        ['3,1', { id: 'bp', type: 'p', color: 'black', moved: false }],
    ]);
    engine.turn = 'black'; engine.currentTurnIndex = 1; engine.positionCounts.clear(); engine._recordPosition();
    assert.equal(engine.handleAction('black', { kind: 'move', from: { x: 3, y: 1 }, to: { x: 3, y: 3 } }).success, true);
    assert.equal(engine.handleAction('white', { kind: 'move', from: { x: 4, y: 3 }, to: { x: 3, y: 2 } }).success, true);
    assert.equal(engine.board.get('3,2').id, 'wp');
    assert.equal(engine.board.has('3,3'), false);
});

test('Chess supports legal castling, blocks castling through check, and promotes', () => {
    const engine = chessEngine();
    engine.board = new Map([
        ['4,7', { id: 'wk', type: 'k', color: 'white', moved: false }],
        ['7,7', { id: 'wr', type: 'r', color: 'white', moved: false }],
        ['0,0', { id: 'bk', type: 'k', color: 'black', moved: false }],
    ]);
    assert.equal(engine.handleAction('white', { kind: 'move', from: { x: 4, y: 7 }, to: { x: 6, y: 7 } }).success, true);
    assert.equal(engine.board.get('6,7').type, 'k');
    assert.equal(engine.board.get('5,7').type, 'r');

    const blocked = chessEngine();
    blocked.board = new Map([
        ['4,7', { id: 'wk', type: 'k', color: 'white', moved: false }],
        ['7,7', { id: 'wr', type: 'r', color: 'white', moved: false }],
        ['0,0', { id: 'bk', type: 'k', color: 'black', moved: false }],
        ['5,0', { id: 'br', type: 'r', color: 'black', moved: false }],
    ]);
    assert.equal(blocked.handleAction('white', { kind: 'move', from: { x: 4, y: 7 }, to: { x: 6, y: 7 } }).success, false);

    const promotion = chessEngine();
    promotion.board = new Map([
        ['4,7', { id: 'wk', type: 'k', color: 'white', moved: false }],
        ['0,0', { id: 'bk', type: 'k', color: 'black', moved: false }],
        ['4,1', { id: 'wp', type: 'p', color: 'white', moved: false }],
    ]);
    assert.equal(promotion.handleAction('white', { kind: 'move', from: { x: 4, y: 1 }, to: { x: 4, y: 0 }, promotion: 'n' }).success, true);
    assert.equal(promotion.board.get('4,0').type, 'n');
});

test('Chess distinguishes checkmate from stalemate', () => {
    const mate = chessEngine();
    assert.equal(mate.handleAction('white', { kind: 'move', from: { x: 5, y: 6 }, to: { x: 5, y: 5 } }).success, true);
    assert.equal(mate.handleAction('black', { kind: 'move', from: { x: 4, y: 1 }, to: { x: 4, y: 3 } }).success, true);
    assert.equal(mate.handleAction('white', { kind: 'move', from: { x: 6, y: 6 }, to: { x: 6, y: 4 } }).success, true);
    assert.equal(mate.handleAction('black', { kind: 'move', from: { x: 3, y: 0 }, to: { x: 7, y: 4 } }).success, true);
    assert.equal(mate.status, 'ended');
    assert.equal(mate.winner.id, 'black');

    const stale = chessEngine();
    stale.board = new Map([
        ['0,0', { id: 'bk', type: 'k', color: 'black', moved: false }],
        ['2,2', { id: 'wk', type: 'k', color: 'white', moved: false }],
        ['2,1', { id: 'wq', type: 'q', color: 'white', moved: false }],
    ]);
    stale.turn = 'black'; stale.currentTurnIndex = 1; stale.positionCounts.clear(); stale._recordPosition(); stale._evaluatePosition();
    assert.equal(stale.status, 'ended');
    assert.equal(stale.winner, null);
    assert.equal(stale.drawReason, '困毙和棋');
});

test('Chess exposes every direct checker and the pieces completing a mating net', () => {
    const doubleCheck = chessEngine();
    doubleCheck.board = new Map([
        ['4,0', { id: 'bk', type: 'k', color: 'black', moved: false }],
        ['4,7', { id: 'wr', type: 'r', color: 'white', moved: false }],
        ['1,3', { id: 'wb', type: 'b', color: 'white', moved: false }],
        ['0,7', { id: 'wk', type: 'k', color: 'white', moved: false }],
    ]);
    doubleCheck.turn = 'black'; doubleCheck.currentTurnIndex = 1;
    const checkState = doubleCheck.getPublicState();
    assert.equal(checkState.check, true);
    assert.equal(checkState.checkedKingId, 'bk');
    assert.deepEqual(new Set(checkState.checkingPieceIds), new Set(['wr', 'wb']));
    assert.deepEqual(checkState.checkmateParticipantIds, []);

    const mate = chessEngine();
    mate.board = new Map([
        ['0,0', { id: 'bk', type: 'k', color: 'black', moved: false }],
        ['1,1', { id: 'wq', type: 'q', color: 'white', moved: false }],
        ['2,2', { id: 'wk', type: 'k', color: 'white', moved: false }],
    ]);
    mate.turn = 'black'; mate.currentTurnIndex = 1; mate.positionCounts.clear(); mate._recordPosition(); mate._evaluatePosition();
    const mateState = mate.getPublicState();
    assert.equal(mateState.checkmate, true);
    assert.equal(mateState.checkedKingId, 'bk');
    assert.deepEqual(mateState.checkingPieceIds, ['wq']);
    assert.deepEqual(new Set(mateState.checkmateParticipantIds), new Set(['wq', 'wk']));
});

test('Chess exposes and accepts standard draw claims', () => {
    const engine = chessEngine();
    engine.halfmoveClock = 100;
    assert.equal(engine.getPlayerState('white').canClaimDraw, true);
    assert.equal(engine.handleAction('white', { kind: 'claimDraw' }).success, true);
    assert.equal(engine.status, 'ended');
    assert.equal(engine.drawReason, '五十回合规则和棋');

    const repetition = chessEngine();
    const position = repetition._positionKey();
    repetition.positionCounts.set(position, 3);
    assert.equal(repetition.getPlayerState('white').canClaimDraw, true);
    assert.equal(repetition.handleAction('white', { kind: 'claimDraw' }).success, true);
    assert.equal(repetition.drawReason, '三次重复局面和棋');
});

test('Chess completes a deterministic legal game from the initial position', () => {
    const game = new (require('../../server/games/chess/engine'))('chess-full', players(['white', 'black']), () => 0);
    assert.equal(game.start().success, true);
    let moves = 0;
    while (game.status === 'playing' && moves < 1000) {
        const legal = game._allLegalMoves(game.turn);
        assert.ok(legal.length, `第 ${moves + 1} 手没有可走着法`);
        const move = legal[(moves * 7) % legal.length];
        assert.equal(game.handleAction(game.players[game.currentTurnIndex].id, { kind: 'move', from: move.from, to: move.to, promotion: move.promotion || 'q' }).success, true);
        moves += 1;
    }
    assert.equal(game.status, 'ended'); assert.ok(game.winner || game.drawReason); assert.ok(moves < 1000);
});
