import { CARD_BACK_ART, ROLE_ART, ROLE_EFFECTS, ROLE_MARKS, ROLE_NAMES, ROLE_NOTES } from './constants.js';

export function createCoupTemplate() {
    return `<section class="cp-app" aria-label="政变游戏">
        <header class="cp-statusbar">
            <div class="cp-brand"><span class="cp-brand-seal" aria-hidden="true">政</span><div><small>虚张声势 · 质疑 · 夺权</small><h1>政变</h1></div></div>
            <dl class="cp-public-stats"><div><dt>存活</dt><dd><b data-role="alive">0</b> 人</dd></div><div><dt>阶段</dt><dd data-role="phaseShort">等待</dd></div></dl>
            <button class="cp-icon-button" data-action="roles" type="button" aria-label="查看角色与能力" title="角色与能力">?</button>
        </header>

        <section class="cp-council" aria-label="其他玩家">
            <div class="cp-council-heading"><strong>玩家席位</strong><span>金币与已揭示影响力公开</span></div>
            <div class="cp-players" data-role="players"></div>
        </section>

        <main class="cp-table">
            <div class="cp-table-inner">
                <div class="cp-stage-column">
                <section class="cp-stage" aria-label="当前行动">
                    <div class="cp-stage-core">
                        <aside class="cp-supply" aria-label="影响力牌库与国库">
                            <div class="cp-court-deck" aria-label="影响力牌库"><span class="cp-deck-stack"><span class="cp-card-back-art" role="img" aria-label="影响力牌背"><img src="/assets/bgg/coup/${CARD_BACK_ART}.jpg" alt=""></span></span><strong>牌库</strong></div>
                            <div class="cp-treasury" data-role="treasury" aria-label="国库"><span><i></i><i></i><i></i></span><strong>国库</strong></div>
                        </aside>
                        <section class="cp-event" data-role="event" aria-live="polite"><div class="cp-event-sigil">政</div><div class="cp-event-copy"><span>当前行动</span><strong>等待第一项行动</strong><p>选择收入、角色行动或政变。</p></div></section>
                    </div>
                </section>
                <section class="cp-challenge" data-role="challenge" aria-label="声明回应" aria-live="assertive"></section>
                </div>

                <aside class="cp-intel" aria-label="最近行动记录">
                    <button class="cp-intel-header" data-action="open-history" type="button" aria-label="打开行动记录"><div><strong>行动记录</strong><span>最近行动</span></div><i aria-hidden="true"></i></button>
                    <div class="cp-timeline" data-role="timeline"></div>
                </aside>
            </div>
        </main>

        <section class="cp-command" data-role="command" aria-label="你的影响力与行动"></section>

        <svg class="cp-action-links" data-role="actionLinks" aria-hidden="true">
            <path class="cp-link-glow is-action" data-role="actionLinkGlow"></path>
            <path class="cp-link-stroke is-action" data-role="actionLinkStroke"></path>
            <circle class="cp-link-seal is-action" data-role="actionLinkSeal" r="7"></circle>
            <path class="cp-link-glow is-response" data-role="responseLinkGlow"></path>
            <path class="cp-link-stroke is-response" data-role="responseLinkStroke"></path>
            <circle class="cp-link-seal is-response" data-role="responseLinkSeal" r="6"></circle>
        </svg>

        <div class="cp-scene-layer" data-role="sceneLayer" aria-hidden="true" hidden>
            <div class="cp-scene" data-role="scene" role="status" aria-live="assertive"></div>
            <button class="cp-scene-skip" data-action="skip-scene" type="button">跳过</button>
        </div>

        <div class="cp-overlay is-hidden" data-role="rolesOverlay" aria-hidden="true">
            <div class="cp-dialog cp-roles-dialog" role="dialog" aria-modal="true" aria-labelledby="cp-roles-title">
                <button class="cp-dialog-close" data-action="close-roles" type="button" aria-label="关闭角色与能力">x</button>
                <span class="cp-dialog-label">基础版 · 五种角色</span>
                <h2 id="cp-roles-title">角色与能力</h2>
                <div class="cp-role-grid">${Object.keys(ROLE_ART).map(role => `<article class="cp-role-entry is-role-${role}"><img src="/assets/bgg/coup/${ROLE_ART[role]}.jpg" alt="${ROLE_NAMES[role]}牌面"><div><header><i>${ROLE_MARKS[role]}</i><strong>${ROLE_NAMES[role]}</strong></header><p>${ROLE_EFFECTS[role]}</p><small>${ROLE_NOTES[role]}</small></div></article>`).join('')}</div>
            </div>
        </div>

        <div class="cp-overlay is-hidden" data-role="historyOverlay" aria-hidden="true">
            <div class="cp-dialog cp-history-dialog" role="dialog" aria-modal="true" aria-labelledby="cp-history-title">
                <button class="cp-dialog-close" data-action="close-history" type="button" aria-label="关闭行动记录">x</button>
                <span class="cp-dialog-label">公开记录</span>
                <h2 id="cp-history-title">行动记录</h2>
                <div class="cp-history-list" data-role="historyList"></div>
            </div>
        </div>

        <div class="cp-overlay is-hidden" data-role="roleDetailOverlay" aria-hidden="true">
            <div class="cp-dialog cp-role-detail-dialog" data-role="roleDetailDialog" role="dialog" aria-modal="true" aria-labelledby="cp-role-detail-title"></div>
        </div>

        <div class="cp-overlay is-hidden" data-role="exchangeOverlay" aria-hidden="true">
            <div class="cp-dialog cp-exchange-dialog" data-role="exchangeDialog" role="dialog" aria-modal="true" aria-labelledby="cp-exchange-title"></div>
        </div>

        <div class="cp-overlay cp-end-overlay is-hidden" data-role="endOverlay" aria-hidden="true">
            <div class="cp-dialog cp-end-dialog" data-role="endDialog" role="dialog" aria-modal="true" aria-labelledby="cp-end-title"></div>
        </div>
    </section>`;
}
