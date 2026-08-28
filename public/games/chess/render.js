/**
 * DOM/2D rendering facade for the chess scene.
 *
 * The GPU lifecycle stays in scene.js; this module keeps the render contract
 * small and makes the boundary explicit for the client and future views.
 */
export function createChessRenderer({ scene }) {
    return {
        gameType: scene.gameType,
        handleMessage: scene.handleMessage,
        renderState: scene.renderState,
        renderTiles: scene.renderTiles,
        renderBoard2d: scene.renderBoard2d,
        setStudyPlacement: scene.setStudyPlacement,
        destroy: scene.destroy,
    };
}
