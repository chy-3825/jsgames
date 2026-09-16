const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const client = ['client.js', 'constants.js', 'cards.js', 'state.js', 'template.js', 'render.js', 'scene.js', 'actions.js']
    .map(file => fs.readFileSync(path.join(root, 'public/games/coup', file), 'utf8')).join('\n');
const css = ['style.css', 'private.css', 'scenes.css', 'responsive.css']
    .map(file => fs.readFileSync(path.join(root, 'public/games/coup', file), 'utf8')).join('\n');
const visualFixture = ['public/__game_shell_visual_test.html', 'public/visual-fixtures/fixture-state.js', 'public/visual-fixtures/fixture-scenarios.js']
    .map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');

test('政变模态弹层具备焦点限定、恢复和背景隔离', () => {
    assert.match(client, /function trapOverlayFocus\(/);
    assert.match(client, /overlayReturnFocus/);
    assert.match(client, /child\.inert = Boolean\(active && child !== active\)/);
    assert.match(client, /if \(open\) focusOverlay\(overlay\)/);
});

test('政变禁用行动原因对触屏和读屏用户可见', () => {
    assert.match(client, /class="cp-action-reason"/);
    assert.match(client, /aria-describedby="cp-action-reason-/);
    assert.match(css, /\.cp-action-reason\s*\{/);
    assert.match(client, /金币不足：需要/);
});

test('政变小型玩家席位等宽并保留独立间距', () => {
    assert.match(css, /grid-template-columns:\s*repeat\(var\(--seat-count\), 210px\)/);
    assert.match(css, /\.cp-players\s*\{[^}]*gap:\s*14px/);
    assert.match(css, /\.cp-seat\s*\{[^}]*border-radius:\s*6px/);
    assert.match(client, /dataset\.seatCount = String\(opponents\.length\)/);
    assert.match(css, /\.cp-players\[data-seat-count="2"\][\s\S]*?width:\s*min\(570px/);
    assert.match(css, /\.cp-players\[data-seat-count="3"\][\s\S]*?width:\s*min\(800px/);
});

test('政变状态栏跟随游戏外壳偏移，不遮挡下方玩家席位标题', () => {
    assert.match(css, /\.cp-statusbar\s*\{[\s\S]*?top:\s*var\(--game-shell-offset,\s*48px\)/);
    assert.doesNotMatch(css, /\.cp-statusbar\s*\{[\s\S]*?top:\s*70px/);
});

test('政变顶部不再显示回合提示文字', () => {
    assert.doesNotMatch(client, /cp-turn-status|cp-turn-dot|data-role="(?:turn|phase)"/);
    assert.doesNotMatch(css, /cp-turn-status|cp-turn-dot|cp-turn-pulse/);
    assert.match(css, /\.cp-statusbar\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto\s+38px/);
});

test('政变中央舞台用共同资源框、行动区和独立记录分区', () => {
    assert.match(client, /class="cp-supply"/);
    assert.match(client, /class="cp-court-deck"/);
    assert.match(client, /class="cp-treasury"[^>]*data-role="treasury"/);
    assert.match(client, /国库/);
    assert.match(css, /\.cp-stage\s*\{[^}]*border:\s*1px solid[^}]*border-radius:\s*6px/);
    assert.match(css, /\.cp-supply\s*\{[^}]*padding:\s*0/);
    assert.match(css, /\.cp-supply\s*\{[^}]*grid-template-rows:\s*repeat\(2, 84px\)[^}]*margin:\s*8px 2px/);
    assert.match(css, /\.cp-court-deck,\s*\.cp-treasury\s*\{[^}]*border:\s*1px solid[^}]*border-radius:\s*5px/);
    assert.match(css, /\.cp-deck-stack\s*\{[^}]*width:\s*42px/);
    assert.match(css, /\.cp-stage-core\s*\{[^}]*grid-template-columns:\s*minmax\(148px, 172px\) minmax\(250px, 1fr\)/);
    assert.match(client, /class="cp-intel-header"[^>]*data-action="open-history"/);
    assert.match(client, /data-role="historyOverlay"/);
    assert.doesNotMatch(client, /class="cp-timeline-entry"[^>]*data-action/);
});

test('政变无玩家目标的行动不把关系线画进中央出牌区', () => {
    assert.match(client, /const actionTarget = interaction\.targetId \? playerAnchor\(interaction\.targetId\) : null/);
    assert.doesNotMatch(client, /const treasuryTarget/);
    assert.doesNotMatch(client, /\['income', 'foreign_aid', 'tax'\][^;]*\$\('treasury'\)/);
    assert.match(client, /const responseSourceId = interaction\.challengerId \|\| interaction\.blockerId/);
    assert.match(client, /drawLink\(responseSource, responseTarget, 'response'\)/);
});

test('政变关系线使用玩家小席位而不是整个私人手牌区作为锚点', () => {
    assert.match(client, /data-player-id="\$\{escapeHtml\(player\.id\)\}" data-player-anchor="\$\{escapeHtml\(player\.id\)\}"/);
    assert.match(client, /class="cp-self-summary[^>]*data-player-anchor="\$\{escapeHtml\(state\.myId\)\}"/);
    assert.match(client, /querySelectorAll\('\[data-player-anchor\]'\)[^;]*element\.dataset\.playerAnchor === String\(playerId\)/);
    assert.doesNotMatch(client, /function playerAnchor\(playerId\) \{\s*return \[\.\.\.mount\.querySelectorAll\('\[data-player-id\]'\)/);
});

test('政变进入质疑或阻挡流程后隐藏穿过中央舞台的原行动线', () => {
    assert.match(client, /const showActionRoute = !state\.challenge/);
    assert.match(client, /if \(showActionRoute && actionSource && actionTarget\)/);
    assert.match(client, /const responseSourceId = interaction\.challengerId \|\| interaction\.blockerId/);
    assert.match(client, /drawLink\(responseSource, responseTarget, 'response'\)/);
});

test('政变目标行动在中央区预览完整角色牌、效果与下一步', () => {
    assert.match(client, /function renderPendingAction\(action, locked\)/);
    assert.match(client, /is-selection-preview/);
    assert.match(client, /action\?\.desc/);
    assert.match(client, /请选择从上方玩家席位|请从上方玩家席位/);
    assert.match(css, /\.cp-event\.is-selection-preview\s*\{[^}]*grid-template-columns:\s*138px minmax\(0, 1fr\)/);
    assert.match(css, /\.cp-event\.is-selection-preview\s+\.cp-event-card\s*\{[^}]*width:\s*104px[^}]*justify-self:\s*center/);
    assert.match(client, /<div class="cp-claim-stack">\$\{mainCard\}\$\{blockCard\}<\/div>\s*<div class="cp-event-copy"><span>\$\{esc\(stageCopy\.label\)\}<\/span><strong>\$\{esc\(stageCopy\.title\)\}/);
    assert.doesNotMatch(client, /routeTarget|→<\/i><strong>/);
    assert.match(css, /\.cp-public-interaction\s*\{[^}]*grid-template-columns:\s*138px minmax\(0, 1fr\)/);
});

test('政变所有行动先进入预览并由确认按钮提交', () => {
    assert.match(client, /function handleAction\(kind\)[\s\S]*?model\.pendingAction = \{ kind \}/);
    assert.match(client, /data-action="confirm-action"/);
    assert.match(client, /model\.submitting \|\| \(action\?\.needsTarget && !target\) \? 'disabled'/);
    assert.doesNotMatch(client, /model\.pendingAction\.kind === 'exchange'/);
    assert.doesNotMatch(client, /data-action="confirm-exchange"/);
    assert.doesNotMatch(client, /声称大使并交换？/);
});

test('政变提交期间锁定行动与响应，服务端回复后解锁', () => {
    assert.match(client, /model\.submitting = true;\s*send\(\{ type: 'gameAction'/);
    assert.match(client, /model\.submitting \|\| presentationLocked\(\)/);
    assert.match(client, /model\.state = message\.state;\s*model\.submitting = false/);
    assert.match(client, /message\.type === 'error'[\s\S]*?model\.submitting = false/);
    assert.match(client, /aria-busy[\s\S]*?presentationLocked\(\) \|\| model\.submitting/);
});

test('政变交换只确认一次，并用清晰金色边框标记保留牌', () => {
    assert.doesNotMatch(client, /case 'confirm-exchange'/);
    assert.doesNotMatch(client, /exchangeMode === 'confirm'/);
    assert.match(client, /kind: model\.pendingAction\.kind/);
    assert.match(css, /\.cp-influence\.is-exchange\.is-selected\s*\{[^}]*border:\s*3px solid #f2c861/);
});

test('政变桌面端悬停预览行动，点击后锁定，并可点人物牌查看说明', () => {
    assert.match(client, /hoveredActionKind/);
    assert.match(client, /\(hover: hover\) and \(pointer: fine\)/);
    assert.match(client, /mount\.addEventListener\('mouseover', actions\.handlePointerOver/);
    assert.match(client, /model\.pendingAction\?\.kind \|\| model\.hoveredActionKind/);
    assert.match(client, /data-role-card=/);
    assert.match(client, /function openRoleDetail\(role\)/);
    assert.match(client, /data-role="roleDetailOverlay"/);
    assert.match(css, /\.cp-role-detail\s*\{/);
});

test('政变视觉验收覆盖普通回合、质疑、失去影响力和大使交换', () => {
    for (const scenario of ['turn', 'challenge', 'loss', 'exchange']) {
        assert.match(visualFixture, new RegExp(`['\"]${scenario}['\"]`));
    }
    assert.match(visualFixture, /coupScenarioFits/);
    assert.match(visualFixture, /\.cp-exchange-dialog/);
    assert.match(visualFixture, /\.cp-loss-cards \[data-loss-index\]/);
});

test('政变自己的影响力始终正面可见并可直接点击选择', () => {
    assert.doesNotMatch(client, /data-identity-hold/);
    assert.doesNotMatch(client, /privateIdentityVisible/);
    assert.doesNotMatch(client, /cp-private-card-cover/);
    assert.match(client, /lossIndex: !card\.revealed && ready \? index : undefined/);
    assert.match(client, /data-exchange-index/);
    assert.match(client, /牌面仅您可见/);
});

test('政变自己的席位位于手牌左侧并与公开席位同尺寸', () => {
    assert.match(client, /<header class="cp-self-summary[^>]*>[\s\S]*?<div class="cp-private-identity">/);
    assert.match(css, /\.cp-players\s*\{[^}]*grid-template-columns:\s*repeat\(var\(--seat-count\), 210px\)[^}]*min-height:\s*74px/);
    assert.match(css, /\.cp-seat\s*\{[^}]*min-height:\s*58px[^}]*padding:\s*7px 9px/);
    assert.match(css, /\.cp-private\s*\{[^}]*grid-template-columns:\s*210px minmax\(0, 1fr\)/);
    assert.match(css, /\.cp-private\s*>\s*header\.cp-self-summary\s*\{[^}]*width:\s*210px[^}]*min-height:\s*58px/);
});

test('政变本人大角色区不显示左侧事件边，桌面端小玩家框略向右错开', () => {
    assert.equal((client.match(/<i class="cp-seat-event-marker"/g) || []).length, 0);
    assert.doesNotMatch(client, /<section class="cp-private[^>]*><i class="cp-seat-event-marker"/);
    assert.match(css, /@media \(min-width:\s*901px\)[\s\S]*?\.cp-private\s*\{[\s\S]*?transform:\s*translate\(12px, 8px\)/);
});

test('政变桌面端本人大框将小玩家框与手牌作为整体居中', () => {
    assert.match(css, /@media \(min-width:\s*1101px\)[\s\S]*?\.cp-private\s*\{[^}]*grid-template-columns:\s*210px max-content;[^}]*justify-content:\s*center;[^}]*padding-inline:\s*0/);
    assert.match(css, /@media \(min-width:\s*901px\) and \(max-width:\s*1100px\)[\s\S]*?\.cp-private\s*\{[^}]*grid-template-columns:\s*190px max-content;[^}]*justify-content:\s*center/);
});

test('政变偷窃、质疑与阻挡不再显示玩家框左侧色条', () => {
    assert.doesNotMatch(client, /cp-seat-event-marker/);
    assert.doesNotMatch(css, /\.cp-seat-event-marker/);
    assert.match(css, /\.cp-seat\.is-action-target,[\s\S]*?border-color:\s*rgba\(216, 105, 116/);
    assert.match(css, /\.cp-seat\.is-challenger,[\s\S]*?border-color:\s*rgba\(201, 86, 98/);
    assert.match(css, /\.cp-seat\.is-blocker,[\s\S]*?border-color:\s*rgba\(94, 185, 191/);
});

test('政变选择失去的影响力时不在出牌区显示红色竖线', () => {
    assert.match(css, /\.cp-loss-panel\.is-action-target\s*\{[^}]*background:\s*linear-gradient/);
    assert.doesNotMatch(css, /\.cp-loss-panel\.is-action-target\s*\{[^}]*border-left:\s*3px/);
});

test('政变玩家席位只展示名字、金币和牌面，并用金色边框标记回合', () => {
    assert.match(client, /<span class="cp-seat-copy"><strong>\$\{escapeHtml\(player\.name\)\}<\/strong><span class="cp-seat-coins">/);
    assert.doesNotMatch(client, /<span class="cp-seat-copy"><strong>\$\{escapeHtml\(player\.name\)\}<\/strong><small>/);
    assert.match(client, /class="cp-self-summary \$\{myTurn \? 'is-turn' : ''\} \$\{selfIsResponding \? 'is-responding' : ''\}"/);
    assert.match(css, /\.cp-seat\.is-turn:not\([\s\S]*?\.cp-private\s*>\s*\.cp-self-summary\.is-turn:not\([\s\S]*?border-color:\s*#d9b66f/);
    assert.doesNotMatch(css, /0 0 0 2px rgba\(217,\s*182,\s*111/);
    assert.doesNotMatch(css, /\.cp-seat\.is-turn\s*\{[\s\S]*?background:\s*rgba\(105,\s*79,\s*48/);
});

test('政变用单层边框和底色区分行动、响应和结算状态', () => {
    assert.match(client, /function activeSeatInteraction\(state\)/);
    assert.match(client, /\['resolved', 'cancelled'\]\.includes\(interaction\.stage\)/);
    assert.match(client, /function currentDecisionPlayerId\(state\)/);
    assert.match(client, /isResponding \? 'is-responding'/);
    assert.doesNotMatch(client, /cp-seat-event-marker/);
    assert.doesNotMatch(css, /--cp-seat-event-color/);
    assert.match(css, /\.cp-seat\.is-challenger,[\s\S]*?border-color:\s*rgba\(201, 86, 98/);
    assert.match(css, /\.cp-seat\.is-blocker,[\s\S]*?border-color:\s*rgba\(94, 185, 191/);
    assert.match(css, /\.cp-seat\.is-responding,[\s\S]*?border-color:\s*#78aebb/);
    assert.doesNotMatch(css, /cp-target-breathe/);
    assert.doesNotMatch(css, /\.cp-influence\.is-face\s*\{[^}]*0 0 0 2px/);
    assert.doesNotMatch(css, /\.cp-influence\.is-selectable\s*\{[^}]*0 0 0 3px/);
    assert.match(css, /\.cp-private\s*\{[^}]*border-right:\s*0/);
});

test('政变全屏播报由服务器时间轴覆盖完整公开流程', () => {
    const engine = fs.readFileSync(path.join(root, 'server/games/coup/engine.js'), 'utf8');
    assert.match(engine, /const PRESENTATION_EVENT_KINDS = new Set\(\[[\s\S]*?actionDeclared[\s\S]*?challengeDeclared[\s\S]*?blockDeclared[\s\S]*?influenceRevealed[\s\S]*?playerEliminated[\s\S]*?finalSettlement/);
    assert.match(client, /scene\.enqueuePresentation/);
    assert.match(client, /type: 'elimination'/);
    assert.match(client, /type: 'victory'/);
    assert.match(client, /if \(!hasServerTimeline\) scene\.enqueueScenes/);
    assert.match(css, /\.cp-scene-layer\.is-verdict\.is-proved/);
    assert.match(css, /\.cp-scene-verdict-mark/);
});

test('政变中央行动结果不重复结算与记录状态', () => {
    assert.doesNotMatch(client, /行动结果已写入局势记录/);
    assert.doesNotMatch(client, /本次交锋已经结算/);
    assert.doesNotMatch(client, /身份裁决即将发生/);
    assert.match(client, /interaction\.kind === 'income'[\s\S]*?获得 1 枚金币/);
    assert.match(client, /interaction\.kind === 'steal'[\s\S]*?获得 \$\{interaction\.amount \?\? 2\} 枚金币/);
});
