import { COLORS } from './constants.js';
import { publicCardMarkup } from './cards.js';

export function createHanabiTemplate() {
    return `<section class="hb-app">
        <header class="hb-header">
            <div class="hb-brand">
                <span class="hb-brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
                <div><small>看见彼此 · 点亮夜空</small><h1>花火</h1></div>
            </div>
            <div class="hb-turn" data-role="turn" aria-live="polite"><span class="hb-live-dot"></span>等待游戏状态</div>
            <div class="hb-header-score"><small>协作得分</small><strong data-role="headerScore">0</strong><span>/ 25</span></div>
            <div class="hb-header-actions">
                <button class="hb-icon-button" data-ui="rules" type="button" title="查看规则" aria-label="查看规则">?</button>

            </div>
        </header>

        <main class="hb-layout">
            <section class="hb-sky">
                <header class="hb-section-header">
                    <div><small>演出进度</small><h2>五色烟花</h2></div>
                    <div class="hb-score-copy"><strong data-role="score">0</strong><span>共同得分</span></div>
                </header>
                <div class="hb-fireworks" data-role="fireworks"></div>
                <div class="hb-resources" data-role="resources"></div>
            </section>

            <aside class="hb-command-panel" data-role="command"></aside>

            <section class="hb-teammates-section">
                <header class="hb-section-header">
                    <div><small>公开信息</small><h2>队友的牌</h2></div>
                    <span data-role="teammateHint">选择队友给予完整提示</span>
                </header>
                <div class="hb-teammates" data-role="teammates"></div>
            </section>

            <section class="hb-my-hand">
                <header class="hb-section-header">
                    <div><small>提示记忆</small><h2>我的牌背</h2></div>
                    <span data-role="handHint">只根据已知提示行动</span>
                </header>
                <div class="hb-hand" data-role="hand"></div>
                <div class="hb-hand-action-bar is-hidden" data-role="handActions"></div>
            </section>

            <aside class="hb-table-rail">
                <section class="hb-players-panel">
                    <header><small>顺时针行动</small><h2>行动顺序</h2></header>
                    <div class="hb-players" data-role="players"></div>
                </section>
                <section class="hb-discard-panel">
                    <header><div><small>牌库追踪</small><h2>弃牌统计</h2></div><span data-role="discardCount">0 张</span></header>
                    <div class="hb-discard" data-role="discard"></div>
                </section>
                <section class="hb-log-panel">
                    <header><small>行动回顾</small><h2>演出记录</h2></header>
                    <div class="hb-log" data-role="log"></div>
                </section>
            </aside>
        </main>

        <div class="hb-presentation-layer" data-role="presentationLayer" aria-hidden="true" hidden>
            <svg class="hb-action-lines" data-role="actionLines" aria-hidden="true">
                <defs>
                    <filter id="hbLineGlow"><feGaussianBlur stdDeviation="3" result="blur"></feGaussianBlur><feMerge><feMergeNode in="blur"></feMergeNode><feMergeNode in="SourceGraphic"></feMergeNode></feMerge></filter>
                    <marker id="hbLineArrow" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9 Z"></path></marker>
                </defs>
                <path data-role="actionPath"></path>
            </svg>
            <div class="hb-action-stage" data-role="actionStage" role="status" aria-live="assertive"></div>
            <button class="hb-presentation-skip" data-action="skipPresentation" type="button">跳过</button>
        </div>

        <div class="hb-overlay is-hidden" data-role="rules" role="presentation" aria-hidden="true">
            <article class="hb-rules" role="dialog" aria-modal="true" aria-labelledby="hbRulesTitle">
                <button class="hb-close-button" data-ui="closeRules" type="button" title="关闭规则" aria-label="关闭规则">×</button>
                <div class="hb-rules-art">
                    <div class="hb-rules-card-fan" aria-label="五色花火牌与隐藏牌背示例">
                        ${COLORS.map((color, index) => publicCardMarkup({ color, value: index + 1 }, { kind: 'rules' })).join('')}
                        <span class="hb-public-card hb-public-card-back hb-rules-card" aria-label="隐藏牌背"><i></i><b aria-hidden="true"></b></span>
                    </div>
                    <span>合作</span>
                </div>
                <div class="hb-rules-copy">
                    <small>基础规则</small>
                    <h2 id="hbRulesTitle">看得见彼此，看不见自己</h2>
                    <ol>
                        <li><b>共同目标</b><span>五种颜色分别按 1、2、3、4、5 的顺序完成，最终得分为五条烟花之和。</span></li>
                        <li><b>隐藏手牌</b><span>你只能看队友的牌；自己的牌面始终不可见，只能依据收到的提示推理。</span></li>
                        <li><b>完整提示</b><span>消耗一枚提示令牌，指出一名队友手中某种颜色或某个数字的全部牌，不能提示零张。</span></li>
                        <li><b>出牌与弃牌</b><span>正确出牌推进烟花；错误牌公开弃置并点燃一根引信。弃牌恢复一枚提示令牌。</span></li>
                        <li><b>演出结束</b><span>第三次失误立即失败；抽走牌库最后一张后，每名玩家各再行动一次。</span></li>
                    </ol>
                    <div class="hb-rules-tokens"><span><i class="is-clue"></i>8 枚提示</span><span><i class="is-fuse"></i>3 根引信</span><span><i class="is-score"></i>25 分完美演出</span></div>
                    <p>本桌实现五色基础版，不包含第六种多色牌、皇冠或其他扩展规则。</p>
                </div>
            </article>
        </div>
    </section>`;
}
