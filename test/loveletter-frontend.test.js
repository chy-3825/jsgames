const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const client = fs.readFileSync('public/games/loveletter/client.js', 'utf8');
const actions = fs.readFileSync('public/games/loveletter/actions.js', 'utf8');
const cards = fs.readFileSync('public/games/loveletter/cards.js', 'utf8');
const render = fs.readFileSync('public/games/loveletter/render.js', 'utf8');
const scene = fs.readFileSync('public/games/loveletter/scene.js', 'utf8');
const state = fs.readFileSync('public/games/loveletter/state.js', 'utf8');
const template = fs.readFileSync('public/games/loveletter/template.js', 'utf8');
const style = fs.readFileSync('public/games/loveletter/style.css', 'utf8');

test('情书入口只负责协议与生命周期，界面和演出按模块拆分', () => {
    assert.match(client, /getGameStyleHrefs\('loveletter'\)/);
    assert.match(client, /createClientScope\(/);
    assert.match(client, /loadStyles\(/);
    assert.match(client, /styleHandle\.release\(\)/);
    assert.match(client, /createLoveLetterTemplate\(/);
    assert.match(client, /createLoveLetterRenderer\(/);
    assert.match(client, /createLoveLetterScene\(/);
    assert.match(client, /createLoveLetterActions\(/);
    assert.ok(client.split('\n').length < 150, '入口不应重新堆回大段渲染与演出代码');
    assert.match(render, /function renderCommand\(/);
    assert.match(scene, /function playSceneQueue\(/);
    assert.match(state, /deriveScenes\(/);
});

test('情书顶部不再显示回合提示文字', () => {
    assert.doesNotMatch(template, /ll-turn-status|ll-turn-dot/);
    assert.doesNotMatch(template, /data-role="(?:turn|phase)"/);
    assert.doesNotMatch(render, /\$\('(?:turn|phase)'\)/);
    assert.doesNotMatch(style, /ll-turn-status|ll-turn-dot|ll-turn-pulse/);
    assert.match(style, /\.ll-statusbar\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+38px/);
});

test('情书规则、猜牌与牌堆记录弹层保留可访问焦点边界', () => {
    assert.match(client, /createModalController\(/);
    assert.match(actions, /rulesModal\.trapFocus/);
    assert.match(actions, /trapGuessFocus/);
    assert.match(template, /data-role="rulesOverlay"[^>]*aria-hidden="true"/);
    assert.match(template, /data-role="guessOverlay"[^>]*aria-hidden="true"/);
    assert.match(template, /data-role="archiveOverlay"[^>]*aria-hidden="true"/);
    assert.match(client, /archiveModal/);
    assert.match(actions, /archiveModal\.trapFocus/);
});

test('情书保留私密牌面、行动确认和回合结算演出', () => {
    assert.match(render, /ll-hidden-card/);
    assert.match(render, /data-action="acknowledge-action"/);
    assert.match(scene, /showScene\('showdown'/);
    assert.match(scene, /renderShowdownPlayer/);
    assert.match(style, /orientation:\s*landscape/);
});

test('情书按服务端时间轴排队，并为当事人替换个人结果播报', () => {
    assert.match(state, /serverTimeline\.endsAt/);
    assert.match(state, /'personalElimination'/);
    assert.match(state, /type:\s*'personalVictory'/);
    assert.match(scene, /您已出局/);
    assert.match(scene, /您已获胜/);
    assert.match(scene, /sceneQueue\.push/);
});

test('情书以密函、人物和收信目标组成中央叙事舞台', () => {
    assert.match(template, /ll-stage-heading/);
    assert.match(template, /ll-stage-layout/);
    assert.match(template, /class="ll-play-field"/);
    assert.match(template, /ll-letter-piles/);
    assert.match(template, /class="ll-court-record"/);
    assert.match(template, /data-role="publicRemovedPile"/);
    assert.match(template, /备用牌/);
    assert.match(template, /历史记录/);
    assert.match(template, /class="ll-record-header"[^>]*data-action="open-archive"[^>]*data-archive="all"/);
    assert.doesNotMatch(template, /class="ll-record-history"[^>]*data-action="open-archive"/);
    assert.match(template, /data-archive="removed"/);
    assert.match(template, /ll-pile-deck/);
    assert.match(template, /ll-pile-reserved/);
    assert.match(template, /data-role="recentActions"/);
    assert.match(template, /data-role="archiveList"/);
    assert.match(render, /function renderStageHeading\(/);
    assert.match(render, /function renderFinalResult\(/);
    assert.match(render, /ll-action-card-shell/);
    assert.match(render, /ll-action-label[^>]*>最近出牌</);
    assert.doesNotMatch(render, /ll-action-route/, '中央行动不再重复渲染发信人和目标文字');
    assert.match(render, /baronOutcome/);
    assert.doesNotMatch(render, /比较公开弃牌总点数/);
    assert.match(render, /discardedCard/);
    assert.doesNotMatch(render, /ll-seat-shield/);
    assert.match(render, /player\.isProtected \? '侍女保护'/);
    assert.match(render, /ll-hand-decision/);
    assert.match(render, /function renderArchive\(/);
    assert.match(render, /publicRemovedPile/);
    assert.match(style, /\.ll-letter-object\s*\{/);
    assert.match(style, /\.ll-action-console\s*\{/);
    assert.match(style, /\.ll-card-back \.ll-back-rose-art/);
    assert.match(cards, /ll-back-rose-art/);
    assert.match(cards, /\/assets\/games\/loveletter\/rose-card-back-gold\.png/);
    assert.doesNotMatch(cards, /ll-back-(?:envelope|seal)/, '烫金玫瑰不应再叠加信封或火漆装饰');
    assert.ok(fs.existsSync('public/assets/games/loveletter/rose-card-back-gold.png'), '烫金玫瑰牌背资源应随项目发布');
    assert.match(cards, /ll-card-back-ornament/);
    assert.match(style, /\.ll-card-back-ornament-top/);
    assert.match(style, /\.ll-card-back::after\s*\{\s*display:\s*none/);
    assert.match(style, /\.ll-pile-reserved \.ll-card-back/);
    assert.match(style, /\.ll-pile-discard \.ll-card-back/);
    assert.match(style, /\.ll-action-link\.is-settled/);
    assert.match(style, /\.ll-action-label\s*\{/);
    assert.match(scene, /state\?\.pendingAction \|\| state\?\.lastAction/);
});

test('情书把当前回合收束为单一决定面', () => {
    assert.match(render, /function renderInitialAction\(/);
    assert.match(render, /\$\{actor\}对\$\{actionTarget\}打出\$\{cardName\}/);
    assert.match(render, /result\.eliminated \? `猜测\$\{guessedRole\}正确，\$\{displayName\(result\.eliminated\)\}出局。`/);
    assert.match(render, /<strong>\$\{esc\(cardName\)\}<\/strong><small>\$\{esc\(detail\)\}/);
    assert.match(render, /<aside class="ll-action-detail/);
    assert.match(render, /选择一张牌/);
    assert.match(render, /等待第一位信使/);
    assert.doesNotMatch(render, /ll-first-turn-prompt/);
    assert.match(template, /data-role="stageHeading" hidden/);
    assert.match(template, /ll-table-action ll-initial-action/);
    assert.match(template, /<strong>2人局公共弃牌<\/strong>/);
    assert.doesNotMatch(template, /publicRemovedCount|张起始牌已公开/);
    assert.match(template, /aria-label="最近两次行动"/);
    assert.match(render, /filter\(entry => entry\.reason === 'played'\)\.slice\(-limit\)\.reverse\(\)/);
    assert.doesNotMatch(template, /ll-letter-idle/);
    assert.doesNotMatch(render, /COURT PERSONA/);
    assert.match(style, /FINAL OVERRIDE: one visual focus/);
    assert.match(style, /\.ll-app\.is-my-turn \.ll-stage-heading/);
    assert.match(style, /\.ll-app\.is-initial-state \.ll-stage-heading/);
    assert.match(style, /\.ll-initial-copy\s*\{[^}]*grid-column:\s*1 \/ -1;[^}]*grid-row:\s*1 \/ -1;[^}]*align-self:\s*center;[^}]*justify-self:\s*center/);
    assert.match(style, /grid-template-columns:\s*repeat\(var\(--seat-count\), 210px\)/);
    assert.match(style, /\.ll-command-shell\s*\{[^}]*grid-template-columns:\s*190px/);
    assert.match(style, /\.ll-table\s*\{[^}]*border:\s*0;[^}]*border-top:[^}]*border-bottom:[^}]*border-radius:\s*0;[^}]*background:\s*transparent;[^}]*box-shadow:\s*none/);
    assert.match(style, /\.ll-table-action\s*\{[^}]*grid-template-columns:\s*138px minmax\(0, 1fr\)/);
    assert.match(style, /\.ll-stage-layout\s*\{[^}]*grid-template-columns:\s*minmax\(550px, 1fr\) minmax\(320px, 400px\)/);
    assert.match(style, /\.ll-play-field\s*\{[^}]*grid-template-columns:\s*minmax\(132px, 158px\) minmax\(360px, 1fr\)[^}]*border:\s*1px solid/);
    assert.match(style, /\.ll-recent-action\s*\{[^}]*display:\s*grid/);
    assert.doesNotMatch(render, /class="ll-recent-action"[^>]*data-action/);
    assert.match(style, /\.ll-court-record\s*\{[^}]*align-content:\s*start;[^}]*min-height:\s*210px/);
    assert.match(style, /\.ll-letter-piles \.ll-pile\s*\{[^}]*border:\s*0;[^}]*background:\s*transparent/);
    assert.match(style, /\.ll-letter-piles\s*\{[^}]*border:\s*1px solid[^}]*border-radius:\s*5px[^}]*background:/);
    assert.match(style, /\.ll-letter-piles \.ll-pile\s*\{[^}]*justify-content:\s*center/);
    assert.match(style, /\.ll-letter-piles \.ll-pile-card\s*\{[^}]*left:\s*0/);
    assert.match(render, /dataset\.seatCount = String\(opponents\.length\)/);
    assert.match(style, /\.ll-opponents\[data-seat-count="2"\][\s\S]*?width:\s*min\(570px/);
    assert.match(style, /\.ll-opponents\[data-seat-count="3"\][\s\S]*?width:\s*min\(800px/);
    assert.match(style, /\.ll-seat-copy\s*\{[^}]*flex-direction:\s*column/);
    assert.match(style, /\.ll-seat-score\s*\{[^}]*margin-top:\s*auto/);
    assert.match(style, /grid-template-areas:\s*"self hand action"/);
    assert.match(render, /<aside class="ll-self-summary/);
    assert.doesNotMatch(render, /player\.handCount \?\? 0/);
    assert.match(style, /\.ll-self-summary\.is-turn/);
    assert.match(style, /\.ll-seat\.is-protected:not\(\.is-targetable\)/);
    assert.doesNotMatch(style, /\.ll-seat-shield\s*\{/);
});

test('情书选中手牌后在中央出牌区预览人物牌与效果', () => {
    assert.match(render, /function renderSelectedCard\(card, locked\)/);
    assert.match(render, /is-selection-preview/);
    assert.match(render, /renderSceneCard\(card\)/);
    assert.match(render, /shortEffect\(card\.id\)/);
    assert.match(render, /compactEffect\(card\.id\)/);
    assert.match(render, /准备出牌/);
    assert.match(style, /\.ll-selection-action\s+\.ll-action-card-shell/);
});

test('牧师和王子的手牌结果在目标席位翻开而非中央重复展示', () => {
    assert.match(render, /state\.seatReveals/);
    assert.match(render, /seatReveal\.result\?\.revealedCard/);
    assert.match(render, /seatReveal\.result\?\.discardedCard/);
    assert.match(render, /presentedSeatRevealIds\.has\(revealId\)/);
    assert.match(style, /\.ll-seat-reveal\.is-new-effect-reveal\s*\{[^}]*animation:/);
    assert.doesNotMatch(style, /\.ll-seat-reveal\.is-effect-reveal\s*\{[^}]*animation:/);
    assert.doesNotMatch(render, /ll-seat-reveal-note|牧师查看<\/small>|王子弃牌<\/small>/);
    assert.doesNotMatch(render, /renderTinyCard\(privateCard/);
    assert.doesNotMatch(render, /renderTinyCard\(discarded, 'll-tiny-result'/);
});

test('情书桌面端悬停临时预览手牌，点击后锁定中央卡名', () => {
    assert.match(state, /hoveredCardIndex:\s*null/);
    assert.match(actions, /\(hover: hover\) and \(pointer: fine\)/);
    assert.match(client, /mount\.addEventListener\('mouseover', actions\.handlePointerOver/);
    assert.match(render, /model\.selectedCardIndex \?\? model\.hoveredCardIndex/);
    assert.match(render, /const locked = model\.selectedCardIndex !== null/);
    assert.match(render, /function refreshEvent\(\)/);
});

test('情书人物行动数量不同也保持打出按钮等高并居中', () => {
    assert.match(style, /\.ll-action-panel\s*\{[^}]*align-content:\s*center/);
    assert.match(style, /\.ll-action-panel\s*>\s*\.ll-primary\s*\{[^}]*height:\s*37px/);
});

test('情书玩家框和手牌使用单层边框，等待目标不改变角色框尺寸', () => {
    assert.doesNotMatch(render, /ll-seat-event-marker/);
    assert.match(style, /\.ll-seat\.is-action-source\s*\{[^}]*border-color:/);
    assert.doesNotMatch(style, /\.ll-seat\.is-action-source\s*\{[^}]*--ll-seat-event-color/);
    assert.match(style, /\.ll-seat\.is-action-target\s*\{[^}]*border-color:\s*#d26b79[^}]*box-shadow:\s*none/);
    assert.match(style, /\.ll-hand-card\s*\{[^}]*border:\s*1px solid #b49a70/);
    assert.doesNotMatch(style, /\.ll-hand-card\.is-selected::after/);
    assert.doesNotMatch(style, /\.ll-hand-card\.is-selected\s*\{[^}]*0 0 0 3px/);
    assert.doesNotMatch(style, /ll-target-breathe/);
    assert.doesNotMatch(style, /0 0 0 2px rgba\(217,\s*182,\s*111/);
});

test('情书手牌、目标与关键记录具备明确的可访问语义', () => {
    assert.match(render, /const accessibleLabel = `\$\{card\.value/);
    assert.match(render, /aria-label="\$\{esc\(accessibleLabel\)\}"/);
    assert.match(render, /const targetLabel = `选择\$\{player\.name/);
    assert.match(render, /historyTone\(entry, value\)/);
    assert.match(style, /\.ll-archive-list \.ll-history-entry\.is-critical/);
});

test('情书轮末中央只保留轮次与爱心归属两行信息', () => {
    assert.match(render, /function renderRoundResult\(round, winners\)/);
    assert.match(render, /renderChapterState\(`第 \$\{Number\(round\) \|\| 1\} 轮结束`/);
    assert.match(render, /stageHeading'\)\.hidden = initialState \|\| roundEnded/);
    assert.doesNotMatch(render, /第 \$\{state\.round\} 轮结果/);
    assert.match(render, /renderChapterState\(`第 \$\{Number\(round\) \|\| 1\} 轮开始`, '等待第一位信使'/);
    assert.match(style, /\.ll-chapter-state\s*\{[^}]*grid-template-rows:\s*auto auto auto/);
    assert.match(style, /\.ll-table-action\.ll-chapter-state\s*\{[^}]*grid-template-columns:\s*1fr;[^}]*grid-template-rows:\s*auto auto auto/);
    assert.match(style, /\.ll-chapter-state > i\s*\{[^}]*width:\s*34px;[^}]*height:\s*1px/);
});

test('情书轮末由全员分别准备，最后一人确认后自动开局', () => {
    assert.match(render, /const readyIds = state\.nextRoundReadyIds \|\| \[\]/);
    assert.match(render, /const hasConfirmed = readyIds\.includes\(state\.myId\)/);
    assert.match(render, /所有人准备后自动开始/);
    assert.match(render, /准备下一轮/);
    assert.match(render, /\$\{readyCount\}\/\$\{readyTotal\}/);
    assert.match(style, /\.ll-next-round-ready/);
    assert.doesNotMatch(render, /aria-label="您的终局牌"/);
    assert.match(render, /<strong class="ll-recent-card-label">.*?<\/strong><span>\$\{esc\(sentence\)\}<\/span>/);
});

test('情书目标玩家可主动立即确认，读条只负责超时托底', () => {
    assert.doesNotMatch(client, /acknowledgementReadyAt/);
    assert.doesNotMatch(render, /readyIn|!ready \? 'disabled'/);
    assert.match(render, /model\.pendingAction \? '正在确认' : '确认'/);
    assert.match(render, /data-action="acknowledge-action"[\s\S]*?model\.pendingAction \? 'disabled' : ''/);
});

test('情书右侧行动区只保留下一步所需信息', () => {
    assert.doesNotMatch(render, /出牌设置|选中后查看操作|轮到您时会自动摸牌/);
    assert.doesNotMatch(render, /ll-selected-action/);
    assert.match(render, /目标<\/span><b>/);
    assert.match(render, /猜测<\/span><b>/);
    assert.match(render, />打出手牌<\/button>/);
    assert.match(render, />等待出牌<\/button>/);
    assert.match(render, />选择手牌<\/button>/);
    assert.doesNotMatch(render, /当前玩家|等待\$\{esc\(target\)\}确认|<span>出牌<\/span>/);
});

test('情书中央说明固定为四行并统一结果分割线', () => {
    assert.match(render, /<span>\$\{card\.value/);
    assert.match(render, /<span>\$\{pending \? '等待确认'/);
    assert.match(render, /<small>\$\{esc\(detail\)\}<\/small><em>\$\{esc\(outcome\)\}<\/em>/);
    assert.match(style, /\.ll-action-detail > em\s*\{[^}]*border-top:/);
    assert.match(style, /grid-template-rows:\s*20px minmax\(30px, auto\) minmax\(34px, auto\) minmax\(26px, auto\)/);
});
