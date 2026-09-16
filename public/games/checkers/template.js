import { createLines } from './constants.js';

export function createCheckersTemplate() {
    return '<section class="checkers-game">' +
        '<header class="checkers-header"><div class="checkers-brand"><span class="checkers-mark">跳</span><div><h1>跳棋</h1></div></div><div class="checkers-turn" data-role="turn" aria-live="polite">等待棋局状态</div><div class="checkers-actions"><button type="button" data-ui="rules">规则</button></div></header>' +
        '<main class="checkers-layout"><aside class="checkers-panel checkers-players"><div class="checkers-panel-title"><span>对局玩家</span><small data-role="status">等待中</small></div><div data-role="players"></div><details class="checkers-records"><summary>行棋记录</summary><div class="checkers-log" data-role="log"></div></details></aside>' +
        '<section class="checkers-stage"><div class="checkers-board-wrap"><div class="checkers-board" data-role="board" role="grid" aria-label="六角星跳棋棋盘"><svg class="checkers-lines" viewBox="0 0 24 16" preserveAspectRatio="none" aria-hidden="true">' + createLines() + '</svg><div class="checkers-holes" data-role="holes"></div></div></div><div class="checkers-hint" data-role="hint" aria-live="polite">等待棋局开始</div><button class="checkers-end-move" data-ui="endMove" data-role="endMove" type="button" hidden>结束连续跳跃</button></section>' +
        '</main>' +
        '<span data-role="result" hidden></span>' +
        '<div class="checkers-overlay is-hidden" data-role="rulesOverlay" aria-hidden="true"><article class="checkers-rules"><button class="checkers-close" type="button" data-ui="closeRules">×</button><small>HOW TO PLAY</small><h2>跳棋规则</h2><ol><li>棋盘有六个角，每方十枚棋子，目标是占满自己的对角目标角。</li><li>轮到你时，可将一枚棋子走到相邻空位。</li><li>也可以跳过相邻的任意颜色棋子，落到后方空位；一次回合可连续改变方向跳跃。</li><li>连续跳跃中可以随时结束移动，先把全部棋子送入目标角的一方获胜。</li></ol></article></div></section>';
}
