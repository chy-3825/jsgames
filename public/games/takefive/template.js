import { cardMarkup } from './cards.js';

/**
 * Static shell for the 牛头王 table.
 *
 * Keeping the shell separate means the client entry only coordinates the
 * lifecycle and message protocol; all dynamic content still belongs to the
 * renderer.  The data-role/data-ui contract is intentionally unchanged.
 */
export function createTakeFiveTemplate() {
    return `<section class="takefive-app">
        <header class="tf-header">
            <div class="tf-brand">
                <span class="tf-brand-mark" aria-hidden="true"><i></i><b>6</b></span>
                <div><small>同时出牌 · 避开第六张</small><h1>牛头王</h1></div>
            </div>
            <div class="tf-turn" data-role="turn" aria-live="polite"><span class="tf-live-dot"></span>等待游戏状态</div>
            <div class="tf-header-round">
                <small>本手进度</small>
                <strong data-role="round">第 — 手 · — / 10</strong>
            </div>
            <div class="tf-header-actions">
                <button class="tf-icon-button" data-ui="rules" type="button" title="查看游戏规则" aria-label="查看游戏规则">?</button>

            </div>
        </header>

        <main class="tf-layout">
            <aside class="tf-players-panel">
                <header><div><small>低分领先</small><h2>玩家记分</h2></div><span data-role="playerMeta">0 人</span></header>
                <div class="tf-players" data-role="players"></div>
            </aside>

            <section class="tf-board">
                <header class="tf-board-header">
                    <div><small>四列牌阵</small><h2>中央牌列</h2></div>
                    <div class="tf-round-progress" data-role="roundProgress" aria-label="本手进度"></div>
                </header>
                <section class="tf-public-stage" data-role="publicStage" aria-live="polite"></section>
                <section class="tf-draft is-hidden" data-role="draft"></section>
                <div class="tf-rows" data-role="rows"></div>
                <div class="tf-resolution" data-role="resolution" aria-live="polite"></div>
            </section>

            <aside class="tf-table-rail">
                <section class="tf-reveal-panel">
                    <header><div><small>同时公开</small><h2>本轮翻牌</h2></div><span data-role="revealMeta">等待中</span></header>
                    <div class="tf-revealed" data-role="revealed"></div>
                </section>
                <section class="tf-log-panel">
                    <header><div><small>行动回顾</small><h2>牌桌记录</h2></div></header>
                    <div class="tf-log" data-role="log"></div>
                </section>
                <section class="tf-target-panel">
                    <span class="tf-target-ornament" aria-hidden="true"><i></i></span>
                    <div><small>终局线</small><strong data-role="targetScore">66</strong><span>牛头</span></div>
                </section>
            </aside>

            <section class="tf-hand-panel">
                <header class="tf-hand-header">
                    <div><small>私人手牌</small><h2>我的手牌</h2></div>
                    <div class="tf-hand-stats"><span data-role="handHint">等待发牌</span><b data-role="pileScore">0 牛头</b></div>
                </header>
                <div class="tf-cards" data-role="hand"></div>
                <div class="tf-hand-confirm" data-role="handConfirm"></div>
            </section>
        </main>

        <div class="tf-overlay is-hidden" data-role="rules" role="presentation" aria-hidden="true">
            <article class="tf-rules" role="dialog" aria-modal="true" aria-labelledby="tfRulesTitle">
                <button class="tf-close-button" data-ui="closeRules" type="button" title="关闭规则" aria-label="关闭规则">×</button>
                <div class="tf-rules-art">
                    <div class="tf-rules-card-fan" aria-label="不同牛头分值的数字牌示例">
                        ${cardMarkup({ value: 17, bullheads: 1 }, { kind: 'rules' })}
                        ${cardMarkup({ value: 55, bullheads: 7 }, { kind: 'rules' })}
                        ${cardMarkup({ value: 30, bullheads: 3 }, { kind: 'rules' })}
                    </div>
                    <span>1—104</span>
                </div>
                <div class="tf-rules-copy">
                    <small>规则速览</small>
                    <h2 id="tfRulesTitle">别成为第六张牌</h2>
                    <ol>
                        <li><b>同时锁牌</b><span>每轮每人暗中选择一张；所有人锁定后才一起公开。</span></li>
                        <li><b>从小到大</b><span>公开牌按数字升序处理，接到小于它且数值最接近的行尾。</span></li>
                        <li><b>第六张收行</b><span>牌成为一行第六张时，出牌者收走前五张并承受其牛头。</span></li>
                        <li><b>低牌自选</b><span>若牌小于全部行尾，出牌者选择一行收走，再以该牌重开。</span></li>
                    </ol>
                    <div class="tf-score-key"><span><i class="key-1"></i>普通牌 1</span><span><i class="key-2"></i>5 的倍数 2</span><span><i class="key-3"></i>10 的倍数 3</span><span><i class="key-5"></i>11 的倍数 5</span><span><i class="key-7"></i>55 为 7</span></div>
                    <p>每手十轮后统一计分；整手结束时如有人累计达到 <b>66</b> 牛头，累计分最低者获胜。专业变体限 2–6 人，先从公开牌池轮流选满十张。</p>
                </div>
            </article>
        </div>
        <svg class="tf-action-links" data-role="actionLinks" aria-hidden="true">
            <path class="tf-action-link-glow" data-role="actionLinkGlow"></path>
            <path class="tf-action-link-stroke" data-role="actionLinkStroke"></path>
            <circle class="tf-action-link-seal" data-role="actionLinkSeal" r="7"></circle>
        </svg>
        <div class="tf-settlement-layer" data-role="settlementLayer" aria-hidden="true" hidden>
            <section class="tf-settlement-scene" data-role="settlementScene" role="status" aria-live="assertive"></section>
            <button class="tf-settlement-skip" data-ui="skipSettlement" type="button">继续</button>
        </div>
    </section>`;
}
