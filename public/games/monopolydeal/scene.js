import { COLOR_HEX, COLOR_LABELS } from './constants.js';
import { escapeHtml } from './cards.js';
import { playerGroupsFromState, victorySource } from './state.js';

/** Victory and high-impact transfer scenes for 大富翁纸牌. */
export function createMonopolyDealScene({ mount, model, getElement, windowRef = globalThis.window || globalThis }) {
    const $ = getElement || (role => mount.querySelector(`[data-role="${role}"]`));
    const state = () => model.state;
    function playerName(id, fallback = '') { return (state()?.players || []).find(player => player.id === id)?.name || fallback || '玩家'; }
    function enqueueScene(scene) { model.sceneQueue.push(scene); playNextScene(); }
    function playNextScene() {
        if (model.scenePlaying || !model.sceneQueue.length) return;
        model.activeScene = model.sceneQueue.shift(); model.scenePlaying = true;
        const layer = $('victoryLayer'); const root = mount.querySelector('.deal-game');
        layer.hidden = false; layer.className = `deal-victory-layer is-active is-${model.activeScene.kind}`; layer.setAttribute('aria-hidden', 'false'); root?.classList.add('is-scene-active');
        if (model.activeScene.kind === 'takeover') renderTakeoverScene(model.activeScene); else renderVictoryScene(model.activeScene.state);
        const raf = windowRef.requestAnimationFrame || (callback => windowRef.setTimeout(callback, 0)); raf(() => layer.classList.add('is-revealed'));
        windowRef.clearTimeout(model.victoryTimer); const duration = model.activeScene.kind === 'takeover' ? 1100 : 2800; const reduced = windowRef.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false; model.victoryTimer = windowRef.setTimeout(hideVictoryScene, reduced ? Math.min(duration, 160) : duration);
    }
    function showTakeoverScene(next) { const interaction = next.interaction; const transfer = interaction?.transfer; enqueueScene({ kind: 'takeover', actorName: playerName(interaction?.actorId, interaction?.actorName), targetName: playerName(transfer?.fromId, interaction?.currentTargetName || interaction?.targetNames?.[0]), color: transfer?.color, cardCount: transfer?.cardIds?.length || 0 }); }
    function renderTakeoverScene(scene) { const color = COLOR_LABELS[scene.color] || scene.color || '完整'; $('victoryScene').innerHTML = `<span class="deal-victory-kicker">重大交易</span><div class="deal-takeover-mark" aria-hidden="true">组</div><h2>${escapeHtml(scene.actorName)}接管${escapeHtml(scene.targetName)}的${escapeHtml(color)}地产组</h2><div class="deal-takeover-route"><span>${escapeHtml(scene.targetName)}</span><i>→</i><strong>${escapeHtml(scene.actorName)}</strong></div><p>物业接管生效，${scene.cardCount} 张地产及附属建筑整组转移。</p>`; }
    function showVictoryScene(next) { enqueueScene({ kind: 'victory', state: next }); }
    function renderVictoryScene(next) { const winner = (next.players || []).find(player => player.id === next.winner?.id); const groups = playerGroupsFromState(next, winner).filter(group => group.isComplete).slice(0, 3); const groupMarkup = groups.map(group => `<article style="--victory-color:${COLOR_HEX[group.color] || '#927a58'}"><i></i><strong>${escapeHtml(COLOR_LABELS[group.color] || group.color)}</strong><span>${group.cards.length} 张地产</span></article>`).join(''); $('victoryScene').innerHTML = `<span class="deal-victory-kicker">地产帝国落成</span><div class="deal-victory-seal">交</div><h2>${escapeHtml(next.winner?.name || '玩家')}完成三组地产</h2><div class="deal-victory-source"><span>致胜行动</span><strong>${escapeHtml(victorySource(next))}</strong></div><div class="deal-victory-groups">${groupMarkup}</div><p>${escapeHtml(next.lastAction?.message || '三个不同颜色的完整地产组已经建成。')}</p>`; }
    function hideVictoryScene() { windowRef.clearTimeout(model.victoryTimer); model.victoryTimer = 0; const layer = $('victoryLayer'); layer?.classList.remove('is-active', 'is-revealed'); layer?.setAttribute('aria-hidden', 'true'); if (layer) layer.hidden = true; mount.querySelector('.deal-game')?.classList.remove('is-scene-active'); model.scenePlaying = false; model.activeScene = null; playNextScene(); }
    function stopScenes() { model.sceneQueue = []; model.activeScene = null; hideVictoryScene(); }
    return { enqueueScene, showTakeoverScene, showVictoryScene, hideVictoryScene, stopScenes, isPlaying: () => model.scenePlaying, destroy: stopScenes };
}
