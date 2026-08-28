import { CARD_RULES } from './constants.js';
import { renderCardBack } from './cards.js';

export function createLoveLetterTemplate() {
    return `<section class="ll-app" aria-label="情书游戏">
        <header class="ll-statusbar">
            <div class="ll-turn-status"><span class="ll-turn-dot" aria-hidden="true"></span><div><small data-role="phase">等待开局</small><strong data-role="turn">等待游戏状态</strong></div></div>
            <dl class="ll-round-stats">
                <div><dt>轮次</dt><dd data-role="round">-</dd></div>
                <div><dt>牌库</dt><dd><b data-role="deck">-</b> 张</dd></div>
                <div data-role="asideStat"><dt>二人局移出</dt><dd data-role="aside">-</dd></div>
            </dl>
            <button class="ll-icon-button" data-action="rules" type="button" aria-label="查看规则" title="查看规则">?</button>
        </header>

        <section class="ll-opponents" data-role="seats" aria-label="其他玩家"></section>

        <main class="ll-table">
            <div class="ll-table-core">
                <div class="ll-pile" aria-label="牌库">${renderCardBack('情书', '', '牌库卡背')}<strong><b data-role="deckLarge">-</b> 张</strong><small>牌库</small></div>
                <section class="ll-latest" data-role="event" aria-live="polite"><div><span>最近行动</span><strong>等待第一封信</strong><small>公开行动会显示在这里</small></div></section>
                <div class="ll-pile is-reserved" aria-label="密封预留牌">${renderCardBack('密封', '', '预留牌卡背')}<strong><b data-role="reserved">-</b> 张</strong><small>预留牌</small></div>
            </div>
            <section class="ll-discard-zone" aria-label="公开弃牌">
                <header><div><strong>公开弃牌</strong><span data-role="discardCount">0 张</span></div><small>按玩家分组，公开点数计入牌库耗尽时的平局判定</small></header>
                <div class="ll-discard-list" data-role="discards"><span class="ll-empty">还没有公开弃牌</span></div>
            </section>
        </main>

        <section class="ll-player-dock" data-role="command" aria-label="你的手牌与行动"></section>

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
                <p>轮到你时，从两张手牌中打出一张，并执行角色效果。每轮胜者获得一枚爱心筹码。</p>
                <div class="ll-rule-list">${CARD_RULES.map(rule => `<article><b>${rule.value}</b><div><strong>${rule.name}<small>x${rule.count}</small></strong><span>${rule.effect}</span></div></article>`).join('')}</div>
            </div>
        </div>

        <div class="ll-overlay is-hidden" data-role="guessOverlay" role="presentation" aria-hidden="true">
            <div class="ll-dialog ll-guess-dialog" role="dialog" aria-modal="true" aria-labelledby="ll-guess-title">
                <button class="ll-dialog-close" data-action="close-guess" type="button" aria-label="关闭猜牌">x</button>
                <span class="ll-dialog-label">侍卫 · 1 点</span><h2 id="ll-guess-title">选择要猜的角色</h2>
                <p data-role="guessPrompt">不能猜侍卫。选好牌面后，再选择一名对手作为目标。</p>
                <div class="ll-guess-options" data-role="guessCards"></div>
                <button class="ll-primary ll-guess-confirm" data-action="confirm-guess" type="button" disabled>确认猜测牌面</button>
            </div>
        </div>
    </section>`;
}
