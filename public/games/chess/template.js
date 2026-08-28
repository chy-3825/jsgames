import { CHESS_SKINS } from './constants.js';

export function createChessTemplate({ skinId = 'walnut', skin = CHESS_SKINS[skinId] } = {}) {
    return `
        <section class="chess3d-app" data-skin="${skinId}">
            <header class="chess3d-header">
                <div class="chess3d-header-left"><button class="chess3d-settings-button" data-ui="settings" type="button" aria-haspopup="dialog"><span aria-hidden="true">⚙</span> 设置</button></div>
                <div class="chess3d-title"><span class="chess3d-title-mark">♞</span><div><strong>国际象棋</strong><small data-role="skinSubtitle">${CHESS_SKINS[skinId].subtitle}</small></div></div>
                <div class="chess3d-header-actions"><span class="chess3d-room" data-role="room">自由对局</span><button data-ui="draw" data-role="drawButton" type="button" hidden>申请和棋</button><button data-ui="viewMode" data-role="viewModeButton" type="button">2D</button><button data-ui="reset" data-role="resetButton" type="button">视角</button><button data-ui="rules" type="button">规则</button></div>
            </header>
            <main class="chess3d-main">
                <aside class="chess3d-player-card" data-role="blackPlayer"></aside>
                <section class="chess3d-stage">
                    <div class="chess3d-viewport" data-role="viewport">
                        <canvas data-role="canvas" aria-label="三维国际象棋棋盘"></canvas>
                        <div class="chess2d-board" data-role="board2d" aria-label="二维国际象棋棋盘" hidden></div>
                        <div class="chess3d-stage-status" data-role="stageStatus"></div>
                        <div class="chess3d-hint" data-role="hint">拖动棋盘旋转 · 滚轮缩放</div>
                    </div>
                    <div class="chess3d-captured" data-role="captured"><span>被吃棋子</span><div data-role="capturedWhite"></div><i></i><div data-role="capturedBlack"></div></div>
                </section>
                <aside class="chess3d-player-card" data-role="whitePlayer"></aside>
            </main>
            <footer class="chess3d-footer"><div class="chess3d-turn" data-role="turn"></div><div class="chess3d-last-move" data-role="lastMove"></div><div class="chess3d-log" data-role="log"></div></footer>
            <div class="chess3d-overlay chess3d-settings is-hidden" data-role="settingsOverlay" role="dialog" aria-modal="true" aria-labelledby="chessSkinTitle"><article><button data-ui="closeSettings" type="button" aria-label="关闭设置">×</button><span>对局设置</span><h2 id="chessSkinTitle">选择棋盘皮肤</h2><p>皮肤只影响你看到的棋室、棋盘和棋子材质，不改变对局规则。</p><div class="chess3d-skin-options"><button data-ui="skin" data-skin="walnut" type="button"><span class="chess3d-skin-preview walnut" aria-hidden="true"><i></i><i></i><i></i><i></i></span><strong>经典胡桃木</strong><small>暖色木纹、象牙与黑檀棋子</small><b>使用中</b></button><button data-ui="skin" data-skin="slate" type="button"><span class="chess3d-skin-preview slate" aria-hidden="true"><i></i><i></i><i></i><i></i></span><strong>暮色石板</strong><small>冷色石板、银灰棋框与柔光</small><b>使用中</b></button></div></article></div>
            <div class="chess3d-overlay is-hidden" data-role="rulesOverlay"><article><button data-ui="closeRules" type="button">×</button><span>基础规则</span><h2>国际象棋</h2><p>黑白双方轮流移动棋子，目标是将对方的王将死。</p><ul><li>白方先行，点击自己的棋子查看合法走法。</li><li>蓝色表示可走空位，红色表示可吃目标。</li><li>深红光标出将军者；将杀时亮红光标出整个将杀网络。</li><li>支持王车易位、吃过路兵和兵升变。</li><li>棋盘可以旋转和缩放，点击视角按钮恢复默认方向。</li></ul></article></div>
            <div class="chess3d-overlay chess3d-promotion is-hidden" data-role="promotionOverlay"><article><span>兵的升变</span><h2>选择升变棋子</h2><p>兵已经到达底线，请选择要升变的棋子。</p><div class="chess3d-promotion-options"><button data-ui="promotion" data-promotion="q" type="button"></button><button data-ui="promotion" data-promotion="r" type="button"></button><button data-ui="promotion" data-promotion="b" type="button"></button><button data-ui="promotion" data-promotion="n" type="button"></button></div></article></div>
        </section>
    `;
}
