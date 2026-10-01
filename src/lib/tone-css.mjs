// @ts-check
/**
 * „Design: Hell / Dunkel“ einzelner Elemente aus dem Bearbeiten-Modus → CSS. Drei Arten, je nach Element:
 *  tone   Fläche (Abschnitt, Karte, Button, Bereich …): Hintergrund und alle Farben darin – wie data-tone
 *  ink    Schrift (Überschrift, Text, Liste …): helle bzw. dunkle Schrift, ohne eigenen Hintergrund
 *  shade  Bild (Foto, Galerie, Kopfbild): aufgehellt bzw. abgedunkelt
 *
 * Genutzt von scripts/build-spacing.mjs (gespeicherte Gestaltung der Seitenelemente), src/scripts/editor/styles.ts
 * (Vorschau im Bearbeiten-Modus) und src/lib/blocks/style.ts (Elemente aus dem Baukasten).
 * Die dunklen Farben entsprechen [data-tone='dark'] in src/styles/global.css – bei Änderungen beide anpassen.
 */

/** Farben auf dunklem Grund */
const DARK = [
  '--color-heading: var(--color-text-inverse)',
  '--color-text: var(--color-text-inverse-muted)',
  '--color-text-muted: var(--color-text-inverse-subtle)',
  '--color-text-subtle: var(--color-text-inverse-subtle)',
  '--color-border: var(--color-border-inverse)',
  '--color-border-strong: rgb(255 255 255 / 0.24)',
  '--color-link: var(--blue-200)',
  '--color-link-hover: #ffffff',
  '--color-focus: var(--color-focus-inverse)',
  '--color-surface: rgb(255 255 255 / 0.05)',
  '--color-surface-raised: rgb(255 255 255 / 0.08)',
  '--color-primary-soft: rgb(255 255 255 / 0.1)',
  '--color-primary-softer: rgb(255 255 255 / 0.06)',
];

/** Farben auf hellem Grund (Standardwerte aus src/styles/tokens.css) */
const LIGHT = [
  '--color-heading: var(--onyx-950)',
  '--color-text: var(--gray-800)',
  '--color-text-muted: var(--gray-600)',
  '--color-text-subtle: var(--gray-500)',
  '--color-border: var(--gray-200)',
  '--color-border-strong: var(--gray-300)',
  '--color-link: var(--onyx-800)',
  '--color-link-hover: var(--onyx-950)',
  '--color-focus: var(--onyx-950)',
  '--color-surface: var(--gray-0)',
  '--color-surface-raised: var(--gray-0)',
  '--color-primary-soft: var(--onyx-100)',
  '--color-primary-softer: var(--onyx-50)',
];

/**
 * Teile, die sonst nur auf [data-tone='dark'] reagieren (global.css, Eyebrow.astro, CheckList.astro, blocks.css) –
 * hier für beide Richtungen, damit auch ein helles Element in einem dunklen Bereich stimmt.
 * Hervorhebungen (.accent): auf dunklem Grund gelbe Schrift, auf hellem Grund Textmarker.
 * Bereiche darin mit eigener Farbwelt ([data-tone], z. B. dunkle Karten) bleiben unberührt.
 * @type {Record<'light' | 'dark', [target: string, pseudo: string, decls: string[]][]>}
 */
const PARTS = {
  dark: [
    ['.accent', '', ['display: inline', 'padding-inline: 0', 'color: var(--color-accent)']],
    ['.accent', '::before', ['content: none']],
    ['.eyebrow', '', ['--eyebrow-color: var(--blue-200)']],
    ['.ub-eyebrow', '', ['color: var(--blue-200)']],
    ['.checklist__item', '::before', ['background: rgb(255 255 255 / 0.1)']],
    ['.checklist__item', '::after', ['background: var(--blue-200)']],
    [':is(.ub-card--rahmen, .ub-card--schatten, .ub-card--akzent)', '', ['background: var(--color-surface-raised)', 'box-shadow: none']],
  ],
  light: [
    ['.accent', '', ['display: inline-block', 'padding-inline: 0.08em', 'color: var(--color-highlight)']],
    ['.accent', '::before', ["content: ''"]],
    ['.eyebrow', '', ['--eyebrow-color: var(--blue-600)']],
    ['.ub-eyebrow', '', ['color: var(--blue-600)']],
    ['.checklist__item', '::before', ['background: var(--blue-50)']],
    ['.checklist__item', '::after', ['background: var(--blue-600)']],
  ],
};

/** Nur bei Flächen: helle Hintergründe darin (z. B. grau hinterlegte Kopfzeilen) passen sich mit an */
const SURFACES = {
  dark: [
    '--color-bg: var(--color-bg-dark)',
    '--color-bg-subtle: color-mix(in srgb, var(--color-bg-dark) 93%, #ffffff)',
    '--color-bg-muted: color-mix(in srgb, var(--color-bg-dark) 93%, #ffffff)',
  ],
  light: ['--color-bg: var(--gray-0)', '--color-bg-subtle: var(--gray-50)', '--color-bg-muted: var(--onyx-50)'],
};

const BRIGHTNESS = { dark: 0.7, light: 1.15 };

/** @param {string} selector @param {string[]} decls */
const rule = (selector, decls) => `${selector} {\n${decls.map((d) => `  ${d} !important;`).join('\n')}\n}`;

/** @param {unknown} value @returns {value is 'light' | 'dark'} */
export const isDesign = (value) => value === 'light' || value === 'dark';

/**
 * CSS-Regeln für ein Element mit eigenem Design.
 * @param {string} selector
 * @param {{ tone?: unknown; ink?: unknown; shade?: unknown }} values
 * @returns {string}
 */
export function designCss(selector, { tone, ink, shade }) {
  const rules = [];
  // Fläche „Dunkel“ = dunkler Grund mit heller Schrift · Schrift „Hell“ = helle Schrift, also die Farben für dunklen Grund
  const colors = isDesign(tone) ? tone : isDesign(ink) ? (ink === 'light' ? 'dark' : 'light') : null;
  if (colors) {
    const decls = [...(colors === 'dark' ? DARK : LIGHT)];
    // Fläche: eigener Hintergrund, Fließtextfarbe · Schrift: kräftige Farbe, kein Hintergrund
    if (isDesign(tone)) decls.push(...SURFACES[tone], `background-color: var(${tone === 'dark' ? '--color-bg-dark' : '--color-bg'})`, 'color: var(--color-text)');
    else decls.push('color: var(--color-heading)');
    rules.push(rule(selector, decls));
    for (const [target, pseudo, partDecls] of PARTS[colors]) {
      rules.push(rule(`${selector} ${target}:not(${selector} [data-tone] ${target})${pseudo}`, partDecls));
    }
  }
  if (isDesign(shade)) {
    // Nur die Bilder selbst – Bildunterschriften bleiben unverändert
    rules.push(rule(`${selector}:is(img, video), ${selector} :is(img, video)`, [`filter: brightness(${BRIGHTNESS[shade]})`]));
  }
  return rules.join('\n');
}
