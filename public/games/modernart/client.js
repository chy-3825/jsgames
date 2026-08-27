const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

const ARTISTS = [
    { id: 'matisse', name: '马蒂斯', mark: '马', color: '#e45f4f', style: '色块构成' },
    { id: 'cassat', name: '卡萨特', mark: '卡', color: '#dfaa43', style: '暖调人物' },
    { id: 'yoshida', name: '吉田', mark: '吉', color: '#4f8eae', style: '几何风景' },
    { id: 'bruegel', name: '勃鲁盖尔', mark: '勃', color: '#6d9b69', style: '乡野叙事' },
    { id: 'clyfford', name: '克里福特', mark: '克', color: '#8c659e', style: '抽象张力' },
];
const AUCTION_TYPES = {
    open: { mark: '声', label: '公开竞价', note: '可反复加价；放弃后退出' },
    once: { mark: '轮', label: '一轮竞价', note: '每人只有一次报价机会' },
    sealed: { mark: '密', label: '秘密竞价', note: '所有报价在落槌前隐藏' },
    fixed: { mark: '价', label: '定价拍卖', note: '首位接受者按标价买入' },
    double: { mark: '双', label: '双重拍卖', note: '同艺术家两幅一起拍卖' },
};

function artistMeta(id) { return ARTISTS.find(artist => artist.id === id) || { id, name: id || '未知', mark: '艺', color: '#71808c', style: '未知流派' }; }
function artVariant(card, fallback = 0) {
    const serial = Number(String(card?.id || '').match(/(\d+)$/)?.[1]);
    if (Number.isFinite(serial) && serial > 0) return ((serial - 1) % 5) + 1;
    const seed = `${card?.artistId || 'mystery'}:${fallback}`.split('').reduce((sum, character) => sum + character.charCodeAt(0), 0);
    return (seed % 5) + 1;
}
function artCanvas(card, fallback = 0, className = '') {
    return `<span class="art-frame ${className}" data-artist="${escapeHtml(card?.artistId || 'mystery')}"><i class="art-canvas" data-variant="${artVariant(card, fallback)}" aria-hidden="true"><b></b><em></em></i></span>`;
}
function cardBack(className = '') {
    return `<span class="art-card-back ${className}" aria-hidden="true"><i></i><b><span>MODERN</span><span>ART</span></b></span>`;
}
function cardBackFan(count) {
    const visible = Math.min(3, Math.max(0, Number(count) || 0));
    return `<span class="art-card-back-fan" aria-hidden="true">${Array.from({ length: visible }, () => cardBack('is-mini')).join('')}</span>`;
}
function auctionMeta(type) { return AUCTION_TYPES[type] || { mark: '拍', label: type || '拍卖', note: '' }; }

export function createGameClient({ mount, send, addLog }) {
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = '/games/modernart/style.css?v=20260826-mobile-shell-1';
    document.head.appendChild(style);

    let state = null;
    let interactionSignature = '';
    let handSelection = { primary: null, second: null };
    let pendingChoice = null;
    let fixedDraft = 20;
    let bidDraft = 1;
    let actionPending = false;
    let previousFocus = null;
    let presentationQueue = [];
    let presentationPlaying = false;
    let presentationToken = 0;
    let lastPresentationSequence = null;
    let waitTimer = null;
    let releaseWait = null;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    mount.innerHTML = `<section class="art-app">
        <header class="art-header">
            <div class="art-brand"><span class="art-mark" aria-hidden="true"><i></i><b></b></span><div><small>当代拍卖展厅</small><h1>现代艺术</h1></div></div>
            <div class="art-round" data-role="round">等待开幕</div>
            <div class="art-header-actions"><button type="button" data-ui="rules">规则</button></div>
        </header>
        <main class="art-layout">
            <section class="art-gallery">
                <div class="art-status" data-role="status"></div>
                <section class="art-artist-board"><header><div><span>艺术家行情</span><small>第五幅出现时立即结束本季</small></div><b>累计价值 / 本季出现</b></header><div data-role="artists"></div></section>
                <section class="art-showroom">
                    <section class="art-auction" data-role="auction"></section>
                    <section class="art-market"><header><div><span>本季成交墙</span><small>已进入收藏的作品</small></div><b data-role="marketCount"></b></header><div data-role="market"></div></section>
                </section>
                <section class="art-hand"><header><div><span>我的待拍作品</span><small>卡面角标决定拍卖方式</small></div><b data-role="handCount"></b></header><div data-role="hand"></div><div data-role="handDecision"></div></section>
                <section class="art-history"><header><span>季度档案</span><small>当季奖金与累计价值</small></header><div data-role="history"></div></section>
            </section>
            <aside class="art-ledger">
                <section class="art-panel art-wallet" data-role="wallet"></section>
                <section class="art-panel"><header class="art-panel-title"><span>收藏家席位</span><small>他人资金保持隐藏</small></header><div data-role="players"></div></section>
                <section class="art-panel art-collection"><header class="art-panel-title"><span>我的收藏</span><small>季末出售给银行</small></header><div data-role="collection"></div></section>
                <section class="art-panel"><header class="art-panel-title"><span>落槌记录</span><small>最新在前</small></header><div class="art-log" data-role="log"></div></section>
            </aside>
        </main>
        <div class="art-presentation-layer" data-role="presentationLayer" hidden aria-live="assertive">
            <div class="art-presentation-shade"></div>
            <svg class="art-action-line" data-role="actionLine" aria-hidden="true"><line x1="0" y1="0" x2="0" y2="0"></line><circle cx="0" cy="0" r="5"></circle></svg>
            <section class="art-presentation-scene" data-role="presentationScene"></section>
            <div class="art-floating-layer" data-role="floatingLayer" aria-hidden="true"></div>
            <button class="art-presentation-skip" type="button" data-ui="skipPresentation">跳过演出</button>
        </div>
        <div class="art-overlay is-hidden" data-role="rulesOverlay" role="dialog" aria-modal="true" aria-labelledby="art-rules-title">
            <article><button class="art-close" type="button" data-ui="closeRules" aria-label="关闭规则">×</button><span class="art-kicker">拍卖手册</span><h2 id="art-rules-title">现代艺术规则</h2>
                <ol><li>共 70 张作品。3/4/5 人首季分别发 10/9/8 张，后续三季分别补 6/4/3、6/4/3、0 张。</li><li>每张作品指定公开、一轮、秘密、定价或双重拍卖。卖家选择作品；买家将成交价支付给卖家，卖家自己买入则支付银行。</li><li>某艺术家的第五幅作品出现时立即结束本季；第五幅不拍卖，双重拍卖也可能两幅都不成交。</li><li>本季出现次数前三的艺术家获得 30/20/10 价值，平手按艺术家顺序。进入前三者按历季累计价值结算收藏，其他艺术家本季价值为零。</li><li>四季结束后现金最多者获胜。所有玩家的手牌、收藏和现金均按服务端权限过滤。</li><li>三人神秘玩家变体按四人份发牌；卖家每次拍卖后可随机翻开一张只计出现次数、不参与拍卖的神秘作品。</li></ol>
                <figure class="art-art-reference"><img src="/assets/bgg/modernart/detail.jpg" alt="现代艺术作品牌、画廊和拍卖组件参考图" loading="lazy"><figcaption>实体组件参考 · 线上作品与拍卖信息依据实时状态重绘</figcaption></figure>
            </article>
        </div>
    </section>`;

    const $ = role => mount.querySelector(`[data-role="${role}"]`);
    const actions = () => state?.availableActions || {};
    const myPlayer = () => state?.players?.find(player => player.id === state.myId);
    const phaseLabel = () => ({ auction: '选择作品', double_offer: '补充双重作品', mystery_offer: '神秘作品', bidding: '竞价进行中', ended: '最终结算' })[state?.phase] || '等待开幕';

    function signature(next) {
        const auction = next.auction;
        const hand = (next.myHand || []).map(card => card.id).join(',');
        const counts = Object.values(next.roundCounts || {}).join(',');
        return [next.status, next.phase, next.round, next.currentTurn, auction?.type, auction?.highestBid, auction?.highestBidder, auction?.bidCount, auction?.passed?.length, next.doubleOffer?.passed?.length, next.mysteryOffer?.remaining, next.myCash, hand, next.market?.length, counts].join('|');
    }

    function resetInteraction() {
        actionPending = false;
        handSelection = { primary: null, second: null };
        pendingChoice = null;
        fixedDraft = Math.max(1, Math.min(20, Number(state?.myCash || 1)));
        const auction = state?.auction;
        bidDraft = auction?.type === 'fixed' ? Number(auction.fixedPrice || 0) : Math.max(1, Number(auction?.highestBid || 0) + 1);
    }

    function statusText() {
        if (state.status === 'ended') return `${escapeHtml(state.winner?.name || '本局结束')} 以 ${state.winner?.cash ?? '—'} 元赢得拍卖季`;
        if (state.phase === 'auction') return actions().startAuction ? '从手牌中策划下一场拍卖' : `${escapeHtml(state.currentTurnName || '卖家')} 正在选择作品`;
        if (state.phase === 'double_offer') return actions().offerSecond ? '你可以补上一幅同艺术家的作品' : `等待 ${escapeHtml(state.currentTurnName || '收藏家')} 决定是否补画`;
        if (state.phase === 'mystery_offer') return actions().revealMystery ? '决定是否翻开一张神秘作品' : '等待神秘作品决策';
        if (state.phase === 'bidding') return actions().bid ? '轮到你报价或放弃' : `${escapeHtml(state.currentTurnName || '收藏家')} 正在报价`;
        return '展厅正在准备下一场拍卖';
    }

    function render() {
        if (!state) return;
        $('round').textContent = state.status === 'ended' ? '四季落幕' : `第 ${state.round} / ${state.maxRounds} 季 · ${phaseLabel()}`;
        $('status').innerHTML = `<div><span class="art-kicker">${phaseLabel()}</span><h2>${statusText()}</h2></div><p>${state.currentTurnName ? `当前操作 · ${escapeHtml(state.currentTurnName)}` : '等待下一锤'}</p>`;
        renderArtists(); renderAuction(); renderMarket(); renderHand(); renderHistory(); renderWallet(); renderPlayers(); renderCollection(); renderLog();
    }

    function renderArtists() {
        const counts = state.roundCounts || {};
        $('artists').innerHTML = ARTISTS.map(artist => {
            const count = Number(counts[artist.id] || 0);
            const value = Number(state.artistValues?.[artist.id] || 0);
            return `<article class="art-artist" data-artist-id="${artist.id}" style="--artist:${artist.color}"><i>${artist.mark}</i><div><strong>${artist.name}</strong><small>${artist.style}</small></div><b>${value}</b><span>${Array.from({ length: 5 }, (_, index) => `<em class="${index < count ? 'is-filled' : ''}"></em>`).join('')}<small>${count} / 5</small></span></article>`;
        }).join('');
    }

    function pendingConfirmation(text, warning = false) {
        return `<div class="art-confirm ${warning ? 'is-warning' : ''}"><div><span>待确认</span><strong>${text}</strong></div><div><button type="button" data-ui="cancelChoice" ${presentationPlaying ? 'disabled' : ''}>取消</button><button class="art-primary" type="button" data-ui="confirmChoice" ${presentationPlaying ? 'disabled' : ''}>确认执行</button></div></div>`;
    }

    function renderAuction() {
        const auction = state.auction;
        const double = state.doubleOffer;
        const mystery = state.mysteryOffer;
        if (double) {
            const meta = artistMeta(double.artistId);
            let html = `<div class="art-stage-work" data-stage-anchor style="--artist:${meta.color}" data-artist="${meta.id}">${artCanvas({ artistId: meta.id }, state.round, 'is-stage')}<span class="art-method" data-type="double"><i>双</i>双重拍卖</span></div><div class="art-stage-copy"><span class="art-kicker">等待第二幅作品</span><h3>${meta.name}</h3><p>${escapeHtml(double.originalSellerName || '')} 打出了双重作品；${escapeHtml(double.currentPlayerName || '')} 可以提供同艺术家的非双重作品。</p><small>${double.passed?.length || 0} 人已跳过</small>`;
            if (actions().passSecond) html += '<button class="art-secondary" type="button" data-choice="passSecond">选择跳过提供</button>';
            if (pendingChoice?.kind === 'passSecond') html += pendingConfirmation('不提供第二幅作品，询问下一位收藏家', true);
            $('auction').innerHTML = `${html}</div>`;
            return;
        }
        if (mystery) {
            let html = `<div class="art-stage-work is-mystery" data-stage-anchor data-artist="mystery">${cardBack('is-stage-back')}<span class="art-method"><i>秘</i>神秘作品</span></div><div class="art-stage-copy"><span class="art-kicker">三人可选变体</span><h3>神秘藏家的手牌</h3><p>随机翻开的作品计入本季出现次数，但不会拍卖或进入任何人的收藏。</p><small>剩余 ${mystery.remaining} 张</small>`;
            if (actions().revealMystery) html += '<div class="art-choice-row"><button type="button" data-choice="revealMystery">选择翻开</button><button type="button" data-choice="skipMystery">选择跳过</button></div>';
            if (pendingChoice?.kind === 'revealMystery') html += pendingConfirmation('随机翻开一张神秘作品；若成为某艺术家第五幅，本季将立即结束', true);
            if (pendingChoice?.kind === 'skipMystery') html += pendingConfirmation('跳过本次神秘作品机会', true);
            $('auction').innerHTML = `${html}</div>`;
            return;
        }
        if (!auction) {
            $('auction').innerHTML = '<div class="art-stage-empty" data-stage-anchor><i></i><span>中央展台</span><strong>等待下一幅作品</strong><small>卖家选画后，拍卖方式与行动会在这里展开。</small></div>';
            return;
        }
        const type = auctionMeta(auction.type);
        const meta = artistMeta(auction.artistId);
        const works = (auction.artists || [auction.artist]).map((name, index) => artCanvas({ artistId: auction.artistId, artistName: name }, state.round * 5 + index, `is-stage ${index ? 'is-second' : ''}`)).join('');
        let current = auction.type === 'sealed'
            ? `${auction.bidCount || 0} / ${state.players?.length || 0} 人已密封报价`
            : auction.type === 'fixed'
                ? `定价 ${auction.fixedPrice} 元`
                : `当前最高 ${auction.highestBid} 元`;
        if (auction.highestBidder && auction.type !== 'sealed') current += ` · ${escapeHtml(state.players?.find(player => player.id === auction.highestBidder)?.name || '')}`;
        let controls = '';
        if (actions().bid) {
            if (auction.type === 'fixed') {
                controls = `<div class="art-choice-row"><button type="button" data-choice="acceptFixed">选择按 ${auction.fixedPrice} 元买入</button><button type="button" data-choice="passBid">选择放弃</button></div>`;
            } else {
                const minimum = auction.type === 'sealed' ? 1 : Number(auction.highestBid || 0) + 1;
                controls = `<div class="art-bid-line"><label>${auction.type === 'sealed' ? '我的秘密报价' : '我的报价'}<input data-draft="bid" type="number" min="${minimum}" max="${state.myCash}" value="${bidDraft}"></label><small>可用资金 ${state.myCash} 元</small></div><div class="art-choice-row"><button type="button" data-choice="placeBid" ${state.myCash >= minimum ? '' : 'disabled'}>选择此报价</button><button type="button" data-choice="passBid">选择放弃</button></div>`;
            }
        }
        let confirmation = '';
        if (pendingChoice?.kind === 'bid') {
            const remaining = Math.max(0, Number(state.myCash || 0) - pendingChoice.amount);
            const copy = auction.type === 'sealed' ? `密封报价 ${pendingChoice.amount} 元·提交后不可修改，落槌前不公开·若成交余 ${remaining} 元` : `报价 ${pendingChoice.amount} 元·若成交余 ${remaining} 元`;
            confirmation = pendingConfirmation(copy);
        }
        if (pendingChoice?.kind === 'passBid') {
            const sellerForced = auction.type === 'fixed' && auction.sellerId === state.myId;
            const irreversible = auction.type === 'open' ? '放弃后不能重新加入本场竞价' : auction.type === 'once' ? '放弃本场唯一一次报价机会' : '放弃本次报价机会';
            confirmation = pendingConfirmation(sellerForced ? `你是卖家；放弃接受后将按 ${auction.fixedPrice} 元买回作品` : irreversible, true);
        }
        $('auction').innerHTML = `<div class="art-stage-work ${works.includes('is-second') ? 'has-pair' : ''}" data-stage-anchor style="--artist:${meta.color}" data-artist="${meta.id}"><div class="art-stage-pair">${works}</div><span class="art-method" data-type="${auction.type}"><i>${type.mark}</i>${type.label}</span></div><div class="art-stage-copy"><span class="art-kicker">中央拍卖台</span><h3>${meta.name}${auction.artists?.length > 1 ? ' · 两幅作品' : ''}</h3><p>${type.note}</p><small>卖家 ${escapeHtml(auction.sellerName || '')} · ${auction.passed?.length || 0} 人已放弃</small><b>${current}</b>${controls}${confirmation}</div>`;
    }

    function renderMarket() {
        const market = state.market || [];
        $('marketCount').textContent = `${market.length} 件成交`;
        $('market').innerHTML = market.length ? market.map((card, index) => {
            const meta = artistMeta(card.artistId);
            return `<article class="art-sale" data-card-id="${escapeHtml(card.cardId || '')}" style="--artist:${meta.color}" data-artist="${meta.id}">${artCanvas(card, index)}<footer><span>${meta.name}</span><b>${card.price} 元</b></footer></article>`;
        }).join('') : '<div class="art-market-empty"><i></i><span>本季还没有成交作品</span></div>';
    }

    function pieceCard(card, index, disabled, selected) {
        const meta = artistMeta(card.artistId);
        const type = auctionMeta(card.auctionType);
        const serial = String(card.id || '').match(/(\d+)$/)?.[1] || String(index + 1).padStart(2, '0');
        return `<button class="art-piece ${disabled ? 'is-disabled' : ''} ${selected ? 'is-selected' : ''}" type="button" data-card-index="${index}" style="--artist:${meta.color}" data-artist="${meta.id}" ${disabled ? 'disabled' : ''}>${artCanvas(card, index)}<footer><span><strong>${meta.name}</strong><small>第 ${serial} 号作品</small></span><b data-type="${card.auctionType}"><i>${type.mark}</i>${type.label.replace('竞价', '').replace('拍卖', '')}</b></footer></button>`;
    }

    function renderHand() {
        const hand = state.myHand || [];
        const canStart = Boolean(actions().startAuction);
        const canOffer = Boolean(actions().offerSecond);
        const primaryCard = handSelection.primary === null ? null : hand[handSelection.primary];
        $('handCount').textContent = `${hand.length} 幅`;
        $('hand').innerHTML = hand.length ? hand.map((card, index) => {
            let disabled = !(canStart || canOffer);
            if (canOffer) disabled = card.artistId !== state.doubleOffer?.artistId || card.auctionType === 'double';
            if (canStart && primaryCard?.auctionType === 'double') disabled = index !== handSelection.primary && (card.artistId !== primaryCard.artistId || card.auctionType === 'double');
            const selected = index === handSelection.primary || index === handSelection.second;
            return pieceCard(card, index, disabled, selected);
        }).join('') : '<p class="art-muted">手牌已用尽。</p>';

        let decision = '';
        if (primaryCard && canStart) {
            const type = auctionMeta(primaryCard.auctionType);
            const appearance = Number(state.roundCounts?.[primaryCard.artistId] || 0) + 1;
            const lastPainting = (state.players || []).reduce((sum, player) => sum + Number(player.handCount || 0), 0) === 1;
            const endsSeason = appearance >= 5 || lastPainting;
            const warning = endsSeason ? `<p class="art-season-warning"><b>季度即将结束</b><span>${lastPainting ? '这是全场最后一幅手牌' : `${primaryCard.artistName}将达到第五幅`}；本幅${primaryCard.auctionType === 'double' ? '及双重作品' : '作品'}不会拍卖。</span></p>` : '';
            if (primaryCard.auctionType === 'fixed') {
                decision = `<div class="art-hand-decision"><div><span>开拍方案</span><strong>${primaryCard.artistName} · ${type.label}</strong><small>定价无人接受时，卖家必须按此价格买入。</small>${warning}</div><label>定价<input data-draft="fixed" type="number" min="1" max="${state.myCash}" value="${fixedDraft}"></label><div><button type="button" data-ui="cancelHand">取消</button><button class="art-primary" type="button" data-confirm="startAuction">确认开拍</button></div></div>`;
            } else {
                const second = handSelection.second === null ? null : hand[handSelection.second];
                const summary = primaryCard.auctionType === 'double' ? `${primaryCard.artistName} · 双重拍卖${second ? `，第二幅采用${auctionMeta(second.auctionType).label}` : '，暂不提供第二幅'}` : `${primaryCard.artistName} · ${type.label}`;
                decision = `<div class="art-hand-decision"><div><span>开拍方案</span><strong>${summary}</strong><small>${primaryCard.auctionType === 'double' ? '可以再选一幅同艺术家非双重作品；不选也可提交，由玩家依次响应。' : type.note}</small>${warning}</div><div><button type="button" data-ui="cancelHand">取消</button><button class="art-primary" type="button" data-confirm="startAuction">确认开拍</button></div></div>`;
            }
        } else if (primaryCard && canOffer) {
            const endsSeason = Number(state.roundCounts?.[primaryCard.artistId] || 0) >= 4;
            decision = `<div class="art-hand-decision"><div><span>补画方案</span><strong>提供 ${primaryCard.artistName} 的${auctionMeta(primaryCard.auctionType).label}作品</strong><small>你会成为两幅作品的新卖家，第二幅的方式决定整场拍卖。</small>${endsSeason ? `<p class="art-season-warning"><b>季度即将结束</b><span>这幅将成为第五幅，双重拍卖的两幅作品都不成交。</span></p>` : ''}</div><div><button type="button" data-ui="cancelHand">取消</button><button class="art-primary" type="button" data-confirm="offerSecond">确认提供</button></div></div>`;
        } else if (canStart) decision = '<div class="art-hand-hint">先选择一幅作品；选择双重作品后可再点选同艺术家的第二幅。</div>';
        else if (canOffer) decision = `<div class="art-hand-hint">选择一幅 ${escapeHtml(state.doubleOffer?.artist || '')} 的非双重作品，或在中央拍卖台选择跳过。</div>`;
        $('handDecision').innerHTML = decision;
    }

    function renderHistory() {
        const history = state.history || [];
        $('history').innerHTML = history.length ? history.slice().reverse().map(item => {
            const valued = ARTISTS.filter(artist => Number(item.values?.[artist.id] || 0) > 0);
            return `<article class="art-season"><i>${item.round}</i><div><strong>第 ${item.round} 季</strong><small>${item.market?.length || 0} 件成交作品</small></div><p>${valued.map(artist => `<span style="--artist:${artist.color}">${artist.name} <b>+${item.values[artist.id]}</b><small>累计 ${item.cumulativeValues?.[artist.id] ?? state.artistValues?.[artist.id] ?? 0}</small></span>`).join('') || '<em>本季没有产生价值</em>'}</p></article>`;
        }).join('') : '<p class="art-muted">第一季尚未结算。</p>';
    }

    function renderWallet() {
        $('wallet').innerHTML = `<span class="art-kicker">我的竞拍资金</span><div><strong>${state.myCash ?? 0}</strong><small>元</small></div><p>${state.rules?.mysteryPlayer ? `神秘作品剩余 ${state.mysteryCount} 张` : '现金只对本人可见'}</p>`;
    }

    function renderPlayers() {
        $('players').innerHTML = (state.players || []).map(player => {
            const mine = player.id === state.myId;
            const handCount = Math.max(0, Number(player.handCount) || 0);
            const handSummary = mine
                ? `${handCount} 手牌 · ${player.collectionCount} 收藏`
                : `<span class="art-player-hand" role="img" aria-label="隐藏手牌 ${handCount} 张">${cardBackFan(handCount)}<b>${handCount} 手牌</b></span><span> · ${player.collectionCount} 收藏</span>`;
            return `<article class="art-player ${mine ? 'is-me' : ''} ${player.isOnline ? '' : 'is-away'}" data-player-id="${escapeHtml(player.id)}"><i style="--player:${escapeHtml(player.color)}">${escapeHtml(player.name.slice(0, 1))}</i><div><strong>${escapeHtml(player.name)}${mine ? '<em>我</em>' : ''}</strong><small class="${mine ? '' : 'has-hidden-hand'}">${handSummary}</small></div><b>${mine ? `${player.cash} 元` : '保密'}</b></article>`;
        }).join('');
    }

    function renderCollection() {
        const collection = state.myCollection || [];
        $('collection').innerHTML = collection.length ? collection.map((card, index) => {
            const meta = artistMeta(card.artistId);
            return `<article class="art-collected" data-artist="${meta.id}" style="--artist:${meta.color}">${artCanvas(card, index)}<span>${meta.name}</span></article>`;
        }).join('') : '<p class="art-muted">还没有收藏品。</p>';
    }

    function renderLog() {
        $('log').innerHTML = (state.actionLog || []).slice().reverse().map((entry, index) => `<p class="${index === 0 ? 'is-latest' : ''}"><i></i><span>${escapeHtml(entry)}</span></p>`).join('') || '<p><i></i><span>等待第一锤。</span></p>';
    }

    function findByData(attribute, value) {
        return [...mount.querySelectorAll(`[${attribute}]`)].find(element => String(element.getAttribute(attribute)) === String(value)) || null;
    }
    function playerAnchor(playerId) { return findByData('data-player-id', playerId); }
    function artistAnchor(artistId) { return findByData('data-artist-id', artistId); }
    function marketCardAnchor(cardId) { return findByData('data-card-id', cardId); }
    function stageAnchor() { return mount.querySelector('[data-stage-anchor]') || $('auction'); }
    function centerOf(element) { if (!element?.isConnected) return null; const box = element.getBoundingClientRect(); return { x: box.left + box.width / 2, y: box.top + box.height / 2 }; }

    function clearPresentationMarks() {
        mount.querySelectorAll('.is-presentation-source, .is-presentation-target').forEach(element => element.classList.remove('is-presentation-source', 'is-presentation-target'));
        $('actionLine')?.classList.remove('is-visible', 'is-money', 'is-secret', 'is-danger');
    }

    function drawActionLine(fromElement, toElement, tone = '') {
        clearPresentationMarks();
        const from = centerOf(fromElement); const to = centerOf(toElement);
        if (!from || !to) return;
        fromElement.classList.add('is-presentation-source'); toElement.classList.add('is-presentation-target');
        const svg = $('actionLine');
        svg.setAttribute('viewBox', `0 0 ${window.innerWidth} ${window.innerHeight}`);
        const line = svg.querySelector('line'); const circle = svg.querySelector('circle');
        line.setAttribute('x1', from.x); line.setAttribute('y1', from.y); line.setAttribute('x2', to.x); line.setAttribute('y2', to.y);
        circle.setAttribute('cx', to.x); circle.setAttribute('cy', to.y);
        svg.classList.toggle('is-money', tone === 'money'); svg.classList.toggle('is-secret', tone === 'secret'); svg.classList.toggle('is-danger', tone === 'danger');
        requestAnimationFrame(() => svg.classList.add('is-visible'));
    }

    function cancelPresentationWait() {
        if (waitTimer) window.clearTimeout(waitTimer);
        waitTimer = null; const release = releaseWait; releaseWait = null; release?.(false);
    }
    function presentationWait(duration, token) {
        if (reducedMotion) duration = Math.min(duration, 180);
        if (token !== presentationToken) return Promise.resolve(false);
        return new Promise(resolve => {
            const finish = value => { waitTimer = null; releaseWait = null; resolve(value); };
            releaseWait = finish; waitTimer = window.setTimeout(() => finish(token === presentationToken), Math.max(0, duration));
        });
    }

    function showPresentation(mode, tone, kicker, title, body = '') {
        const layer = $('presentationLayer'); layer.hidden = false;
        layer.className = `art-presentation-layer is-${mode || 'compact'} ${tone ? `is-${tone}` : ''}`;
        $('presentationScene').innerHTML = `<header class="art-event-heading"><span>${escapeHtml(kicker)}</span><h2>${escapeHtml(title)}</h2></header>${body}`;
    }
    function hidePresentation() {
        const layer = $('presentationLayer'); if (!layer) return;
        layer.hidden = true; layer.className = 'art-presentation-layer'; $('presentationScene').innerHTML = ''; $('floatingLayer').innerHTML = ''; clearPresentationMarks();
    }

    function eventCard(card, label = '', className = '') {
        const meta = artistMeta(card?.artistId);
        return `<article class="art-event-card ${className}" data-event-card="${escapeHtml(card?.id || '')}" style="--artist:${meta.color}" data-artist="${meta.id}">${artCanvas(card, 0, 'is-event')}<footer><b>${escapeHtml(meta.name)}</b><span>${escapeHtml(label || auctionMeta(card?.auctionType).label)}</span></footer></article>`;
    }
    function eventCards(cards, label = '') { return `<div class="art-event-cards">${(cards || []).map(card => eventCard(card, label)).join('')}</div>`; }
    function eventPlayer(playerId, name, detail = '') {
        const player = state?.players?.find(candidate => candidate.id === playerId);
        return `<span class="art-event-player" style="--player:${escapeHtml(player?.color || '#837a78')}"><i>${escapeHtml((name || player?.name || '藏').slice(0, 1))}</i><b>${escapeHtml(name || player?.name || '收藏家')}</b>${detail ? `<small>${escapeHtml(detail)}</small>` : ''}</span>`;
    }

    async function animatePainting(fromElement, toElement, card, token) {
        const from = centerOf(fromElement); const to = centerOf(toElement);
        if (!from || !to || !card) return presentationWait(260, token);
        const meta = artistMeta(card.artistId); const ghost = document.createElement('div');
        ghost.className = 'art-floating-work'; ghost.style.setProperty('--artist', meta.color); ghost.style.left = `${from.x}px`; ghost.style.top = `${from.y}px`; ghost.innerHTML = artCanvas(card, 0, 'is-floating');
        $('floatingLayer').appendChild(ghost); ghost.getBoundingClientRect();
        ghost.style.transform = `translate(calc(-50% + ${to.x - from.x}px), calc(-50% + ${to.y - from.y}px)) rotate(-2deg)`;
        const continued = await presentationWait(650, token); ghost.remove(); return continued;
    }

    async function playPaintingPresented(event, token) {
        const type = auctionMeta(event.auctionType); const seasonCopy = event.endsSeason ? (event.endReason === 'lastPainting' ? '本季最后一幅·不拍卖' : '第五幅·不拍卖') : `本季第 ${event.appearance} 幅`;
        showPresentation('medium', event.endsSeason ? 'danger' : 'auction', '卖家出画', `${event.sellerName}送作品登台`, `${eventCards([event.card], type.label)}<p class="art-event-note">${escapeHtml(seasonCopy)}</p>`);
        const target = $('presentationScene').querySelector('[data-event-card]'); drawActionLine(playerAnchor(event.sellerId), target, event.endsSeason ? 'danger' : '');
        if (!await animatePainting(playerAnchor(event.sellerId), target, event.card, token)) return;
        await presentationWait(event.endsSeason ? 700 : 350, token);
    }

    async function playBidEvent(event, token) {
        const secret = event.kind === 'sealedBidSubmitted';
        const passed = event.kind === 'bidPassed' || event.kind === 'doubleOfferPassed';
        const amount = event.amount;
        const card = event.cards?.[0] || event.card;
        const title = secret ? `${event.actorName}密封报价` : passed ? `${event.actorName}放弃` : `${event.actorName}${event.kind === 'fixedPriceAccepted' ? '接受定价' : '出价'} ${amount} 元`;
        const detail = secret ? `${event.submitted}/${event.required} 人已提交·金额保密` : passed ? (event.irreversible ? '本场不可再加入' : '等待下一位收藏家') : '报价已送往中央展台';
        showPresentation('compact', secret ? 'secret' : passed ? 'quiet' : 'bid', secret ? '密封信封' : '竞价接力', title, `${card ? eventCards([card]) : ''}<p class="art-event-note">${escapeHtml(detail)}</p>`);
        const target = $('presentationScene').querySelector('[data-event-card]') || $('presentationScene'); drawActionLine(playerAnchor(event.actorId), target, secret ? 'secret' : '');
        await presentationWait(passed ? 420 : 650, token);
    }

    async function playAuctionResolved(event, token) {
        const sealedRows = event.sealedBids?.length ? `<div class="art-sealed-results">${event.sealedBids.map(bid => `<span><b>${escapeHtml(bid.playerName)}</b><em>${bid.amount} 元</em></span>`).join('')}</div>` : '';
        showPresentation('medium', 'hammer', '落槌成交', `${event.buyerName}以 ${event.price} 元收藏`, `${eventCards(event.cards, event.auctionTypeName)}<div class="art-event-transaction">${eventPlayer(event.buyerId, event.buyerName, event.selfPurchase ? '向银行付款' : '买家')}<i>→</i>${eventPlayer(event.sellerId, event.sellerName, event.selfPurchase ? '自行买回' : '卖家')}</div>${sealedRows}`);
        const work = $('presentationScene').querySelector('[data-event-card]');
        if (!event.selfPurchase) {
            drawActionLine(playerAnchor(event.buyerId), playerAnchor(event.sellerId), 'money');
            if (!await presentationWait(520, token)) return;
        }
        drawActionLine(work, playerAnchor(event.buyerId));
        if (!await animatePainting(work, playerAnchor(event.buyerId), event.cards?.[0], token)) return;
        await presentationWait(650, token);
    }

    async function playSeasonSettlement(event, token) {
        const valued = (event.ranking || []).filter(artist => artist.roundValue > 0).slice(0, 3);
        const rankings = valued.map(artist => `<span class="is-rank-${artist.rank}" style="--artist:${artistMeta(artist.artistId).color}"><i>${artist.rank}</i><b>${escapeHtml(artist.artistName)}</b><small>${artist.count} 幅·本季 +${artist.roundValue}</small><em>累计 ${artist.cumulativeValue}</em></span>`).join('');
        const own = event.ownResult;
        const ownWorks = own?.paintings?.length ? `<div class="art-own-sale">${own.paintings.map(card => `<span style="--artist:${artistMeta(card.artistId).color}"><b>${escapeHtml(card.artistName)}</b><em>${card.value ? `+${card.value}` : '0'}</em></span>`).join('')}</div>` : '<p class="art-event-note">你本季没有可结算的收藏</p>';
        showPresentation('major', 'season', `第 ${event.round} 季闭幕`, '热门艺术家估值', `<div class="art-season-ranking">${rankings || '<p>本季没有产生价值</p>'}</div><section class="art-private-settlement"><header>我的私密结算</header>${ownWorks}<footer><b>${own ? `${own.payout >= 0 ? '+' : ''}${own.payout} 元` : '仅本人可见'}</b><span>${own ? `${own.cashBefore} → ${own.cashAfter}` : ''}</span></footer></section>`);
        if (!await presentationWait(900, token)) return;
        for (const artist of valued) {
            artistAnchor(artist.artistId)?.classList.add('is-presentation-target');
            if (!await presentationWait(360, token)) return;
        }
        await presentationWait(900, token);
    }

    async function playFinalSettlement(event, token) {
        const winners = new Set(event.winnerIds || []);
        const rows = (event.standings || []).map(player => `<span class="${winners.has(player.id) ? 'is-winner' : ''}"><i>${player.rank}</i><b>${escapeHtml(player.name)}</b><em>${player.fortune} 元</em></span>`).join('');
        showPresentation('major', 'final', '四季落幕', '现代艺术最终排名', `<div class="art-final-ranking">${rows}</div><p class="art-final-winner">${escapeHtml((event.standings || []).filter(player => winners.has(player.id)).map(player => player.name).join('、') || '收藏家')}赢得拍卖季</p>`);
        drawActionLine($('wallet'), playerAnchor(event.winnerIds?.[0]), 'money');
        await presentationWait(2700, token);
    }

    async function playPresentationEvent(event, token) {
        if (!event || token !== presentationToken) return;
        if (event.kind === 'paintingPresented') return playPaintingPresented(event, token);
        if (['bidPlaced', 'bidPassed', 'sealedBidSubmitted', 'fixedPriceAccepted', 'doubleOfferPassed'].includes(event.kind)) return playBidEvent(event, token);
        if (event.kind === 'auctionResolved') return playAuctionResolved(event, token);
        if (event.kind === 'seasonSettlement') return playSeasonSettlement(event, token);
        if (event.kind === 'finalSettlement') return playFinalSettlement(event, token);
        let mode = 'compact'; let tone = ''; let kicker = '当代展厅'; let title = ''; let body = ''; let from = null; let to = null; let duration = 600;
        if (event.kind === 'auctionOpened') { kicker = event.auctionTypeName; title = `${event.sellerName}的拍卖开始`; body = eventCards(event.cards, event.fixedPrice ? `定价 ${event.fixedPrice} 元` : event.auctionTypeName); from = playerAnchor(event.sellerId); to = stageAnchor(); duration = 520; }
        else if (event.kind === 'doubleOfferStarted') { tone = 'double'; kicker = '双重拍卖'; title = '等待同艺术家的第二幅作品'; body = eventCards([event.card]); duration = 700; }
        else if (event.kind === 'secondPaintingOffered') { mode = 'medium'; tone = 'double'; kicker = '双重拍卖'; title = `${event.actorName}提供第二幅作品`; body = eventCards([event.firstCard, event.secondCard], auctionMeta(event.auctionType).label); from = playerAnchor(event.actorId); duration = 900; }
        else if (event.kind === 'doubleOfferFailed') { tone = 'quiet'; kicker = '双重拍卖'; title = '没有找到第二幅作品'; body = `${eventCards([event.card], '免费收下')}<p class="art-event-note">${escapeHtml(event.sellerName)}收回作品</p>`; to = playerAnchor(event.sellerId); duration = 780; }
        else if (event.kind === 'mysteryOfferStarted') { tone = 'secret'; kicker = '三人变体'; title = `${event.playerName}可翻开神秘作品`; body = cardBack('art-event-back'); duration = 620; }
        else if (event.kind === 'mysterySkipped') { tone = 'quiet'; kicker = '神秘作品'; title = `${event.actorName}选择跳过`; duration = 420; }
        else if (event.kind === 'mysteryRevealed') { mode = 'medium'; tone = 'secret'; kicker = '神秘作品翻开'; title = `${event.card.artistName}·本季第 ${event.appearance} 幅`; body = eventCards([event.card], '只计出现次数'); to = $('presentationScene'); duration = 950; }
        else if (event.kind === 'fixedPriceBuyback') { tone = 'hammer'; kicker = '定价拍卖'; title = `${event.actorName}以 ${event.amount} 元买回作品`; body = eventCards(event.cards); from = playerAnchor(event.actorId); duration = 700; }
        else if (event.kind === 'seasonTriggered') { mode = 'medium'; tone = 'danger'; kicker = '展厅封闭'; title = event.trigger?.kind === 'fifthPainting' ? '第五幅作品出现' : '本季作品已全部登台'; body = event.trigger?.card ? `${eventCards([event.trigger.card], '不拍卖')}<p class="art-event-note">立即进入季度估值</p>` : '<p class="art-event-note">立即进入季度估值</p>'; duration = 950; }
        else if (event.kind === 'seasonStarted') { mode = 'medium'; tone = 'season-open'; kicker = '新季开幕'; title = `第 ${event.round} 季·${event.sellerName}首先出画`; duration = 760; }
        else return;
        showPresentation(mode, tone, kicker, title, body);
        const eventWork = $('presentationScene').querySelector('[data-event-card]');
        if (from && (eventWork || to)) drawActionLine(from, eventWork || to);
        else if (to && eventWork) drawActionLine(eventWork, to);
        if (event.kind === 'secondPaintingOffered' && eventWork) await animatePainting(from, [...$('presentationScene').querySelectorAll('[data-event-card]')].at(-1), event.secondCard, token);
        else if (event.kind === 'doubleOfferFailed' && eventWork) await animatePainting(eventWork, to, event.card, token);
        await presentationWait(duration, token);
    }

    async function drainPresentations() {
        if (presentationPlaying || !presentationQueue.length) return;
        presentationPlaying = true; const token = ++presentationToken; renderAuction(); renderHand();
        while (presentationQueue.length && token === presentationToken) {
            const presentation = presentationQueue.shift();
            for (const event of presentation.events || []) { if (token !== presentationToken) break; await playPresentationEvent(event, token); clearPresentationMarks(); }
        }
        if (token !== presentationToken) return;
        hidePresentation(); presentationPlaying = false; renderAuction(); renderHand();
    }
    function skipPresentation() { presentationQueue = []; presentationPlaying = false; presentationToken += 1; cancelPresentationWait(); hidePresentation(); renderAuction(); renderHand(); }

    function sendAction(kind, extra = {}) {
        if (actionPending || presentationPlaying) return;
        actionPending = true;
        pendingChoice = null;
        send({ type: 'gameAction', action: { kind, ...extra } });
    }

    function confirmPending() {
        if (!pendingChoice) return;
        if (pendingChoice.kind === 'bid') sendAction('bid', { amount: pendingChoice.amount });
        if (pendingChoice.kind === 'passBid') sendAction('bid', { amount: 0 });
        if (pendingChoice.kind === 'passSecond') sendAction('passSecond');
        if (pendingChoice.kind === 'revealMystery') sendAction('revealMystery');
        if (pendingChoice.kind === 'skipMystery') sendAction('skipMystery');
    }

    function selectStageChoice(button) {
        const kind = button.dataset.choice;
        if (kind === 'placeBid') {
            const input = mount.querySelector('[data-draft="bid"]');
            bidDraft = Number(input?.value);
            const minimum = state.auction?.type === 'sealed' ? 1 : Number(state.auction?.highestBid || 0) + 1;
            if (!Number.isInteger(bidDraft) || bidDraft < minimum || bidDraft > state.myCash) { addLog(`报价需为 ${minimum}–${state.myCash} 的整数`, 'error'); return; }
            pendingChoice = { kind: 'bid', amount: bidDraft };
        }
        if (kind === 'acceptFixed') pendingChoice = { kind: 'bid', amount: Number(state.auction?.fixedPrice || 0) };
        if (kind === 'passBid') pendingChoice = { kind: 'passBid' };
        if (kind === 'passSecond') pendingChoice = { kind: 'passSecond' };
        if (kind === 'revealMystery') pendingChoice = { kind: 'revealMystery' };
        if (kind === 'skipMystery') pendingChoice = { kind: 'skipMystery' };
        renderAuction();
    }

    function selectHandCard(index) {
        const card = state.myHand?.[index];
        if (!card) return;
        if (actions().offerSecond) {
            handSelection = { primary: index, second: null };
        } else if (actions().startAuction) {
            const primary = handSelection.primary === null ? null : state.myHand[handSelection.primary];
            if (primary?.auctionType === 'double' && index !== handSelection.primary && card.artistId === primary.artistId && card.auctionType !== 'double') {
                handSelection.second = handSelection.second === index ? null : index;
            } else {
                handSelection = { primary: index, second: null };
                if (card.auctionType === 'fixed') fixedDraft = Math.max(1, Math.min(20, Number(state.myCash || 1)));
            }
        }
        renderHand();
    }

    function confirmHand(action) {
        if (handSelection.primary === null) return;
        if (action === 'offerSecond') { sendAction('offerSecond', { cardIndex: handSelection.primary }); return; }
        const card = state.myHand?.[handSelection.primary];
        if (!card) return;
        const payload = { cardIndex: handSelection.primary };
        if (card.auctionType === 'fixed') {
            const input = mount.querySelector('[data-draft="fixed"]');
            fixedDraft = Number(input?.value);
            if (!Number.isInteger(fixedDraft) || fixedDraft < 1 || fixedDraft > state.myCash) { addLog(`定价需为 1–${state.myCash} 的整数`, 'error'); return; }
            payload.amount = fixedDraft;
        }
        if (card.auctionType === 'double' && handSelection.second !== null) payload.secondCardIndex = handSelection.second;
        sendAction('startAuction', payload);
    }

    function openRules() {
        previousFocus = document.activeElement;
        $('rulesOverlay').classList.remove('is-hidden');
        $('rulesOverlay').querySelector('.art-close')?.focus();
    }
    function closeRules() {
        $('rulesOverlay').classList.add('is-hidden');
        previousFocus?.focus?.();
    }

    function handleClick(event) {
        const uiButton = event.target.closest('[data-ui]');
        if (uiButton) {
            const ui = uiButton.dataset.ui;
            if (ui === 'skipPresentation') { skipPresentation(); return; }
            if (presentationPlaying) return;

            else if (ui === 'rules') openRules();
            else if (ui === 'closeRules') closeRules();
            else if (ui === 'cancelChoice') { pendingChoice = null; renderAuction(); }
            else if (ui === 'confirmChoice') confirmPending();
            else if (ui === 'cancelHand') { handSelection = { primary: null, second: null }; renderHand(); }
            return;
        }
        if (presentationPlaying) return;
        if (event.target === $('rulesOverlay')) { closeRules(); return; }
        const card = event.target.closest('[data-card-index]');
        if (card && !card.disabled) { selectHandCard(Number(card.dataset.cardIndex)); return; }
        const choice = event.target.closest('[data-choice]');
        if (choice && !choice.disabled) { selectStageChoice(choice); return; }
        const confirmation = event.target.closest('[data-confirm]');
        if (confirmation?.dataset.confirm === 'startAuction') confirmHand('startAuction');
        if (confirmation?.dataset.confirm === 'offerSecond') confirmHand('offerSecond');
    }

    function handleInput(event) {
        if (presentationPlaying) return;
        const field = event.target.closest('[data-draft]');
        if (!field) return;
        if (field.dataset.draft === 'bid') bidDraft = Number(field.value);
        if (field.dataset.draft === 'fixed') fixedDraft = Number(field.value);
    }
    function handleKeydown(event) { if (event.key === 'Escape' && !$('rulesOverlay').classList.contains('is-hidden')) closeRules(); }

    function handleMessage(message) {
        if (message.state) {
            const firstState = !state;
            const nextSignature = signature(message.state);
            state = message.state;
            actionPending = false;
            if (nextSignature !== interactionSignature) { interactionSignature = nextSignature; resetInteraction(); }
            render();
            const presentation = message.state.presentation;
            if (presentation?.resolved && presentation.sequence !== lastPresentationSequence) {
                lastPresentationSequence = presentation.sequence;
                if (!firstState && presentation.events?.length) { presentationQueue.push(presentation); void drainPresentations(); }
            }
        }
        if (message.type === 'error') { actionPending = false; addLog(message.message || '操作失败', 'error'); }
    }

    mount.addEventListener('click', handleClick);
    mount.addEventListener('input', handleInput);
    document.addEventListener('keydown', handleKeydown);

    return {
        gameType: 'modernart',
        handleMessage,
        destroy() {
            presentationToken += 1; presentationQueue = []; cancelPresentationWait(); hidePresentation();
            mount.removeEventListener('click', handleClick);
            mount.removeEventListener('input', handleInput);
            document.removeEventListener('keydown', handleKeydown);
            style.remove();
            mount.innerHTML = '';
        },
    };
}
