import { escapeHtml } from './constants.js';

/** Signal transitions between decryption rounds. */
export function createDecryptoScene({ getElement, model, windowRef = globalThis.window || globalThis }) {
    const $ = role => getElement(role);
    const reducedMotion = windowRef.matchMedia?.('(prefers-reduced-motion: reduce)');
    function hideScene() {
        if (model.sceneTimer) windowRef.clearTimeout(model.sceneTimer);
        model.sceneTimer = null;
        const transition = $('sceneTransition');
        transition.className = 'dc-scene-transition is-hidden';
        transition.setAttribute('aria-hidden', 'true');
    }
    function playScenes(scenes) {
        const sequence = ++model.sceneSequence;
        hideScene();
        const queue = scenes.filter(Boolean);
        const playNext = () => {
            if (sequence !== model.sceneSequence || !queue.length) { hideScene(); return; }
            const scene = queue.shift();
            $('sceneKicker').textContent = scene.kicker || '';
            $('sceneTitle').textContent = scene.title || '';
            $('sceneDetail').textContent = scene.detail || '';
            const transition = $('sceneTransition'); transition.className = `dc-scene-transition is-${scene.kind || 'signal'}`; transition.setAttribute('aria-hidden', 'false');
            model.sceneTimer = windowRef.setTimeout(playNext, reducedMotion?.matches ? 700 : (scene.duration || 1900));
        };
        playNext();
    }
    function transitionScenes(previous, next) {
        if (!previous || !next) return [];
        const scenes = [];
        if (previous.phase === 'keycheck' && next.phase === 'encryptor_vote') scenes.push({ kind: 'keys', kicker: '全员核对完成', title: '固定加密员选举', detail: '请在本队内投出你的选择' });
        if ((previous.phase === 'keycheck' || previous.phase === 'encryptor_vote') && next.phase === 'clue') scenes.push({ kind: 'keys', kicker: previous.phase === 'encryptor_vote' ? '选举完成' : '全员核对完成', title: '密钥已经封存', detail: '第一轮加密频道正在建立' });
        if (previous.phase === 'clue' && next.phase === 'guessing') scenes.push({ kind: 'signal', kicker: '捕获到新电报', title: `${next.currentTeamName || '当前队伍'}频道已接入`, detail: '线索已经公开，请在同桌或公共语音中开始推演' });
        const previousHistory = previous.history?.length || 0; const nextHistory = next.history?.length || 0;
        if (nextHistory > previousHistory) { const record = next.history[nextHistory - 1]; const result = [`本队${record.ownGuess?.correct ? '解码成功' : '沟通失误'}`]; if (record.intercept) result.push(`对方${record.intercept.correct ? '截获成功' : '未能截获'}`); else result.push('首轮不进行截获'); const nextChannel = next.status === 'ended' || next.phase === 'tiebreak' ? '' : next.phase === 'guessing' ? ` · ${next.currentTeamName}频道即将接入` : ` · 第 ${next.round} 轮即将开始`; scenes.push({ kind: record.intercept?.correct ? 'breach' : record.ownGuess?.correct ? 'decoded' : 'mistake', kicker: `${record.teamName}电报已解密`, title: record.code.join('  ·  '), detail: `${result.join(' · ')}${nextChannel}` }); }
        if (previous.phase !== 'tiebreak' && next.phase === 'tiebreak') scenes.push({ kind: 'tiebreak', kicker: '常规标记无法判定胜负', title: '双方通信已经暴露', detail: '启动最终反向破译' });
        if (previous.status !== 'ended' && next.status === 'ended') scenes.push({ kind: next.winner?.teamId === null ? 'draw' : Number(next.winner?.teamId) === 0 ? 'red-win' : 'blue-win', kicker: '通信终局', title: next.winner?.teamId === null ? '双方共享胜利' : `${next.winner?.teamName || '获胜队伍'}控制了频道`, detail: next.lastResult?.message || '所有密钥和通信档案已经解封' });
        return scenes;
    }
    function stop() { model.sceneSequence += 1; hideScene(); }
    return { playScenes, transitionScenes, stop };
}
