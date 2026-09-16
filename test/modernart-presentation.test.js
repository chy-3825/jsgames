'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const Room = require('../server/room');
const ModernArtEngine = require('../server/games/modernart/engine');
const PRESENTATION_FADE_MS = ModernArtEngine.PRESENTATION_FADE_MS;

const players = count => Array.from({ length: count }, (_, index) => ({ id: `p${index + 1}`, name: `玩家${index + 1}` }));
const eventsOf = state => (state.presentations || []).flatMap(batch => batch.events || []);
const work = (id, artistId = 'matisse', auctionType = 'open') => ({ id, artistId, artistName: artistId === 'matisse' ? '马蒂斯' : artistId === 'cassat' ? '卡萨特' : '吉田', auctionType });

function assertTimeline(state) {
    assert.ok(Number.isFinite(state.serverNow));
    assert.ok(Array.isArray(state.presentations));
    for (const batch of state.presentations) {
        assert.equal(batch.blocking, true);
        assert.ok(batch.endsAt > batch.startedAt);
        assert.equal(batch.durationMs, batch.endsAt - batch.startedAt);
        for (let index = 0; index < batch.events.length; index += 1) {
            const event = batch.events[index];
            assert.equal(event.sequence, event.eventId);
            assert.ok(event.endsAt > event.startedAt);
            assert.equal(event.durationMs, event.endsAt - event.startedAt);
            assert.equal(event.contentDurationMs + PRESENTATION_FADE_MS, event.durationMs);
            if (index) assert.equal(batch.events[index - 1].endsAt, event.startedAt);
        }
    }
    for (let index = 1; index < state.presentations.length; index += 1) {
        assert.equal(state.presentations[index - 1].endsAt, state.presentations[index].startedAt);
    }
    return state;
}

test('现代艺术由服务端提供绝对时间轴并跨操作保持播报 FIFO', () => {
    let now = 10_000;
    const game = new ModernArtEngine('modernart-presentation-timeline', players(4), { random: () => 0, now: () => now });
    assert.equal(game.start().success, true);
    let state = assertTimeline(game.getPublicState());
    assert.deepEqual(state.presentations[0].events.map(event => event.kind), ['seasonStarted']);
    assert.equal(state.presentations[0].startedAt, now);
    const openingEnd = state.presentation.endsAt;

    const seller = game.players[game.currentSellerIndex];
    assert.equal(game.handleAction(seller.id, { kind: 'startAuction', cardIndex: 0, amount: 1 }).success, true);
    state = assertTimeline(game.getPublicState());
    assert.equal(state.presentations.length, 2);
    assert.equal(state.presentations[1].startedAt, openingEnd);
    assert.deepEqual(state.presentations[1].events.map(event => event.kind), ['paintingPresented', 'auctionOpened']);
    assert.ok(state.presentations[1].events[0].endsAt <= state.presentations[1].events[1].startedAt);

    now = state.presentations[1].endsAt + 1;
    const expired = game.getPublicState();
    assert.deepEqual(expired.presentations, []);
    assert.equal(expired.presentation.blocking, true, 'the compatibility singular field keeps its deadline for room gating');
    const nextSeller = game.players[game.auction.currentBidderIndex];
    assert.equal(game.handleAction(nextSeller.id, { kind: 'bid', amount: 0 }).success, true);
    const nextState = assertTimeline(game.getPublicState());
    assert.ok(nextState.presentations.at(-1).startedAt >= now);
});

test('现代艺术房间在服务端播报结束前拒绝操作，结束后才放行', () => {
    const room = new Room('modernart-presentation-lock', 'p1', '玩家1', 'modernart', {}, { readyCheckEnabled: true });
    for (const player of players(3)) assert.equal(room.addPlayer(player).success, true);
    assert.equal(room.startGame().success, true);
    const locked = room.getPlayerGameState('p1').presentation;
    assert.equal(locked.blocking, true);
    assert.equal(room.handleGameAction('p1', { kind: 'startAuction', cardIndex: 0, amount: 1 }).success, false);
    const realNow = Date.now;
    Date.now = () => Number(locked.endsAt) + 1;
    try {
        assert.equal(room.handleGameAction('p1', { kind: 'startAuction', cardIndex: 0, amount: 1 }).success, true);
    } finally {
        Date.now = realNow;
    }
});

test('现代艺术仅向离场者和获胜者投影个人文案，同时保留相同时间槽', () => {
    let now = 20_000;
    const game = new ModernArtEngine('modernart-personal-projection', players(4), { random: () => 0, now: () => now });
    game.start();
    assert.equal(game.handlePlayerLeave('p1').success, true);
    const publicDeparture = eventsOf(game.getPublicState()).findLast(event => event.kind === 'playerLeft');
    const personalDeparture = eventsOf(game.getPlayerState('p1')).findLast(event => event.kind === 'playerLeft');
    const spectatorDeparture = eventsOf(game.getPlayerState('p2')).findLast(event => event.kind === 'playerLeft');
    assert.equal(personalDeparture.viewerVariant, 'personalDeparture');
    assert.equal(personalDeparture.title, '您已离开本局');
    assert.equal(personalDeparture.startedAt, publicDeparture.startedAt);
    assert.equal(personalDeparture.endsAt, publicDeparture.endsAt);
    assert.equal(spectatorDeparture.viewerVariant, undefined);

    game.players[1].cash = 150;
    game.players[2].cash = 120;
    game.players[3].cash = 110;
    game._finish();
    const publicFinal = eventsOf(game.getPublicState()).findLast(event => event.kind === 'finalSettlement');
    const winnerFinal = eventsOf(game.getPlayerState('p2')).findLast(event => event.kind === 'finalSettlement');
    const otherFinal = eventsOf(game.getPlayerState('p3')).findLast(event => event.kind === 'finalSettlement');
    assert.equal(winnerFinal.viewerVariant, 'personalVictory');
    assert.equal(winnerFinal.title, '您已获胜');
    assert.equal(winnerFinal.startedAt, publicFinal.startedAt);
    assert.equal(winnerFinal.endsAt, publicFinal.endsAt);
    assert.equal(otherFinal.viewerVariant, undefined);
});

function biddingGame(type) {
    const game = new ModernArtEngine(`modernart-leave-${type}`, players(4), { random: () => 0, now: () => 30_000 });
    game.start();
    game.players.forEach(player => { player.hand = []; player.collection = []; });
    game.players[0].hand = [work(`${type}-auction`, 'matisse', type)];
    game.players[1].hand = [work(`${type}-reserve-1`, 'cassat', 'open')];
    game.players[2].hand = [work(`${type}-reserve-2`, 'yoshida', 'open')];
    game.players[3].hand = [work(`${type}-reserve-3`, 'cassat', 'open')];
    game.currentSellerIndex = 0;
    assert.equal(game.handleAction('p1', { kind: 'startAuction', cardIndex: 0, amount: 5 }).success, true);
    assert.equal(game.phase, 'bidding');
    return game;
}

test('现代艺术当前卖家离场后交接到下一位在线卖家', () => {
    const game = new ModernArtEngine('modernart-leave-seller', players(4), { random: () => 0, now: () => 40_000 });
    game.start();
    game.players.forEach(player => { player.hand = [work(`${player.id}-work`, 'matisse', 'open')]; player.collection = []; });
    game.currentSellerIndex = 0;
    assert.equal(game.handlePlayerLeave('p1').success, true);
    assert.equal(game.getPublicState().currentTurn, 'p2');
    assert.equal(game.getPlayerState('p2').availableActions.startAuction, true);
});

test('现代艺术所有竞价类型都能在当前竞买人离场后继续并结算', () => {
    for (const type of ['open', 'once', 'sealed', 'fixed']) {
        const game = biddingGame(type);
        assert.equal(game.handlePlayerLeave('p2').success, true);
        assert.notEqual(game.getPublicState().currentTurn, 'p2');
        let guard = 0;
        while (game.status === 'playing' && game.phase === 'bidding' && guard++ < 10) {
            const bidder = game.players[game.auction.currentBidderIndex];
            assert.ok(bidder?.isOnline);
            const amount = type === 'fixed' ? 0 : 0;
            assert.equal(game.handleAction(bidder.id, { kind: 'bid', amount }).success, true);
        }
        assert.ok(guard < 10);
        assert.equal(game.phase, 'auction');
        assert.equal(game.auction, null);
    }
});

test('现代艺术双重拍卖可跳过离场席位，神秘变体在人数不足时安全收束', () => {
    const double = new ModernArtEngine('modernart-leave-double', players(4), { random: () => 0, now: () => 50_000 });
    double.start();
    double.players.forEach(player => { player.hand = []; player.collection = []; });
    double.players[0].hand = [work('double-first', 'matisse', 'double')];
    double.players[1].hand = [work('double-reserve-1', 'cassat', 'open')];
    double.players[2].hand = [work('double-reserve-2', 'yoshida', 'open')];
    double.players[3].hand = [work('double-reserve-3', 'cassat', 'open')];
    double.currentSellerIndex = 0;
    assert.equal(double.handleAction('p1', { kind: 'startAuction', cardIndex: 0 }).success, true);
    assert.equal(double.phase, 'double_offer');
    assert.equal(double.handlePlayerLeave('p1').success, true);
    assert.equal(double.getPublicState().currentTurn, 'p2');
    assert.equal(double.handleAction('p2', { kind: 'passSecond' }).success, true);
    assert.equal(double.handleAction('p3', { kind: 'passSecond' }).success, true);
    assert.equal(double.phase, 'auction');
    assert.equal(double.getPublicState().currentTurn, 'p2');

    const mystery = new ModernArtEngine('modernart-leave-mystery', players(3), { random: () => 0, now: () => 60_000, mysteryPlayer: true });
    mystery.start();
    mystery.players.forEach(player => { player.hand = [work(`${player.id}-mystery-work`, 'matisse', 'open')]; player.collection = []; });
    mystery.mysteryHand = [work('mystery-card', 'cassat', 'open')];
    mystery.currentSellerIndex = 0;
    assert.equal(mystery.handleAction('p1', { kind: 'startAuction', cardIndex: 0 }).success, true);
    for (const id of ['p2', 'p3', 'p1']) assert.equal(mystery.handleAction(id, { kind: 'bid', amount: 0 }).success, true);
    assert.equal(mystery.phase, 'mystery_offer');
    assert.equal(mystery.handlePlayerLeave('p1').ended, true);
    assert.equal(mystery.status, 'ended');
    assert.equal(mystery.endReason, 'players');
    assert.equal(mystery.getPublicState().presentations.at(-1).events.at(-1).kind, 'finalSettlement');
});

test('现代艺术三人以下离场会完成最终播报，正常结束后再离场不改冠军', () => {
    const closing = new ModernArtEngine('modernart-leave-final', players(3), { random: () => 0, now: () => 70_000 });
    closing.start();
    closing.players[0].cash = 150;
    closing.players[1].cash = 120;
    assert.equal(closing.handlePlayerLeave('p3').ended, true);
    assert.equal(closing.status, 'ended');
    assert.equal(closing.endReason, 'players');
    assert.equal(closing.outcome, 'lastPlayerStanding');
    assert.equal(closing.getWinner().id, 'p1');
    assert.deepEqual(closing.getPublicState().presentations.at(-1).events.map(event => event.kind), ['playerLeft', 'finalSettlement']);
    assert.equal(eventsOf(closing.getPlayerState('p1')).findLast(event => event.kind === 'finalSettlement').title, '您已获胜');

    const natural = new ModernArtEngine('modernart-terminal-immutable', players(3), { random: () => 0, now: () => 80_000 });
    natural.start();
    natural.players[0].cash = 1;
    natural.players[1].cash = 99;
    natural.players[2].cash = 5;
    natural._finish();
    const winnerBefore = natural.getWinner();
    const sequenceBefore = natural.presentationSequence;
    assert.equal(natural.handlePlayerLeave('p3').success, true);
    assert.deepEqual(natural.getWinner(), winnerBefore);
    assert.equal(natural.presentationSequence, sequenceBefore);
});

test('现代艺术客户端按服务端时间偏移消费并忽略过期播报', async () => {
    const { localizePresentation } = await import('../public/games/modernart/state.js');
    const batch = { sequence: 2, transactionId: 2, serverNow: 10_000, startedAt: 10_100, endsAt: 11_000, events: [{ kind: 'auctionOpened', startedAt: 10_100, endsAt: 11_000 }] };
    const localized = localizePresentation(batch, 50_000);
    assert.equal(localized.startedAt, 50_100);
    assert.equal(localized.events[0].endsAt, 51_000);
    assert.equal(localizePresentation({ ...batch, endsAt: 10_000 }, 50_000), null);
});
