import { eliminationNoticeKey, escapeHtml, formatVoteBallots, transitionAnnouncementKey } from './constants.js';
import { beginPresentationFade, clearPresentationFade, PRESENTATION_FADE_MS } from '../common/presentation-fade.js';

// A public bulletin is an atomic presentation: one message enters, remains
// readable, and leaves before the next message starts.  The visible portion
// is deliberately split into a short entrance and a generous reading hold;
// the shared fade helper then owns the independent exit phase.  Keeping these
// numbers explicit makes it impossible for a second queued bulletin to steal
// the first one's reading time.
export const WEREWOLF_PRESENTATION_TIMING = Object.freeze({
    fadeInMs: 240,
    holdMs: 900,
    fadeOutMs: PRESENTATION_FADE_MS,
});
const SHERIFF_DAWN_TIMING = Object.freeze({
    visibleMs: 1800,
    fadeInMs: 480,
    fadeOutMs: 600,
});
export const WEREWOLF_SCENE_VISIBLE_MS = Object.freeze({
    atom: WEREWOLF_PRESENTATION_TIMING.fadeInMs + WEREWOLF_PRESENTATION_TIMING.holdMs,
    night: WEREWOLF_PRESENTATION_TIMING.fadeInMs + WEREWOLF_PRESENTATION_TIMING.holdMs,
    day: WEREWOLF_PRESENTATION_TIMING.fadeInMs + WEREWOLF_PRESENTATION_TIMING.holdMs,
    event: WEREWOLF_PRESENTATION_TIMING.fadeInMs + WEREWOLF_PRESENTATION_TIMING.holdMs,
    victory: 1600,
    elimination: 3600,
});
const LONG_TEXT_THRESHOLD = 12;
const LONG_TEXT_EXTRA_PER_CHARACTER_MS = 35;
const LONG_TEXT_EXTRA_MAX_MS = 700;
const SPEECH_FALLBACK_MIN_MS = 850;
const SPEECH_FALLBACK_MAX_MS = 12000;

export function werewolfPresentationDuration(kind, text, explicitDuration = null) {
    const explicit = Number(explicitDuration);
    if (Number.isFinite(explicit) && explicit > 0) return explicit;
    const base = WEREWOLF_SCENE_VISIBLE_MS[kind] || WEREWOLF_SCENE_VISIBLE_MS.atom;
    const extra = Math.min(LONG_TEXT_EXTRA_MAX_MS, Math.max(0, [...String(text || '')].length - LONG_TEXT_THRESHOLD) * LONG_TEXT_EXTRA_PER_CHARACTER_MS);
    return base + extra;
}

const SHERIFF_AUTHORITY_EVENTS = new Set([
    'sheriffSignup', 'sheriffCandidates', 'sheriffVote', 'sheriffRunoff',
    'sheriffElection', 'badgeTransfer',
]);
const DANGER_EVENTS = new Set(['nightDeaths', 'nightAnnouncement', 'elimination', 'exile', 'hunterShot', 'wolfSelfDestruct']);
const REVEAL_EVENTS = new Set(['hunterReveal', 'identityReveal']);
const APPEARANCE_CLASSES = [
    'is-backdrop-light', 'is-backdrop-dark',
    'is-tone-neutral', 'is-tone-stage', 'is-tone-safe', 'is-tone-authority',
    'is-tone-reveal', 'is-tone-danger', 'is-tone-wolf',
];

/** Keep the curtain monochrome; event meaning is carried by high-contrast type. */
export function werewolfPresentationAppearance(kind, announcement = {}) {
    const eventKind = announcement.kind || 'notice';
    const atomIndex = Number(announcement.atomIndex) || 0;
    if (eventKind === 'outcome' || kind === 'victory') {
        const faction = announcement.winnerFaction || announcement.faction;
        return faction === 'wolf'
            ? { backdrop: 'dark', tone: 'wolf' }
            : { backdrop: 'light', tone: 'authority' };
    }
    if (eventKind === 'nightFalls' || kind === 'night') return { backdrop: 'dark', tone: 'stage' };
    if (eventKind === 'peacefulNight' || announcement.peaceful === true) return { backdrop: 'light', tone: 'safe' };
    if (REVEAL_EVENTS.has(eventKind)) return { backdrop: 'dark', tone: 'reveal' };
    if (DANGER_EVENTS.has(eventKind)) {
        // A normal night result opens with a calm dawn card, then cuts to the
        // black/red death bulletin. Deferred results begin directly in danger.
        const opensAtDawn = ['nightDeaths', 'nightAnnouncement'].includes(eventKind)
            && atomIndex === 0
            && String(announcement.displayText ?? announcement.title ?? '').includes('天亮');
        return opensAtDawn
            ? { backdrop: 'light', tone: 'stage' }
            : { backdrop: 'dark', tone: eventKind === 'wolfSelfDestruct' ? 'wolf' : 'danger' };
    }
    if (announcement.presentation === 'sheriffDawn' && atomIndex === 0) return { backdrop: 'light', tone: 'stage' };
    if (SHERIFF_AUTHORITY_EVENTS.has(eventKind)) return { backdrop: 'light', tone: 'authority' };
    return { backdrop: 'light', tone: 'neutral' };
}

function applyTransitionAppearance(element, kind, announcement) {
    const appearance = werewolfPresentationAppearance(kind, announcement);
    element.classList.remove(...APPEARANCE_CLASSES);
    element.classList.add(`is-backdrop-${appearance.backdrop}`, `is-tone-${appearance.tone}`);
}

/** Night/day transitions and personal elimination scenes for 狼人杀. */
export function createWerewolfScene({ mount, model, getElement, renderer, send = null, windowRef = globalThis.window || globalThis }) {
    const $ = role => getElement(role);
    function transitionGlyphs(text) {
        return [...String(text || '')].map((character, index) => {
            const safeCharacter = character === ' ' ? '\u00a0' : character;
            const shards = Array.from({ length: 12 }, (_, shardIndex) => {
                const x = 100 + ((index * 43 + shardIndex * 61) % 180); const y = ((index * 29 + shardIndex * 47) % 160) - 112; const middleX = 30 + ((index * 17 + shardIndex * 29) % 62); const middleY = ((index * 13 + shardIndex * 23) % 54) - 38; const rotation = ((index * 37 + shardIndex * 53) % 300) - 150; const middleRotation = ((index * 19 + shardIndex * 31) % 90) - 45; const width = 1 + ((index + shardIndex * 2) % 6); const height = 2 + ((index * 2 + shardIndex * 3) % 7); const delay = (shardIndex % 6) * 24; const trail = 12 + ((index * 11 + shardIndex * 17) % 30); const opacity = (.58 + ((index + shardIndex * 3) % 38) / 100).toFixed(2);
                return `<i class="ww-transition-shard" aria-hidden="true" style="--sx:${x}px;--sy:${y}px;--mx:${middleX}px;--my:${middleY}px;--srot:${rotation}deg;--mrot:${middleRotation}deg;--sw:${width}px;--sh:${height}px;--sd:${delay}ms;--trail:${trail}px;--so:${opacity}"></i>`;
            }).join('');
            // Keep the complete glyph entrance inside a short atomic
            // bulletin.  The old 60ms/480ms cascade was designed for a
            // multi-second title/result scene and made a 1.5s atom look as if
            // it had already disappeared while the final characters entered.
            const glyphDelay = Math.min(index * 18, 120);
            return `<span class="ww-transition-glyph" style="--i:${index};--gd:${glyphDelay}ms"><b>${escapeHtml(safeCharacter)}</b>${shards}</span>`;
        }).join('');
    }
    function setTransitionText(element, text) {
        if (!element) return;
        const value = String(text || ''); element.innerHTML = transitionGlyphs(value); element.setAttribute('aria-label', value);
    }

    function cancelSpeech(complete = false) {
        const pending = model.speechComplete;
        model.speechComplete = null;
        if (model.speechTimer) windowRef.clearTimeout(model.speechTimer);
        model.speechTimer = null;
        model.speechSequence = (model.speechSequence || 0) + 1;
        windowRef.speechSynthesis?.cancel?.();
        if (complete) pending?.(true);
    }

    function cancelPersonalSpeech(complete = false) {
        const pending = model.personalSpeechComplete;
        model.personalSpeechComplete = null;
        if (model.personalSpeechTimer) windowRef.clearTimeout(model.personalSpeechTimer);
        model.personalSpeechTimer = null;
        model.personalSpeechSequence = (model.personalSpeechSequence || 0) + 1;
        if (complete) pending?.(true);
    }

    function speechFallbackMs(text) {
        const characterCount = [...String(text || '').trim()].length;
        return Math.min(SPEECH_FALLBACK_MAX_MS, Math.max(SPEECH_FALLBACK_MIN_MS, 420 + characterCount * 145));
    }

    function speakTransition(text, onComplete = null) {
        if (!model.voiceEnabled || !text || !windowRef.speechSynthesis || typeof windowRef.SpeechSynthesisUtterance !== 'function') {
            onComplete?.();
            return;
        }
        cancelSpeech();
        const sequence = model.speechSequence;
        let finished = false;
        let utterance;
        const finish = force => {
            if (finished || (!force && sequence !== model.speechSequence)) return;
            finished = true;
            if (model.speechTimer) windowRef.clearTimeout(model.speechTimer);
            model.speechTimer = null;
            if (model.speechComplete === finish) model.speechComplete = null;
            if (utterance) { utterance.onend = null; utterance.onerror = null; }
            onComplete?.();
        };
        model.speechComplete = finish;
        try {
            utterance = new windowRef.SpeechSynthesisUtterance(text);
            utterance.lang = 'zh-CN'; utterance.rate = .88; utterance.pitch = .92;
            utterance.onend = () => finish(false); utterance.onerror = () => finish(false);
            model.speechTimer = windowRef.setTimeout(() => finish(false), speechFallbackMs(text));
            windowRef.speechSynthesis.speak(utterance);
        } catch {
            finish(true);
        }
    }
    function speakPersonalElimination(text, onComplete = null) {
        if (!model.voiceEnabled || !text || !windowRef.speechSynthesis || typeof windowRef.SpeechSynthesisUtterance !== 'function') {
            onComplete?.();
            return;
        }
        cancelPersonalSpeech();
        const sequence = model.personalSpeechSequence;
        let finished = false;
        let utterance;
        const finish = force => {
            if (finished || (!force && sequence !== model.personalSpeechSequence)) return;
            finished = true;
            if (model.personalSpeechTimer) windowRef.clearTimeout(model.personalSpeechTimer);
            model.personalSpeechTimer = null;
            if (model.personalSpeechComplete === finish) model.personalSpeechComplete = null;
            if (utterance) { utterance.onend = null; utterance.onerror = null; }
            onComplete?.();
        };
        model.personalSpeechComplete = finish;
        try {
            utterance = new windowRef.SpeechSynthesisUtterance(text);
            utterance.lang = 'zh-CN'; utterance.rate = .88; utterance.pitch = .92;
            utterance.onend = () => finish(false); utterance.onerror = () => finish(false);
            model.personalSpeechTimer = windowRef.setTimeout(() => finish(false), speechFallbackMs(text));
            // Personal exits now occupy the same visual FIFO as public
            // bulletins. Keep a separate completion handle so stopping the
            // scene can still settle this utterance without leaking a timer.
            windowRef.speechSynthesis.speak(utterance);
        } catch {
            finish(true);
        }
    }
    function hideTransition() {
        if (model.transitionTimer) windowRef.clearTimeout(model.transitionTimer);
        if (model.serverStartTimer) windowRef.clearTimeout(model.serverStartTimer);
        if (model.serverFadeTimer) windowRef.clearTimeout(model.serverFadeTimer);
        model.transitionTimer = null; model.transitionSequence += 1;
        model.serverStartTimer = null; model.serverFadeTimer = null;
        const element = $('transition'); clearPresentationFade(element); element?.classList.remove('is-visible', 'is-atom-fading'); element?.classList.add('is-hidden'); element?.setAttribute('aria-hidden', 'true'); mount.querySelector('.ww-app')?.classList.remove('is-transitioning'); model.transitionGroupId = null;
    }
    function showTransition(kind, announcement = null, onComplete = null) {
        const element = $('transition'); const appRoot = mount.querySelector('.ww-app'); if (!element || !appRoot) { onComplete?.(); return; }
        if (model.transitionTimer) windowRef.clearTimeout(model.transitionTimer);
        const sequence = ++model.transitionSequence;
        const title = element.querySelector('[data-role="transitionTitle"]');
        const result = element.querySelector('[data-role="transitionResult"]');
        const isNight = kind === 'night'; const isDay = kind === 'day'; const isVictory = kind === 'victory';
        const isSheriffDawn = announcement?.presentation === 'sheriffDawn';
        const displayText = String(announcement?.displayText ?? announcement?.text ?? announcement?.title ?? (isNight ? '天黑请闭眼' : '')).trim();
        const detailAtom = announcement?.atomPart === 'detail' || announcement?.atomPart === 'result';
        const visibleDuration = isSheriffDawn ? SHERIFF_DAWN_TIMING.visibleMs : werewolfPresentationDuration(kind, displayText, announcement?.presentationDurationMs);
        const fadeInMs = isSheriffDawn ? SHERIFF_DAWN_TIMING.fadeInMs : WEREWOLF_PRESENTATION_TIMING.fadeInMs;
        const fadeOutMs = isSheriffDawn ? SHERIFF_DAWN_TIMING.fadeOutMs : WEREWOLF_PRESENTATION_TIMING.fadeOutMs;
        const styleKind = announcement?.kind || 'notice';
        const groupId = announcement?.atomGroupId || null;
        const continuesGroup = Boolean(groupId && model.transitionGroupId === groupId);
        clearPresentationFade(element);
        if (!continuesGroup) element.className = `ww-transition ${isNight ? 'is-night' : isDay ? 'is-day' : isVictory ? `is-victory is-${announcement?.faction || 'good'}` : `is-event is-${styleKind}`}${isDay && announcement?.peaceful ? ' is-peaceful' : ''}${isDay && !announcement?.peaceful ? ' is-danger' : ''}${isSheriffDawn ? ' is-sheriff-dawn' : ''}${detailAtom ? ' is-atom-detail' : ''}`;
        else element.classList.toggle('is-atom-detail', detailAtom);
        applyTransitionAppearance(element, kind, announcement || {});
        element.classList.remove('is-atom-fading');
        model.transitionGroupId = groupId;
        element.style?.setProperty?.('--ww-curtain-duration', `${visibleDuration}ms`);
        element.style?.setProperty?.('--ww-fade-in-duration', `${fadeInMs}ms`);
        element.style?.setProperty?.('--ww-fade-out-duration', `${fadeOutMs}ms`);
        element.setAttribute('aria-hidden', 'false');
        appRoot.classList.add('is-transitioning');
        // A transition contains exactly one atom.  The result node is kept in
        // the template for compatibility with the existing skin, but it is
        // deliberately empty: no title/result replacement happens in-place.
        setTransitionText(title, displayText);
        setTransitionText(result, '');
        // Force a fresh transition for every atom.  Without the reflow, a
        // class replacement made consecutive events appear instantly and
        // only the final fade-out was visible on fast sheriff chains.
        void element.offsetWidth;
        element.classList.add('is-visible');
        let visualReady = false; let speechReady = false; let finished = false;
        const finish = () => {
            if (finished || !visualReady || !speechReady || sequence !== model.transitionSequence) return;
            finished = true;
            const hasNextAtom = Boolean(groupId && Number(announcement?.atomIndex) < Number(announcement?.atomCount) - 1);
            if (hasNextAtom) element.classList.add('is-atom-fading');
            else beginPresentationFade(element);
            model.transitionTimer = windowRef.setTimeout(() => {
                if (sequence !== model.transitionSequence) return;
                if (!hasNextAtom) hideTransition();
                onComplete?.();
            }, fadeOutMs);
        };
        speakTransition(displayText, () => { speechReady = true; finish(); });
        model.transitionTimer = windowRef.setTimeout(() => { if (sequence !== model.transitionSequence) return; visualReady = true; finish(); }, visibleDuration);
    }
    function hidePersonalElimination() {
        if (model.eliminationTimer) windowRef.clearTimeout(model.eliminationTimer); if (model.eliminationShatterTimer) windowRef.clearTimeout(model.eliminationShatterTimer);
        model.eliminationTimer = null; model.eliminationShatterTimer = null; model.eliminationSequence += 1; const element = $('elimination'); clearPresentationFade(element); element?.classList.remove('is-visible'); element?.classList.add('is-hidden'); element?.classList.remove('is-entering', 'is-shattering'); element?.setAttribute('aria-hidden', 'true'); mount.querySelector('.ww-app')?.classList.remove('is-eliminating');
    }
    function showPersonalElimination(data = null, onComplete = null) {
        const element = $('elimination'); const appRoot = mount.querySelector('.ww-app'); if (!element || !appRoot) { onComplete?.(); return; }
        hidePersonalElimination(); const sequence = ++model.eliminationSequence; element.className = 'ww-elimination is-entering'; element.style?.setProperty?.('--ww-fade-in-duration', `${WEREWOLF_PRESENTATION_TIMING.fadeInMs}ms`); element.style?.setProperty?.('--ww-fade-out-duration', `${WEREWOLF_PRESENTATION_TIMING.fadeOutMs}ms`); const text = data?.text || '您已出局'; const plate = element.querySelector('.ww-elimination-plate strong'); if (plate) plate.textContent = text; element.setAttribute('aria-hidden', 'false'); appRoot.classList.add('is-eliminating'); void element.offsetWidth; element.classList.add('is-visible');
        let visualReady = false; let speechReady = false; let finished = false;
        const finish = () => {
            if (finished || !visualReady || !speechReady || sequence !== model.eliminationSequence) return;
            finished = true;
            beginPresentationFade(element);
            model.eliminationTimer = windowRef.setTimeout(() => {
                if (sequence !== model.eliminationSequence) return;
                hidePersonalElimination(); onComplete?.();
            }, WEREWOLF_PRESENTATION_TIMING.fadeOutMs);
        };
        speakPersonalElimination(text, () => { speechReady = true; finish(); });
        model.eliminationShatterTimer = windowRef.setTimeout(() => { if (sequence === model.eliminationSequence) element.classList.add('is-shattering'); }, 1500);
        model.eliminationTimer = windowRef.setTimeout(() => { if (sequence !== model.eliminationSequence) return; visualReady = true; finish(); }, WEREWOLF_SCENE_VISIBLE_MS.elimination);
    }

    // Server-timed scenes use the exact epoch interval assigned by the game
    // engine.  A viewer that receives a later snapshot waits for the shared
    // start time (or skips an already-finished atom); it never starts a new
    // local duration based on when that device happened to reconnect.
    function showServerTransition(kind, announcement = null, onComplete = null) {
        const startedAt = Number(announcement?.startedAt);
        const endsAt = Number(announcement?.endsAt);
        if (!Number.isFinite(endsAt)) return showTransition(kind, announcement, onComplete);
        const now = Date.now();
        if (endsAt <= now) { onComplete?.(); return; }
        const element = $('transition'); const appRoot = mount.querySelector('.ww-app');
        if (!element || !appRoot) { onComplete?.(); return; }
        if (model.serverStartTimer) windowRef.clearTimeout(model.serverStartTimer);
        if (model.serverFadeTimer) windowRef.clearTimeout(model.serverFadeTimer);
        if (model.transitionTimer) windowRef.clearTimeout(model.transitionTimer);
        const sequence = ++model.transitionSequence;
        const begin = () => {
            model.serverStartTimer = null;
            if (sequence !== model.transitionSequence) return;
            const currentNow = Date.now();
            if (Number(endsAt) <= currentNow) { onComplete?.(); return; }
            const title = element.querySelector('[data-role="transitionTitle"]');
            const result = element.querySelector('[data-role="transitionResult"]');
            const isNight = kind === 'night'; const isDay = kind === 'day'; const isVictory = kind === 'victory';
            const detailAtom = announcement?.atomPart === 'detail' || announcement?.atomPart === 'result';
            const styleKind = announcement?.kind || 'notice';
            const groupId = announcement?.atomGroupId || null;
            const continuesGroup = Boolean(groupId && model.transitionGroupId === groupId);
            clearPresentationFade(element);
            if (!continuesGroup) element.className = `ww-transition ${isNight ? 'is-night' : isDay ? 'is-day' : isVictory ? `is-victory is-${announcement?.winnerFaction || announcement?.faction || 'good'}` : `is-event is-${styleKind}`}${isDay && announcement?.peaceful ? ' is-peaceful' : ''}${isDay && !announcement?.peaceful ? ' is-danger' : ''}${announcement?.presentation === 'sheriffDawn' ? ' is-sheriff-dawn' : ''}${detailAtom ? ' is-atom-detail' : ''}`;
            else element.classList.toggle('is-atom-detail', detailAtom);
            applyTransitionAppearance(element, kind, announcement || {});
            model.transitionGroupId = groupId;
            const fadeInMs = Number(announcement?.fadeInMs) > 0 ? Number(announcement.fadeInMs) : WEREWOLF_PRESENTATION_TIMING.fadeInMs;
            const fadeOutMs = Number(announcement?.fadeOutMs) > 0 ? Number(announcement.fadeOutMs) : WEREWOLF_PRESENTATION_TIMING.fadeOutMs;
            element.style?.setProperty?.('--ww-curtain-duration', `${Math.max(0, Number(endsAt) - currentNow)}ms`);
            element.style?.setProperty?.('--ww-fade-in-duration', `${fadeInMs}ms`);
            element.style?.setProperty?.('--ww-fade-out-duration', `${fadeOutMs}ms`);
            element.setAttribute('aria-hidden', 'false'); appRoot.classList.add('is-transitioning');
            setTransitionText(title, announcement?.displayText ?? announcement?.publicDisplayText ?? announcement?.text ?? announcement?.title ?? '');
            setTransitionText(result, '');
            void element.offsetWidth; element.classList.add('is-visible');
            const fadeAt = Math.max(currentNow, Number(endsAt) - fadeOutMs);
            model.serverFadeTimer = windowRef.setTimeout(() => {
                model.serverFadeTimer = null;
                if (sequence !== model.transitionSequence) return;
                beginPresentationFade(element);
            }, Math.max(0, fadeAt - Date.now()));
            model.transitionTimer = windowRef.setTimeout(() => {
                if (sequence !== model.transitionSequence) return;
                model.transitionTimer = null; cancelSpeech(); hideTransition(); onComplete?.();
            }, Math.max(0, Number(endsAt) - Date.now()));
            speakTransition(String(announcement?.displayText ?? announcement?.publicDisplayText ?? announcement?.text ?? announcement?.title ?? '').trim());
        };
        if (Number.isFinite(startedAt) && startedAt > now) model.serverStartTimer = windowRef.setTimeout(begin, startedAt - now);
        else begin();
    }

    function showServerElimination(data = null, onComplete = null) {
        const startedAt = Number(data?.startedAt); const endsAt = Number(data?.endsAt);
        if (!Number.isFinite(endsAt)) return showPersonalElimination(data, onComplete);
        const now = Date.now();
        if (endsAt <= now) { onComplete?.(); return; }
        const element = $('elimination'); const appRoot = mount.querySelector('.ww-app');
        if (!element || !appRoot) { onComplete?.(); return; }
        if (model.eliminationTimer) windowRef.clearTimeout(model.eliminationTimer);
        if (model.eliminationShatterTimer) windowRef.clearTimeout(model.eliminationShatterTimer);
        const sequence = ++model.eliminationSequence;
        const begin = () => {
            model.eliminationTimer = null; model.eliminationShatterTimer = null;
            if (sequence !== model.eliminationSequence) return;
            if (Number(endsAt) <= Date.now()) { onComplete?.(); return; }
            const fadeInMs = Number(data?.fadeInMs) > 0 ? Number(data.fadeInMs) : WEREWOLF_PRESENTATION_TIMING.fadeInMs;
            const fadeOutMs = Number(data?.fadeOutMs) > 0 ? Number(data.fadeOutMs) : WEREWOLF_PRESENTATION_TIMING.fadeOutMs;
            const text = data?.displayText || data?.selfDisplayText || data?.selfText || '您已出局';
            hidePersonalElimination();
            // hidePersonalElimination increments the sequence; re-establish
            // this server scene's token after clearing the prior layer.
            const activeSequence = ++model.eliminationSequence;
            element.className = 'ww-elimination is-entering';
            element.style?.setProperty?.('--ww-fade-in-duration', `${fadeInMs}ms`); element.style?.setProperty?.('--ww-fade-out-duration', `${fadeOutMs}ms`);
            const plate = element.querySelector('.ww-elimination-plate strong'); if (plate) plate.textContent = text;
            element.setAttribute('aria-hidden', 'false'); appRoot.classList.add('is-eliminating'); void element.offsetWidth; element.classList.add('is-visible');
            const fadeAt = Math.max(Date.now(), Number(endsAt) - fadeOutMs);
            model.eliminationShatterTimer = windowRef.setTimeout(() => { model.eliminationShatterTimer = null; if (activeSequence === model.eliminationSequence) element.classList.add('is-shattering'); }, Math.max(0, Math.min(Number(endsAt), Number(startedAt || Date.now()) + 1500) - Date.now()));
            model.eliminationTimer = windowRef.setTimeout(() => {
                model.eliminationTimer = null;
                if (activeSequence !== model.eliminationSequence) return;
                beginPresentationFade(element);
                const remaining = Math.max(0, Number(endsAt) - Date.now());
                model.eliminationTimer = windowRef.setTimeout(() => { if (activeSequence !== model.eliminationSequence) return; hidePersonalElimination(); onComplete?.(); }, remaining);
            }, Math.max(0, fadeAt - Date.now()));
            speakPersonalElimination(text);
        };
        if (Number.isFinite(startedAt) && startedAt > now) model.eliminationTimer = windowRef.setTimeout(begin, startedAt - now);
        else begin();
    }

    function serverSceneKind(event = {}) {
        if (event.viewerVariant === 'personalElimination') return 'elimination';
        if (event.kind === 'outcome') return 'victory';
        if (event.kind === 'nightFalls') return 'night';
        if (event.presentation === 'sheriffDawn' || event.kind === 'nightDeaths' || event.kind === 'peacefulNight') return 'day';
        return 'event';
    }

    function showServerScene(scene, onComplete) {
        if (scene.kind === 'elimination') return showServerElimination(scene.data, onComplete);
        return showServerTransition(scene.kind, scene.data, onComplete);
    }
    function atomicMessageParts(event = {}) {
        if (event.displayText != null) return [String(event.displayText).trim()].filter(Boolean);
        const title = String(event.title || '').trim();
        const text = String(event.text ?? event.detail ?? '').trim();
        if (title && text && title !== text) return [title, text];
        return [text || title].filter(Boolean);
    }
    function eventPresentationScenes(event = {}, forcedKind = null, archive = null) {
        const eventKind = forcedKind || (event.kind === 'nightFalls' ? 'night' : event.kind === 'victory' ? 'victory' : 'event');
        const parts = atomicMessageParts(event);
        if (parts.length > 1 && event.id == null) model.transitionGroupSequence = (model.transitionGroupSequence || 0) + 1;
        const atomGroupId = parts.length > 1 ? `event:${event.id ?? model.transitionGroupSequence}` : null;
        const scenes = parts.map((displayText, index) => ({
            kind: eventKind,
            data: {
                ...event,
                displayText,
                atomPart: index === 0 && parts.length > 1 ? 'title' : parts.length > 1 ? 'detail' : 'single',
                atomGroupId,
                atomIndex: index,
                atomCount: parts.length,
            },
        }));
        if (archive && scenes.length) scenes.at(-1).archive = archive;
        return scenes;
    }
    function enqueueEventPresentation(event, forcedKind = null, archive = null) {
        eventPresentationScenes(event, forcedKind, archive).forEach(scene => enqueueScene(scene));
    }
    function enqueueScene(scene) {
        if (!scene?.kind) return;
        // Keep the public enqueue API safe for callers that still pass a raw
        // event.  Once an atom has `displayText`, it is already normalized and
        // must not be expanded a second time.
        if (scene.kind !== 'elimination' && scene.data && scene.data.displayText == null) {
            const parts = atomicMessageParts(scene.data);
            if (parts.length > 1) {
                eventPresentationScenes(scene.data, scene.kind, scene.archive).forEach(atom => enqueueScene(atom));
                return;
            }
        }
        model.sceneQueue ||= [];
        model.sceneQueue.push(scene);
        playNextScene();
    }
    function playNextScene() {
        if (model.scenePlaying || !model.sceneQueue?.length) return;
        const scene = model.sceneQueue.shift();
        model.scenePlaying = true; model.activeScene = scene;
        let settled = false;
        const complete = () => {
            if (settled || model.activeScene !== scene) return;
            settled = true;
            if (scene.archive === 'vote') renderer?.pulseBulletin?.();
            const finalAtom = scene.data?.atomCount == null || Number(scene.data.atomIndex) === Number(scene.data.atomCount) - 1;
            // Server-timed events are already advanced by their absolute
            // endsAt barrier.  Only legacy local scenes send an ACK; sending
            // one for a shared event would let a fast client alter the room.
            if (!scene.serverTimed && scene.data?.gateId && finalAtom) send?.({ type: 'gameAction', action: { kind: 'presentationComplete', gateId: scene.data.gateId } });
            model.activeScene = null; model.scenePlaying = false;
            renderer?.render?.();
            playNextScene();
        };
        try {
            if (scene.kind === 'delay') model.sceneDelayTimer = windowRef.setTimeout(() => { model.sceneDelayTimer = null; complete(); }, scene.duration || 1800);
            else if (scene.serverTimed) showServerScene(scene, complete);
            else if (scene.kind === 'elimination') showPersonalElimination(scene.data, complete);
            else showTransition(scene.kind, scene.data, complete);
        } catch (error) {
            console.error('狼人杀播报播放失败', error);
            complete();
        }
    }
    function enqueuePersonalElimination(data = null, seatNumber = null) {
        const number = seatNumber == null ? null : Number(seatNumber);
        if (number == null || model.eliminatedSeat === number) return false;
        // Personal departure is a perspective-specific slot in the same FIFO
        // as every public bulletin.  Starting it immediately used to cover
        // the causal self-destruct/death announcement with a second layer.
        model.eliminatedSeat = number;
        enqueueScene({ kind: 'elimination', data: { ...data, seat: number } });
        return true;
    }

    function enqueuePresentation(batch) {
        if (!batch?.events?.length) return;
        const end = Number(batch.endsAt);
        if (Number.isFinite(end) && end <= Date.now()) return;
        if (Number.isFinite(end)) model.presentationLockedUntil = Math.max(Number(model.presentationLockedUntil) || 0, end);
        for (const event of batch.events) {
            if (!event) continue;
            const eventEnd = Number(event.endsAt);
            if (Number.isFinite(eventEnd) && eventEnd <= Date.now()) continue;
            model.sceneQueue.push({ kind: serverSceneKind(event), data: event, serverTimed: true, batchSequence: batch.sequence });
        }
        renderer?.render?.();
        playNextScene();
    }
    function maybePlayTransition(previous, next) {
        if (!next) return;
        const eliminationKey = eliminationNoticeKey(next.eliminationNotice);
        const activeSeatNumber = next.activeSeat == null ? null : Number(next.activeSeat);
        const activeSeatState = (next.seats || []).find(seat => Number(seat.number) === activeSeatNumber);
        if (!previous) {
            // A reconnect may arrive after this seat has already completed its
            // private exit.  Remember that seat so subsequent public death
            // bulletins do not replay other players' exit slots.  Test-mode
            // seat switching remains supported because the value is tied to
            // the currently viewed seat, not the browser itself.
            if (activeSeatNumber != null && activeSeatState && !activeSeatState.alive && next.phase !== 'roleReveal') model.eliminatedSeat = activeSeatNumber;
            model.lastAnnouncementDayKey = transitionAnnouncementKey(next.announcement); model.lastEliminationKey = eliminationKey; model.lastPublicEventId = next.publicEvents?.at(-1)?.id ?? next.publicEvent?.id ?? null; model.lastWinnerKey = next.winner ? `${next.winner.faction}:${next.winner.reason}` : ''; return;
        }
        const announcementKey = transitionAnnouncementKey(next.announcement); const newPersonalElimination = Boolean(eliminationKey && eliminationKey !== model.lastEliminationKey); if (newPersonalElimination) model.lastEliminationKey = eliminationKey;
        const freshEvents = (next.publicEvents?.length ? next.publicEvents : next.publicEvent ? [next.publicEvent] : []).filter(event => model.lastPublicEventId == null || event.id > model.lastPublicEventId);
        const ownEliminationEvent = freshEvents.find(event => event.kind === 'elimination' && (event.eliminatedSeats || []).some(seat => Number(seat) === activeSeatNumber));
        const ownEliminationNotice = Number(next.eliminationNotice?.seat) === activeSeatNumber;
        const ownsCurrentElimination = Boolean(activeSeatNumber != null && (ownEliminationEvent || ownEliminationNotice));
        const wasAlreadyEliminated = model.eliminatedSeat === activeSeatNumber;
        const enqueueEliminationSlot = event => {
            const seats = (event?.eliminatedSeats || []).map(Number).filter(Number.isFinite);
            if (activeSeatNumber != null && seats.includes(activeSeatNumber) && !wasAlreadyEliminated) {
                enqueuePersonalElimination({ text: '您已出局' }, activeSeatNumber);
                return;
            }
            // Other perspectives consume an equal-length public slot.  Use a
            // single message rather than another title/detail pair so every
            // device reaches the following badge/words bulletin together.
            const text = event?.text || (seats.length ? `${seats.join('、')} 号已出局` : '玩家已出局');
            enqueueEventPresentation({ ...event, displayText: text, presentationDurationMs: WEREWOLF_SCENE_VISIBLE_MS.elimination }, 'event');
        };
        for (const event of freshEvents) {
            model.lastPublicEventId = event.id;
            if (event.presentation === 'silent' || (event.presentation === 'othersOnly' && (event.eliminatedSeats || []).map(Number).includes(activeSeatNumber))) continue;
            if (event.presentation === 'perspective') {
                const selfView = Number(event.selfSeat) === activeSeatNumber;
                enqueueEventPresentation({ ...event, displayText: selfView ? event.selfText : event.title }, 'event');
                continue;
            }
            if (event.kind === 'nightFalls') { enqueueEventPresentation({ ...event, gateId: event.gateId || next.presentationGate?.id || null }, 'night'); }
            else if (event.presentation === 'sheriffDawn') { enqueueEventPresentation(event, 'day'); }
            else if (['nightDeaths', 'peacefulNight'].includes(event.kind)) {
                // A night result is an immutable historical event.  Do not
                // fall back to the mutable top-level announcement: a hunter
                // shot (or another chained elimination) may have been added
                // to that later snapshot and would make the dawn board claim
                // that the extra player died during the night.
                const eventAnnouncement = {
                    ...(event.announcement || {}),
                    day: event.day,
                    kind: 'night',
                    deaths: event.eliminatedSeats || event.announcement?.deaths || [],
                    peaceful: event.kind === 'peacefulNight',
                    // The immutable public event owns the words shown at the
                    // table.  Its nested announcement is the historical
                    // state snapshot and does not carry the public title.
                    title: event.title || (event.kind === 'peacefulNight' ? '平安夜' : '天亮了'),
                    text: event.text || event.announcement?.text || '',
                };
                model.lastAnnouncementDayKey = transitionAnnouncementKey(eventAnnouncement); enqueueEventPresentation(event.dawnAnnounced ? event : eventAnnouncement, event.dawnAnnounced ? 'event' : 'day');
            }
            else if (event.kind === 'elimination') {
                enqueueEliminationSlot(event);
            }
            else if (['exile', 'voteTie'].includes(event.kind)) { const voteResult = next.lastVoteResult; enqueueEventPresentation({ ...event, text: `${event.text}。${formatVoteBallots(voteResult)}` }, 'event', 'vote'); }
            else { enqueueEventPresentation(event, 'event', event.kind === 'identityReveal' ? 'vote' : null); }
        }
        if (!freshEvents.length && announcementKey && announcementKey !== model.lastAnnouncementDayKey) {
            model.lastAnnouncementDayKey = announcementKey;
            const announcement = next.announcement || {};
            const deaths = Array.isArray(announcement.deaths) ? announcement.deaths : [];
            enqueueEventPresentation({
                ...announcement,
                kind: 'nightAnnouncement',
                title: deaths.length ? '天亮了' : '平安夜',
                text: deaths.length ? `昨夜的死者是 ${deaths.join('、')} 号` : '昨夜无人出局',
            }, 'day');
        }
        if (newPersonalElimination && !ownsCurrentElimination && !wasAlreadyEliminated) enqueuePersonalElimination({ text: '您已出局' }, activeSeatNumber);
        const winnerKey = next.winner ? `${next.winner.faction}:${next.winner.reason}` : '';
        if (winnerKey && winnerKey !== model.lastWinnerKey) { model.lastWinnerKey = winnerKey; const finalPersonalElimination = next.winner.eliminatedSeats?.includes(next.activeSeat) && !newPersonalElimination && !freshEvents.some(event => event.kind === 'elimination'); if (finalPersonalElimination && !wasAlreadyEliminated) enqueuePersonalElimination({ text: '您已出局' }, activeSeatNumber); enqueueEventPresentation({ ...next.winner, kind: 'outcome', title: next.winner.name }, 'victory'); }
    }
    function stop() {
        model.sceneQueue = []; model.activeScene = null; model.scenePlaying = false; if (model.sceneDelayTimer) windowRef.clearTimeout(model.sceneDelayTimer); model.sceneDelayTimer = null; if (model.serverStartTimer) windowRef.clearTimeout(model.serverStartTimer); if (model.serverFadeTimer) windowRef.clearTimeout(model.serverFadeTimer); model.serverStartTimer = null; model.serverFadeTimer = null; model.presentationLockedUntil = 0; cancelSpeech(); cancelPersonalSpeech(); hideTransition(); hidePersonalElimination(); model.sceneWaiters?.clear?.(); renderer?.render?.();
    }
    return { maybePlayTransition, stop, hideTransition, hidePersonalElimination, enqueueScene, enqueuePresentation, cancelSpeech: () => { cancelSpeech(true); cancelPersonalSpeech(true); }, isPlaying: () => model.scenePlaying || Date.now() < Number(model.presentationLockedUntil || 0) };
}
