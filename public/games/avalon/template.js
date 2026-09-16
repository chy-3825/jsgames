export function createAvalonTemplate() {
    return `
        <section class="avalon-app">
            <header class="av-header">
                <div class="av-brand"><span class="av-mark" aria-hidden="true"><i></i><b></b></span><div><small>亚瑟王的圆桌</small><h1>阿瓦隆</h1></div></div>
                <div class="av-round" data-role="round">等待开局</div>
                <div class="av-actions"><button type="button" data-ui="rules">圆桌法典</button></div>
            </header>
            <main class="av-layout">
                <section class="av-main-stage av-private-action">
                    <aside class="av-role-column"><section class="av-role social-role-focus" data-role="role"></section></aside>
                    <section class="av-play-column">
                        <section class="av-progress-panel av-mission-board">
                            <div class="av-board-heading"><div><span class="av-kicker">王国远征</span><h2>五项任务</h2></div><div class="av-score-seals"><span><i></i><b data-role="goodScore">0</b>成功</span><span><i></i><b data-role="evilScore">0</b>失败</span></div></div>
                            <div class="av-mission-road" data-role="missionRoad"></div>
                            <div class="av-reject-track" data-role="rejectTrack"></div>
                        </section>
                        <section class="av-action-panel">
                            <section class="av-decision" data-role="decision"></section>
                        </section>
                    </section>
                </section>
                <details class="av-records">
                    <summary><span><b>圆桌记录</b><small>表决、战报与纪事</small></span><i><span data-role="playerCount">—</span><em data-role="logCount">0</em></i></summary>
                    <div class="av-records-grid">
                        <section class="av-record-block av-roster-record"><div class="av-section-title"><span>圆桌席位</span></div><div class="av-players" data-role="players"></div></section>
                        <section class="av-record-block av-vote-ledger"><div class="av-section-title"><span>上轮表决</span></div><div data-role="voteLedger"></div></section>
                        <section class="av-record-block av-history"><div class="av-section-title"><span>远征战报</span><small data-role="score"></small></div><div class="av-history-list" data-role="history"></div></section>
                        <section class="av-record-block av-log-panel"><div class="av-section-title"><span>圆桌纪事</span></div><div class="av-log" data-role="log"></div></section>
                    </div>
                </details>
            </main>
            <div class="av-scene-transition is-hidden" data-role="sceneTransition" role="status" aria-live="assertive" aria-atomic="true" aria-hidden="true"><div><small data-role="sceneKicker"></small><strong data-role="sceneTitle"></strong><span data-role="sceneDetail"></span></div></div>
            <div class="av-overlay is-hidden" data-role="rulesOverlay" aria-hidden="true"><article role="dialog" aria-modal="true" aria-labelledby="av-rules-title" tabindex="-1"><button data-ui="closeRules" type="button" aria-label="关闭规则">×</button><span class="av-kicker">玩法说明</span><h2 id="av-rules-title">阿瓦隆规则</h2><ol><li>每个人按住身份牌查看私密身份和线索，所有人确认后圆桌才会开启。</li><li>讨论完全在线下自由进行，不限发言顺序和时间；页面只负责秘密信息与规则判断。</li><li>队长在讨论中提议一支任务队伍，名单公布后所有人秘密投票。</li><li>队伍通过后，队员秘密投入成功或失败；善良阵营只能选择成功。</li><li>7 人及以上时，第四项任务需要两张失败牌才会失败。</li><li>三项任务成功后，刺客可以刺杀梅林。</li><li>三项任务失败，或连续五次组队被拒绝，邪恶获胜。</li></ol><figure class="av-art-reference"><img src="/assets/bgg/avalon/detail.jpg" alt="阿瓦隆身份牌、任务板和标记组件参考图" loading="lazy"><figcaption>实体组件参考</figcaption></figure></article></div>
        </section>`;
}
