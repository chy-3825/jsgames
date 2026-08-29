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

test('Decrypto rooms let the host lock one of three encryptor selection modes', () => {
    for (const encryptorMode of ['fixed_vote', 'rotation', 'random']) {
        const room = new Room(`decrypto-room-${encryptorMode}`, 'host', '房主', 'decrypto');
        assert.equal(room.addPlayer({ id: 'host', name: '房主' }).success, true);
        assert.deepEqual(room.getInfo().allowedEncryptorModes, ['fixed_vote', 'rotation', 'random']);
        assert.equal(room.configurationConfirmed, false);
        assert.equal(room.isListed(), false);
        assert.equal(room.configure('guest', { encryptorMode }).success, false);
        assert.equal(room.configure('host', { encryptorMode: 'invalid' }).success, false);
        assert.equal(room.configure('host', { encryptorMode }).success, true);
        assert.equal(room.getInfo().gameOptions.encryptorMode, encryptorMode);
        assert.equal(room.isListed(), true);
    }
});

test('Decrypto follows the official first-round order and rotates encryptors', () => {
    assert.ok(DecryptoEngine.WORD_BANK.length >= 4);
    const game = new DecryptoEngine('decrypto', players(['a', 'b', 'c', 'd']), () => 0);
    assert.equal(game.start().success, true);
    assert.equal(game.phase, 'keycheck');
    assert.equal(game.getPlayerState('a').myKeywords.length, 4);
    assert.equal(game.getPlayerState('a').myKeywords.join(','), game.getPlayerState('c').myKeywords.join(','));
    assert.equal(Object.prototype.hasOwnProperty.call(game.getPublicState().teams[0], 'keywords'), false);
    confirmDecryptoKeys(game);
    const encryptor = game.currentTurn.encryptorId;
    const code = game.currentTurn.code.slice();
    assert.equal(game.handleAction(encryptor, { kind: 'submitClue', code: [4, 4, 4], clues: ['晨光', '远行', '回声'] }).success, true);
    assert.equal(game.phase, 'clue');
    assert.equal(game.handleAction(game.roundTurns[1].encryptorId, { kind: 'submitClue', clues: ['蓝晨', '蓝行', '蓝声'] }).success, true);
    const teammate = game.teams[0].members.find(id => id !== encryptor);
    assert.equal(game.phase, 'guessing');
    assert.equal(game.handleAction(game.teams[1].members[0], { kind: 'submitIntercept', code }).success, false);
    assert.equal(game.handleAction(teammate, { kind: 'submitOwnGuess', code }).success, true);
    assert.equal(game.history.length, 1);
    assert.equal(game.history[0].intercept, null);
    assert.equal(game.currentTurn.encryptorId, game.teams[1].members[0]);
    const nextEncryptor = game.currentTurn.encryptorId;
    const nextTeammate = game.teams[1].members.find(id => id !== nextEncryptor);
    assert.equal(game.getPlayerState(nextTeammate).currentCode, null);
});

test('Decrypto completes a full four-player game with miscommunication tiebreak', () => {
    const game = new DecryptoEngine('decrypto-full', players(['a', 'b', 'c', 'd']), () => 0);
    assert.equal(game.start().success, true);
    confirmDecryptoKeys(game);
    const playTeamTurn = ({ correct = true, intercept = false } = {}) => {
        const encryptor = game.currentTurn.encryptorId;
        const code = game.currentTurn.code.slice();
        const wrongCode = code[0] === 1 ? [2, 3, 4] : [1, 2, 3];
        const clueIndex = game.history.length;
        if (game.phase === 'clue') {
            assert.equal(game.handleAction(encryptor, { kind: 'submitClue', clues: [`山${clueIndex}`, `海${clueIndex}`, `风${clueIndex}`] }).success, true);
            const otherEncryptor = game.roundTurns[1].encryptorId;
            assert.equal(game.handleAction(otherEncryptor, { kind: 'submitClue', clues: [`蓝山${clueIndex}`, `蓝海${clueIndex}`, `蓝风${clueIndex}`] }).success, true);
        }
        if (intercept) {
            const opponent = game.teams[1 - game.activeTeam].members[0];
            assert.equal(game.handleAction(opponent, { kind: 'submitIntercept', code: wrongCode }).success, true);
        }
        const teammate = game.teams[game.activeTeam].members.find(id => id !== encryptor);
        assert.equal(game.handleAction(teammate, { kind: 'submitOwnGuess', code: correct ? code : wrongCode }).success, true);
    };
    // Round one: both teams guess internally; interception is not allowed.
    playTeamTurn({ correct: true });
    playTeamTurn({ correct: true });
    assert.equal(game.round, 2);
    // Two complete rounds with intentional internal mistakes lead to a tiebreak.
    playTeamTurn({ correct: false, intercept: true });
    playTeamTurn({ correct: false, intercept: true });
    playTeamTurn({ correct: false, intercept: true });
    playTeamTurn({ correct: false, intercept: true });
    assert.equal(game.phase, 'tiebreak');
    assert.equal(game.history.length, 6);
    assert.equal(game.teams[0].miscommunications, 2);
    assert.equal(game.teams[1].miscommunications, 2);
    const red = game.teams[0].keywords.slice();
    const blue = game.teams[1].keywords.slice();
    assert.equal(game.handleAction('a', { kind: 'tiebreakGuess', keywords: blue }).success, true);
    assert.equal(game.status, 'playing');
    assert.equal(game.handleAction('b', { kind: 'tiebreakGuess', keywords: red.map(() => '不存在') }).success, true);
    assert.equal(game.status, 'ended');
    assert.equal(game.winner.teamId, 0);
});

test('Decrypto supports the official three-player lone-interceptor variant', () => {
    const game = new DecryptoEngine('decrypto-three', players(['a', 'b', 'c']), () => 0);
    assert.equal(game.start().success, true);
    confirmDecryptoKeys(game);
    assert.deepEqual(game.teams.map(team => team.members), [['a', 'b'], ['c']]);
    const submitRound = ({ interceptCode, ownCorrect = true } = {}) => {
        const encryptor = game.currentTurn.encryptorId;
        const actualCode = game.currentTurn.code.slice();
        const wrongCode = actualCode[0] === 1 ? [2, 3, 4] : [1, 2, 3];
        const clueIndex = game.history.length;
        assert.equal(game.handleAction(encryptor, { kind: 'submitClue', clues: [`火${clueIndex}`, `水${clueIndex}`, `土${clueIndex}`] }).success, true);
        if (interceptCode) assert.equal(game.handleAction('c', { kind: 'submitIntercept', code: interceptCode === 'correct' ? actualCode : wrongCode }).success, true);
        assert.equal(game.handleAction(game.teams[0].members.find(id => id !== encryptor), { kind: 'submitOwnGuess', code: ownCorrect ? actualCode : wrongCode }).success, true);
    };
    // First round has no interception. In the second round a missed team guess
    // awards the lone interceptor a token instead of a miscommunication token.
    submitRound();
    assert.equal(game.round, 2);
    submitRound({ interceptCode: 'wrong', ownCorrect: false });
    assert.equal(game.teams[1].interceptions, 1);
    assert.equal(game.teams[0].miscommunications, 0);
    // One successful interception ends the game on the second token.
    submitRound({ interceptCode: 'correct', ownCorrect: true });
    assert.equal(game.status, 'ended');
    assert.equal(game.winner.teamId, 1);
});

test('Decrypto client protects shared secrets and centers online deduction on a 1–4 clue notebook', () => {
    const client = readFrontendSource('decrypto');
    const style = fs.readFileSync('public/games/decrypto/style.css', 'utf8');
    assert.match(client, /data-secret-toggle="keywords"/);
    assert.match(client, /data-secret-code/);
    assert.match(client, /data-code-hold/);
    assert.match(client, /setCodeVisible\(true\)/);
    assert.match(client, /addEventListener\('pointerdown'/);
    assert.match(client, /addEventListener\('pointercancel'/);
    assert.match(client, /addEventListener\('keyup'/);
    assert.match(client, /documentRef\.hidden/);
    assert.match(client, /action: \{ kind: 'confirmKey' \}/);
    assert.match(client, /答案收齐后统一揭晓/);
    assert.match(client, /同桌讨论或所有人都在的公共语音/);
    assert.match(client, /一轮到底在做什么/);
    assert.match(client, /function clueGroups/);
    assert.match(client, /data-notebook-view="matrix"/);
    assert.match(client, /数字—线索推理笔记/);
    assert.match(client, /jsgames\.decrypto\.privacy/);
    assert.match(client, /dc-scene-transition/);
    assert.match(client, /密钥已经封存/);
    assert.match(client, /双方通信已经暴露/);
    assert.match(style, /\.dc-keywords-cover/);
    assert.match(style, /\.dc-code-cover/);
    assert.match(style, /\.dc-ledger-grid/);
    assert.match(style, /\.dc-notebook-overlay/);
    assert.match(style, /@keyframes dcSceneCurtain/);
    assert.match(style, /prefers-reduced-motion/);
});

