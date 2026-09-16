export function createWitchTownTemplate() {
    return `
        <section class="witchtown-app">
            <header class="witchtown-topbar">

                <div class="witchtown-brand">
                    <span class="witchtown-brand-mark" aria-hidden="true"><i></i><b></b></span>
                    <div><span class="witchtown-eyebrow">塞勒姆审判</span><h1>猎巫镇</h1><p>传言会死，证词会说谎</p></div>
                </div>
                <div class="witchtown-top-stats" aria-label="牌局信息">
                    <div class="witchtown-stat"><span>周期</span><strong data-role="cycle">—</strong></div>
                    <div class="witchtown-stat"><span>阶段</span><strong data-role="phase">—</strong></div>
                    <div class="witchtown-stat"><span>牌库</span><strong data-role="deck">—</strong></div>
                    <div class="witchtown-stat witchtown-stat-turn"><span>当前行动</span><strong data-role="current">—</strong></div>
                </div>
                <div class="witchtown-header-actions">
                    <span class="witchtown-room" data-role="room">猎巫镇</span>
                    <button class="witchtown-quiet-button" data-ui="rules" type="button">规则</button>
                </div>
            </header>

            <main class="witchtown-shell">
                <section class="witchtown-command" aria-live="polite">
                    <div class="witchtown-command-head">
                        <div><span class="witchtown-kicker" data-role="command-kicker">牌局状态</span><h2 data-role="command-title">等待牌局状态</h2><p data-role="command-copy">连接到房间后，当前阶段与可用行动会显示在这里。</p></div>
                        <span class="witchtown-status-badge" data-role="command-status">等待中</span>
                    </div>
                    <div class="witchtown-command-body" data-role="command-body"></div>
                    <div class="witchtown-command-footer"><span data-role="judge-footer"></span><span data-role="command-footer"></span></div>
                </section>

                <div class="witchtown-workspace">
                    <section class="witchtown-panel witchtown-table-panel">
                        <div class="witchtown-section-heading"><div><span class="witchtown-kicker">公开审判席</span><h2>镇民状态</h2></div><div class="witchtown-section-meta" data-role="table-summary">—</div></div>
                        <div class="witchtown-tribunal-line" aria-hidden="true"><span></span><i></i><span></span></div>
                        <div class="witchtown-player-grid" data-role="table"></div>
                    </section>

                    <aside class="witchtown-panel witchtown-private-panel">
                        <div class="witchtown-section-heading"><div><span class="witchtown-kicker">密封档案</span><h2>我的审判牌</h2></div><span class="witchtown-private-mark">本人私密</span></div>
                        <div data-role="private"></div>
                    </aside>

                    <aside class="witchtown-panel witchtown-role-panel social-role-focus">
                        <div class="witchtown-section-heading"><div><span class="witchtown-kicker">公开身份牌</span><h2>我的镇议会角色</h2></div><span class="witchtown-public-mark">全员可见</span></div>
                        <div data-role="public-role"></div>
                    </aside>

                    <section class="witchtown-panel witchtown-hand-panel">
                        <div class="witchtown-section-heading"><div><span class="witchtown-kicker">证词与行动牌</span><h2>我的手牌</h2></div><div class="witchtown-section-meta" data-role="hand-summary">—</div></div>
                        <div data-role="hand"></div>
                    </section>

                    <aside class="witchtown-panel witchtown-log-panel">
                        <div class="witchtown-section-heading"><div><span class="witchtown-kicker">审判记录</span><h2>事件记录</h2></div></div>
                        <div class="witchtown-log" data-role="log"></div>
                    </aside>
                </div>
            </main>

            <footer class="witchtown-footer"><span data-role="hint">等待牌局状态</span><span>房间 <b data-role="footer-room">—</b></span></footer>

            <div class="witchtown-overlay is-hidden" data-role="overlay" aria-hidden="true">
                <article class="witchtown-rules" role="dialog" aria-modal="true" aria-labelledby="witchtown-rules-title" tabindex="-1">
                    <button class="witchtown-modal-close" data-ui="closeRules" type="button" aria-label="关闭规则">×</button>
                    <span class="witchtown-kicker">玩法说明 · 塞勒姆审判</span>
                    <h2 id="witchtown-rules-title">猎巫镇标准版</h2>
                    <p class="witchtown-rules-lead">每位玩家拥有公开的镇议会角色牌和面朝下的审判牌。任何曾经持有女巫牌的人，始终属于女巫阵营。</p>
                    <div class="witchtown-rules-grid">
                        <section><b>01 · 核对档案</b><p>所有玩家先秘密查看并确认审判档案。阴谋交换后，所有存活玩家还要重新核对。</p></section>
                        <section><b>02 · 黎明</b><p>女巫阵营秘密选择黑猫持有者。黑猫持有者成为白天首位行动者。</p></section>
                        <section><b>03 · 白天</b><p>当前玩家摸两张牌结束回合，或至少打出一张牌后结束行动。讨论始终在线下自由进行。</p></section>
                        <section><b>04 · 指控</b><p>指控 1 点、证据 3 点、目击者 7 点。通常累计到 7 点时揭示一张审判牌，George Burroughs 需要 8 点。</p></section>
                        <section><b>05 · 三种颜色</b><p>红色牌累计指控；绿色牌结算后弃置；蓝色牌留在目标面前并持续生效。</p></section>
                        <section><b>06 · 阴谋</b><p>揭示黑猫持有者的一张牌后，所有存活玩家秘密交换审判牌；完成后重新核对整份档案。</p></section>
                        <section><b>07 · 夜幕</b><p>女巫、警长依次行动，随后每名存活玩家选择认罪或沉默；全部完成后自动天亮，无需主持人。</p></section>
                    </div>
                    <div class="witchtown-rules-win"><strong>胜利条件</strong><span>所有女巫审判牌揭示，镇民胜；所有存活者都曾持有女巫牌，女巫胜。</span></div>
                    <p class="witchtown-rules-note">本版本实现标准版 59 张塞勒姆牌和 15 张镇议会角色牌；豪华版特殊审判牌及 2–3 人变体暂不启用。</p>
                </article>
            </div>
            <div class="witchtown-scene is-hidden" data-role="scene" aria-hidden="true">
                <div class="witchtown-scene-wash" aria-hidden="true"></div>
                <div class="witchtown-scene-fragments" aria-hidden="true">${Array.from({ length: 18 }, (_, index) => `<i style="--fragment-x:${12 + index * 4.25}%;--fragment-y:${40 + (index - 9) * 1.35}%;--fragment-delay:${index * 12}ms;--fragment-width:${5 + index * .5}px;--fragment-height:${3 + index * .28}px;--wind-x:${20 + index * .5}vw;--wind-y:${-45 + index * 5}px;--wind-spin:${80 + index * 19}deg;--shard-width:${30 + index * 4}px;--shard-height:${70 + index * 5}px;--shard-x:${(index - 9) * 22}px;--shard-y:${240 + index * 5}px;--shard-spin:${index * 31}deg"></i>`).join('')}</div>
                <div class="witchtown-scene-copy">
                    <span data-role="scene-kicker"></span>
                    <h2 data-role="scene-title"></h2>
                    <p data-role="scene-detail"></p>
                    <button class="witchtown-scene-continue" data-ui="sceneContinue" type="button">查看后续审判</button>
                </div>
            </div>
        </section>`;
}
