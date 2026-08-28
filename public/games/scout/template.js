export function createScoutTemplate() {
    return `
        <section class="scout-app">
            <header class="sc-header">
                <div class="sc-brand"><span class="sc-mark" aria-hidden="true"><i></i><b>星</b></span><div><small>巡回马戏团</small><h1>马戏星探</h1><p>节目顺序一旦排定，就不能悄悄换位</p></div></div>
                <div class="sc-round" data-role="round">等待开场</div>
                <div class="sc-actions"><button type="button" data-ui="rules">规则</button></div>
            </header>
            <div class="sc-error-banner is-hidden" data-role="errorBanner" role="alert" aria-live="assertive" tabindex="-1"></div>
            <main class="sc-layout">
                <section class="sc-stage">
                    <div class="sc-status" data-role="status"></div>
                    <section class="sc-show-board">
                        <div class="sc-show-heading"><div><span class="sc-kicker">中央舞台</span><h2>当前节目</h2></div><div class="sc-current-combo" data-role="activeCombo"></div></div>
                        <div class="sc-curtain-stage"><i class="sc-curtain is-left" aria-hidden="true"></i><i class="sc-curtain is-right" aria-hidden="true"></i><div class="sc-active" data-role="active"></div><div class="sc-footlights" aria-hidden="true"></div></div>
                    </section>
                    <section class="sc-hand-panel">
                        <div class="sc-hand-heading"><div><span class="sc-kicker">我的节目单</span><h2>顺序锁定的手牌</h2></div><div class="sc-hand-meta"><b data-role="handCount">0 张</b><span data-role="selectionHint">点击连续手牌组成节目</span></div></div>
                        <div class="sc-program-track"><span class="sc-track-start">开场</span><div class="sc-hand" data-role="hand"></div><span class="sc-track-end">谢幕</span></div>
                    </section>
                    <section class="sc-command" data-role="command"></section>
                </section>
                <aside class="sc-side">
                    <section class="sc-panel sc-scoreboard"><div class="sc-panel-heading"><div><span class="sc-kicker">马戏团席位</span><h2>本轮阵容</h2></div><span data-role="playerCount">—</span></div><div class="sc-players" data-role="players"></div></section>
                    <section class="sc-panel sc-log-panel"><div class="sc-panel-heading"><div><span class="sc-kicker">场边播报</span><h2>演出记录</h2></div><span data-role="logCount">0</span></div><div class="sc-log" data-role="log"></div></section>
                </aside>
            </main>
            <div class="sc-presentation-layer" data-role="presentationLayer" hidden aria-live="assertive">
                <div class="sc-presentation-shade"></div>
                <svg class="sc-action-line" data-role="actionLine" aria-hidden="true"><line x1="0" y1="0" x2="0" y2="0"></line><circle cx="0" cy="0" r="5"></circle></svg>
                <section class="sc-presentation-scene" data-role="presentationScene"></section>
                <button class="sc-presentation-skip" type="button" data-ui="skipPresentation">跳过演出</button>
            </div>
            <div class="sc-overlay is-hidden" data-role="rulesOverlay" aria-hidden="true"><article role="dialog" aria-modal="true" aria-labelledby="sc-rules-title" tabindex="-1"><button data-ui="closeRules" type="button" aria-label="关闭规则">×</button><span class="sc-kicker">玩法说明</span><h2 id="sc-rules-title">马戏星探规则</h2><ol><li>每轮开始选择整手牌的方向；锁定后不能翻面，也不能改变手牌顺序。</li><li>只能打出位置连续的牌。它们必须是同点数，或按手牌方向逐张相邻的顺子。</li><li>先比较张数；张数相同时，同点数组合高于顺子，再比较组合点数。</li><li>不演出时，可从当前节目的左端或右端招募一张，按所选方向插入任意位置。</li><li>3–5 人局每轮可使用一次“招募并演出”；2 人局改为每人 3 枚招募筹码。</li><li>演出获得的牌与招募标记计分，回合结束时手中剩牌扣分。</li></ol><figure class="sc-art-reference"><img src="/assets/bgg/scout/detail.jpg" alt="马戏星探实体组件参考图" loading="lazy"><figcaption>实体组件参考 · 线上牌面与节目顺序由实时状态绘制</figcaption></figure></article></div>
        </section>`;
}
