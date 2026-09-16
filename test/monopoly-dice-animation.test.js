const test = require('node:test');
const assert = require('node:assert/strict');
const Monopoly = require('../server/games/monopoly');

function game() {
    const session = Monopoly.create('dice-replay', [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }]);
    session.start();
    return session.engine;
}

test('ending a turn or appending activity cannot replay the previous roll', async () => {
    const { rollAnimationKey } = await import('../public/games/monopoly/state.js');
    const engine = game();
    const player = engine.getCurrentPlayer();
    engine._resolveRoll(player, [1, 3]); // Tax square: no purchase decision.
    const before = engine.getPlayerState(player.id);
    const key = rollAnimationKey(before.lastAction, before.lastAction.dice);
    assert.equal(engine._endTurn(player).success, true);
    engine.actionLog.push('界面刷新');
    const after = engine.getPlayerState(player.id);
    assert.notEqual(after.turnNumber, before.turnNumber);
    assert.equal(rollAnimationKey(after.lastAction, after.lastAction.dice), key);
    // Older servers without roll IDs must also ignore unrelated state changes.
    const { rollId, ...legacy } = before.lastAction;
    assert.equal(rollAnimationKey(legacy, legacy.dice), rollAnimationKey({ ...legacy }, legacy.dice));
});

test('real repeated rolls and failed jail rolls each receive a fresh animation ID', async () => {
    const { rollAnimationKey } = await import('../public/games/monopoly/state.js');
    const engine = game();
    const player = engine.getCurrentPlayer();
    engine._resolveRoll(player, [2, 2]);
    const first = engine.lastAction;
    engine.phase = 'turn_complete';
    engine._endTurn(player);
    assert.equal(engine.lastAction.rollId, first.rollId);
    engine._resolveRoll(player, [2, 2]);
    const second = engine.lastAction;
    assert.notEqual(rollAnimationKey(first, first.dice), rollAnimationKey(second, second.dice));
    player.inJail = true;
    player.jailTurns = 0;
    engine.phase = 'jail_decision';
    engine._rollDice = () => [1, 2];
    engine._rollFromJail(player);
    assert.equal(engine.lastAction.kind, 'rollForDoubles');
    assert.deepEqual(engine.lastAction.dice, [1, 2]);
    assert.ok(engine.lastAction.rollId > second.rollId);
});
