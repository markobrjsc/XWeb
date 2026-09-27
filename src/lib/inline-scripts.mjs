/**
 * Inline-Skripte, die sofort beim Laden im <head> laufen müssen.
 * Ihr SHA-256-Hash wird in astro.config.mjs berechnet und in die Content-Security-Policy
 * aufgenommen – nach einer Änderung hier ist daher nichts weiter zu tun.
 */

/** Markiert, dass JavaScript aktiv ist – erst dann werden Scroll-Animationen vorbereitet. */
export const JS_DETECT_SCRIPT = "document.documentElement.classList.add('js')";
