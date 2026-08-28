export function createGobangScene({ model }) {
    return {
        reset() { model.hover = null; },
    };
}
