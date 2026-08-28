import { BOARD_CENTER_SKINS, escapeHtml } from './constants.js';

const esc = escapeHtml;

export function createMonopolyTemplate({ initialSkin = BOARD_CENTER_SKINS[0], activeSkinId = initialSkin.id } = {}) {
    return `<section class="mono-game" tabindex="-1" aria-label="环城大富翁游戏">
        <header class="mono-topbar">
            <div class="mono-brand">
                <span class="mono-brand-mark" aria-hidden="true">⌂</span>
                <div><small>HONG KONG HARBOUR EDITION</small><h1>环城大富翁</h1></div>
            </div>
            <div class="mono-turn-status" aria-live="polite">
                <span class="mono-turn-dot" aria-hidden="true"></span>
                <div><small data-role="phase">等待开局</small><strong data-role="turn">等待游戏状态</strong></div>
            </div>
            <div class="mono-scoreboard" aria-label="本局统计">
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
                    <div><span class="mono-kicker">香港环城纪念版</span><h2>沿着维港路线积累资产</h2><p>穿梭港岛与九龙，点击地点查看租金和建筑状态。</p></div>
                    <div class="mono-table-tools">
                        <div class="mono-live-badge"><i aria-hidden="true"></i><span data-role="eventBadge">等待第一掷</span></div>
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
                        <div class="mono-center" aria-live="polite">
                            <div class="mono-center-meta"><span>VICTORIA HARBOUR · 40 站</span><span data-role="boardRound">ROUND 01</span></div>
                            <span class="mono-center-seal" aria-hidden="true">港</span>
                            <strong>香江环城</strong>
                            <small>穿越九龙与港岛 · 建立你的城市版图</small>
                            <div class="mono-event-card" data-role="eventCard"><span>TABLE NOTE</span><strong>等待第一掷</strong><p>掷出骰子，开始你的城市路线。</p></div>
                            <div class="mono-dice-tray" data-role="dice" aria-label="骰子结果"></div>
                            <div class="mono-center-foot"><span>经过起点 +¥200</span><span data-role="bankStatus">32 栋房屋 · 12 间酒店</span></div>
                        </div>
                    </div>
                    <footer class="mono-board-caption"><span><i class="legend-token" aria-hidden="true"></i>玩家位置</span><span><i class="legend-band" aria-hidden="true"></i>地产色组</span><span><i class="legend-house" aria-hidden="true"></i>建筑状态</span><small>点击格子查看详情</small></footer>
                </div>

                <section class="mono-mobile-navigator" data-role="mobileNavigator" aria-label="地点导航与详情">
                    <div class="mono-mobile-inspector" data-role="mobileInspector" aria-live="polite"></div>
                    <div class="mono-mobile-route-controls">
                        <button data-ui="previousTile" type="button" aria-label="查看上一站">‹</button>
                        <label><span>选择地点</span><select data-role="mobileTileSelect" aria-label="选择要查看的地点"></select></label>
                        <button data-ui="followPosition" data-role="followPositionButton" type="button" aria-pressed="true" aria-label="跟随我的棋子位置">定位</button>
                        <button data-ui="nextTile" type="button" aria-label="查看下一站">›</button>
                    </div>
                </section>

                <section class="mono-command" aria-label="当前行动">
                    <header class="mono-command-head"><div><span class="mono-kicker">YOUR MOVE</span><h2 data-role="commandTitle">等待游戏状态</h2></div><span class="mono-command-state" data-role="commandState">WAITING</span></header>
                    <p class="mono-command-hint" data-role="commandHint">游戏开始后，当前玩家可以从这里提交行动。</p>
                    <div class="mono-actions" data-role="actions"></div>
                </section>
            </section>

            <aside class="mono-side" aria-label="城市账本">
                <section class="mono-panel mono-roster">
                    <header class="mono-panel-head"><div><span class="mono-kicker">CITY LEDGER</span><h2>玩家资产</h2></div><span data-role="phaseShort">等待中</span></header>
                    <div class="mono-players" data-role="players"></div>
                </section>
                <section class="mono-panel mono-inspector" data-role="inspector" aria-live="polite"></section>
                <section class="mono-panel mono-log-panel">
                    <header class="mono-panel-head"><div><span class="mono-kicker">ACTION LOG</span><h2>行动记录</h2></div><span>最近 14 条</span></header>
                    <div class="mono-log" data-role="log"></div>
                </section>
            </aside>
        </main>

        <div class="mono-overlay is-hidden" data-role="rulesOverlay" aria-hidden="true">
            <article class="mono-rules" role="dialog" aria-modal="true" aria-labelledby="mono-rules-title">
                <button class="mono-dialog-close" data-ui="closeRules" type="button" aria-label="关闭规则">×</button>
                <span class="mono-kicker">CLASSIC EDITION · 2–8 PLAYERS</span>
                <h2 id="mono-rules-title">环城大富翁规则</h2>
                <div class="mono-rule-grid">
                    <section><h3>回合流程</h3><p>掷两枚骰子，沿 40 格路线前进。经过或停留在起点领取 ¥200；落到未出售地产时，可以按标价购买，也可以放弃并进入公开拍卖。</p></section>
                    <section><h3>租金与特殊格</h3><p>他人地产按地产、房屋或酒店规则支付租金。交通站按拥有数量计租；公用事业按骰子点数计租。机会与命运牌会继续结算移动结果。</p></section>
                    <section><h3>建筑与资产</h3><p>完整同色地产组才能建造，房屋必须均匀升级；四栋房屋后才能建酒店。建筑可按半价均匀出售；无建筑地产可以抵押，赎回需支付抵押价值的 110%。</p></section>
                    <section><h3>拘留所</h3><p>连续三次掷出对子、落到“直接入狱”或抽到入狱牌都会进入拘留所。可以支付 ¥50、使用出狱卡，或最多尝试三次掷出对子。</p></section>
                </div>
                <section class="mono-rule-route"><h3>40 格香港路线</h3><p>0 维港起点 · 1 深水埗 · 2 命运 · 3 旺角 · 4 印花税 · 5 九广铁路 · 6 油麻地 · 7 机会 · 8 尖沙咀 · 9 佐敦 · 10 拘留所 · 11 湾仔 · 12 中华电力 · 13 铜锣湾 · 14 跑马地 · 15 山顶缆车 · 16 北角 · 17 命运 · 18 太古城 · 19 筲箕湾 · 20 免费泊车 · 21 赤柱 · 22 机会 · 23 浅水湾 · 24 海洋公园 · 25 天星码头 · 26 中环 · 27 金钟 · 28 水务署 · 29 兰桂坊 · 30 前往拘留所 · 31 西环 · 32 上环 · 33 命运 · 34 苏豪区 · 35 香港电车 · 36 机会 · 37 太平山 · 38 港湾税 · 39 维多利亚港。</p></section>
            </article>
        </div>
    </section>`;
}
