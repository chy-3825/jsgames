const test = require('node:test');
const assert = require('node:assert/strict');

test('批量弃牌仅在新状态出现时播放一次，重连不重放', async () => {
    const { createMonopolyDealPresentation } = await import('../public/games/monopolydeal/presentation.js');
    const model = { collectedPlayKeys: new Set(), assetAnimationQueue: [], assetAnimationPlaying: false };
    const played = [];
    const controller = createMonopolyDealPresentation({ model, renderer: { animateDiscard: play => played.push(play) }, scene: {} });
    const play = { zone: 'discard', playerId: 'a', cards: [{ id: 'one' }, { id: 'two' }, { id: 'three' }] };
    const next = { turnNumber: 2, lastPlayedCard: play };
    controller.captureState(null, next);
    assert.equal(model.assetAnimationQueue.length, 0);
    controller.captureState({ turnNumber: 1 }, next);
    controller.captureState({ turnNumber: 1 }, next);
    assert.equal(model.assetAnimationQueue.length, 1);
    await controller.drainAssetCollections();
    assert.deepEqual(played, [play]);
    controller.captureState(next, next);
    assert.equal(model.assetAnimationQueue.length, 0);
    controller.destroy();
});
