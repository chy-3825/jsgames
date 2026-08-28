import { eliminationFragments } from './constants.js';

export function createWerewolfTemplate() {
    return `
        <section class="ww-app">
            <header class="ww-header">
                <div class="ww-brand"><span>狼</span><div><small data-role="boardSize">9 / 12 人 · 无主持人模式</small><h1>狼人杀 · 夜幕助手</h1></div></div>
                <div class="ww-phase" data-role="phase">等待开始</div>
                <div class="ww-header-actions"><button data-ui="voice" type="button" aria-pressed="false">语音：关</button><button data-ui="bulletins" type="button">公示栏</button><button data-ui="rules" type="button">本局规则</button></div>
            </header>
            <main class="ww-layout">
                <aside class="ww-seat-panel">
                    <div class="ww-section-title"><span data-role="seatTitle">玩家席位</span><small data-role="mode"></small></div>
                    <p class="ww-debug-hint" data-role="seatHint">你的号码会被点亮；身份与夜间行动只会出现在你的界面。</p>
                    <div class="ww-seats" data-role="seats"></div>
                    <div class="ww-seat-tools is-hidden" data-role="seatTools"><button class="is-hidden" data-ui="confirmAllRoles" type="button">测试：确认全部身份</button><small data-role="testHelp">单人座位测试模式可一次确认全部座位</small></div>
                </aside>
                <section class="ww-screen">
                    <div class="ww-screen-bar"><span><i></i> <b data-role="screenMode">你的秘密界面</b></span><strong data-role="screen-seat">等待入座</strong></div>
                    <section class="ww-flow" aria-live="polite">
                        <div class="ww-flow-stage is-current"><small>此刻</small><strong data-role="currentPhase">静候开局</strong></div>
                        <span class="ww-flow-arrow">→</span>
                        <div class="ww-flow-stage"><small>接下来</small><strong data-role="nextPhase">序幕将启</strong></div>
                        <div class="ww-flow-progress"><div><span data-role="phaseProgress">等待玩家</span><b data-role="phaseProgressCount">0/0</b></div><div class="ww-flow-track"><i data-role="phaseProgressBar"></i></div><p data-role="phaseInstruction"></p></div>
                    </section>
                    <section class="ww-announcement is-hidden" data-role="announcement" aria-live="polite"></section>
                    <div class="ww-screen-body">
                        <section class="ww-main"><div class="ww-role social-role-focus" data-role="role"></div><div class="ww-action" data-role="action"></div></section>
                        <aside class="ww-screen-side">
                            <section class="ww-public-card"><div class="ww-section-title"><span>在场玩家</span><small>全场可见</small></div><div class="ww-public-seats" data-role="publicSeats"></div></section>
                            <section class="ww-public-card ww-sheriff-state" data-role="sheriffState"></section>
                            <section class="ww-public-card ww-vote-result" data-role="voteResult" tabindex="-1"></section>
                            <section class="ww-public-card"><div class="ww-section-title"><span>游戏纪事</span><small>本局足迹</small></div><div class="ww-log" data-role="log"></div></section>
                            <section class="ww-auto-note"><strong>无需主持人</strong><p>每个人完成自己的行动后，游戏会自然继续；夜间结果与放逐票型将在合适的时刻公布。</p></section>
                        </aside>
                    </div>
                    <div class="ww-target-overlay is-hidden" data-role="targetModal"><article class="ww-target-dialog" role="dialog" aria-modal="true" aria-labelledby="wwTargetTitle"><button class="ww-target-close" data-ui="closeTarget" type="button" aria-label="取消选择">×</button><small data-role="targetKicker">选择对象</small><h2 id="wwTargetTitle" data-role="targetTitle">选择目标</h2><p data-role="targetDescription"></p><div class="ww-target-grid" data-role="targetGrid"></div><div class="ww-target-selection" data-role="targetSelection">还没有选择</div><div class="ww-target-actions"><button data-ui="cancelTarget" type="button">取消</button><button class="ww-target-confirm" data-ui="confirmTarget" type="button" disabled>确定选择</button></div></article></div>
                </section>
            </main>
            <div class="ww-transition is-hidden" data-role="transition" role="status" aria-live="assertive" aria-atomic="true" aria-hidden="true"><div class="ww-transition-surface"><div class="ww-transition-title" data-role="transitionTitle"></div><div class="ww-transition-result" data-role="transitionResult"></div></div></div>
            <div class="ww-elimination is-hidden" data-role="elimination" role="status" aria-live="assertive" aria-atomic="true" aria-hidden="true"><div class="ww-elimination-plate"><strong>您已出局</strong></div><div class="ww-elimination-fragments" aria-hidden="true">${eliminationFragments()}</div></div>
            <div class="ww-overlay is-hidden" data-role="rules"><article><button data-ui="closeRules" type="button">×</button><small>本局约定</small><h2>开始前请知晓</h2><ol><li>9 人局为 3 狼、4 神、2 民；12 人局为 4 狼、4 神、4 民。四名神职为预言家、女巫、猎人和守卫。</li><li>所有玩家都记下自己的身份后，第一夜才会降临。</li><li>身份默认隐藏；按住身份区域可以查看，松开后会立即遮住。</li><li>好人采用屠边胜利条件：所有平民或所有神职出局后狼人获胜；狼人全部出局则好人获胜。</li><li>首日依次进行上警报名、警上发言、退水和警长投票；首轮平票进行一次 PK，第二轮仍平票则本局没有警长。</li><li>警长在白天放逐投票中拥有 1.5 票；出局时可以移交或撕毁警徽。</li><li>狼人袭击和白天放逐若首轮平票，都会再投一轮；第二轮只能投给首轮平票目标。</li><li>夜间行动、白天发言与放逐投票会在相关玩家全部完成后继续，无需额外主持人。</li><li>出局玩家会在自己的界面完成离场行动；猎人可以选择开枪或放弃。</li></ol></article></div>
        </section>`;
}
