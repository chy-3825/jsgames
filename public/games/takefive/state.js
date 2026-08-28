/** Mutable view model kept by the client entry and shared by the UI modules. */
export function createTakeFiveModel() {
    return {
        state: null,
        pendingCardId: null,
        confirmingCard: false,
        pendingRowIndex: null,
        rowChoiceSubmitting: false,
    };
}

export const cloneRows = rows => (rows || []).map(row => (row || []).map(card => ({ ...card })));

export function getPhaseCopy(state, view = {}) {
    if (!state) return '等待游戏状态';
    if (view.presentationBusy) return view.presentationPhase === 'backs' ? '所有人已锁牌 · 准备翻开' : '正在按数字从小到大结算';
    if (view.scenePlaying) return '正在公布本手结算';
    if (state.status === 'ended') {
        const winners = state.winners?.length ? state.winners : state.winner ? [state.winner] : [];
        if (!winners.length) return '本局结束';
        return winners.length > 1
            ? `${winners.map(player => player.name).join('、')} 并列获胜`
            : `${winners[0].name} 获胜`;
    }
    if (state.phase === 'drafting') {
        return state.availableActions?.canDraft
            ? '轮到你从公开牌池选牌'
            : `等待 ${state.draft?.currentPlayerName || '当前玩家'} 公开选牌`;
    }
    if (state.phase === 'choose_row') {
        return state.pendingRowChoice?.playerId === state.myId
            ? `你的 ${state.pendingRowChoice.card.value} 需要收取一行`
            : `等待 ${state.pendingRowChoice?.playerName || '当前玩家'} 选择牌行`;
    }
    if (state.phase === 'resolving') return '正在按数字从小到大结算';
    if (state.availableActions?.canSelect) return '选择一张手牌并锁定';
    if (state.mySelectedCardId) return `你的牌已锁定 · ${state.selectedCount}/${state.playerCount}`;
    return `等待玩家选牌 · ${state.selectedCount}/${state.playerCount}`;
}

export function getPlayerStatus(state, player) {
    if (player.isOnline === false) return '离线';
    if (state.status === 'ended') return '最终得分';
    if (state.phase === 'drafting') {
        if (state.draft?.currentPlayerId === player.id) return '正在选牌';
        return `${player.handCount || 0} / 10 张`;
    }
    if (player.hasSelected) return '已锁定';
    if (state.phase === 'choose_row' && state.pendingRowChoice?.playerId === player.id) return '正在选行';
    return `${player.handCount || 0} 张手牌`;
}
