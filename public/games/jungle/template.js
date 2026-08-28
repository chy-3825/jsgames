export function createJungleTemplate() {
    return `<section class="jungle-game">
        <header class="jungle-header">
            <div class="jungle-brand"><span class="jungle-brand-mark">兽</span><div><small>TRADITIONAL BOARD</small><h1>斗兽棋</h1></div></div>
            <div class="jungle-turn" data-role="turn">等待棋局状态</div>
            <div class="jungle-actions"><button type="button" data-ui="rules">规则</button></div>
        </header>
        <main class="jungle-layout">
            <aside class="jungle-panel jungle-players"><div class="jungle-panel-title"><span>双方棋手</span><small data-role="status">等待中</small></div><div data-role="players"></div><div class="jungle-rank-key"><strong>兽子等级</strong><span>象 8 · 狮 7 · 虎 6 · 豹 5</span><span>狼 4 · 狗 3 · 猫 2 · 鼠 1</span></div></aside>
            <section class="jungle-stage"><div class="jungle-board-wrap"><div class="jungle-board" data-role="board" aria-label="斗兽棋七乘九棋盘"></div></div><div class="jungle-hint" data-role="hint">点击自己的兽子，再点击高亮位置</div></section>
            <aside class="jungle-panel jungle-info"><div class="jungle-info-card"><span class="jungle-info-seal">兽</span><small>WATER · TRAP · DEN</small><h2>山林棋局</h2><p>八种猛兽在河流与陷阱之间争夺对方兽穴。</p><button type="button" data-ui="rules">查看完整规则</button></div><div class="jungle-log-title">行棋记录</div><div class="jungle-log" data-role="log"></div></aside>
        </main>
        <footer class="jungle-footer"><span>标准 7×9 棋盘 · 红方先行</span><strong data-role="result"></strong></footer>
        <div class="jungle-overlay is-hidden" data-role="rulesOverlay" aria-hidden="true"><article class="jungle-rules"><button class="jungle-close" type="button" data-ui="closeRules">×</button><small>HOW TO PLAY</small><h2>斗兽棋规则</h2><ol><li>棋盘为 7×9 交叉格，红方先行；占领对方兽穴或令对方无合法着法即可获胜。</li><li>象、狮、虎、豹、狼、狗、猫、鼠按 8 至 1 排名；鼠可以吃象，其他兽子不能反吃高等级兽子。</li><li>只有鼠可以进入河流；狮和虎可以横竖跳过整段河流，河中的鼠会挡住跳跃。</li><li>进入对手陷阱的兽子等级视为 0；自己的兽子不能进入己方兽穴。</li></ol></article></div>
    </section>`;
}
