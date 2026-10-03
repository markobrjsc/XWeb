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
  // Kopfzeile (Header.astro)
  '--header-fg: #ffffff',
  '--header-fg-muted: rgb(255 255 255 / 0.72)',
  // Schrift auf Fotos (Startbild, HomeHero.astro)
  '--on-photo: #ffffff',
  // Pflichtfeld-Sternchen und Fehlerhinweise in Formularen
  '--color-danger: var(--color-accent)',
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
  '--header-fg: var(--onyx-950)',
  '--header-fg-muted: var(--gray-600)',
  '--on-photo: var(--onyx-950)',
  '--color-danger: var(--onyx-950)',
];

/**
 * Teile, die sonst nur auf [data-tone='dark'] reagieren (global.css, Eyebrow.astro, CheckList.astro, blocks.css) –
 * hier für beide Richtungen, damit auch ein helles Element in einem dunklen Bereich stimmt.
 * Hervorhebungen (.accent): auf dunklem Grund gelbe Schrift, auf hellem Grund Textmarker.
 * Bei „Hell“ bleiben dunkle Bereiche darin (dunkle Karten …) unberührt.
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
    ['.ub-iconbox__icon', '', ['background: rgb(255 255 255 / 0.08)']],
    ['.ub-button--secondary', '', ['--btn-bg: transparent', '--btn-fg: #ffffff', '--btn-border: rgb(255 255 255 / 0.4)', '--btn-bg-hover: rgb(255 255 255 / 0.1)', '--btn-border-hover: rgb(255 255 255 / 0.85)']],
    ['.ub-button--dunkel', '', ['--btn-bg: #ffffff', '--btn-fg: var(--onyx-950)', '--btn-bg-hover: var(--onyx-100)']],
    // Hellgraue Bereiche darin werden mit dunkel (ihr Hintergrund hängt an --color-bg-subtle/-muted, siehe SURFACES)
    [":is([data-tone='subtle'], [data-tone='muted'])", '', DARK],
    // Logo in der Kopfzeile (HeaderLogo.astro): dunkles Label, helle Schrift
    ['.hlogo', '', ['--hl-label: rgb(255 255 255 / 0.08)', '--hl-label-hover: rgb(255 255 255 / 0.14)', '--hl-ink: #ffffff', '--hl-text: #ffffff']],
  ],
  light: [
    ['.accent', '', ['display: inline-block', 'padding-inline: 0.08em', 'color: var(--color-highlight)']],
    ['.accent', '::before', ["content: ''"]],
    ['.eyebrow', '', ['--eyebrow-color: var(--blue-600)']],
    ['.ub-eyebrow', '', ['color: var(--blue-600)']],
    ['.checklist__item', '::before', ['background: var(--blue-50)']],
    ['.checklist__item', '::after', ['background: var(--blue-600)']],
    // Varianten „für dunklen Grund“ (Button.astro, Badge.astro, FactList.astro) auf hellem Grund lesbar machen
    ['.btn--outline-light', '', ['--btn-fg: var(--onyx-950)', '--btn-border: rgb(11 11 12 / 0.35)', '--btn-bg-hover: rgb(11 11 12 / 0.06)', '--btn-fg-hover: var(--onyx-950)', '--btn-border-hover: var(--onyx-950)']],
    ['.btn--light', '', ['--btn-bg: var(--onyx-950)', '--btn-fg: #ffffff', '--btn-border: var(--onyx-950)', '--btn-bg-hover: var(--onyx-800)', '--btn-fg-hover: #ffffff', '--btn-border-hover: var(--onyx-800)']],
    ['.badge--light', '', ['background: var(--gray-100)', 'color: var(--gray-700)']],
    ['.facts', '', ['background: var(--onyx-900)']],
    // Akzent-Links dunkler Karten (JobCard.astro) auf hellem Grund in Schriftfarbe
    ['.job-card__more', '', ['color: var(--color-heading)']],
    // Baukasten (blocks.css): Buttons und Symbolkreis wie auf hellem Grund
    ['.ub-button--secondary', '', ['--btn-bg: #ffffff', '--btn-fg: var(--onyx-800)', '--btn-border: var(--gray-300)', '--btn-bg-hover: var(--onyx-50)', '--btn-border-hover: var(--onyx-400)']],
    ['.ub-button--dunkel', '', ['--btn-bg: var(--onyx-950)', '--btn-fg: #ffffff', '--btn-bg-hover: var(--onyx-700)']],
    ['.ub-iconbox__icon', '', ['background: var(--onyx-950)']],
    ['.hlogo', '', ['--hl-label: #ffffff', '--hl-label-hover: var(--gray-100)', '--hl-ink: var(--onyx-950)', '--hl-text: var(--onyx-950)']],
  ],
};

/** Teile, die selbst eigenes Design haben können (Schrift-Elemente) – Flächen wie .facts nicht */
const SELF_PARTS = new Set(['.accent', '.eyebrow', '.ub-eyebrow']);

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
    // Hell: dunkle Bereiche darin (dunkle Karten …) behalten ihr Aussehen. Dunkel: gilt überall – auch hellgraue
    // Bereiche darin werden dunkel (ihre Hintergründe hängen an --color-bg-subtle/-muted, siehe SURFACES)
    /** @param {string} target */
    const keep = (target) => (colors === 'light' ? `:not(${selector} :is([data-tone='dark'], [data-tone='brand']) ${target})` : '');
    for (const [target, pseudo, partDecls] of PARTS[colors]) {
      rules.push(rule(`${selector} ${target}${keep(target)}${pseudo}`, partDecls));
      // Ist das Element selbst eine Schrift-Art davon (z. B. eine Überzeile mit eigenem Design in einer dunkel gesetzten
      // Spalte), gilt sein eigenes Design – mindestens so spezifisch wie die Regel des Elternelements und danach
      if (SELF_PARTS.has(target)) rules.push(rule(`${selector}:is(${target})${pseudo}`, partDecls));
    }
  }
  if (isDesign(shade)) {
    // Nur die Bilder selbst – Bildunterschriften bleiben unverändert
    rules.push(rule(`${selector}:is(img, video), ${selector} :is(img, video)`, [`filter: brightness(${BRIGHTNESS[shade]})`]));
  }
  return rules.join('\n');
}
