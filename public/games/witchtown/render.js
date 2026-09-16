import { CARD_META, CARD_SIGILS, TRIAL_META, deckCardMeta, escapeHtml, factionLabel, townHallArtStyle } from './constants.js';
import { alivePlayers, hasMyAction, playerById } from './state.js';

const esc = escapeHtml;

/** Dynamic tribunal, dossier and command rendering for 猎巫镇. */
export function createWitchTownRenderer({ mount, model, getElement }) {
    const $ = role => getElement ? getElement(role) : mount.querySelector(`[data-role="${role}"]`);

    const actionButton = (label, action, value = '', className = '', disabled = false) => `<button class="witchtown-button ${className}" data-action="${esc(action)}" data-value="${esc(value)}" type="button"${disabled ? ' disabled' : ''}>${esc(label)}</button>`;

    function targetOptions(includeSelf = false, excludedIds = []) {
        const state = model.state;
        const excluded = new Set(excludedIds.filter(Boolean));
        return alivePlayers(state, includeSelf).filter(player => !excluded.has(player.id)).map(player => `<option value="${esc(player.id)}">${esc(player.name)}${player.id === state.myId ? ' · 我' : ''}</option>`).join('');
    }

    function trialOptions(cards = []) {
        return cards.map((card, index) => `<option value="${esc(card.id)}">${esc(card.label || `审判牌 ${index + 1}`)}</option>`).join('');
    }

    function blueCardOptions(targetId) {
        const target = playerById(model.state, targetId);
        return (target?.blueCards || []).map(card => `<option value="${esc(card.id)}">${esc(card.name)}</option>`).join('');
    }

    function phaseMeta() {
        const state = model.state;
        if (!state) return { kicker: '牌局状态', title: '等待牌局状态', copy: '连接到房间后，当前阶段与可用行动会显示在这里。' };
        if (state.status === 'ended') {
            const winner = state.winner?.name || '本局';
            return { kicker: '最终判决', title: `${winner}获胜`, copy: state.judgeMessage || '牌局已经结束，最终阵营已经公开。' };
        }
        if (state.phase === 'dossier_review') {
            const isOpening = state.dossierReviewReason === 'opening';
            return { kicker: isOpening ? '审判开始前 · 私密核对' : '阴谋过后 · 档案易手', title: isOpening ? '请核对你的审判档案' : '请重新核对审判档案', copy: state.judgeMessage || '打开密封档案，确认自己的审判牌与当前职责。' };
        }
        if (state.phase === 'dawn') return { kicker: '黎明 · 秘密投票', title: '黎明：黑猫归属', copy: state.judgeMessage || '女巫阵营正在选择黑猫持有者。' };
        if (state.phase === 'conspiracy_reveal') return { kicker: '阴谋 · 揭示', title: '阴谋：揭示黑猫审判牌', copy: state.judgeMessage || '阴谋触发，等待指定玩家揭示一张牌。' };
        if (state.phase === 'conspiracy') return { kicker: '阴谋 · 交换', title: '阴谋：顺时针交换', copy: state.judgeMessage || '所有存活玩家从左手玩家处秘密交换一张牌。' };
        if (state.phase === 'night') {
            const step = { witches: ['女巫行动', '黑暗中的低语'], constable: ['警长行动', '法槌落下之前'], confession: ['认罪时刻', '晨钟响起之前'] }[state.nightStep] || ['秘密行动', '夜幕笼罩塞勒姆'];
            return { kicker: `第 ${state.night || 1} 夜 · ${step[0]}`, title: step[1], copy: state.judgeMessage || '夜间行动正在等待提交。' };
        }
        return { kicker: `第 ${state.day || 1} 天 · 公开行动`, title: `第 ${state.day || 1} 天 · ${state.currentTurnName || '白天行动'}`, copy: state.judgeMessage || '当前玩家正在行动。' };
    }

    function render() {
        const state = model.state;
        if (!state) return;
        const meta = phaseMeta();
        const actions = state.availableActions || {};
        if (!actions.playCard || !(state.myHand || []).some(card => card.id === model.pendingCardId)) model.pendingCardId = null;
        if (!actions.reorderDeck) model.deckOrderDraft = null;
        else if (!model.deckOrderDraft || model.deckOrderDraft.length !== (state.deckOrder || []).length || model.deckOrderDraft.some(id => !(state.deckOrder || []).includes(id))) model.deckOrderDraft = (state.deckOrder || []).slice();
        const app = mount.querySelector('.witchtown-app');
        app.classList.toggle('is-night-phase', state.phase === 'night' || state.phase === 'dawn');
        app.classList.toggle('is-day-phase', state.phase === 'day');
        app.classList.toggle('is-conspiracy-phase', ['conspiracy_reveal', 'conspiracy', 'dossier_review'].includes(state.phase) && state.dossierReviewReason !== 'opening');
        app.classList.toggle('is-my-action', hasMyAction(actions));
        app.dataset.phase = state.phase || 'waiting';
        $('room').textContent = state.roomId ? `房间 ${state.roomId}` : '猎巫镇';
        $('footer-room').textContent = state.roomId || '—';
        $('cycle').textContent = state.status === 'ended' ? '终局' : state.phase === 'night' ? `第${state.night || 1}夜` : `第${state.day || 1}天`;
        $('phase').textContent = state.status === 'ended' ? '结算' : ({ dossier_review: '核对档案', dawn: '黎明', conspiracy_reveal: '揭示', conspiracy: '交换', day: '白天', night: '夜晚' }[state.phase] || state.phase);
        $('deck').textContent = `${state.deckCount ?? 0} 张`;
        $('current').textContent = state.status === 'ended' ? '已结束' : state.phase === 'dossier_review' ? '全员核对' : state.currentTurnName || '等待';
        $('command-kicker').textContent = meta.kicker;
        $('command-title').textContent = meta.title;
        $('command-copy').textContent = meta.copy;
        $('command-status').textContent = state.status === 'ended' ? '已结算' : state.phase === 'dossier_review' && state.dossierConfirmed ? '已确认' : hasMyAction(actions) ? '轮到我' : '等待中';
        $('command-status').className = `witchtown-status-badge ${state.status === 'ended' ? 'is-ended' : hasMyAction(actions) ? 'is-mine' : ''}`;
        $('judge-footer').textContent = state.status === 'ended' ? '最终判决已记录' : state.judgeMessage || '';
        $('command-footer').textContent = state.status === 'ended' ? '最终阵营已公开' : state.phase === 'dossier_review' ? `${state.dossierProgress?.confirmed || 0} / ${state.dossierProgress?.required || 0} 人已确认` : state.phase === 'night' ? state.nightProgress?.sealed ? '秘密决定正在封存' : `${state.nightProgress?.completed || 0} / ${state.nightProgress?.required || 0} 项决定已完成` : `${state.deckCount ?? 0} 张牌留在牌库`;
        renderCommand();
        renderTable();
        renderPrivate();
        renderPublicRole();
        renderHand();
        renderLog();
    }

    function captureSelectDraft() {
        $('command-body')?.querySelectorAll('select[data-select-for]').forEach(select => model.selectDraft.set(select.dataset.selectFor, select.value));
    }

    function setCommandMarkup(body, markup) {
        body.innerHTML = markup;
        body.querySelectorAll('select[data-select-for]').forEach(select => {
            const draft = model.selectDraft.get(select.dataset.selectFor);
            if (draft && [...select.options].some(option => option.value === draft)) select.value = draft;
            model.selectDraft.set(select.dataset.selectFor, select.value);
        });
        updatePlayConfirmText();
    }

    function selectedHandCard() {
        return (model.state?.myHand || []).find(card => card.id === model.pendingCardId) || null;
    }

    function renderDayTargetSelectors() {
        const selected = selectedHandCard();
        if (!selected) return '<div class="witchtown-target-prompt"><b>先从手牌中预选一张牌</b><small>选择牌后，这里只显示该牌真正需要的目标。</small></div>';
        const primaryId = model.selectDraft.get('playCard') || alivePlayers(model.state, false)[0]?.id || '';
        const fields = [`<label class="witchtown-select"><span>目标</span><select data-select-for="playCard">${targetOptions(false)}</select></label>`];
        if (['robbery', 'scapegoat'].includes(selected.kind)) fields.push(`<label class="witchtown-select"><span>接收者</span><select data-select-for="playCard2">${targetOptions(false, [primaryId])}</select></label>`);
        if (selected.kind === 'curse') {
            const blueOptions = blueCardOptions(primaryId);
            fields.push(`<label class="witchtown-select witchtown-blue-target"><span>移除目标的持续牌</span><select data-select-for="curseBlue"${blueOptions ? '' : ' disabled'}>${blueOptions || '<option value="">目标没有持续牌</option>'}</select></label>`);
        }
        return `<div class="witchtown-targets" data-card-kind="${esc(selected.kind)}">${fields.join('')}</div>`;
    }

    function renderCommand() {
        const state = model.state;
        const body = $('command-body');
        const actions = state.availableActions || {};
        captureSelectDraft();
        if (state.status === 'ended') {
            const winner = state.winner?.name || '本局';
            setCommandMarkup(body, `<div class="witchtown-verdict"><span class="witchtown-verdict-mark">裁</span><div><strong>${esc(winner)}获胜</strong><small>${esc(state.judgeMessage || '最终阵营已经公开。')}</small></div></div><div class="witchtown-final-list">${(state.players || []).map(player => `<span><b>${esc(player.name)}</b><em>${esc(player.identity?.name || '身份已公开')}</em></span>`).join('')}</div>`);
            return;
        }

        if (state.phase === 'dossier_review') {
            const progress = state.dossierProgress || { confirmed: 0, required: 0 };
            setCommandMarkup(body, state.dossierConfirmed
                ? waitingMarkup('你的档案已经重新封存', `已有 ${progress.confirmed}/${progress.required} 名玩家完成核对。`)
                : `<div class="witchtown-action-card is-conspiracy"><div class="witchtown-action-head"><span class="witchtown-action-icon is-paper">档</span><div><b>${state.dossierReviewReason === 'opening' ? '核对密封档案' : '审判牌已经易手'}</b><small>在“我的审判牌”区域按住档案查看，松开会立即封存；看过后再确认你已记住当前阵营与职责。</small></div></div></div>`);
            return;
        }

        if (state.phase === 'dawn') {
            setCommandMarkup(body, actions.chooseBlackCat
                ? `<div class="witchtown-action-card is-dawn"><div class="witchtown-action-head"><span class="witchtown-action-icon">巫</span><div><b>选择黑猫持有者</b><small>女巫阵营的选择完成后，黑猫持有者先手。</small></div></div><div class="witchtown-action-row"><label class="witchtown-select"><span>黑猫交给</span><select data-select-for="chooseBlackCat">${targetOptions(true)}</select></label>${actionButton('确认选择', 'chooseBlackCat', '', 'is-primary')}</div></div>`
                : waitingMarkup('女巫阵营正在秘密投票', '等待所有女巫完成黑猫选择。'));
            return;
        }

        if (state.phase === 'conspiracy_reveal') {
            setCommandMarkup(body, actions.revealConspiracyTrial
                ? `<div class="witchtown-action-card is-conspiracy"><div class="witchtown-action-head"><span class="witchtown-action-icon">谋</span><div><b>揭示黑猫的一张审判牌</b><small>确认后，揭晓的审判牌会出现在所有人的公开审判席。</small></div></div><div class="witchtown-action-row"><label class="witchtown-select"><span>选择牌</span><select data-select-for="revealConspiracyTrial">${trialOptions((state.conspiracyRevealOptions || []).map((card, index) => ({ ...card, label: `黑猫审判牌 ${index + 1}` })))}</select></label>${actionButton('揭示', 'revealConspiracyTrial', '', 'is-primary')}</div></div>`
                : waitingMarkup('阴谋正在揭示黑猫审判牌', '等待抽到阴谋牌的玩家完成选择。'));
            return;
        }

        if (state.phase === 'conspiracy') {
            setCommandMarkup(body, actions.passTrial
                ? `<div class="witchtown-action-card is-conspiracy"><div class="witchtown-action-head"><span class="witchtown-action-icon">换</span><div><b>从左手玩家处取一张牌</b><small>只显示牌的数量，不会公开左手玩家的身份类型。</small></div></div><div class="witchtown-action-row"><label class="witchtown-select"><span>取走哪张</span><select data-select-for="passTrial">${trialOptions((state.conspiracyOptions || []).map((card, index) => ({ ...card, label: `左手审判牌 ${index + 1}` })))}</select></label>${actionButton('确认取牌', 'passTrial', '', 'is-primary')}</div></div>`
                : waitingMarkup('阴谋交换进行中', '所有存活玩家按座位顺序秘密取牌。'));
            return;
        }

        if (state.phase === 'night') {
            const parts = [];
            if (actions.nightKill) parts.push(`<div class="witchtown-action-head"><span class="witchtown-action-icon is-rose">巫</span><div><b>决定今晚的目标</b><small>选择目标并核对后封存决定。所有女巫完成后，夜晚会自动继续。</small></div></div><div class="witchtown-action-row"><label class="witchtown-select"><span>今晚的目标</span><select data-select-for="nightKill">${targetOptions(true)}</select></label>${actionButton('确认并封存', 'nightKill', '', 'is-danger')}</div>`);
            if (actions.nightProtect) parts.push(`<div class="witchtown-action-head"><span class="witchtown-action-icon is-blue">槌</span><div><b>决定法槌的守护位置</b><small>选择一名其他存活玩家。确认后将立即进入认罪时刻。</small></div></div><div class="witchtown-action-row"><label class="witchtown-select"><span>法槌守护</span><select data-select-for="nightProtect">${targetOptions(false)}</select></label>${actionButton('确认并封存', 'nightProtect', '', 'is-blue')}</div>`);
            if (actions.confess) parts.push(`<div class="witchtown-action-head"><span class="witchtown-action-icon is-paper">认</span><div><b>是否在晨钟前认罪？</b><small>认罪会公开一张镇民或女巫审判牌，并使你免受本夜袭击。</small></div></div><div class="witchtown-action-row"><label class="witchtown-select"><span>公开审判牌</span><select data-select-for="confess">${trialOptions((state.myTrialCards || []).filter(card => !card.revealed && ['town', 'witch'].includes(card.type)).map((card, index) => ({ ...card, label: `${TRIAL_META[card.type]?.chinese || '审判'}牌 ${index + 1}` })))}</select></label>${actionButton('确认认罪', 'confess', '', 'is-paper')}</div>`);
            if (actions.confessFree) parts.push(`<div class="witchtown-special-choice"><span><b>William Phips</b><small>你本局可以有一次不公开审判牌的认罪。</small></span>${actionButton('使用能力认罪', 'confessFree', '', 'is-violet')}</div>`);
            if (actions.passConfession) parts.push(`<div class="witchtown-special-choice"><span><b>保持沉默</b><small>不会公开审判牌，也不会获得本夜免疫。</small></span>${actionButton('确认保持沉默', 'passConfession')}</div>`);
            const waitCopy = state.nightStep === 'witches' ? '女巫正在黑暗中作出决定。' : state.nightStep === 'constable' ? '警长正在放置法槌。' : '等待其他存活玩家完成认罪决定。';
            setCommandMarkup(body, parts.length ? `<div class="witchtown-action-card is-night">${parts.join('<hr>')}</div>` : waitingMarkup('夜幕中的秘密行动', waitCopy));
            return;
        }

        const selectors = actions.playCard ? renderDayTargetSelectors() : '';
        const dayButtons = [];
        if (actions.drawCards) dayButtons.push(actionButton('摸两张并结束', 'drawCards', '', 'is-primary'));
        if (actions.drawDiscard) dayButtons.push(actionButton('从弃牌堆摸两张', 'drawDiscard', '', 'is-blue'));
        if (actions.reorderDeck) dayButtons.push(actionButton('打开牌库顺序', 'toggleDeckOrder', '', 'is-violet'));
        if (actions.endTurn) dayButtons.push(actionButton('结束行动', 'endTurn', '', 'is-primary'));
        setCommandMarkup(body, actions.playCard || dayButtons.length
            ? `<div class="witchtown-action-card is-day">${actions.playCard ? `<div class="witchtown-action-head"><span class="witchtown-action-icon is-red">牌</span><div><b>白天行动</b><small>先选定下方手牌，再核对目标并确认打出。一回合可以连续打出多张牌。</small></div></div>${selectors}` : ''}${dayButtons.length ? `<div class="witchtown-day-buttons">${dayButtons.join('')}</div>` : ''}${actions.reorderDeck ? renderDeckOrder() : ''}</div>`
            : waitingMarkup(`${esc(state.currentTurnName || '其他玩家')} 正在行动`, '你可以查看自己的档案与手牌，轮到你时操作台会更新。'));
    }

    function waitingMarkup(title, copy) {
        return `<div class="witchtown-waiting"><span class="witchtown-waiting-dot"></span><div><strong>${esc(title)}</strong><small>${esc(copy)}</small></div></div>`;
    }

    function renderDeckOrder() {
        if (!model.deckOrderDraft) return '';
        const visualOrder = model.deckOrderDraft.slice().reverse();
        const rows = visualOrder.map((id, index) => {
            const meta = deckCardMeta(id);
            return `<li class="witchtown-deck-row is-${esc(meta.tone)}"><span><i>${index + 1}</i><b>${esc(meta.label)}</b><small>${index === 0 ? '最先抽到' : `第 ${index + 1} 张`}</small></span><span><button type="button" data-action="moveDeckCard" data-value="${esc(id)}" data-direction="up"${index === 0 ? ' disabled' : ''} aria-label="向上移动">↑</button><button type="button" data-action="moveDeckCard" data-value="${esc(id)}" data-direction="down"${index === visualOrder.length - 1 ? ' disabled' : ''} aria-label="向下移动">↓</button></span></li>`;
        }).join('');
        return `<details class="witchtown-deck-order"><summary>排列牌库 <small>顶部在前 · 共 ${visualOrder.length} 张</small></summary><p>只有确认后才会提交新顺序。牌面来自你的角色能力所允许查看的牌库。</p><ol>${rows}</ol><div class="witchtown-deck-confirm">${actionButton('恢复原顺序', 'resetDeckOrder')}${actionButton('确认新顺序', 'confirmDeckOrder', '', 'is-violet')}</div></details>`;
    }

    function renderTable() {
        const state = model.state;
        $('table-summary').textContent = `${(state.players || []).filter(player => !player.eliminated).length} 名存活 · ${state.players?.length || 0} 个席位`;
        $('table').innerHTML = (state.players || []).map(player => {
            const isCurrent = player.id === state.currentTurnId && state.status !== 'ended';
            const isMe = player.id === state.myId;
            const identity = player.identity ? `<span class="witchtown-identity-chip ${player.identity.faction === 'witch' ? 'is-witch' : 'is-town'}">${esc(player.identity.name)}</span>` : player.eliminated ? '<span class="witchtown-identity-chip is-dead">已出局</span>' : '<span class="witchtown-identity-chip is-hidden">身份隐藏</span>';
            const blue = (player.blueCards || []).map(card => `<span class="witchtown-blue-chip">${esc(card.name)}</span>`).join('');
            const red = (player.redCards || []).map(card => `<span class="witchtown-red-chip">${esc(card.name)}${card.value ? ` ${esc(card.value)}` : ''}</span>`).join('');
            const exposed = (player.exposedHandCards || []).map(card => `<span class="witchtown-exposed-chip">公开手牌 · ${esc(card.name)}</span>`).join('');
            const revealedTrials = (player.revealedTrialCards || []).map(card => `<span class="witchtown-revealed-trial is-${esc(TRIAL_META[card.type]?.tone || 'town')}">${esc(TRIAL_META[card.type]?.chinese || '审判')}</span>`).join('');
            const health = Array.from({ length: 3 }, (_, index) => `<i class="${index < (player.health || 0) ? 'is-full' : ''}"></i>`).join('');
            const threshold = player.townHall?.id === 'george-burroughs' ? 8 : 7;
            const accusation = Math.min(threshold, player.redAccusations || 0);
            const status = isCurrent ? '正在受审' : player.eliminated ? '已离席' : player.isOnline === false ? '离线' : '';
            const publicCards = `${red}${blue}${exposed || ''}`;
            return `<article class="witchtown-seat ${isCurrent ? 'is-current' : ''} ${isMe ? 'is-me' : ''} ${player.eliminated ? 'is-dead' : ''}"><div class="witchtown-seat-file"><header><span class="witchtown-seat-number">${String(player.seat || 0).padStart(2, '0')}</span><div class="witchtown-seat-name"><strong>${esc(player.name)}${isMe ? '<em>我</em>' : ''}</strong>${status ? `<small>${status}</small>` : ''}</div><div class="witchtown-seat-flags">${player.id === state.blackCatOwnerId ? '<b class="witchtown-cat-mark" title="黑猫持有者">猫</b>' : ''}${identity}</div></header><div class="witchtown-seat-role" title="${esc(player.townHall?.description || '')}"><span>${esc(player.townHall?.name || '镇议会角色')}</span><b>${player.revealedTrialCount || 0}/${player.trialCount || 0} 已揭示</b></div>${revealedTrials ? `<div class="witchtown-public-trials">${revealedTrials}</div>` : ''}<div class="witchtown-seat-status"><span class="witchtown-health" title="生命值">${health}</span><div class="witchtown-accusation-line" style="--progress:${(accusation / threshold) * 100}%"><span><i></i></span><b>${player.redAccusations || 0}<small> / ${threshold} 指控</small></b></div></div>${publicCards ? `<div class="witchtown-public-cards">${publicCards}</div>` : ''}</div></article>`;
        }).join('');
    }

    function renderPrivate() {
        const state = model.state;
        const me = state.myIdentity;
        const trialCards = (state.myTrialCards || []).map((card, index) => {
            const meta = TRIAL_META[card.type] || { label: '审判', chinese: '审判', tone: 'town' };
            const seal = card.type === 'witch' ? '巫' : card.type === 'constable' ? '槌' : '镇';
            return `<article class="witchtown-trial-card is-${esc(meta.tone)} ${card.revealed ? 'is-revealed' : 'is-secret'}"><span>${String(index + 1).padStart(2, '0')}</span><i aria-hidden="true">${seal}</i><strong>${esc(meta.label)}</strong><small>${card.revealed ? '已揭示' : '未揭示'}</small></article>`;
        }).join('');
        const witches = state.knownWitches?.length ? `<div class="witchtown-known"><span>同阵营玩家</span><strong>${state.knownWitches.map(player => esc(player.name)).join('、')}</strong></div>` : '';
        const info = state.myInfo ? `<div class="witchtown-info"><span>最近调查</span><strong>${esc(state.myInfo.targetName || '目标')} · ${state.myInfo.type === 'witch' ? '女巫牌持有者' : '非女巫'}</strong></div>` : '';
        const showDossier = model.dossierIdentityVisible || state.status === 'ended';
        const reviewCopy = state.phase === 'dossier_review'
            ? state.dossierConfirmed ? '你已完成本轮核对，仍可按住再次查看。' : '按住核对全部审判牌，松开立即封存。'
            : '审判期间可以随时按住秘密查看，松开立即封存。';
        const confirmation = state.availableActions?.confirmDossier
            ? `<div class="witchtown-dossier-actions">${actionButton(model.hasViewedDossier ? '我已核对档案' : '请先按住查看档案', 'confirmDossier', '', 'is-primary', !model.hasViewedDossier)}</div>`
            : '';
        $('private').innerHTML = `<div class="witchtown-dossier-stack ${showDossier ? 'is-revealed' : ''}"><section class="witchtown-dossier is-open" data-dossier-secret aria-hidden="${String(!showDossier)}"><div class="witchtown-dossier-ribbon"><span>私密审判档案</span><small>${esc(reviewCopy)}</small></div><div class="witchtown-faction ${me?.faction === 'witch' ? 'is-witch' : 'is-town'}"><span>当前阵营</span><strong>${esc(factionLabel(me?.faction))}</strong><small>${esc(me?.description || '你的身份信息会随牌局进程更新。')}</small></div><div class="witchtown-private-block"><div class="witchtown-private-heading"><span>审判牌</span><small>仅本人可见</small></div><div class="witchtown-trial-grid">${trialCards || '<span class="witchtown-muted">尚未发牌</span>'}</div></div>${witches}${info}</section>${state.status === 'ended' ? '' : `<button class="witchtown-dossier-cover" data-dossier-hold type="button" aria-pressed="${String(showDossier)}" aria-label="${showDossier ? '正在显示私密身份，松开立即封存' : '按住查看私密身份，松开立即封存'}"><span>SALEM · 1692</span><i aria-hidden="true">审</i><strong>密封审判档案</strong><small>${esc(reviewCopy)}</small><b>${state.dossierConfirmed ? '本轮已核对 · 按住复看' : '按住查看身份与审判牌'}</b></button>`}</div>${confirmation}`;
        syncDossierVisibility();
    }

    function renderPublicRole() {
        const hall = model.state.myTownHall;
        $('public-role').innerHTML = hall
            ? `<div class="witchtown-hall"><span class="witchtown-hall-art social-role-focus-art" style="${townHallArtStyle(hall)}" aria-hidden="true"></span><div><strong>${esc(hall.name)}</strong><p>${esc(hall.description)}</p><small>镇议会角色从开局起始终公开，不属于密封档案。</small></div></div>`
            : '<span class="witchtown-muted">尚未发放镇议会角色。</span>';
    }

    function syncDossierVisibility() {
        const state = model.state;
        const visible = Boolean((model.dossierIdentityVisible && state?.myIdentity) || state?.status === 'ended');
        const stack = $('private')?.querySelector('.witchtown-dossier-stack');
        const secret = stack?.querySelector('[data-dossier-secret]');
        const hold = stack?.querySelector('[data-dossier-hold]');
        stack?.classList.toggle('is-revealed', visible);
        secret?.setAttribute('aria-hidden', String(!visible));
        hold?.setAttribute('aria-pressed', String(visible));
        hold?.setAttribute('aria-label', visible ? '正在显示私密身份，松开立即封存' : '按住查看私密身份，松开立即封存');
    }

    function setDossierIdentityVisible(visible) {
        const state = model.state;
        model.dossierIdentityVisible = Boolean(visible && state?.myIdentity && state.status !== 'ended');
        if (model.dossierIdentityVisible) {
            model.hasViewedDossier = true;
            const confirm = $('private')?.querySelector('[data-action="confirmDossier"]');
            if (confirm) {
                confirm.disabled = false;
                confirm.textContent = '我已核对档案';
            }
        }
        syncDossierVisibility();
    }

    function updatePlayConfirmText() {
        const state = model.state;
        const target = mount.querySelector('[data-role="play-confirm-target"]');
        if (!target || !state) return;
        const card = selectedHandCard();
        const primary = playerById(state, readSelect('playCard'))?.name || '未选择';
        const secondary = playerById(state, readSelect('playCard2'))?.name;
        const blue = playerById(state, readSelect('playCard'))?.blueCards?.find(item => item.id === readSelect('curseBlue'))?.name;
        target.textContent = `目标：${primary}${card && ['robbery', 'scapegoat'].includes(card.kind) ? ` · 接收者：${secondary || '未选择'}` : ''}${card?.kind === 'curse' ? ` · 持续牌：${blue || '未选择'}` : ''}`;
    }

    function isPlayDraftValid(card = selectedHandCard()) {
        const state = model.state;
        if (!card || !playerById(state, readSelect('playCard'))) return false;
        if (['robbery', 'scapegoat'].includes(card.kind)) {
            const second = readSelect('playCard2');
            if (!playerById(state, second) || second === readSelect('playCard')) return false;
        }
        if (card.kind === 'curse') {
            const target = playerById(state, readSelect('playCard'));
            if (!(target?.blueCards || []).some(item => item.id === readSelect('curseBlue'))) return false;
        }
        return true;
    }

    function renderHand() {
        const state = model.state;
        const canPlay = state.phase === 'day' && Boolean(state.availableActions?.playCard);
        const cards = (state.myHand || []).map(card => cardMarkup(card, canPlay)).join('');
        $('hand-summary').textContent = `${state.myHand?.length || 0} 张 · ${canPlay ? '可行动' : '等待行动'}`;
        const selected = (state.myHand || []).find(card => card.id === model.pendingCardId);
        const selectedMeta = selected ? CARD_META[selected.kind] || { label: selected.name || '游戏牌' } : null;
        const draftReady = selected ? isPlayDraftValid(selected) : false;
        const confirm = selected ? `<div class="witchtown-card-confirm"><span class="witchtown-confirm-seal">审</span><div><small>待提交证词</small><strong>${esc(selectedMeta.label)}</strong><p data-role="play-confirm-target">正在核对目标……</p></div>${actionButton(draftReady ? '确认打出' : '请补全目标', 'confirmPlay', selected.id, 'is-danger', !draftReady)}</div>` : '';
        $('hand').innerHTML = `<div class="witchtown-hand-note"><span class="witchtown-hand-lock">${canPlay ? '行动中' : '私密手牌'}</span><small>${canPlay ? '点选手牌后，在确认条核对目标' : '手牌内容不会公开给其他玩家'}</small></div><div class="witchtown-card-grid">${cards || '<div class="witchtown-empty-hand">手牌暂为空</div>'}</div>${confirm}`;
        updatePlayConfirmText();
    }

    function cardMarkup(card, canPlay) {
        const meta = CARD_META[card.kind] || { label: card.name || '游戏牌', tone: 'black', copy: '特殊游戏牌' };
        const cardType = { red: '指控牌', green: '行动牌', blue: '持续牌', black: '事件牌' }[meta.tone] || '游戏牌';
        const sigil = CARD_SIGILS[card.kind] || '◆';
        const selected = model.pendingCardId === card.id;
        const button = canPlay ? actionButton(selected ? '已预选' : '预选此牌', 'selectCard', card.id, `is-card-action ${selected ? 'is-selected' : ''}`) : '';
        return `<article class="witchtown-card is-${esc(meta.tone)} is-kind-${esc(card.kind)} ${selected ? 'is-selected' : ''}"><div class="witchtown-card-top"><span>${cardType}</span>${card.value ? `<b>${esc(card.value)} 点</b>` : '<b>·</b>'}</div><div class="witchtown-card-main"><span class="witchtown-card-scene" aria-hidden="true"><i>${sigil}</i></span><strong>${esc(meta.label || card.name)}</strong><small>${esc(meta.copy)}</small></div>${button ? `<div class="witchtown-card-action">${button}</div>` : ''}</article>`;
    }

    function renderLog() {
        const state = model.state;
        const entries = (state.actionLog || []).slice().reverse();
        $('log').innerHTML = entries.length ? entries.map((entry, index) => `<div class="witchtown-log-entry ${index === 0 ? 'is-latest' : ''}"><i></i><span>${esc(entry)}</span></div>`).join('') : '<span class="witchtown-muted">牌局开始后，事件会记录在这里。</span>';
    }

    function readSelect(action) {
        return mount.querySelector(`select[data-select-for="${action}"]`)?.value || '';
    }

    return {
        render,
        renderCommand,
        renderHand,
        renderPrivate,
        isPlayDraftValid,
        selectedHandCard,
        updatePlayConfirmText,
        readSelect,
        setDossierIdentityVisible,
        syncDossierVisibility,
    };
}
