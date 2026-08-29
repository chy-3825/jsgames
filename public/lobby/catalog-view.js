// Catalog and public-room rendering.  The view receives state accessors and
// actions from script.js, keeping DOM markup independent from WebSocket flow.

export function createCatalogView({
    elements,
    escapeHtml,
    gamePresentation,
    groupPresentation,
    playModeLabels,
    gameCoverThumbs,
    bggArt,
    getGameList,
    setGameList,
    getSelectedGameFilter,
    setSelectedGameFilter,
    getSelectedJoinRoomFilter,
    setSelectedJoinRoomFilter,
    getPublicRooms,
    setPublicRooms,
    isInRoom,
    roomStatusText,
    addLog,
    openCreateRoomDialog,
    refreshLazyCoverArt,
    refreshGameCardReveal,
}) {
    const {
        gameTypeSelect, gamePickerEl, gameCountEl, joinLobbyGameFilterEl,
        roomListEl, mobileRoomListEl, mobileRoomCountLabel, roomCountLabel,
        joinLobbyRoomListEl, joinLobbyRoomCountEl,
    } = elements;

    function getGamePresentation(game) {
        const presentation = gamePresentation[game.type] || {
            symbol: '◇',
            title: game.name,
            subtitle: '在线桌游',
            english: game.type.toUpperCase(),
            players: `${game.minPlayers}–${game.maxPlayers} 人`,
            time: '—',
            tone: 'default',
            description: '和朋友一起开始一局游戏。',
        };
        return { ...presentation, art: presentation.art || gameCoverThumbs[game.type] || bggArt[game.type] || null };
    }

    function renderGameCard(game, index) {
        const meta = getGamePresentation(game);
        const modeLabel = playModeLabels[game.playMode] || '在线桌游';
        const artAttribute = meta.art ? ` data-card-art="${escapeHtml(meta.art)}"` : '';
        return `<article class="game-card tone-${meta.tone} ${meta.art ? 'has-cover-art' : ''} ${index === 0 ? 'is-featured' : ''}" data-game-type="${escapeHtml(game.type)}" tabindex="0" role="button" aria-label="查看${escapeHtml(meta.title || game.name)}规则并创建房间"><div class="game-card-art"${artAttribute} aria-hidden="true"><span class="art-orbit"></span><span class="game-symbol">${meta.symbol}</span><span class="game-card-index">${String(index + 1).padStart(2, '0')}</span><span class="game-art-label">${escapeHtml(meta.english)}</span></div><div class="game-card-body"><div class="game-card-title"><div><h3>${escapeHtml(meta.title || game.name)}</h3><p>${escapeHtml(meta.subtitle || meta.description)}</p></div><span class="game-card-arrow" aria-hidden="true">↗</span></div><div class="game-card-meta"><span>${escapeHtml(meta.players || `${game.minPlayers}–${game.maxPlayers} 人`)}</span><i></i><span>${escapeHtml(meta.time || '实时')}</span></div><span class="game-mode-badge mode-${escapeHtml(game.playMode || 'online')}">${escapeHtml(modeLabel)}</span></div></article>`;
    }

    function selectGame(type, announce = true) {
        if (!Array.from(gameTypeSelect.options).some(option => option.value === type)) return;
        gameTypeSelect.value = type;
        if (announce) addLog(`${gamePresentation[type]?.title || type} 已选中`, 'system');
    }

    function gameMatchesFilter(game) {
        const selected = getSelectedGameFilter();
        if (!game || selected === 'all') return true;
        const min = Number(game.minPlayers || 0);
        const max = Number(game.maxPlayers || 0);
        if (selected === 'two') return min <= 2 && max >= 2;
        if (selected === 'small') return min <= 4 && max >= 2;
        if (selected === 'large') return max >= 5;
        return true;
    }

    function applyGameFilter() {
        gamePickerEl?.querySelectorAll('[data-game-group]').forEach(group => {
            let visibleCount = 0;
            group.querySelectorAll('[data-game-type]').forEach(card => {
                const game = getGameList().find(item => item.type === card.dataset.gameType);
                const visible = gameMatchesFilter(game);
                card.hidden = !visible;
                if (visible) visibleCount += 1;
            });
            group.hidden = visibleCount === 0;
        });
        refreshGameCardReveal();
    }

    function renderGameList(games) {
        let nextGames = [...(games || [])];
        if (!nextGames.length) nextGames = [{ type: 'loveletter', name: '情书', minPlayers: 2, maxPlayers: 4 }];
        nextGames = nextGames.map(game => ({
            ...game,
            group: game.group || 'tabletop',
            groupName: game.groupName || groupPresentation[game.group || 'tabletop']?.name || '卡牌与策略桌游',
        })).sort((a, b) => (a.groupOrder || 99) - (b.groupOrder || 99) || (a.sortOrder || 999) - (b.sortOrder || 999) || String(a.name).localeCompare(String(b.name), 'zh-CN'));
        setGameList(nextGames);
        gameTypeSelect.innerHTML = nextGames.map(game => `<option value="${escapeHtml(game.type)}">${escapeHtml(game.name)}</option>`).join('');
        if (joinLobbyGameFilterEl) {
            const selected = getSelectedJoinRoomFilter();
            const filterStillExists = selected === 'all' || nextGames.some(game => game.type === selected);
            setSelectedJoinRoomFilter(filterStillExists ? selected : 'all');
            joinLobbyGameFilterEl.innerHTML = `<option value="all">全部游戏</option>${nextGames.map(game => `<option value="${escapeHtml(game.type)}">${escapeHtml(game.name)}</option>`).join('')}`;
            joinLobbyGameFilterEl.value = getSelectedJoinRoomFilter();
        }
        let cardIndex = 0;
        const groupedGames = nextGames.reduce((groups, game) => {
            const key = game.group || 'tabletop';
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(game);
            return groups;
        }, new Map());
        gamePickerEl.innerHTML = [...groupedGames.entries()].map(([groupId, groupGames]) => {
            const group = groupPresentation[groupId] || { name: groupGames[0]?.groupName || groupId, description: '' };
            const cards = groupGames.map(game => renderGameCard(game, cardIndex++)).join('');
            return `<section class="game-group" data-game-group="${escapeHtml(groupId)}"><header class="game-group-header"><div><span class="eyebrow">GAME COLLECTION</span><h3>${escapeHtml(group.name)}</h3><p>${escapeHtml(group.description)}</p></div><span class="game-group-count">${groupGames.length} 款</span></header><div class="game-catalog">${cards}</div></section>`;
        }).join('');
        gamePickerEl.querySelectorAll('[data-game-type]').forEach(card => {
            card.classList.add('is-reveal-pending');
            card.addEventListener('click', event => {
                if (event.target.closest('a,button,input,select')) return;
                openCreateRoomDialog(card.dataset.gameType, card);
            });
            card.addEventListener('keydown', event => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openCreateRoomDialog(card.dataset.gameType, card);
                }
            });
        });
        refreshLazyCoverArt();
        gameCountEl.textContent = String(nextGames.length);
        applyGameFilter();
        selectGame(gameTypeSelect.value || nextGames[0].type, false);
    }

    function roomListMarkup(rooms, emptyTitle = '还没有公开房间', emptyDescription = '创建一张桌，邀请朋友加入') {
        if (!rooms || rooms.length === 0) return `<div class="empty-state"><span>○</span><p>${escapeHtml(emptyTitle)}</p><small>${escapeHtml(emptyDescription)}</small></div>`;
        return rooms.map(room => {
            const meta = gamePresentation[room.gameType] || { symbol: '◇', tone: 'default' };
            const presentation = getGamePresentation({ type: room.gameType, name: room.gameName, minPlayers: room.minPlayers, maxPlayers: room.maxPlayers });
            const artAttribute = presentation.art ? ` data-card-art="${escapeHtml(presentation.art)}" data-card-art-variable="room"` : '';
            const host = room.players?.find(player => player.id === room.hostId)?.name || '房主';
            const canJoin = room.status !== 'playing' && room.status !== 'ended' && !isInRoom(room.id);
            return `<article class="room-item room-tone-${meta.tone}" data-game-type="${escapeHtml(room.gameType)}"><span class="room-item-art"${artAttribute}><span class="room-mini-symbol">${meta.symbol}</span></span><div class="room-info"><strong>${escapeHtml(room.roomName || room.gameName || room.gameType)}</strong><span>${escapeHtml(room.gameName || room.gameType)} · ${escapeHtml(room.id)} · ${room.playerCount}/${room.maxPlayers} 人</span><small>房主 ${escapeHtml(host)}</small></div><div class="room-item-action">${canJoin ? `<button class="join-button" data-room-id="${escapeHtml(room.id)}" type="button">加入 <span>→</span></button>` : `<span class="room-state">${isInRoom(room.id) ? '已加入' : roomStatusText(room.status)}</span>`}</div></article>`;
        }).join('');
    }

    function renderJoinLobbyRooms() {
        if (!joinLobbyRoomListEl) return;
        const publicRoomList = getPublicRooms();
        const selected = getSelectedJoinRoomFilter();
        const rooms = selected === 'all' ? publicRoomList : publicRoomList.filter(room => room.gameType === selected);
        const emptyTitle = publicRoomList.length ? '没有匹配的公开房间' : '还没有公开房间';
        const emptyDescription = publicRoomList.length ? '换一个游戏筛选，或者输入房间号直达朋友的牌桌' : '创建一张桌，邀请朋友加入';
        joinLobbyRoomListEl.innerHTML = roomListMarkup(rooms, emptyTitle, emptyDescription);
        if (joinLobbyRoomCountEl) joinLobbyRoomCountEl.textContent = String(rooms.length);
        refreshLazyCoverArt();
    }

    function renderRoomList(rooms) {
        const count = rooms?.length || 0;
        setPublicRooms([...(rooms || [])]);
        roomCountLabel.textContent = `${count} 张桌`;
        if (mobileRoomCountLabel) mobileRoomCountLabel.textContent = count ? `${count} 个公开房间可查看` : '暂时没有公开房间';
        const markup = roomListMarkup(rooms);
        roomListEl.innerHTML = markup;
        if (mobileRoomListEl) mobileRoomListEl.innerHTML = markup;
        refreshLazyCoverArt();
        renderJoinLobbyRooms();
    }

    return { getGamePresentation, renderGameCard, renderGameList, selectGame, roomListMarkup, renderRoomList, renderJoinLobbyRooms, applyGameFilter, gameMatchesFilter };
}
