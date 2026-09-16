import { CARD_RULES } from './constants.js';
import { renderCardBack } from './cards.js';

export function createLoveLetterTemplate() {
    return `<section class="ll-app" aria-label="情书游戏">
        <header class="ll-statusbar">
            <div class="ll-status-signature" aria-hidden="true"><span>LOVE LETTER</span><i></i><small>宫廷密函</small></div>
            <dl class="ll-round-stats">
                <div><dt>轮次</dt><dd data-role="round">-</dd></div>
                <div data-role="asideStat"><dt>二人局移出</dt><dd data-role="aside">-</dd></div>
            </dl>
            <button class="ll-icon-button" data-action="rules" type="button" aria-label="查看规则" title="查看规则">?</button>
        </header>

        <section class="ll-opponents" data-role="seats" aria-label="其他玩家"></section>

        <main class="ll-table">
            <header class="ll-stage-heading" data-role="stageHeading" hidden>
                <span data-role="stageKicker">本轮动态</span>
                <strong data-role="stageTitle">等待首次出牌</strong>
                <small data-role="stageHint">这里会显示最近打出的牌和行动结果</small>
            </header>

            <div class="ll-stage-layout">
                <section class="ll-play-field" aria-label="牌库与最近出牌">
                    <aside class="ll-letter-piles" aria-label="牌堆与备用牌">
                        <div class="ll-pile ll-pile-deck" aria-label="牌堆">${renderCardBack('牌堆', '', '剩余牌库')}<span class="ll-pile-meta"><small>剩余牌</small><strong><b data-role="deckLarge">-</b> 张</strong></span></div>
                        <div class="ll-pile ll-pile-reserved is-reserved" aria-label="备用牌">${renderCardBack('备用', '', '王子效果使用的备用牌')}<span class="ll-pile-meta"><small>备用牌</small><strong><b data-role="reserved">-</b> 张</strong></span></div>
                    </aside>

                    <section class="ll-latest is-action-stage is-initial-stage" data-role="event" aria-live="polite">
                        <div class="ll-table-action ll-initial-action"><strong class="ll-initial-copy">等待首位玩家出牌</strong></div>
                    </section>
                </section>

                <aside class="ll-court-record" aria-label="出牌记录">
                    <button class="ll-record-header" data-action="open-archive" data-archive="all" type="button" aria-label="打开历史记录"><strong>历史记录</strong><i aria-hidden="true"></i></button>
                    <button class="ll-record-removed" data-role="publicRemovedPile" data-action="open-archive" data-archive="removed" type="button" hidden><strong>2人局公共弃牌</strong></button>
                    <div class="ll-recent-actions" data-role="recentActions" aria-label="最近两次行动"><span class="ll-empty">暂无行动</span></div>
                </aside>

            </div>
        </main>

        <section class="ll-player-dock" data-role="command" aria-label="您的手牌与行动"></section>

        <svg class="ll-action-link" data-role="actionLink" aria-hidden="true">
            <path class="ll-action-link-glow" data-role="actionLinkGlow"></path>
            <path class="ll-action-link-stroke" data-role="actionLinkStroke"></path>
            <circle class="ll-action-link-seal" data-role="actionLinkSeal" r="7"></circle>
        </svg>

        <div class="ll-scene-layer" data-role="sceneLayer" aria-hidden="true" hidden>
            <div class="ll-scene" data-role="scene" role="status" aria-live="assertive"></div>
            <button class="ll-scene-skip" data-action="skip-scene" type="button">跳过</button>
        </div>

        <div class="ll-overlay is-hidden" data-role="rulesOverlay" role="presentation" aria-hidden="true">
            <div class="ll-dialog" role="dialog" aria-modal="true" aria-labelledby="ll-rules-title">
                <button class="ll-dialog-close" data-action="close-rules" type="button" aria-label="关闭规则">x</button>
                <span class="ll-dialog-label">经典 16 张基础版</span><h2 id="ll-rules-title">情书规则</h2>
                <p>轮到您时，从两张手牌中打出一张并执行效果。每轮胜者获得一枚爱心。</p>
                <div class="ll-rule-list">${CARD_RULES.map(rule => `<article><b>${rule.value}</b><div><strong>${rule.name}<small>x${rule.count}</small></strong><span>${rule.effect}</span></div></article>`).join('')}</div>
            </div>
        </div>

        <div class="ll-overlay is-hidden" data-role="archiveOverlay" role="presentation" aria-hidden="true">
            <div class="ll-dialog ll-archive-dialog" role="dialog" aria-modal="true" aria-labelledby="ll-archive-title">
                <button class="ll-dialog-close" data-action="close-archive" type="button" aria-label="关闭记录">x</button>
                <span class="ll-dialog-label" data-role="archiveLabel">本轮行动 · 最新在前</span><h2 id="ll-archive-title" data-role="archiveTitle">历史记录</h2>
                <div class="ll-archive-list" data-role="archiveList"></div>
            </div>
        </div>

        <div class="ll-overlay ll-final-overlay is-hidden" data-role="finalOverlay" role="presentation" aria-hidden="true">
            <div class="ll-dialog ll-final-dialog" role="dialog" aria-modal="true" aria-labelledby="ll-final-title" data-role="finalContent"></div>
        </div>

        <div class="ll-overlay is-hidden" data-role="guessOverlay" role="presentation" aria-hidden="true">
            <div class="ll-dialog ll-guess-dialog" role="dialog" aria-modal="true" aria-labelledby="ll-guess-title">
                <button class="ll-dialog-close" data-action="close-guess" type="button" aria-label="关闭猜牌">x</button>
                <span class="ll-dialog-label">侍卫 · 1 点</span><h2 id="ll-guess-title">猜一个角色</h2>
                <p data-role="guessPrompt">不能选择侍卫。</p>
                <div class="ll-guess-options" data-role="guessCards"></div>
                <button class="ll-primary ll-guess-confirm" data-action="confirm-guess" type="button" disabled>确认并继续</button>
            </div>
        </div>
    </section>`;
}
