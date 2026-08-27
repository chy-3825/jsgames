const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const ATHLETE_ART_ORDER = ['alchemist', 'airship', 'baba', 'banana', 'centaur', 'cheerleader', 'coach', 'copycat', 'dicemonger', 'duelist', 'egg', 'flopflop', 'genius', 'gunk', 'hare', 'hugebaby', 'hyena', 'hypnotist', 'inchworm', 'lackey', 'leaptoad', 'legs', 'lovableloser', 'mouth', 'magician', 'mastermind', 'partyanimal', 'rocketscientist', 'romantic', 'scoocher', 'sisyphus', 'skipper', 'stickler', 'suckerfish', 'thirdwheel', 'twin'];
const ATHLETE_ART_INDEX = Object.fromEntries(ATHLETE_ART_ORDER.map((id, index) => [id, index]));
const BEFORE_RACE_ATHLETES = new Set(['egg', 'twin', 'sisyphus']);
const DECISION_ATHLETES = new Set(['alchemist', 'cheerleader', 'copycat', 'duelist', 'flopflop', 'genius', 'hypnotist', 'legs', 'magician', 'mastermind', 'rocketscientist', 'suckerfish', 'thirdwheel']);
export function createGameClient({ mount, send, addLog }) {
    const style = document.createElement('link');
    const controller = new AbortController();
    style.rel = 'stylesheet';
    style.href = '/games/magicalathlete/style.css?v=20260826-mobile-shell-1';
    document.head.appendChild(style);
    document.body.classList.add('is-magicalathlete-view');
    let state = null;
    let interactionSignature = '';
    let pendingAction = null;
    let actionPending = false;
    let previousFocus = null;
    let presentationQueue = [];
    let presentationPlaying = false;
    let presentationToken = 0;
    let presentationTimer = null;
    let presentationRelease = null;
    let lastPresentationSequence = null;
    let acknowledgementTimer = null;
    let acknowledgementId = null;
    let latestPresentationState = null;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    mount.innerHTML = `<section class="ma-app">
        <header class="ma-header">
            <div class="ma-brand">
                <span class="ma-brand-mark" aria-hidden="true"><i></i><b></b><em></em></span>
                <div><small>魔法竞技场</small><h1>胡闹运动会</h1><span>四场运动员竞速赛</span></div>
            </div>
            <div class="ma-round" data-role="round">等待开幕</div>
            <div class="ma-actions">
                <button data-ui="rules" type="button" title="查看规则">规则</button>

            </div>
        </header>

        <section class="ma-scoreboard" data-role="scoreboard" aria-label="赛事积分榜"></section>

        <main class="ma-layout">
            <section class="ma-stage">
                <div class="ma-status" data-role="status"></div>
                <section class="ma-race" data-role="race"></section>
                <section class="ma-command" data-role="command" aria-live="polite"></section>
                <section class="ma-history" data-role="history"></section>
            </section>

            <aside class="ma-rail">
                <section class="ma-panel ma-team-panel" data-role="myCard"></section>
                <section class="ma-panel ma-roster-panel">
                    <header><span class="ma-kicker">赛场能力</span><strong data-role="rosterTitle">本场阵容</strong></header>
                    <div class="ma-athletes" data-role="athletes"></div>
                </section>
                <section class="ma-panel ma-log-panel">
                    <header><span class="ma-kicker">现场记录</span><strong>现场播报</strong></header>
                    <div class="ma-log" data-role="log"></div>
                </section>
            </aside>
        </main>

        <div class="ma-overlay is-hidden" data-role="rulesOverlay" aria-hidden="true">
            <article role="dialog" aria-modal="true" aria-labelledby="ma-rules-title">
                <button data-ui="closeRules" type="button" aria-label="关闭规则">×</button>
                <span class="ma-kicker">玩法说明</span><h2 id="ma-rules-title">胡闹运动会规则</h2>
                <ol><li>2–6 人使用 36 张运动员牌蛇形轮抽组队；4–6 人每人 4 名，2–3 人每人 8 名。</li><li>四场依次使用温和、狂野、温和、狂野赛道；每场同时选人后轮流掷骰。</li><li>主移动为 1d6；能力按“赛道格 → 当前玩家 → 其他玩家”顺序触发。</li><li>狂野赛道的星格值 1 分，箭格强制位移，摔倒格会让运动员停回合；第二名冲线后本场结束。</li><li>第 1–4 场金牌分为 2/4/6/8，银牌分为 1/2/3/4；四场后总分最高者获胜。</li></ol>
                <figure class="ma-art-reference"><img src="/assets/bgg/magicalathlete/detail.png" alt="胡闹运动会运动员牌、赛道和组件参考图" loading="lazy"><figcaption>实体组件参考</figcaption></figure>
            </article>
        </div>
        <div class="ma-presentation-layer" data-role="presentationLayer" hidden aria-live="assertive">
            <div class="ma-presentation-shade"></div>
            <svg class="ma-action-lines" data-role="actionLines" aria-hidden="true"></svg>
            <div class="ma-floating-layer" data-role="floatingLayer" aria-hidden="true"></div>
            <section class="ma-presentation-stage" data-role="presentationStage"></section>
            <button class="ma-presentation-skip" type="button" data-ui="skipPresentation">跳过演出</button>
        </div>
    </section>`;
    const $ = role => mount.querySelector(`[data-role="${role}"]`);
    const playerName = id => state?.players?.find(player => player.id === id)?.name || id;
    const playerColor = id => state?.players?.find(player => player.id === id)?.color || '#fff';
    const athleteById = id => state?.athletes?.find(athlete => athlete.id === id);
    const athleteArt = athlete => {
        const index = ATHLETE_ART_INDEX[athlete?.id] ?? 0;
        return `--ma-art-x:${(index % 6) * 20}%;--ma-art-y:${Math.floor(index / 6) * 20}%`;
    };
    const abilityType = athlete => {
        if (BEFORE_RACE_ATHLETES.has(athlete?.id)) return { key: 'before', label: '赛前能力', hint: '上场时触发' };
        if (DECISION_ATHLETES.has(athlete?.id)) return { key: 'decision', label: '主动能力', hint: '由你决定使用' };
        return { key: 'track', label: '赛道能力', hint: '满足条件触发' };
    };
    function athleteCard(athlete, { compact = false, note = '' } = {}) {
        if (!athlete) return '';
        const ability = abilityType(athlete);
        return `<div class="ma-card-face ${compact ? 'is-compact' : ''} ma-ability-${ability.key}">
            <div class="ma-card-top"><span>运动员牌</span><b>${ability.label}</b></div>
            <div class="ma-card-art" aria-hidden="true"><span class="ma-athlete-sprite" style="${athleteArt(athlete)}"></span><i></i></div>
            <strong class="ma-card-name">${escapeHtml(athlete.name)}</strong>
            <small class="ma-card-tagline">${ability.hint}</small>
            ${compact ? '' : `<p>${escapeHtml(athlete.description || '')}</p>`}
            ${note ? `<em class="ma-card-note">${escapeHtml(note)}</em>` : ''}
        </div>`;
    }
    function athleteChoice(athlete, action, note = '') {
        const selected = pendingAction?.key === `athlete:${athlete.id}`;
        return `<button class="ma-athlete-choice ${selected ? 'is-selected' : ''}" data-athlete="${escapeHtml(athlete.id)}" data-athlete-action="${escapeHtml(action)}" type="button" ${actionPending ? 'disabled' : ''}>${athleteCard(athlete, { note })}</button>`;
    }
    function raceSelectionEntries() {
        const byPlayer = new Map((state.raceSelectionStatus || []).map(entry => [entry.playerId, entry]));
        return (state.players || []).map(player => {
            const fallbackCount = player.id === state.myId ? (state.myRaceSelections || []).length : 0;
            const entry = byPlayer.get(player.id) || { playerId: player.id, selectedCount: fallbackCount, ready: fallbackCount >= state.racersPerPlayer };
            return { player, selectedCount: entry.selectedCount || 0, ready: Boolean(entry.ready) };
        });
    }
    function cardBackMarkup(label) {
        return `<span class="ma-card-back" role="img" aria-label="${escapeHtml(label)}"><i></i><b>MA</b><small>MAGICAL<br>ATHLETE</small></span>`;
    }
    function secretLineupMarkup() {
        const required = state.racersPerPlayer || 1;
        const entries = raceSelectionEntries();
        const readyCount = entries.filter(entry => entry.ready).length;
        return `<div class="ma-secret-stage">
            <header><div><span class="ma-kicker">第 ${state.match} 场 · ${state.trackSide === 'wild' ? '狂野赛道' : '温和赛道'}</span><h3>各队正在秘密暗置运动员</h3></div><strong>${readyCount} / ${entries.length} 队已确认</strong></header>
            <div class="ma-secret-grid">${entries.map(({ player, selectedCount, ready }) => `<article class="${ready ? 'is-ready' : ''} ${player.id === state.currentTurn ? 'is-current' : ''} ${player.id === state.myId ? 'is-me' : ''}" style="--player-color:${escapeHtml(player.color || '#777')}">
                <div class="ma-secret-player"><i>${escapeHtml(player.name?.slice(0, 1) || '队')}</i><div><strong>${escapeHtml(player.name)}</strong><small>${ready ? '阵容已暗置' : selectedCount ? `已暗置 ${selectedCount} / ${required}` : player.id === state.currentTurn ? '正在挑选' : '等待确认'}</small></div></div>
                <div class="ma-card-back-row">${Array.from({ length: required }, (_, index) => index < selectedCount
                    ? cardBackMarkup(`${player.name}已暗置第 ${index + 1} 名运动员`)
                    : `<span class="ma-card-slot" aria-label="等待暗置第 ${index + 1} 名运动员"><b>${index + 1}</b><small>等待暗置</small></span>`).join('')}</div>
            </article>`).join('')}</div>
            <p>卡背只表示已完成选择；所有运动员会在全队确认后同时公开。</p>
        </div>`;
    }

    function signature(next) {
        const racers = (next.racers || []).map(racer => `${racer.id}:${racer.position}:${racer.finishOrder}:${racer.tripped}:${racer.eliminated}`).join(',');
        const prompt = next.prompt ? `${next.prompt.kind}:${next.prompt.playerId}:${next.prompt.racerId}:${next.prompt.targetRacerId}` : '';
        const team = (next.myTeam || []).map(athlete => `${athlete.id}:${athlete.used}`).join(',');
        const selections = (next.raceSelectionStatus || []).map(entry => `${entry.playerId}:${entry.selectedCount}:${entry.ready}`).join(',');
        return [next.status, next.phase, next.match, next.currentTurn, next.draftRound, prompt, racers, team, selections, next.myRacer?.roll, (next.myRaceSelections || []).join(','), (next.actionLog || []).at(-1)].join('|');
    }

    function resetInteraction() {
        pendingAction = null;
        actionPending = false;
    }

    function chooseAction(payload, title, detail, key) {
        pendingAction = { payload, title, detail, key };
        renderCommand();
    }

    function render() {
        if (!state) return;
        $('round').textContent = state.status === 'ended' ? '总冠军诞生' : state.phase === 'draft' ? `蛇形选角 ${state.draftRound + 1}` : state.phase === 'race_select' ? `第 ${state.match} 场选手` : `第 ${state.match} / ${state.maxMatches} 场 · ${state.trackSide === 'wild' ? '狂野' : '温和'}`;
        $('status').innerHTML = `<div><span class="ma-kicker">${state.phase === 'draft' ? '蛇形选角' : state.phase === 'race_select' ? '上场阵容' : state.status === 'ended' ? '最终结果' : '比赛进行中'}</span><h2>${statusText()}</h2></div><small>${state.currentTurnName && state.status !== 'ended' ? `当前操作 · ${escapeHtml(state.currentTurnName)}` : '四场赛累计积分'}</small>`;
        renderScoreboard(); renderAthletes(); renderMyCard(); renderRace(); renderCommand(); renderHistory(); renderLog();
    }
    function statusText() {
        if (state.acknowledgement) return state.acknowledgement.playerId === state.myId ? '请确认你的运动员从本场淘汰' : `等待 ${escapeHtml(playerName(state.acknowledgement.playerId))} 确认淘汰`;
        if (state.status === 'ended') return `${(state.winners || (state.winner ? [state.winner] : [])).map(player => escapeHtml(player.name)).join('、')} 赢得总冠军`;
        if (state.prompt) return state.prompt.playerId === state.myId ? promptTitle() : `等待 ${escapeHtml(playerName(state.prompt.playerId))} 决定`;
        if (state.phase === 'draft') return state.availableActions?.chooseAthlete ? '从当前牌列挑选运动员' : '等待其他人完成蛇形选角';
        if (state.phase === 'race_select') return state.availableActions?.selectRaceAthlete ? `选择本场上场运动员（还需 ${state.racersPerPlayer - (state.myRaceSelections || []).length} 名）` : '等待各队确认阵容';
        return state.currentTurn === state.myId ? '轮到你掷骰' : `等待 ${escapeHtml(state.currentTurnName || '')}`;
    }
    function renderScoreboard() {
        const ordered = (state.players || []).slice().sort((a, b) => b.score - a.score || b.bronze - a.bronze);
        $('scoreboard').innerHTML = ordered.map((player, index) => {
            const current = state.currentTurn === player.id && state.status !== 'ended';
            return `<article class="${player.id === state.myId ? 'is-me' : ''} ${current ? 'is-current' : ''}" data-player-id="${escapeHtml(player.id)}">
                <i style="--player-color:${player.color || '#f8c537'}"></i>
                <span>${index + 1}</span><div><strong>${escapeHtml(player.name)}</strong><small>${player.isOnline === false ? '已离线' : current ? '正在行动' : player.id === state.myId ? '我的队伍' : '参赛中'}</small></div>
                <b>${player.score}<small>分</small></b><em>${player.bronze || 0} 枚铜星</em>
            </article>`;
        }).join('');
    }
    function promptTitle() {
        const map = { eggPick: '蛋：抽到 3 名新运动员，选择要复制的能力', twinPick: '双胞胎：选择复制一名上场冠军的能力', predict: '预言家：预测本场冠军', cheerleader: '拉拉队长：是否让末位前进 2 格？', hypnotist: '催眠师：是否传送一名运动员到自己所在格？', thirdwheel: '第五轮：是否传送到恰有两名运动员的格子？', copycatPick: '模仿者：选择要复制的领跑运动员', legs: '盖伊·博尔斯：掷骰或直接前进 5 格？', flopflop: '通通：掷骰或与一名运动员交换位置？', magician: '魔法师：是否重掷主移动？', dicemongerReroll: '商贩允许重掷一次：是否重掷？', genius: '天才：预测本次掷骰点数', alchemist: '炼金术师：掷出 1/2，是否改为前进 4 格？', rocket: '火箭医生：是否翻倍主移动（移动后摔倒）？', duel: '决斗家：是否发起决斗？', suckerfish: '吸盘鱼：是否跟随移动？' };
        return map[state.prompt.kind] || '请做出决定';
    }
    function renderAthletes() {
        if (state.phase === 'draft') {
            $('rosterTitle').textContent = '选角进度';
            $('athletes').innerHTML = `<div class="ma-draft-progress">${(state.players || []).map(player => {
                const count = (state.athletes || []).filter(athlete => athlete.takenBy === player.id).length;
                return `<article style="--player-color:${escapeHtml(player.color || '#777')}"><i>${escapeHtml(player.name?.slice(0, 1) || '队')}</i><div><strong>${escapeHtml(player.name)}</strong><small>${count} / ${state.teamSize} 名运动员</small></div><b>${count}</b></article>`;
            }).join('')}</div>`;
            return;
        }
        if (!(state.racers || []).length) {
            $('rosterTitle').textContent = '等待阵容';
            const entries = raceSelectionEntries();
            const readyCount = entries.filter(entry => entry.ready).length;
            $('athletes').innerHTML = `<div class="ma-roster-note"><i></i><strong>${readyCount} / ${entries.length} 队已暗置</strong><small>卡背不会泄露运动员身份；全部队伍确认后，本场能力会在这里公开。</small></div>`;
            return;
        }
        $('rosterTitle').textContent = `本场阵容 · ${state.racers.length}`;
        $('athletes').innerHTML = (state.racers || []).map(racer => {
            const athlete = athleteById(racer.athleteId) || racer.athlete;
            const status = racer.finishOrder != null ? `第 ${racer.finishOrder} 名冲线` : racer.eliminated ? '已淘汰' : racer.tripped ? `第 ${racer.position} 格 · 摔倒` : `第 ${racer.position} 格`;
            return `<article class="ma-ability-row ${racer.playerId === state.currentTurn ? 'is-current' : ''} ${racer.eliminated ? 'is-out' : ''}" data-racer-id="${escapeHtml(racer.id)}" style="--player-color:${escapeHtml(playerColor(racer.playerId))}"><span class="ma-mini-art"><i class="ma-athlete-sprite" style="${athleteArt(athlete)}"></i></span><div><strong>${escapeHtml(athlete?.name || racer.athleteId)}</strong><small>${escapeHtml(playerName(racer.playerId))} · ${status}</small><p>${escapeHtml(athlete?.description || '')}</p></div></article>`;
        }).join('');
    }
    function renderMyCard() {
        const team = state.myTeam || [];
        const me = state.players?.find(player => player.id === state.myId);
        $('myCard').innerHTML = team.length ? `<header><span class="ma-kicker">我的队伍</span><strong>我的队伍</strong><div><b>${me?.score || 0}</b><small>总分</small><b>${state.myBronze || 0}★</b></div></header><div class="ma-team-list">${team.map(card => `<div class="ma-team-card ${card.used ? 'is-used' : ''}">${athleteCard(card, { compact: true, note: card.used ? '' : '本场可用' })}</div>`).join('')}</div>` : '<header><span class="ma-kicker">我的队伍</span><strong>我的队伍</strong></header><p class="ma-muted">完成蛇形选角后，运动员会收入这里。</p>';
    }
    function specialMark(position) {
        const special = state.trackSpecials?.[position];
        if (special === 'star') return '★';
        if (special === 'trip') return '摔倒';
        if (special?.startsWith('arrow')) {
            const delta = Number(special.slice('arrow'.length));
            return `${delta > 0 ? '→' : '←'}${Math.abs(delta)}`;
        }
        return '';
    }
    function renderTrackMap() {
        const cells = [];
        for (let position = 0; position <= 9; position += 1) cells.push([position, position + 1, 1]);
        for (let position = 10; position <= 14; position += 1) cells.push([position, 10, position - 8]);
        for (let position = 15; position <= 24; position += 1) cells.push([position, 25 - position, 7]);
        for (let position = 25; position <= 29; position += 1) cells.push([position, 1, 31 - position]);
        cells.push([30, 5, 5]);
        const grouped = (state.racers || []).reduce((map, racer) => {
            const position = racer.finishOrder != null ? 30 : Math.max(0, Math.min(30, Number(racer.position) || 0));
            (map[position] ||= []).push(racer);
            return map;
        }, {});
        return `<div class="ma-track-board"><div class="ma-track-center"><span>第 ${state.match} 场</span><strong>${state.trackSide === 'wild' ? '狂野赛道' : '温和赛道'}</strong><small>第二名冲线后立即结束</small><div><b>金 ${[2, 4, 6, 8][state.match - 1] || 0}</b><b>银 ${[1, 2, 3, 4][state.match - 1] || 0}</b></div></div>${cells.map(([position, column, row]) => {
            const special = state.trackSpecials?.[position];
            const racers = grouped[position] || [];
            const specialClass = special === 'star' ? 'is-star' : special === 'trip' ? 'is-trip' : special?.startsWith('arrow') ? 'is-arrow' : '';
            return `<span class="ma-track-cell ${position === 0 ? 'is-start' : ''} ${position === 30 ? 'is-finish' : ''} ${specialClass}" data-track-position="${position}" style="grid-column:${column};grid-row:${row}" title="${position === 0 ? '起点' : position === 30 ? '终点' : `第 ${position} 格${special ? ` · ${specialMark(position)}` : ''}`}"><b>${position === 0 ? '起' : position === 30 ? '终' : specialMark(position) || position}</b><i>${position}</i><em class="ma-cell-racers">${racers.map(racer => {
                const athlete = athleteById(racer.athleteId) || racer.athlete;
                return `<span class="ma-track-racer ${racer.tripped ? 'is-tripped' : ''}" data-racer-id="${escapeHtml(racer.id)}" style="--player-color:${escapeHtml(playerColor(racer.playerId))};${athleteArt(athlete)}" title="${escapeHtml(playerName(racer.playerId))} · ${escapeHtml(athlete?.name || racer.athleteId)}"><i class="ma-athlete-sprite"></i></span>`;
            }).join('')}</em></span>`;
        }).join('')}</div>`;
    }
    function renderRace() {
        const racers = state.racers || [];
        if (state.phase === 'race_select' && !racers.length) { $('race').innerHTML = secretLineupMarkup(); return; }
        if (state.phase !== 'race' && state.phase !== 'ended' && !racers.length) { $('race').innerHTML = '<p class="ma-muted">等待选手上场。</p>'; return; }
        $('race').innerHTML = `<div class="ma-track-head"><span>${state.trackSide === 'wild' ? '狂野赛道 · 特殊格生效' : '温和赛道 · 纯粹竞速'}</span><b>起点 0 · 终点 ${state.trackLength}</b></div>${renderTrackMap()}<div class="ma-race-roster">${racers.map(racer => {
            const athlete = athleteById(racer.athleteId) || racer.athlete;
            const copied = racer.copiedAthlete && racer.copiedAthlete !== racer.athleteId ? ` · 复制${athleteById(racer.copiedAthlete)?.name || '能力'}` : '';
            const status = racer.finishOrder != null ? `第 ${racer.finishOrder} 名` : racer.eliminated ? '淘汰' : racer.tripped ? '摔倒' : `${racer.position} / 30`;
            return `<article class="${racer.playerId === state.currentTurn ? 'is-current' : ''} ${racer.eliminated ? 'is-out' : ''}" data-racer-id="${escapeHtml(racer.id)}" style="--player-color:${escapeHtml(playerColor(racer.playerId))}"><span class="ma-mini-art"><i class="ma-athlete-sprite" style="${athleteArt(athlete)}"></i></span><div><strong>${escapeHtml(athlete?.name || racer.athleteId)}</strong><small>${escapeHtml(playerName(racer.playerId))}${copied}</small></div><b>${status}</b><em>${racer.bronze || 0} ★</em></article>`;
        }).join('')}</div>`;
    }
    function racerOptions(filter = () => true) {
        return (state.racers || []).filter(racer => !racer.eliminated && racer.finishOrder == null && filter(racer)).map(racer => {
            const athlete = athleteById(racer.athleteId) || racer.athlete;
            return `<button class="ma-racer-choice ${pendingAction?.key === `target:${racer.id}` ? 'is-selected' : ''}" data-prompt-target="${racer.id}" type="button" ${actionPending ? 'disabled' : ''}><span class="ma-racer-icon"><i class="ma-athlete-sprite" style="${athleteArt(athlete)}"></i></span><strong>${escapeHtml(playerName(racer.playerId))} · ${escapeHtml(athlete?.name || racer.athleteId)}</strong><small>当前位置 ${racer.position}</small></button>`;
        });
    }
    function renderCommand() {
        const a = state.availableActions || {};
        const prompt = state.prompt;
        if (state.acknowledgement) {
            const own = state.acknowledgement.playerId === state.myId;
            $('command').innerHTML = own
                ? `<div class="ma-elimination-ack"><span>淘汰确认</span><div><strong>${escapeHtml(state.acknowledgement.athleteName)} 已被大嘴淘汰</strong><small>该运动员只退出本场比赛，你仍会参加后续比赛。8 秒后将自动确认。</small></div><button class="ma-primary" type="button" data-ui="acknowledgeElimination" ${actionPending || presentationPlaying ? 'disabled' : ''}>${actionPending ? '正在确认…' : '确认退场'}</button></div>`
                : `<div class="ma-waiting"><i></i><div><strong>等待 ${escapeHtml(playerName(state.acknowledgement.playerId))} 确认运动员淘汰</strong><small>确认后才会播放正式退场并继续比赛。</small></div></div>`;
            return;
        }
        if (prompt) { renderPrompt(prompt); return; }
        if (a.chooseAthlete) {
            const pool = state.draftPool || [];
            $('command').innerHTML = `<header class="ma-command-title"><div><span class="ma-kicker">蛇形选角</span><h3>挑选一名运动员加入队伍</h3></div><small>当前牌列 ${pool.length} 张</small></header><div class="ma-draft-guide"><span>双排牌列</span><strong>左右滑动查看全部 <i>↔</i></strong></div><div class="ma-draft-viewport"><div class="ma-choice-grid ma-draft-grid" tabindex="0" aria-label="可横向滚动的运动员牌列">${pool.map(athlete => athleteChoice(athlete, 'chooseAthlete')).join('')}</div></div>${confirmationMarkup()}`;
        } else if (a.selectRaceAthlete) {
            const remaining = state.racersPerPlayer - (state.myRaceSelections || []).length;
            const choices = (state.myTeam || []).filter(card => !card.used && !(state.myRaceSelections || []).includes(card.id));
            const locked = (state.myRaceSelections || []).map(id => athleteById(id) || (state.myTeam || []).find(card => card.id === id)).filter(Boolean);
            const lockedMarkup = locked.length ? `<div class="ma-own-lock"><b>已暗置</b>${locked.map(card => `<span><i class="ma-athlete-sprite" style="${athleteArt(card)}"></i><strong>${escapeHtml(card.name)}</strong></span>`).join('')}<small>只有你能看到这些名字</small></div>` : '';
            $('command').innerHTML = `<header class="ma-command-title"><div><span class="ma-kicker">秘密阵容</span><h3>选择本场上场运动员</h3></div><small>还需确认 ${remaining} 名</small></header>${lockedMarkup}<div class="ma-choice-grid">${choices.map(card => athleteChoice(card, 'selectRaceAthlete', '本场可用')).join('')}</div>${confirmationMarkup()}`;
        } else if (a.roll) {
            const own = (state.racers || []).filter(racer => racer.playerId === state.myId && racer.finishOrder == null && !racer.eliminated);
            $('command').innerHTML = `<header class="ma-command-title"><div><span class="ma-kicker">你的回合</span><h3>选择要行动的运动员</h3></div><small>主移动使用一枚六面骰</small></header><div class="ma-roll-choices">${own.map(racer => {
                const athlete = athleteById(racer.athleteId) || racer.athlete;
                const selected = pendingAction?.key === `roll:${racer.athleteId}`;
                return `<button class="ma-roll-choice ${selected ? 'is-selected' : ''}" data-action="roll" data-racer="${escapeHtml(racer.athleteId)}" type="button" ${actionPending ? 'disabled' : ''}><span class="ma-mini-art"><i class="ma-athlete-sprite" style="${athleteArt(athlete)}"></i></span><div><strong>${escapeHtml(athlete?.name || racer.athleteId)}</strong><small>${racer.tripped ? '本回合恢复站立，不进行主移动' : `当前位置 ${racer.position} · 点击准备掷骰`}</small></div><b>${racer.tripped ? '起' : '骰'}</b></button>`;
            }).join('')}</div>${confirmationMarkup()}<p>第二名冲线后本场立即结束；狂野赛道的星格奖励铜星。</p>`;
        } else {
            $('command').innerHTML = `<div class="ma-waiting"><i></i><div><strong>${state.status === 'ended' ? '四场比赛已经结束' : '暂时收起操作台'}</strong><small>${state.status === 'ended' ? '最终排名以累计积分和铜星决定。' : `当前由 ${escapeHtml(state.currentTurnName || '其他玩家')} 处理行动或能力。`}</small></div></div>`;
        }
    }

    function confirmationMarkup() {
        if (!pendingAction) return '';
        return `<div class="ma-confirm"><div><span>待确认</span><strong>${escapeHtml(pendingAction.title)}</strong><small>${escapeHtml(pendingAction.detail || '')}</small></div><div><button type="button" data-ui="cancelChoice">取消</button><button class="ma-primary" type="button" data-ui="confirmChoice" ${actionPending ? 'disabled' : ''}>${actionPending ? '正在提交…' : '确认执行'}</button></div></div>`;
    }

    function promptButtons(buttons) {
        return `<div class="ma-buttons">${buttons.map(button => {
            const key = `prompt:${button.action}:${button.value ?? ''}`;
            return `<button class="${button.primary ? 'ma-primary' : ''} ${pendingAction?.key === key ? 'is-selected' : ''}" data-prompt-action="${button.action}" data-prompt-value="${button.value ?? ''}" type="button" ${actionPending ? 'disabled' : ''}>${button.label}</button>`;
        }).join('')}</div>`;
    }

    function renderPrompt(prompt) {
        if (prompt.playerId !== state.myId) {
            $('command').innerHTML = `<div class="ma-waiting"><i></i><div><strong>等待 ${escapeHtml(playerName(prompt.playerId))} 处理能力</strong><small>候选牌和具体选择只对需要决定的玩家显示。</small></div></div>`;
            return;
        }
        let inner = `<header class="ma-command-title"><div><span class="ma-kicker">能力触发</span><h3>${promptTitle()}</h3></div><small>确认前不会执行</small></header>`;
        if (prompt.kind === 'eggPick') inner += `<div class="ma-choice-grid">${(prompt.pool || []).map(id => `<button class="ma-athlete-choice ${pendingAction?.key === `athlete:${id}` ? 'is-selected' : ''}" data-prompt-pick="${id}" type="button" ${actionPending ? 'disabled' : ''}>${athleteCard(athleteById(id))}</button>`).join('')}</div>`;
        else if (prompt.kind === 'twinPick') inner += `<div class="ma-choice-grid">${(prompt.options || []).map(id => `<button class="ma-athlete-choice ${pendingAction?.key === `athlete:${id}` ? 'is-selected' : ''}" data-prompt-pick="${id}" type="button" ${actionPending ? 'disabled' : ''}>${athleteCard(athleteById(id), { note: '上一场冠军' })}</button>`).join('')}</div>`;
        else if (prompt.kind === 'predict') inner += `<div class="ma-choice-grid ma-target-choices">${racerOptions().join('')}</div>`;
        else if (prompt.kind === 'copycatPick') inner += `<div class="ma-choice-grid ma-target-choices">${racerOptions(racer => (prompt.options || []).includes(racer.id)).join('')}</div>`;
        else if (prompt.kind === 'hypnotist' || prompt.kind === 'thirdwheel' || prompt.kind === 'flopflop') {
            const targetFilter = prompt.kind === 'thirdwheel'
                ? racer => (state.racers || []).filter(other => !other.eliminated && other.finishOrder == null && other.position === racer.position).length === 2 && racer.id !== prompt.racerId
                : racer => racer.id !== prompt.racerId;
            inner += `<p class="ma-prompt-note">${prompt.kind === 'flopflop' ? '选择一名对手交换位置，或保留正常掷骰。' : '选择目标即可准备使用能力，也可以直接跳过。'}</p><div class="ma-choice-grid ma-target-choices">${racerOptions(targetFilter).join('')}</div>${promptButtons([{ label: prompt.kind === 'flopflop' ? '正常掷骰' : '不使用能力', action: 'promptUse', value: '0' }])}`;
        }
        else if (prompt.kind === 'duel' || prompt.kind === 'suckerfish') {
            const target = (state.racers || []).find(racer => racer.id === prompt.targetRacerId);
            inner += `<p class="ma-prompt-note">目标：${escapeHtml(playerName(target?.playerId))} · ${escapeHtml(athleteById(target?.athleteId)?.name || target?.athleteId || '运动员')}</p>${promptButtons([{ label: prompt.kind === 'duel' ? '发起决斗' : '跟随移动', action: 'promptUse', value: '1', primary: true }, { label: '放弃', action: 'promptUse', value: '0' }])}`;
        }
        else if (prompt.kind === 'cheerleader' || prompt.kind === 'legs' || prompt.kind === 'alchemist' || prompt.kind === 'rocket') inner += promptButtons([{ label: '使用', action: 'promptUse', value: '1', primary: true }, { label: '不使用', action: 'promptUse', value: '0' }]);
        else if (prompt.kind === 'magician' || prompt.kind === 'dicemongerReroll') inner += promptButtons([{ label: '重掷', action: 'promptReroll', value: '1', primary: true }, { label: '保留', action: 'promptReroll', value: '0' }]);
        else if (prompt.kind === 'genius') inner += `<div class="ma-die-choices">${[1, 2, 3, 4, 5, 6].map(value => `<button class="${pendingAction?.key === `genius:${value}` ? 'is-selected' : ''}" data-genius-guess="${value}" type="button" ${actionPending ? 'disabled' : ''}><i>${value}</i><span>预测 ${value}</span></button>`).join('')}</div>`;
        else inner += '<div class="ma-waiting">等待决定。</div>';
        $('command').innerHTML = `${inner}${confirmationMarkup()}`;
    }
    function renderHistory() {
        $('history').innerHTML = (state.history || []).map(item => `<div class="ma-match"><span>第 ${item.match} 场 · ${item.trackSide === 'wild' ? '狂野' : '温和'}</span>${item.ranking.slice(0, 2).map(racer => `<b>${racer.place}. ${escapeHtml(playerName(racer.playerId))} · ${escapeHtml(athleteById(racer.athleteId)?.name || racer.athleteId)} ${racer.gold ? `金${racer.gold}` : racer.silver ? `银${racer.silver}` : ''}</b>`).join('')}</div>`).join('') || '<p class="ma-muted">比赛历史将显示在这里。</p>';
    }
    function renderLog() {
        $('log').innerHTML = (state.actionLog || []).slice().reverse().map((entry, index) => `<p class="${index === 0 ? 'is-latest' : ''}"><i></i>${escapeHtml(entry)}</p>`).join('') || '<p>等待比赛开始。</p>';
    }

    const findData = (attribute, value) => [...mount.querySelectorAll(`[${attribute}]`)].find(element => element.getAttribute(attribute) === String(value));
    const racerAnchor = id => findData('data-racer-id', id);
    const playerAnchor = id => findData('data-player-id', id);
    const trackAnchor = position => findData('data-track-position', position);
    const centerOf = element => {
        if (!element) return null;
        const box = element.getBoundingClientRect();
        return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    };
    function clearPresentationMarks() {
        mount.querySelectorAll('.is-presentation-source, .is-presentation-target, .is-presentation-destination').forEach(element => element.classList.remove('is-presentation-source', 'is-presentation-target', 'is-presentation-destination'));
        $('actionLines').innerHTML = '';
    }
    function drawActionLine(fromElement, toElement, tone = 'action') {
        const from = centerOf(fromElement); const to = centerOf(toElement);
        if (!from || !to) return;
        fromElement?.classList.add('is-presentation-source');
        toElement?.classList.add('is-presentation-target');
        const width = window.innerWidth; const height = window.innerHeight;
        const dx = to.x - from.x; const dy = to.y - from.y;
        const length = Math.hypot(dx, dy);
        const svg = $('actionLines');
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.innerHTML = `<defs><marker id="ma-arrow-${tone}" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z"></path></marker></defs><line class="is-${tone}" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" marker-end="url(#ma-arrow-${tone})"></line><circle class="is-pulse" cx="${to.x}" cy="${to.y}" r="10"></circle>`;
        svg.style.setProperty('--ma-line-length', `${length}px`);
    }
    function cancelPresentationWait() {
        if (presentationTimer) window.clearTimeout(presentationTimer);
        presentationTimer = null;
        const release = presentationRelease; presentationRelease = null; release?.(false);
    }
    function presentationWait(duration, token) {
        if (token !== presentationToken) return Promise.resolve(false);
        const wait = reducedMotion ? Math.min(duration, 120) : duration;
        return new Promise(resolve => {
            const finish = value => { presentationTimer = null; presentationRelease = null; resolve(value); };
            presentationRelease = finish;
            presentationTimer = window.setTimeout(() => finish(token === presentationToken), Math.max(0, wait));
        });
    }
    function showPresentation(mode, tone, kicker, title, body = '') {
        const layer = $('presentationLayer');
        layer.hidden = false;
        layer.className = `ma-presentation-layer is-${mode || 'compact'} is-${tone || 'action'}`;
        $('presentationStage').innerHTML = `<header class="ma-event-heading"><span>${escapeHtml(kicker)}</span><h2>${escapeHtml(title)}</h2></header>${body}`;
    }
    function hidePresentation() {
        const layer = $('presentationLayer');
        if (!layer) return;
        layer.hidden = true;
        layer.className = 'ma-presentation-layer';
        $('presentationStage').innerHTML = '';
        $('floatingLayer').innerHTML = '';
        clearPresentationMarks();
    }
    function eventRacer(racer, detail = '') {
        if (!racer) return '';
        const athlete = athleteById(racer.athleteId) || { id: racer.athleteId };
        return `<span class="ma-event-racer" style="--player-color:${escapeHtml(playerColor(racer.playerId))}"><i class="ma-athlete-sprite" style="${athleteArt(athlete)}"></i><span><b>${escapeHtml(racer.athleteName || athlete?.name || racer.athleteId)}</b><small>${escapeHtml(racer.playerName || playerName(racer.playerId))}${detail ? ` · ${escapeHtml(detail)}` : ''}</small></span></span>`;
    }
    async function animateFloating(fromElement, toElement, racer, token, duration = 620) {
        const from = centerOf(fromElement); const to = centerOf(toElement);
        if (!from || !to || !racer) return presentationWait(220, token);
        const athlete = athleteById(racer.athleteId) || { id: racer.athleteId };
        const ghost = document.createElement('div');
        ghost.className = 'ma-floating-racer';
        ghost.style.cssText = `left:${from.x}px;top:${from.y}px;--player-color:${playerColor(racer.playerId)};${athleteArt(athlete)}`;
        ghost.innerHTML = '<i class="ma-athlete-sprite"></i>';
        $('floatingLayer').appendChild(ghost);
        ghost.getBoundingClientRect();
        ghost.style.transform = `translate(calc(-50% + ${to.x - from.x}px), calc(-50% + ${to.y - from.y}px)) scale(1.08)`;
        const continued = await presentationWait(duration, token);
        ghost.remove();
        return continued;
    }
    function updateDisplayRacer(event) {
        const racer = state?.racers?.find(item => item.id === (event.racer?.id || event.victim?.id));
        if (!racer) return;
        if (event.to != null) racer.position = event.to;
        if (event.kind === 'racerTripped') racer.tripped = true;
        if (event.kind === 'racerRecovered') racer.tripped = false;
        if (event.kind === 'racerFinished') { racer.position = state.trackLength || 30; racer.finishOrder = event.place; }
        if (event.kind === 'racerEliminated') racer.eliminated = true;
        renderRace(); renderAthletes();
    }
    function standingsMarkup(standings, winnerIds = []) {
        const winners = new Set(winnerIds);
        return `<div class="ma-event-standings">${(standings || []).map(entry => `<span class="${winners.has(entry.playerId) ? 'is-winner' : ''}" style="--player-color:${escapeHtml(entry.color || playerColor(entry.playerId))}"><i>${entry.rank}</i><b>${escapeHtml(entry.playerName || playerName(entry.playerId))}</b><em>${entry.score ?? entry.scoreAfter ?? 0} 分</em>${entry.bronze != null ? `<small>${entry.bronze} ★</small>` : ''}</span>`).join('')}</div>`;
    }
    async function playPresentationEvent(event, token) {
        if (!event || token !== presentationToken) return;
        if (event.kind === 'athleteDrafted') {
            showPresentation('compact', 'draft', '蛇形轮抽', `${event.actorName} 招募 ${event.athlete?.name || '运动员'}`, `<div class="ma-event-transaction">${eventRacer({ athleteId: event.athlete?.id, athleteName: event.athlete?.name, playerId: event.actorId, playerName: event.actorName }, `${event.teamCount} / ${event.teamSize}`)}<b>→</b><span class="ma-event-team">加入队伍</span></div>`);
            drawActionLine($('command'), playerAnchor(event.actorId));
            await presentationWait(520, token); return;
        }
        if (event.kind === 'lineupLocked') {
            const ownName = event.private?.athleteName;
            showPresentation('compact', 'secret', '秘密阵容', `${event.actorName} 暗置第 ${event.selectedCount} 名运动员`, `<div class="ma-event-lock"><span class="ma-card-back"><i></i><b>MA</b><small>MAGICAL<br>ATHLETE</small></span><div><b>${ownName ? escapeHtml(ownName) : '牌面保密'}</b><small>${event.ready ? '本队阵容已锁定' : `还需 ${event.required - event.selectedCount} 名`}</small></div></div>`);
            drawActionLine(playerAnchor(event.actorId), $('presentationStage'), 'secret');
            await presentationWait(560, token); return;
        }
        if (event.kind === 'lineupRevealed') {
            showPresentation('major', 'reveal', `第 ${event.match} 场阵容揭晓`, event.trackSide === 'wild' ? '狂野赛道选手登场' : '温和赛道选手登场', `<div class="ma-lineup-reveal">${(event.racers || []).map(racer => eventRacer(racer, '正式上场')).join('')}</div>`);
            await presentationWait(1500, token); return;
        }
        if (event.kind === 'raceStarted' || event.kind === 'nextRaceStarted') {
            showPresentation('medium', 'start', event.kind === 'nextRaceStarted' ? '下一场即将开始' : '赛事发令', `第 ${event.match} 场 · ${event.trackSide === 'wild' ? '狂野赛道' : '温和赛道'}`, `<div class="ma-event-medals"><b>金牌 ${event.gold} 分</b><b>银牌 ${event.silver} 分</b></div><p class="ma-event-note">${escapeHtml(event.startPlayerName || '首位玩家')}首先行动</p>`);
            await presentationWait(event.kind === 'nextRaceStarted' ? 1000 : 850, token); return;
        }
        if (event.kind === 'turnStarted') {
            showPresentation('compact', 'turn', '运动员回合', `${event.playerName} 派出 ${event.racer?.athleteName || '运动员'}`, eventRacer(event.racer, `第 ${event.racer?.position || 0} 格`));
            drawActionLine(playerAnchor(event.playerId), racerAnchor(event.racer?.id));
            await presentationWait(430, token); return;
        }
        if (event.kind === 'dieRevealed') {
            const detail = event.guess != null ? `预测 ${event.guess} · 实际 ${event.value}` : event.reroll ? `重掷结果 ${event.value}` : `掷出 ${event.value}`;
            showPresentation('compact', 'dice', '中央骰区', `${event.racer?.athleteName || '运动员'} ${detail}`, `<div class="ma-event-die"><i>${event.value}</i><span>${event.reroll ? '重新掷骰' : '主移动'}</span></div>`);
            drawActionLine(racerAnchor(event.racer?.id), $('presentationStage'));
            await presentationWait(620, token); return;
        }
        if (event.kind === 'abilityTriggered') {
            const targets = event.targets || [];
            const duel = event.abilityId === 'duelist' && event.sourceRoll != null;
            showPresentation(targets.length ? 'medium' : 'compact', duel ? 'duel' : 'ability', '能力触发', `${event.source?.athleteName || '运动员'} · ${event.abilityName || event.abilityId}`, `<div class="ma-event-ability">${eventRacer(event.source, '能力发起')}${targets.length ? `<b>→</b>${targets.map(target => eventRacer(target, '受影响')).join('')}` : ''}</div>${duel ? `<div class="ma-duel-dice"><b>${event.sourceRoll}</b><i>VS</i><b>${event.targetRoll}</b></div>` : ''}`);
            if (targets[0]) drawActionLine(racerAnchor(event.source?.id), racerAnchor(targets[0].id), duel ? 'danger' : 'ability');
            await presentationWait(duel ? 1000 : 650, token); return;
        }
        if (event.kind === 'racerMoved') {
            const from = trackAnchor(event.from); const to = trackAnchor(event.to);
            showPresentation('track', 'move', event.movementType === 'main' ? '主移动' : event.movementType === 'warp' ? '传送' : '能力位移', `${event.racer?.athleteName || '运动员'}：${event.from} → ${event.to}`, `<div class="ma-event-route">${eventRacer(event.racer)}<i>${event.from}</i><b>→</b><i>${event.to}</i></div>`);
            drawActionLine(from, to, event.movementType === 'warp' ? 'secret' : 'move');
            await animateFloating(racerAnchor(event.racer?.id) || from, to, event.racer, token, 620);
            updateDisplayRacer(event);
            await presentationWait(160, token); return;
        }
        if (event.kind === 'racerTripped' || event.kind === 'racerRecovered') {
            showPresentation('compact', event.kind === 'racerTripped' ? 'trip' : 'recover', event.kind === 'racerTripped' ? '赛道意外' : '重新起身', `${event.racer?.athleteName || '运动员'}${event.kind === 'racerTripped' ? '摔倒了' : '恢复站立'}`, eventRacer(event.racer, `第 ${event.position} 格`));
            racerAnchor(event.racer?.id)?.classList.add('is-presentation-target');
            await presentationWait(520, token); updateDisplayRacer(event); return;
        }
        if (event.kind === 'bronzeAwarded' || event.kind === 'bronzeRemoved') {
            const awarded = event.kind === 'bronzeAwarded';
            showPresentation('compact', 'bronze', awarded ? '铜星奖励' : '铜星失去', `${event.racer?.athleteName || '运动员'} ${awarded ? '+' : '−'}${event.amount} ★`, eventRacer(event.racer, `累计 ${event.racer?.bronze || 0} ★`));
            await presentationWait(420, token); return;
        }
        if (event.kind === 'eliminationThreatened') {
            showPresentation('major', 'danger', '淘汰警报', `${event.source?.athleteName || '大嘴'}锁定了${event.victim?.athleteName || '目标'}`, `<div class="ma-elimination-clash">${eventRacer(event.source, 'CHOMP')}<b>!</b>${eventRacer(event.victim, '等待玩家确认')}</div><p class="ma-event-note">受影响玩家确认后才会执行正式退场</p>`);
            drawActionLine(racerAnchor(event.source?.id), racerAnchor(event.victim?.id), 'danger');
            await presentationWait(1200, token); return;
        }
        if (event.kind === 'racerEliminated') {
            showPresentation('major', 'eliminated', '本场淘汰', `${event.victim?.athleteName || '运动员'}退出本场比赛`, `<div class="ma-elimination-exit">${eventRacer(event.victim, '仍可参加后续场次')}<b>OUT</b></div>`);
            racerAnchor(event.victim?.id)?.classList.add('is-presentation-destination');
            await presentationWait(1150, token); updateDisplayRacer(event); return;
        }
        if (event.kind === 'racerFinished') {
            showPresentation(event.place === 1 ? 'medium' : 'major', 'finish', event.place === 1 ? '第一名冲线' : '第二名冲线', `${event.racer?.playerName || ''} · ${event.racer?.athleteName || '运动员'}`, `<div class="ma-finish-hero">${eventRacer(event.racer, `第 ${event.place} 名`)}<b>FINISH</b></div>`);
            drawActionLine(trackAnchor(event.position), $('presentationStage'), 'danger');
            await presentationWait(event.place === 1 ? 900 : 1200, token); updateDisplayRacer(event); return;
        }
        if (event.kind === 'raceSettlement') {
            const top = (event.ranking || []).slice(0, 2).map(entry => `<span>${eventRacer((event.racers || []).find(racer => racer.id === entry.id), `第 ${entry.place} 名`)}<b>${entry.gold ? `金牌 +${entry.gold}` : entry.silver ? `银牌 +${entry.silver}` : '未授牌'}</b></span>`).join('');
            showPresentation('major', 'settlement', `第 ${event.match} 场结束`, '金银牌与积分结算', `<div class="ma-medal-podium">${top}</div>${standingsMarkup((event.playerResults || []).slice().sort((a, b) => b.scoreAfter - a.scoreAfter).map((entry, index) => ({ ...entry, rank: index + 1, score: entry.scoreAfter })))}${event.loop ? '<p class="ma-event-note">能力循环导致本场提前结束，未发放剩余奖牌。</p>' : ''}`);
            await presentationWait(2200, token); return;
        }
        if (event.kind === 'finalSettlement') {
            const winnerNames = (event.standings || []).filter(entry => (event.winnerIds || []).includes(entry.playerId)).map(entry => entry.playerName).join('、');
            showPresentation('major', 'final', '四场运动会落幕', '最终领奖台', `${standingsMarkup(event.standings, event.winnerIds)}<p class="ma-final-winner">${escapeHtml(winnerNames || '本局玩家')}${(event.winnerIds || []).length > 1 ? '并列' : ''}赢得总冠军</p>`);
            await presentationWait(3000, token);
        }
    }

    function syncAcknowledgementTimer() {
        const acknowledgement = state?.acknowledgement;
        const nextId = acknowledgement?.playerId === state?.myId ? acknowledgement.id : null;
        if (nextId === acknowledgementId) return;
        if (acknowledgementTimer) window.clearTimeout(acknowledgementTimer);
        acknowledgementTimer = null; acknowledgementId = nextId;
        if (nextId) acknowledgementTimer = window.setTimeout(() => {
            if (state?.acknowledgement?.id !== nextId || actionPending || presentationPlaying) return;
            actionPending = true; renderCommand();
            send({ type: 'gameAction', action: { kind: 'acknowledgeElimination', acknowledgementId: nextId } });
        }, 8000);
    }
    function commitState(nextState) {
        const nextSignature = signature(nextState);
        state = nextState;
        if (nextSignature !== interactionSignature) resetInteraction();
        interactionSignature = nextSignature;
        render(); syncAcknowledgementTimer();
    }
    async function drainPresentations() {
        if (presentationPlaying || !presentationQueue.length) return;
        presentationPlaying = true; resetInteraction(); const token = ++presentationToken; render();
        while (presentationQueue.length && token === presentationToken) {
            const item = presentationQueue.shift();
            for (const event of item.presentation.events || []) {
                if (token !== presentationToken) break;
                await playPresentationEvent(event, token); clearPresentationMarks();
            }
            if (token !== presentationToken) break;
            commitState(item.state);
        }
        if (token !== presentationToken) return;
        latestPresentationState = null; hidePresentation(); presentationPlaying = false; render(); syncAcknowledgementTimer();
    }
    function skipPresentation() {
        const targetState = latestPresentationState || presentationQueue.at(-1)?.state;
        presentationQueue = []; presentationPlaying = false; presentationToken += 1;
        cancelPresentationWait(); hidePresentation(); latestPresentationState = null;
        if (targetState) commitState(targetState); else if (state) render();
    }

    function handleMessage(message) {
        if (message.state) {
            const firstState = !state;
            const presentation = message.state.presentation;
            if (presentation?.resolved && presentation.sequence !== lastPresentationSequence) {
                lastPresentationSequence = presentation.sequence;
                if (!firstState && presentation.events?.length) {
                    latestPresentationState = message.state;
                    presentationQueue.push({ presentation, state: message.state });
                    void drainPresentations();
                } else commitState(message.state);
            } else commitState(message.state);
        }
        if (message.type === 'error') {
            actionPending = false;
            addLog(message.message || '操作失败', 'error');
            if (state) renderCommand();
        }
    }
    function setRulesOpen(open) {
        $('rulesOverlay').classList.toggle('is-hidden', !open);
        $('rulesOverlay').setAttribute('aria-hidden', String(!open));
        if (open) {
            previousFocus = document.activeElement;
            requestAnimationFrame(() => $('rulesOverlay').querySelector('[data-ui="closeRules"]')?.focus());
        } else {
            previousFocus?.focus?.();
            previousFocus = null;
        }
    }
    mount.addEventListener('click', event => {
        const ui = event.target.closest('[data-ui]')?.dataset.ui;

        if (ui === 'skipPresentation') { skipPresentation(); return; }
        if (ui === 'rules') { setRulesOpen(true); return; }
        if (ui === 'closeRules' || event.target === $('rulesOverlay')) { setRulesOpen(false); return; }
        if (ui === 'cancelChoice') { resetInteraction(); renderCommand(); return; }
        if (ui === 'acknowledgeElimination') {
            const acknowledgement = state?.acknowledgement;
            if (!acknowledgement || acknowledgement.playerId !== state.myId || actionPending || presentationPlaying) return;
            actionPending = true; renderCommand();
            send({ type: 'gameAction', action: { kind: 'acknowledgeElimination', acknowledgementId: acknowledgement.id } });
            return;
        }
        if (ui === 'confirmChoice') {
            if (!pendingAction || actionPending) return;
            actionPending = true;
            renderCommand();
            send({ type: 'gameAction', action: pendingAction.payload });
            return;
        }
        const prompt = state?.prompt;
        if (prompt) {
            if (prompt.playerId !== state.myId || actionPending) return;
            const pick = event.target.closest('[data-prompt-pick]');
            if (pick) {
                const id = pick.dataset.promptPick;
                const athlete = athleteById(id);
                const payload = { kind: prompt.kind === 'eggPick' ? 'eggPick' : 'twinPick', athleteId: id };
                chooseAction(payload, `复制 ${athlete?.name || id} 的能力`, '本场比赛中将使用这名运动员的能力，确认后不能更换。', `athlete:${id}`);
                return;
            }
            const target = event.target.closest('[data-prompt-target]');
            if (target) {
                const id = target.dataset.promptTarget;
                const racer = (state.racers || []).find(item => item.id === id);
                const targetName = `${playerName(racer?.playerId)}的${athleteById(racer?.athleteId)?.name || racer?.athleteId || '运动员'}`;
                let payload;
                let title;
                if (prompt.kind === 'predict') { payload = { kind: 'predict', targetRacerId: id }; title = `预测 ${targetName} 夺冠`; }
                else if (prompt.kind === 'copycatPick') { payload = { kind: 'decide', targetRacerId: id }; title = `复制 ${targetName} 的能力`; }
                else { payload = { kind: 'decide', use: true, targetRacerId: id }; title = prompt.kind === 'flopflop' ? `与 ${targetName} 交换位置` : prompt.kind === 'thirdwheel' ? `传送到 ${targetName} 所在格` : `将 ${targetName} 传送到自己所在格`; }
                chooseAction(payload, title, '服务端会再次校验目标是否仍然有效，并按正式能力顺序处理停格效果。', `target:${id}`);
                return;
            }
            const action = event.target.closest('[data-prompt-action]');
            if (action) {
                const kind = action.dataset.promptAction; const value = action.dataset.promptValue;
                if (kind === 'promptUse') {
                    const payload = { kind: 'decide', use: value === '1' };
                    if (value === '1' && (prompt.kind === 'duel' || prompt.kind === 'suckerfish')) payload.targetRacerId = prompt.targetRacerId;
                    const using = value === '1';
                    const title = using ? (prompt.kind === 'duel' ? '确认发起决斗' : prompt.kind === 'suckerfish' ? '确认跟随目标' : '确认使用能力') : (prompt.kind === 'flopflop' || prompt.kind === 'legs' ? '放弃能力并正常掷骰' : '本次不使用能力');
                    chooseAction(payload, title, using ? '能力会立即进入正式结算流程。' : '跳过后将继续当前运动员的正常流程。', `prompt:${kind}:${value}`);
                } else if (kind === 'promptReroll') {
                    const reroll = value === '1';
                    chooseAction({ kind: 'decide', reroll }, reroll ? '放弃当前结果并重新掷骰' : '保留当前骰子结果', reroll ? '旧结果将作废，相关重掷能力按规则继续触发。' : '确认后直接使用当前结果继续移动。', `prompt:${kind}:${value}`);
                }
                return;
            }
            const genius = event.target.closest('[data-genius-guess]');
            if (genius) {
                const guess = Number(genius.dataset.geniusGuess);
                chooseAction({ kind: 'genius', guess }, `预测骰子结果为 ${guess}`, '猜中后，本回合结束时可以再行动一次。', `genius:${guess}`);
            }
            return;
        }
        const athlete = event.target.closest('[data-athlete]');
        if (athlete && !athlete.disabled) {
            const id = athlete.dataset.athlete;
            const card = athleteById(id) || (state.myTeam || []).find(item => item.id === id);
            const kind = athlete.dataset.athleteAction || 'chooseAthlete';
            chooseAction({ kind, athleteId: id }, kind === 'chooseAthlete' ? `招募 ${card?.name || id}` : `让 ${card?.name || id} 参加第 ${state.match} 场`, card?.description || '确认后将立即提交本次选择。', `athlete:${id}`);
            return;
        }
        const action = event.target.closest('[data-action]');
        if (action && !action.disabled) {
            const athleteId = action.dataset.racer;
            const racer = (state.racers || []).find(item => item.playerId === state.myId && item.athleteId === athleteId && item.finishOrder == null && !item.eliminated);
            const athlete = athleteById(athleteId) || racer?.athlete;
            chooseAction({ kind: action.dataset.action, athleteId }, racer?.tripped ? `让 ${athlete?.name || athleteId} 恢复站立` : `让 ${athlete?.name || athleteId} 开始行动`, racer?.tripped ? '本回合仅恢复站立，但仍会处理允许触发的能力。' : '确认后先处理回合开始能力，再决定或掷出主移动。', `roll:${athleteId}`);
        }
    }, { signal: controller.signal });
    mount.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        if (!$('rulesOverlay').classList.contains('is-hidden')) setRulesOpen(false);
        else if (pendingAction) { resetInteraction(); renderCommand(); }
    }, { signal: controller.signal });
    return {
        gameType: 'magicalathlete',
        handleMessage,
        destroy() {
            presentationToken += 1; presentationQueue = []; cancelPresentationWait(); hidePresentation();
            if (acknowledgementTimer) window.clearTimeout(acknowledgementTimer);
            controller.abort();
            style.remove();
            document.body.classList.remove('is-magicalathlete-view');
            mount.innerHTML = '';
        },
    };
}
