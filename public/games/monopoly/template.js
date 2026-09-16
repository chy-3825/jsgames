import { BOARD_CENTER_SKINS, escapeHtml } from './constants.js';

const esc = escapeHtml;

export function createMonopolyTemplate({ initialSkin = BOARD_CENTER_SKINS[0], activeSkinId = initialSkin.id } = {}) {
    return `<section class="mono-game" tabindex="-1" aria-label="环城大富翁游戏">
        <header class="mono-topbar">
            <div class="mono-brand">
                <span class="mono-brand-mark" aria-hidden="true">⌂</span>
                <div><h1>环城大富翁</h1></div>
            </div>
            <div class="mono-turn-status" aria-live="polite">
                <span class="mono-turn-dot" aria-hidden="true"></span>
                <div><small data-role="phase">等待开局</small><strong data-role="turn">等待游戏状态</strong></div>
            </div>
            <div class="mono-scoreboard" aria-label="本局统计" hidden>
                <div><small>回合</small><b data-role="turnNumber">--</b></div>
                <div><small>房屋</small><b data-role="houses">32</b></div>
                <div><small>酒店</small><b data-role="hotels">12</b></div>
            </div>
            <div class="mono-top-actions">
                <button class="mono-icon-button" data-ui="rules" type="button" aria-label="查看规则" title="查看规则">?</button>

            </div>
        </header>

        <main class="mono-layout">
            <section class="mono-table" aria-label="城市棋盘与当前行动">
                <header class="mono-table-head">
                    <div><h2>城市地图</h2></div>
                    <div class="mono-table-tools">
                        <div class="mono-live-badge" hidden><i aria-hidden="true"></i><span data-role="eventBadge">等待第一掷</span></div>
                        <div class="mono-token-switcher">
                            <button class="mono-skin-trigger" data-ui="toggleTokenMenu" type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="mono-token-menu" aria-label="选择棋子">
                                <span class="mono-skin-trigger-icon" aria-hidden="true">♟</span>
                                <span><strong>棋子</strong><small data-role="tokenLabel">开局随机分配</small></span>
                                <b aria-hidden="true">⌄</b>
                            </button>
                            <div class="mono-token-menu mono-skin-menu" id="mono-token-menu" data-role="tokenMenu" role="dialog" aria-label="选择棋子" aria-hidden="true" hidden>
                                <header>
                                    <div><strong>选择你的棋子</strong><small>每种棋子只能由一位玩家使用</small></div>
                                    <div class="mono-token-style-switcher" role="group" aria-label="切换棋子样式">
                                        <span>样式</span>
                                        <button data-ui="selectTokenStyle" data-token-style="2d" type="button" aria-pressed="false">2D</button>
                                        <button data-ui="selectTokenStyle" data-token-style="3d" type="button" aria-pressed="true">3D</button>
                                    </div>
                                </header>
                                <div class="mono-token-options" data-role="tokenOptions" role="listbox" aria-label="可选棋子"></div>
                            </div>
                        </div>
                        <div class="mono-skin-switcher">
                            <button class="mono-skin-trigger" data-ui="toggleSkinMenu" type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="mono-skin-menu" aria-label="更换棋盘中央图片，当前为${esc(initialSkin.name)}">
                                <span class="mono-skin-trigger-icon" aria-hidden="true">◫</span>
                                <span><strong>换肤</strong><small data-role="skinLabel">${esc(initialSkin.name)}</small></span>
                                <b aria-hidden="true">⌄</b>
                            </button>
                            <div class="mono-skin-menu" id="mono-skin-menu" data-role="skinMenu" role="dialog" aria-label="选择棋盘中央图片" aria-hidden="true" hidden>
                                <header><div><strong>中央画面</strong><small>只更换画面，不改变棋盘格位置</small></div></header>
                                <div class="mono-skin-options" role="listbox" aria-label="内置皮肤">
                                    ${BOARD_CENTER_SKINS.map(skin => `<button class="mono-skin-option ${skin.id === activeSkinId ? 'is-selected' : ''}" data-ui="selectSkin" data-skin-id="${esc(skin.id)}" type="button" role="option" aria-selected="${skin.id === activeSkinId}">
                                        <span class="mono-skin-thumb"><img src="${esc(skin.image)}" alt="" aria-hidden="true" draggable="false"></span>
                                        <span><strong>${esc(skin.name)}</strong><small>${esc(skin.detail)}</small></span><i aria-hidden="true">✓</i>
                                    </button>`).join('')}
                                </div>
                                <button class="mono-skin-upload" data-ui="uploadSkin" type="button" aria-pressed="false">
                                    <span class="mono-skin-upload-preview"><img data-role="localSkinPreview" alt="" aria-hidden="true" hidden><b aria-hidden="true">＋</b></span>
                                    <span><strong>选择本地图片</strong><small>仅在当前页面使用，不会上传</small></span><i aria-hidden="true">浏览</i>
                                </button>
                                <input data-role="skinUpload" type="file" accept="image/*" hidden>
                            </div>
                        </div>
                    </div>
                </header>

                <div class="mono-board-frame">
                    <div class="mono-board" data-role="board">
                        <img class="mono-board-center-art" data-role="centerArt" src="${esc(initialSkin.image)}" alt="" aria-hidden="true" draggable="false">
                        <img class="mono-board-art-frame" src="/assets/monopoly/hong-kong-board-frame.png" alt="" aria-hidden="true" draggable="false">

                    </div>
                    <footer class="mono-board-caption"><span><i class="legend-token" aria-hidden="true"></i>玩家位置</span><span><i class="legend-band" aria-hidden="true"></i>地产色组</span><span><i class="legend-house" aria-hidden="true"></i>建筑状态</span><small>点击格子查看详情</small></footer>
                </div>

                <section class="mono-mobile-navigator" data-role="mobileNavigator" aria-label="地点导航与详情" hidden>
                    <div class="mono-mobile-inspector" data-role="mobileInspector" aria-live="polite"></div>
                    <div class="mono-mobile-route-controls">
                        <button data-ui="previousTile" type="button" aria-label="查看上一站">‹</button>
                        <label><span>选择地点</span><select data-role="mobileTileSelect" aria-label="选择要查看的地点"></select></label>
                        <button data-ui="followPosition" data-role="followPositionButton" type="button" aria-pressed="true" aria-label="跟随我的棋子位置">定位</button>
                        <button data-ui="nextTile" type="button" aria-label="查看下一站">›</button>
                    </div>
                </section>


            </section>

            <aside class="mono-side" aria-label="操作与资产">
                <section class="mono-command" aria-label="当前行动">
                        <section class="mono-status-panel" aria-label="对局信息与骰子" aria-live="polite">
                            <div class="mono-status-meta"><span>本回合</span><span data-role="boardRound">第 01 回合</span></div>
                            <button class="mono-dice-tray" data-role="dice" data-ui="rollDice" type="button" aria-label="点击骰子掷骰" disabled></button>
                            <details class="mono-bank-details"><summary>建筑库存</summary><span data-role="bankStatus">32 栋房屋 · 12 间酒店</span></details>
                        </section>
                    <header class="mono-command-head"><div><h2 data-role="commandTitle">等待游戏状态</h2></div><span class="mono-command-state" data-role="commandState">等待中</span></header>
                    <p class="mono-command-hint" data-role="commandHint"></p>
                    <div class="mono-actions" data-role="actions"></div>
                </section>
                <section class="mono-panel mono-roster">
                    <header class="mono-panel-head"><div><h2>玩家资产</h2></div><span data-role="phaseShort">等待中</span></header>
                    <div class="mono-players" data-role="players"></div>
                </section>
                <details class="mono-panel mono-log-panel">
                    <summary class="mono-panel-head">行动记录</summary>
                    <div class="mono-log" data-role="log"></div>
                </details>
            </aside>
        </main>

        <dialog class="mono-landing-dialog mono-assets-dialog" data-role="assetsDialog" aria-labelledby="mono-assets-title">
            <button class="mono-dialog-close" data-ui="closeAssets" type="button" aria-label="关闭玩家资产">×</button>
            <div data-role="assetList"></div>
        </dialog>
        <dialog class="mono-landing-dialog mono-property-dialog" data-role="propertyDialog" aria-label="地块详情">
            <button class="mono-dialog-close" data-ui="closeProperty" type="button" aria-label="关闭地块详情">×</button>
            <section class="mono-inspector" data-role="inspector" aria-live="polite"></section>
        </dialog>
        <dialog class="mono-landing-dialog" data-role="landingDialog" aria-labelledby="mono-landing-title">
            <button class="mono-dialog-close" data-ui="closeLanding" type="button" aria-label="关闭事件">×</button>
            <div class="mono-event-card" data-role="eventCard"></div>
            <div class="mono-actions" data-role="landingActions"></div>
        </dialog>
        <div class="mono-overlay is-hidden" data-role="rulesOverlay" aria-hidden="true">
            <article class="mono-rules" role="dialog" aria-modal="true" aria-labelledby="mono-rules-title">
                <button class="mono-dialog-close" data-ui="closeRules" type="button" aria-label="关闭规则">×</button>
                <span class="mono-kicker">C1009 经典版 · 2–6 人</span>
                <h2 id="mono-rules-title">环城大富翁规则</h2>
                <div class="mono-rule-grid">
                    <section><h3>回合流程</h3><p>掷两枚骰子沿 40 格路线前进。经过起点领取 M200；落到无主地产时按标价购买，或放弃后进入公开拍卖。</p></section>
                    <section><h3>租金与特殊格</h3><p>落到他人地产需支付租金；交通设施按拥有数量计租，公用事业按本次骰点计租。机会牌和公益金牌会继续结算移动结果。</p></section>
                    <section><h3>建筑与资产</h3><p>完整同色组才能建造，房屋必须均匀升级；四栋房屋后才能建酒店。建筑按半价出售；无建筑地产可抵押，赎回支付抵押价加 10%。</p></section>
                    <section><h3>交易与欠款</h3><p>玩家可随时交易现金、地产和免费出狱卡。欠款时先出售建筑、抵押或交易筹款，仍无法偿还才会破产。</p></section>
                    <section><h3>监狱</h3><p>连续三次双骰、落到“前往监狱”或抽到入狱牌都会进入监狱。可支付 M50、使用免费出狱卡，或最多尝试三次掷出对子。</p></section>
                    <section><h3>版本说明</h3><p>本局采用 Hasbro C1009 经典规则；银行、收租和拍卖由系统自动结算。免费停车不发放奖金。</p></section>
                </div>
                <details class="mono-rule-route"><summary>查看 40 格香港路线</summary><p>0 维港起点 · 1 深水埗 · 2 公益金 · 3 旺角 · 4 印花税 · 5 九广铁路 · 6 油麻地 · 7 机会 · 8 尖沙咀 · 9 佐敦 · 10 监狱 · 11 湾仔 · 12 中华电力 · 13 铜锣湾 · 14 跑马地 · 15 山顶缆车 · 16 北角 · 17 公益金 · 18 太古城 · 19 筲箕湾 · 20 免费停车 · 21 赤柱 · 22 机会 · 23 浅水湾 · 24 海洋公园 · 25 天星码头 · 26 中环 · 27 金钟 · 28 水务署 · 29 兰桂坊 · 30 前往监狱 · 31 西环 · 32 上环 · 33 公益金 · 34 苏豪区 · 35 香港电车 · 36 机会 · 37 太平山 · 38 港湾税 · 39 维多利亚港。</p></details>
            </article>
        </div>
        <div class="mono-overlay is-hidden" data-role="tradeOverlay" aria-hidden="true">
            <article class="mono-trade" role="dialog" aria-modal="true" aria-labelledby="mono-trade-title">
                <button class="mono-dialog-close" data-ui="closeTrade" type="button" aria-label="关闭交易窗口">×</button>
                <span class="mono-kicker">地产交易</span>
                <h2 id="mono-trade-title">发起交易</h2>
                <p class="mono-trade-intro">可随时协商现金、地产和免费出狱卡；建筑不能交易。</p>
                <div class="mono-trade-grid">
                    <label class="mono-trade-field"><span>交易对象</span><select data-role="tradeTarget"></select></label>
                    <label class="mono-trade-field"><span>我支付现金</span><input data-role="tradeCashOffer" type="number" min="0" step="1" inputmode="numeric" placeholder="0"></label>
                    <label class="mono-trade-field"><span>我收取现金</span><input data-role="tradeCashRequest" type="number" min="0" step="1" inputmode="numeric" placeholder="0"></label>
                </div>
                <div class="mono-trade-columns">
                    <section><h3>我提供</h3><div data-role="tradeOfferAssets"></div></section>
                    <section><h3>我想要</h3><div data-role="tradeRequestAssets"></div></section>
                </div>
                <footer class="mono-trade-actions"><button class="mono-action-quiet" data-ui="closeTrade" type="button">取消</button><button class="mono-action-primary" data-ui="submitTrade" type="button">发送交易提议</button></footer>
            </article>
        </div>
    </section>`;
}
