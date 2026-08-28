export function createGobangTemplate() {
    return `<section class="gobang-game">
        <header class="gobang-header">
            <div class="gobang-brand"><span class="gobang-mark">五</span><div><small>CLASSIC BOARD GAME</small><h1>五子棋</h1></div></div>
            <div class="gobang-turn" data-role="turn">等待棋局状态</div>
            <div class="gobang-actions"><button type="button" data-ui="rules">规则</button></div>
        </header>
        <main class="gobang-layout">
            <aside class="gobang-panel gobang-players"><div class="gobang-panel-title"><span>对局双方</span><small data-role="status">等待中</small></div><div data-role="players"></div><div class="gobang-key"><strong>本局设置</strong><span>15 × 15 棋盘</span><span>连成五子即胜</span><span>不设禁手，长连也算胜利</span></div></aside>
            <section class="gobang-stage"><div class="gobang-board-wrap"><div class="gobang-board" data-role="board" role="grid" aria-label="五子棋十五乘十五棋盘"></div></div><div class="gobang-hint" data-role="hint">等待棋局开始</div></section>
            <aside class="gobang-panel gobang-info"><div class="gobang-info-card"><span class="gobang-seal">棋</span><small>FIVE IN A ROW</small><h2>黑白之间</h2><p>轮流落子，在横、竖或斜线上连成五子。</p><button type="button" data-ui="rules">查看规则</button></div><div class="gobang-log-title">行棋记录</div><div class="gobang-log" data-role="log"></div></aside>
        </main>
        <footer class="gobang-footer"><span>黑方先行 · 15×15 标准棋盘</span><strong data-role="result">等待第一步</strong></footer>
        <div class="gobang-overlay is-hidden" data-role="rulesOverlay" aria-hidden="true"><article class="gobang-rules"><button class="gobang-close" type="button" data-ui="closeRules">×</button><small>HOW TO PLAY</small><h2>五子棋规则</h2><ol><li>黑方先行，双方轮流在棋盘交叉点落下一枚棋子。</li><li>任意横线、竖线或斜线连续五枚己方棋子即可获胜。</li><li>本局不设禁手，三三、四四和长连均不判负；长连也算五子连珠。</li><li>棋盘填满且没有胜者时判和棋。</li></ol></article></div>
    </section>`;
}
