/**
 * Inline-Skripte, die sofort beim Laden im <head> laufen müssen.
 * Ihr SHA-256-Hash wird in astro.config.mjs berechnet und in die Content-Security-Policy
 * aufgenommen – nach einer Änderung hier ist daher nichts weiter zu tun.
 */

/** Markiert, dass JavaScript aktiv ist – erst dann werden Scroll-Animationen vorbereitet. */
export const JS_DETECT_SCRIPT = "document.documentElement.classList.add('js')";

/**
 * Richtung der Seitenübergänge (View Transitions zwischen Seiten).
 * Liegt die Zielseite im Menü weiter rechts, gleitet sie von rechts herein und die aktuelle Seite
 * nach links hinaus – sonst umgekehrt. Die Reihenfolge entspricht `navOrder` in
 * src/config/navigation.ts (bei neuen Menüpunkten bitte hier ergänzen).
 * Muss im <head> stehen, damit das Ereignis `pagereveal` vor dem ersten Zeichnen registriert ist.
 */
const NAV_ORDER = ['/', '/leistungen/', '/stellenangebote/', '/betrieb/', '/kontakt/'];

export const PAGE_TRANSITION_SCRIPT = `(function(){var o=${JSON.stringify(NAV_ORDER)};function i(u){var p;try{p=new URL(u).pathname}catch(e){return -1}for(var k=o.length-1;k>0;k--){if(p.indexOf(o[k])===0)return k}return p==='/'?0:-1}addEventListener('pagereveal',function(e){var t=e.viewTransition,a=window.navigation&&navigation.activation;if(!t)return;if(!a||!a.from||!a.entry){t.types.add('page-fade');return}var f=i(a.from.url),n=i(a.entry.url);t.types.add(f<0||n<0||f===n?'page-fade':n>f?'page-forward':'page-back')})})();`;

/**
 * Design-Vorschau (src/components/debug/DesignPanel.astro): Abdunklung des
 * Startbilds sofort setzen – vor dem ersten Zeichnen, damit beim Seitenwechsel nichts aufflackert.
 */
export const DESIGN_BOOT_SCRIPT =
  "try{var s=localStorage,d=s.getItem('design-hero-dim');s.removeItem('design-theme');if(d)document.documentElement.style.setProperty('--hero-dim',d)}catch(e){}";
