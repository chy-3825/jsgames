import { ACTIONS, ACTION_GROUPS, CARD_BACK_ART, ROLE_ART, ROLE_EFFECTS, ROLE_MARKS, ROLE_NAMES, SCENE_ACTION_NAMES, escapeHtml } from './constants.js';
import { renderActionVisual, renderBlockDeclaration, renderInfluence } from './cards.js';
import { challengeLabel, decisionReady, firstCharacter, getAction, getActionName, getPlayer, getSelf, isMyTurn, revealReason } from './state.js';

const esc = escapeHtml;

/** Dynamic board, command and overlay rendering for 政变. */
export function createCoupRenderer({ mount, model, getElement, windowRef = globalThis.window || globalThis, documentRef = globalThis.document }) {
    const $ = getElement || (role => mount.querySelector(`[data-role="${role}"]`));
    const root = mount.querySelector('.cp-app');
    const reducedMotion = windowRef.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;

    function syncPrivateIdentityVisibility() {
        const state = model.state;
        const visible = Boolean(model.privateIdentityVisible && state && !state.gameOver);
        root.classList.toggle('is-identity-revealed', visible);
        mount.querySelectorAll('[data-private-identity]').forEach(element => element.setAttribute('aria-hidden', String(!visible)));
        mount.querySelectorAll('[data-private-role-label]').forEach(element => element.setAttribute('aria-label', visible ? element.dataset.privateRoleLabel : element.dataset.coveredRoleLabel));
        mount.querySelectorAll('[data-identity-hold]').forEach(element => {
            element.setAttribute('aria-pressed', String(visible));
            element.setAttribute('aria-label', visible ? '正在显示私密身份，松开立即隐藏' : '按住查看私密身份，松开立即隐藏');
            const label = element.querySelector('b');
            if (label) label.textContent = visible ? '松开立即隐藏' : '按住查看身份';
        });
    }

    function render() {
        const state = model.state;
        if (!state) return;
        const self = getSelf(state);
        const myTurn = isMyTurn(state);
        const alive = (state.players || []).filter(player => player.isAlive !== false).length;
        const turnName = getPlayer(state, state.currentTurn)?.name || '其他玩家';
        const phase = getPhaseLabel();

        root.classList.toggle('is-my-turn', myTurn);
        root.classList.toggle('is-decision', Boolean(state.challenge?.isMyTurn || state.influenceLoss?.isMyTurn || state.exchange?.isMyTurn));
        root.classList.toggle('is-challenge-decision', Boolean(state.challenge?.isMyTurn));
        root.classList.toggle('is-influence-decision', Boolean(state.influenceLoss?.isMyTurn));
        root.classList.toggle('is-exchange-decision', Boolean(state.exchange?.isMyTurn));
        $('turn').textContent = getTurnStatus(myTurn, turnName);
        $('phase').textContent = phase.long;
        $('phaseShort').textContent = phase.short;
        $('alive').textContent = String(alive);

        renderPlayers();
        renderEvent();
        renderChallenge();
        renderTimeline();
        renderCommand(self, myTurn);
        renderExchangeOverlay();
        renderEndOverlay();
        syncPrivateIdentityVisibility();
        scheduleActionPresentation();
    }

    function renderPlayers() {
        const state = model.state;
        const opponents = (state.players || []).filter(player => player.id !== state.myId);
        $('players').style.setProperty('--seat-count', String(Math.max(1, opponents.length)));
        $('players').innerHTML = opponents.map(player => {
            const interaction = state.interaction;
            const targetable = Boolean(model.pendingAction && player.isAlive !== false);
            const selected = model.selectedTarget === player.id;
            const isSource = interaction?.actorId === player.id;
            const isTarget = interaction?.targetId === player.id;
            const isChallenger = interaction?.challengerId === player.id;
            const isBlocker = interaction?.blockerId === player.id;
            const tag = targetable ? 'button' : 'article';
            const attrs = `data-player-id="${escapeHtml(player.id)}"${targetable ? ` type="button" data-target-player="${escapeHtml(player.id)}" aria-pressed="${selected}"` : ''}`;
            const influences = player.influences || [];
            const influenceCount = player.influenceCount ?? influences.filter(card => !card.revealed).length;
            const status = player.isAlive === false ? '已出局' : player.id === state.currentTurn ? '正在行动' : `${influenceCount} 张影响力`;
            return `<${tag} class="cp-seat ${player.isAlive === false ? 'is-out' : ''} ${player.id === state.currentTurn ? 'is-turn' : ''} ${targetable ? 'is-targetable' : ''} ${selected ? 'is-selected' : ''} ${isSource ? 'is-action-source' : ''} ${isTarget ? 'is-action-target' : ''} ${isChallenger ? 'is-challenger' : ''} ${isBlocker ? 'is-blocker' : ''}" ${attrs}>
                <span class="cp-avatar" aria-hidden="true">${escapeHtml(firstCharacter(player.name))}</span>
                <span class="cp-seat-copy"><strong>${escapeHtml(player.name)}</strong><small>${escapeHtml(status)}</small><span class="cp-seat-coins"><i></i><b>${player.coins ?? 0}</b> 金币</span></span>
                <span class="cp-seat-cards">${influences.map(card => renderInfluence(card, { mini: true })).join('')}</span>
                ${targetable ? '<em class="cp-target-hint">选择目标</em>' : ''}
            </${tag}>`;
        }).join('') || '<div class="cp-empty">等待其他玩家加入议会</div>';
    }

    function renderEvent() {
        const state = model.state;
        $('event').classList.remove('is-public-action');
        const latest = state.actionLog?.[state.actionLog.length - 1];
        let label = '当前局势';
        let title = latest || '等待第一项行动';
        let detail = isMyTurn(state) ? '选择一项行动，或声称你需要的角色。' : '观察金币、影响力与每一次角色声明。';
        let role = null;
        let sigil = '政';

        if (model.pendingAction) {
            const action = getAction(model.pendingAction.kind);
            label = '选择目标';
            title = `为${action?.name || '行动'}指定一名玩家`;
            detail = model.selectedTarget ? `已选择 ${getPlayer(state, model.selectedTarget)?.name || '目标玩家'}，确认后才会提交行动。` : '从上方议会席位中选择一名仍在场的玩家。';
            role = action?.role || null;
            sigil = action?.icon || '!';
        } else if (state.gameOver) {
            const winner = getPlayer(state, state.winner)?.name || '无人';
            label = '最终裁决';
            title = `${winner} 掌控了城邦`;
            detail = '最后仍保有影响力的玩家赢得本局。';
            sigil = '冠';
        } else if (state.interaction) {
            $('event').classList.add('is-public-action');
            $('event').innerHTML = renderPublicInteraction(state.interaction, latest);
            return;
        } else if (state.forceCoup) {
            label = '强制政变';
            title = '你拥有至少 10 枚金币';
            detail = '本回合只能支付 7 枚金币发动政变。';
            sigil = '!';
        }

        const visual = role
            ? `<span class="cp-event-card is-role-${role}"><img src="/assets/bgg/coup/${ROLE_ART[role]}.jpg" alt="${ROLE_NAMES[role]}牌面"></span>`
            : `<div class="cp-event-sigil">${escapeHtml(sigil)}</div>`;
        $('event').innerHTML = `${visual}<div class="cp-event-copy"><span>${escapeHtml(label)}</span><strong>${escapeHtml(title)}</strong><p>${escapeHtml(detail)}</p></div>`;
    }

    function renderPublicInteraction(interaction, latest) {
        const state = model.state;
        const action = getAction(interaction.kind);
        const actor = getPlayer(state, interaction.actorId)?.name || '玩家';
        const target = interaction.targetId ? getPlayer(state, interaction.targetId)?.name || '目标玩家' : '';
        const role = interaction.claimedRole;
        const actionName = action?.name || getActionName(interaction.kind);
        const stageCopy = interactionStageCopy(interaction, actor, target, actionName, latest);
        const mainCard = role && ROLE_ART[role]
            ? `<span class="cp-event-card cp-declaration-card is-role-${role}" data-role="declaredCard" data-actor-id="${escapeHtml(interaction.actorId)}"><img src="/assets/bgg/coup/${ROLE_ART[role]}.jpg" alt="${escapeHtml(ROLE_NAMES[role])}声明牌"><b>声明</b></span>`
            : `<span class="cp-action-token ${interaction.kind === 'coup' ? 'is-coup' : ''}" data-role="declaredCard" data-actor-id="${escapeHtml(interaction.actorId)}"><i>${escapeHtml(action?.icon || '政')}</i><b>${escapeHtml(actionName)}</b></span>`;
        const blockCard = interaction.blockerId && interaction.blockRole ? renderBlockDeclaration(interaction.blockRole) : '';
        const challenger = interaction.challengerId ? getPlayer(state, interaction.challengerId)?.name || '玩家' : '';
        const relation = target ? `${actor}<i>→</i><strong>${target}</strong>` : `${actor}<i>→</i><strong>中央议会</strong>`;
        return `<div class="cp-public-interaction" data-interaction-id="${Number(interaction.actionId) || 0}">
            <div class="cp-interaction-route"><span>${relation}</span>${challenger ? `<em>${esc(challenger)}提出质疑</em>` : ''}</div>
            <div class="cp-claim-stack">${mainCard}${blockCard}</div>
            <div class="cp-event-copy"><span>${esc(stageCopy.label)}</span><strong>${esc(stageCopy.title)}</strong><p>${esc(stageCopy.detail)}</p><small>${esc(stageCopy.status)}</small></div>
        </div>`;
    }

    function interactionStageCopy(interaction, actor, target, actionName, latest) {
        const state = model.state;
        const blocker = interaction.blockerId ? getPlayer(state, interaction.blockerId)?.name || '玩家' : '';
        const challenger = interaction.challengerId ? getPlayer(state, interaction.challengerId)?.name || '玩家' : '';
        const lossPlayer = interaction.lossPlayerId ? getPlayer(state, interaction.lossPlayerId)?.name || '玩家' : '';
        const blockDecider = getPlayer(state, state.challenge?.currentBlockerId)?.name || target || '下一位玩家';
        if (interaction.stage === 'challenge') return { label: '公开声明', title: `${actor}声称${ROLE_NAMES[interaction.claimedRole] || actionName}`, detail: target ? `准备对${target}执行${actionName}。` : `准备执行${actionName}。`, status: '等待议会决定是否质疑' };
        if (interaction.stage === 'challenged') {
            const claimant = blocker || actor;
            return { label: '质疑成立', title: `${challenger}质疑${claimant}的声明`, detail: `${claimant}必须出示对应角色，或承认声明失败。`, status: '身份裁决即将发生' };
        }
        if (interaction.stage === 'block_offer') return { label: '反制窗口', title: `${blockDecider}可以阻挡${actionName}`, detail: `可声称${ROLE_NAMES[interaction.blockRole] || '对应角色'}进行阻挡。`, status: '原行动仍在中央等待结算' };
        if (interaction.stage === 'block_challenge') return { label: '阻挡声明', title: `${blocker}声称${ROLE_NAMES[interaction.blockRole] || '对应角色'}阻挡`, detail: `${actor}的${actionName}暂时停止。`, status: '阻挡声明同样可以被质疑' };
        if (interaction.stage === 'influence_loss') {
            const provedBy = interaction.provedById ? getPlayer(state, interaction.provedById)?.name || '玩家' : '';
            const failedBy = interaction.failedById ? getPlayer(state, interaction.failedById)?.name || '玩家' : '';
            const provedRole = ROLE_NAMES[interaction.provedRole || interaction.blockRole || interaction.claimedRole] || '对应角色';
            if (interaction.verdict === 'claim_proved' || interaction.verdict === 'block_proved') return { label: '身份已证明', title: `${provedBy}证明了${provedRole}`, detail: `${lossPlayer}质疑失败，必须揭示一张影响力。`, status: '等待本人选择后才继续' };
            if (interaction.verdict === 'claim_failed' || interaction.verdict === 'block_failed') return { label: '声明被拆穿', title: `${failedBy}未能证明角色`, detail: `${lossPlayer}必须揭示一张影响力，原声明将按裁决处理。`, status: '等待本人选择后才继续' };
            return { label: '裁决结果', title: `${lossPlayer}必须揭示一张影响力`, detail: revealReason(interaction.lossReason), status: '等待本人选择后才继续' };
        }
        if (interaction.stage === 'exchange') return { label: '声明通过', title: `${actor}正在秘密交换影响力`, detail: '交换结果不会向其他玩家公开。', status: '等待大使完成选择' };
        if (interaction.stage === 'cancelled') return { label: '声明失败', title: `${actor}的${actionName}被取消`, detail: latest || '行动未能通过质疑。', status: '本次行动已经结束' };
        if (interaction.outcome === 'blocked') return { label: '阻挡成立', title: `${blocker}阻止了${actionName}`, detail: latest || '原行动没有生效。', status: '本次交锋已经结算' };
        return { label: interaction.claimedRole ? '声明通过' : '公开行动', title: `${actor}完成${actionName}`, detail: latest || `${actionName}已经结算。`, status: '行动结果已写入局势记录' };
    }

    function renderChallenge() {
        const state = model.state;
        const challenge = state.challenge;
        if (!challenge) { $('challenge').innerHTML = ''; return; }
        const role = ROLE_NAMES[challenge.claimedRole] || challenge.claimedRole || '对应角色';
        const actionName = getActionName(challenge.actionKind);
        let title = '';
        let detail = '';
        let buttons = '';
        const ready = decisionReady(model);
        const waitLabel = ready ? '' : '<span class="cp-reaction-wait">声明送达中</span>';
        if (challenge.phase === 'block') {
            const decider = getPlayer(state, challenge.currentBlockerId)?.name || '玩家';
            title = challenge.isMyTurn ? `是否阻挡这次${actionName}？` : `等待 ${decider} 决定是否阻挡`;
            detail = `阻挡意味着你声称自己拥有${role}，这项声明仍可被质疑。`;
            if (challenge.isMyTurn) buttons = `${waitLabel}<button class="cp-danger" data-challenge="block" type="button" ${ready ? '' : 'disabled'}>用${escapeHtml(role)}阻挡</button><button class="cp-secondary" data-challenge="pass" type="button" ${ready ? '' : 'disabled'}>放行</button>`;
        } else if (challenge.phase === 'challenge') {
            const claimant = getPlayer(state, challenge.responderId)?.name || '玩家';
            const decider = getPlayer(state, challenge.currentChallengerId)?.name || '玩家';
            title = challenge.isMyTurn ? `是否质疑 ${claimant}？` : `等待 ${decider} 回应声明`;
            detail = `${claimant} 声称${role}来执行${actionName}；错误的一方将失去一张影响力。`;
            if (challenge.isMyTurn) buttons = `${waitLabel}<button class="cp-danger" data-challenge="challenge" type="button" ${ready ? '' : 'disabled'}>质疑${escapeHtml(role)}</button><button class="cp-secondary" data-challenge="pass" type="button" ${ready ? '' : 'disabled'}>接受声明</button>`;
        } else {
            const claimant = getPlayer(state, challenge.responderId)?.name || '玩家';
            title = challenge.isMyTurn ? '你的身份受到质疑' : `等待 ${claimant} 回应质疑`;
            detail = `若你确有${role}，出示后会洗回牌库并补抽；否则必须取消声明。`;
            if (challenge.isMyTurn) buttons = `${waitLabel}<button class="cp-primary" data-challenge="show" type="button" ${ready ? '' : 'disabled'}>出示${escapeHtml(role)}</button><button class="cp-danger" data-challenge="cancel" type="button" ${ready ? '' : 'disabled'}>承认失败</button>`;
        }
        $('challenge').innerHTML = `<div class="cp-decision-copy"><span>${challengeLabel(challenge.phase)}</span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(detail)}</small></div><div class="cp-decision-actions">${buttons || '<span class="cp-wait">决策进行中</span>'}</div>`;
    }

    function scheduleActionPresentation() {
        const cancel = windowRef.cancelAnimationFrame || (id => windowRef.clearTimeout(id));
        cancel(model.actionLayoutFrame);
        layoutActionPresentation();
        const request = windowRef.requestAnimationFrame || (callback => windowRef.setTimeout(callback, 0));
        model.actionLayoutFrame = request(layoutActionPresentation);
    }

    function layoutActionPresentation() {
        const state = model.state;
        const interaction = state?.interaction;
        const card = $('declaredCard');
        if (card && interaction?.actionId === model.animateInteractionId) {
            const source = playerAnchor(interaction.actorId);
            const cardRect = card.getBoundingClientRect();
            const sourceRect = source?.getBoundingClientRect();
            const sourceX = sourceRect ? sourceRect.left + sourceRect.width / 2 : windowRef.innerWidth / 2;
            const sourceY = sourceRect ? sourceRect.top + sourceRect.height / 2 : windowRef.innerHeight;
            card.style.setProperty('--cp-action-from-x', `${sourceX - (cardRect.left + cardRect.width / 2)}px`);
            card.style.setProperty('--cp-action-from-y', `${sourceY - (cardRect.top + cardRect.height / 2)}px`);
            void card.offsetWidth;
            card.classList.add('is-entering');
            model.animateInteractionId = null;
        }
        updateActionLinks();
    }

    function updateActionLinks() {
        const svg = $('actionLinks');
        const state = model.state;
        const interaction = state?.interaction;
        if (!interaction || state.gameOver) {
            svg.classList.remove('has-action', 'has-response');
            model.centeredInteractionId = null;
            return;
        }
        const actionSource = playerAnchor(interaction.actorId);
        const actionTarget = interaction.targetId ? playerAnchor(interaction.targetId) : null;
        if (actionSource && actionTarget) {
            centerSeatIfNeeded(actionTarget, interaction.actionId);
            drawLink(actionSource, actionTarget, 'action');
            svg.classList.add('has-action');
        } else svg.classList.remove('has-action');
        const responseSourceId = interaction.challengerId || interaction.blockerId;
        const responseTargetId = interaction.challengerId ? (interaction.blockerId || interaction.actorId) : interaction.actorId;
        const responseSource = responseSourceId ? playerAnchor(responseSourceId) : null;
        const responseTarget = responseTargetId ? playerAnchor(responseTargetId) : null;
        if (responseSource && responseTarget) {
            drawLink(responseSource, responseTarget, 'response');
            svg.classList.add('has-response');
        } else svg.classList.remove('has-response');
    }

    function centerSeatIfNeeded(target, actionId) {
        const scroller = target.closest('[data-role="players"]');
        if (!scroller || model.centeredInteractionId === actionId) return;
        const desired = target.offsetLeft - (scroller.clientWidth - target.offsetWidth) / 2;
        scroller.scrollTo({ left: Math.max(0, desired), behavior: reducedMotion ? 'auto' : 'smooth' });
        model.centeredInteractionId = actionId;
        windowRef.clearTimeout(model.actionSettleTimer);
        model.actionSettleTimer = windowRef.setTimeout(scheduleActionPresentation, reducedMotion ? 0 : 280);
    }

    function drawLink(source, target, kind) {
        const sourceRect = source.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const width = windowRef.innerWidth;
        const height = windowRef.innerHeight;
        const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
        const sourceX = clamp(sourceRect.left + sourceRect.width / 2, 12, width - 12);
        const sourceY = clamp(sourceRect.top + sourceRect.height / 2, 12, height - 12);
        const targetX = clamp(targetRect.left + targetRect.width / 2, 12, width - 12);
        const targetY = clamp(targetRect.top + targetRect.height / 2, 12, height - 12);
        const bend = kind === 'response' ? 1 : -1;
        const middleX = (sourceX + targetX) / 2 + bend * Math.min(58, Math.abs(targetY - sourceY) * .08);
        const middleY = (sourceY + targetY) / 2 + bend * Math.min(66, Math.max(22, Math.abs(targetX - sourceX) * .1));
        const path = `M ${sourceX} ${sourceY} Q ${middleX} ${middleY} ${targetX} ${targetY}`;
        $('actionLinks').setAttribute('viewBox', `0 0 ${width} ${height}`);
        $(`${kind}LinkGlow`).setAttribute('d', path);
        $(`${kind}LinkStroke`).setAttribute('d', path);
        $(`${kind}LinkSeal`).setAttribute('cx', String(targetX));
        $(`${kind}LinkSeal`).setAttribute('cy', String(targetY));
    }

    function playerAnchor(playerId) {
        return [...mount.querySelectorAll('[data-player-id]')].find(element => element.dataset.playerId === String(playerId)) || null;
    }

    function renderTimeline() {
        const state = model.state;
        const entries = (state.actionLog || []).slice(-7).reverse();
        $('timeline').innerHTML = entries.length ? entries.map((entry, index) => `<div class="cp-timeline-entry"><i class="${index === 0 ? 'is-latest' : ''}"></i><span>${escapeHtml(entry)}</span></div>`).join('') : '<span class="cp-muted">行动后将在这里留下公开记录</span>';
    }

    function renderCommand(self, myTurn) {
        const state = model.state;
        if (!self) { $('command').innerHTML = '<div class="cp-command-message">等待玩家数据</div>'; return; }
        const influences = self.influences || [];
        if (state.gameOver) {
            $('command').innerHTML = `<div class="cp-ended-command"><span>本局结束</span><strong>${escapeHtml(getPlayer(state, state.winner)?.name || '无人')} 赢得政变</strong><small>完整结果已在终局裁决中封存。</small></div>`;
            return;
        }
        if (state.exchange?.isMyTurn) {
            $('command').innerHTML = '<div class="cp-ended-command"><span>大使交换</span><strong>私密选牌窗口已打开</strong><small>从原有影响力与新抽牌中选择要保留的牌。</small></div>';
            return;
        }
        if (state.influenceLoss?.isMyTurn) {
            const ready = decisionReady(model);
            const choices = influences.map((card, index) => card.revealed ? '' : `<button class="cp-private-choice-button" data-loss-index="${index}" type="button"${ready ? '' : ' disabled'}>揭示 ${index + 1} 号影响力</button>`).join('');
            $('command').innerHTML = `<div class="cp-loss-panel ${state.interaction?.targetId === state.myId ? 'is-action-target' : ''}" data-player-id="${escapeHtml(state.myId)}"><div class="cp-loss-copy"><span>失去影响力</span><strong>${ready ? '选择一张牌永久揭示' : '先查看中央裁决'}</strong><small>${ready ? '先按住查看并记住编号，松开隐藏后再选择要揭示的牌。已揭示角色会公开留在席位上。' : '裁决展示结束后即可选择，牌效不能被拒绝。'}</small></div><div class="cp-loss-identity"><div class="cp-loss-cards ${ready ? '' : 'is-waiting'}">${influences.map((card, index) => renderInfluence(card, { privateIdentity: true, slotIndex: index }, model)).join('')}</div>${influences.some(card => !card.revealed) ? identityHoldControl('按住核对牌面，松开后再按编号选择') : ''}</div><div class="cp-private-choice-row">${choices}</div></div>`;
            return;
        }
        const target = model.selectedTarget ? getPlayer(state, model.selectedTarget) : null;
        const action = model.pendingAction ? getAction(model.pendingAction.kind) : null;
        const actionContent = model.pendingAction
            ? `<div class="cp-target-panel"><div class="cp-target-action">${renderActionVisual(action)}<span><small>准备发动</small><strong>${escapeHtml(action?.name || '行动')}</strong></span></div><div class="cp-target-choice"><span>${target ? `目标：${escapeHtml(target.name)}` : '请从上方议会席位选择目标'}</span><div><button class="cp-secondary" data-action="cancel-target" type="button">取消</button><button class="cp-primary" data-action="confirm-target" type="button" ${target ? '' : 'disabled'}>确认${escapeHtml(action?.name || '行动')}</button></div></div></div>`
            : `<div class="cp-action-groups">${ACTION_GROUPS.map(group => `<section class="cp-action-group is-${group.id}"><span>${group.name}</span><div>${ACTIONS.filter(actionItem => actionItem.group === group.id).map(actionItem => renderActionButton(actionItem, self, myTurn)).join('')}</div></section>`).join('')}</div>`;
        const activeCount = influences.filter(card => !card.revealed).length;
        const status = self.isAlive === false ? '你已出局，可继续旁观' : myTurn ? '你的回合' : `等待 ${getPlayer(state, state.currentTurn)?.name || '其他玩家'}`;
        $('command').innerHTML = `<div class="cp-command-inner">
            <section class="cp-private ${state.interaction?.actorId === state.myId ? 'is-action-source' : ''} ${state.interaction?.targetId === state.myId ? 'is-action-target' : ''} ${state.interaction?.challengerId === state.myId ? 'is-challenger' : ''} ${state.interaction?.blockerId === state.myId ? 'is-blocker' : ''}" data-player-id="${escapeHtml(state.myId)}"><header><div><span>你的影响力</span><strong>${escapeHtml(self.name || '我')}</strong><small>${escapeHtml(status)} · ${activeCount} 张仍生效</small></div><div class="cp-wallet"><i></i><b>${self.coins ?? 0}</b><span>金币</span></div></header><div class="cp-private-identity"><div class="cp-self-cards">${influences.map((card, index) => renderInfluence(card, { privateIdentity: true, slotIndex: index }, model)).join('')}</div>${activeCount ? identityHoldControl() : ''}</div></section>
            <section class="cp-action-console"><header><div><span>行动台</span><strong>${myTurn ? '选择本回合行动' : '查看可用行动'}</strong></div>${state.forceCoup ? '<em>必须政变</em>' : ''}</header>${actionContent}</section>
        </div>`;
    }

    function identityHoldControl(copy = '尚未公开的影响力仅本人可见') {
        return `<button class="cp-identity-hold" data-identity-hold type="button" aria-pressed="${String(model.privateIdentityVisible)}" aria-label="${model.privateIdentityVisible ? '正在显示私密身份，松开立即隐藏' : '按住查看私密身份，松开立即隐藏'}"><i aria-hidden="true"></i><span><b>${model.privateIdentityVisible ? '松开立即隐藏' : '按住查看身份'}</b><small>${escapeHtml(copy)}</small></span></button>`;
    }

    function renderActionButton(action, self, myTurn) {
        let disabled = !myTurn || model.state.gameOver || model.state.challenge || model.state.influenceLoss || model.state.exchange || self.isAlive === false;
        let reason = action.desc;
        let disabledReason = '';
        if (!disabled && model.state.forceCoup && action.id !== 'coup') { disabled = true; disabledReason = '拥有 10 枚或更多金币时必须发动政变'; }
        if (!disabled && action.needCoins && (self.coins || 0) < action.needCoins) { disabled = true; disabledReason = `金币不足：需要 ${action.needCoins} 枚，当前 ${self.coins || 0} 枚`; }
        if (disabledReason) reason = disabledReason;
        return `<div class="cp-action-wrap"><button class="cp-action ${action.id === 'coup' ? 'is-coup' : ''}" data-action-kind="${action.id}" type="button" title="${escapeHtml(reason)}" ${disabled ? 'disabled' : ''} ${disabledReason ? `aria-describedby="cp-action-reason-${action.id}"` : ''}>${renderActionVisual(action)}<span><b>${action.name}</b><small>${action.needCoins ? `${action.needCoins} 金币 · ` : ''}${action.desc}</small></span></button>${disabledReason ? `<small class="cp-action-reason" id="cp-action-reason-${action.id}">${escapeHtml(disabledReason)}</small>` : ''}</div>`;
    }

    function renderExchangeOverlay() {
        const state = model.state;
        const overlay = $('exchangeOverlay');
        const dialog = $('exchangeDialog');
        if (state.exchange?.isMyTurn) {
            model.exchangeMode = 'select';
            model.exchangeOpen = true;
            const options = state.exchange.options || [];
            const keepCount = state.exchange.keepCount || 0;
            dialog.innerHTML = `<span class="cp-dialog-label">大使 · 私密交换</span><h2 id="cp-exchange-title">选择要保留的影响力</h2><p>按住查看全部牌面，记住编号后松开，再从原有手牌和新抽牌中保留 <strong>${keepCount}</strong> 张。</p><div class="cp-exchange-identity"><div class="cp-exchange-options">${options.map((card, index) => { const optionIndex = Number.isInteger(card.index) ? card.index : index; const source = card.source === 'drawn' ? '新抽牌' : '原有影响力'; return renderInfluence(card, { exchange: true, privateIdentity: true, slotIndex: index, selected: model.exchangeKeep.includes(optionIndex), source }, model); }).join('')}</div>${identityHoldControl('按住核对全部交换牌，松开立即隐藏')}</div><div class="cp-private-choice-row is-exchange">${options.map((card, index) => { const optionIndex = Number.isInteger(card.index) ? card.index : index; return `<button class="cp-private-choice-button ${model.exchangeKeep.includes(optionIndex) ? 'is-selected' : ''}" data-exchange-index="${optionIndex}" type="button" aria-pressed="${String(model.exchangeKeep.includes(optionIndex))}">${index + 1} 号 · ${card.source === 'drawn' ? '新抽牌' : '原有牌'}</button>`; }).join('')}</div><div class="cp-exchange-footer"><span>已选择 <b>${model.exchangeKeep.length}</b> / ${keepCount}</span><button class="cp-primary" data-action="confirm-exchange-select" type="button" ${model.exchangeKeep.length === keepCount ? '' : 'disabled'}>确认交换结果</button></div>`;
            setOverlay(overlay, true);
            return;
        }
        if (model.exchangeMode === 'confirm' && model.exchangeOpen && !state.gameOver) {
            dialog.innerHTML = `<button class="cp-dialog-close" data-action="cancel-exchange" type="button" aria-label="关闭交换确认">x</button><span class="cp-dialog-label">大使声明</span><h2 id="cp-exchange-title">声称大使并交换？</h2><p>其他玩家可以质疑这项声明。若声明通过，你会从原有影响力与两张新牌中秘密选择保留牌。</p><div class="cp-dialog-actions"><button class="cp-secondary" data-action="cancel-exchange" type="button">取消</button><button class="cp-primary" data-action="confirm-exchange" type="button">确认声明</button></div>`;
            setOverlay(overlay, true);
            return;
        }
        setOverlay(overlay, false);
    }

    function renderEndOverlay() {
        const state = model.state;
        const overlay = $('endOverlay');
        const dialog = $('endDialog');
        if (!state.gameOver) { setOverlay(overlay, false); return; }
        const winner = getPlayer(state, state.winner)?.name || '无人';
        const recent = (state.actionLog || []).slice(-5).reverse().map(entry => `<li>${escapeHtml(entry)}</li>`).join('');
        dialog.innerHTML = `<span class="cp-dialog-label">最终裁决</span><h2 id="cp-end-title">${escapeHtml(winner)} 掌控了城邦</h2><p>本局已经结束，所有角色与最后几项行动会留在当前房间供玩家复盘。</p><ol class="cp-end-log">${recent || '<li>没有额外终局记录</li>'}</ol><p class="cp-dialog-note">可使用顶部统一导航返回大厅</p>`;
        setOverlay(overlay, true);
    }

    function getPhaseLabel() {
        const state = model.state;
        if (state.gameOver) return { short: '终局', long: '本局已经结束' };
        if (state.exchange) return { short: '交换', long: '大使正在交换影响力' };
        if (state.influenceLoss) return { short: '揭示', long: '等待失去一张影响力' };
        if (state.challenge) return { short: challengeLabel(state.challenge.phase), long: state.challenge.isMyTurn ? '现在需要你作出决定' : '等待玩家作出决定' };
        if (isMyTurn(state)) return { short: '行动', long: '从七种行动中选择一项' };
        return { short: '等待', long: '观察其他玩家的行动' };
    }

    function getTurnStatus(myTurn, turnName) {
        const state = model.state;
        if (state.gameOver) return `${getPlayer(state, state.winner)?.name || '无人'} 获胜`;
        if (state.exchange?.isMyTurn) return '请选择要保留的影响力';
        if (state.influenceLoss?.isMyTurn) return '请选择要揭示的影响力';
        if (state.challenge?.isMyTurn) {
            if (state.challenge.phase === 'block') return '请决定是否阻挡';
            if (state.challenge.phase === 'challenge') return '请决定是否质疑';
            return '请回应对方的质疑';
        }
        return myTurn ? '轮到你采取行动' : `轮到 ${turnName}`;
    }

    function setOverlay(overlay, open) {
        model.privateIdentityVisible = false;
        syncPrivateIdentityVisibility();
        const wasOpen = !overlay.classList.contains('is-hidden');
        if (open && !wasOpen) model.overlayReturnFocus.set(overlay, documentRef.activeElement);
        overlay.classList.toggle('is-hidden', !open);
        overlay.setAttribute('aria-hidden', String(!open));
        updateModalIsolation();
        if (open) focusOverlay(overlay);
        else if (wasOpen) restoreOverlayFocus(overlay);
    }

    function openOverlay() {
        return [$('endOverlay'), $('exchangeOverlay'), $('rolesOverlay')].find(overlay => overlay && !overlay.classList.contains('is-hidden')) || null;
    }

    function updateModalIsolation() {
        const active = openOverlay();
        [...root.children].forEach(child => { child.inert = Boolean(active && child !== active); });
    }

    function focusableElements(overlay) {
        return [...overlay.querySelectorAll('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')].filter(element => !element.hidden && element.getClientRects().length);
    }

    function focusOverlay(overlay) {
        const request = windowRef.requestAnimationFrame || (callback => windowRef.setTimeout(callback, 0));
        request(() => {
            if (overlay.classList.contains('is-hidden') || overlay.contains(documentRef.activeElement)) return;
            const first = focusableElements(overlay)[0];
            const dialog = overlay.querySelector('.cp-dialog');
            if (dialog && overlay === $('exchangeOverlay') && model.state?.exchange?.isMyTurn) { dialog.tabIndex = -1; dialog.focus({ preventScroll: true }); return; }
            if (!first && dialog) dialog.tabIndex = -1;
            (first || dialog)?.focus();
        });
    }

    function restoreOverlayFocus(overlay) {
        const previous = model.overlayReturnFocus.get(overlay);
        model.overlayReturnFocus.delete(overlay);
        const request = windowRef.requestAnimationFrame || (callback => windowRef.setTimeout(callback, 0));
        request(() => { const fallback = mount.querySelector('[data-action="roles"], [data-action-kind="exchange"]'); (previous?.isConnected && !previous.disabled ? previous : fallback)?.focus(); });
    }

    function trapOverlayFocus(event) {
        if (event.key !== 'Tab') return false;
        const overlay = openOverlay();
        if (!overlay) return false;
        const focusable = focusableElements(overlay);
        if (!focusable.length) { event.preventDefault(); focusOverlay(overlay); return true; }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && (documentRef.activeElement === first || !overlay.contains(documentRef.activeElement))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (documentRef.activeElement === last || !overlay.contains(documentRef.activeElement))) { event.preventDefault(); first.focus(); }
        return true;
    }

    return { render, scheduleActionPresentation, syncPrivateIdentityVisibility, setOverlay, openOverlay, trapOverlayFocus, getPlayer: id => getPlayer(model.state, id), isMyTurn: () => isMyTurn(model.state), getAction: kind => getAction(kind), decisionReady: () => decisionReady(model) };
}
