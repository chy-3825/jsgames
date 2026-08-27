const BOARD_IMAGE_SIZE = 1254;
const BOARD_TILE_COUNT = 40;
// Keep the roll brisk so the board action starts without a long pause.
const DICE_ANIMATION_MS = 900;
const MOVE_STEP_MS = 220;
const DICE_PIPS = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8],
};

function randomSumSevenDice() {
    const first = 1 + Math.floor(Math.random() * 6);
    return [first, 7 - first];
}

const PLAYER_TOKEN_ART = {
    '2d': [
        '/assets/monopoly/tokens/2d-tram.png',
        '/assets/monopoly/tokens/2d-ferry.png',
        '/assets/monopoly/tokens/2d-junk.png',
        '/assets/monopoly/tokens/2d-taxi.png',
        '/assets/monopoly/tokens/2d-lantern.png',
        '/assets/monopoly/tokens/2d-bauhinia.png',
        '/assets/monopoly/tokens/2d-cable-car.png',
        '/assets/monopoly/tokens/2d-dim-sum.png',
    ],
    '3d': [
        '/assets/monopoly/tokens/3d-tram.png',
        '/assets/monopoly/tokens/3d-ferry.png',
        '/assets/monopoly/tokens/3d-junk.png',
        '/assets/monopoly/tokens/3d-taxi.png',
        '/assets/monopoly/tokens/3d-lantern.png',
        '/assets/monopoly/tokens/3d-bauhinia.png',
        '/assets/monopoly/tokens/3d-cable-car.png',
        '/assets/monopoly/tokens/3d-dim-sum.png',
    ],
};
const PLAYER_TOKEN_NAMES = ['电车', '渡轮', '帆船', '出租车', '灯笼', '紫荆花', '缆车', '点心'];
const TOKEN_STYLE_STORAGE_KEY = 'jsgames.monopoly.tokenStyle';
const BOARD_CENTER_SKINS = [
    {
        id: 'harbour',
        name: '维港纪念',
        detail: '经典海港插画',
        image: '/assets/monopoly/hong-kong-board-center.png',
    },
    {
        id: 'neon',
        name: '霓虹雨夜',
        detail: '雨夜城市灯影',
        image: '/assets/monopoly/hong-kong-board-center-neon.png',
    },
];
const BOARD_SKIN_STORAGE_KEY = 'jsgames.monopoly.centerSkin';
const BOARD_RECTS = (() => {
    const rects = [];
    const inset = 2;
    const setRect = (index, x1, y1, x2, y2, edge) => {
        rects[index] = { x: x1 + inset, y: y1 + inset, width: x2 - x1 - inset * 2, height: y2 - y1 - inset * 2, edge };
    };

    // These coordinates follow the actual cream paper cells in the 1254px
    // source image. The outer gold/jade frame and inner green trim are left
    // outside every hit target.
    const bottomX = [198, 308, 398, 487, 575, 670, 760, 849, 939, 1052];
    const topX = [198, 310, 400, 487, 575, 670, 760, 849, 939, 1052];
    const leftY = [201, 290, 376, 465, 552, 701, 788, 876, 962, 1054];
    const rightY = [201, 290, 376, 466, 552, 701, 788, 876, 962, 1054];

    setRect(0, 1052, 1054, 1228, 1228, 'corner');
    for (let index = 1; index <= 9; index += 1) {
        const cell = 9 - index;
        setRect(index, bottomX[cell], 1078, bottomX[cell + 1], 1228, 'bottom');
    }
    setRect(10, 26, 1054, 198, 1228, 'corner');
    for (let index = 11; index <= 19; index += 1) {
        const cell = 19 - index;
        setRect(index, 26, leftY[cell], 176, leftY[cell + 1], 'left');
    }
    setRect(20, 26, 26, 198, 198, 'corner');
    for (let index = 21; index <= 29; index += 1) {
        const cell = index - 21;
        setRect(index, topX[cell], 26, topX[cell + 1], 178, 'top');
    }
    setRect(30, 1052, 26, 1228, 198, 'corner');
    for (let index = 31; index <= 39; index += 1) {
        const cell = index - 31;
        setRect(index, 1078, rightY[cell], 1228, rightY[cell + 1], 'right');
    }
    return rects;
})();

const GROUP_LABELS = {
    brown: '棕色地产',
    lightblue: '浅蓝地产',
    pink: '粉色地产',
    orange: '橙色地产',
    red: '红色地产',
    yellow: '黄色地产',
    green: '绿色地产',
    blue: '深蓝地产',
    transit: '车站',
    utility: '公用事业',
};

const TYPE_LABELS = {
    start: '起点',
    chance: '机会',
    community_chest: '命运',
    tax: '税费',
    jail: '拘留所',
    parking: '免费停车',
    go_to_jail: '入狱',
};

export function createGameClient({ mount, send, addLog }) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/games/monopoly/style.css?v=20260826-mobile-games-2';
    document.head.appendChild(link);
    document.body.classList.add('is-monopoly-view');

    let state = null;
    let selectedTile = 0;
    let followPlayerPosition = true;
    let mobileBoardSignature = '';
    let rulesOpen = false;
    let skinMenuOpen = false;
    let tokenMenuOpen = false;
    let localSkinObjectUrl = null;
    const storedTokenStyle = readStoredTokenStyle();
    let previewTokenStyle = storedTokenStyle === '2d' || storedTokenStyle === '3d' ? storedTokenStyle : '3d';
    const storedSkinId = readStoredBoardSkin();
    let activeSkinId = BOARD_CENTER_SKINS.some(skin => skin.id === storedSkinId) ? storedSkinId : BOARD_CENTER_SKINS[0].id;
    const initialSkin = BOARD_CENTER_SKINS.find(skin => skin.id === activeSkinId) || BOARD_CENTER_SKINS[0];
    const controller = new AbortController();
    let latestRollKey = '';
    let idleDice = randomSumSevenDice();
    let visibleDice = idleDice;
    let diceAnimationTimer = null;
    let diceAnimationToken = 0;
    let diceAnimationFinal = null;
    let diceAnimationStartedAt = 0;
    let isDiceAnimating = false;
    let isRollPending = false;
    let latestMoveKey = '';
    let visualPositions = new Map();
    let movementAnimationTimer = null;
    let movementAnimationToken = 0;
    let movementAnimation = null;
    let pendingMovement = null;
    let isMoveAnimating = false;

    mount.innerHTML = `<section class="mono-game" tabindex="-1" aria-label="环城大富翁游戏">
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

    const $ = role => mount.querySelector(`[data-role="${role}"]`);
    const root = mount.querySelector('.mono-game');
    const boardEl = $('board');
    const playersEl = $('players');
    const actionsEl = $('actions');
    const overlay = $('rulesOverlay');
    const centerArtEl = $('centerArt');
    const skinMenuEl = $('skinMenu');
    const skinTriggerEl = mount.querySelector('[data-ui="toggleSkinMenu"]');
    const skinUploadEl = $('skinUpload');
    const tokenMenuEl = $('tokenMenu');
    const tokenTriggerEl = mount.querySelector('[data-ui="toggleTokenMenu"]');
    const tokenOptionsEl = $('tokenOptions');
    const tokenStyleButtons = mount.querySelectorAll('[data-ui="selectTokenStyle"]');
    const mobileTileSelectEl = $('mobileTileSelect');
    const followPositionButtonEl = $('followPositionButton');

    function setSkinMenu(open, returnFocus = false) {
        skinMenuOpen = Boolean(open);
        skinMenuEl.hidden = !skinMenuOpen;
        skinMenuEl.setAttribute('aria-hidden', String(!skinMenuOpen));
        skinTriggerEl.setAttribute('aria-expanded', String(skinMenuOpen));
        skinTriggerEl.classList.toggle('is-open', skinMenuOpen);
        if (!skinMenuOpen && returnFocus) skinTriggerEl.focus();
    }

    function setTokenMenu(open, returnFocus = false) {
        tokenMenuOpen = Boolean(open);
        if (tokenMenuOpen) {
            const me = state?.players?.find(player => player.id === state.myId);
            if (me?.tokenStyle === '2d' || me?.tokenStyle === '3d') previewTokenStyle = me.tokenStyle;
        }
        tokenMenuEl.hidden = !tokenMenuOpen;
        tokenMenuEl.setAttribute('aria-hidden', String(!tokenMenuOpen));
        tokenTriggerEl.setAttribute('aria-expanded', String(tokenMenuOpen));
        tokenTriggerEl.classList.toggle('is-open', tokenMenuOpen);
        updateTokenMenu();
        if (!tokenMenuOpen && returnFocus) tokenTriggerEl.focus();
    }

    function revokeLocalSkin() {
        if (!localSkinObjectUrl) return;
        try {
            URL.revokeObjectURL(localSkinObjectUrl);
        } catch {
            // Some embedded browsers expose URL without object URL support.
        }
        localSkinObjectUrl = null;
    }

    function updateSkinControls() {
        const builtInSkin = BOARD_CENTER_SKINS.find(skin => skin.id === activeSkinId);
        const displayName = builtInSkin?.name || '本地图片';
        $('skinLabel').textContent = displayName;
        skinTriggerEl.setAttribute('aria-label', `更换棋盘中央图片，当前为${displayName}`);
        mount.querySelectorAll('[data-ui="selectSkin"]').forEach(option => {
            const selected = option.dataset.skinId === activeSkinId;
            option.classList.toggle('is-selected', selected);
            option.setAttribute('aria-selected', String(selected));
        });
        const uploadButton = mount.querySelector('[data-ui="uploadSkin"]');
        const localSelected = activeSkinId === 'local';
        uploadButton.classList.toggle('is-selected', localSelected);
        uploadButton.setAttribute('aria-pressed', String(localSelected));
        const preview = $('localSkinPreview');
        preview.hidden = !localSelected;
        preview.parentElement.classList.toggle('has-image', localSelected);
        if (localSelected && localSkinObjectUrl) preview.src = localSkinObjectUrl;
        else preview.removeAttribute('src');
    }

    function updateTokenStyleControls() {
        tokenStyleButtons.forEach(button => {
            const selected = button.dataset.tokenStyle === previewTokenStyle;
            button.setAttribute('aria-pressed', String(selected));
            button.classList.toggle('is-selected', selected);
        });
    }

    function updateTokenMenu() {
        updateTokenStyleControls();
        const me = state?.players?.find(player => player.id === state.myId) || null;
        const usedBy = new Map((state?.players || [])
            .filter(player => player.id !== state?.myId && !player.isBankrupt && player.isOnline !== false && Number.isInteger(player.tokenId))
            .map(player => [player.tokenId, player]));
        const assignedToken = Number.isInteger(me?.tokenId) ? me.tokenId : null;
        const tokenLabel = assignedToken == null
            ? '开局随机分配'
            : `${PLAYER_TOKEN_NAMES[assignedToken] || '棋子'} · ${me.tokenStyle === '2d' ? '2D' : '3D'}`;
        $('tokenLabel').textContent = tokenLabel;
        tokenTriggerEl.setAttribute('aria-label', `选择棋子，当前为${tokenLabel}`);
        tokenOptionsEl.innerHTML = PLAYER_TOKEN_NAMES.map((name, tokenId) => {
            const owner = usedBy.get(tokenId);
            const selected = assignedToken === tokenId;
            const disabled = !state || state.status !== 'playing' || isDiceAnimating || isMoveAnimating || isRollPending || Boolean(owner);
            const status = owner ? `已被 ${esc(owner.name)} 使用` : selected ? '当前棋子' : state?.status === 'playing' ? '可选择' : '开局后可选择';
            return `<button class="mono-token-option ${selected ? 'is-selected' : ''} ${owner ? 'is-used' : ''}" data-ui="selectToken" data-token-id="${tokenId}" type="button" role="option" aria-selected="${selected}" ${disabled ? 'disabled' : ''}>
                <span class="mono-token-option-art"><img src="${PLAYER_TOKEN_ART[previewTokenStyle][tokenId]}" alt="" aria-hidden="true" draggable="false"></span>
                <span class="mono-token-option-copy"><strong>${esc(name)}</strong><small>${status}</small></span><i aria-hidden="true">${selected ? '✓' : owner ? '×' : ''}</i>
            </button>`;
        }).join('');
    }

    function selectTokenStyle(style) {
        if (!PLAYER_TOKEN_ART[style] || style === previewTokenStyle || isDiceAnimating || isMoveAnimating || isRollPending) return;
        previewTokenStyle = style;
        storeTokenStyle(style);
        updateTokenStyleControls();
        updateTokenMenu();
        const me = state?.players?.find(player => player.id === state.myId);
        if (me && Number.isInteger(me.tokenId) && state.status === 'playing') {
            send({ type: 'gameAction', action: { kind: 'selectToken', tokenId: me.tokenId, tokenStyle: style } });
        }
    }

    function selectTokenSkin(tokenId) {
        const nextTokenId = Number(tokenId);
        const me = state?.players?.find(player => player.id === state.myId);
        const owner = state?.players?.find(player => player.id !== state.myId && !player.isBankrupt && player.isOnline !== false && player.tokenId === nextTokenId);
        if (!me || state.status !== 'playing' || isDiceAnimating || isMoveAnimating || isRollPending || !Number.isInteger(nextTokenId) || nextTokenId < 0 || nextTokenId >= PLAYER_TOKEN_NAMES.length || owner) return;
        if (me.tokenId === nextTokenId && me.tokenStyle === previewTokenStyle) {
            setTokenMenu(false, true);
            return;
        }
        send({ type: 'gameAction', action: { kind: 'selectToken', tokenId: nextTokenId, tokenStyle: previewTokenStyle } });
        setTokenMenu(false, true);
    }

    function selectBuiltInSkin(skinId) {
        const skin = BOARD_CENTER_SKINS.find(candidate => candidate.id === skinId);
        if (!skin) return;
        centerArtEl.src = skin.image;
        activeSkinId = skin.id;
        revokeLocalSkin();
        storeBoardSkin(skin.id);
        updateSkinControls();
        setSkinMenu(false, true);
    }

    function selectLocalSkin(file) {
        if (!file || (file.type && !String(file.type).startsWith('image/'))) return;
        let nextObjectUrl;
        try {
            nextObjectUrl = URL.createObjectURL(file);
        } catch {
            return;
        }
        const previousObjectUrl = localSkinObjectUrl;
        localSkinObjectUrl = nextObjectUrl;
        activeSkinId = 'local';
        centerArtEl.src = nextObjectUrl;
        if (previousObjectUrl) {
            try {
                URL.revokeObjectURL(previousObjectUrl);
            } catch {
                // The replacement is still valid even if revocation is unsupported.
            }
        }
        updateSkinControls();
        setSkinMenu(false, true);
    }

    updateSkinControls();
    updateTokenMenu();

    function normalizeDice(values) {
        if (!Array.isArray(values) || values.length !== 2) return null;
        const dice = values.map(value => Number(value));
        return dice.every(value => Number.isInteger(value) && value >= 1 && value <= 6) ? dice : null;
    }

    function diceMarkup(value, index, rolling = false) {
        const face = Number(value) || 0;
        if (!face) return `<span class="mono-die is-empty${rolling ? ' is-rolling' : ''}" aria-label="第${index + 1}枚骰子尚未掷出">?</span>`;
        const activePips = DICE_PIPS[face] || [];
        const pips = Array.from({ length: 9 }, (_, pipIndex) => `<i class="${activePips.includes(pipIndex) ? 'is-on' : ''}" aria-hidden="true"></i>`).join('');
        return `<span class="mono-die${rolling ? ' is-rolling' : ''}" data-value="${face}" aria-label="第${index + 1}枚骰子 ${face}">${pips}</span>`;
    }

    function renderDice(values = null, landed = false) {
        const explicitDice = normalizeDice(values);
        const stateDice = normalizeDice(state?.dice);
        const dice = explicitDice || stateDice || (isDiceAnimating ? normalizeDice(visibleDice) : idleDice);
        const isPreview = !explicitDice && !stateDice && !isDiceAnimating;
        const tray = $('dice');
        const rolling = isDiceAnimating;
        const faceKey = dice ? dice.join(',') : 'empty';
        tray.classList.toggle('is-rolling', rolling);
        tray.classList.toggle('is-preview', isPreview);
        tray.setAttribute('aria-label', rolling ? '骰子滚动中' : isPreview ? '等待掷骰，示例骰面合计七点' : dice ? `骰子 ${dice[0]} 加 ${dice[1]}` : '等待掷骰');
        if (tray.dataset.faces === faceKey && !rolling && !landed) return;
        tray.dataset.faces = faceKey;
        tray.innerHTML = dice
            ? `${diceMarkup(dice[0], 0, rolling)}${diceMarkup(dice[1], 1, rolling)}<b>= ${dice[0] + dice[1]}</b>`
            : `${diceMarkup(0, 0, rolling)}${diceMarkup(0, 1, rolling)}<b>等待掷骰</b>`;
        if (landed && dice) {
            tray.querySelectorAll('.mono-die').forEach(die => {
                die.classList.remove('has-landed');
                void die.offsetWidth;
                die.classList.add('has-landed');
            });
        }
    }

    function finishDiceAnimation() {
        if (!diceAnimationFinal) return;
        if (diceAnimationTimer) clearTimeout(diceAnimationTimer);
        diceAnimationTimer = null;
        visibleDice = diceAnimationFinal;
        diceAnimationFinal = null;
        isDiceAnimating = false;
        isRollPending = false;
        const queuedMovement = pendingMovement;
        pendingMovement = null;
        renderDice(visibleDice, true);
        if (queuedMovement) startMovementAnimation(queuedMovement);
        render();
    }

    function runDiceFrame(animationToken) {
        if (animationToken !== diceAnimationToken || !isDiceAnimating) return;
        const elapsed = Date.now() - diceAnimationStartedAt;
        if (elapsed >= DICE_ANIMATION_MS && diceAnimationFinal) return finishDiceAnimation();
        const rollingDice = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
        renderDice(rollingDice);
        const progress = Math.min(elapsed / DICE_ANIMATION_MS, 1);
        const nextDelay = 35 + Math.round(progress * progress * 75);
        diceAnimationTimer = setTimeout(() => runDiceFrame(animationToken), nextDelay);
    }

    function beginDiceAnimation(finalValues = null, rollKey = '') {
        const finalDice = normalizeDice(finalValues);
        if (rollKey && rollKey === latestRollKey) {
            if (finalDice) diceAnimationFinal = finalDice;
            return;
        }
        if (rollKey) latestRollKey = rollKey;
        if (isDiceAnimating) {
            if (finalDice) diceAnimationFinal = finalDice;
            return;
        }
        if (diceAnimationTimer) clearTimeout(diceAnimationTimer);
        diceAnimationFinal = finalDice;
        diceAnimationStartedAt = Date.now();
        isDiceAnimating = true;
        const animationToken = ++diceAnimationToken;
        render();
        runDiceFrame(animationToken);
    }

    function cancelDiceAnimation() {
        if (diceAnimationTimer) clearTimeout(diceAnimationTimer);
        diceAnimationTimer = null;
        diceAnimationToken += 1;
        diceAnimationFinal = null;
        isDiceAnimating = false;
        isRollPending = false;
        pendingMovement = null;
        render();
    }

    function movementPath(from, to, direction = 1) {
        const start = Number(from);
        const target = Number(to);
        if (!Number.isInteger(start) || !Number.isInteger(target) || start === target) return [];
        const stepDirection = direction < 0 ? -1 : 1;
        const distance = stepDirection > 0
            ? (target - start + BOARD_TILE_COUNT) % BOARD_TILE_COUNT
            : (start - target + BOARD_TILE_COUNT) % BOARD_TILE_COUNT;
        if (!distance || distance > BOARD_TILE_COUNT - 1) return [start, target];
        return Array.from({ length: distance + 1 }, (_, index) => (start + stepDirection * index + BOARD_TILE_COUNT * 2) % BOARD_TILE_COUNT);
    }

    function movementRequest(previousState, nextState) {
        if (!previousState?.players || !nextState?.players) return null;
        const preferredPlayerId = nextState.lastAction?.playerId || null;
        const changed = nextState.players.find(player => {
            if (player.isBankrupt) return false;
            if (preferredPlayerId && player.id !== preferredPlayerId) return false;
            const previous = previousState.players.find(candidate => candidate.id === player.id);
            return previous && previous.position !== player.position;
        }) || nextState.players.find(player => {
            if (player.isBankrupt) return false;
            const previous = previousState.players.find(candidate => candidate.id === player.id);
            return previous && previous.position !== player.position;
        });
        if (!changed) return null;
        const previousPlayer = previousState.players.find(player => player.id === changed.id);
        const currentVisualPosition = movementAnimation?.playerId === changed.id
            ? visualPositions.get(changed.id)
            : previousPlayer.position;
        const cardDirection = nextState.lastEvent?.kind === 'move_steps' && Number(nextState.lastEvent.steps) < 0 ? -1 : 1;
        const path = movementPath(currentVisualPosition, changed.position, cardDirection);
        if (path.length < 2) return null;
        return {
            key: `${changed.id}:${previousPlayer.position}:${changed.position}:${nextState.lastAction?.message || ''}`,
            playerId: changed.id,
            path,
        };
    }

    function finishMovementAnimation(animationToken) {
        if (animationToken !== movementAnimationToken) return;
        if (movementAnimationTimer) clearTimeout(movementAnimationTimer);
        movementAnimationTimer = null;
        if (movementAnimation) visualPositions.set(movementAnimation.playerId, movementAnimation.path[movementAnimation.path.length - 1]);
        movementAnimation = null;
        isMoveAnimating = false;
        render();
    }

    function advanceMovementAnimation(animationToken) {
        if (animationToken !== movementAnimationToken || !movementAnimation) return;
        if (movementAnimation.index >= movementAnimation.path.length - 1) return finishMovementAnimation(animationToken);
        movementAnimation.index += 1;
        visualPositions.set(movementAnimation.playerId, movementAnimation.path[movementAnimation.index]);
        render();
        movementAnimationTimer = setTimeout(() => advanceMovementAnimation(animationToken), MOVE_STEP_MS);
    }

    function startMovementAnimation(request) {
        if (!request || request.path.length < 2) return false;
        if (movementAnimationTimer) clearTimeout(movementAnimationTimer);
        movementAnimationToken += 1;
        visualPositions.set(request.playerId, request.path[0]);
        movementAnimation = { ...request, index: 0 };
        isMoveAnimating = true;
        const animationToken = movementAnimationToken;
        movementAnimationTimer = setTimeout(() => advanceMovementAnimation(animationToken), MOVE_STEP_MS);
        render();
        return true;
    }

    function displayedPosition(player) {
        if (movementAnimation?.playerId === player.id) return movementAnimation.path[movementAnimation.index];
        return visualPositions.get(player.id) ?? player.position;
    }

    function syncVisualPositions(nextState) {
        const activeIds = new Set((nextState.players || []).map(player => player.id));
        for (const id of visualPositions.keys()) if (!activeIds.has(id)) visualPositions.delete(id);
        for (const player of nextState.players || []) {
            if (!visualPositions.has(player.id)) visualPositions.set(player.id, player.position);
        }
    }

    function render() {
        if (!state) return;
        if (followPlayerPosition) {
            const focusPlayer = state.players?.find(player => player.id === state.myId && !player.isBankrupt)
                || state.players?.find(player => player.id === state.currentTurn && !player.isBankrupt)
                || state.players?.find(player => !player.isBankrupt);
            if (focusPlayer) selectedTile = displayedPosition(focusPlayer);
        }
        if (!state.board?.[selectedTile]) selectedTile = 0;

        const ended = state.status === 'ended';
        const phase = phaseInfo();
        const rules = state.rules || {};
        const houses = rules.housesAvailable ?? 32;
        const hotels = rules.hotelsAvailable ?? 12;

        root.classList.toggle('is-my-turn', Boolean(state.myTurn));
        root.classList.toggle('is-ended', ended);
        root.classList.toggle('is-auction', state.phase === 'auction');
        root.classList.toggle('is-animating', isDiceAnimating || isMoveAnimating || isRollPending);
        $('turn').innerHTML = ended
            ? `<span class="mono-live-dot ended"></span>${esc(state.winner?.name || '本局结束')} 获胜`
            : `<span class="mono-live-dot"></span>${state.myTurn ? '你的回合' : `${esc(state.currentTurnName || '其他玩家')}的回合`}<small>第 ${state.turnNumber || 1} 回合</small>`;
        $('phase').textContent = phase.label;
        $('phaseShort').textContent = phase.short;
        $('turnNumber').textContent = String(state.turnNumber || 1).padStart(2, '0');
        $('houses').textContent = String(houses);
        $('hotels').textContent = String(hotels);
        $('boardRound').textContent = `ROUND ${String(state.turnNumber || 1).padStart(2, '0')}`;
        $('bankStatus').textContent = `${houses} 栋房屋 · ${hotels} 间酒店`;
        $('eventBadge').textContent = state.lastEvent?.title || phase.short;
        $('commandTitle').textContent = isDiceAnimating
            ? '骰子滚动中…'
            : isMoveAnimating
                ? '棋子逐格移动中…'
                : phase.title;
        $('commandHint').textContent = isDiceAnimating
            ? '请等待骰子停下，棋子会沿路线逐格前进。'
            : isMoveAnimating
                ? '请等待棋子完成这一回合的移动。'
                : phase.hint;
        $('commandState').textContent = ended ? 'CLOSED' : state.myTurn ? 'YOUR TURN' : 'WAITING';

        renderEvent();
        renderDice();
        renderTiles();
        renderPlayers();
        updateTokenMenu();
        renderActions();
        renderInspector();
        renderMobileNavigator();
        renderLog();
    }

    function phaseInfo() {
        if (!state || state.status === 'waiting') return { short: '等待开局', label: '等待开局', title: '等待房主开始游戏', hint: '游戏开始后，第一位玩家可以掷骰子。' };
        if (state.status === 'ended') return { short: '已结束', label: '本局已结束', title: `${state.winner?.name || '本局'}赢得城市`, hint: '本局资产已经结算，棋盘保留供复盘查看。' };
        if (state.phase === 'auction') {
            const auctionName = state.auction?.tileName || '这块地产';
            return state.myTurn
                ? { short: '公开拍卖', label: '轮到你竞价', title: `竞拍 ${auctionName}`, hint: '输入高于当前最高价的整数，或选择放弃竞拍。' }
                : { short: '公开拍卖', label: `${state.currentTurnName || '其他玩家'}竞价中`, title: `等待 ${state.currentTurnName || '其他玩家'}`, hint: `${auctionName} 正在公开拍卖，当前最高价为 ${money(state.auction?.highestBid)}。` };
        }
        if (state.phase === 'property_decision') return { short: '地产决策', label: '需要决定地产归属', title: state.myTurn ? '决定这块地产' : '等待地产决定', hint: state.myTurn ? '按标价购买，或放弃购买并将它送入公开拍卖。' : '落地玩家需要先决定是否购买这块地产。' };
        if (state.phase === 'jail_decision') return { short: '拘留所', label: '处理拘留状态', title: state.myTurn ? '离开拘留所' : '等待离开拘留所', hint: state.myTurn ? '支付保释金、使用出狱卡，或尝试掷出对子。' : '当前玩家正在处理拘留状态。' };
        if (state.phase === 'turn_complete') return { short: '行动完成', label: '可以整理资产', title: state.myTurn ? '整理你的资产' : '等待结束回合', hint: state.myTurn ? '可以建造、出售建筑、抵押或赎回地产，然后结束回合。' : '当前玩家正在整理本回合资产。' };
        return state.myTurn
            ? { short: '等待掷骰', label: '轮到你行动', title: '开始你的回合', hint: '掷出两枚骰子，沿着城市路线前进。' }
            : { short: '等待掷骰', label: `${state.currentTurnName || '其他玩家'}行动中`, title: `等待 ${state.currentTurnName || '其他玩家'}`, hint: '你可以查看棋盘格和玩家资产，等待回合轮转。' };
    }

    function renderEvent() {
        const event = state.lastEvent;
        const lastAction = state.lastAction;
        if (event) {
            $('eventCard').innerHTML = `<span class="mono-event-label">CITY EVENT</span><strong>${esc(event.title || '城市事件')}</strong><p>${esc(event.text || '')}</p>`;
            return;
        }
        $('eventCard').innerHTML = `<span class="mono-event-label">${state.status === 'ended' ? 'CITY CLOSED' : 'TABLE NOTE'}</span><strong>${esc(state.status === 'ended' ? '城市账本已封存' : lastAction?.message || '等待第一掷')}</strong><p>${esc(state.status === 'ended' ? `${state.winner?.name || '最后的玩家'} 成为城市赢家。` : lastAction?.message ? '行动结果已记录在右侧账本。' : '掷出骰子，开始你的城市路线。')}</p>`;
    }

    function renderTiles() {
        boardEl.querySelectorAll('.mono-tile').forEach(tileEl => {
            const tile = state.board[Number(tileEl.dataset.index)];
            if (!tile) return;
            const occupant = state.players.filter(player => displayedPosition(player) === tile.index && !player.isBankrupt);
            const owner = tile.ownerId ? state.players.find(player => player.id === tile.ownerId) : null;
            const kind = tile.type === 'property' ? (tile.group === 'transit' ? 'transit' : tile.group === 'utility' ? 'utility' : 'property') : tile.type;
            const visibleOccupants = occupant.slice(0, 2);
            const tokens = visibleOccupants.map(player => `<i class="mono-token-piece ${player.id === state.currentTurn ? 'is-current' : ''} ${movementAnimation?.playerId === player.id && isMoveAnimating ? 'is-moving' : ''}" style="--token:${esc(player.color)}" title="${esc(player.name)}"><img src="${tokenArt(player)}" alt="" aria-hidden="true" draggable="false"></i>`).join('');
            const tokenOverflow = occupant.length > visibleOccupants.length
                ? `<b class="mono-token-more" title="${esc(occupant.slice(visibleOccupants.length).map(player => player.name).join('、'))}">+${occupant.length - visibleOccupants.length}</b>`
                : '';
            const ownerMark = owner ? `<span class="mono-owner-mark" style="--token:${esc(owner.color)}" title="${esc(owner.name)}">${esc(firstCharacter(owner.name))}</span>` : '';
            const propertyBody = tile.type === 'property'
                ? `<span class="mono-tile-price">${money(tile.price)}</span><span class="mono-buildings">${buildingMarkup(tile)}</span>`
                : `<strong class="mono-tile-symbol">${tileSymbol(tile.type)}</strong><span class="mono-tile-type">${esc(TYPE_LABELS[tile.type] || '城市格')}</span>`;
            tileEl.className = `mono-tile mono-type-${kind} ${selectedTile === tile.index ? 'is-inspected' : ''} ${tile.ownerId ? 'is-owned' : ''} ${tile.mortgaged ? 'is-mortgaged' : ''} ${occupant.length ? 'has-player' : ''}`;
            tileEl.setAttribute('aria-label', `${tile.name}${tile.ownerName ? `，归 ${tile.ownerName} 所有` : ''}`);
            tileEl.setAttribute('aria-current', selectedTile === tile.index ? 'location' : 'false');
            tileEl.innerHTML = `<span class="mono-tile-band" style="--tile-color:${esc(tile.color || '#8f9a8d')}"></span><span class="mono-tile-name">${esc(tile.name)}</span>${propertyBody}${ownerMark}<span class="mono-tokens">${tokens}${tokenOverflow}</span>`;
        });
    }

    function renderPlayers() {
        playersEl.innerHTML = (state.players || []).map((player, index) => {
            const current = player.isCurrentTurn || player.id === state.currentTurn;
            const status = player.isBankrupt ? '已破产' : movementAnimation?.playerId === player.id && isMoveAnimating ? '逐格移动中' : player.inJail ? `拘留所 · 第 ${player.jailTurns || 0} 次` : current ? '正在行动' : `${player.position} 号格`;
            return `<article class="mono-player ${current ? 'is-current' : ''} ${player.isBankrupt ? 'is-bankrupt' : ''}">
                <span class="mono-player-index">${String(index + 1).padStart(2, '0')}</span>
                <span class="mono-avatar" style="--token:${esc(player.color)}" title="${esc(player.name)}"><img src="${tokenArt(player)}" alt="" aria-hidden="true" draggable="false"></span>
                <div class="mono-player-copy"><strong>${esc(player.name)}${player.id === state.myId ? ' · 我' : ''}</strong><small>${esc(status)}</small><span>${player.propertyCount || 0} 处地产 · ${player.jailCardCount || 0} 张出狱卡</span></div>
                <div class="mono-player-cash"><small>现金</small><b>${money(player.cash)}</b></div>
            </article>`;
        }).join('') || '<div class="mono-empty">等待玩家入座</div>';
    }

    function tokenArt(player) {
        const playerIndex = (state?.players || []).findIndex(candidate => candidate.id === player?.id);
        const tokenStyle = PLAYER_TOKEN_ART[player?.tokenStyle] ? player.tokenStyle : '3d';
        const tokenSet = PLAYER_TOKEN_ART[tokenStyle];
        const tokenIndex = Number.isInteger(player?.tokenId) ? player.tokenId : playerIndex >= 0 ? playerIndex % tokenSet.length : 0;
        return tokenSet[tokenIndex];
    }

    function renderActions() {
        const available = state.availableActions || {};
        const locked = isDiceAnimating || isMoveAnimating || isRollPending;
        if (locked) {
            actionsEl.innerHTML = `<div class="mono-waiting-note"><span class="mono-action-mark" aria-hidden="true">${isDiceAnimating ? '⚄' : '·'}</span><div><strong>${isDiceAnimating ? '骰子滚动中' : '棋子逐格移动中'}</strong><small>动画完成后再继续操作。</small></div></div>`;
            return;
        }
        if (state.phase === 'auction') {
            const auction = state.auction || {};
            const passedNames = (auction.passed || []).map(id => state.players.find(player => player.id === id)?.name).filter(Boolean).join('、');
            actionsEl.innerHTML = `<div class="mono-auction-card">
                <div class="mono-auction-copy"><span class="mono-kicker">PUBLIC AUCTION</span><h3>${esc(auction.tileName || '地产')}</h3><p>最高出价 <b>${money(auction.highestBid)}</b> · ${esc(auction.currentBidderName || '等待玩家')} 行动</p>${passedNames ? `<small>已放弃：${esc(passedNames)}</small>` : ''}</div>
                <label class="mono-bid-field"><span>你的出价</span><input data-auction-amount type="number" inputmode="numeric" min="${available.auctionMinBid || 1}" placeholder="至少 ${available.auctionMinBid || 1}" ${available.canAuctionBid && !locked ? '' : 'disabled'}></label>
                <div class="mono-auction-actions"><button class="mono-action-primary" data-action="bidProperty" type="button" ${available.canAuctionBid && !locked ? '' : 'disabled'}>出价 <small>确认金额</small></button><button class="mono-action-quiet" data-action="passAuction" type="button" ${available.canAuctionPass && !locked ? '' : 'disabled'}>放弃竞拍</button></div>
            </div>`;
            return;
        }

        const pendingTile = state.board?.[state.pendingPurchase?.tileIndex];
        const buttons = [
            actionButton('rollDice', '掷骰子', state.dice ? state.dice.join(' + ') : '两枚骰子', available.canRoll, 'mono-action-primary'),
            actionButton('buyProperty', '购买地产', pendingTile ? `${pendingTile.name} · ${money(pendingTile.price)}` : '等待可购买地产', available.canBuy),
            actionButton('passProperty', '进入拍卖', pendingTile ? `放弃 ${pendingTile.name}` : '放弃当前地产', available.canPass),
            actionButton('payBail', '支付保释', '¥50 离开拘留所', available.canPayBail),
            actionButton('rollForDoubles', '掷对子离开', '最多尝试三次', available.canRollForDoubles),
            actionButton('useJailCard', '使用出狱卡', '免费离开拘留所', available.canUseJailCard),
            actionButton('endTurn', '结束回合', state.extraTurn ? '保留额外回合' : '轮到下一位玩家', available.canEndTurn, 'mono-action-quiet'),
        ];
        const management = [
            ...(available.buildableTiles || []).map(index => tileAction('buildHouse', '建造', state.board[index], `¥${state.board[index]?.buildCost || 0}`)),
            ...(available.sellableTiles || []).map(index => tileAction('sellBuilding', '出售建筑', state.board[index], `收回 ¥${Math.floor((state.board[index]?.buildCost || 0) / 2)}`)),
            ...(available.mortgageableTiles || []).map(index => tileAction('mortgageProperty', '抵押', state.board[index], money(state.board[index]?.mortgageValue))),
            ...(available.unmortgageableTiles || []).map(index => tileAction('unmortgageProperty', '赎回', state.board[index], `支付 ${money(Math.ceil((state.board[index]?.price || 0) * .55))}`)),
        ];
        const hasTurnAction = ['canRoll', 'canBuy', 'canPass', 'canPayBail', 'canRollForDoubles', 'canUseJailCard', 'canEndTurn'].some(key => available[key]);
        if (!hasTurnAction && !management.length) {
            actionsEl.innerHTML = `<div class="mono-waiting-note"><span class="mono-action-mark" aria-hidden="true">…</span><div><strong>${state.status === 'ended' ? '本局已经结束' : '等待当前玩家完成行动'}</strong><small>${state.status === 'ended' ? '仍可点击棋盘格复盘地产状态。' : '轮到你时，合法操作会自动出现在这里。'}</small></div></div>`;
            return;
        }
        actionsEl.innerHTML = `<div class="mono-action-group"><span class="mono-action-group-label">回合动作</span><div class="mono-action-grid">${buttons.join('')}</div></div>${management.length ? `<div class="mono-action-group mono-management"><span class="mono-action-group-label">资产整理</span><div class="mono-action-grid">${management.join('')}</div></div>` : ''}`;
    }

    function canSubmitAction(enabled) {
        return Boolean(enabled && !isDiceAnimating && !isMoveAnimating && !isRollPending);
    }

    function actionButton(kind, label, detail, enabled, className = '') {
        return `<button class="mono-action ${className}" data-action="${kind}" type="button" ${canSubmitAction(enabled) ? '' : 'disabled'}><span class="mono-action-mark" aria-hidden="true">${actionMark(kind)}</span><span><strong>${esc(label)}</strong><small>${esc(detail)}</small></span></button>`;
    }

    function tileAction(kind, label, tile, detail) {
        if (!tile) return '';
        const selected = selectedTile === tile.index ? ' is-highlighted' : '';
        return `<button class="mono-action mono-action-asset${selected}" data-action="${kind}" data-tile-index="${tile.index}" type="button" ${canSubmitAction(true) ? '' : 'disabled'}><span class="mono-action-mark" aria-hidden="true">${kind === 'buildHouse' ? '＋' : kind === 'sellBuilding' ? '−' : kind === 'mortgageProperty' ? '↘' : '↗'}</span><span><strong>${esc(label)} · ${esc(tile.name)}</strong><small>${esc(detail)}</small></span></button>`;
    }

    function renderInspector() {
        const tile = state.board?.[selectedTile];
        if (!tile) return;
        const owner = tile.ownerName ? `归 ${tile.ownerName} 所有` : tile.type === 'property' ? '尚未出售' : '公共功能格';
        const isProperty = tile.type === 'property';
        const rent = isProperty ? (tile.currentRent || tile.rents?.[0] || 0) : 0;
        const typeLabel = isProperty ? (GROUP_LABELS[tile.group] || '地产') : (TYPE_LABELS[tile.type] || '城市格');
        const status = tile.mortgaged ? '已抵押 · 暂不收租' : tile.houses >= 5 ? '酒店' : isProperty && tile.houses ? `${tile.houses} 栋房屋` : '无建筑';
        $('inspector').innerHTML = `<div class="mono-inspector-content"><div class="mono-inspector-heading"><div><span class="mono-kicker">TILE ${String(tile.index).padStart(2, '0')} · ${esc(typeLabel)}</span><h2>${esc(tile.name)}</h2></div><span class="mono-inspector-owner">${esc(owner)}</span></div>${isProperty ? `<div class="mono-deed-strip" style="--tile-color:${esc(tile.color || '#8f9a8d')}"><span></span><strong>${esc(typeLabel)}</strong><small>${tile.mortgaged ? '抵押中' : '城市地产'}</small></div><div class="mono-inspector-stats"><div><small>标价</small><b>${money(tile.price)}</b></div><div><small>当前租金</small><b>${money(rent)}</b></div><div><small>状态</small><b>${esc(status)}</b></div></div><p class="mono-inspector-note">${tile.houses >= 5 ? '酒店已建成，租金按酒店档位结算。' : tile.houses ? '建筑会提升这块地产的租金。' : tile.group === 'transit' ? '拥有更多车站会提高租金。' : tile.group === 'utility' ? '租金根据最近一次骰子总点数计算。' : '点击棋盘格或操作区，继续管理这块地产。'}</p>` : `<div class="mono-special-tile"><strong>${tileSymbol(tile.type)}</strong><div><b>${esc(typeLabel)}</b><small>落点结果会显示在行动记录和城市事件中。</small></div></div>`}</div>`;
    }

    function renderMobileNavigator() {
        const tile = state.board?.[selectedTile];
        if (!tile) return;
        const isProperty = tile.type === 'property';
        const typeLabel = isProperty ? (GROUP_LABELS[tile.group] || '地产') : (TYPE_LABELS[tile.type] || '城市格');
        const owner = tile.ownerName ? `归 ${tile.ownerName} 所有` : isProperty ? '尚未出售' : '公共功能格';
        const rent = isProperty ? (tile.currentRent || tile.rents?.[0] || 0) : 0;
        const status = tile.mortgaged ? '已抵押' : tile.houses >= 5 ? '酒店' : tile.houses ? `${tile.houses} 栋房屋` : '无建筑';
        const occupants = (state.players || []).filter(player => displayedPosition(player) === tile.index && !player.isBankrupt);
        const occupantText = occupants.length ? `停留：${occupants.map(player => player.name).join('、')}` : '当前没有玩家停留';
        const specialValue = tile.type === 'tax' ? money(tile.amount) : tile.type === 'start' ? '+¥200' : '落点触发';

        $('mobileInspector').innerHTML = `<header><div><span>第 ${String(tile.index).padStart(2, '0')} 站 · ${esc(typeLabel)}</span><strong>${esc(tile.name)}</strong></div><small>${esc(owner)}</small></header><div class="mono-mobile-place-stats">${isProperty ? `<div><small>标价</small><b>${money(tile.price)}</b></div><div><small>当前租金</small><b>${money(rent)}</b></div><div><small>建筑</small><b>${esc(status)}</b></div>` : `<div><small>类型</small><b>${esc(typeLabel)}</b></div><div><small>落点</small><b>${esc(specialValue)}</b></div><div><small>位置</small><b>${tile.index} / ${BOARD_TILE_COUNT - 1}</b></div>`}</div><p>${esc(occupantText)}</p>`;

        const signature = state.board.map(boardTile => `${boardTile.index}:${boardTile.name}`).join('|');
        if (signature !== mobileBoardSignature) {
            mobileBoardSignature = signature;
            mobileTileSelectEl.innerHTML = state.board.map(boardTile => `<option value="${boardTile.index}">${String(boardTile.index).padStart(2, '0')} · ${esc(boardTile.name)}</option>`).join('');
        }
        mobileTileSelectEl.value = String(tile.index);
        followPositionButtonEl.setAttribute('aria-pressed', String(followPlayerPosition));
        followPositionButtonEl.classList.toggle('is-active', followPlayerPosition);
    }

    function renderLog() {
        const entries = (state.actionLog || []).slice().reverse();
        $('log').innerHTML = entries.length ? entries.map((entry, index) => `<div class="mono-log-entry ${index === 0 ? 'is-latest' : ''}"><i aria-hidden="true"></i><span>${esc(entry)}</span></div>`).join('') : '<p class="mono-log-empty">第一项行动完成后，记录会出现在这里。</p>';
    }

    function buildBoard() {
        const percent = value => `${(value / BOARD_IMAGE_SIZE * 100).toFixed(6)}%`;
        const cells = BOARD_RECTS.map((rect, index) => `<button class="mono-tile" data-index="${index}" data-edge="${rect.edge}" style="left:${percent(rect.x)};top:${percent(rect.y)};width:${percent(rect.width)};height:${percent(rect.height)}" type="button"></button>`).join('');
        boardEl.insertAdjacentHTML('afterbegin', cells);
    }

    function setRules(open) {
        rulesOpen = open;
        overlay.classList.toggle('is-hidden', !open);
        overlay.setAttribute('aria-hidden', String(!open));
    }

    buildBoard();
    mount.addEventListener('click', event => {
        const ui = event.target.closest('[data-ui]')?.dataset.ui;
        if (ui === 'selectTokenStyle') {
            selectTokenStyle(event.target.closest('[data-ui]').dataset.tokenStyle);
            return;
        }
        if (ui === 'toggleTokenMenu') {
            if (!tokenMenuOpen) setSkinMenu(false);
            setTokenMenu(!tokenMenuOpen);
            return;
        }
        if (ui === 'selectToken') {
            selectTokenSkin(event.target.closest('[data-ui]').dataset.tokenId);
            return;
        }
        if (ui === 'toggleSkinMenu') {
            if (!skinMenuOpen) setTokenMenu(false);
            setSkinMenu(!skinMenuOpen);
            return;
        }
        if (ui === 'selectSkin') {
            selectBuiltInSkin(event.target.closest('[data-ui]').dataset.skinId);
            return;
        }
        if (ui === 'uploadSkin') {
            skinUploadEl.click();
            return;
        }
        if (ui === 'previousTile' || ui === 'nextTile') {
            const direction = ui === 'previousTile' ? -1 : 1;
            selectedTile = (selectedTile + direction + (state?.board?.length || BOARD_TILE_COUNT)) % (state?.board?.length || BOARD_TILE_COUNT);
            followPlayerPosition = false;
            render();
            return;
        }
        if (ui === 'followPosition') {
            followPlayerPosition = true;
            render();
            return;
        }
        if (skinMenuOpen && !event.target.closest('.mono-skin-switcher')) setSkinMenu(false);
        if (tokenMenuOpen && !event.target.closest('.mono-token-switcher')) setTokenMenu(false);

        const tile = event.target.closest('.mono-tile');
        if (tile && !event.target.closest('[data-action]')) {
            selectedTile = Number(tile.dataset.index);
            followPlayerPosition = false;
            render();
            return;
        }

        const actionButton = event.target.closest('[data-action]');
        if (actionButton) {
            const action = actionButton.dataset.action;
            if (isDiceAnimating || isMoveAnimating || isRollPending) return;
            const payload = { kind: action };
            if (['buildHouse', 'sellBuilding', 'mortgageProperty', 'unmortgageProperty'].includes(action)) payload.tileIndex = Number(actionButton.dataset.tileIndex);
            if (action === 'bidProperty') payload.amount = Number(mount.querySelector('[data-auction-amount]')?.value || 0);
            if (action === 'rollDice' || action === 'rollForDoubles') {
                isRollPending = true;
                beginDiceAnimation();
            }
            send({ type: 'gameAction', action: payload });
            return;
        }

        if (ui === 'rules') setRules(true);
        if (ui === 'closeRules' || event.target === overlay) setRules(false);

    }, { signal: controller.signal });

    mount.addEventListener('change', event => {
        if (event.target === mobileTileSelectEl) {
            selectedTile = Number(event.target.value);
            followPlayerPosition = false;
            render();
            return;
        }
        if (!event.target.matches('[data-role="skinUpload"]')) return;
        selectLocalSkin(event.target.files?.[0]);
        event.target.value = '';
    }, { signal: controller.signal });

    mount.addEventListener('keydown', event => {
        if (event.key === 'Escape' && skinMenuOpen) {
            setSkinMenu(false, true);
            return;
        }
        if (event.key === 'Escape' && tokenMenuOpen) {
            setTokenMenu(false, true);
            return;
        }
        if (event.key === 'Escape' && rulesOpen) {
            setRules(false);
            return;
        }
        if (event.key === 'Enter' && event.target.matches('[data-auction-amount]')) {
            event.preventDefault();
            mount.querySelector('[data-action="bidProperty"]')?.click();
        }
    }, { signal: controller.signal });

    return {
        gameType: 'monopoly',
        handleMessage(message) {
            if (message.type === 'error' && isRollPending) cancelDiceAnimation();
            if (message.state) {
                const previousState = state;
                const nextState = message.state;
                if (previousState && normalizeDice(previousState.dice) && !normalizeDice(nextState.dice)) idleDice = randomSumSevenDice();
                syncVisualPositions(nextState);
                state = nextState;

                const rollAction = ['rollDice', 'rollForDoubles'].includes(state.lastAction?.kind) ? state.lastAction : null;
                const rollValues = normalizeDice(rollAction?.dice) || (rollAction?.kind === 'rollForDoubles' ? normalizeDice(state.dice) : null);
                const rollKey = rollValues
                    ? String(rollAction?.rollId || `${rollAction?.kind || 'roll'}:${rollAction?.playerId || ''}:${rollValues.join('-')}:${state.turnNumber || 0}:${state.actionLog?.join('|') || ''}`)
                    : '';
                if (rollValues && !previousState) {
                    visibleDice = rollValues;
                    latestRollKey = rollKey;
                } else if (rollValues && isRollPending && isDiceAnimating) {
                    isRollPending = false;
                    latestRollKey = rollKey;
                    diceAnimationFinal = rollValues;
                } else if (rollValues) {
                    beginDiceAnimation(rollValues, rollKey);
                }

                const movement = movementRequest(previousState, state);
                if (movement && movement.key !== latestMoveKey) {
                    latestMoveKey = movement.key;
                    if (isDiceAnimating) pendingMovement = movement;
                    else startMovementAnimation(movement);
                }
                render();
            }
            if (message.type === 'error') addLog?.(message.message || '操作失败', 'error');
        },
        destroy() {
            controller.abort();
            if (diceAnimationTimer) clearTimeout(diceAnimationTimer);
            if (movementAnimationTimer) clearTimeout(movementAnimationTimer);
            diceAnimationTimer = null;
            movementAnimationTimer = null;
            diceAnimationToken += 1;
            movementAnimationToken += 1;
            movementAnimation = null;
            pendingMovement = null;
            isDiceAnimating = false;
            isMoveAnimating = false;
            revokeLocalSkin();
            document.body.classList.remove('is-monopoly-view');
            link.remove();
            mount.innerHTML = '';
        },
    };
}

function readStoredBoardSkin() {
    try {
        return window.localStorage?.getItem(BOARD_SKIN_STORAGE_KEY) || null;
    } catch {
        return null;
    }
}

function storeBoardSkin(skinId) {
    try {
        window.localStorage?.setItem(BOARD_SKIN_STORAGE_KEY, skinId);
    } catch {
        // Storage may be disabled in privacy mode; the current view still works.
    }
}

function readStoredTokenStyle() {
    try {
        return window.localStorage?.getItem(TOKEN_STYLE_STORAGE_KEY) || null;
    } catch {
        return null;
    }
}

function storeTokenStyle(style) {
    try {
        window.localStorage?.setItem(TOKEN_STYLE_STORAGE_KEY, style);
    } catch {
        // Storage may be disabled in privacy mode; the current view still works.
    }
}

function actionMark(kind) {
    return ({ rollDice: '⚄', buyProperty: '＋', passProperty: '↗', payBail: '¥', rollForDoubles: '⚄', useJailCard: '□', endTurn: '→' }[kind] || '·');
}

function tileSymbol(type) {
    return ({ start: 'GO', chance: '?', community_chest: '运', tax: '¥', jail: '囚', parking: 'P', go_to_jail: '→' }[type] || '·');
}

function buildingMarkup(tile) {
    if (tile.houses >= 5) return '<b class="mono-hotel" title="酒店">H</b>';
    return Array.from({ length: Math.min(tile.houses || 0, 4) }, () => '<i class="mono-house" aria-hidden="true"></i>').join('');
}

function firstCharacter(value) {
    return Array.from(String(value || '玩'))[0] || '玩';
}

function money(value) {
    return `¥${Number(value || 0).toLocaleString('zh-CN')}`;
}

function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
