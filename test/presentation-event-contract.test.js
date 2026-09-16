'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { auditPresentationEvents } = require('../scripts/presentation-event-audit');

test('服务端播报事件类型全部有对应的前端场景处理器', () => {
    const results = auditPresentationEvents();
    assert.equal(results.length, 18);
    for (const result of results) {
        assert.ok(result.kinds.length || result.mode === 'generic', `${result.game} 未检测到播报事件来源`);
        assert.deepEqual(result.missing, [], `${result.game} 存在未接入场景的播报事件`);
    }
});
