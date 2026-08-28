const assert = require('node:assert/strict');
const test = require('node:test');
const LasVegas = require('../server/games/lasvegas');
const Engine = require('../server/games/lasvegas/engine');

function players(count) {
    return Array.from({ length: count }, (_, index) => ({ id: `lv${index}`, name: `玩家${index + 1}` }));
}

function random(seed) {
    let value = seed >>> 0;
    return () => {
        value = (value * 1664525 + 1013904223) >>> 0;
        return value / 4294967296;
    };
}

test('Las Vegas follows the official bank, setup, neutral-dice variants and four-round lifecycle', () => {
    assert.equal(Engine.buildMoneyDeck().length, 54);
    for (const count of [2, 3, 4, 5]) {
        const session = LasVegas.create(`lv-setup-${count}`, players(count), null, { random: random(count) });
        assert.equal(session.start().success, true);
        const game = session.engine;
        assert.equal(game.casinos.length, 6);
        assert.equal(game.casinos.every(casino => casino.money.reduce((sum, value) => sum + value, 0) >= 50), true);
        assert.equal(game.round, 1);
        assert.equal(game.presentation.resolved, true);
        assert.equal(game.presentation.events[0].kind, 'roundStarted');
        assert.equal(game.presentation.events[0].round, 1);
        assert.equal(game.presentation.events[0].starterId, 'lv0');
        assert.deepEqual(game.presentation.events[0].casinos.map(casino => casino.face), [1, 2, 3, 4, 5, 6]);
        assert.equal(session.start().success, false);
        if (count <= 4) {
            assert.ok(game.neutral);
            assert.equal(game.neutral.diceRemaining, 8);
            assert.equal(game.players.reduce((sum, player) => sum + player.neutralDiceRemaining, 0), 8);
            assert.equal(game.participants.length, count + 1);
            assert.equal(game.presentation.events[0].neutralDiceTotal, 8);
            if (count === 2) assert.deepEqual(game.players.map(player => player.neutralDiceRemaining), [4, 4]);
            if (count === 3) assert.deepEqual(game.players.map(player => player.neutralDiceRemaining), [4, 2, 2]);
            if (count === 4) assert.deepEqual(game.players.map(player => player.neutralDiceRemaining), [2, 2, 2, 2]);
        } else {
            assert.equal(game.neutral, null);
            assert.equal(game.participants.length, count);
            assert.equal(game.presentation.events[0].neutralDiceTotal, 0);
        }
    }
});

test('Las Vegas resolves ties before payout and returns neutral winnings to the bank', () => {
    const session = LasVegas.create('lv-ties', players(3), null, { random: random(55) });
    assert.equal(session.start().success, true);
    const game = session.engine;
    game.moneyDeck = [];
    game.round = 4;
    game.casinos = [
        { face: 1, money: [90, 80, 70], dice: { [game.neutral.id]: 3, lv0: 2, lv1: 1 } },
        ...Array.from({ length: 5 }, (_, index) => ({ face: index + 2, money: [50], dice: {} })),
    ];
    game.players.forEach(player => { player.diceRemaining = 0; player.neutralDiceRemaining = 0; });
    game.neutral.diceRemaining = 0;
    game._settleRound();
    assert.equal(game.players[0].money, 80);
    assert.equal(game.players[1].money, 70);
    assert.equal(game.neutral.money, 0);
    assert.ok(game.moneyDeck.includes(90), '中立骰子赢得的钞票应回到牌库底部');
    assert.equal(game.casinos.every(casino => casino.money.length === 0 && Object.keys(casino.dice).length === 0), true);
    assert.equal(game.status, 'ended');
});

test('Las Vegas completes three independent five-player maximum games', () => {
    for (const seed of [4101, 4102, 4103]) {
        const session = LasVegas.create(`lv-full-${seed}`, players(5), null, { random: random(seed) });
        assert.equal(session.start().success, true);
        const game = session.engine;
        let actions = 0;
        while (game.status === 'playing' && actions < 1000) {
            const current = game._currentParticipant();
            assert.ok(current && !current.isNeutral);
            assert.equal(session.handleAction(current.id, { kind: 'rollDice' }).success, true);
            const face = game.currentRoll[0];
            assert.equal(session.handleAction(current.id, { kind: 'placeDice', face }).success, true);
            actions += 1;
        }
        assert.equal(game.status, 'ended');
        assert.equal(game.round, 4);
        assert.ok(game.winner || game.winners.length > 1);
        assert.ok(actions < 1000);
        assert.equal(game.moneyDeck.length <= 54, true);
    }
});

test('Las Vegas publishes split dice and structured placement presentation events', () => {
    const session = LasVegas.create('lv-presentation', players(2), null, { random: () => 0 });
    assert.equal(session.start().success, true);
    assert.equal(session.handleAction('lv0', { kind: 'rollDice' }).success, true);
    const rolled = session.getPlayerState('lv1');
    assert.equal(rolled.currentRollOwn.length, 8);
    assert.equal(rolled.currentRollNeutral.length, 4);
    assert.equal(rolled.presentation.events[0].kind, 'diceRolled');
    assert.deepEqual(rolled.presentation.events[0].ownResults, Array(8).fill(1));
    assert.deepEqual(rolled.presentation.events[0].neutralResults, Array(4).fill(1));

    assert.equal(session.handleAction('lv0', { kind: 'placeDice', face: 1 }).success, true);
    const placed = session.getPlayerState('lv1');
    assert.equal(placed.presentation.events[0].kind, 'dicePlaced');
    assert.equal(placed.presentation.events[0].ownCount, 8);
    assert.equal(placed.presentation.events[0].neutralCount, 4);
    assert.equal(placed.presentation.events[0].diceAfter.lv0, 8);
    assert.equal(placed.presentation.events[0].diceAfter.neutral, 4);
});

test('Las Vegas preserves every casino settlement scene and uses banknote count as the final tiebreaker', () => {
    const session = LasVegas.create('lv-final-presentation', players(3), null, { random: random(2026) });
    assert.equal(session.start().success, true);
    const game = session.engine;
    game.round = 4;
    game.moneyDeck = [];
    game.players[0].money = 100;
    game.players[0].banknotes = [50, 50];
    game.players[1].money = 100;
    game.players[1].banknotes = [40, 30, 30];
    game.players[2].money = 0;
    game.players[2].banknotes = [];
    game.casinos = [
        { face: 1, money: [90, 70], dice: { lv0: 2, lv1: 2, lv2: 1 } },
        ...Array.from({ length: 5 }, (_, index) => ({ face: index + 2, money: [50], dice: {} })),
    ];
    game._settleRound();

    assert.deepEqual(game.winners.map(player => player.id), ['lv1']);
    assert.equal(game.roundHistory.length, 1);
    const events = game.getPublicState().presentation.events;
    assert.equal(events[0].kind, 'betsClosed');
    assert.equal(events.filter(event => event.kind === 'casinoSettlement').length, 6);
    const firstCasino = events.find(event => event.kind === 'casinoSettlement' && event.face === 1);
    assert.equal(firstCasino.ties[0].count, 2);
    assert.deepEqual(firstCasino.ties[0].participants.map(player => player.id), ['lv0', 'lv1']);
    assert.equal(firstCasino.payouts[0].playerId, 'lv2');
    assert.equal(events.at(-1).kind, 'finalSettlement');
    assert.deepEqual(events.at(-1).winnerIds, ['lv1']);
});
