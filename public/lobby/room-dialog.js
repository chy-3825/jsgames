/**
 * Two-step create-room dialog and metadata-driven room settings.
 *
 * The controller owns only form state and markup.  Network transport and
 * lobby state remain callbacks supplied by the application entry point.
 */

export function createRoomDialogController({
    elements = {},
    getCurrentRoomId = () => null,
    getCurrentRoom = () => null,
    getActiveGame = () => null,
    setActiveGame = () => {},
    getRequestPending = () => false,
    setRequestPending = () => {},
    getGameList = () => [],
    getMyName = () => '房主',
    getGamePresentation = game => game,
    getGameDetails = () => ({ overview: '', rules: [], note: '' }),
    playModeLabels = {},
    getGameCovers = () => ({}),
    isConnected = () => false,
    isTransportOpen = () => false,
    addLog = () => {},
    selectGame = () => {},
    createRoom = () => {},
    escapeHtml = value => String(value ?? ''),
} = {}) {
    const {
        dialog,
        dialogClose,
        ruleHero,
        ruleSymbol,
        ruleEnglish,
        dialogTitle,
        ruleOverview,
        rulePlayers,
        ruleTime,
        ruleMode,
        ruleList,
        ruleNote,
        nextButton,
        form,
        nameInput,
        capacityField,
        capacityOptions,
        specialSettings,
        formError,
        backButton,
        cancelButton,
        confirmButton,
    } = elements;

    function choiceMarkup(name, options, selectedValue, inputAttributes = '') {
        return options.map(option => `<label><input type="radio" name="${escapeHtml(name)}" value="${escapeHtml(option.value)}" ${String(option.value) === String(selectedValue) ? 'checked' : ''} required${inputAttributes}><span><b>${escapeHtml(option.title)}</b>${option.copy ? `<small>${escapeHtml(option.copy)}</small>` : ''}</span></label>`).join('');
    }

    function getRoomSettingDefinitions(source = getCurrentRoom()) {
        return Array.isArray(source?.roomSettings) ? source.roomSettings : [];
    }

    function getRoomSettingValues(source = getCurrentRoom(), overrides = {}) {
        const options = source?.gameOptions || {};
        return getRoomSettingDefinitions(source).reduce((values, definition) => {
            if (overrides[definition.key] !== undefined) values[definition.key] = overrides[definition.key];
            else if (options[definition.key] !== undefined) values[definition.key] = options[definition.key];
            else values[definition.key] = definition.defaultValue;
            return values;
        }, {});
    }

    function renderSharedRoomSettings(source, values = {}, context = 'create', disabled = false) {
        const definitions = getRoomSettingDefinitions(source);
        return definitions.map((definition, index) => {
            const key = escapeHtml(definition.key);
            const inputName = escapeHtml(context === 'create' ? definition.key : `room-setting-${definition.key}`);
            const value = values[definition.key] !== undefined ? values[definition.key] : definition.defaultValue;
            const disabledAttribute = disabled ? ' disabled' : '';
            const inputAttributes = ` data-room-setting-input data-room-setting-key="${key}"${disabledAttribute}`;
            const legacyFieldAttribute = definition.key === 'playerCount'
                ? ' data-room-player-count'
                : definition.key === 'encryptorMode'
                    ? ' data-encryptor-mode'
                    : '';
            if (definition.kind === 'toggle') {
                return `<div class="room-setting-field room-toggle-row" data-room-setting="${key}"><div class="room-toggle-copy"><b>${escapeHtml(definition.label)}</b>${definition.description ? `<small>${escapeHtml(definition.description)}</small>` : ''}</div><label class="room-switch"><input type="checkbox" name="${inputName}"${value === true ? ' checked' : ''}${inputAttributes}><span aria-hidden="true"></span></label></div>`;
            }
            const headingClass = context === 'create' && index === 0 ? ' class="room-special-heading"' : '';
            const heading = `<legend${headingClass}><span>${escapeHtml(definition.label)}</span>${context === 'create' && index === 0 ? '<em>SPECIAL RULES</em>' : ''}</legend>`;
            return `<fieldset class="room-setting-field" data-room-setting="${key}"${legacyFieldAttribute}>${heading}<div class="room-setting-options">${choiceMarkup(inputName, definition.options || [], value, inputAttributes)}</div>${definition.description ? `<small>${escapeHtml(definition.description)}</small>` : ''}</fieldset>`;
        }).join('');
    }

    function collectRoomSettingValues(root, source = getCurrentRoom()) {
        const values = {};
        getRoomSettingDefinitions(source).forEach(definition => {
            const input = root?.querySelector(`[data-room-setting-key="${definition.key}"]:checked`) || root?.querySelector(`[data-room-setting-key="${definition.key}"]`);
            if (!input) return;
            values[definition.key] = input.type === 'checkbox' ? input.checked : input.value;
        });
        return values;
    }

    function defaultRoomName(gameTitle) {
        const hostName = (nameInput?.value || getMyName() || '房主').trim() || '房主';
        return [...`${hostName}的${gameTitle}房间`].slice(0, 24).join('');
    }

    function renderCreateRoomSettings(game) {
        const meta = getGamePresentation(game);
        form?.reset();
        if (nameInput) nameInput.value = defaultRoomName(meta.title || game.name);
        form?.querySelector('input[name="isPublic"][value="true"]')?.setAttribute('checked', '');
        formError.textContent = '';
        const isFixedCountGame = Number(game.minPlayers) === Number(game.maxPlayers);
        const usesSpecialPlayerCount = getRoomSettingDefinitions(game).some(definition => definition.key === 'playerCount' && definition.requiredBeforeJoin);
        const syncStudyCapacity = () => {
            const selectedMode = specialSettings?.querySelector('[data-room-setting-key="gameMode"]:checked')?.value;
            if (capacityField) capacityField.hidden = isFixedCountGame || usesSpecialPlayerCount || selectedMode === 'study';
        };
        if (capacityField) capacityField.hidden = isFixedCountGame || usesSpecialPlayerCount;
        if (!capacityField?.hidden) {
            const limits = [];
            for (let count = Number(game.minPlayers); count <= Number(game.maxPlayers); count += 1) limits.push({ value: count, title: `${count} 人` });
            if (capacityOptions) capacityOptions.innerHTML = choiceMarkup('seatLimit', limits, game.maxPlayers);
        } else if (capacityOptions) capacityOptions.innerHTML = '';
        if (specialSettings) {
            specialSettings.innerHTML = renderSharedRoomSettings(game, getRoomSettingValues(game), 'create');
            specialSettings.onchange = syncStudyCapacity;
        }
        syncStudyCapacity();
    }

    function open(gameType, returnFocusElement = null) {
        if (getCurrentRoomId()) return addLog('请先离开当前房间', 'error');
        const game = getGameList().find(item => item.type === gameType);
        if (!game || !dialog) return addLog('没有找到该游戏', 'error');
        setActiveGame(game);
        dialog._returnFocusElement = returnFocusElement || document.activeElement;
        selectGame(game.type, false);
        const meta = getGamePresentation(game);
        const details = getGameDetails(game.type);
        ruleSymbol.textContent = meta.symbol || '◇';
        ruleEnglish.textContent = meta.english || game.type.toUpperCase();
        dialogTitle.textContent = meta.title || game.name;
        ruleOverview.textContent = details.overview;
        rulePlayers.textContent = meta.players || `${game.minPlayers}–${game.maxPlayers} 人`;
        ruleTime.textContent = meta.time || '实时';
        ruleMode.textContent = playModeLabels[game.playMode] || '在线桌游';
        ruleList.innerHTML = details.rules.map(([title, copy], index) => `<article class="create-room-rule-item"><span>${String(index + 1).padStart(2, '0')}</span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(copy)}</p></article>`).join('');
        ruleNote.textContent = details.note;
        const dialogArt = getGameCovers()[game.type] || meta.art;
        if (dialogArt) ruleHero.style.setProperty('--dialog-art', `url("${dialogArt}")`);
        else ruleHero.style.removeProperty('--dialog-art');
        renderCreateRoomSettings(game);
        dialog.querySelector('.game-rules-step').inert = false;
        form.inert = true;
        dialog.classList.remove('is-settings');
        dialog.hidden = false;
        dialog.setAttribute('aria-hidden', 'false');
        document.body.classList.add('has-create-dialog');
        requestAnimationFrame(() => {
            dialog.classList.add('is-open');
            dialogClose?.focus();
        });
    }

    function showSettings() {
        if (!getActiveGame() || getRequestPending()) return;
        dialog.querySelector('.game-rules-step').inert = true;
        form.inert = false;
        dialog.classList.add('is-settings');
        form.scrollTop = 0;
        setTimeout(() => nameInput?.focus(), 180);
    }

    function showRules() {
        if (getRequestPending()) return;
        dialog.querySelector('.game-rules-step').inert = false;
        form.inert = true;
        dialog.classList.remove('is-settings');
        setTimeout(() => nextButton?.focus(), 180);
    }

    function close(force = false) {
        if (!dialog || (getRequestPending() && !force) || dialog.hidden) return;
        dialog.classList.remove('is-open');
        dialog.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('has-create-dialog');
        const returnFocus = dialog._returnFocusElement;
        setTimeout(() => {
            if (dialog.classList.contains('is-open')) return;
            dialog.hidden = true;
            dialog.classList.remove('is-settings');
            setActiveGame(null);
            if (!force && returnFocus?.isConnected) returnFocus.focus();
        }, 230);
    }

    function setPending(pending) {
        setRequestPending(Boolean(pending));
        const isPending = getRequestPending();
        if (confirmButton) {
            confirmButton.disabled = isPending;
            confirmButton.innerHTML = isPending ? '正在创建…' : '确定创建 <span>→</span>';
        }
        if (backButton) backButton.disabled = isPending;
        if (cancelButton) cancelButton.disabled = isPending;
        if (dialogClose) dialogClose.disabled = isPending;
    }

    function submit(event) {
        event.preventDefault();
        const activeGame = getActiveGame();
        if (!activeGame || getRequestPending()) return;
        if (!isConnected() || !isTransportOpen()) {
            formError.textContent = '当前尚未连接到服务器，请稍后重试。';
            return;
        }
        const formData = new FormData(form);
        const roomName = String(formData.get('roomName') || '').replace(/\s+/g, ' ').trim();
        if (!roomName) {
            formError.textContent = '请输入房间名称。';
            nameInput?.focus();
            return;
        }
        if ([...roomName].length > 24) {
            formError.textContent = '房间名称不能超过 24 个字符。';
            nameInput?.focus();
            return;
        }
        const gameOptions = {};
        getRoomSettingDefinitions(activeGame).forEach(definition => {
            const value = formData.get(definition.key);
            if (value === null) return;
            gameOptions[definition.key] = definition.kind === 'toggle' ? formData.get(definition.key) === 'on' : value;
        });
        const seatLimitValue = formData.get('seatLimit');
        formError.textContent = '';
        createRoom({
            gameType: activeGame.type,
            roomName,
            isPublic: formData.get('isPublic') !== 'false',
            ...(seatLimitValue ? { seatLimit: Number(seatLimitValue) } : {}),
            ...(Object.keys(gameOptions).length ? { gameOptions } : {}),
        });
    }

    return {
        open,
        showSettings,
        showRules,
        close,
        setPending,
        submit,
        getRoomSettingDefinitions,
        getRoomSettingValues,
        renderSharedRoomSettings,
        collectRoomSettingValues,
    };
}
