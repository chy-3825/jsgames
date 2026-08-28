import { CODE_LENGTH, escapeHtml } from './constants.js';

/** End-of-case answer reveal scene for 猜数字. */
export function createGuessNumberScene({ mount, model, getElement, rulesModal, windowRef = globalThis.window || globalThis }) {
    const $ = role => getElement(role); const root = mount.querySelector('.gn-app');
    function showScene(html) { const layer = $('sceneLayer'); layer.hidden = false; layer.className = 'gn-scene-layer is-active'; layer.setAttribute('aria-hidden', 'false'); $('scene').innerHTML = html; }
    function hideScene() { const layer = $('sceneLayer'); layer.className = 'gn-scene-layer'; layer.setAttribute('aria-hidden', 'true'); $('scene').innerHTML = ''; layer.hidden = true; }
    function sceneDelay(duration, token) { const wait = model.reducedMotion ? Math.min(duration, 80) : duration; return new Promise(resolve => { const waiter = { timer: 0, resolve(value) { model.sceneWaiters.delete(waiter); resolve(value); } }; waiter.timer = windowRef.setTimeout(() => waiter.resolve(token === model.sceneToken), wait); model.sceneWaiters.add(waiter); }); }
    async function playEndScene(finalState) {
        if (model.scenePlaying) return;
        model.scenePlaying = true; const token = ++model.sceneToken; root.classList.add('is-scene-active'); rulesModal.setOpen(false); const winner = finalState.winner; const player = finalState.players?.find(candidate => candidate.id === winner?.id); const attempts = Number(player?.attempts || finalState.lastResult?.attempt || 0);
        if (!winner) { showScene('<span class="gn-scene-kicker">INVESTIGATION CLOSED</span><div class="gn-scene-seal" aria-hidden="true">止</div><h2>调查中止</h2><p>当前破解者已离线，本局档案已封存。</p>'); windowRef.requestAnimationFrame?.(() => $('sceneLayer').classList.add('is-complete')); await sceneDelay(1200, token); }
        else { const digits = String(finalState.secret || '').padEnd(CODE_LENGTH, '?').slice(0, CODE_LENGTH).split(''); showScene(`<span class="gn-scene-kicker">FINAL VERDICT</span><div class="gn-scene-score"><b>4</b>A <i>0</i>B</div><h2>密码破解</h2><p>最终猜测与隐藏答案完全一致。</p><div class="gn-scene-code">${digits.map((digit, index) => `<span style="--gn-digit-order:${index}">${escapeHtml(digit)}</span>`).join('')}</div><div class="gn-scene-outcome"><span>破解完成</span><strong>${escapeHtml(winner.name)}成功破解密码</strong><small>本案共尝试 ${attempts} 次</small></div>`); windowRef.requestAnimationFrame?.(() => $('sceneLayer').classList.add('is-result')); if (!await sceneDelay(500, token)) return; $('sceneLayer').classList.add('is-code-revealed'); if (!await sceneDelay(900, token)) return; $('sceneLayer').classList.add('is-complete'); if (!await sceneDelay(1100, token)) return; }
        if (token === model.sceneToken) hideScene(); model.scenePlaying = false; root.classList.remove('is-scene-active');
    }
    function skipScene() { if (!model.scenePlaying) return; model.sceneToken++; for (const waiter of model.sceneWaiters) { windowRef.clearTimeout(waiter.timer); waiter.resolve(false); } model.sceneWaiters.clear(); hideScene(); model.scenePlaying = false; root.classList.remove('is-scene-active'); }
    function stop() { model.sceneToken++; for (const waiter of model.sceneWaiters) { windowRef.clearTimeout(waiter.timer); waiter.resolve(false); } model.sceneWaiters.clear(); hideScene(); model.scenePlaying = false; root.classList.remove('is-scene-active'); }
    return { playEndScene, skipScene, stop, isPlaying: () => model.scenePlaying };
}
