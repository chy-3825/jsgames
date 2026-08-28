import { getGameStyleHrefs } from '../common/game-manifest.js';
import { createClientScope } from '../common/lifecycle.js';
import { loadStyles } from '../common/style-loader.js';
import { createChessActions } from './actions.js';
import { CHESS_SKINS, SKIN_STORAGE_KEY } from './constants.js';
import { createChessRenderer } from './render.js';
import { createChessScene } from './scene.js';
import { createChessModel } from './state.js';
import { createChessTemplate } from './template.js';

/** Protocol and lifecycle entry for the isolated Three.js chess frame. */
export function createGameClient({ mount, send, addLog }) {
    const documentRef = globalThis.document;
    const windowRef = globalThis.window || globalThis;
    const styleHandle = loadStyles(getGameStyleHrefs('chess'), { documentRef });
    const scope = createClientScope({ windowRef });
    const model = createChessModel();
    const savedSkin = windowRef.localStorage?.getItem(SKIN_STORAGE_KEY);
    const skinId = CHESS_SKINS[savedSkin] ? savedSkin : 'walnut';
    mount.innerHTML = createChessTemplate({ skinId, skin: CHESS_SKINS[skinId] });
    documentRef.body.classList.add('is-chess-view');
    const scene = createChessScene({ mount, model, send, addLog });
    const renderer = createChessRenderer({ scene });
    const actions = createChessActions({ scene });
    return {
        gameType: 'chess',
        handleMessage: renderer.handleMessage,
        setStudyPlacement: renderer.setStudyPlacement,
        destroy() {
            actions.destroy();
            renderer.destroy();
            model.destroyed = true;
            scope.destroy();
            documentRef.body.classList.remove('is-chess-view');
            styleHandle.release();
            mount.innerHTML = '';
        },
    };
}
