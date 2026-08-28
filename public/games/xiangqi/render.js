/**
 * DOM/2D rendering facade for the Three.js Xiangqi scene.
 * GPU resources and animation remain owned by scene.js.
 */
export function createXiangqiRenderer({ scene }) {
    return {
        gameType: scene.gameType,
        handleMessage: scene.handleMessage,
        renderState: scene.renderState,
        renderMarkers: scene.renderMarkers,
        renderBoard2d: scene.renderBoard2d,
        destroy: scene.destroy,
    };
}
