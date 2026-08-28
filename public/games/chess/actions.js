/** Pointer and UI event binding for the Three.js chess scene. */
export function createChessActions({ scene }) {
    const bindings = scene.getActionBindings?.();
    let destroyed = false;
    if (!bindings) return { destroy() { destroyed = true; } };
    const { windowRef, viewport, canvas, mount } = bindings;
    const wheelOptions = { passive: false };
    windowRef.addEventListener('keydown', bindings.onKeyDown);
    viewport.addEventListener('pointerdown', bindings.onPointerDown);
    viewport.addEventListener('pointermove', bindings.onPointerMove);
    viewport.addEventListener('pointerup', bindings.onPointerUp);
    viewport.addEventListener('pointercancel', bindings.onPointerUp);
    viewport.addEventListener('wheel', bindings.onWheel, wheelOptions);
    viewport.addEventListener('contextmenu', bindings.onContextMenu);
    mount.addEventListener('click', bindings.onUiClick);
    canvas.addEventListener('webglcontextlost', bindings.onContextLost);
    return {
        destroy() {
            if (destroyed) return;
            destroyed = true;
            windowRef.removeEventListener('keydown', bindings.onKeyDown);
            viewport.removeEventListener('pointerdown', bindings.onPointerDown);
            viewport.removeEventListener('pointermove', bindings.onPointerMove);
            viewport.removeEventListener('pointerup', bindings.onPointerUp);
            viewport.removeEventListener('pointercancel', bindings.onPointerUp);
            viewport.removeEventListener('wheel', bindings.onWheel, wheelOptions);
            viewport.removeEventListener('contextmenu', bindings.onContextMenu);
            mount.removeEventListener('click', bindings.onUiClick);
            canvas.removeEventListener('webglcontextlost', bindings.onContextLost);
        },
    };
}
