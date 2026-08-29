// Pure state builders used by the shell visual acceptance fixture.
// Keeping fixture data outside the HTML runner makes adding a scenario local
// to one module and keeps the URL contract of __game_shell_visual_test.html.

        function fixturePlayers(definitions) {
            return definitions.map(([id, name, color, colorName], index) => ({
                id, name, color, colorName, corner: index === 0 ? 0 : 3,
                targetCorner: index === 0 ? 3 : 0, isOnline: true, isCurrentTurn: index === 0,
            }));
        }

        function fixtureState(gameType) {
            if (gameType === 'jungle') {
                const players = fixturePlayers([['p1', '山林红方', 'red'], ['p2', '河岸蓝方', 'blue']]);
                const pieces = [
                    [0, 0, 'j', 'blue', 'bj0'], [6, 0, 't', 'blue', 'bt0'], [1, 1, 'd', 'blue', 'bd1'], [5, 1, 'c', 'blue', 'bc5'],
                    [0, 2, 'r', 'blue', 'br0'], [2, 2, 'l', 'blue', 'bl2'], [4, 2, 'w', 'blue', 'bw4'], [6, 2, 'e', 'blue', 'be6'],
                    [0, 8, 't', 'red', 'rt0'], [6, 8, 'j', 'red', 'rj6'], [1, 7, 'c', 'red', 'rc1'], [5, 7, 'd', 'red', 'rd5'],
                    [0, 6, 'e', 'red', 're0'], [2, 6, 'w', 'red', 'rw2'], [4, 6, 'l', 'red', 'rl4'], [6, 6, 'r', 'red', 'rr6'],
                ].map(([x, y, pieceType, color, id]) => ({ x, y, type: pieceType, color, id }));
                return { status: 'playing', turn: 'red', currentTurn: 'p1', currentTurnName: '山林红方', players, pieces, myId: 'p1', myColor: 'red', myIsCurrentTurn: true, legalMoves: { rt0: [{ x: 0, y: 7 }], rc1: [{ x: 1, y: 6 }, { x: 2, y: 7 }] }, availableActions: { canMove: true }, actionLog: ['山林红方执红，请开始走棋'], winner: null };
            }
            if (gameType === 'gobang') {
                const players = fixturePlayers([['p1', '执黑玩家', 'black'], ['p2', '执白玩家', 'white']]);
                const placements = [[7, 7, 'black'], [7, 8, 'white'], [8, 7, 'black'], [6, 7, 'white'], [8, 8, 'black'], [6, 8, 'white'], [9, 9, 'black'], [5, 6, 'white'], [9, 7, 'black'], [5, 8, 'white'], [10, 7, 'black'], [4, 9, 'white']];
                const pieces = placements.map(([x, y, color], index) => ({ id: `${color}-${index + 1}`, x, y, color, move: index + 1 }));
                return { status: 'playing', turn: 'black', currentTurn: 'p1', currentTurnName: '执黑玩家', players, pieces, myId: 'p1', myColor: 'black', myIsCurrentTurn: true, legalMoves: { place: [] }, availableActions: { canPlace: true }, lastMove: { x: 4, y: 9, color: 'white' }, actionLog: ['执白玩家落子于 E10', '执黑玩家落子于 K8'], winner: null, drawReason: null };
            }
            if (gameType === 'aeroplane') {
                const definitions = [['p1', '蓝翼队长', 'blue', '蓝方'], ['p2', '绿洲飞手', 'green', '绿方'], ['p3', '红云飞手', 'red', '红方'], ['p4', '金色飞手', 'yellow', '黄方']];
                const players = fixturePlayers(definitions);
                const starts = { blue: 0, green: 13, red: 26, yellow: 39 };
                const planes = players.flatMap((player, playerIndex) => Array.from({ length: 4 }, (_, index) => {
                    const progress = index === 0 ? 7 + playerIndex * 2 : index === 1 && playerIndex === 0 ? -1 : -2;
                    const status = progress === -1 ? 'ready' : progress >= 0 ? 'flying' : 'base';
                    return { id: `${player.id}-plane-${index + 1}`, playerId: player.id, color: player.color, number: index + 1, progress, status, globalPosition: status === 'flying' ? (starts[player.color] + progress) % 52 : null };
                }));
                return { status: 'playing', phase: 'choose_plane', currentTurn: 'p1', currentTurnName: '蓝翼队长', dice: 4, players, planes, movablePlaneIds: ['p1-plane-1', 'p1-plane-2'], myId: 'p1', myColor: 'blue', myIsCurrentTurn: true, availableActions: { canRoll: false, canChoosePlane: true, movablePlaneIds: ['p1-plane-1', 'p1-plane-2'] }, lastMove: null, lastAction: null, actionLog: ['蓝翼队长掷出 4 点', '请选择一架飞机'], winner: null };
            }
            if (gameType === 'checkers') {
                const players = fixturePlayers([['p1', '红方远征队', 'red'], ['p2', '蓝方远征队', 'blue']]);
                const rowCounts = [1, 2, 3, 4, 13, 12, 11, 10, 9, 10, 11, 12, 13, 4, 3, 2, 1];
                const cells = rowCounts.flatMap((count, y) => Array.from({ length: count }, (_, index) => ({ x: 13 - count + index * 2, y })));
                const pieces = [...cells.filter(cell => cell.y <= 3).map((cell, index) => ({ ...cell, id: `p1-piece-${index + 1}`, playerId: 'p1', color: 'red', number: index + 1 })), ...cells.filter(cell => cell.y >= 13).map((cell, index) => ({ ...cell, id: `p2-piece-${index + 1}`, playerId: 'p2', color: 'blue', number: index + 1 }))];
                const pendingMove = { playerId: 'p1', pieceId: 'p1-piece-7', current: { x: 9, y: 3 }, path: [{ x: 9, y: 3 }], jumpCount: 1, mode: 'jump' };
                return { status: 'playing', currentTurn: 'p1', currentTurnName: '红方远征队', players: players.map(player => ({ ...player, pieceCount: 10 })), pieces, pendingMove, myId: 'p1', myColor: 'red', myIsCurrentTurn: true, selectedPiece: { pieceId: 'p1-piece-7', current: { x: 9, y: 3 }, path: [{ x: 9, y: 3 }], jumpCount: 1, mode: 'jump' }, legalMoves: { select: [], step: [], jump: [{ x: 7, y: 5 }] }, availableActions: { canSelect: false, canMove: true, canEndMove: true }, lastMove: null, actionLog: ['红方连续跳跃 1 次，可继续或结束移动'], winner: null };
            }
            if (gameType === 'loveletter') {
                const players = fixturePlayers([
                    ['p1', '甲方玩家'], ['p2', '乙方玩家'], ['p3', '丙方玩家'], ['p4', '丁方玩家'],
                ]).map((player, index) => ({ ...player, handCount: index ? 1 : 2, isAlive: true, isOut: false, isProtected: false }));
                return {
                    status: 'playing', phase: 'turn', hostId: 'p1', round: 1, currentTurn: 'p1', currentTurnName: '甲方玩家',
                    players, deckCount: 10, reservedCount: 1, setAsideCount: 0, publicDiscard: [], pendingAction: null, lastAction: null,
                    targetFavor: 4, favorTokens: players.map(player => ({ id: player.id, count: 0 })), winner: null, winners: [], roundWinner: null, roundWinners: [],
                    myHand: [
                        { id: 4, value: 4, name: '侍女', description: '保护自己到下一回合。', cardId: '4_0' },
                        { id: 1, value: 1, name: '侍卫', description: '猜一名玩家的手牌。', cardId: '1_0' },
                    ],
                    myId: 'p1', myIsCurrentTurn: true,
                };
            }
            if (gameType === 'guessnumber') {
                const history = [];
                return {
                    status: 'playing', currentTurn: 'p1', currentTurnName: '破译员', myId: 'p1', myIsCurrentTurn: true,
                    players: [{ id: 'p1', name: '破译员', attempts: 0, history }],
                    availableActions: { canGuess: true }, lastResult: null, secret: null, winner: null,
                };
            }
            if (gameType === 'coup') {
                const names = ['甲方玩家', '乙方玩家', '丙方玩家', '丁方玩家', '戊方玩家', '己方玩家'];
                const players = names.map((name, index) => ({
                    id: `p${index + 1}`, name, coins: 2, isAlive: true, isOnline: true, isSelf: index === 0,
                    influences: index === 0
                        ? [{ role: 'captain', revealed: false }, { role: 'assassin', revealed: false }]
                        : [{ role: null, revealed: false }, { role: null, revealed: false }],
                }));
                return {
                    roomId: 'visual', phase: 'idle', currentTurn: 'p1', players, gameOver: false, winner: null, interaction: null,
                    lastReveal: null, challenge: null, actionLog: ['游戏开始！'], myId: 'p1',
                    self: { id: 'p1', coins: 2, influences: players[0].influences },
                };
            }
            if (gameType === 'takefive') {
                const values = [8, 17, 26, 35, 44, 53, 62, 71, 80, 89];
                const bullheads = value => value === 55 ? 7 : value % 11 === 0 ? 5 : value % 10 === 0 ? 3 : value % 5 === 0 ? 2 : 1;
                const card = value => ({ id: `card-${value}`, value, bullheads: bullheads(value) });
                const players = ['甲方玩家', '乙方玩家', '丙方玩家', '丁方玩家', '戊方玩家', '己方玩家', '庚方玩家', '辛方玩家', '壬方玩家', '癸方玩家']
                    .map((name, index) => ({ id: `p${index + 1}`, name, score: index * 4, bullPileCount: index % 3, handCount: 10, isOnline: true, hasSelected: index > 3 }));
                return {
                    roomId: 'visual', status: 'playing', phase: 'selecting', variant: 'standard', round: 4, maxRounds: 10,
                    handNumber: 1, maxHands: null, targetScore: 66, deckCount: 0, selectedCount: 6, playerCount: 10,
                    rows: [[card(12), card(18)], [card(29), card(41), card(47)], [card(55)], [card(63), card(74), card(82), card(91)]],
                    revealedCards: [], resolutionEvent: null, handSettlement: null, draft: null, pendingRowChoice: null,
                    lastResolution: [], lastHand: null, players, actionLog: ['六名玩家已经锁定手牌', '等待其他玩家同时选牌'],
                    winner: null, winners: [], myId: 'p1', mySelectedCardId: null,
                    myHand: values.map(card), myBullPileCount: 0, availableActions: { canSelect: true, canDraft: false, canChooseRow: false },
                };
            }
            if (gameType === 'monopolydeal') {
                const colors = ['brown', 'lightblue', 'pink', 'orange', 'red', 'yellow', 'green', 'blue', 'railroad', 'utility'];
                const emptyMap = () => Object.fromEntries(colors.map(color => [color, color === 'brown' || color === 'blue' || color === 'utility' ? 0 : 0]));
                const players = ['甲方玩家', '乙方玩家', '丙方玩家', '丁方玩家', '戊方玩家'].map((name, index) => ({
                    id: `p${index + 1}`, name, handCount: index ? 5 : 7, bankValue: index ? index + 1 : 0, bank: [],
                    properties: Object.fromEntries(colors.map(color => [color, []])), propertyGroups: [], houses: emptyMap(), hotels: emptyMap(),
                    isOnline: true, isCurrentTurn: index === 0, completedSets: 0,
                }));
                return {
                    roomId: 'visual', status: 'playing', phase: 'play', turnNumber: 1, currentTurn: 'p1', currentTurnName: '甲方玩家', cardsPlayed: 0,
                    deckCount: 79, discard: [], discardCount: 0, pendingAction: null, pendingDebt: null, interaction: null,
                    lastAction: { kind: 'drawCards', playerId: 'p1', playerName: '甲方玩家', message: '甲方玩家摸了 2 张牌' },
                    actionLog: ['游戏开始，甲方玩家先行动', '甲方玩家摸了 2 张牌'], players, winner: null,
                    myId: 'p1', myIsCurrentTurn: true, myBank: [], myPendingDoubleRent: false, myRentMultiplier: 1, myPaymentOptions: [],
                    myHand: [
                        { id: 'a-debt', kind: 'action', action: 'debtCollector', value: 3, name: '收取债务' },
                        { id: 'm-1', kind: 'money', value: 1, name: '1M 现金' },
                        { id: 'p-brown', kind: 'property', color: 'brown', value: 1, name: '棕色地产' },
                        { id: 'a-pass', kind: 'action', action: 'passGo', value: 1, name: '通行证' },
                        { id: 'w-red-yellow', kind: 'property_wild', colors: ['red', 'yellow'], value: 3, name: '红色/黄色万能地产' },
                        { id: 'a-no', kind: 'action', action: 'justSayNo', value: 4, name: '做出反对' },
                        { id: 'm-5', kind: 'money', value: 5, name: '5M 现金' },
                    ],
                    availableActions: { canDraw: false, canPlay: true, canMoveProperty: true, canEndTurn: true, canDiscard: false, canRespond: false, canPayDebt: false },
                    rules: { colorSize: Object.fromEntries(colors.map(color => [color, ['brown', 'blue', 'utility'].includes(color) ? 2 : color === 'railroad' ? 4 : 3])) },
                };
            }
            if (gameType === 'hanabi') {
                const colors = ['red', 'yellow', 'green', 'blue', 'white'];
                const names = ['甲方玩家', '乙方玩家', '丙方玩家', '丁方玩家', '戊方玩家'];
                const visibleHands = [
                    [['red', 1], ['blue', 3], ['white', 2], ['yellow', 4]],
                    [['green', 1], ['red', 3], ['blue', 2], ['white', 5]],
                    [['yellow', 1], ['green', 4], ['red', 2], ['blue', 1]],
                    [['white', 1], ['yellow', 3], ['green', 2], ['red', 5]],
                ];
                const myHand = Array.from({ length: 4 }, (_, index) => ({
                    id: `mine-${index + 1}`, color: null, value: null,
                    hints: { colors: index === 0 ? ['red'] : [], values: index === 1 ? [2] : [], notColors: [], notValues: [] }, hidden: true,
                }));
                const players = names.map((name, index) => ({
                    id: `p${index + 1}`, name, handCount: 4, isOnline: true, isCurrentTurn: index === 0,
                    hand: index === 0 ? myHand : visibleHands[index - 1].map(([color, value], cardIndex) => ({ id: `p${index + 1}-${cardIndex + 1}`, color, value, hints: null, hidden: false })),
                }));
                return {
                    roomId: 'visual', status: 'playing', phase: 'action', currentTurn: 'p1', currentTurnName: '甲方玩家', startingPlayerId: 'p1',
                    clues: 7, strikes: 1, maxStrikes: 3, deckCount: 30, finalTurnsRemaining: null, endReason: null,
                    fireworks: Object.fromEntries(colors.map((color, index) => [color, index % 3])), discard: [], players,
                    actionLog: ['甲方玩家先行动。记住：你看不到自己的牌。'], lastAction: null, winner: null, score: 4, scoreRating: '刚刚起步',
                    myId: 'p1', myHand, availableActions: { canAct: true, canGiveClue: true, canPlay: true, canDiscard: true },
                };
            }
            if (gameType === 'splendor') {
                const colors = ['white', 'blue', 'green', 'red', 'black'];
                const tokens = overrides => Object.fromEntries([...colors, 'gold'].map(color => [color, overrides?.[color] || 0]));
                const card = (id, tier, bonus, points, costs) => ({ id, tier, bonus, points, cost: Object.fromEntries(colors.map(color => [color, costs?.[color] || 0])) });
                const market = {
                    1: [card('s1', 1, 'white', 0, { blue: 1, green: 1 }), card('s2', 1, 'blue', 0, { red: 2 }), card('s3', 1, 'green', 1, { black: 3 }), card('s4', 1, 'red', 0, { white: 2, blue: 1 })],
                    2: [card('s5', 2, 'black', 2, { white: 3, red: 2 }), card('s6', 2, 'green', 1, { blue: 3, black: 2 }), card('s7', 2, 'white', 2, { green: 4 }), card('s8', 2, 'blue', 3, { red: 5 })],
                    3: [card('s9', 3, 'red', 4, { white: 6 }), card('s10', 3, 'black', 5, { blue: 7 }), card('s11', 3, 'green', 4, { red: 3, black: 3 }), card('s12', 3, 'white', 3, { green: 5, blue: 3 })],
                };
                const nobles = Array.from({ length: 5 }, (_, index) => ({ id: `n${index + 1}`, name: `贵族 ${index + 1}`, points: 3, requirements: { [colors[index]]: 4, [colors[(index + 1) % 5]]: 4 } }));
                const players = ['甲方商会', '乙方商会', '丙方商会', '丁方商会'].map((name, index) => ({ id: `p${index + 1}`, name, points: index * 3, cardCount: index * 2, reservedCount: index % 2, tokens: tokens({ white: 1, blue: index }), isOnline: true, isCurrentTurn: index === 0 }));
                return {
                    roomId: 'visual', status: 'playing', phase: 'action', currentTurn: 'p1', currentTurnName: '甲方商会', startingPlayerId: 'p1',
                    finalRoundStart: null, endReason: null, tokens: tokens({ white: 7, blue: 6, green: 5, red: 7, black: 4, gold: 5 }), market, nobles,
                    pendingNoble: null, pendingTokenReturn: null, players, actionLog: ['甲方商会正在选择第一笔交易'], presentation: null,
                    winner: null, winners: [], myId: 'p1', myTokens: tokens({ white: 2, blue: 2, green: 1, gold: 1 }), myCards: [card('mine-1', 1, 'red', 0, {})],
                    myReserved: [card('reserve-1', 2, 'blue', 2, { white: 3, green: 2 })], availableActions: { canAct: true, canChooseNoble: false, canReturnTokens: false, returnTokenCount: 0 },
                };
            }
            if (gameType === 'kingdomino') {
                const tile = (id, number, left, right, crowns = [0, 0]) => ({ id, number, left, right, crowns, selectedBy: null });
                const draft = [tile('k1', 8, '麦田', '森林', [0, 1]), tile('k2', 17, '海洋', '草地'), tile('k3', 26, '沼泽', '麦田', [1, 0]), tile('k4', 39, '矿山', '森林', [2, 0])];
                const players = ['甲方国王', '乙方国王', '丙方国王', '丁方国王'].map((name, index) => ({ id: `p${index + 1}`, name, color: ['#d6a63d', '#5fa3bb', '#b75b55', '#77a46e'][index], score: index * 5, placedCount: index + 1, selectionCount: 0, hasSelection: false, isOnline: true, isCurrentTurn: index === 0 }));
                return {
                    roomId: 'visual', status: 'playing', phase: 'selecting', round: 4, maxRounds: 12, boardSize: 5, draftSize: 4, remainingTileCount: 28,
                    discardedTileCount: 0, currentTurn: 'p1', currentToken: { playerId: 'p1', token: 0 }, currentTurnName: '甲方国王', draft, players,
                    lastAction: { message: '新一轮领地已经揭晓' }, actionLog: ['第 4 轮开始', '甲方国王准备选择领地'], presentation: null, winner: null,
                    myId: 'p1', myGrid: { '2,2': { terrain: '城堡', crowns: 0 }, '2,1': { terrain: '麦田', crowns: 0, dominoId: 'old-1' }, '3,1': { terrain: '森林', crowns: 1, dominoId: 'old-1' } },
                    mySelectedTiles: [], mySelectedTile: null, availableActions: { canSelect: true, canPlace: false, canDiscard: false },
                };
            }
            if (gameType === 'acquire') {
                const chainData = [
                    ['sackson', 'S', '萨克森', '#d05793', 5, 16, 400], ['imperial', 'I', '帝国', '#e77b3c', 12, 11, 700],
                    ['america', 'A', '美洲', '#4b8fd2', 0, 25, 0], ['festival', 'F', '节庆', '#c5a33a', 0, 25, 0],
                    ['worldwide', 'W', '环球', '#66a578', 3, 20, 300], ['continental', 'C', '大陆', '#8068b2', 0, 25, 0], ['tower', 'T', '塔楼', '#55aeb3', 0, 25, 0],
                ];
                const corporations = Object.fromEntries(chainData.map(([id, short, name, color, size, sharesAvailable, sharePrice]) => [id, { id, short, name, color, size, sharesAvailable, sharePrice, active: size > 0 }]));
                const players = ['甲方投资人', '乙方投资人', '丙方投资人', '丁方投资人'].map((name, index) => ({ id: `p${index + 1}`, name, cash: 6000 - index * 400, shares: { sackson: index + 1, imperial: index % 2, worldwide: 0 }, handCount: 6, isOnline: true, isCurrentTurn: index === 0 }));
                const board = { A1: { id: 'A1', row: 0, col: 0, chain: null }, C4: { id: 'C4', row: 2, col: 3, chain: 'sackson' }, C5: { id: 'C5', row: 2, col: 4, chain: 'sackson' }, D4: { id: 'D4', row: 3, col: 3, chain: 'sackson' }, E7: { id: 'E7', row: 4, col: 6, chain: 'imperial' }, E8: { id: 'E8', row: 4, col: 7, chain: 'imperial' }, F7: { id: 'F7', row: 5, col: 6, chain: 'imperial' }, H10: { id: 'H10', row: 7, col: 9, chain: 'worldwide' } };
                return {
                    roomId: 'visual', status: 'playing', phase: 'place', currentTurn: 'p1', currentTurnName: '甲方投资人', deckCount: 72,
                    players, board, corporations, pendingMerger: null, mergerSettlement: null, endGamePending: false,
                    actionLog: ['甲方投资人正在选择建筑地块', '帝国集团达到安全规模'], presentation: null, winner: null,
                    myId: 'p1', myHand: [{ id: 'B2', row: 1, col: 1 }, { id: 'D5', row: 3, col: 4 }, { id: 'F8', row: 5, col: 7 }, { id: 'G3', row: 6, col: 2 }, { id: 'H11', row: 7, col: 10 }, { id: 'I6', row: 8, col: 5 }],
                    availableActions: { canPlace: true, canDiscard: false, canSkipPlacement: false, canFound: false, canChooseMerger: false, canSettleMerger: false, canBuy: false, canEndGame: false },
                };
            }
            if (gameType === 'citadels') {
                const roles = [
                    ['assassin', 1, '刺客'], ['thief', 2, '盗贼'], ['magician', 3, '魔术师'], ['king', 4, '国王'],
                    ['bishop', 5, '主教'], ['merchant', 6, '商人'], ['architect', 7, '建筑师'], ['warlord', 8, '军阀'],
                ].map(([id, rank, name]) => ({ id, rank, name }));
                const card = (id, name, color, cost, effect = null) => ({ id, name, color, cost, points: cost, effect });
                const cities = [card('city-1', '庄园', 'noble', 3), card('city-2', '神殿', 'religious', 1), card('city-3', '市场', 'trade', 2), card('city-4', '瞭望塔', 'military', 1)];
                const players = ['甲方城主', '乙方城主', '丙方城主', '丁方城主'].map((name, index) => ({
                    id: `p${index + 1}`, name, gold: 5 - index, city: cities.slice(0, Math.max(1, 4 - index)), handCount: 4, roles: [], murderedRoles: [], isOnline: true,
                }));
                return {
                    roomId: 'visual', status: 'playing', phase: 'role_selection', round: 4, crownHolderId: 'p1', draftPlayerId: 'p1', draftDiscarding: false,
                    currentPlayerId: null, currentRoleRank: null, currentRoleName: null, roleDeckCount: 5, faceDownCount: 1, faceUpRoles: [roles[7]],
                    availableRoles: roles.slice(0, 5), discardOptions: [], players, actionLog: ['第 4 轮秘密选角开始'], presentation: null,
                    districtDeckCount: 43, pendingGraveyard: null, destroyTargets: [], scores: [], winner: null, winners: [], myId: 'p1', myRoles: [],
                    myHand: [card('hand-1', '城堡', 'noble', 4), card('hand-2', '修道院', 'religious', 3), card('hand-3', '贸易站', 'trade', 2), card('hand-4', '实验室', 'unique', 5, 'laboratory')],
                    myDrawOptions: [], myDrawKeepCount: 1, availableActions: { chooseRole: true },
                };
            }
            if (gameType === 'lasvegas') {
                const colors = ['red', 'blue', 'green', 'violet', 'gold'];
                const players = ['甲方赌客', '乙方赌客', '丙方赌客', '丁方赌客', '戊方赌客'].map((name, index) => ({
                    id: `p${index + 1}`, name, color: colors[index], money: index * 20, banknoteCount: index, diceRemaining: 8 - index, neutralDiceRemaining: 0, placedCount: index, isOnline: true,
                }));
                const casinos = Array.from({ length: 6 }, (_, index) => ({ face: index + 1, money: [[50, 20], [60], [40, 20], [90], [50, 10], [70]][index], dice: index < 3 ? { p2: index + 1, p3: 1 } : {} }));
                return {
                    roomId: 'visual', status: 'playing', round: 2, maxRounds: 4, currentTurn: 'p1', myId: 'p1', myTurn: true,
                    players, neutral: null, casinos, currentRoll: [], currentRollOwn: [], currentRollNeutral: [], moneyDeckCount: 31,
                    lastPayouts: [{ playerId: 'p2', playerName: '乙方赌客', amount: 60, casino: 2, dice: 3 }],
                    actionLog: ['第 2 轮开始', '甲方赌客准备掷骰'], presentation: null, winners: [], availableActions: { canRoll: true, canPlaceFaces: [] },
                };
            }
            if (gameType === 'scout') {
                const card = (id, front, back, orientation = 0) => ({ id, front, back, orientation, value: orientation ? back : front, otherValue: orientation ? front : back });
                const players = ['甲方马戏团', '乙方马戏团', '丙方马戏团', '丁方马戏团', '戊方马戏团'].map((name, index) => ({ id: `p${index + 1}`, name, seat: index + 1, score: index * 2, handCount: 9 - index, captured: index, scoutTokens: index % 2, isCurrent: index === 0, isOnline: true }));
                return {
                    roomId: 'visual', status: 'playing', phase: 'orienting', round: 2, maxRounds: 5, startPlayerId: 'p1', currentPlayerId: null, currentPlayerName: null,
                    players, activeSet: [], activeOwnerId: null, activeOwnerName: null, actionLog: ['第 2 轮开始，请锁定节目单方向'], presentation: null,
                    myId: 'p1', myHand: [card('s1', 1, 6), card('s2', 2, 8), card('s3', 3, 7), card('s4', 4, 9), card('s5', 5, 10), card('s6', 6, 9), card('s7', 7, 10), card('s8', 3, 8), card('s9', 4, 7)],
                    myScoutShowAvailable: true, myScoutChips: null, availableActions: { canSetOrientation: true, canShow: false, canScout: false, canScoutShow: false }, winners: [],
                };
            }
            if (gameType === 'manila') {
                const players = ['甲方船主', '乙方商人', '丙方经理', '丁方保险家', '戊方海盗'].map((name, index) => ({
                    id: `p${index + 1}`, name, color: ['#c96555', '#4f8bb0', '#c79442', '#778f68', '#8b6598'][index], cash: 30 - index * 2,
                    sharesCount: 3 - (index % 2), encumberedShares: index === 0 ? 1 : 0, accomplices: Math.max(0, 3 - index % 3), isOnline: true, fortune: null,
                }));
                const locations = Object.fromEntries(['ginseng', 'jade', 'nutmeg', 'silk', 'port-a', 'port-b', 'port-c', 'shipyard-a', 'shipyard-b', 'shipyard-c', 'pirate', 'pilot-small', 'pilot-large', 'insurance'].map(id => [id, []]));
                locations.jade = [{ playerId: 'p2', playerName: '乙方商人', fee: 3, slot: 1 }];
                locations['pilot-large'] = [{ playerId: 'p1', playerName: '甲方船主', fee: 5, slot: 1 }];
                return {
                    roomId: 'visual', status: 'playing', phase: 'auction', voyage: 3, movementRound: 0, masterStep: null,
                    harborMasterId: 'p1', harborMasterName: '甲方船主', currentTurn: 'p1', currentTurnName: '甲方船主', myId: 'p1',
                    players, locations, market: { '人参': 15, '玉石': 20, '肉豆蔻': 10, '丝绸': 25 }, shareMarket: { '人参': 2, '玉石': 3, '肉豆蔻': 1, '丝绸': 2 },
                    myShares: ['玉石', '丝绸', '人参'], myEncumberedShares: [2], auction: { highestBid: 8, highestBidder: 'p1', passed: [] },
                    boats: [{ id: 1, good: '人参', position: 4, fate: 'sailing', arrived: false, accomplices: 1 }, { id: 2, good: '玉石', position: 7, fate: 'sailing', arrived: false, accomplices: 2 }, { id: 3, good: '肉豆蔻', position: 10, fate: 'sailing', arrived: false, accomplices: 1 }],
                    movementPlan: null, pendingPlunder: null, presentation: null, winner: null, availableActions: { bid: true, pass: true },
                    actionLog: ['第 3 次航行开始', '甲方船主正在竞价港务长'],
                };
            }
            if (gameType === 'modernart') {
                const cards = [
                    ['ma-1', 'matisse', '马蒂斯', 'open'], ['ma-2', 'cassat', '卡萨特', 'once'], ['ma-3', 'yoshida', '吉田', 'sealed'],
                    ['ma-4', 'bruegel', '勃鲁盖尔', 'fixed'], ['ma-5', 'clyfford', '克里福特', 'double'], ['ma-6', 'clyfford', '克里福特', 'open'],
                ].map(([id, artistId, artistName, auctionType]) => ({ id, artistId, artistName, auctionType }));
                const players = ['甲方藏家', '乙方画廊', '丙方策展人', '丁方买家', '戊方经纪人'].map((name, index) => ({
                    id: `p${index + 1}`, name, color: ['#d45f54', '#4d82a6', '#bf8b3e', '#6d9466', '#89689e'][index], cash: index ? null : 78,
                    handCount: 6 - index, collectionCount: index % 3, isOnline: true,
                }));
                return {
                    roomId: 'visual', status: 'playing', phase: 'auction', round: 2, maxRounds: 4, currentTurn: 'p1', currentTurnName: '甲方藏家', myId: 'p1', myCash: 78,
                    rules: { players: '3–5', rounds: 4, marketThreshold: 5, moneyHidden: true, mysteryPlayer: false }, mysteryCount: 0,
                    roundCounts: { matisse: 3, cassat: 4, yoshida: 1, bruegel: 2, clyfford: 2 }, artistValues: { matisse: 30, cassat: 20, yoshida: 0, bruegel: 10, clyfford: 0 },
                    auction: null, doubleOffer: null, mysteryOffer: null, players, myHand: cards, myCollection: cards.slice(1, 3),
                    market: [{ cardId: 'sold-1', artistId: 'matisse', artistName: '马蒂斯', price: 12 }, { cardId: 'sold-2', artistId: 'cassat', artistName: '卡萨特', price: 16 }],
                    history: [{ round: 1, market: [1, 2, 3], values: { matisse: 30, cassat: 20, bruegel: 10 }, cumulativeValues: { matisse: 30, cassat: 20, bruegel: 10 } }],
                    availableActions: { startAuction: true }, actionLog: ['第 2 季展览开始', '甲方藏家正在选择作品'], presentation: null, winner: null, winners: [],
                };
            }
            if (gameType === 'camelup') {
                const camels = [
                    ['red', '赤焰', '#cf4d3f', 10, 1], ['blue', '海蓝', '#347f9d', 10, 0], ['green', '绿洲', '#56865b', 7, 0], ['yellow', '金沙', '#d89a2e', 5, 1], ['white', '月白', '#a5aba8', 5, 0],
                ].map(([id, name, color, position, order]) => ({ id, name, color, position, order }));
                const players = ['甲方驯驼师', '乙方观赛客', '丙方商人', '丁方旅人', '戊方领队'].map((name, index) => ({
                    id: `p${index + 1}`, name, color: ['#c75244', '#467f9c', '#c09137', '#63865c', '#83699a'][index], cash: 17 - index,
                    pyramidTileCount: index % 2, legBetCount: index % 3, overallBetCount: index % 2, finishCardCount: 5 - index % 2, isOnline: true,
                }));
                return {
                    roomId: 'visual', status: 'playing', phase: 'leg', leg: 3, currentTurn: 'p1', currentTurnName: '甲方驯驼师', myId: 'p1',
                    rolled: ['green', 'white'], ranking: ['red', 'blue', 'green', 'yellow', 'white'], legTiles: { red: 2, blue: 3, green: 1, yellow: 2, white: 3 }, camels,
                    tiles: { 3: { ownerId: 'p2', ownerName: '乙方观赛客', kind: 'oasis' }, 13: { ownerId: 'p1', ownerName: '甲方驯驼师', kind: 'mirage' } }, players,
                    myRaceCards: ['red', 'blue', 'green', 'yellow', 'white'].map(id => ({ id: `finish-p1-${id}`, camelId: id, ownerId: 'p1' })),
                    myLegBets: [{ camelId: 'red', payout: 5 }], myOverallBets: [], myPyramidTiles: 1, overallBetPiles: { winner: 2, loser: 1 },
                    lastLeg: { leg: 2, ranking: ['blue', 'red', 'yellow', 'green', 'white'], payouts: [], pyramidRewards: [] },
                    availableActions: { rollDie: true, betLeg: true, betOverall: true, placeTile: true }, actionLog: ['第 3 赛段开始', '轮到甲方驯驼师'], winner: null, winners: [], presentation: null,
                };
            }
            if (gameType === 'magicalathlete') {
                const athlete = (id, name, description) => ({ id, name, description, used: false });
                const athletes = [
                    athlete('alchemist', '炼金术师', '主移动较小时可改为前进 4 格。'), athlete('banana', '香蕉', '超过我的运动员会摔倒。'),
                    athlete('egg', '蛋', '赛前抽取候选运动员并复制能力。'), athlete('genius', '天才', '预测主移动骰子点数。'),
                    athlete('hypnotist', '催眠师', '可传送一名运动员。'), athlete('magician', '魔法师', '可重掷主移动。'),
                    athlete('mouth', '大嘴', '与一名对手同格时淘汰对方。'), athlete('rocketscientist', '火箭医生', '可翻倍主移动，之后摔倒。'),
                    athlete('twin', '双胞胎', '复制上一场冠军能力。'), athlete('hare', '快兔', '主移动额外前进。'),
                ];
                const players = ['甲方教练', '乙方选手', '丙方领队', '丁方运动员', '戊方队长', '己方选手'].map((name, index) => ({ id: `p${index + 1}`, name, color: ['#dc6256', '#4c83ad', '#c18c3a', '#6d966a', '#80699b', '#228c83'][index], score: 5 - index, bronze: index % 2, isOnline: true }));
                const racers = athletes.slice(0, 6).map((item, index) => ({ id: `r${index + 1}`, playerId: `p${index + 1}`, athleteId: item.id, athlete: item, athleteName: item.name, playerName: players[index].name, position: [13, 16, 9, 7, 5, 11][index], tripped: false, eliminated: false, finishOrder: null, bronze: index % 2, copiedAthlete: null }));
                return {
                    roomId: 'visual', status: 'playing', phase: 'race', match: 2, maxMatches: 4, teamSize: 4, racersPerPlayer: 1, trackSide: 'wild', trackLength: 30, draftRound: 2,
                    draftPool: athletes.slice(0, 6), currentTurn: 'p1', currentTurnName: '甲方教练', myId: 'p1', athletes, players, racers,
                    trackSpecials: { 1: 'star', 5: 'trip', 7: 'arrow+3', 11: 'arrow+1', 13: 'star', 15: 'arrow-4', 16: 'trip', 22: 'arrow+2', 23: 'arrow-2', 25: 'trip' },
                    history: [{ match: 1, trackSide: 'mild', ranking: [{ place: 1, playerId: 'p1', athleteId: 'alchemist', gold: 2, silver: 0 }, { place: 2, playerId: 'p2', athleteId: 'banana', gold: 0, silver: 1 }] }],
                    prompt: null, acknowledgement: null, actionLog: ['第 2 场使用狂野赛道', '轮到甲方教练行动'],
                    myTeam: athletes.slice(0, 4).map((item, index) => ({ ...item, used: index === 0 })), myRaceSelections: [], myBronze: 1, myAthlete: athletes[3], myRacer: { ...racers[0], roll: null, extraTurn: false },
                    raceSelectionStatus: players.map(player => ({ playerId: player.id, selectedCount: 0, ready: false })), availableActions: { roll: true }, winner: null, winners: [], presentation: null,
                };
            }
            if (gameType === 'werewolf') {
                const roles = ['seer', 'werewolf', 'witch', 'hunter', 'guard', 'villager', 'villager', 'werewolf', 'villager'];
                const seats = roles.map((role, index) => ({
                    number: index + 1, role, controllerName: `${['甲','乙','丙','丁','戊','己','庚','辛','壬'][index]}方玩家`,
                    alive: true, canControl: index === 0, roleConfirmed: true, dayReady: false, isSheriff: index === 0,
                }));
                return {
                    status: 'playing', phase: 'nightSeer', phaseName: '预言家查验', nextPhaseName: '女巫行动',
                    phaseInstruction: '选择一名玩家查看阵营', phaseProgress: { completed: 0, total: 1, label: '预言家待行动' },
                    playerCount: 9, day: 1, activeSeat: 1, myRole: 'seer', myRoleConfirmed: true, seats,
                    skillState: { available: true, submitted: false }, legalTargetSeats: [2, 3, 4, 5, 6, 7, 8, 9],
                    myId: 'p1', voteProgress: { completed: 0, total: 9 }, actionLog: ['第 1 夜开始', '预言家请睁眼'],
                    sheriff: { enabled: true, currentCandidate: null }, sheriffAction: null, announcement: null,
                    lastVoteResult: null, winner: null,
                };
            }
            if (gameType === 'avalon') {
                const names = ['圆桌甲', '圆桌乙', '圆桌丙', '圆桌丁', '圆桌戊', '圆桌己', '圆桌庚', '圆桌辛', '圆桌壬', '圆桌癸'];
                const players = names.map((name, index) => ({
                    id: `p${index + 1}`, name, seat: index + 1, role: null, roleConfirmed: true, isOnline: true,
                    isLeader: index === 0,
                }));
                const team = players.slice(0, 4);
                return {
                    status: 'playing', phase: 'vote', round: 1, leaderId: 'p1', leaderName: '圆桌甲', missionSize: 4,
                    roleConfirmCount: 10, players, team, myId: 'p1', myRole: 'merlin', myRoleConfirmed: true,
                    knownPlayers: [{ id: 'p2', name: '圆桌乙', seat: 2 }], availableActions: { castVote: true },
                    voteCount: 6, missionVoteCount: 0, myVote: null, myMissionVote: null, rejectedTeams: 1,
                    successfulMissions: 1, failedMissions: 0, missionHistory: [{ round: 1, success: true, team, fails: 0 }],
                    lastVote: { p2: true, p3: false, p4: true, p5: true, p6: true, p7: true }, actionLog: ['第 2 项任务提案已经公布', '圆桌正在秘密表决'],
                    winner: null, assassinationTargets: [],
                };
            }
            if (gameType === 'decrypto') {
                const names = ['红队甲', '蓝队甲', '红队乙', '蓝队乙', '红队丙', '蓝队丙', '红队丁', '蓝队丁'];
                const players = names.map((name, index) => ({ id: `p${index + 1}`, name, seat: index + 1, team: index % 2, isOnline: true, keyConfirmed: true }));
                const teams = [0, 1].map(id => ({
                    id, name: id === 0 ? '红队' : '蓝队', members: players.filter(player => player.team === id).map(player => ({ id: player.id, name: player.name })),
                    miscommunications: id === 0 ? 1 : 0, interceptions: id === 1 ? 1 : 0,
                }));
                return {
                    roomId: 'visual', status: 'playing', phase: 'guessing', round: 3, activeTeam: 0, currentTeam: 0,
                    currentTeamName: '红队', currentClues: ['森林', '钟声', '剧院'], currentCode: null, encryptorId: 'p3', encryptorName: '红队乙',
                    keyConfirmCount: 8, encryptorVoteCount: 0, interceptSubmitted: false, ownGuessSubmitted: false,
                    teams, players, myId: 'p1', myTeam: 0, myKeywords: ['灯塔', '森林', '剧院', '地图'],
                    availableActions: { submitOwnGuess: true }, history: [{ round: 2, team: 1, teamName: '蓝队', clues: ['雪山', '罗盘', '火车'], code: [2, 4, 1], ownGuess: { code: [2, 4, 1], correct: true }, intercept: { correct: false } }],
                    actionLog: ['第 3 轮通信已经接入', '蓝队上一轮未能截获密码'], winner: null, lastResult: null,
                };
            }
            if (gameType === 'witchtown') {
                const halls = ['mary-warren', 'ann-putnam', 'giles-corey', 'abigail-williams', 'will-griggs', 'sarah-good', 'john-proctor', 'samuel-parris', 'rebecca-nurse', 'martha-corey', 'thomas-danforth', 'william-phips'];
                const players = halls.map((id, index) => ({
                    id: `p${index + 1}`, name: `塞勒姆${index + 1}`, seat: index + 1,
                    townHall: { id, name: ['Mary Warren','Ann Putnam','Giles Corey','Abigail Williams','Will Griggs','Sarah Good','John Proctor','Samuel Parris','Rebecca Nurse','Martha Corey','Thomas Danforth','William Phips'][index], description: '镇议会角色能力' },
                    health: index === 0 ? 2 : 3, eliminated: false, isOnline: true, identity: null, trialCount: 3,
                    revealedTrialCount: index % 3, revealedTrialCards: index % 3 ? [{ id: `revealed-${index}`, type: 'town' }] : [],
                    redAccusations: index % 4, redCards: index % 4 ? [{ id: `red-${index}`, kind: 'accusation', name: '指控', value: 1 }] : [],
                    blueCards: index % 2 ? [{ id: `blue-${index}`, kind: 'piety', name: '虔诚' }] : [], exposedHandCards: [],
                }));
                return {
                    roomId: 'visual', status: 'playing', phase: 'night', day: 2, night: 1, currentTurnId: 'p1', currentTurnName: '塞勒姆1',
                    judgeMessage: '晨钟前，请完成认罪或保持沉默', deckCount: 24, blackCatOwnerId: 'p1', lastNightDeaths: [], lastTrialReveal: null,
                    dossierReviewReason: null, dossierProgress: { confirmed: 12, required: 12 }, nightStep: 'confession', nightProgress: { completed: 4, required: 12 },
                    players, myId: 'p1', myIdentity: { faction: 'town', name: '镇民', description: '从未持有女巫审判牌的玩家。' },
                    myTownHall: players[0].townHall, myTrialCards: [{ id: 'trial-1', type: 'town', revealed: false }, { id: 'trial-2', type: 'witch', revealed: false }, { id: 'trial-3', type: 'town', revealed: true }],
                    myHand: [{ id: 'card-1', kind: 'evidence', name: '证据', color: 'red', value: 3 }, { id: 'card-2', kind: 'piety', name: '虔诚', color: 'blue', value: 0 }],
                    availableActions: { confess: true, passConfession: true }, knownWitches: [], myInfo: null, winner: null, actionLog: ['第 1 夜开始', '警长已经完成法槌决定'],
                };
            }
            return null;
        }

export { fixturePlayers, fixtureState };
