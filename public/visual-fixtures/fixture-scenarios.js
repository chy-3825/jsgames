// URL-driven scenario mutations and interaction seeds for visual fixtures.
// This module deliberately receives all dependencies so the HTML runner stays
// a small lifecycle shell and remains easy to invoke from Firefox/Chromium.

export async function applyFixtureScenario({ type, state, params, mount, client }) {
    if (type === 'coup' && state) {
        const scenario = params.get('coupState') || 'turn';
        if (scenario === 'challenge') {
            state.currentTurn = 'p2';
            state.interaction = { actionId: 41, kind: 'steal', actorId: 'p2', targetId: 'p1', claimedRole: 'captain', stage: 'challenge' };
            state.challenge = { phase: 'challenge', actionKind: 'steal', claimedRole: 'captain', responderId: 'p2', currentChallengerId: 'p1', isMyTurn: true };
            state.actionLog.push('乙方玩家声称船长偷窃甲方玩家');
        } else if (scenario === 'loss') {
            state.currentTurn = 'p2';
            state.interaction = { actionId: 42, kind: 'coup', actorId: 'p2', targetId: 'p1', stage: 'influence_loss', lossPlayerId: 'p1', lossReason: 'coup' };
            state.influenceLoss = { playerId: 'p1', isMyTurn: true };
            state.actionLog.push('甲方玩家必须失去一张影响力');
        } else if (scenario === 'exchange') {
            state.currentTurn = 'p1';
            state.interaction = { actionId: 43, kind: 'exchange', actorId: 'p1', claimedRole: 'ambassador', stage: 'exchange' };
            state.exchange = {
                isMyTurn: true,
                keepCount: 2,
                options: [
                    { index: 0, role: 'captain', revealed: false, source: 'existing' },
                    { index: 1, role: 'assassin', revealed: false, source: 'existing' },
                    { index: 2, role: 'duke', revealed: false, source: 'drawn' },
                    { index: 3, role: 'contessa', revealed: false, source: 'drawn' },
                ],
            };
        }
    }
    if (type === 'decrypto' && state) {
        const scenario = params.get('decryptoState') || 'default';
        if (!['default', 'code'].includes(scenario)) throw new Error(`Unknown decrypto fixture: ${scenario}`);
        if (scenario === 'code') {
            state.phase = 'clue';
            state.currentClues = [];
            state.currentCode = [4, 1, 3];
            state.encryptorId = 'p1';
            state.encryptorName = '红队甲';
            state.availableActions = { submitClue: true };
            state.actionLog = ['红队甲正在编写本轮加密线索'];
        }
    }
    if (type === 'guessnumber' && state) {
        const scenario = params.get('guessState') || 'ready';
        const supportedScenarios = ['empty', 'ready', 'feedback', 'ended'];
        if (!supportedScenarios.includes(scenario)) throw new Error(`Unknown guessnumber fixture: ${scenario}`);
        if (scenario === 'feedback' || scenario === 'ended') {
            const history = [
                { guess: '1234', exact: 1, misplaced: 1, absent: 2 },
                { guess: '5071', exact: 2, misplaced: 1, absent: 1 },
            ];
            state.players[0].history = history;
            state.players[0].attempts = history.length;
            state.lastResult = { ...history[history.length - 1], attempt: history.length };
        }
        if (scenario === 'ended') {
            state.status = 'ended';
            state.availableActions.canGuess = false;
            state.secret = '5071';
            state.winner = { id: 'p1', name: '破译员' };
            state.lastResult = { guess: '5071', exact: 4, misplaced: 0, absent: 0, attempt: 3 };
        }
    }
    if (type === 'takefive' && state) {
        const scenario = params.get('takefiveState') || 'select';
        if (!['select', 'locked', 'settlement'].includes(scenario)) throw new Error(`Unknown takefive fixture: ${scenario}`);
        if (scenario === 'locked') {
            state.mySelectedCardId = state.myHand[3].id;
            state.selectedCount = 10;
            state.players.forEach(player => { player.hasSelected = true; });
            state.availableActions.canSelect = false;
        }
        if (scenario === 'settlement') {
            state.phase = 'selecting';
            state.round = 1;
            state.handNumber = 2;
            state.availableActions.canSelect = true;
            state.handSettlement = {
                settlementId: 1, handNumber: 1, ended: false, targetScore: 66, winners: [], triggeredBy: [],
                scores: state.players.map((player, index) => ({ id: player.id, name: player.name, penalty: (index * 3) % 14, total: 9 + index * 5 })),
            };
        }
    }
    if (type === 'hanabi' && state) {
        const scenario = params.get('hanabiState') || 'hand';
        const supportedScenarios = ['hand', 'clue-color', 'clue-value', 'presentation', 'final-round', 'ended'];
        if (!supportedScenarios.includes(scenario)) throw new Error(`Unknown hanabi fixture: ${scenario}`);
        if (scenario === 'final-round') {
            state.deckCount = 0;
            state.finalTurnsRemaining = 4;
            state.actionLog.push('牌库最后一张已经抽出，每位玩家还剩一次行动');
        }
        if (scenario === 'ended') {
            state.status = 'ended';
            state.phase = 'ended';
            state.currentTurn = null;
            state.currentTurnName = null;
            state.deckCount = 0;
            state.finalTurnsRemaining = 0;
            state.endReason = 'fuses';
            state.strikes = 3;
            state.score = 13;
            state.scoreRating = '值得纪念的演出';
            state.availableActions = { canAct: false, canGiveClue: false, canPlay: false, canDiscard: false };
        }
    }
    if (type === 'splendor' && state) {
        const scenario = params.get('splendorState') || 'tokens';
        const supportedScenarios = ['tokens', 'card', 'return', 'noble', 'presentation', 'ended'];
        if (!supportedScenarios.includes(scenario)) throw new Error(`Unknown splendor fixture: ${scenario}`);
        if (scenario === 'return') {
            state.phase = 'return_tokens';
            state.myTokens = { white: 3, blue: 2, green: 2, red: 2, black: 2, gold: 1 };
            state.pendingTokenReturn = { playerId: 'p1', playerName: '甲方商会', amount: 2 };
            state.availableActions = { canAct: false, canChooseNoble: false, canReturnTokens: true, returnTokenCount: 2 };
        }
        if (scenario === 'noble') {
            state.phase = 'choose_noble';
            state.pendingNoble = { playerId: 'p1', playerName: '甲方商会', options: state.nobles.slice(0, 2) };
            state.availableActions = { canAct: false, canChooseNoble: true, canReturnTokens: false, returnTokenCount: 0 };
        }
        if (scenario === 'ended') {
            state.status = 'ended'; state.phase = 'ended'; state.endReason = 'points'; state.finalRoundStart = 0;
            state.players[0].points = 16; state.winners = [{ id: 'p1', name: '甲方商会', points: 16, cardCount: 9 }];
            state.availableActions = { canAct: false, canChooseNoble: false, canReturnTokens: false, returnTokenCount: 0 };
        }
    }
    if (type === 'kingdomino' && state) {
        const scenario = params.get('kingdominoState') || 'draft';
        const supportedScenarios = ['draft', 'place-start', 'place-preview', 'discard', 'duel', 'presentation', 'ended'];
        if (!supportedScenarios.includes(scenario)) throw new Error(`Unknown kingdomino fixture: ${scenario}`);
        if (['place-start', 'place-preview', 'discard', 'duel'].includes(scenario)) {
            state.phase = 'placing';
            state.mySelectedTile = { ...state.draft[0] };
            state.mySelectedTiles = [{ token: 0, tile: { ...state.draft[0] } }];
            state.availableActions = { canSelect: false, canPlace: true, canDiscard: true };
        }
        if (scenario === 'discard') {
            state.myGrid = Object.fromEntries(Array.from({ length: 25 }, (_, index) => [`${index % 5},${Math.floor(index / 5)}`, { terrain: index === 12 ? '城堡' : '矿山', crowns: 0, dominoId: `full-${index}` }]));
        }
        if (scenario === 'duel') {
            state.boardSize = 7; state.maxRounds = 12; state.remainingTileCount = 20;
            state.myGrid = { '3,3': { terrain: '城堡', crowns: 0 }, '3,2': { terrain: '海洋', crowns: 0, dominoId: 'duel-1' }, '4,2': { terrain: '草地', crowns: 1, dominoId: 'duel-1' } };
        }
        if (scenario === 'ended') {
            state.status = 'ended'; state.phase = 'ended'; state.round = 12;
            state.players[0].score = 42; state.winner = { id: 'p1', name: '甲方国王', score: 42 };
            state.availableActions = { canSelect: false, canPlace: false, canDiscard: false };
        }
    }
    if (type === 'acquire' && state) {
        const scenario = params.get('acquireState') || 'place';
        const supportedScenarios = ['place', 'foundation', 'merger', 'settlement', 'buy', 'presentation', 'ended'];
        if (!supportedScenarios.includes(scenario)) throw new Error(`Unknown acquire fixture: ${scenario}`);
        if (scenario === 'foundation') {
            state.phase = 'foundation'; state.availableActions = { ...state.availableActions, canPlace: false, canFound: true };
        }
        if (scenario === 'merger') {
            state.phase = 'merger'; state.pendingMerger = { chains: ['sackson', 'imperial'] };
            state.corporations.imperial.size = 5; state.availableActions = { ...state.availableActions, canPlace: false, canChooseMerger: true };
        }
        if (scenario === 'settlement') {
            state.phase = 'merger_settlement'; state.mergerSettlement = { currentPlayerId: 'p1', chainId: 'sackson', survivingId: 'imperial', holding: 4 };
            state.availableActions = { ...state.availableActions, canPlace: false, canSettleMerger: true };
        }
        if (scenario === 'buy') {
            state.phase = 'buy'; state.availableActions = { ...state.availableActions, canPlace: false, canBuy: true, canEndGame: true };
        }
        if (scenario === 'ended') {
            state.status = 'ended'; state.phase = 'ended'; state.deckCount = 0; state.players[0].cash = 28400;
            state.winner = { id: 'p1', name: '甲方投资人' }; state.availableActions = {};
        }
    }
    if (type === 'citadels' && state) {
        const scenario = params.get('citadelsState') || 'draft';
        const supportedScenarios = ['draft', 'resource', 'draw', 'build', 'ability', 'warlord', 'graveyard', 'presentation', 'ended'];
        if (!supportedScenarios.includes(scenario)) throw new Error(`Unknown citadels fixture: ${scenario}`);
        const enterTurn = (roleId, rank, name, actions) => {
            state.phase = 'character_turn'; state.draftPlayerId = null; state.currentPlayerId = 'p1'; state.currentRoleRank = rank; state.currentRoleName = name;
            state.myRoles = [{ id: roleId, rank, name }]; state.availableActions = actions;
        };
        if (scenario === 'resource') enterTurn('merchant', 6, '商人', { takeGold: true, drawDistrict: true, collectIncome: true });
        if (scenario === 'draw') {
            enterTurn('merchant', 6, '商人', { keepDistrict: true });
            state.myDrawOptions = [{ id: 'draw-1', name: '港口', color: 'trade', cost: 4, points: 4 }, { id: 'draw-2', name: '采石场', color: 'unique', cost: 5, points: 5, effect: 'quarry' }];
        }
        if (scenario === 'build') enterTurn('architect', 7, '建筑师', { buildDistrict: true, endTurn: true });
        if (scenario === 'ability') enterTurn('assassin', 1, '刺客', { assassinate: true, takeGold: true, drawDistrict: true });
        if (scenario === 'warlord') {
            enterTurn('warlord', 8, '军阀', { destroyDistrict: true, endTurn: true });
            state.destroyTargets = [{ targetId: 'p2', targetName: '乙方城主', cost: 2, greatWall: false, card: state.players[1].city[0] }];
        }
        if (scenario === 'graveyard') {
            enterTurn('warlord', 8, '军阀', { graveyardRecover: true, declineGraveyard: true });
            state.pendingGraveyard = { cardName: '庄园' };
        }
        if (scenario === 'ended') {
            state.status = 'ended'; state.phase = 'ended'; state.availableActions = {}; state.currentPlayerId = null;
            state.scores = state.players.map((player, index) => ({ id: player.id, name: player.name, districtSum: 25 - index * 2, firstFinisherBonus: index ? 0 : 4, eightCityBonus: index === 1 ? 2 : 0, colorBonus: index < 2 ? 3 : 0, treasuryBonus: 0, mapRoomBonus: 0, score: 32 - index * 4 }));
            state.winner = { id: 'p1', name: '甲方城主' }; state.winners = [state.winner];
        }
    }
    if (type === 'lasvegas' && state) {
        const scenario = params.get('lasvegasState') || 'ready';
        const supportedScenarios = ['ready', 'rolled', 'selected', 'tie', 'neutral', 'settlement', 'standings', 'presentation', 'ended'];
        if (!supportedScenarios.includes(scenario)) throw new Error(`Unknown lasvegas fixture: ${scenario}`);
        if (['rolled', 'selected', 'tie', 'neutral'].includes(scenario)) {
            state.currentRollOwn = [2, 2, 3, 4, 6]; state.currentRollNeutral = scenario === 'neutral' ? [2, 5] : [];
            state.currentRoll = [...state.currentRollOwn, ...state.currentRollNeutral]; state.availableActions = { canRoll: false, canPlaceFaces: [...new Set(state.currentRoll)] };
        }
        if (scenario === 'tie') state.casinos[1].dice = { p1: 2, p2: 2, p3: 1 };
        if (scenario === 'neutral') {
            state.players[0].neutralDiceRemaining = 2;
            state.neutral = { id: 'neutral', name: '中立骰子', color: 'neutral', isNeutral: true, diceRemaining: 2 };
            state.casinos[1].dice = { p2: 2, neutral: 3 };
        }
        if (scenario === 'settlement') state.lastPayouts = [{ playerId: 'p1', playerName: '甲方赌客', amount: 90, casino: 4, dice: 4 }, { playerId: 'p3', playerName: '丙方赌客', amount: 50, casino: 1, dice: 3 }];
        if (scenario === 'standings') { state.round = 3; state.actionLog.unshift('第 2 轮结算完成，甲方赌客本轮获得 90 万'); }
        if (scenario === 'ended') {
            state.status = 'ended'; state.round = 4; state.currentTurn = null; state.myTurn = false; state.availableActions = { canRoll: false, canPlaceFaces: [] };
            state.players[0].money = 370; state.players[0].banknoteCount = 7; state.winners = [{ id: 'p1', name: '甲方赌客' }];
        }
    }
    if (type === 'scout' && state) {
        const scenario = params.get('scoutState') || 'orientation';
        const supportedScenarios = ['orientation', 'show', 'beat', 'scout', 'scout-show', 'duel', 'settlement', 'presentation', 'ended'];
        if (!supportedScenarios.includes(scenario)) throw new Error(`Unknown scout fixture: ${scenario}`);
        const enterTurn = () => {
            state.phase = 'playing'; state.currentPlayerId = 'p1'; state.currentPlayerName = '甲方马戏团';
            state.availableActions = { canSetOrientation: false, canShow: true, canScout: true, canScoutShow: true };
            state.activeSet = [{ id: 'a1', front: 4, back: 8, orientation: 0, value: 4, otherValue: 8 }, { id: 'a2', front: 5, back: 9, orientation: 0, value: 5, otherValue: 9 }];
            state.activeOwnerId = 'p2'; state.activeOwnerName = '乙方马戏团';
        };
        if (scenario !== 'orientation' && scenario !== 'ended') enterTurn();
        if (scenario === 'beat') state.activeSet = [{ id: 'b1', front: 2, back: 7, orientation: 0, value: 2, otherValue: 7 }, { id: 'b2', front: 2, back: 8, orientation: 0, value: 2, otherValue: 8 }];
        if (scenario === 'duel') {
            state.players = state.players.slice(0, 2); state.maxRounds = 2; state.myScoutChips = 3; state.myScoutShowAvailable = false; state.availableActions.canScoutShow = false;
        }
        if (scenario === 'settlement') { state.round = 3; state.actionLog.unshift('第 2 轮结束：甲方马戏团本轮获得 5 分'); }
        if (scenario === 'ended') {
            state.status = 'ended'; state.phase = 'ended'; state.round = 5; state.availableActions = {}; state.players[0].score = 18;
            state.winners = [{ id: 'p1', name: '甲方马戏团', score: 18 }];
        }
    }
    if (type === 'manila' && state) {
        const scenario = params.get('manilaState') || 'auction';
        const supportedScenarios = ['auction', 'share', 'boats', 'placement', 'sailing', 'pilot', 'pirate-board', 'plunder', 'insurance', 'settlement', 'ended'];
        if (!supportedScenarios.includes(scenario)) throw new Error(`Unknown manila fixture: ${scenario}`);
        if (scenario === 'share' || scenario === 'boats') {
            state.phase = 'master'; state.masterStep = scenario === 'share' ? 'share' : 'boats';
            state.availableActions = scenario === 'share' ? { buyShare: true, skipShare: true } : { setBoats: true };
        }
        if (scenario === 'placement' || scenario === 'insurance') {
            state.phase = 'placement'; state.movementRound = 1; state.availableActions = { placeAccomplice: true, passPlacement: true, takeLoan: true, repayLoan: scenario === 'insurance' };
            if (scenario === 'insurance') state.locations.insurance = [{ playerId: 'p1', playerName: '甲方船主', fee: 0, slot: 1 }];
        }
        if (scenario === 'sailing') {
            state.phase = 'sailing'; state.movementRound = 2; state.availableActions = { sailBoats: true };
            state.movementPlan = { round: 2, rolls: state.boats.map((boat, index) => ({ boatId: boat.id, good: boat.good, roll: [3, 4, 2][index], from: boat.position, projected: boat.position + [3, 4, 2][index] })) };
        }
        if (scenario === 'pilot') { state.phase = 'pilot'; state.movementRound = 2; state.availableActions = { pilotMove: true, skipPilot: true }; }
        if (scenario === 'pirate-board') { state.phase = 'pirateBoard'; state.movementRound = 2; state.boats[1].position = 13; state.availableActions = { boardPirate: true, skipPirate: true }; }
        if (scenario === 'plunder') { state.phase = 'plunder'; state.movementRound = 3; state.boats[1].position = 13; state.pendingPlunder = { boatId: 2, good: '玉石', cargoAccomplices: 2 }; state.availableActions = { plunderDestination: true }; }
        if (scenario === 'settlement') { state.phase = 'auction'; state.availableActions = {}; }
        if (scenario === 'ended') { state.status = 'ended'; state.phase = 'ended'; state.availableActions = {}; state.winner = { id: 'p1', name: '甲方船主', fortune: 96 }; state.players[0].fortune = 96; }
    }
    if (type === 'modernart' && state) {
        const scenario = params.get('modernartState') || 'selection';
        const supportedScenarios = ['selection', 'double-offer', 'mystery', 'open', 'once', 'sealed', 'fixed', 'double', 'presentation', 'hammer', 'settlement', 'ended'];
        if (!supportedScenarios.includes(scenario)) throw new Error(`Unknown modernart fixture: ${scenario}`);
        const enterBidding = auctionType => {
            state.phase = 'bidding'; state.currentTurn = 'p1'; state.currentTurnName = '甲方藏家'; state.availableActions = { bid: true };
            state.auction = { artist: '马蒂斯', artistId: 'matisse', artists: auctionType === 'double' ? ['马蒂斯', '马蒂斯'] : ['马蒂斯'], sellerId: 'p2', sellerName: '乙方画廊', type: auctionType, typeName: auctionType, fixedPrice: auctionType === 'fixed' ? 18 : null, highestBid: 12, highestBidder: 'p3', bidCount: auctionType === 'sealed' ? 2 : 0, passed: [] };
        };
        if (scenario === 'double-offer') { state.phase = 'double_offer'; state.availableActions = { offerSecond: true, passSecond: true }; state.doubleOffer = { artistId: 'clyfford', artist: '克里福特', originalSellerName: '乙方画廊', currentPlayerName: '甲方藏家', passed: [] }; }
        if (scenario === 'mystery') { state.phase = 'mystery_offer'; state.rules.mysteryPlayer = true; state.mysteryCount = 7; state.availableActions = { revealMystery: true, skipMystery: true }; state.mysteryOffer = { remaining: 7 }; }
        if (['open', 'once', 'sealed', 'fixed', 'double'].includes(scenario)) enterBidding(scenario);
        if (['presentation', 'hammer', 'settlement'].includes(scenario)) { enterBidding('open'); state.availableActions = {}; }
        if (scenario === 'ended') { state.status = 'ended'; state.phase = 'ended'; state.auction = null; state.availableActions = {}; state.myCash = 284; state.players[0].cash = 284; state.winner = { id: 'p1', name: '甲方藏家', cash: 284 }; state.winners = [state.winner]; }
    }
    if (type === 'camelup' && state) {
        const scenario = params.get('camelupState') || 'ready';
        const supportedScenarios = ['ready', 'roll', 'leg-bet', 'overall-winner', 'overall-loser', 'tile-oasis', 'tile-mirage', 'die', 'move', 'secret', 'leg-settlement', 'reveal', 'ended'];
        if (!supportedScenarios.includes(scenario)) throw new Error(`Unknown camelup fixture: ${scenario}`);
        if (['die', 'move', 'secret', 'leg-settlement', 'reveal'].includes(scenario)) state.availableActions = {};
        if (scenario === 'ended') { state.status = 'ended'; state.phase = 'ended'; state.availableActions = {}; state.players[0].cash = 31; state.winner = { id: 'p1', name: '甲方驯驼师', cash: 31 }; state.winners = [state.winner]; }
    }
    if (type === 'magicalathlete' && state) {
        const scenario = params.get('magicalathleteState') || 'race';
        const supportedScenarios = ['draft', 'race-select', 'race', 'tripped', 'acknowledgement', 'private-pick', 'target', 'ability', 'reroll', 'genius', 'lineup', 'roll-presentation', 'ability-presentation', 'elimination', 'settlement', 'ended'];
        if (!supportedScenarios.includes(scenario)) throw new Error(`Unknown magicalathlete fixture: ${scenario}`);
        if (scenario === 'draft') { state.phase = 'draft'; state.racers = []; state.availableActions = { chooseAthlete: true }; }
        if (scenario === 'race-select') { state.phase = 'race_select'; state.racers = []; state.availableActions = { selectRaceAthlete: true }; state.racersPerPlayer = 1; }
        if (scenario === 'tripped') state.racers[0].tripped = true;
        if (scenario === 'acknowledgement') { state.racers[1].eliminated = true; state.availableActions = {}; state.acknowledgement = { id: 'ack-1', playerId: 'p1', playerName: '甲方教练', racerId: 'r1', athleteId: 'alchemist', athleteName: '炼金术师', sourceRacerId: 'r2', sourceAthleteName: '大嘴', position: 16 }; }
        if (scenario === 'private-pick') { state.availableActions = {}; state.prompt = { kind: 'eggPick', playerId: 'p1', racerId: 'r1', pool: ['banana', 'genius', 'hare'] }; }
        if (scenario === 'target') { state.availableActions = {}; state.prompt = { kind: 'hypnotist', playerId: 'p1', racerId: 'r1' }; }
        if (scenario === 'ability') { state.availableActions = {}; state.prompt = { kind: 'rocket', playerId: 'p1', racerId: 'r1' }; }
        if (scenario === 'reroll') { state.availableActions = {}; state.prompt = { kind: 'magician', playerId: 'p1', racerId: 'r1', roll: 2 }; }
        if (scenario === 'genius') { state.availableActions = {}; state.prompt = { kind: 'genius', playerId: 'p1', racerId: 'r1' }; }
        if (['lineup', 'roll-presentation', 'ability-presentation', 'elimination', 'settlement'].includes(scenario)) state.availableActions = {};
        if (scenario === 'ended') { state.status = 'ended'; state.phase = 'ended'; state.availableActions = {}; state.players[0].score = 18; state.winner = { id: 'p1', name: '甲方教练', score: 18 }; state.winners = [state.winner]; }
    }
    window.__shellTestState = state ? JSON.parse(JSON.stringify(state)) : null;
    if (state) client.handleMessage({ type: 'gameState', state });
    if (type === 'loveletter') mount.querySelector('[data-card-index="0"]')?.click();
    if (type === 'guessnumber' && (params.get('guessState') || 'ready') === 'ready') {
        for (const digit of ['1', '2', '3', '4']) mount.querySelector(`[data-digit="${digit}"]`)?.click();
    }
    if (type === 'monopolydeal') mount.querySelector('[data-card-index="0"]')?.click();
    if (type === 'hanabi') {
        const scenario = params.get('hanabiState') || 'hand';
        if (scenario === 'hand') mount.querySelector('[data-hand-card-id]')?.click();
        if (scenario === 'clue-color' || scenario === 'clue-value') {
            mount.querySelector('[data-target-id]')?.click();
            if (scenario === 'clue-value') mount.querySelector('[data-clue-kind="value"]')?.click();
        }
        if (scenario === 'presentation') {
            const nextState = JSON.parse(JSON.stringify(state));
            nextState.lastAction = {
                kind: 'giveClue', actionId: 1, playerId: 'p1', playerName: '甲方玩家', targetId: 'p2', targetName: '乙方玩家',
                clueKind: 'color', value: 'red', matchedCardIds: ['p2-1'], matchedIndexes: [0], message: '甲方玩家给乙方玩家提供了红色提示',
            };
            client.handleMessage({ type: 'gameState', state: nextState });
        }
    }
    if (type === 'splendor') {
        const scenario = params.get('splendorState') || 'tokens';
        if (scenario === 'tokens') mount.querySelector('[data-token-color="white"]')?.click();
        if (scenario === 'card') mount.querySelector('[data-card-select="s1"]')?.click();
        if (scenario === 'return') mount.querySelector('[data-token-adjust="1"]')?.click();
        if (scenario === 'presentation') {
            const nextState = JSON.parse(JSON.stringify(state));
            nextState.presentation = { sequence: 1, transactionId: 1, events: [{ kind: 'takeTokens', playerId: 'p1', playerName: '甲方商会', colors: ['white', 'blue', 'green'], counts: { white: 1, blue: 1, green: 1 }, tokenTotalBefore: 6, tokenTotalAfter: 9 }], resolved: true };
            client.handleMessage({ type: 'gameState', state: nextState });
        }
    }
    if (type === 'kingdomino') {
        const scenario = params.get('kingdominoState') || 'draft';
        if (scenario === 'draft') mount.querySelector('[data-domino-id="k1"]')?.click();
        if (scenario === 'place-preview') {
            mount.querySelector('.kd-cell.is-placeable')?.click();
            mount.querySelector('.kd-cell.is-candidate')?.click();
        }
        if (scenario === 'presentation') {
            const nextState = JSON.parse(JSON.stringify(state));
            nextState.presentation = { sequence: 1, events: [{ kind: 'selectDomino', playerId: 'p1', playerName: '甲方国王', playerColor: '#d6a63d', tokenNumber: 1, tile: { ...state.draft[0] } }] };
            client.handleMessage({ type: 'gameState', state: nextState });
        }
    }
    if (type === 'acquire') {
        const scenario = params.get('acquireState') || 'place';
        if (scenario === 'place') mount.querySelector('[data-tile-id="D5"]')?.click();
        if (scenario === 'presentation') {
            const nextState = JSON.parse(JSON.stringify(state));
            nextState.presentation = { sequence: 1, events: [{ kind: 'placeTile', playerId: 'p1', playerName: '甲方投资人', tile: { id: 'D5' }, resultKind: 'neutral' }] };
            client.handleMessage({ type: 'gameState', state: nextState });
        }
    }
    if (type === 'citadels') {
        const scenario = params.get('citadelsState') || 'draft';
        if (scenario === 'draft') mount.querySelector('.citadels-role-option')?.click();
        if (scenario === 'build') mount.querySelector('[data-action="selectBuild"]')?.click();
        if (scenario === 'ability' || scenario === 'warlord') mount.querySelector('[data-action="prepareDecision"]')?.click();
        if (scenario === 'presentation') {
            const nextState = JSON.parse(JSON.stringify(state));
            nextState.presentation = { sequence: 1, events: [{ kind: 'roleCall', playerId: 'p1', playerName: '甲方城主', role: { id: 'king', rank: 4, name: '国王' } }] };
            client.handleMessage({ type: 'gameState', state: nextState });
        }
    }
    if (type === 'lasvegas') {
        const scenario = params.get('lasvegasState') || 'ready';
        if (scenario === 'selected') mount.querySelector('[data-face="2"]')?.click();
        if (scenario === 'presentation') {
            const nextState = JSON.parse(JSON.stringify(state));
            nextState.presentation = { sequence: 1, events: [{ kind: 'diceRolled', actorId: 'p1', actorName: '甲方赌客', actorColor: 'red', ownResults: [1, 2, 2, 4, 5, 6], neutralResults: [] }] };
            client.handleMessage({ type: 'gameState', state: nextState });
        }
    }
    if (type === 'scout') {
        const scenario = params.get('scoutState') || 'orientation';
        if (scenario === 'orientation') mount.querySelector('[data-orientation-choice="0"]')?.click();
        if (scenario === 'show' || scenario === 'beat') { mount.querySelector('[data-card-index="0"]')?.click(); mount.querySelector('[data-card-index="1"]')?.click(); }
        if (scenario === 'scout' || scenario === 'scout-show') mount.querySelector(`[data-mode="${scenario === 'scout' ? 'scout' : 'scoutShow'}"]`)?.click();
        if (['settlement', 'presentation'].includes(scenario)) {
            const nextState = JSON.parse(JSON.stringify(state));
            nextState.presentation = scenario === 'settlement'
                ? { sequence: 1, events: [{ kind: 'roundSettlement', round: 2, reason: 'hand-empty', scores: state.players.map((player, index) => ({ ...player, roundScore: 5 - index, capturedPoints: index, scoutTokenPoints: index % 2, handPenalty: -index, totalScore: player.score + 5 - index })) }] }
                : { sequence: 1, events: [{ kind: 'orientationLocked', playerId: 'p1', playerName: '甲方马戏团', lockedCount: 3, totalPlayers: 5 }] };
            client.handleMessage({ type: 'gameState', state: nextState });
        }
    }
    if (type === 'manila' && (params.get('manilaState') || 'auction') === 'settlement') {
        const nextState = JSON.parse(JSON.stringify(state));
        nextState.presentation = { sequence: 1, resolved: true, events: [{ kind: 'voyageSettlement', voyage: 3,
            boats: nextState.boats.map((boat, index) => ({ ...boat, fate: index < 2 ? 'port' : 'shipyard', portIndex: index + 1, shipyardIndex: 1 })),
            players: nextState.players.map((player, index) => ({ id: player.id, name: player.name, cashBefore: player.cash, cashAfter: player.cash + 12 - index * 2, gained: 12 - index * 2 })),
            marketBefore: nextState.market, marketAfter: { ...nextState.market, '人参': 20, '玉石': 25 }, payoutDetails: [],
        }] };
        client.handleMessage({ type: 'gameState', state: nextState });
    }
    if (type === 'modernart') {
        const scenario = params.get('modernartState') || 'selection';
        if (scenario === 'selection') mount.querySelector('[data-card-index="0"]')?.click();
        if (scenario === 'double-offer') mount.querySelector('[data-card-index="5"]')?.click();
        if (['presentation', 'hammer', 'settlement'].includes(scenario)) {
            const nextState = JSON.parse(JSON.stringify(state));
            const work = { id: 'event-1', artistId: 'matisse', artistName: '马蒂斯', auctionType: 'open' };
            const events = scenario === 'presentation'
                ? [{ kind: 'paintingPresented', actorId: 'p2', actorName: '乙方画廊', sellerId: 'p2', sellerName: '乙方画廊', card: work, auctionType: 'open', auctionTypeName: '公开竞价', appearance: 4, endsSeason: false }]
                : scenario === 'hammer'
                    ? [{ kind: 'auctionResolved', cards: [work], auctionType: 'open', auctionTypeName: '公开竞价', sellerId: 'p2', sellerName: '乙方画廊', buyerId: 'p1', buyerName: '甲方藏家', price: 18, selfPurchase: false, sealedBids: null }]
                    : [{ kind: 'seasonSettlement', round: 2, trigger: { kind: 'fifthPainting' }, ranking: [
                        { rank: 1, artistId: 'cassat', artistName: '卡萨特', count: 5, roundValue: 30, cumulativeValue: 50 }, { rank: 2, artistId: 'matisse', artistName: '马蒂斯', count: 4, roundValue: 20, cumulativeValue: 50 }, { rank: 3, artistId: 'bruegel', artistName: '勃鲁盖尔', count: 2, roundValue: 10, cumulativeValue: 20 },
                    ], players: nextState.players.map(player => ({ playerId: player.id, playerName: player.name, collectionCount: player.collectionCount })), ownResult: { playerId: 'p1', playerName: '甲方藏家', cashBefore: 78, cashAfter: 148, payout: 70, paintings: [] } }];
            nextState.presentation = { sequence: 21, resolved: true, events };
            client.handleMessage({ type: 'gameState', state: nextState });
        }
        if (scenario === 'ended') {
            const nextState = JSON.parse(JSON.stringify(state));
            nextState.presentation = { sequence: 22, resolved: true, events: [{ kind: 'finalSettlement', winnerIds: ['p1'], artistValues: nextState.artistValues,
                standings: nextState.players.map((player, index) => ({ rank: index + 1, id: player.id, name: player.name, color: player.color, fortune: 284 - index * 23 })), seasons: nextState.history,
            }] };
            client.handleMessage({ type: 'gameState', state: nextState });
        }
    }
    if (type === 'camelup') {
        const scenario = params.get('camelupState') || 'ready';
        if (scenario === 'roll') mount.querySelector('[data-action-mode="rollDie"]')?.click();
        if (scenario === 'leg-bet') mount.querySelector('[data-leg-camel="red"]')?.click();
        if (scenario === 'overall-winner' || scenario === 'overall-loser') {
            mount.querySelector('[data-action-mode="betOverall"]')?.click();
            if (scenario === 'overall-loser') mount.querySelector('[data-outcome="loser"]')?.click();
            mount.querySelector('[data-finish-card="finish-p1-red"]')?.click();
        }
        if (scenario === 'tile-oasis' || scenario === 'tile-mirage') {
            mount.querySelector('[data-action-mode="placeTile"]')?.click();
            if (scenario === 'tile-mirage') mount.querySelector('[data-tile-type="mirage"]')?.click();
            mount.querySelector('[data-track-position="15"]')?.click();
        }
        if (['die', 'move', 'secret', 'leg-settlement', 'reveal', 'ended'].includes(scenario)) {
            const nextState = JSON.parse(JSON.stringify(state));
            const camel = { id: 'red', name: '赤焰', color: '#cf4d3f', position: 10, order: 1 };
            let events = [];
            if (scenario === 'die') events = [{ kind: 'dieRevealed', actorId: 'p1', actorName: '甲方驯驼师', camel, steps: 3, remainingBefore: 3, pyramidReward: 1 }];
            if (scenario === 'move') events = [{ kind: 'camelMoved', actorId: 'p1', actorName: '甲方驯驼师', camel, steps: 3, from: 7, to: 10, movingCamels: [camel], destinationStack: nextState.camels.filter(item => item.position === 10) }];
            if (scenario === 'secret') events = [{ kind: 'overallBetPlaced', actorId: 'p1', actorName: '甲方驯驼师', outcome: 'winner', order: 3, private: { cardId: 'finish-p1-red', camelId: 'red', camelName: '赤焰' } }];
            if (scenario === 'leg-settlement') events = [{ kind: 'legSettlement', leg: 3, final: false, ranking: nextState.camels, playerResults: nextState.players.map((player, index) => ({ playerId: player.id, playerName: player.name, cashBefore: player.cash, cashAfter: player.cash + 3 - index, change: 3 - index, pyramidCount: player.pyramidTileCount, pyramidReward: player.pyramidTileCount, bets: [] })) }];
            if (scenario === 'reveal') events = [{ kind: 'overallBetsRevealed', ranking: nextState.camels, winnerBets: [{ order: 1, playerId: 'p1', playerName: '甲方驯驼师', cardId: 'a', camelId: 'red', camelName: '赤焰', correct: true, reward: 8, cashBefore: 23, cashAfter: 31 }], loserBets: [{ order: 1, playerId: 'p2', playerName: '乙方观赛客', cardId: 'b', camelId: 'white', camelName: '月白', correct: true, reward: 8, cashBefore: 16, cashAfter: 24 }] }];
            if (scenario === 'ended') events = [{ kind: 'finalSettlement', winnerIds: ['p1'], camelRanking: nextState.camels, standings: nextState.players.map((player, index) => ({ rank: index + 1, id: player.id, name: player.name, color: player.color, cash: 31 - index * 3 })) }];
            nextState.presentation = { sequence: 31, resolved: true, events };
            client.handleMessage({ type: 'gameState', state: nextState });
        }
    }
    if (type === 'magicalathlete') {
        const scenario = params.get('magicalathleteState') || 'race';
        if (scenario === 'draft') mount.querySelector('[data-athlete="alchemist"]')?.click();
        if (scenario === 'race-select') mount.querySelector('[data-athlete]')?.click();
        if (scenario === 'race' || scenario === 'tripped') mount.querySelector('[data-action="roll"]')?.click();
        if (scenario === 'private-pick') mount.querySelector('[data-prompt-pick="banana"]')?.click();
        if (scenario === 'target') mount.querySelector('[data-prompt-target="r2"]')?.click();
        if (scenario === 'ability') mount.querySelector('[data-prompt-action="promptUse"][data-prompt-value="1"]')?.click();
        if (scenario === 'reroll') mount.querySelector('[data-prompt-action="promptReroll"][data-prompt-value="1"]')?.click();
        if (scenario === 'genius') mount.querySelector('[data-genius-guess="4"]')?.click();
        if (['lineup', 'roll-presentation', 'ability-presentation', 'elimination', 'settlement', 'ended'].includes(scenario)) {
            const nextState = JSON.parse(JSON.stringify(state));
            const source = { ...nextState.racers[0], athleteName: '炼金术师', playerName: '甲方教练' };
            let events = [];
            if (scenario === 'lineup') events = [{ kind: 'lineupRevealed', match: 2, trackSide: 'wild', racers: nextState.racers }];
            if (scenario === 'roll-presentation') events = [{ kind: 'dieRevealed', racer: source, value: 4, reroll: false }];
            if (scenario === 'ability-presentation') events = [{ kind: 'abilityTriggered', abilityId: 'alchemist', abilityName: '炼金术', source, targets: [nextState.racers[1]] }];
            if (scenario === 'elimination') events = [{ kind: 'eliminationThreatened', source: { ...source, athleteId: 'mouth', athleteName: '大嘴', position: 16 }, victim: { ...nextState.racers[1], athleteName: '香蕉', position: 16 }, position: 16, targetPlayerId: 'p2' }];
            if (scenario === 'settlement') events = [{ kind: 'matchSettlement', match: 2, racers: nextState.racers, ranking: [{ id: 'r1', place: 1, gold: 4, silver: 0 }, { id: 'r2', place: 2, gold: 0, silver: 2 }], playerResults: nextState.players.map((player, index) => ({ playerId: player.id, playerName: player.name, color: player.color, scoreBefore: player.score, scoreAfter: player.score + (index < 2 ? 4 - index * 2 : 0), bronze: player.bronze })) }];
            if (scenario === 'ended') events = [{ kind: 'finalSettlement', winnerIds: ['p1'], standings: nextState.players.map((player, index) => ({ rank: index + 1, playerId: player.id, playerName: player.name, color: player.color, score: 18 - index * 2, bronze: player.bronze })) }];
            nextState.presentation = { sequence: 41, resolved: true, events };
            client.handleMessage({ type: 'gameState', state: nextState });
        }
    }
    if (type === 'takefive' && (params.get('takefiveState') || 'select') === 'select') mount.querySelector('[data-card-id]')?.click();
    if (params.get('rules') === '1') {
        mount.querySelector('[data-ui="rules"], [data-action="rules"], [data-action="roles"]')?.click();
    }
    if (params.get('tutorial') === '1') mount.querySelector('[data-ui="tutorial"]')?.click();
    if (params.get('notebook') === '1') mount.querySelector('[data-ui="notebook"]')?.click();
    if (params.get('revealRole') === '1') {
        const roleCover = mount.querySelector('[data-role-hold], [data-dossier-hold], [data-identity-hold]');
        roleCover?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
        // Keep the visual-fixture frame open after the synthetic hold;
        // real clients still use press-and-hold and hide on keyup.
        roleCover?.closest('.social-role-focus')?.classList.add('is-revealed');
        roleCover?.parentElement.querySelector('[data-role-secret]')?.setAttribute('aria-hidden', 'false');
        roleCover?.closest('.witchtown-dossier-stack')?.classList.add('is-revealed');
        roleCover?.closest('.witchtown-dossier-stack')?.querySelector('[data-dossier-secret]')?.setAttribute('aria-hidden', 'false');
        roleCover?.closest('.cp-app')?.classList.add('is-identity-revealed');
        roleCover?.closest('.cp-app')?.querySelectorAll('[data-private-identity]').forEach(element => element.setAttribute('aria-hidden', 'false'));
    }
    if (type === 'coup' && ['challenge', 'loss'].includes(params.get('coupState'))) {
        await new Promise(resolve => setTimeout(resolve, 950));
    }
}
