import { getGameStyleHrefs } from '../common/game-manifest.js';
import { createClientScope } from '../common/lifecycle.js';
import { loadStyles } from '../common/style-loader.js';
import { createXiangqiActions } from './actions.js';
import { createXiangqiRenderer } from './render.js';
import { createXiangqiScene } from './scene.js';
import { createXiangqiModel } from './state.js';
import { createXiangqiTemplate } from './template.js';

/** Protocol and lifecycle entry for the isolated Three.js Xiangqi board. */
export function createGameClient({ mount, send, addLog }) {
    const documentRef = globalThis.document;
    const windowRef = globalThis.window || globalThis;
    const styleHandle = loadStyles(getGameStyleHrefs('xiangqi'), { documentRef });
    const scope = createClientScope({ windowRef });
    const model = createXiangqiModel();
    mount.innerHTML = createXiangqiTemplate();
    const scene = createXiangqiScene({ mount, model, send, addLog });
    const renderer = createXiangqiRenderer({ scene });
    const actions = createXiangqiActions({ scene });
    return {
        gameType: 'xiangqi',
        handleMessage: renderer.handleMessage,
        destroy() {
            actions.destroy();
            renderer.destroy();
            model.destroyed = true;
            scope.destroy();
            styleHandle.release();
            mount.innerHTML = '';
        },
    };
}
