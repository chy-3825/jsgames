import { cardBackMarkup, noblePortraitMarkup } from './cards.js';

export function createSplendorTemplate() {
    return `<section class="sp-app">
        <header class="sp-header">
            <div class="sp-brand">
                <span class="sp-brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
                <div><small>文艺复兴宝石商会</small><h1>璀璨宝石</h1></div>
            </div>
            <div class="sp-turn" data-role="turn" aria-live="polite"><span class="sp-live-dot"></span>等待游戏状态</div>
            <div class="sp-header-score"><small>声望</small><strong data-role="headerPoints">0</strong><span>/ 15</span></div>
            <div class="sp-header-actions"><button class="sp-icon-button" data-ui="rules" type="button" title="查看游戏规则" aria-label="查看游戏规则">?</button></div>
        </header>
        <main class="sp-layout">
            <section class="sp-market-stage">
                <header class="sp-section-header"><div><small>公开牌列</small><h2>发展卡市场</h2></div><span data-role="marketHint">三级公开市场</span></header>
                <div class="sp-market" data-role="market"></div>
            </section>
            <aside class="sp-command-column">
                <section class="sp-command-panel" data-role="command"></section>
                <section class="sp-nobles-panel"><header><div><small>来访席位</small><h2>贵族来访</h2></div><span data-role="nobleCount">0 位</span></header><div class="sp-nobles" data-role="nobles"></div></section>
            </aside>
            <section class="sp-guild" data-role="guild">
                <header class="sp-section-header"><div><small>个人资产</small><h2>我的宝石商会</h2></div><span data-role="guildSummary">0 分 · 0 张发展卡</span></header>
                <div class="sp-guild-grid"><section class="sp-guild-assets"><div class="sp-subheading"><strong>永久折扣</strong><small>发展卡奖励</small></div><div class="sp-discounts" data-role="discounts"></div><div class="sp-subheading sp-wallet-heading"><strong>持有筹码</strong><small data-role="walletTotal">0 / 10</small></div><div class="sp-wallet" data-role="wallet"></div></section><section class="sp-reserved-zone"><div class="sp-subheading"><strong>私密预留</strong><small data-role="reserveCount">0 / 3</small></div><div class="sp-reserved" data-role="reserved"></div></section></div>
            </section>
            <aside class="sp-table-rail"><section class="sp-players-panel"><header><small>商会排名</small><h2>商会席位</h2></header><div class="sp-players" data-role="players"></div></section><section class="sp-log-panel"><header><small>本桌记录</small><h2>交易记录</h2></header><div class="sp-log" data-role="log"></div></section></aside>
        </main>
        <div class="sp-presentation-layer" data-role="presentationLayer" aria-hidden="true" hidden><svg class="sp-action-lines" data-role="actionLines" aria-hidden="true"><defs><filter id="spLineGlow"><feGaussianBlur stdDeviation="3" result="blur"></feGaussianBlur><feMerge><feMergeNode in="blur"></feMergeNode><feMergeNode in="SourceGraphic"></feMergeNode></feMerge></filter><marker id="spLineArrow" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9 Z"></path></marker></defs><path data-role="actionPath"></path></svg><div class="sp-transaction-stage" data-role="transactionStage" role="status" aria-live="assertive"></div><button class="sp-presentation-skip" data-action="skipPresentation" type="button">跳过</button></div>
        <div class="sp-overlay is-hidden" data-role="rules" role="presentation" aria-hidden="true"><article class="sp-rules" role="dialog" aria-modal="true" aria-labelledby="spRulesTitle"><button class="sp-close-button" data-ui="closeRules" type="button" title="关闭规则" aria-label="关闭规则">×</button><div class="sp-rules-art" aria-hidden="true"><div class="sp-rules-scene"><header><small>一回合 · 一项行动</small><strong>从宝石到声望</strong></header><div class="sp-rules-route"><section class="sp-rules-step sp-rules-gem-step"><span class="sp-rules-number">01</span><div class="sp-rules-gems"><i class="tone-white"></i><i class="tone-blue"></i><i class="tone-green"></i><i class="tone-red"></i><i class="tone-black"></i><i class="tone-gold"></i></div><b>拿取筹码</b><small>积累宝石</small></section><em>›</em><section class="sp-rules-step"><span class="sp-rules-number">02</span><div class="sp-rules-card"><img src="/assets/bgg/splendor/art-2.jpg" alt=""><span>2</span><i></i><b>+1</b></div><b>购买发展</b><small>获得永久折扣</small></section><em>›</em><section class="sp-rules-step"><span class="sp-rules-number">03</span>${noblePortraitMarkup({ id: 'n3' }, 'sp-rules-noble')}<b>迎接贵族</b><small>取得声望</small></section></div><div class="sp-rules-decks">${cardBackMarkup(1)}${cardBackMarkup(2)}${cardBackMarkup(3)}</div></div><span class="sp-rules-target">15<small>声望目标</small></span></div><div class="sp-rules-copy"><small>基础版规则</small><h2 id="spRulesTitle">用折扣建立你的宝石商会</h2><ol><li><b>选择行动</b><span>每回合只能执行一项：拿取宝石、预留发展卡，或购买一张公开或已预留的发展卡。</span></li><li><b>拿取宝石</b><span>通常拿三种不同颜色；拿两枚同色时，该色行动前至少有四枚。库存颜色不足时，改拿现有的两种或一种。</span></li><li><b>购买与折扣</b><span>发展卡提供永久同色折扣。支付折扣后的费用，黄金可以代替任意缺少的颜色。</span></li><li><b>预留</b><span>可预留一张公开牌或暗抽任意等级牌库顶牌，最多三张；公共黄金有剩余时同时获得一枚。</span></li><li><b>贵族与终局</b><span>满足条件后每回合至多获得一位贵族。有人达到 15 分后完成当前轮，最高分获胜；同分时发展卡较少者胜。</span></li></ol><div class="sp-rules-limits"><span><i>10</i>筹码上限</span><span><i>3</i>预留上限</span><span><i>15</i>终局分数</span></div><p>本桌实现 2–4 人官方基础版，不包含城市、东方、漫威版或双人版扩展。</p></div></article></div>
    </section>`;
}
