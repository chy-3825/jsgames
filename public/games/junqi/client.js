import { getGameStyleHrefs } from '../common/game-manifest.js';
import { createClientScope } from '../common/lifecycle.js';
import { loadStyles } from '../common/style-loader.js';
import { createJunqiActions } from './actions.js';
import { createJunqiRenderer } from './render.js';
import { createJunqiScene } from './scene.js';
import { createJunqiModel } from './state.js';
import { createJunqiTemplate } from './template.js';

/** Protocol and lifecycle entry for the isolated Three.js Junqi board. */
export function createGameClient({ mount, send, addLog }) {
    const documentRef = globalThis.document;
    const windowRef = globalThis.window || globalThis;
    const styleHandle = loadStyles(getGameStyleHrefs('junqi'), { documentRef });
    const scope = createClientScope({ windowRef });
    const model = createJunqiModel();
    mount.innerHTML = createJunqiTemplate();
    const scene = createJunqiScene({ mount, model, send, addLog });
    const renderer = createJunqiRenderer({ scene });
    const actions = createJunqiActions({ scene });
    return {
        gameType: 'junqi',
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
