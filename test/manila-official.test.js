const test = require('node:test');
const assert = require('node:assert/strict');
const ManilaEngine = require('../server/games/manila/engine');

function players(count) { return Array.from({ length: count }, (_, index) => ({ id: `p${index + 1}`, name: `玩家${index + 1}` })); }
function setBoats(game) { return game.handleAction(game.harborMasterId, { kind: 'setBoats', boats: [{ good: '人参', start: 3 }, { good: '玉石', start: 3 }, { good: '丝绸', start: 3 }] }); }
function passAuction(game) { while (game.phase === 'auction') { const player = game.players[game.auction.currentIndex]; assert.equal(game.handleAction(player.id, { kind: 'pass' }).success, true); } }
function passPlacements(game) { while (game.phase === 'placement') { const player = game.players[game.placementTurnIndex]; assert.equal(game.handleAction(player.id, { kind: 'passPlacement' }).success, true); } }
function sail(game, order = null) { const plan = game.getPublicState().movementPlan; assert.ok(plan?.rolls?.length); return game.handleAction(game.harborMasterId, { kind: 'sailBoats', order: order || plan.rolls.map(item => item.boatId) }); }

test('Manila uses the official roster, private shares, fees and no artificial voyage cap', () => {
    const game = new ManilaEngine('manila-setup', players(5), () => 0);
    assert.equal(game.start().success, true);
    assert.equal(game.players.every(player => player.cash === 30 && player.shares.length === 2 && player.accomplices === 3), true);
    assert.equal(Object.values(game.shareMarket).reduce((sum, count) => sum + count, 0), 10);
    assert.deepEqual(game.getPlayerState('p1').myShares.length, 2);
    assert.equal(game.getPublicState().players[0].shares, undefined);
    assert.deepEqual(ManilaEngine.LOCATIONS.find(location => location.id === 'port-c').payout, 15);
    assert.deepEqual(ManilaEngine.LOCATIONS.find(location => location.id === 'jade').fees, [3, 4, 5, 6]);
    assert.equal(game.getPublicState().maxVoyages, null);
    assert.equal(game.handleAction('p1', { kind: 'pass' }).success, true, '只有轮到的玩家可以竞价或放弃');
    assert.equal(game.handleAction('p2', { kind: 'pass' }).success, true);
    assert.equal(game.handleAction('p3', { kind: 'pass' }).success, true);
    assert.equal(game.handleAction('p4', { kind: 'pass' }).success, true);
    assert.equal(game.phase, 'master');
});

test('Manila charges only the winning auction bid and supports blind cargo passengers', () => {
    const game = new ManilaEngine('manila-auction', players(4), () => 0);
    game.start();
    assert.equal(game.handleAction('p1', { kind: 'bid', amount: 5 }).success, true);
    assert.equal(game.handleAction('p2', { kind: 'bid', amount: 7 }).success, true);
    assert.equal(game.handleAction('p3', { kind: 'pass' }).success, true);
    assert.equal(game.handleAction('p4', { kind: 'pass' }).success, true);
    assert.equal(game.handleAction('p1', { kind: 'pass' }).success, true);
    assert.equal(game.phase, 'master');
    assert.equal(game.players.find(player => player.id === 'p1').cash, 30, '落败出价不扣款');
    assert.equal(game.players.find(player => player.id === 'p2').cash, 23, '港务长只支付最终出价');

    game.handleAction('p2', { kind: 'skipShare' });
    game.handleAction('p2', { kind: 'setBoats', boats: [{ good: '人参', start: 3 }, { good: '玉石', start: 3 }, { good: '丝绸', start: 3 }] });
    const poor = game.players.find(player => player.id === 'p1'); poor.cash = 1; poor.encumberedShares = poor.shares.map((_, index) => index);
    while (game.players[game.placementTurnIndex].id !== 'p1') game.handleAction(game.players[game.placementTurnIndex].id, { kind: 'passPlacement' });
    const result = game.handleAction('p1', { kind: 'placeAccomplice', location: 'ginseng' });
    assert.equal(result.success, true, '无法支付最低费用时仍可作为盲乘客登上货船');
    assert.equal(poor.cash, 0);
});

test('Manila resolves pilots before the third movement round', () => {
    const game = new ManilaEngine('manila-pilots', players(4), () => 0);
    game.start(); passAuction(game); assert.equal(game.handleAction(game.harborMasterId, { kind: 'skipShare' }).success, true); assert.equal(setBoats(game).success, true);
    const first = game.players[game.placementTurnIndex];
    assert.equal(game.handleAction(first.id, { kind: 'placeAccomplice', location: 'pilot-small' }).success, true);
    const second = game.players[game.placementTurnIndex];
    assert.equal(game.handleAction(second.id, { kind: 'placeAccomplice', location: 'pilot-large' }).success, true);
    while (game.phase !== 'pilot') {
        if (game.phase === 'placement') { const current = game.players[game.placementTurnIndex]; assert.equal(game.handleAction(current.id, { kind: 'passPlacement' }).success, true); }
        else if (game.phase === 'sailing') assert.equal(sail(game).success, true);
    }
    // The two pilots are presented in board order, small before large.
    assert.equal(game.phase, 'pilot');
    const small = game.locations['pilot-small'][0].playerId;
    assert.equal(game.getPublicState().currentTurn, small);
    assert.equal(game.handleAction(small, { kind: 'pilotMove', moves: [{ boatId: 1, delta: 1 }] }).success, true);
    const large = game.locations['pilot-large'][0].playerId;
    assert.equal(game.getPublicState().currentTurn, large);
    assert.equal(game.handleAction(large, { kind: 'pilotMove', moves: [{ boatId: 2, delta: 2 }] }).success, true);
    assert.equal(game.phase, 'sailing', '领航员行动后才公开第三轮骰点并等待港务长行船');
    assert.equal(game.movementRound, 3);
});

test('Manila exposes authoritative dice and lets the harbor master choose punt order', () => {
    const game = new ManilaEngine('manila-sailing-order', players(4), () => 0.99);
    game.start(); passAuction(game); game.handleAction(game.harborMasterId, { kind: 'skipShare' }); setBoats(game); passPlacements(game);
    assert.equal(game.phase, 'sailing');
    const plan = game.getPublicState().movementPlan;
    assert.deepEqual(plan.rolls.map(item => item.roll), [6, 6, 6]);
    assert.equal(game.getPlayerState(game.harborMasterId).availableActions.sailBoats, true);
    assert.equal(game.handleAction(game.harborMasterId, { kind: 'sailBoats', order: [1, 1, 3] }).success, false, '行船顺序不能遗漏或重复货船');
    game.boats[0].position = 8; game.boats[1].position = 8;
    assert.equal(sail(game, [2, 1, 3]).success, true);
    assert.equal(game.boats[1].finishOrder, 1, '同轮先移动的到港货船取得更靠前的港口位');
    assert.equal(game.boats[0].finishOrder, 2);
    assert.deepEqual(game.lastMovement.moves.map(item => item.boatId), [2, 1, 3]);
});

test('Manila supports pirate boarding and final plunder choice', () => {
    const game = new ManilaEngine('manila-pirates', players(4), () => 0);
    game.start(); passAuction(game); game.handleAction(game.harborMasterId, { kind: 'skipShare' }); setBoats(game);
    const pirate = game.players[game.placementTurnIndex];
    assert.equal(game.handleAction(pirate.id, { kind: 'placeAccomplice', location: 'pirate' }).success, true);
    while (game.phase === 'placement') { const current = game.players[game.placementTurnIndex]; assert.equal(game.handleAction(current.id, { kind: 'passPlacement' }).success, true); }
    assert.equal(game.phase, 'sailing');
    assert.equal(sail(game).success, true);
    game.boats[0].position = 12;
    while (game.phase === 'placement') { const current = game.players[game.placementTurnIndex]; assert.equal(game.handleAction(current.id, { kind: 'passPlacement' }).success, true); }
    assert.equal(sail(game).success, true);
    assert.equal(game.phase, 'pirateBoard');
    assert.equal(game.handleAction(pirate.id, { kind: 'boardPirate', boatId: 1 }).success, true);
    // Arrange the final movement to stop exactly on 13 so the boarded pirate must choose its fate.
    game.boats[0].position = 12;
    const cargoPlayer = game.players.find(player => player.id !== pirate.id);
    const cargoBefore = cargoPlayer.cash;
    game.boats[0].placements = [{ playerId: cargoPlayer.id, fee: 1 }];
    cargoPlayer.placed.push({ location: 'ginseng', fee: 1 });
    while (game.phase === 'placement') { const current = game.players[game.placementTurnIndex]; assert.equal(game.handleAction(current.id, { kind: 'passPlacement' }).success, true); }
    assert.equal(game.phase, 'sailing');
    assert.equal(sail(game).success, true);
    assert.equal(game.phase, 'plunder');
    assert.equal(game.getPublicState().currentTurn, pirate.id);
    const pirateBefore = pirate.cash;
    assert.equal(game.handleAction(pirate.id, { kind: 'plunderDestination', destination: 'shipyard' }).success, true);
    assert.equal(game.lastVoyage.boats.find(boat => boat.good === '人参').fate, 'shipyard');
    assert.equal(game.lastVoyage.boats.find(boat => boat.good === '人参').plundered, true);
    assert.equal(cargoPlayer.cash, cargoBefore, '被掠夺货船上的货物帮手不获得货物利润');
    assert.equal(pirate.cash, pirateBefore + 36, '海盗取得被掠夺货物的全部收益');
});

test('Manila insurance pays shipyard rewards and final fortune subtracts loan interest', () => {
    const game = new ManilaEngine('manila-insurance', players(3), () => 0);
    game.start();
    game.players[0].encumberedShares = [0];
    game.players[0].cash = 20;
    game.boats = [{ id: 1, good: '人参', position: 8, fate: 'shipyard', arrived: false, placements: [], pirates: [], finishOrder: 1 }, { id: 2, good: '玉石', position: 14, fate: 'port', arrived: true, placements: [], pirates: [], finishOrder: 2 }, { id: 3, good: '丝绸', position: 14, fate: 'port', arrived: true, placements: [], pirates: [], finishOrder: 3 }];
    game.locations = Object.fromEntries(ManilaEngine.LOCATIONS.map(location => [location.id, []]));
    game.locations.insurance = [{ playerId: 'p1', fee: 0, slot: 1 }];
    game.locations['shipyard-a'] = [{ playerId: 'p2', fee: 4, slot: 1 }];
    game.players[0].placed = [{ location: 'insurance', fee: 0 }]; game.players[1].placed = [{ location: 'shipyard-a', fee: 4 }];
    const before = game.players[1].cash;
    game._settleVoyage();
    assert.equal(game.players[1].cash, before + 6);
    assert.equal(game.players[0].encumberedShares.length, 1);
    game.market.人参 = 30; game._finish();
    assert.equal(game.players[0].cash, 14, '保险人承担船坞赔付后现金减少');
    const winner = game.getWinner();
    assert.equal(winner.fortune, game.finalFortunes[winner.id]);
});

test('Manila completes three independent five-player voyages to the market terminal', () => {
    for (let run = 1; run <= 3; run += 1) {
        const game = new ManilaEngine(`manila-max-${run}`, players(5), () => 0.99);
        assert.equal(game.start().success, true);
        let guard = 0;
        while (game.status === 'playing' && guard++ < 500) {
            if (game.phase === 'auction') passAuction(game);
            else if (game.phase === 'master') { assert.equal(game.handleAction(game.harborMasterId, { kind: 'skipShare' }).success, true); assert.equal(setBoats(game).success, true); }
            else if (game.phase === 'placement') passPlacements(game);
            else if (game.phase === 'sailing') assert.equal(sail(game).success, true);
            else if (game.phase === 'pilot') { const current = game.getPublicState().currentTurn; assert.equal(game.handleAction(current, { kind: 'skipPilot' }).success, true); }
            else if (game.phase === 'pirateBoard') { const current = game.getPublicState().currentTurn; assert.equal(game.handleAction(current, { kind: 'skipPirate' }).success, true); }
            else if (game.phase === 'plunder') { const current = game.getPublicState().currentTurn; assert.equal(game.handleAction(current, { kind: 'plunderDestination', destination: 'port' }).success, true); }
        }
        assert.equal(game.status, 'ended');
        assert.ok(Object.values(game.market).some(value => value >= 30));
        assert.ok(game.winner);
    }
});

test('Manila publishes structured auction, placement and ordered sailing presentations', () => {
    const game = new ManilaEngine('manila-presentation-flow', players(4), () => 0);
    game.start();
    assert.equal(game.handleAction('p1', { kind: 'bid', amount: 5 }).success, true);
    let presentation = game.getPublicState().presentation;
    assert.equal(presentation.resolved, true);
    assert.equal(presentation.events[0].kind, 'auctionBid');
    assert.equal(presentation.events[0].amount, 5);

    assert.equal(game.handleAction('p2', { kind: 'pass' }).success, true);
    assert.equal(game.handleAction('p3', { kind: 'pass' }).success, true);
    assert.equal(game.handleAction('p4', { kind: 'pass' }).success, true);
    presentation = game.getPublicState().presentation;
    assert.deepEqual(presentation.events.map(event => event.kind), ['auctionPassed', 'harborMasterAppointed']);
    assert.equal(presentation.events[1].playerId, 'p1');
    assert.equal(presentation.events[1].winningBid, 5);

    game.handleAction('p1', { kind: 'skipShare' });
    assert.equal(setBoats(game).success, true);
    presentation = game.getPublicState().presentation;
    assert.equal(presentation.events[0].kind, 'fleetPlanned');
    assert.deepEqual(presentation.events[0].boats.map(boat => boat.start), [3, 3, 3]);

    const placer = game.players[game.placementTurnIndex];
    assert.equal(game.handleAction(placer.id, { kind: 'placeAccomplice', location: 'ginseng' }).success, true);
    presentation = game.getPublicState().presentation;
    assert.equal(presentation.events[0].kind, 'accomplicePlaced');
    assert.equal(presentation.events[0].boatId, 1);
    assert.equal(presentation.events[0].slot, 1);

    passPlacements(game);
    presentation = game.getPublicState().presentation;
    assert.equal(presentation.events.some(event => event.kind === 'sailingRolled'), true);
    const order = [3, 1, 2];
    assert.equal(sail(game, order).success, true);
    presentation = game.getPublicState().presentation;
    const sailing = presentation.events.find(event => event.kind === 'boatsSailed');
    assert.ok(sailing);
    assert.deepEqual(sailing.order, order);
    assert.deepEqual(sailing.moves.map(move => move.boatId), order, '客户端可依这一顺序逐船播放移动');
    assert.equal(sailing.moves.every(move => Number.isInteger(move.from) && Number.isInteger(move.to)), true);
});

test('Manila publishes voyage ledger, market changes and final standings for major scenes', () => {
    const game = new ManilaEngine('manila-presentation-settlement', players(3), () => 0);
    game.start();
    game.market.人参 = 25;
    game.boats = [
        { id: 1, good: '人参', position: 14, fate: 'port', arrived: true, placements: [{ playerId: 'p1', fee: 1 }], pirates: [], finishOrder: 1 },
        { id: 2, good: '玉石', position: 10, fate: 'shipyard', arrived: false, placements: [], pirates: [], finishOrder: 2 },
        { id: 3, good: '丝绸', position: 9, fate: 'shipyard', arrived: false, placements: [], pirates: [], finishOrder: 3 },
    ];
    game.locations = Object.fromEntries(ManilaEngine.LOCATIONS.map(location => [location.id, []]));
    game.locations['port-a'] = [{ playerId: 'p2', fee: 4, slot: 1 }];
    game.players[0].placed = [{ location: 'ginseng', fee: 1 }];
    game.players[1].placed = [{ location: 'port-a', fee: 4 }];
    game._settleVoyage();

    const publicState = game.getPublicState();
    assert.equal(publicState.status, 'ended');
    assert.equal(publicState.voyageHistory.length, 1);
    assert.equal(publicState.lastVoyage.marketBefore.人参, 25);
    assert.equal(publicState.lastVoyage.marketAfter.人参, 30);
    assert.equal(publicState.lastVoyage.payoutDetails.some(detail => detail.kind === 'cargo' && detail.playerId === 'p1'), true);
    assert.equal(publicState.lastVoyage.payoutDetails.some(detail => detail.kind === 'port' && detail.playerId === 'p2'), true);
    assert.deepEqual(publicState.presentation.events.map(event => event.kind), ['voyageSettlement', 'finalSettlement']);
    const finale = publicState.presentation.events[1];
    assert.equal(finale.standings.length, 3);
    assert.deepEqual(new Set(finale.winnerIds), new Set(publicState.winners.map(player => player.id)));
    assert.equal(finale.standings.every(player => Number.isFinite(player.fortune)), true);
});
