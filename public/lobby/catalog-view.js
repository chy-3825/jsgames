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
    let lastGameListKey = null;
    const roomRenderKeys = new WeakMap();
    const gameCardRenderKeys = new WeakMap();

    function ownerDocument(element) {
        return element?.ownerDocument || globalThis.document;
    }

    function roomItemKey(room) {
        return JSON.stringify(room || {});
    }

    function gameCardKey(game) {
        return JSON.stringify(game || {});
    }

    function bindGameCard(card) {
        if (!card || card.dataset.catalogBound === 'true') return;
        card.dataset.catalogBound = 'true';
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
    }

    function copyElementContents(target, source) {
        if (!target || !source) return target;
        const catalogBound = target.dataset?.catalogBound;
        target.className = source.className;
        Array.from(source.attributes || []).forEach(attribute => {
            if (attribute.name !== 'class') target.setAttribute(attribute.name, attribute.value);
        });
        Array.from(target.attributes || []).forEach(attribute => {
            if (attribute.name !== 'class' && !source.hasAttribute(attribute.name)) target.removeAttribute(attribute.name);
        });
        target.replaceChildren?.(...Array.from(source.childNodes || []));
        if (!target.replaceChildren) target.innerHTML = source.innerHTML;
        if (catalogBound) target.dataset.catalogBound = catalogBound;
        return target;
    }

    function parseMarkup(doc, markup) {
        if (!doc?.createElement) return null;
        const holder = doc.createElement('div');
        holder.innerHTML = markup;
        return holder.firstElementChild;
    }

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

    function syncGameCatalog(nextGames) {
        const doc = ownerDocument(gamePickerEl);
        if (!doc?.createElement || !gamePickerEl?.replaceChildren) {
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
                return `<section class="game-group" data-game-group="${escapeHtml(groupId)}"><header class="game-group-header"><div><h3>${escapeHtml(group.name)}</h3><p>${escapeHtml(group.description)}</p></div><span class="game-group-count">${groupGames.length} 款</span></header><div class="game-catalog">${cards}</div></section>`;
            }).join('');
            gamePickerEl.querySelectorAll('[data-game-type]').forEach(bindGameCard);
            return;
        }
        const previousGroups = new Map(Array.from(gamePickerEl.children || [])
            .filter(group => group.dataset?.gameGroup)
            .map(group => [group.dataset.gameGroup, group]));
        const previousCards = gameCardRenderKeys.get(gamePickerEl) || new Map();
        const nextCards = new Map();
        let cardIndex = 0;
        const groupedGames = nextGames.reduce((groups, game) => {
            const key = game.group || 'tabletop';
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(game);
            return groups;
        }, new Map());
        const fragment = doc.createDocumentFragment();
        groupedGames.forEach((groupGames, groupId) => {
            const presentation = groupPresentation[groupId] || { name: groupGames[0]?.groupName || groupId, description: '' };
            const groupMarkup = `<section class="game-group" data-game-group="${escapeHtml(groupId)}"><header class="game-group-header"><div><h3>${escapeHtml(presentation.name)}</h3><p>${escapeHtml(presentation.description || '')}</p></div><span class="game-group-count">${groupGames.length} 款</span></header><div class="game-catalog"></div></section>`;
            let groupElement = previousGroups.get(groupId);
            if (!groupElement) groupElement = parseMarkup(doc, groupMarkup);
            else {
                const nextHeader = parseMarkup(doc, groupMarkup)?.querySelector('.game-group-header');
                const currentHeader = groupElement.querySelector('.game-group-header');
                if (nextHeader && currentHeader) copyElementContents(currentHeader, nextHeader);
            }
            const catalog = groupElement?.querySelector('.game-catalog');
            if (!groupElement || !catalog) return;
            const previousByType = new Map(Array.from(catalog.children || [])
                .filter(card => card.dataset?.gameType)
                .map(card => [card.dataset.gameType, card]));
            const cardFragment = doc.createDocumentFragment();
            groupGames.forEach(game => {
                const index = cardIndex++;
                const key = gameCardKey(game);
                let card = previousByType.get(game.type);
                const priorKey = previousCards.get(game.type);
                if (!card) {
                    card = parseMarkup(doc, renderGameCard(game, index));
                    bindGameCard(card);
                } else if (priorKey !== key) {
                    const replacement = parseMarkup(doc, renderGameCard(game, index));
                    copyElementContents(card, replacement);
                } else {
                    const indexElement = card.querySelector('.game-card-index');
                    if (indexElement) indexElement.textContent = String(index + 1).padStart(2, '0');
                    card.classList.toggle('is-featured', index === 0);
                }
                if (card) {
                    nextCards.set(game.type, key);
                    cardFragment.appendChild(card);
                }
            });
            catalog.replaceChildren(cardFragment);
            fragment.appendChild(groupElement);
        });
        gamePickerEl.replaceChildren(fragment);
        gameCardRenderKeys.set(gamePickerEl, nextCards);
    }

    function renderGameList(games) {
        let nextGames = [...(games || [])];
        if (!nextGames.length) nextGames = [{ type: 'loveletter', name: '情书', minPlayers: 2, maxPlayers: 4 }];
        nextGames = nextGames.map(game => ({
            ...game,
            group: game.group || 'tabletop',
            groupName: game.groupName || groupPresentation[game.group || 'tabletop']?.name || '卡牌与策略',
        })).sort((a, b) => (a.groupOrder || 99) - (b.groupOrder || 99) || (a.sortOrder || 999) - (b.sortOrder || 999) || String(a.name).localeCompare(String(b.name), 'zh-CN'));
        const nextKey = JSON.stringify(nextGames);
        setGameList(nextGames);
        if (gameTypeSelect && lastGameListKey !== nextKey) {
            gameTypeSelect.innerHTML = nextGames.map(game => `<option value="${escapeHtml(game.type)}">${escapeHtml(game.name)}</option>`).join('');
        }
        if (joinLobbyGameFilterEl && lastGameListKey !== nextKey) {
            const selected = getSelectedJoinRoomFilter();
            const filterStillExists = selected === 'all' || nextGames.some(game => game.type === selected);
            setSelectedJoinRoomFilter(filterStillExists ? selected : 'all');
            joinLobbyGameFilterEl.innerHTML = `<option value="all">全部游戏</option>${nextGames.map(game => `<option value="${escapeHtml(game.type)}">${escapeHtml(game.name)}</option>`).join('')}`;
            joinLobbyGameFilterEl.value = getSelectedJoinRoomFilter();
        }
        if (lastGameListKey !== nextKey) {
            syncGameCatalog(nextGames);
            lastGameListKey = nextKey;
            refreshLazyCoverArt();
        }
        gameCountEl.textContent = String(nextGames.length);
        applyGameFilter();
        selectGame(gameTypeSelect.value || nextGames[0].type, false);
    }

    function roomListMarkup(rooms, emptyTitle = '暂时没有公开房间', emptyDescription = '可以选择游戏并创建房间') {
        if (!rooms || rooms.length === 0) return `<div class="empty-state"><span>○</span><p>${escapeHtml(emptyTitle)}</p><small>${escapeHtml(emptyDescription)}</small></div>`;
        return rooms.map(room => {
            const meta = gamePresentation[room.gameType] || { symbol: '◇', tone: 'default' };
            const presentation = getGamePresentation({ type: room.gameType, name: room.gameName, minPlayers: room.minPlayers, maxPlayers: room.maxPlayers });
            const artAttribute = presentation.art ? ` data-card-art="${escapeHtml(presentation.art)}" data-card-art-variable="room"` : '';
            const host = room.players?.find(player => player.id === room.hostId)?.name || '房主';
            const canJoin = room.status !== 'playing' && room.status !== 'ended' && !isInRoom(room.id);
            return `<article class="room-item room-tone-${meta.tone}" data-room-id="${escapeHtml(room.id)}" data-game-type="${escapeHtml(room.gameType)}"><span class="room-item-art"${artAttribute}><span class="room-mini-symbol">${meta.symbol}</span></span><div class="room-info"><strong>${escapeHtml(room.roomName || room.gameName || room.gameType)}</strong><span>${escapeHtml(room.gameName || room.gameType)} · ${escapeHtml(room.id)} · ${room.playerCount}/${room.maxPlayers} 人</span><small>房主 ${escapeHtml(host)}</small></div><div class="room-item-action">${canJoin ? `<button class="join-button" data-room-id="${escapeHtml(room.id)}" type="button">加入房间 <span>→</span></button>` : `<span class="room-state">${isInRoom(room.id) ? '已加入' : roomStatusText(room.status)}</span>`}</div></article>`;
        }).join('');
    }

    function syncRoomList(container, rooms, emptyTitle = '暂时没有公开房间', emptyDescription = '可以选择游戏并创建房间') {
        if (!container) return false;
        const normalizedRooms = [...(rooms || [])];
        const nextKey = JSON.stringify({ emptyTitle, emptyDescription, rooms: normalizedRooms });
        if (roomRenderKeys.get(container)?.snapshot === nextKey) return false;
        const doc = ownerDocument(container);
        if (!doc?.createElement || !container.replaceChildren) {
            container.innerHTML = roomListMarkup(normalizedRooms, emptyTitle, emptyDescription);
            roomRenderKeys.set(container, { snapshot: nextKey, items: new Map(normalizedRooms.map(room => [String(room.id), roomItemKey(room)])) });
            return true;
        }
        const activeElement = doc.activeElement;
        const focusedRoomId = activeElement?.closest?.('[data-room-id]')?.dataset?.roomId || null;
        const existingItems = new Map(Array.from(container.children || [])
            .filter(item => item.dataset?.roomId)
            .map(item => [String(item.dataset.roomId), item]));
        const previousItems = roomRenderKeys.get(container)?.items || new Map();
        if (!normalizedRooms.length) {
            const empty = parseMarkup(doc, roomListMarkup([], emptyTitle, emptyDescription));
            container.replaceChildren(empty);
            roomRenderKeys.set(container, { snapshot: nextKey, items: new Map() });
            return true;
        }
        const fragment = doc.createDocumentFragment();
        const nextItems = new Map();
        normalizedRooms.forEach(room => {
            const id = String(room.id);
            const key = roomItemKey(room);
            let item = existingItems.get(id);
            if (!item) item = parseMarkup(doc, roomListMarkup([room]));
            else if (previousItems.get(id) !== key) {
                const replacement = parseMarkup(doc, roomListMarkup([room]));
                copyElementContents(item, replacement);
            }
            if (item) {
                nextItems.set(id, key);
                fragment.appendChild(item);
            }
        });
        container.replaceChildren(fragment);
        roomRenderKeys.set(container, { snapshot: nextKey, items: nextItems });
        if (focusedRoomId) {
            const focusTarget = Array.from(container.querySelectorAll?.('button[data-room-id], [data-room-id][tabindex]') || [])
                .find(element => element.dataset.roomId === focusedRoomId);
            focusTarget?.focus?.({ preventScroll: true });
        }
        return true;
    }

    function renderJoinLobbyRooms() {
        if (!joinLobbyRoomListEl) return;
        const publicRoomList = getPublicRooms();
        const selected = getSelectedJoinRoomFilter();
        const rooms = selected === 'all' ? publicRoomList : publicRoomList.filter(room => room.gameType === selected);
        const emptyTitle = publicRoomList.length ? '没有匹配的公开房间' : '暂时没有公开房间';
        const emptyDescription = publicRoomList.length ? '请调整游戏筛选条件，或输入房间号加入房间' : '可以选择游戏并创建房间';
        syncRoomList(joinLobbyRoomListEl, rooms, emptyTitle, emptyDescription);
        if (joinLobbyRoomCountEl) joinLobbyRoomCountEl.textContent = String(rooms.length);
        refreshLazyCoverArt();
    }

    function renderRoomList(rooms) {
        const count = rooms?.length || 0;
        setPublicRooms([...(rooms || [])]);
        roomCountLabel.textContent = `${count} 个房间`;
        if (mobileRoomCountLabel) mobileRoomCountLabel.textContent = count ? `${count} 个公开房间可查看` : '暂时没有公开房间';
        syncRoomList(roomListEl, rooms);
        if (mobileRoomListEl) syncRoomList(mobileRoomListEl, rooms);
        renderJoinLobbyRooms();
        refreshLazyCoverArt();
    }

    return { getGamePresentation, renderGameCard, renderGameList, selectGame, roomListMarkup, renderRoomList, renderJoinLobbyRooms, applyGameFilter, gameMatchesFilter };
}
