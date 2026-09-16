import { ACTIONS, ACTION_GROUPS, CARD_BACK_ART, ROLE_ART, ROLE_EFFECTS, ROLE_MARKS, ROLE_NAMES, ROLE_NOTES, SCENE_ACTION_NAMES, escapeHtml } from './constants.js';
import { renderActionVisual, renderBlockDeclaration, renderInfluence } from './cards.js';
import { challengeLabel, decisionReady, getAction, getActionName, getPlayer, getSelf, isMyTurn, revealReason } from './state.js';

const esc = escapeHtml;

/** Dynamic board, command and overlay rendering for 政变. */
export function createCoupRenderer({ mount, model, getElement, windowRef = globalThis.window || globalThis, documentRef = globalThis.document }) {
    const $ = getElement || (role => mount.querySelector(`[data-role="${role}"]`));
    const root = mount.querySelector('.cp-app');
    const reducedMotion = windowRef.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
    const presentationLocked = () => model.presentationPlaying || Date.now() < Number(model.presentationLockedUntil || 0);

    function displayName(playerId, fallback = '玩家') {
        if (String(playerId) === String(model.state?.myId)) return '您';
        return getPlayer(model.state, playerId)?.name || fallback;
    }

    function viewerText(text) {
        const ownName = getSelf(model.state)?.name;
        if (!ownName) return String(text || '');
        const protectedNames = (model.state?.players || [])
            .filter(player => String(player.id) !== String(model.state?.myId) && player.name)
            .sort((left, right) => right.name.length - left.name.length);
        let value = String(text || '');
        protectedNames.forEach((player, index) => { value = value.split(player.name).join(`\u0000${index}\u0000`); });
        value = value.split(ownName).join('您');
        protectedNames.forEach((player, index) => { value = value.split(`\u0000${index}\u0000`).join(player.name); });
        return value;
    }

    // The server keeps Coup's public log as short, backwards-compatible
    // sentences.  Turn those sentences into a stable three-part record for
    // the table and the archive: action, factual detail, and current status.
    // This keeps implementation wording (for example “行动继续”) out of the
    // title while retaining the complete public result.
    function coupHistoryCopy(message) {
        const text = viewerText(message).trim();
        if (!text) return { title: '公开记录', detail: '', status: '', tone: 'normal' };
        const waiting = text.match(/(?:，|。)?(等待.*?)(?:…|\.\.\.)?$/)?.[1] || '';
        const detail = (waiting ? text.slice(0, text.length - waiting.length).replace(/[，。]$/, '') : text).replace(/…$/, '').trim();
        let title = '公开行动';
        let tone = 'normal';
        if (/游戏开始/.test(text)) title = '牌局开始';
        else if (/获得 1 枚金币/.test(text)) title = '收入';
        else if (/申请外援|外援/.test(text)) title = '外援';
        else if (/发动政变/.test(text)) title = '政变';
        else if (/暗杀/.test(text)) title = '暗杀';
        else if (/偷窃|拿走 .*金币/.test(text)) title = '偷窃';
        else if (/大使交换|抽取两张牌/.test(text)) title = '交换';
        else if (/征税|获得 3 枚金币/.test(text)) title = '征税';
        else if (/声称公爵/.test(text)) title = '征税';
        else if (/声称刺客/.test(text)) title = '暗杀';
        else if (/声称船长/.test(text)) title = '偷窃';
        else if (/声称大使/.test(text)) title = '交换';
        else if (/声称|声明/.test(text)) title = '角色声明';
        else if (/阻挡/.test(text)) title = '阻挡';
        else if (/质疑/.test(text)) title = '质疑';
        else if (/揭示第|揭示一张影响力/.test(text)) title = '揭示影响力';
        else if (/出示/.test(text)) title = '出示角色';
        else if (/离开游戏/.test(text)) title = '玩家离开';
        else if (/获胜|游戏结束/.test(text)) title = '牌局结束';
        else if (/出局/.test(text)) title = '出局';

        if (/获胜|游戏结束|出局|无法证明|未生效|取消/.test(text)) tone = 'critical';
        else if (/质疑|阻挡|声明|等待/.test(text)) tone = 'response';
        return {
            title,
            detail: detail || text,
            status: waiting,
            tone,
        };
    }

    function historyMarkup(entry, index, className) {
        const copy = coupHistoryCopy(entry);
        return `<div class="${className} is-${copy.tone}"><i class="${index === 0 ? 'is-latest' : ''}"></i><span class="cp-history-copy"><strong>${esc(copy.title)}</strong><small>${esc(copy.detail)}</small>${copy.status ? `<em>${esc(copy.status)}</em>` : ''}</span></div>`;
    }

    function render() {
        const state = model.state;
        if (!state) return;
        const self = getSelf(state);
        const myTurn = isMyTurn(state);
        const alive = (state.players || []).filter(player => player.isAlive !== false).length;

        root.classList.toggle('is-presentation-playing', presentationLocked());
        root.setAttribute('aria-busy', String(presentationLocked() || model.submitting));
        root.classList.toggle('is-challenge-decision', Boolean(state.challenge?.isMyTurn));
        root.classList.toggle('has-challenge', Boolean(state.challenge));
        root.classList.toggle('is-influence-decision', Boolean(state.influenceLoss?.isMyTurn));
        root.classList.toggle('is-exchange-decision', Boolean(state.exchange?.isMyTurn));
        $('phaseShort').textContent = state.gameOver ? '结束' : state.exchange ? '交换' : state.influenceLoss ? '揭示' : state.challenge ? challengeLabel(state.challenge.phase) : myTurn ? '行动' : '等待';
        $('alive').textContent = String(alive);

        renderPlayers();
        renderEvent();
        renderChallenge();
        renderTimeline();
        renderCommand(self, myTurn);
        renderExchangeOverlay();
        renderEndOverlay();
        scheduleActionPresentation();
    }

    function renderPlayers() {
        const state = model.state;
        const opponents = (state.players || []).filter(player => player.id !== state.myId);
        const interaction = activeSeatInteraction(state);
        const decisionPlayerId = currentDecisionPlayerId(state);
        $('players').style.setProperty('--seat-count', String(Math.max(1, opponents.length)));
        $('players').dataset.seatCount = String(opponents.length);
        $('players').innerHTML = opponents.map(player => {
            const targetable = Boolean(!model.submitting && model.pendingAction && getAction(model.pendingAction.kind)?.needsTarget && player.isAlive !== false);
            const selected = model.selectedTarget === player.id;
            const isSource = interaction?.actorId === player.id;
            const isTarget = interaction?.targetId === player.id;
            const isChallenger = interaction?.challengerId === player.id;
            const isBlocker = interaction?.blockerId === player.id;
            const isResponding = decisionPlayerId === player.id;
            const tag = targetable ? 'button' : 'article';
            const attrs = `data-player-id="${escapeHtml(player.id)}" data-player-anchor="${escapeHtml(player.id)}"${targetable ? ` type="button" data-target-player="${escapeHtml(player.id)}" aria-pressed="${selected}"` : ''}`;
            const influences = player.influences || [];
            const influenceCount = player.influenceCount ?? influences.filter(card => !card.revealed).length;
            const seatLabel = `${player.name || '玩家'}，${player.coins ?? 0} 枚金币，${influenceCount} 张影响力${player.id === state.currentTurn ? '，当前回合' : ''}`;
            return `<${tag} class="cp-seat ${player.isAlive === false ? 'is-out' : ''} ${player.id === state.currentTurn ? 'is-turn' : ''} ${targetable ? 'is-targetable' : ''} ${selected ? 'is-selected' : ''} ${isSource ? 'is-action-source' : ''} ${isTarget ? 'is-action-target' : ''} ${isChallenger ? 'is-challenger' : ''} ${isBlocker ? 'is-blocker' : ''} ${isResponding ? 'is-responding' : ''}" ${attrs} aria-label="${escapeHtml(seatLabel)}">
                <span class="cp-seat-copy"><strong>${escapeHtml(player.name)}</strong><span class="cp-seat-coins"><i aria-hidden="true"></i><b>${player.coins ?? 0}</b> 金币</span></span>
                <span class="cp-seat-cards">${influences.map(card => renderInfluence(card, { mini: true })).join('')}</span>
                ${targetable ? '<em class="cp-target-hint">选择目标</em>' : ''}
            </${tag}>`;
        }).join('') || '<div class="cp-empty">等待其他玩家加入</div>';
    }

    function activeSeatInteraction(state) {
        const interaction = state?.interaction;
        if (!interaction || ['resolved', 'cancelled'].includes(interaction.stage)) return null;
        return interaction;
    }

    function currentDecisionPlayerId(state) {
        const challenge = state?.challenge;
        if (challenge?.phase === 'block') return challenge.currentBlockerId || null;
        if (challenge?.phase === 'challenge') return challenge.currentChallengerId || null;
        if (challenge?.phase === 'respond') return challenge.responderId || null;
        return state?.influenceLoss?.playerId || state?.exchange?.playerId || null;
    }

    function renderEvent() {
        const state = model.state;
        $('event').classList.remove('is-public-action', 'is-selection-preview', 'is-hover-preview');
        const latest = viewerText(state.actionLog?.[state.actionLog.length - 1]);
        let label = '当前行动';
        let title = latest || '等待第一项行动';
        let detail = isMyTurn(state) ? '选择收入、角色行动或政变。' : '观察金币、影响力和角色声明。';
        let role = null;
        let sigil = '政';

        const previewKind = model.pendingAction?.kind || model.hoveredActionKind;
        if (previewKind) {
            const action = getAction(previewKind);
            $('event').classList.add('is-selection-preview');
            $('event').classList.toggle('is-hover-preview', !model.pendingAction);
            $('event').innerHTML = renderPendingAction(action, Boolean(model.pendingAction));
            return;
        } else if (state.gameOver) {
            const winner = displayName(state.winner, '无人');
            label = '游戏结束';
            title = `${winner}获胜`;
            detail = '最后仍有影响力的玩家获胜。';
            sigil = '冠';
        } else if (state.interaction) {
            $('event').classList.add('is-public-action');
            $('event').innerHTML = renderPublicInteraction(state.interaction);
            return;
        } else if (state.forceCoup) {
            label = '强制政变';
            title = '金币达到 10 枚';
            detail = '本回合必须支付 7 枚金币发动政变。';
            sigil = '!';
        }

        const visual = role
            ? `<span class="cp-event-card is-role-${role}"><img src="/assets/bgg/coup/${ROLE_ART[role]}.jpg" alt="${ROLE_NAMES[role]}牌面"></span>`
            : `<div class="cp-event-sigil">${escapeHtml(sigil)}</div>`;
        $('event').innerHTML = `${visual}<div class="cp-event-copy"><span>${escapeHtml(label)}</span><strong>${escapeHtml(title)}</strong><p>${escapeHtml(detail)}</p></div>`;
    }

    function renderPendingAction(action, locked) {
        const state = model.state;
        const target = model.selectedTarget ? getPlayer(state, model.selectedTarget) : null;
        const role = action?.role;
        const visual = role
            ? `<span class="cp-event-card is-role-${role}" data-role-card="${role}"><img src="/assets/bgg/coup/${ROLE_ART[role]}.jpg" alt="${escapeHtml(ROLE_NAMES[role])}牌面"></span>`
            : `<div class="cp-event-sigil">${escapeHtml(action?.icon || '!')}</div>`;
        const cost = action?.needCoins ? `支付 ${action.needCoins} 枚金币 · ` : '';
        const next = !locked ? '确认后提交行动。' : action?.needsTarget
            ? target ? `目标：${target.name}。确认后提交，其他玩家可质疑或阻挡。` : '请从上方玩家席位选择一名仍在场的玩家。'
            : role ? '确认后提交角色声明，其他玩家可质疑或阻挡。' : '确认后提交行动。';
        return `${visual}<div class="cp-event-copy"><span>${role ? `${ROLE_NAMES[role]} · 角色行动` : '基础行动'}</span><strong>${escapeHtml(action?.name || '行动')}</strong><p>${escapeHtml(`${cost}${action?.desc || ''}`)}</p><small>${escapeHtml(next)}</small></div>`;
    }

    function renderPublicInteraction(interaction) {
        const state = model.state;
        const action = getAction(interaction.kind);
        const actor = displayName(interaction.actorId);
        const target = interaction.targetId ? displayName(interaction.targetId, '目标玩家') : '';
        const role = interaction.claimedRole;
        const actionName = action?.name || getActionName(interaction.kind);
        const stageCopy = interactionStageCopy(interaction, actor, target, actionName);
        const mainCard = role && ROLE_ART[role]
            ? `<span class="cp-event-card cp-declaration-card is-role-${role}" data-role="declaredCard" data-role-card="${role}" data-actor-id="${escapeHtml(interaction.actorId)}"><img src="/assets/bgg/coup/${ROLE_ART[role]}.jpg" alt="${escapeHtml(ROLE_NAMES[role])}声明牌"><b>声明</b></span>`
            : `<span class="cp-action-token ${interaction.kind === 'coup' ? 'is-coup' : ''}" data-role="declaredCard" data-actor-id="${escapeHtml(interaction.actorId)}"><i>${escapeHtml(action?.icon || '政')}</i><b>${escapeHtml(actionName)}</b></span>`;
        const blockCard = interaction.blockerId && interaction.blockRole ? renderBlockDeclaration(interaction.blockRole) : '';
        return `<div class="cp-public-interaction" data-interaction-id="${Number(interaction.actionId) || 0}">
            <div class="cp-claim-stack">${mainCard}${blockCard}</div>
            <div class="cp-event-copy"><span>${esc(stageCopy.label)}</span><strong>${esc(stageCopy.title)}</strong>${stageCopy.detail ? `<p>${esc(stageCopy.detail)}</p>` : ''}${stageCopy.status ? `<small>${esc(stageCopy.status)}</small>` : ''}</div>
        </div>`;
    }

    function interactionStageCopy(interaction, actor, target, actionName) {
        const state = model.state;
        const blocker = interaction.blockerId ? displayName(interaction.blockerId) : '';
        const challenger = interaction.challengerId ? displayName(interaction.challengerId) : '';
        const lossPlayer = interaction.lossPlayerId ? displayName(interaction.lossPlayerId) : '';
        const blockDecider = state.challenge?.currentBlockerId ? displayName(state.challenge.currentBlockerId) : target || '下一位玩家';
        const claimedRole = ROLE_NAMES[interaction.claimedRole] || '对应角色';
        const action = getAction(interaction.kind);
        const cost = action?.needCoins ? `已支付 ${action.needCoins} 枚金币；` : '';
        const effect = `${cost}${action?.desc || '执行这项行动'}`;
        if (interaction.stage === 'challenge') return { label: '等待质疑', title: actionName, detail: `${actor}发起${actionName}${target ? `，目标为${target}` : ''}：${effect}。`, status: state.challenge?.currentChallengerId ? `等待${displayName(state.challenge.currentChallengerId)}决定是否质疑` : '等待其他玩家质疑' };
        if (interaction.stage === 'challenged') {
            const claimant = blocker || actor;
            const challengedRole = ROLE_NAMES[interaction.blockRole || interaction.claimedRole] || '角色';
            return { label: `质疑 · ${actionName}`, title: actionName, detail: `${challenger}质疑${claimant}的${challengedRole}声明。`, status: `等待${claimant}出示角色证明` };
        }
        if (interaction.stage === 'block_offer') return { label: '等待阻挡', title: actionName, detail: `${actor}发起${actionName}${target ? `，目标为${target}` : ''}。${blockDecider}可以声称${ROLE_NAMES[interaction.blockRole] || '对应角色'}进行阻挡。`, status: `等待${blockDecider}决定是否阻挡` };
        if (interaction.stage === 'block_challenge') return { label: `阻挡 · ${actionName}`, title: actionName, detail: `${blocker}声称${ROLE_NAMES[interaction.blockRole] || '对应角色'}，阻挡${actor}的${actionName}。`, status: state.challenge?.currentChallengerId ? `等待${displayName(state.challenge.currentChallengerId)}决定是否质疑阻挡声明` : '等待其他玩家质疑阻挡声明' };
        if (interaction.stage === 'influence_loss') {
            const provedBy = interaction.provedById ? displayName(interaction.provedById) : '';
            const failedBy = interaction.failedById ? displayName(interaction.failedById) : '';
            const provedRole = ROLE_NAMES[interaction.provedRole || interaction.blockRole || interaction.claimedRole] || '对应角色';
            if (interaction.verdict === 'claim_proved' || interaction.verdict === 'block_proved') return { label: `质疑结果 · ${actionName}`, title: actionName, detail: `${provedBy}成功出示${provedRole}，${lossPlayer}质疑失败。`, status: `等待${lossPlayer}揭示一张影响力` };
            if (interaction.verdict === 'claim_failed' || interaction.verdict === 'block_failed') return { label: `质疑结果 · ${actionName}`, title: actionName, detail: `${failedBy}无法证明${provedRole}，角色声明不成立。`, status: `等待${lossPlayer}揭示一张影响力` };
            const lossAction = interaction.lossReason === 'coup' ? '遭到政变' : interaction.lossReason === 'assassination' ? '遭到暗杀' : revealReason(interaction.lossReason);
            return { label: '失去影响力', title: actionName, detail: `${lossPlayer}${lossAction}，需要失去一张影响力。`, status: `等待${lossPlayer}选择一张牌揭示` };
        }
        if (interaction.stage === 'exchange') return { label: '正在结算', title: actionName, detail: `${actor}正在与牌库交换影响力，交换内容保密。`, status: `等待${actor}完成选择` };
        if (interaction.stage === 'cancelled') return { label: '行动取消', title: actionName, detail: `${actor}的${claimedRole}声明未通过，${actionName}未生效。`, status: '' };
        if (interaction.outcome === 'blocked') return { label: '阻挡成功', title: actionName, detail: `${blocker}成功阻挡${actor}的${actionName}，原行动未生效。`, status: '' };
        if (interaction.kind === 'income') return { label: '行动完成', title: actionName, detail: `${actor}从国库获得 1 枚金币。`, status: '' };
        if (interaction.kind === 'foreign_aid') return { label: '行动完成', title: actionName, detail: `${actor}从国库获得 2 枚金币。`, status: '' };
        if (interaction.kind === 'tax') return { label: '行动完成', title: actionName, detail: `${actor}的公爵声明成立，从国库获得 3 枚金币。`, status: '' };
        if (interaction.kind === 'steal') return { label: '行动完成', title: actionName, detail: `${actor}从${target}处获得 ${interaction.amount ?? 2} 枚金币。`, status: '' };
        return { label: '行动完成', title: actionName, detail: `${actor}完成${actionName}。`, status: '' };
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
        const ready = decisionReady(model) && !presentationLocked() && !model.submitting;
        const waitLabel = ready ? '' : '<span class="cp-reaction-wait">请稍候</span>';
        if (challenge.phase === 'block') {
            const decider = displayName(challenge.currentBlockerId);
            title = challenge.isMyTurn ? `要阻挡这次${actionName}吗？` : `等待 ${decider} 决定是否阻挡`;
            detail = `需要声称${role}，该声明也可能被质疑。`;
            if (challenge.isMyTurn) buttons = `${waitLabel}<button class="cp-danger" data-challenge="block" type="button" ${ready ? '' : 'disabled'}>阻挡</button><button class="cp-secondary" data-challenge="pass" type="button" ${ready ? '' : 'disabled'}>不阻挡</button>`;
        } else if (challenge.phase === 'challenge') {
            const claimant = displayName(challenge.responderId);
            const decider = displayName(challenge.currentChallengerId);
            title = challenge.isMyTurn ? `要质疑 ${claimant} 吗？` : `等待 ${decider} 回应声明`;
            detail = '假声明：声明者失去一张影响力；真声明：质疑者失去一张。';
            if (challenge.isMyTurn) buttons = `${waitLabel}<button class="cp-danger" data-challenge="challenge" type="button" ${ready ? '' : 'disabled'}>质疑</button><button class="cp-secondary" data-challenge="pass" type="button" ${ready ? '' : 'disabled'}>不质疑</button>`;
        } else {
            const claimant = displayName(challenge.responderId);
            title = challenge.isMyTurn ? `您的${role}声明受到质疑` : `等待 ${claimant} 回应质疑`;
            detail = `出示${role}并换牌，或承认无法证明、失去一张影响力。`;
            if (challenge.isMyTurn) buttons = `${waitLabel}<button class="cp-primary" data-challenge="show" type="button" ${ready ? '' : 'disabled'}>出示${escapeHtml(role)}</button><button class="cp-danger" data-challenge="cancel" type="button" ${ready ? '' : 'disabled'}>无法证明</button>`;
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
        const presentationEvent = model.presentationEvent;
        if (presentationEvent) {
            svg.classList.remove('has-action', 'has-response');
            const route = presentationEvent.route;
            const from = route?.from ? playerAnchor(route.from) : null;
            const to = route?.to ? playerAnchor(route.to) : null;
            if (from && to) {
                const kind = route.kind === 'response' ? 'response' : 'action';
                drawLink(from, to, kind);
                svg.classList.add(`has-${kind}`);
            }
            return;
        }
        if (!interaction || state.gameOver) {
            svg.classList.remove('has-action', 'has-response');
            model.centeredInteractionId = null;
            return;
        }
        const actionSource = playerAnchor(interaction.actorId);
        // Only connect actions between players. Resource actions already have a
        // complete declaration in the central stage; routing them to the
        // treasury makes the line terminate inside that stage while everyone
        // is deciding whether to challenge or block.
        const actionTarget = interaction.targetId ? playerAnchor(interaction.targetId) : null;
        // Once a declaration enters the challenge/block flow, the central
        // stage already carries the action context. Keeping the original
        // actor-to-target route visible cuts diagonally through the stage and
        // its treasury. A later challenge/block gets its own response route.
        const showActionRoute = !state.challenge;
        if (showActionRoute && actionSource && actionTarget) {
            if (interaction.targetId) centerSeatIfNeeded(actionTarget, interaction.actionId);
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
        return [...mount.querySelectorAll('[data-player-anchor]')].find(element => element.dataset.playerAnchor === String(playerId)) || null;
    }

    function renderTimeline() {
        const state = model.state;
        const entries = (state.actionLog || []).slice(-7).reverse();
        $('timeline').innerHTML = entries.length ? entries.map((entry, index) => historyMarkup(entry, index, 'cp-timeline-entry')).join('') : '<span class="cp-muted">行动后将在这里留下公开记录</span>';
        const history = (state.actionLog || []).slice().reverse();
        $('historyList').innerHTML = history.length ? history.map((entry, index) => historyMarkup(entry, index, 'cp-history-entry')).join('') : '<span class="cp-muted">尚无公开行动记录</span>';
    }

    function renderCommand(self, myTurn) {
        const state = model.state;
        if (!self) { $('command').innerHTML = '<div class="cp-command-message">等待玩家数据</div>'; return; }
        const influences = self.influences || [];
        if (state.gameOver) {
            const personalResult = String(state.winner) === String(state.myId) ? '您获胜了' : self.isAlive === false ? '您已出局' : `${displayName(state.winner, '无人')}获胜`;
            $('command').innerHTML = `<div class="cp-ended-command"><span>游戏结束</span><strong>${escapeHtml(personalResult)}</strong><small>终局结果已显示。</small></div>`;
            return;
        }
        if (state.exchange?.isMyTurn) {
            $('command').innerHTML = '<div class="cp-ended-command"><span>大使交换</span><strong>选择要保留的牌</strong><small>从原有影响力和新抽牌中选择指定数量。</small></div>';
            return;
        }
        if (state.influenceLoss?.isMyTurn) {
            const ready = decisionReady(model) && !presentationLocked();
            $('command').innerHTML = `<div class="cp-loss-panel ${state.interaction?.targetId === state.myId ? 'is-action-target' : ''}" data-player-id="${escapeHtml(state.myId)}"><div class="cp-loss-copy"><span>失去影响力</span><strong>${ready ? '选择一张影响力揭示' : '请稍候'}</strong><small>${ready ? '点击要失去的牌；揭示后对所有人可见。' : '结果播报结束后即可选择。'}</small></div><div class="cp-loss-identity"><div class="cp-loss-cards ${ready ? '' : 'is-waiting'}">${influences.map((card, index) => renderInfluence(card, { slotIndex: index, lossIndex: !card.revealed && ready ? index : undefined })).join('')}</div></div></div>`;
            return;
        }
        const target = model.selectedTarget ? getPlayer(state, model.selectedTarget) : null;
        const action = model.pendingAction ? getAction(model.pendingAction.kind) : null;
        const interaction = activeSeatInteraction(state);
        const selfIsResponding = currentDecisionPlayerId(state) === state.myId;
        const actionContent = model.pendingAction
            ? `<div class="cp-target-panel"><div class="cp-target-action">${renderActionVisual(action)}<span><small>${model.submitting ? '正在提交' : '准备提交'}</small><strong>${escapeHtml(action?.name || '行动')}</strong></span></div><div class="cp-target-choice"><span>${model.submitting ? '请稍候，等待服务器确认。' : action?.needsTarget ? target ? `目标：${escapeHtml(target.name)}` : '请从上方玩家席位选择目标' : '查看中央预览后确认行动'}</span><div><button class="cp-secondary" data-action="cancel-target" type="button" ${model.submitting ? 'disabled' : ''}>取消</button><button class="cp-primary" data-action="confirm-action" type="button" ${model.submitting || (action?.needsTarget && !target) ? 'disabled' : ''}>${model.submitting ? '提交中…' : `确认${escapeHtml(action?.name || '行动')}`}</button></div></div></div>`
            : `<div class="cp-action-groups">${ACTION_GROUPS.map(group => `<section class="cp-action-group is-${group.id}"><span>${group.name}</span><div>${ACTIONS.filter(actionItem => actionItem.group === group.id).map(actionItem => renderActionButton(actionItem, self, myTurn)).join('')}</div></section>`).join('')}</div>`;
        $('command').innerHTML = `<div class="cp-command-inner">
            <section class="cp-private ${interaction?.actorId === state.myId ? 'is-action-source' : ''} ${interaction?.targetId === state.myId ? 'is-action-target' : ''} ${interaction?.challengerId === state.myId ? 'is-challenger' : ''} ${interaction?.blockerId === state.myId ? 'is-blocker' : ''}" data-player-id="${escapeHtml(state.myId)}"><header class="cp-self-summary ${myTurn ? 'is-turn' : ''} ${selfIsResponding ? 'is-responding' : ''}" data-player-anchor="${escapeHtml(state.myId)}" aria-label="${escapeHtml(self.name || state.myId)}，${self.coins ?? 0} 枚金币${myTurn ? '，当前回合' : ''}"><div><strong>${escapeHtml(self.name || state.myId)}</strong></div><div class="cp-wallet"><i aria-hidden="true"></i><b>${self.coins ?? 0}</b><span>金币</span></div></header><div class="cp-private-identity"><div class="cp-self-cards">${influences.map((card, index) => renderInfluence(card, { slotIndex: index })).join('')}</div></div></section>
            <section class="cp-action-console"><header><strong>行动</strong>${state.forceCoup ? '<em>必须政变</em>' : ''}</header>${actionContent}</section>
        </div>`;
    }

    function renderActionButton(action, self, myTurn) {
        let disabled = model.submitting || presentationLocked() || !myTurn || model.state.gameOver || model.state.challenge || model.state.influenceLoss || model.state.exchange || self.isAlive === false;
        let reason = action.desc;
        let disabledReason = '';
        if (!disabled && model.state.forceCoup && action.id !== 'coup') { disabled = true; disabledReason = '金币达到 10 枚时必须发动政变'; }
        if (!disabled && action.needCoins && (self.coins || 0) < action.needCoins) { disabled = true; disabledReason = `金币不足：需要 ${action.needCoins} 枚，当前 ${self.coins || 0} 枚`; }
        if (disabledReason) reason = disabledReason;
        return `<div class="cp-action-wrap"><button class="cp-action ${action.id === 'coup' ? 'is-coup' : ''}" data-action-kind="${action.id}" type="button" title="${escapeHtml(reason)}" ${disabled ? 'disabled' : ''} ${disabledReason ? `aria-describedby="cp-action-reason-${action.id}"` : ''}>${renderActionVisual(action)}<span><b>${action.name}</b><small>${action.needCoins ? `${action.needCoins} 枚金币 · ` : ''}${action.desc}</small></span></button>${disabledReason ? `<small class="cp-action-reason" id="cp-action-reason-${action.id}">${escapeHtml(disabledReason)}</small>` : ''}</div>`;
    }

    function renderExchangeOverlay() {
        const state = model.state;
        const overlay = $('exchangeOverlay');
        const dialog = $('exchangeDialog');
        if (presentationLocked()) {
            setOverlay(overlay, false);
            return;
        }
        if (state.exchange?.isMyTurn) {
            model.exchangeMode = 'select';
            model.exchangeOpen = true;
            const options = state.exchange.options || [];
            const keepCount = state.exchange.keepCount || 0;
            dialog.innerHTML = `<span class="cp-dialog-label">大使 · 交换</span><h2 id="cp-exchange-title">选择要保留的牌</h2><p>从原有影响力和新抽牌中保留 <strong>${keepCount}</strong> 张。牌面仅您可见。</p><div class="cp-exchange-identity"><div class="cp-exchange-options">${options.map((card, index) => { const optionIndex = Number.isInteger(card.index) ? card.index : index; const source = card.source === 'drawn' ? '新抽牌' : '原有影响力'; return renderInfluence(card, { exchange: true, exchangeIndex: optionIndex, slotIndex: index, selected: model.exchangeKeep.includes(optionIndex), source }); }).join('')}</div></div><div class="cp-exchange-footer"><span>已选择 <b>${model.exchangeKeep.length}</b> / ${keepCount}</span><button class="cp-primary" data-action="confirm-exchange-select" type="button" ${model.exchangeKeep.length === keepCount ? '' : 'disabled'}>确认选择</button></div>`;
            setOverlay(overlay, true);
            return;
        }
        setOverlay(overlay, false);
    }

    function renderEndOverlay() {
        const state = model.state;
        const overlay = $('endOverlay');
        const dialog = $('endDialog');
        if (!state.gameOver || presentationLocked()) { setOverlay(overlay, false); return; }
        const winner = displayName(state.winner, '无人');
        const self = getSelf(state);
        const heading = String(state.winner) === String(state.myId) ? '您获胜了' : self?.isAlive === false ? '您已出局' : `${winner}获胜`;
        const recent = (state.actionLog || []).slice(-5).reverse().map(entry => {
            const copy = coupHistoryCopy(entry);
            return `<li><strong>${esc(copy.title)}</strong><span>${esc(copy.detail)}${copy.status ? ` · ${copy.status}` : ''}</span></li>`;
        }).join('');
        dialog.innerHTML = `<span class="cp-dialog-label">游戏结束</span><h2 id="cp-end-title">${escapeHtml(heading)}</h2><p>本局已结束，以下是最后几条行动记录。</p><ol class="cp-end-log">${recent || '<li>没有额外行动记录</li>'}</ol><p class="cp-dialog-note">使用顶部导航返回大厅</p>`;
        setOverlay(overlay, true);
    }

    function setOverlay(overlay, open) {
        const wasOpen = !overlay.classList.contains('is-hidden');
        if (open && !wasOpen) model.overlayReturnFocus.set(overlay, documentRef.activeElement);
        overlay.classList.toggle('is-hidden', !open);
        overlay.setAttribute('aria-hidden', String(!open));
        updateModalIsolation();
        if (open) focusOverlay(overlay);
        else if (wasOpen) restoreOverlayFocus(overlay);
    }

    function openOverlay() {
        return [$('endOverlay'), $('exchangeOverlay'), $('roleDetailOverlay'), $('historyOverlay'), $('rolesOverlay')].find(overlay => overlay && !overlay.classList.contains('is-hidden')) || null;
    }

    function openRoleDetail(role) {
        if (!ROLE_ART[role]) return;
        $('roleDetailDialog').innerHTML = `<button class="cp-dialog-close" data-action="close-role-detail" type="button" aria-label="关闭角色说明">x</button><span class="cp-dialog-label">角色能力</span><div class="cp-role-detail"><img src="/assets/bgg/coup/${ROLE_ART[role]}.jpg" alt="${escapeHtml(ROLE_NAMES[role])}牌面"><div><span>${escapeHtml(ROLE_MARKS[role])} · 角色能力</span><h2 id="cp-role-detail-title">${escapeHtml(ROLE_NAMES[role])}</h2><p>${escapeHtml(ROLE_EFFECTS[role])}</p><small>${escapeHtml(ROLE_NOTES[role])}</small></div></div>`;
        setOverlay($('roleDetailOverlay'), true);
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
        request(() => { const fallback = mount.querySelector('[data-action="open-history"], [data-action="roles"], [data-action-kind="exchange"]'); (previous?.isConnected && !previous.disabled ? previous : fallback)?.focus(); });
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

    return { render, renderEvent, scheduleActionPresentation, setOverlay, openOverlay, openRoleDetail, trapOverlayFocus, getPlayer: id => getPlayer(model.state, id), isMyTurn: () => isMyTurn(model.state), getAction: kind => getAction(kind), decisionReady: () => decisionReady(model) };
}
