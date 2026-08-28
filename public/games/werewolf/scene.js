import { eliminationNoticeKey, escapeHtml, formatVoteBallots, transitionAnnouncementKey } from './constants.js';

/** Night/day transitions and personal elimination scenes for 狼人杀. */
export function createWerewolfScene({ mount, model, getElement, renderer, windowRef = globalThis.window || globalThis }) {
    const $ = role => getElement(role);
    function transitionGlyphs(text) {
        return [...String(text || '')].map((character, index) => {
            const safeCharacter = character === ' ' ? '\u00a0' : character;
            const shards = Array.from({ length: 12 }, (_, shardIndex) => {
                const x = 100 + ((index * 43 + shardIndex * 61) % 180); const y = ((index * 29 + shardIndex * 47) % 160) - 112; const middleX = 30 + ((index * 17 + shardIndex * 29) % 62); const middleY = ((index * 13 + shardIndex * 23) % 54) - 38; const rotation = ((index * 37 + shardIndex * 53) % 300) - 150; const middleRotation = ((index * 19 + shardIndex * 31) % 90) - 45; const width = 1 + ((index + shardIndex * 2) % 6); const height = 2 + ((index * 2 + shardIndex * 3) % 7); const delay = (shardIndex % 6) * 38; const trail = 12 + ((index * 11 + shardIndex * 17) % 30); const opacity = (.58 + ((index + shardIndex * 3) % 38) / 100).toFixed(2);
                return `<i class="ww-transition-shard" aria-hidden="true" style="--sx:${x}px;--sy:${y}px;--mx:${middleX}px;--my:${middleY}px;--srot:${rotation}deg;--mrot:${middleRotation}deg;--sw:${width}px;--sh:${height}px;--sd:${delay}ms;--trail:${trail}px;--so:${opacity}"></i>`;
            }).join('');
            return `<span class="ww-transition-glyph" style="--i:${index};--gd:${index * 60}ms"><b>${escapeHtml(safeCharacter)}</b>${shards}</span>`;
        }).join('');
    }
    function setTransitionText(element, text) {
        const value = String(text || ''); element.innerHTML = transitionGlyphs(value); element.setAttribute('aria-label', value);
    }
    function speakTransition(text) {
        if (!model.voiceEnabled || !text || !windowRef.speechSynthesis || typeof windowRef.SpeechSynthesisUtterance !== 'function') return;
        windowRef.speechSynthesis.cancel(); const utterance = new windowRef.SpeechSynthesisUtterance(text); utterance.lang = 'zh-CN'; utterance.rate = .88; utterance.pitch = .92; windowRef.speechSynthesis.speak(utterance);
    }
    function hideTransition() {
        if (model.transitionTimer) windowRef.clearTimeout(model.transitionTimer); if (model.transitionResultTimer) windowRef.clearTimeout(model.transitionResultTimer);
        model.transitionTimer = null; model.transitionResultTimer = null; model.transitionSequence += 1;
        const element = $('transition'); element?.classList.add('is-hidden'); element?.setAttribute('aria-hidden', 'true'); mount.querySelector('.ww-app')?.classList.remove('is-transitioning');
    }
    function showTransition(kind, announcement = null, onComplete = null) {
        const element = $('transition'); const appRoot = mount.querySelector('.ww-app'); if (!element || !appRoot) { onComplete?.(); return; }
        if (model.transitionTimer) windowRef.clearTimeout(model.transitionTimer); if (model.transitionResultTimer) windowRef.clearTimeout(model.transitionResultTimer);
        const sequence = ++model.transitionSequence; const title = element.querySelector('[data-role="transitionTitle"]'); const result = element.querySelector('[data-role="transitionResult"]'); const isNight = kind === 'night'; const isDay = kind === 'day'; const isVictory = kind === 'victory'; const deaths = Array.isArray(announcement?.deaths) ? announcement.deaths : [];
        const resultText = isDay ? (announcement?.peaceful ? '昨夜是平安夜' : `昨夜的死者是 ${deaths.join('、')} 号`) : announcement?.text || ''; const titleText = isNight ? '天黑请闭眼' : isDay ? '天亮了' : announcement?.title || '';
        element.className = `ww-transition ${isNight ? 'is-night' : isDay ? 'is-day' : isVictory ? `is-victory is-${announcement?.faction || 'good'}` : `is-event is-${announcement?.kind || 'notice'}`}${isDay && announcement?.peaceful ? ' is-peaceful' : ''}${isDay && !announcement?.peaceful ? ' is-danger' : ''}`; element.classList.remove('show-result'); element.setAttribute('aria-hidden', 'false'); appRoot.classList.add('is-transitioning'); setTransitionText(title, titleText); setTransitionText(result, isNight ? '' : resultText); speakTransition(isNight ? titleText : `${titleText}。${resultText}`);
        if (!isNight) model.transitionResultTimer = windowRef.setTimeout(() => { if (sequence === model.transitionSequence) element.classList.add('show-result'); }, isDay ? 420 : 300);
        model.transitionTimer = windowRef.setTimeout(() => { if (sequence !== model.transitionSequence) return; hideTransition(); onComplete?.(); }, isVictory ? 2600 : isDay ? 1600 : kind === 'elimination' ? 1800 : 1400);
    }
    function hidePersonalElimination() {
        if (model.eliminationTimer) windowRef.clearTimeout(model.eliminationTimer); if (model.eliminationShatterTimer) windowRef.clearTimeout(model.eliminationShatterTimer);
        model.eliminationTimer = null; model.eliminationShatterTimer = null; model.eliminationSequence += 1; const element = $('elimination'); element?.classList.add('is-hidden'); element?.classList.remove('is-entering', 'is-shattering'); element?.setAttribute('aria-hidden', 'true'); mount.querySelector('.ww-app')?.classList.remove('is-eliminating');
    }
    function showPersonalElimination(data = null, onComplete = null) {
        const element = $('elimination'); const appRoot = mount.querySelector('.ww-app'); if (!element || !appRoot) { onComplete?.(); return; }
        hidePersonalElimination(); const sequence = ++model.eliminationSequence; element.className = 'ww-elimination is-entering'; const text = data?.text || '您已出局'; const plate = element.querySelector('.ww-elimination-plate strong'); if (plate) plate.textContent = text; element.setAttribute('aria-hidden', 'false'); appRoot.classList.add('is-eliminating'); speakTransition(text);
        model.eliminationShatterTimer = windowRef.setTimeout(() => { if (sequence === model.eliminationSequence) element.classList.add('is-shattering'); }, 1050);
        model.eliminationTimer = windowRef.setTimeout(() => { if (sequence === model.eliminationSequence) { hidePersonalElimination(); onComplete?.(); } }, 1800);
    }
    function enqueueScene(scene) { model.sceneQueue.push(scene); playNextScene(); }
    function playNextScene() {
        if (model.scenePlaying || !model.sceneQueue.length) return;
        model.scenePlaying = true; const scene = model.sceneQueue.shift(); const complete = () => { if (scene.archive === 'vote') renderer.pulseBulletin(); model.scenePlaying = false; playNextScene(); };
        if (scene.kind === 'delay') model.sceneDelayTimer = windowRef.setTimeout(() => { model.sceneDelayTimer = null; complete(); }, scene.duration || 1800); else if (scene.kind === 'elimination') showPersonalElimination(scene.data, complete); else showTransition(scene.kind, scene.data, complete);
    }
    function maybePlayTransition(previous, next) {
        if (!next) return;
        const eliminationKey = eliminationNoticeKey(next.eliminationNotice);
        if (!previous) { model.lastAnnouncementDayKey = transitionAnnouncementKey(next.announcement); model.lastEliminationKey = eliminationKey; model.lastPublicEventId = next.publicEvents?.at(-1)?.id ?? next.publicEvent?.id ?? null; model.lastWinnerKey = next.winner ? `${next.winner.faction}:${next.winner.reason}` : ''; return; }
        const previousPhase = previous.phase || ''; const nextPhase = next.phase || ''; const wasNight = previousPhase.startsWith('night'); const isNight = nextPhase.startsWith('night'); if (isNight && !wasNight) enqueueScene({ kind: 'night' });
        const announcementKey = transitionAnnouncementKey(next.announcement); const newPersonalElimination = Boolean(eliminationKey && eliminationKey !== model.lastEliminationKey); if (newPersonalElimination) model.lastEliminationKey = eliminationKey;
        const freshEvents = (next.publicEvents?.length ? next.publicEvents : next.publicEvent ? [next.publicEvent] : []).filter(event => model.lastPublicEventId == null || event.id > model.lastPublicEventId);
        for (const event of freshEvents) {
            model.lastPublicEventId = event.id;
            if (['nightDeaths', 'peacefulNight'].includes(event.kind)) { model.lastAnnouncementDayKey = announcementKey; enqueueScene({ kind: 'day', data: next.announcement }); }
            else if (event.kind === 'elimination') { enqueueScene({ kind: 'event', data: event }); if (event.eliminatedSeats?.includes(next.activeSeat)) enqueueScene({ kind: 'elimination', data: { text: '您已出局' } }); }
            else if (['exile', 'voteTie'].includes(event.kind)) { const voteResult = next.lastVoteResult; enqueueScene({ kind: 'event', data: { ...event, text: `${event.text}。${formatVoteBallots(voteResult)}` }, archive: 'vote' }); }
            else enqueueScene({ kind: 'event', data: event, archive: event.kind === 'identityReveal' ? 'vote' : null });
        }
        if (!freshEvents.length && announcementKey && announcementKey !== model.lastAnnouncementDayKey) { model.lastAnnouncementDayKey = announcementKey; enqueueScene({ kind: 'day', data: next.announcement }); }
        if (newPersonalElimination && !freshEvents.some(event => event.kind === 'elimination' && event.eliminatedSeats?.includes(next.activeSeat))) enqueueScene({ kind: 'elimination' });
        const winnerKey = next.winner ? `${next.winner.faction}:${next.winner.reason}` : '';
        if (winnerKey && winnerKey !== model.lastWinnerKey) { model.lastWinnerKey = winnerKey; const finalPersonalElimination = next.winner.eliminatedSeats?.includes(next.activeSeat) && !newPersonalElimination && !freshEvents.some(event => event.kind === 'elimination'); if (finalPersonalElimination) enqueueScene({ kind: 'elimination' }); enqueueScene({ kind: 'victory', data: { ...next.winner, title: next.winner.name } }); }
    }
    function stop() {
        model.sceneQueue = []; model.scenePlaying = false; if (model.sceneDelayTimer) windowRef.clearTimeout(model.sceneDelayTimer); model.sceneDelayTimer = null; hideTransition(); hidePersonalElimination();
    }
    return { maybePlayTransition, stop, hideTransition, hidePersonalElimination, enqueueScene, isPlaying: () => model.scenePlaying };
}
