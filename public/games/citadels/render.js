import { COLOR_META, ROLE_META, escapeHtml } from './constants.js';
import { cityCardMarkup, colorMeta, districtBack, districtCardMarkup, roleArt, roleBack, roleMeta } from './cards.js';
import { currentRoleMeta, decisionDetails, playerById, toggleSelection } from './state.js';

/** Dynamic command, city and player rendering for 富饶之城. */
export function createCitadelsRenderer({ mount, model, getElement }) {
    const $ = getElement || (role => mount.querySelector(`[data-role="${role}"]`));
    const state = () => model.state;
    const presentationLocked = () => model.presentationPlaying || Date.now() < Number(model.presentationLockedUntil || 0);

    function actionButton(label, action, value = '', className = '', disabled = false) {
        return `<button class="citadels-button ${className}" data-action="${escapeHtml(action)}" data-value="${escapeHtml(value)}" type="button"${disabled || model.actionPending || presentationLocked() ? ' disabled' : ''}>${escapeHtml(model.actionPending ? '处理中…' : label)}</button>`;
    }

    function decisionButton(label, kind, value = '', className = '', disabled = false) {
        return `<button class="citadels-button ${className}" data-action="prepareDecision" data-decision-kind="${escapeHtml(kind)}" data-value="${escapeHtml(value)}" type="button"${disabled ? ' disabled' : ''}>${escapeHtml(label)}</button>`;
    }

    function decisionConfirmMarkup(decision = model.pendingDecision) {
        const details = decisionDetails(state(), model, decision);
        if (!details) return '';
        return `<div class="citadels-decision-confirm ${details.danger ? 'is-danger' : ''}"><span><small>${escapeHtml(details.eyebrow)}</small><strong>${escapeHtml(details.title)}</strong><em>${escapeHtml(details.copy)}</em></span><div><button class="citadels-button is-muted" data-action="cancelDecision" type="button">取消</button><button class="citadels-button ${details.danger ? 'is-danger' : 'is-primary'}" data-action="confirmDecision" type="button">确认执行</button></div></div>`;
    }

    function roleDraftInfo(up) {
        const current = state();
        const faceUp = up.length ? `<span class="citadels-draft-face-up"><small>明置</small>${up.map(item => `<span title="${item.rank} · ${escapeHtml(item.name)}">${roleArt(item, 'draft')}</span>`).join('')}</span>` : '';
        return `<div class="citadels-draft-track" aria-label="角色牌堆状态"><span class="citadels-draft-component"><span class="citadels-role-stack is-pile">${roleBack('draft')}</span><span><b>${current.roleDeckCount || 0}</b><small>张待选</small></span></span><span class="citadels-draft-component"><span class="citadels-role-stack">${roleBack('draft')}</span><span><b>${current.faceDownCount || 0}</b><small>张暗置</small></span></span>${faceUp}</div>`;
    }

    function roleOption(role, action, value, className = '') {
        const meta = roleMeta(role);
        const optionValue = value || role.id;
        const selected = model.pendingRoleId === optionValue && model.pendingRoleAction === action;
        return `<button class="citadels-role-option role-${meta.accent} ${className} ${selected ? 'is-selected' : ''}" data-action="selectRole" data-role-action="${escapeHtml(action)}" data-value="${escapeHtml(optionValue)}" type="button" aria-pressed="${selected}">${roleArt(role, 'mini')}<span class="citadels-role-option-copy"><small>角色 ${meta.rank}</small><strong>${escapeHtml(meta.name)}</strong><em>${escapeHtml(meta.description)}</em></span><span class="citadels-role-option-arrow">›</span></button>`;
    }

    function phaseLabels() {
        const current = state();
        if (current?.status === 'ended') return { kicker: '最终账本', label: '牌局结束' };
        if (current?.phase === 'role_selection') return { kicker: '秘密选角', label: '秘密选角' };
        return { kicker: '角色回合', label: current?.currentRoleName ? `角色 ${current.currentRoleRank} · ${current.currentRoleName}` : '角色行动' };
    }

    function render() {
        const current = state();
        if (!current) return;
        syncSelection();
        const root = mount.querySelector('[data-game-root]');
        root?.setAttribute('aria-busy', String(model.actionPending || presentationLocked()));
        root?.classList.toggle('is-draft-phase', current.phase === 'role_selection' && current.status !== 'ended');
        root?.classList.toggle('is-ended-phase', current.status === 'ended');
        const phase = phaseLabels();
        $('round').textContent = current.status === 'ended' ? '完' : `第 ${current.round || '—'}`;
        $('phase').textContent = phase.label;
        $('currentRole').textContent = current.status === 'ended' ? '已结算' : current.currentRoleName ? `${current.currentRoleRank} · ${current.currentRoleName}` : current.phase === 'role_selection' ? '秘密选角' : '等待呼叫';
        $('crown').textContent = playerById(current, current.crownHolderId)?.name || '—';
        $('room').textContent = current.roomId ? `房间 ${current.roomId}` : '富饶之城';
        renderCommand(); renderRoleTrack(); renderCities(); renderHand(); renderLedger(); renderPlayers(); renderLog();
        $('hint').textContent = hintText();
        if (model.actionPending || presentationLocked()) mount.querySelectorAll('button[data-action]:not([data-action="skipPresentation"]), input, select').forEach(control => { control.disabled = true; });
    }

    function clearError() {
        const banner = $('errorBanner');
        banner.textContent = '';
        banner.classList.add('is-hidden');
    }

    function showError(message) {
        const banner = $('errorBanner');
        banner.textContent = message || '操作失败，请重试';
        banner.classList.remove('is-hidden');
        banner.focus({ preventScroll: true });
    }

    function syncSelection() {
        const current = state();
        const drawIds = new Set((current?.myDrawOptions || []).map(card => card.id));
        if (current?.myDrawOptions?.length) model.selectedCardIds = model.selectedCardIds.filter(id => drawIds.has(id));
        if (!current?.availableActions?.magicianSwap) {
            model.swapMode = false;
            if (!current?.myDrawOptions?.length) model.selectedCardIds = [];
        }
        const roleAction = current?.availableActions?.discardRole ? 'discardRole' : current?.availableActions?.chooseRole ? 'chooseRole' : null;
        const roleOptions = roleAction === 'discardRole' ? current?.discardOptions || [] : current?.availableRoles || [];
        if (!roleAction || model.pendingRoleAction !== roleAction || !roleOptions.some(role => role.id === model.pendingRoleId)) { model.pendingRoleId = null; model.pendingRoleAction = null; }
        const me = playerById(current, current?.myId);
        const buildCard = (current?.myHand || []).find(card => card.id === model.pendingBuildId);
        if (!current?.availableActions?.buildDistrict || !buildCard || (me?.gold || 0) < buildCard.cost || me?.city?.some(card => card.name === buildCard.name)) model.pendingBuildId = null;
        const decisionAvailable = model.pendingDecision && current?.availableActions?.[model.pendingDecision.kind];
        if (!decisionAvailable) model.pendingDecision = null;
    }

    function renderRoleTrack() {
        const current = state();
        const faceUp = new Set((current.faceUpRoles || []).map(role => role.id));
        $('roleTrack').innerHTML = Object.entries(ROLE_META).map(([id, meta]) => {
            const isCurrent = current.phase === 'character_turn' && meta.rank === current.currentRoleRank;
            const isPast = current.phase === 'character_turn' && meta.rank < current.currentRoleRank;
            const isFaceUp = current.phase === 'role_selection' && faceUp.has(id);
            const status = isCurrent ? '正在呼叫' : isPast ? '已呼叫' : isFaceUp ? '本轮明置' : '等待';
            return `<span class="citadels-role-step role-${meta.accent} ${isCurrent ? 'is-current' : ''} ${isPast ? 'is-past' : ''} ${isFaceUp ? 'is-face-up' : ''}" data-role-id="${escapeHtml(id)}"><b>${meta.rank}</b><strong>${escapeHtml(meta.name)}</strong><small>${status}</small></span>`;
        }).join('');
    }

    function hintText() {
        const current = state();
        if (!current) return '等待牌局状态';
        if (current.status === 'ended') {
            const names = (current.winners?.length ? current.winners : current.winner ? [current.winner] : []).map(item => item.name).join('、');
            return `${names || '本局'} 获胜 · 城市账本已封存`;
        }
        if (current.phase === 'role_selection') {
            if (current.availableActions?.discardRole) return '暗置一张角色牌，继续秘密选角';
            if (current.availableActions?.chooseRole) return `轮到你选角 · ${current.myRoles?.length || 0} / ${current.players?.length <= 3 ? 2 : 1}`;
            return current.draftDiscarding ? '等待当前玩家暗置角色牌' : '等待其他玩家完成秘密选角';
        }
        const actions = current.availableActions || {};
        if (actions.graveyardRecover || actions.declineGraveyard) return '你的墓地正在等待决定';
        if (current.myDrawOptions?.length) return `从摸到的牌中保留 ${current.myDrawKeepCount || 1} 张`;
        if (model.swapMode) return `已选 ${model.selectedCardIds.length} 张 · 点击手牌选择要换掉的牌`;
        if (actions.closeBuild) return '军阀：建造完成后，先结束建造阶段再选择目标';
        if (actions.endTurn) return '资源、能力与建造完成后，结束当前角色回合';
        const currentPlayer = playerById(current, current.currentPlayerId);
        return `等待 ${currentPlayer?.name || '下一位角色'} 行动`;
    }

    function renderCommand() {
        const current = state();
        const phase = phaseLabels();
        const commandKicker = $('commandKicker');
        const title = $('commandTitle');
        const copy = $('commandCopy');
        const status = $('commandStatus');
        const body = $('commandBody');
        const footer = $('commandFooter');
        commandKicker.textContent = phase.kicker;
        footer.innerHTML = '';
        const amDraftPlayer = current.phase === 'role_selection' && current.draftPlayerId === current.myId;
        const amCurrentPlayer = current.currentPlayerId === current.myId;
        const activeForMe = Boolean(amDraftPlayer || amCurrentPlayer || current.availableActions?.graveyardRecover || current.availableActions?.declineGraveyard);
        status.innerHTML = current.status === 'ended' ? '<span class="citadels-status-badge is-ended">已结算</span>' : `<span class="citadels-status-badge ${activeForMe ? 'is-mine' : ''}">${activeForMe ? '轮到我' : '等待中'}</span>`;
        if (current.status === 'ended') {
            const winnerNames = (current.winners?.length ? current.winners : current.winner ? [current.winner] : []).map(item => item.name).join('、');
            const personalWinner = current.winners?.some(item => String(item.id) === String(current.myId));
            title.textContent = personalWinner ? '您已获胜' : `${winnerNames || '本局'} 获胜`;
            copy.textContent = personalWinner ? '您建成了最辉煌的城市，终局城市账本已经结算。' : '终局城市账本已经结算，下面保留本局的最终排名。';
            body.innerHTML = `<div class="citadels-scoreboard">${(current.scores || []).map((score, index) => `<div class="citadels-score-row ${current.winners?.some(item => item.id === score.id) ? 'is-winner' : ''}"><b>${String(index + 1).padStart(2, '0')}</b><span><strong>${escapeHtml(score.name)}</strong><small>城区 ${score.districtSum} · 首建 +${score.firstFinisherBonus || 0} · 八城 +${score.eightCityBonus || 0} · 五色 +${score.colorBonus || 0} · 特殊 +${(score.treasuryBonus || 0) + (score.mapRoomBonus || 0)}</small></span><em>${score.score}<small>分</small></em></div>`).join('')}</div>`;
            return;
        }
        if (current.phase === 'role_selection') { renderRoleSelection(title, copy, body); return; }
        renderCharacterCommand(title, copy, body, footer, amCurrentPlayer);
    }

    function renderRoleSelection(title, copy, body) {
        const current = state();
        const up = current.faceUpRoles || [];
        const roleInfo = roleDraftInfo(up);
        if (current.availableActions?.discardRole) {
            title.textContent = '暗置一张角色牌'; copy.textContent = '这张牌将从本轮公开信息中消失，其他玩家不会知道你的选择。';
            body.innerHTML = `<div class="citadels-draft-top"><div><span class="citadels-command-note-label">当前步骤</span><strong>从角色牌堆中选择一张暗置</strong></div>${roleInfo}</div><div class="citadels-role-grid">${(current.discardOptions || []).map(item => roleOption(item, 'discardRole', item.id, 'is-discard')).join('')}</div>${roleConfirmMarkup('discardRole', '确认暗置角色')}`;
            return;
        }
        if (current.availableActions?.chooseRole) {
            const count = current.myRoles?.length || 0;
            const total = current.players?.length <= 3 ? 2 : 1;
            title.textContent = `选择你的${total > 1 ? `第 ${count + 1} 个` : ''}角色`;
            copy.textContent = total > 1 ? `你控制 ${total} 个角色，已选择 ${count} 个；每个角色会在对应编号被呼叫。` : '选定后角色牌会保持私密，轮到对应编号时才会揭示。';
            body.innerHTML = `<div class="citadels-draft-top"><div><span class="citadels-command-note-label">我的选择</span><strong>${count ? `已选：${current.myRoles.map(item => escapeHtml(item.name)).join('、')}` : '选择一张适合你城市的角色'}</strong></div>${roleInfo}</div><div class="citadels-role-grid">${(current.availableRoles || []).map(item => roleOption(item, 'chooseRole', item.id)).join('')}</div>${roleConfirmMarkup('chooseRole', '确认选择角色')}`;
            return;
        }
        title.textContent = '秘密选角进行中'; copy.textContent = current.draftDiscarding ? '当前玩家正在暗置角色牌。' : '角色选择会按皇冠顺序推进，选定后才会公开行动。';
        body.innerHTML = `<div class="citadels-waiting"><span class="citadels-pulse"></span><div><strong>等待其他玩家完成选择</strong><small>${current.draftPlayerId ? `${escapeHtml(playerById(current, current.draftPlayerId)?.name || '下一位玩家')} 正在看牌` : '角色牌正在重新整理'}</small></div></div>${roleInfo}`;
    }

    function roleConfirmMarkup(action, label) {
        const meta = model.pendingRoleId ? roleMeta(model.pendingRoleId) : null;
        return `<div class="citadels-role-confirm ${meta ? `role-${meta.accent}` : ''}"><span><small>${meta ? '准备提交本轮选择' : '先从上方预选一张角色牌'}</small><strong>${meta ? `${meta.rank} · ${escapeHtml(meta.name)}` : '尚未预选'}</strong></span><button class="citadels-button is-primary" data-action="confirmRole" data-role-action="${escapeHtml(action)}" type="button" ${meta ? '' : 'disabled'}>${escapeHtml(label)}</button></div>`;
    }

    function renderCharacterCommand(title, copy, body, footer, amCurrentPlayer) {
        const current = state();
        const meta = currentRoleMeta(current);
        const roleOwner = playerById(current, current.currentPlayerId);
        title.textContent = current.currentRoleName ? `${current.currentRoleRank} · ${current.currentRoleName} 的回合` : '角色行动';
        copy.textContent = roleOwner ? `${roleOwner.name} 正在执行 ${meta?.name || current.currentRoleName || '角色'}。` : '角色牌按编号依次揭示。';
        const roleHero = `<div class="citadels-role-hero ${meta ? `role-${meta.accent}` : ''}">${meta ? roleArt(meta) : '<span class="citadels-role-placeholder">?</span>'}<div class="citadels-role-hero-copy"><span class="citadels-command-note-label">已呼叫角色 · ${meta?.rank || '—'}号</span><strong>${escapeHtml(meta?.name || current.currentRoleName || '等待呼叫')}</strong><p>${escapeHtml(meta?.description || '角色能力将在牌局状态更新后显示。')}</p><small>${roleOwner ? `当前玩家：${escapeHtml(roleOwner.name)}` : '等待角色持有者'}</small></div><div class="citadels-my-role-strip"><span>我的角色</span><b>${(current.myRoles || []).map(item => `${item.rank} · ${escapeHtml(item.name)}`).join(' / ') || '—'}</b></div></div>`;
        if (current.availableActions?.graveyardRecover || current.availableActions?.declineGraveyard) {
            const pending = current.pendingGraveyard;
            title.textContent = '墓地回收决定'; copy.textContent = `军阀摧毁了你的${pending?.cardName || '城区'}，墓地可以让它回到手牌.`;
            body.innerHTML = `${roleHero}<div class="citadels-reaction"><span class="citadels-reaction-mark">墓</span><div><strong>支付 1 金回收${escapeHtml(pending?.cardName || '被摧毁的城区')}</strong><small>回收不会占用当前角色的行动。</small></div><div class="citadels-action-row">${current.availableActions.graveyardRecover ? actionButton('支付 1 金回收', 'graveyardRecover', '', 'is-primary') : ''}${actionButton('放弃回收', 'declineGraveyard', '', 'is-danger')}</div></div>`;
            return;
        }
        if (!amCurrentPlayer) { body.innerHTML = `${roleHero}<div class="citadels-waiting"><span class="citadels-pulse"></span><div><strong>${escapeHtml(roleOwner?.name || '当前玩家')} 正在行动</strong><small>你可以查看自己的城市与手牌，轮到你时操作会出现在这里。</small></div></div>`; return; }
        const actions = current.availableActions || {};
        const parts = [roleHero];
        if (actions.assassinate) parts.push(`<section class="citadels-action-section"><div class="citadels-action-section-head"><span>角色能力</span><strong>宣布暗杀</strong></div><div class="citadels-action-row"><label class="citadels-select"><span>目标角色</span><select data-select-for="assassinate">${roleChoices(['assassin']).map(([id, name]) => `<option value="${id}">${escapeHtml(name)}</option>`).join('')}</select></label>${decisionButton('核对暗杀对象', 'assassinate', '', 'is-danger')}</div></section>`);
        if (actions.rob) parts.push(`<section class="citadels-action-section"><div class="citadels-action-section-head"><span>角色能力</span><strong>指定盗窃目标</strong></div><div class="citadels-action-row"><label class="citadels-select"><span>目标角色</span><select data-select-for="rob">${roleChoices(['assassin', 'thief']).filter(([id]) => id !== current.killedRole).map(([id, name]) => `<option value="${id}">${escapeHtml(name)}</option>`).join('')}</select></label>${decisionButton('核对盗窃对象', 'rob', '', 'is-danger')}</div></section>`);
        if (actions.magicianExchange) parts.push(`<section class="citadels-action-section"><div class="citadels-action-section-head"><span>角色能力</span><strong>交换全部手牌</strong></div><div class="citadels-action-row"><label class="citadels-select"><span>交换对象</span><select data-select-for="magicianExchange">${(current.players || []).filter(player => player.id !== current.myId).map(player => `<option value="${escapeHtml(player.id)}">${escapeHtml(player.name)}</option>`).join('')}</select></label>${decisionButton('核对交换对象', 'magicianExchange', '', 'is-violet')}</div></section>`);
        if (actions.magicianSwap) parts.push(`<section class="citadels-action-section"><div class="citadels-action-section-head"><span>角色能力</span><strong>${model.swapMode ? `已选 ${model.selectedCardIds.length} 张牌` : '弃牌并补回等量牌'}</strong></div><p class="citadels-action-copy">${model.swapMode ? '在下方手牌中选择任意数量，再确认换牌。' : '可以弃掉任意数量的手牌，并从牌堆补回同样数量。'}</p><div class="citadels-action-row">${model.swapMode ? actionButton(`确认换 ${model.selectedCardIds.length} 张`, 'confirmSwap', '', 'is-violet', false) : actionButton('选择要弃掉的牌', 'startSwap', '', 'is-violet')}</div></section>`);
        if (actions.takeGold || actions.drawDistrict || actions.collectIncome) { const resourceCards = []; if (actions.takeGold) resourceCards.push(actionButton('拿 2 金', 'takeGold', '', 'is-resource', false)); if (actions.drawDistrict) resourceCards.push(actionButton('摸城区牌', 'drawDistrict', '', 'is-resource', false)); if (actions.collectIncome) resourceCards.push(actionButton('领取角色收入', 'collectIncome', '', 'is-income', false)); parts.push(`<section class="citadels-action-section"><div class="citadels-action-section-head"><span>本回合第一步</span><strong>选择资源</strong></div><div class="citadels-resource-grid">${resourceCards.join('')}</div><p class="citadels-action-copy">先选择金币或城区牌；有颜色的角色还可以领取对应城区收入。</p></section>`); }
        if (actions.keepDistrict) parts.push(`<div class="citadels-draw-callout"><b>摸牌完成</b><span>请在下方牌面选择保留 ${current.myDrawKeepCount || 1} 张。</span></div>`);
        if (actions.smithy) parts.push(`<section class="citadels-action-section citadels-utility-action"><div><span>紫色独特区</span><strong>铁匠铺</strong><small>支付 3 金，额外摸 2 张城区牌。</small></div>${actionButton('使用铁匠铺', 'smithy', '', 'is-violet')}</section>`);
        if (actions.closeBuild) parts.push(`<section class="citadels-action-section citadels-utility-action is-warlord"><div><span>军阀阶段</span><strong>结束建造阶段</strong><small>结束后才可以选择是否摧毁其他城市的城区。</small></div>${actionButton('结束建造', 'closeBuild', '', 'is-primary')}</section>`);
        if (actions.destroyDistrict) { const targets = (current.destroyTargets || []).map(target => ({ label: `${target.targetName} · ${target.card.name} · ${target.cost} 金${target.greatWall ? ' · 长城' : ''}`, value: `${target.targetId}::${target.card.id}` })); parts.push(`<section class="citadels-action-section citadels-utility-action is-warlord"><div><span>军阀阶段</span><strong>摧毁一座城区</strong><small>列表只显示服务器核定后可摧毁且付得起的城区。</small></div><div class="citadels-action-row"><label class="citadels-select"><span>目标</span><select data-select-for="destroyDistrict">${targets.length ? targets.map(target => `<option value="${escapeHtml(target.value)}">${escapeHtml(target.label)}</option>`).join('') : '<option value="">暂无可选城区</option>'}</select></label>${decisionButton('核对摧城令', 'destroyDistrict', '', 'is-danger', !targets.length)}</div></section>`); }
        if (actions.endTurn) parts.push(`<div class="citadels-end-turn-row"><span>城区行动完成后结束这张角色牌的回合</span>${actionButton('结束角色回合', 'endTurn', '', 'is-primary')}</div>`);
        if (model.pendingDecision && model.pendingDecision.kind !== 'laboratory') parts.push(decisionConfirmMarkup());
        body.innerHTML = parts.join('');
    }

    function roleChoices(excluded = []) { return Object.entries(ROLE_META).filter(([id]) => !excluded.includes(id)).map(([id, meta]) => [id, meta.name]); }

    function renderLedger() {
        const current = state();
        const me = playerById(current, current.myId);
        const city = me?.city || [];
        const colors = Object.keys(COLOR_META).map(color => ({ color, count: city.filter(card => card.color === color).length }));
        $('ledger').innerHTML = `<div class="citadels-ledger-balance"><span class="citadels-coin-mark">金</span><div><small>当前金币</small><strong>${me?.gold ?? 0}</strong></div><span class="citadels-ledger-unit">金币</span></div><div class="citadels-ledger-stats"><span><b>${city.length}</b><small>城区 / 8</small></span><span><b>${current.myHand?.length || 0}</b><small>手牌</small></span><span><b>${current.districtDeckCount || 0}</b><small>牌库</small></span></div><div class="citadels-my-roles"><span>已持角色</span><div>${(current.myRoles || []).length ? current.myRoles.map(item => `<span class="citadels-role-chip role-${roleMeta(item).accent}">${item.rank} · ${escapeHtml(item.name)}</span>`).join('') : '<em>角色尚未揭示</em>'}</div></div><div class="citadels-color-meter">${colors.map(item => `<span class="color-meter-${colorMeta(item.color).className}" style="--count:${item.count}" title="${colorMeta(item.color).name} ${item.count} 座"><i></i><b>${item.count}</b></span>`).join('')}</div>`;
        $('stageSummary').innerHTML = `<span><b>${city.length}</b> / 8 城区</span><span><b>${current.myHand?.length || 0}</b> 张手牌</span><span class="citadels-stage-deck">${districtBack('micro')}<b>${current.districtDeckCount || 0}</b> 张牌库</span>`;
        $('handNote').textContent = `${current.myHand?.length || 0} 张 · 仅你可见`;
    }

    function renderPlayers() {
        const current = state();
        $('players').innerHTML = (current.players || []).map((player, index) => {
            const murderedRoleIds = new Set((player.murderedRoles || []).map(item => item.id));
            const revealed = player.roles?.length ? player.roles.map(item => `${item.name}${murderedRoleIds.has(item.id) ? '（缺席）' : ''}`).join('、') : player.murdered ? '本轮缺席' : '角色隐藏';
            const status = player.isOnline === false ? '离线' : player.isCurrentTurn ? '正在行动' : revealed;
            const onlyMurderedRolesRevealed = murderedRoleIds.size > 0 && murderedRoleIds.size === (player.roles?.length || 0);
            return `<article class="citadels-player ${player.isCurrentTurn ? 'is-current' : ''} ${player.id === current.myId ? 'is-me' : ''} ${onlyMurderedRolesRevealed ? 'is-murdered' : ''}" data-player-id="${escapeHtml(player.id)}"><span class="citadels-player-index">${String(index + 1).padStart(2, '0')}</span><span class="citadels-player-copy"><strong>${escapeHtml(player.name)}${player.id === current.myId ? '<em>我</em>' : ''}${player.id === current.crownHolderId ? '<i class="citadels-player-crown" title="皇冠持有者">♛</i>' : ''}</strong><small>${escapeHtml(status)}</small></span><span class="citadels-player-assets"><b>${player.gold}</b><small>金</small><b>${player.cityCount}</b><small>区</small></span></article>`;
        }).join('');
    }

    function renderCities() {
        const current = state();
        $('cities').innerHTML = (current.players || []).map((player, index) => `<article class="citadels-city-row ${player.isCurrentTurn ? 'is-current' : ''} ${player.id === current.myId ? 'is-me' : ''}" data-city-owner="${escapeHtml(player.id)}"><header><span class="citadels-city-order">${String(index + 1).padStart(2, '0')}</span><strong>${escapeHtml(player.name)}${player.id === current.myId ? '<em>我的城市</em>' : ''}</strong>${player.id === current.crownHolderId ? '<span class="citadels-crown-label">♛ 皇冠</span>' : ''}<span class="citadels-city-count"><i style="--built:${Math.min(8, player.cityCount || 0)}"></i><b>${player.cityCount} / 8</b></span></header><div class="citadels-city-cards">${player.city?.length ? player.city.map(card => cityCardMarkup(card, player.id)).join('') : '<span class="citadels-empty-city">尚未建造城区</span>'}</div></article>`).join('');
    }

    function renderHand() {
        const current = state();
        const hand = $('hand');
        const actions = current.availableActions || {};
        const drawOptions = current.myDrawOptions || [];
        if (drawOptions.length) {
            const keepCount = current.myDrawKeepCount || 1;
            hand.innerHTML = `<div class="citadels-hand-callout"><span class="citadels-callout-mark">摸牌</span><div><strong>选择保留 ${keepCount} 张</strong><small>未保留的牌会回到城区牌堆底部。</small></div><b>${model.selectedCardIds.length} / ${keepCount}</b></div><div class="citadels-card-grid">${drawOptions.map(card => { const selected = model.selectedCardIds.includes(card.id); const buttons = keepCount > 1 ? actionButton(selected ? '已选择' : '选择保留', 'toggleKeep', card.id, selected ? 'is-primary' : '', false) : actionButton('保留这张', 'keepDistrict', card.id, 'is-primary'); return districtCardMarkup(card, buttons, selected); }).join('')}</div>${keepCount > 1 ? `<div class="citadels-hand-confirm">${actionButton(`保留所选（${model.selectedCardIds.length} / ${keepCount}）`, 'confirmKeep', '', 'is-primary', model.selectedCardIds.length !== keepCount)}</div>` : ''}`;
            return;
        }
        const me = playerById(current, current.myId);
        const cards = current.myHand || [];
        if (!cards.length) { hand.innerHTML = '<div class="citadels-empty-hand"><span>○</span><strong>手牌暂为空</strong><small>摸到城区牌后，牌面会出现在这里。</small></div>'; return; }
        const cardGrid = `<div class="citadels-card-grid">${cards.map(card => { const duplicate = Boolean(me?.city?.some(existing => existing.name === card.name)); const cannotBuild = duplicate || (me?.gold || 0) < card.cost; const buttons = []; if (model.swapMode) buttons.push(actionButton(model.selectedCardIds.includes(card.id) ? '已选择' : '选择弃掉', 'toggleSwap', card.id, model.selectedCardIds.includes(card.id) ? 'is-violet' : '')); else if (actions.buildDistrict) buttons.push(actionButton(duplicate ? '城市已有同名' : model.pendingBuildId === card.id ? '已预选' : '预选建造', 'selectBuild', card.id, duplicate ? 'is-muted' : model.pendingBuildId === card.id ? 'is-primary' : '', cannotBuild)); if (actions.laboratory) buttons.push(decisionButton(model.pendingDecision?.kind === 'laboratory' && model.pendingDecision.value === card.id ? '已预选弃置' : '实验室弃牌', 'laboratory', card.id, 'is-violet')); return districtCardMarkup(card, buttons.join(''), model.selectedCardIds.includes(card.id) || model.pendingBuildId === card.id, cannotBuild && actions.buildDistrict && !model.swapMode); }).join('')}</div>`;
        const buildCard = cards.find(card => card.id === model.pendingBuildId);
        const buildConfirm = buildCard && actions.buildDistrict && !model.swapMode ? `<div class="citadels-build-confirm"><span><small>准备加入我的城市</small><strong>${escapeHtml(buildCard.name)} · 支付 ${buildCard.cost} 金</strong></span><button class="citadels-button is-primary" data-action="confirmBuild" type="button">确认建造</button></div>` : '';
        const laboratoryConfirm = model.pendingDecision?.kind === 'laboratory' ? decisionConfirmMarkup() : '';
        hand.innerHTML = `${cardGrid}${buildConfirm}${laboratoryConfirm}`;
    }

    function renderLog() {
        const entries = (state().actionLog || []).slice().reverse();
        $('log').innerHTML = entries.length ? entries.map((entry, index) => `<div class="citadels-log-entry ${index === 0 ? 'is-latest' : ''}"><i></i><span>${escapeHtml(entry)}</span></div>`).join('') : '<p class="citadels-empty-log">牌局开始后，城中的传闻会记录在这里。</p>';
    }

    return { render, clearError, showError, renderHand, renderCommand, renderRoleTrack, renderLedger, toggleSelection: (id, limit) => toggleSelection(model, id, limit) };
}
