/**
 * Shared exit-state helpers for full-screen presentation layers.
 *
 * A scene should call `beginPresentationFade(layer)` and keep the layer in
 * the document for `PRESENTATION_FADE_MS` before removing it.  `clear...` is
 * used by show/stop paths so an interrupted scene cannot leak the fade state
 * into the next presentation.
 */
export const PRESENTATION_FADE_MS = 360;
export const PRESENTATION_FADE_CLASS = 'is-presentation-fading';

export function beginPresentationFade(element) {
    if (!element) return;
    element.classList.remove(PRESENTATION_FADE_CLASS);
    void element.offsetWidth;
    element.classList.add(PRESENTATION_FADE_CLASS);
}

export function clearPresentationFade(element) {
    element?.classList.remove(PRESENTATION_FADE_CLASS);
}
