/**
 * Shared controls for the one-person chess study table.
 *
 * The controls are deliberately independent of any board implementation;
 * game clients only receive placement callbacks while the lobby owns the
 * authoritative study actions.
 */

const STUDY_SIDE_LABELS = {
    chess: { white: '白方', black: '黑方' },
    xiangqi: { red: '红方', black: '黑方' },
    jungle: { red: '红方', blue: '蓝方' },
    junqi: { red: '红方', blue: '蓝方' },
    gobang: { black: '黑方', white: '白方' },
    checkers: { red: '红方', blue: '蓝方', green: '绿方', yellow: '黄方', purple: '紫方', orange: '橙方' },
};

const STUDY_PIECE_TYPES = {
    chess: [['p', '兵'], ['n', '马'], ['b', '象'], ['r', '车'], ['q', '后'], ['k', '王']],
    xiangqi: {
        red: [['s', '兵'], ['r', '車'], ['h', '馬'], ['e', '相'], ['a', '仕'], ['c', '炮'], ['k', '帥']],
        black: [['s', '卒'], ['r', '車'], ['h', '馬'], ['e', '象'], ['a', '士'], ['c', '砲'], ['k', '將']],
    },
    jungle: [['r', '鼠'], ['c', '猫'], ['d', '狗'], ['w', '狼'], ['l', '豹'], ['t', '虎'], ['j', '狮'], ['e', '象']],
};

export function createStudyControls({
    gameMount,
    getGameType = () => '',
    documentRef = globalThis.document,
} = {}) {
    let element = null;

    function studySideLabel(gameType, color, fallback = '当前阵营') {
        return STUDY_SIDE_LABELS[gameType]?.[color] || fallback || (color ? `${color}方` : '当前阵营');
    }

    function studyPieceTypes(gameType, color) {
        const types = STUDY_PIECE_TYPES[gameType];
        if (gameType === 'xiangqi') return types?.[color] || types?.red || [];
        return types || [];
    }

    function install() {
        element?.remove();
        element = documentRef.createElement('section');
        element.className = 'study-controls';
        element.hidden = true;
        element.setAttribute('aria-label', '棋谱模式控制');
        element.innerHTML = '<span class="study-controls-kicker">STUDY TABLE</span><strong data-study-label>棋谱模式</strong><small data-study-detail></small><div class="study-controls-actions"><button type="button" data-study-switch>切换到下一方</button><button type="button" data-study-reset hidden>标准开局</button><button type="button" data-study-clear hidden>清空局面</button><button type="button" data-study-remove hidden>删除棋子</button><button type="button" data-study-confirm hidden>完成摆棋</button></div><div class="study-piece-tray" data-study-piece-tray hidden></div>';
        gameMount.appendChild(element);
        return element;
    }

    function update(state) {
        if (!element) return;
        const active = Boolean(state?.studyMode);
        element.hidden = !active;
        gameMount.dataset.studySide = active ? String(state.myColor || '') : '';
        if (!active) return;
        const seats = Array.isArray(state.studySeatNames) ? state.studySeatNames : [];
        const index = Number(state.studySeatIndex || 0);
        const current = seats[index] || { name: state.myColor || '当前阵营' };
        const next = seats[(index + 1) % Math.max(1, seats.length)] || current;
        const gameType = getGameType();
        const currentSide = studySideLabel(gameType, current.color || state.myColor, current.name);
        const nextSide = studySideLabel(gameType, next.color, next.name);
        const turnSeat = seats.find(seat => seat.id === state.currentTurn || seat.color === state.turn);
        const turnSide = studySideLabel(gameType, turnSeat?.color, turnSeat?.name || state.currentTurnName || '当前回合');
        const label = element.querySelector('[data-study-label]');
        const detail = element.querySelector('[data-study-detail]');
        const button = element.querySelector('[data-study-switch]');
        const reset = element.querySelector('[data-study-reset]');
        const clear = element.querySelector('[data-study-clear]');
        const remove = element.querySelector('[data-study-remove]');
        const confirm = element.querySelector('[data-study-confirm]');
        const tray = element.querySelector('[data-study-piece-tray]');
        element.dataset.studySeatIndex = String(index);
        element.dataset.studySeatCount = String(seats.length);
        element.dataset.studyPhase = String(state.studyPhase || 'play');
        if (label) label.textContent = `当前：${currentSide}`;
        const setup = state.studyPhase === 'setup';
        const nativeSetup = state.phase === 'setup';
        if (detail) detail.textContent = nativeSetup ? `先完成${currentSide}布阵，再切换另一方` : setup ? `点击棋盘移动或摆放${currentSide}棋子` : state.myIsCurrentTurn ? `当前${currentSide}可以行动` : `等待${turnSide}；可切换后继续推演`;
        if (button) button.textContent = `切换到${nextSide}`;
        if (reset) reset.hidden = !setup || nativeSetup;
        if (clear) clear.hidden = !setup || nativeSetup;
        if (remove) remove.hidden = !setup || nativeSetup;
        if (confirm) confirm.hidden = !setup || nativeSetup;
        if (tray) {
            const types = studyPieceTypes(gameType, current.color || state.myColor);
            tray.hidden = !setup || nativeSetup || !types.length;
            tray.innerHTML = types.map(([type, name]) => `<button type="button" data-study-place-type="${type}" class="${element.dataset.studyPlacementType === type ? 'is-selected' : ''}">${name}</button>`).join('');
        }
    }

    function refreshSelection() {
        element?.querySelectorAll('[data-study-place-type]').forEach(button => button.classList.toggle('is-selected', button.dataset.studyPlaceType === element.dataset.studyPlacementType));
        const remove = element?.querySelector('[data-study-remove]');
        remove?.classList.toggle('is-selected', element.dataset.studyRemoveMode === 'true');
    }

    return {
        install,
        update,
        refreshSelection,
        getElement: () => element,
        getSeatIndex: () => element?.dataset.studySeatIndex || '',
        getSeatCount: () => element?.dataset.studySeatCount || '',
    };
}
