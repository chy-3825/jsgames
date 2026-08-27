const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
const CODE_LENGTH = 4;

export function createGameClient({ mount, send, addLog }) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/games/guessnumber/style.css?v=20260826-mobile-shell-1';
    document.head.appendChild(link);
    document.body.classList.add('is-guessnumber-view');

    let state = null;
    let guess = '';
    let submitting = false;
    let rulesOpen = false;
    const controller = new AbortController();

    mount.innerHTML = `<section class="gn-app" tabindex="-1" aria-label="猜数字游戏">
        <header class="gn-statusbar">
            <div class="gn-brand"><span class="gn-brand-mark" aria-hidden="true"><b>A</b><i>B</i></span><div><small>BULLS &amp; COWS · SOLO CASE</small><strong>猜数字</strong></div></div>
            <div class="gn-turn-status"><span class="gn-turn-dot" aria-hidden="true"></span><div><small data-role="phase">等待开局</small><strong data-role="turn">等待游戏状态</strong></div></div>
            <div class="gn-status-actions"><span class="gn-session-tag">单人档案</span><button class="gn-icon-button" data-ui="rules" type="button" aria-label="查看判读规则" title="判读规则">?</button></div>
        </header>

        <main class="gn-main">
            <section class="gn-console" aria-label="密码输入终端">
                <div class="gn-console-meta"><span>CASE FILE / 004</span><span data-role="answerState">答案未解密</span></div>

                <section class="gn-secret-zone" aria-label="隐藏答案">
                    <div class="gn-section-heading"><div><span class="gn-kicker">THE HIDDEN CODE</span><strong>目标密码</strong></div><small data-role="secretHint">四位互不重复数字</small></div>
                    <div class="gn-secret-slots" data-role="secretSlots"></div>
                </section>

                <section class="gn-input-zone" aria-label="当前猜测">
                    <header class="gn-input-heading"><div><span class="gn-kicker">YOUR ATTEMPT</span><strong>输入本次猜测</strong></div><span class="gn-input-count" data-role="inputCount">0 / 4</span></header>
                    <div class="gn-input-slots" data-role="inputSlots"></div>
                    <div class="gn-keypad" data-role="keypad"></div>
                    <div class="gn-input-help"><span><i class="gn-live-dot"></i>终端已连接</span><small>输入通道已就绪</small></div>
                </section>

                <section class="gn-latest" data-role="latest" aria-live="polite"></section>
            </section>

            <aside class="gn-dossier" aria-label="推理档案">
                <header class="gn-dossier-heading"><div><span class="gn-kicker">INVESTIGATION LOG</span><strong>推理档案</strong></div><span data-role="status">进行中</span></header>
                <section class="gn-metrics" aria-label="游戏统计"><div><small>已尝试</small><strong data-role="attempts">0</strong><span>次</span></div><div><small>已排查</small><strong data-role="tested">0</strong><span>/ 10 数字</span></div><div><small>密码长度</small><strong>4</strong><span>位</span></div></section>
                <section class="gn-player-record" data-role="playerRecord"></section>
                <section class="gn-reading-guide"><header><strong>反馈判读</strong><i aria-hidden="true"></i></header><div><span class="gn-chip is-a">A</span><p><b>位置正确</b><small>数字和位置都正确</small></p></div><div><span class="gn-chip is-b">B</span><p><b>数字正确</b><small>数字正确但位置错误</small></p></div></section>
                <section class="gn-history-panel"><header><div><strong>尝试记录</strong><small>最近 12 次</small></div><span data-role="historyCount">0 条</span></header><div class="gn-history" data-role="history"></div></section>
            </aside>
        </main>

        <div class="gn-overlay is-hidden" data-role="rulesOverlay" aria-hidden="true">
            <div class="gn-dialog" role="dialog" aria-modal="true" aria-labelledby="gn-rules-title"><button class="gn-dialog-close" data-ui="close-rules" type="button" aria-label="关闭判读规则">x</button><span class="gn-dialog-label">BULLS &amp; COWS · 规则</span><h2 id="gn-rules-title">如何读取反馈</h2><p>输入四个不重复的数字。每次提交后，系统会告诉你有多少数字与位置已经吻合。</p><div class="gn-rule-list"><article><span class="gn-chip is-a">A</span><div><strong>位置正确</strong><small>数字本身和所在位置都正确。</small></div></article><article><span class="gn-chip is-b">B</span><div><strong>数字正确</strong><small>数字存在于答案中，但位置不对。</small></div></article><article><span class="gn-chip is-none">—</span><div><strong>未出现</strong><small>这个数字不在隐藏答案里。</small></div></article></div><div class="gn-dialog-note">答案不会在进行中显示；猜中后才会解密。</div></div>
        </div>
    </section>`;

    const root = mount.querySelector('.gn-app');
    const $ = role => mount.querySelector(`[data-role="${role}"]`);

    function handleMessage(message) {
        if (message.state) {
            state = message.state;
            submitting = false;
            if (state.status === 'ended') guess = '';
            render();
        }
        if (message.type === 'error') {
            submitting = false;
            addLog?.(message.message || '操作失败', 'error');
            render();
        } else {
            const text = message.action?.message || (message.type !== 'gameState' ? message.message : '');
            if (text) addLog?.(text, 'info');
        }
    }

    function render() {
        if (!state) return;
        const player = getPlayer(state.myId) || state.players?.[0] || null;
        const ended = state.status === 'ended';
        const canGuess = Boolean(state.availableActions?.canGuess) && !submitting;
        const history = player?.history || [];
        const testedDigits = new Set(history.flatMap(item => String(item.guess || '').split(''))).size;

        root.classList.toggle('is-active', canGuess);
        root.classList.toggle('is-ended', ended);
        $('turn').textContent = ended ? (state.winner ? `${state.winner.name} 破解成功` : '档案已封存') : state.myIsCurrentTurn ? '轮到你输入猜测' : `${state.currentTurnName || '其他玩家'}的回合`;
        $('phase').textContent = ended ? '答案已解密' : state.status === 'playing' ? '推理进行中' : '等待开局';
        $('status').textContent = ended ? (state.winner ? '已破解' : '已结束') : '不限次数';
        $('answerState').textContent = ended ? '答案已解密' : '答案未解密';
        $('secretHint').textContent = ended ? '本局答案' : '四位互不重复数字';
        $('attempts').textContent = String(player?.attempts ?? 0);
        $('tested').textContent = String(testedDigits);
        $('historyCount').textContent = `${history.length} 条`;

        renderSecret(ended ? state.secret : null);
        renderInput(canGuess);
        renderKeypad(canGuess);
        renderLatest(ended);
        renderPlayer(player, ended);
        renderHistory(history);
    }

    function renderSecret(secret) {
        const slots = String(secret || '????').padEnd(CODE_LENGTH, '?').slice(0, CODE_LENGTH).split('');
        $('secretSlots').innerHTML = slots.map((digit, index) => `<span class="gn-secret-digit ${secret ? 'is-revealed' : ''}" aria-label="${secret ? `第${index + 1}位 ${digit}` : `第${index + 1}位隐藏`}">${secret ? esc(digit) : '<i>?</i>'}</span>`).join('');
    }

    function renderInput(canGuess) {
        $('inputCount').textContent = `${guess.length} / ${CODE_LENGTH}`;
        $('inputSlots').innerHTML = Array.from({ length: CODE_LENGTH }, (_, index) => `<span class="gn-input-digit ${guess[index] ? 'is-filled' : ''} ${index === guess.length && canGuess ? 'is-next' : ''}">${guess[index] ? esc(guess[index]) : '<i>·</i>'}</span>`).join('');
    }

    function renderKeypad(canGuess) {
        $('keypad').innerHTML = `${DIGITS.map(digit => {
            const used = guess.includes(digit);
            const disabled = !canGuess || guess.length >= CODE_LENGTH || used;
            return `<button class="gn-digit-key ${used ? 'is-used' : ''}" type="button" data-digit="${digit}" ${disabled ? 'disabled' : ''} aria-label="输入数字 ${digit}">${digit}</button>`;
        }).join('')}<button class="gn-clear-key" data-ui="clear" type="button" ${!canGuess || !guess ? 'disabled' : ''}>清除</button><button class="gn-submit-key" data-ui="submit" type="button" ${!canGuess || guess.length !== CODE_LENGTH ? 'disabled' : ''}><span>提交猜测</span><b>↵</b></button>`;
    }

    function renderLatest(ended) {
        const result = state.lastResult;
        if (!result) {
            $('latest').innerHTML = `<div class="gn-latest-empty"><span class="gn-latest-mark">A/B</span><div><strong>等待第一次反馈</strong><small>提交四位数字后，命中结果会显示在这里。</small></div></div>`;
            return;
        }
        const solved = result.exact === CODE_LENGTH;
        $('latest').innerHTML = `<div class="gn-latest-heading"><span>${ended && solved ? '密码已破解' : '最近一次反馈'}</span><small>第 ${result.attempt} 次猜测</small></div><div class="gn-latest-result"><strong>${esc(result.guess)}</strong><div class="gn-score-line"><span class="gn-score is-a"><b>${result.exact}</b>A <small>位置</small></span><span class="gn-score is-b"><b>${result.misplaced}</b>B <small>数字</small></span><span class="gn-score is-none"><b>${result.absent}</b><small>未出现</small></span></div></div>${ended ? `<p class="gn-ended-message">${state.winner ? '答案已解密，恭喜你完成本案。' : '本局已结束。'}</p>` : ''}`;
    }

    function renderPlayer(player, ended) {
        if (!player) {
            $('playerRecord').innerHTML = '<span class="gn-muted">等待玩家档案</span>';
            return;
        }
        $('playerRecord').innerHTML = `<div class="gn-player-avatar">${esc(firstCharacter(player.name))}</div><div class="gn-player-copy"><strong>${esc(player.name)}</strong><small>${ended ? '档案已封存' : '当前破解者'}</small></div><span class="gn-player-state ${ended ? 'is-done' : ''}">${ended ? 'DONE' : 'LIVE'}</span>`;
    }

    function renderHistory(history) {
        if (!history.length) {
            $('history').innerHTML = '<p class="gn-history-empty">提交第一次猜测后，反馈会按时间倒序记录。</p>';
            return;
        }
        $('history').innerHTML = history.slice(-12).reverse().map((item, reverseIndex) => {
            const number = String(history.length - reverseIndex).padStart(2, '0');
            return `<div class="gn-history-row"><span class="gn-history-index">${number}</span><div class="gn-history-guess">${String(item.guess).split('').map(digit => `<i>${esc(digit)}</i>`).join('')}</div><div class="gn-history-score"><b class="is-a">${item.exact}A</b><b class="is-b">${item.misplaced}B</b><b class="is-none">${item.absent}—</b></div></div>`;
        }).join('');
    }

    function addDigit(digit) {
        if (!canGuess() || guess.length >= CODE_LENGTH || guess.includes(digit)) return;
        guess += digit;
        render();
    }

    function removeDigit() {
        if (!canGuess()) return;
        guess = guess.slice(0, -1);
        render();
    }

    function submit() {
        if (!canGuess()) return;
        if (guess.length !== CODE_LENGTH) {
            addLog?.('请输入四个不重复的数字', 'error');
            return;
        }
        submitting = true;
        const value = guess;
        guess = '';
        send({ type: 'gameAction', action: { kind: 'submitGuess', guess: value } });
        render();
    }

    function canGuess() {
        return Boolean(state?.availableActions?.canGuess) && state?.status === 'playing';
    }

    function getPlayer(id) {
        return (state?.players || []).find(player => player.id === id) || null;
    }

    function firstCharacter(value) {
        return Array.from(String(value || '玩'))[0] || '玩';
    }

    function setRules(open) {
        rulesOpen = open;
        const overlay = $('rulesOverlay');
        overlay.classList.toggle('is-hidden', !open);
        overlay.setAttribute('aria-hidden', String(!open));
    }

    function handleKeydown(event) {
        if (event.key === 'Escape' && rulesOpen) {
            setRules(false);
            return;
        }
        if (rulesOpen) return;
        if (/^\d$/.test(event.key)) {
            event.preventDefault();
            addDigit(event.key);
        } else if (event.key === 'Backspace') {
            event.preventDefault();
            removeDigit();
        } else if (event.key === 'Enter') {
            event.preventDefault();
            submit();
        }
    }

    mount.addEventListener('click', event => {
        const digit = event.target.closest('[data-digit]');
        if (digit) {
            addDigit(digit.dataset.digit);
            return;
        }
        const ui = event.target.closest('[data-ui]')?.dataset.ui;
        if (ui === 'clear') {
            guess = '';
            render();
        } else if (ui === 'submit') {
            submit();
        } else if (ui === 'rules') {
            setRules(true);
        } else if (ui === 'close-rules' || event.target === $('rulesOverlay')) {
            setRules(false);
        }
    }, { signal: controller.signal });

    window.addEventListener('keydown', handleKeydown, { signal: controller.signal });

    return {
        gameType: 'guessnumber',
        handleMessage,
        destroy() {
            controller.abort();
            document.body.classList.remove('is-guessnumber-view');
            link.remove();
            mount.innerHTML = '';
        },
    };
}

function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
