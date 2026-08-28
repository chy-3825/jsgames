/** Pointer and UI event binding for the Three.js Xiangqi scene. */
export function createXiangqiActions({ scene }) {
    const bindings = scene.getActionBindings?.();
    let destroyed = false;
    if (!bindings) return { destroy() { destroyed = true; } };
    const { viewport, canvas, mount } = bindings;
    const wheelOptions = { passive: false };
    viewport.addEventListener('pointerdown', bindings.onPointerDown);
    viewport.addEventListener('pointermove', bindings.onPointerMove);
    viewport.addEventListener('pointerup', bindings.onPointerUp);
    viewport.addEventListener('pointercancel', bindings.onPointerUp);
    viewport.addEventListener('wheel', bindings.onWheel, wheelOptions);
    viewport.addEventListener('contextmenu', bindings.onContextMenu);
    mount.addEventListener('click', bindings.onUi);
    canvas.addEventListener('webglcontextlost', bindings.onContextLost);
    return {
        destroy() {
            if (destroyed) return;
            destroyed = true;
            viewport.removeEventListener('pointerdown', bindings.onPointerDown);
            viewport.removeEventListener('pointermove', bindings.onPointerMove);
            viewport.removeEventListener('pointerup', bindings.onPointerUp);
            viewport.removeEventListener('pointercancel', bindings.onPointerUp);
            viewport.removeEventListener('wheel', bindings.onWheel, wheelOptions);
            viewport.removeEventListener('contextmenu', bindings.onContextMenu);
            mount.removeEventListener('click', bindings.onUi);
            canvas.removeEventListener('webglcontextlost', bindings.onContextLost);
        },
    };
}
