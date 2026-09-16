export function createMonopolyDealTemplate() {
    return `<section class="deal-game" aria-label="大富翁纸牌游戏">
        <header class="deal-header">
            <div class="deal-brand"><span class="deal-brand-mark">交</span><div><small>快速交易 · 集齐三组获胜</small><h1>大富翁纸牌</h1></div></div>
            <dl class="deal-public-stats"><div><dt>阶段</dt><dd data-role="phase">等待</dd></div></dl>
            <div class="deal-header-actions"><button data-ui="rules" type="button" aria-label="查看规则">?</button></div>
            <div data-role="turn" class="deal-turn">等待游戏状态</div>
        </header>

        <section class="deal-council" aria-label="玩家席位">
            <div class="deal-council-heading"><strong>玩家席位</strong><span>银行与地产颜色公开</span></div>
            <div class="deal-opponents" data-role="opponents"></div>
        </section>

        <main class="deal-table">
            <div class="deal-table-inner">
                <section class="deal-stage" aria-label="当前行动">
                    <div class="deal-stage-core">
                            <aside class="deal-supply" aria-label="牌库">
                                <div class="deal-court-deck" aria-label="牌库与摸牌区">
                                    <button class="deal-deck-stack" data-action="drawCards" type="button" aria-label="摸牌"><img src="/assets/bgg/monopolydeal/card-back.jpg" alt=""></button>
                                </div>
                            </aside>
                        <section class="deal-event" data-role="event" aria-live="polite"><div class="deal-event-idle"><div><strong>正在准备牌局</strong></div></div></section>
                    </div>
                </section>

                <aside class="deal-intel" aria-label="最近行动记录">
                    <button class="deal-record-header" data-action="openArchive" data-archive="history" type="button" aria-label="打开完整行动记录"><span><strong>行动记录</strong><small>最近行动</small></span><i aria-hidden="true"></i></button>
                    <button class="deal-record-retired" data-action="openArchive" data-archive="retired" type="button" aria-label="打开已退出循环牌明细"><i aria-hidden="true"></i><span data-role="removedCards"><strong>已退出循环</strong><small>暂无银行牌</small></span></button>
                    <div class="deal-record-history" aria-label="最近行动摘要"><i aria-hidden="true"></i><span class="deal-record-copy" data-role="history"></span><span class="deal-record-card" data-role="historyCard"></span></div>
                </aside>
            </div>
        </main>

        <section class="deal-command" aria-label="您的手牌与行动">
            <div class="deal-command-inner">
                <section class="deal-self-seat" data-role="selfSeat" aria-label="您的公开资产"></section>
                <section class="deal-hand"><div class="deal-cards" data-role="hand"></div></section>
                <section class="deal-action-console" aria-label="行动操作"><span data-role="commandTitle" hidden></span><span data-role="commandHint" hidden></span><div class="deal-command-body" data-role="command"></div></section>
            </div>
        </section>

        <div class="deal-overlay is-hidden" data-role="rulesOverlay" role="presentation" aria-hidden="true"><article class="deal-rules"><button data-ui="closeRules" type="button" aria-label="关闭规则">×</button><small>标准规则</small><h2>大富翁纸牌完整规则</h2><div class="deal-rules-sections"><section><h3>目标与回合</h3><p>2～5人。每人起手5张；回合开始摸2张，若开始回合时没有手牌则摸5张。每回合可打出0～3张牌，回合末最多保留7张。最先拥有三个不同颜色完整地产组的玩家立即获胜。</p></section><section><h3>三种出牌方式</h3><p>现金牌存入银行；行动牌可以发动后弃置，也可永久作为现金存入银行；地产牌放入独立地产组，不能放进银行。已经存入银行的行动牌永远不能再发动。</p></section><section><h3>支付</h3><p>欠款人自行选择桌面上的银行牌、地产牌或两者组合支付，不能用手牌，也不能直接支付附着在地产组上的房子/酒店。银行牌进入收款人银行，地产进入其地产区。不找零；资产不足时交出全部可支付资产，余债取消。</p></section><section><h3>地产与建筑</h3><p>同色可以建立多组，但每组不能超过牌面规定数量；同色多组只算一种胜利颜色。完整组必须至少有一张普通地产。万能地产仅在自己回合调整且不计出牌。房子只能放在完整的非铁路/公用事业组，酒店必须先有房子，每组各限一张。</p></section><section><h3>行动牌</h3><p>双色租金选择牌面一种颜色并向所有对手收取；任何租金选择一个地产组和一名玩家。双倍租金必须紧接合法租金牌，可用两张形成四倍。盗取和强制交易不能动完整组；物业接管夺走一整个完整组及建筑。</p></section><section><h3>做出反对</h3><p>“做出反对”可以取消针对自己的行动，只保护使用者本人，也可以反制另一张“做出反对”。回应使用的“做出反对”不占每回合三张出牌额度。</p></section></div><figure class="deal-rules-art"><img src="/assets/bgg/monopolydeal/detail.jpg" alt="大富翁纸牌地产、收租和行动牌构成参考" loading="lazy"><figcaption>线上名称、金额与可用动作以实时状态为准</figcaption></figure></article></div>
        <div class="deal-choice-overlay is-hidden" data-role="choiceOverlay"><section class="deal-choice-dialog" role="dialog" aria-modal="true" aria-labelledby="dealChoiceTitle"><button class="deal-choice-close" data-action="closeChoice" type="button" aria-label="关闭颜色选择">×</button><small>选择地产颜色</small><h2 id="dealChoiceTitle" data-role="choiceTitle">选择颜色</h2><p data-role="choiceHint"></p><div class="deal-choice-grid" data-role="choiceGrid"></div><div class="deal-choice-actions" data-role="choiceActions"></div></section></div>
        <div class="deal-archive-overlay is-hidden" data-role="archiveOverlay" role="presentation" aria-hidden="true"><section class="deal-archive-dialog" role="dialog" aria-modal="true" aria-labelledby="dealArchiveTitle"><button class="deal-choice-close" data-action="closeArchive" type="button" aria-label="关闭记录">×</button><small data-role="archiveKicker">行动记录</small><h2 id="dealArchiveTitle" data-role="archiveTitle">完整行动记录</h2><p data-role="archiveHint">本局所有公开行动都会保留在这里。</p><div class="deal-archive-list" data-role="archiveList"></div></section></div>
        <div class="deal-turn-toast" data-role="turnToast" role="status" aria-live="polite" aria-hidden="true"><small>您的回合</small><strong>开始您的交易</strong></div>
        <svg class="deal-action-links" data-role="actionLinks" aria-hidden="true"><path class="deal-link-glow is-action" data-role="actionLinkGlow"></path><path class="deal-link-stroke is-action" data-role="actionLinkStroke"></path><circle class="deal-link-seal is-action" data-role="actionLinkSeal" r="7"></circle><path class="deal-link-glow is-response" data-role="responseLinkGlow"></path><path class="deal-link-stroke is-response" data-role="responseLinkStroke"></path><circle class="deal-link-seal is-response" data-role="responseLinkSeal" r="6"></circle></svg>
        <div class="deal-victory-layer" data-role="victoryLayer" aria-hidden="true" hidden><div class="deal-victory-scene" data-role="victoryScene" role="status" aria-live="assertive"></div><button type="button" class="deal-victory-skip" data-action="skip-victory">跳过</button></div>
    </section>`;
}
