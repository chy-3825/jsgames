export function createDecryptoTemplate() {
    return `
        <section class="decrypto-app">
            <header class="dc-header">
                <div class="dc-brand"><span class="dc-mark" aria-hidden="true"><i></i><b>密</b></span><div><small>双队加密通信站</small><h1>谍报风云</h1><p>让队友听懂，同时让对手误判</p></div></div>
                <div class="dc-round" data-role="round">等待频道接通</div>
                <div class="dc-actions"><button type="button" data-ui="tutorial">一分钟学会</button><button type="button" data-ui="notebook">线索笔记 <i data-role="notebookBadge">0</i></button><button type="button" data-ui="rules">规则</button></div>
            </header>
            <main class="dc-layout">
                <section class="dc-workbench">
                    <div class="dc-status" data-role="status"></div>
                    <aside class="dc-talk-guide"><span aria-hidden="true">声</span><div><strong>请使用同桌讨论或公共语音</strong><small>加密员给出的线索必须让双方都能听见；网页负责保管秘密、封存答案和判定。</small></div></aside>
                    <div class="dc-phase-track" data-role="phaseTrack"></div>
                    <div class="dc-signal-grid">
                        <section class="dc-key-vault">
                            <header><div><span class="dc-kicker">本队机密</span><h2>四张关键词</h2></div><div class="dc-vault-tools"><span class="dc-private-seal">仅本队可见</span><button type="button" class="dc-privacy-toggle" data-ui="privacy" aria-pressed="true"><strong data-role="privacyLabel">自动保护</strong><small data-role="privacyDetail">切页即盖住</small></button></div></header>
                            <div class="dc-keywords" data-role="keywords"></div>
                        </section>
                        <section class="dc-transmission" data-role="briefing"></section>
                    </div>
                    <section class="dc-command" data-role="command"></section>
                    <section class="dc-notebook"><header class="dc-section-heading"><div><span class="dc-kicker">破译核心</span><h2>数字—线索推理笔记</h2></div><div class="dc-notebook-controls"><button type="button" class="is-active" data-notebook-view="matrix">按 1–4 归类</button><button type="button" data-notebook-view="rounds">按轮次复盘</button><span data-role="historyCount">0 封</span></div></header><div class="dc-notebook-body" data-role="notebook"></div></section>
                </section>
                <aside class="dc-side">
                    <section class="dc-panel dc-identity" data-role="identity"></section>
                    <section class="dc-panel dc-teams-panel"><header class="dc-panel-heading"><div><span class="dc-kicker">频道状态</span><h2>双方情报组</h2></div><span>2 枚决胜</span></header><div class="dc-teams" data-role="teams"></div></section>
                    <section class="dc-panel dc-log-panel"><header class="dc-panel-heading"><div><span class="dc-kicker">公共播报</span><h2>行动记录</h2></div><span data-role="logCount">0</span></header><div class="dc-log" data-role="log"></div></section>
                </aside>
            </main>
            <div class="dc-scene-transition is-hidden" data-role="sceneTransition" role="status" aria-live="assertive" aria-atomic="true" aria-hidden="true"><div><small data-role="sceneKicker"></small><strong data-role="sceneTitle"></strong><span data-role="sceneDetail"></span></div></div>
            <div class="dc-overlay is-hidden" data-role="tutorialOverlay" aria-hidden="true"><article class="dc-tutorial-dialog" role="dialog" aria-modal="true" aria-labelledby="dc-tutorial-title" tabindex="-1"><button type="button" data-ui="closeTutorial" aria-label="关闭新手示例">×</button><span class="dc-kicker">60 秒示例</span><h2 id="dc-tutorial-title">一轮到底在做什么？</h2><p class="dc-tutorial-lead">你不是直接猜对方的词，而是逐轮破解“数字对应什么概念”。</p><div class="dc-tutorial-flow"><section><span>1</span><div><small>红队秘密关键词</small><div class="dc-demo-keys"><b>1 月亮</b><b>2 咖啡</b><b>3 火车</b><b>4 钥匙</b></div></div></section><section><span>2</span><div><small>只有加密员看到</small><strong class="dc-demo-code">4 · 1 · 3</strong></div></section><section><span>3</span><div><small>加密员给出三条公开线索</small><div class="dc-demo-clues"><b>开门</b><b>潮汐</b><b>站台</b></div></div></section><section><span>4</span><div><small>本队根据关键词解码，对手根据历史线索截获</small><p>揭晓后对手会记下：4 号与“开门”有关，1 号与“潮汐”有关，3 号与“站台”有关。</p></div></section></div><div class="dc-tutorial-goal"><b>得到 2 次成功截获即获胜</b><span>本队累计 2 次解码失误则失败；第一轮不进行截获。</span></div><button type="button" class="dc-primary dc-tutorial-done" data-ui="closeTutorial">我明白了，开始通信</button></article></div>
            <div class="dc-overlay dc-notebook-overlay is-hidden" data-role="notebookOverlay" aria-hidden="true"><article role="dialog" aria-modal="true" aria-labelledby="dc-notebook-title" tabindex="-1"><button type="button" data-ui="closeNotebook" aria-label="关闭线索笔记">×</button><span class="dc-kicker">双方公开情报</span><h2 id="dc-notebook-title">数字—线索推理笔记</h2><p class="dc-notebook-help">每次密码揭晓后，线索会自动归到正确数字下。截获时主要看对方的四列线索。</p><div class="dc-notebook-controls dc-overlay-tabs"><button type="button" class="is-active" data-notebook-view="matrix">按 1–4 归类</button><button type="button" data-notebook-view="rounds">按轮次复盘</button></div><div class="dc-notebook-body" data-role="notebookOverlayBody"></div></article></div>
            <div class="dc-overlay is-hidden" data-role="rulesOverlay" aria-hidden="true"><article role="dialog" aria-modal="true" aria-labelledby="dc-rules-title" tabindex="-1"><button type="button" data-ui="closeRules" aria-label="关闭规则">×</button><span class="dc-kicker">玩法说明</span><h2 id="dc-rules-title">谍报风云规则</h2><ol><li>每个人先打开本队密钥库，核对四个关键词；全员确认后第一轮才会开始。</li><li>加密员按住查看三位私密密码，并按顺序写出三条线索；双方都提交后才会公开电报。</li><li>使用同桌讨论或所有人都在的公共语音；加密员给出的信息必须让对手也能获得，且公布后不能追加解释。</li><li>第一轮不截获；第二轮起，对方截获方案和本队解码答案都会先封存，收齐后才统一揭晓。</li><li>本队猜错获得一次沟通失误，对手猜中获得一次截获；任一项达到两枚即可决定胜负。</li><li>双方同轮同时满足终局条件或完成八轮后，进入最终反向破译；三人变体最多进行五轮。</li></ol><figure class="dc-art-reference"><img src="/assets/bgg/decrypto/detail.png" alt="谍报风云密码机和组件参考图" loading="lazy"><figcaption>实体组件参考 · 页面保管秘密与规则，讨论可在同桌或公共语音中完成</figcaption></figure></article></div>
        </section>`;
}
