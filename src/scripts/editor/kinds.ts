/**
 * Bearbeiten-Modus – alle Arten von Seitenelementen und welche Einstellungen für sie sinnvoll sind.
 * Jedes Element hat mindestens „Design: Hell / Dunkel“ und den Außenabstand; alles Weitere nur, wenn es für die
 * Elementart Sinn ergibt (z. B. Schriftgröße nur bei Texten, Lücke nur bei Rastern, Innenabstand nur bei Flächen).
 * Elemente aus dem Baukasten haben eigene Regeln: src/lib/blocks/style.ts (STYLE_OPTIONS, BLOCK_DESIGN).
 *
 * Design-Art: tone = Fläche (Hintergrund + Schrift), ink = Schrift (hell/dunkel), shade = Bild (aufhellen/abdunkeln).
 */
import type { DesignMode } from './panel';

export type Control =
  /** Farben (im Bereich „Design“) */
  | 'bgColor'
  | 'textColor'
  /** Schrift */
  | 'fontSize'
  | 'fontWeight'
  | 'align'
  /** Abstände – der Außenabstand ist immer dabei */
  | 'padding'
  /** Form */
  | 'radius'
  | 'maxWidth'
  | 'gap'
  /** Auf Handy/Computer ausblenden */
  | 'hide';

export type Kind = {
  name: string;
  icon: string;
  group: 'Basis' | 'Erweitert';
  design: DesignMode;
  controls: readonly Control[];
};

const kind = (group: Kind['group'], name: string, icon: string, design: DesignMode, controls: Control[]): Kind => ({ name, icon, group, design, controls });

/** Katalog aller Elementarten der Website */
export const KINDS = {
  /* ---------------- Basis ---------------- */
  heading: kind('Basis', 'Überschrift', 'heading', 'ink', ['textColor', 'fontSize', 'fontWeight', 'align', 'maxWidth', 'hide']),
  text: kind('Basis', 'Text', 'type', 'ink', ['textColor', 'fontSize', 'fontWeight', 'align', 'maxWidth', 'hide']),
  eyebrow: kind('Basis', 'Überzeile', 'minus', 'ink', ['textColor', 'fontSize', 'hide']),
  mark: kind('Basis', 'Markierung', 'highlighter', 'ink', ['textColor']),
  textPart: kind('Basis', 'Textteil', 'type', 'ink', ['textColor', 'fontWeight']),
  link: kind('Basis', 'Link', 'link', 'ink', ['textColor', 'fontSize', 'fontWeight', 'hide']),
  button: kind('Basis', 'Button', 'mouse-pointer-click', 'tone', ['bgColor', 'textColor', 'fontSize', 'padding', 'radius', 'hide']),
  badge: kind('Basis', 'Etikett', 'tag', 'tone', ['bgColor', 'textColor', 'fontSize', 'fontWeight', 'padding', 'radius', 'hide']),
  icon: kind('Basis', 'Symbol', 'shapes', 'tone', ['bgColor', 'textColor', 'radius', 'hide']),
  image: kind('Basis', 'Bild', 'image', 'shade', ['radius', 'maxWidth', 'hide']),
  figure: kind('Basis', 'Bild mit Text', 'image', 'shade', ['radius', 'maxWidth', 'hide']),
  caption: kind('Basis', 'Bildunterschrift', 'type', 'ink', ['textColor', 'fontSize', 'align']),
  list: kind('Basis', 'Liste', 'list', 'ink', ['textColor', 'fontSize', 'gap', 'hide']),
  listItem: kind('Basis', 'Listenpunkt', 'dot', 'ink', ['textColor', 'fontSize', 'hide']),
  quote: kind('Basis', 'Zitat', 'quote', 'tone', ['bgColor', 'textColor', 'fontSize', 'align', 'padding', 'radius', 'hide']),
  stat: kind('Basis', 'Kennzahl', 'hash', 'ink', ['textColor', 'fontSize', 'align', 'hide']),
  label: kind('Basis', 'Beschriftung', 'type', 'ink', ['textColor', 'fontSize', 'fontWeight']),
  input: kind('Basis', 'Eingabefeld', 'text-cursor-input', 'tone', ['radius']),
  divider: kind('Basis', 'Trennlinie', 'minus', 'ink', ['maxWidth', 'hide']),
  logo: kind('Basis', 'Logo', 'badge', 'tone', []),

  /* ---------------- Erweitert ---------------- */
  section: kind('Erweitert', 'Abschnitt', 'layout-template', 'tone', ['bgColor', 'textColor', 'align', 'padding', 'hide']),
  hero: kind('Erweitert', 'Seitenkopf', 'panel-top', 'tone', ['align', 'padding']),
  heroImage: kind('Erweitert', 'Kopfbild', 'image', 'shade', []),
  card: kind('Erweitert', 'Karte', 'square', 'tone', ['bgColor', 'textColor', 'align', 'padding', 'radius', 'maxWidth', 'hide']),
  service: kind('Erweitert', 'Leistungskarte', 'square-stack', 'tone', ['bgColor', 'padding', 'radius', 'hide']),
  gallery: kind('Erweitert', 'Galerie', 'images', 'shade', ['radius', 'maxWidth', 'hide']),
  grid: kind('Erweitert', 'Raster', 'layout-grid', 'tone', ['bgColor', 'padding', 'gap', 'maxWidth', 'hide']),
  group: kind('Erweitert', 'Gruppe', 'rows-3', 'tone', ['bgColor', 'align', 'padding', 'gap', 'hide']),
  area: kind('Erweitert', 'Bereich', 'box', 'tone', ['bgColor', 'textColor', 'align', 'padding', 'radius', 'maxWidth', 'hide']),
  facts: kind('Erweitert', 'Angaben', 'list', 'tone', ['bgColor', 'textColor', 'fontSize', 'padding', 'radius', 'gap', 'hide']),
  form: kind('Erweitert', 'Formular', 'text-cursor-input', 'tone', ['bgColor', 'padding', 'radius', 'gap', 'maxWidth']),
  fieldset: kind('Erweitert', 'Formular-Gruppe', 'text-cursor-input', 'tone', ['padding', 'radius', 'gap']),
  nav: kind('Erweitert', 'Navigation', 'menu', 'ink', ['fontSize', 'gap', 'hide']),
  header: kind('Erweitert', 'Kopfzeile', 'panel-top', 'tone', ['bgColor']),
  footer: kind('Erweitert', 'Fußzeile', 'panel-bottom', 'tone', ['bgColor', 'padding']),
} satisfies Record<string, Kind>;

export type KindId = keyof typeof KINDS;

const isInline = (el: Element) => {
  const display = getComputedStyle(el).display;
  return display.startsWith('inline') || display === 'contents';
};

/** Elementart erkennen – die Reihenfolge entscheidet (Spezielles vor Allgemeinem) */
const MATCH: [selector: string, kind: KindId][] = [
  ['.site-header', 'header'],
  ['.site-footer', 'footer'],
  ['[data-carousel]', 'gallery'],
  ['.service', 'service'],
  ['.hero__bg, .page-hero__photo', 'heroImage'],
  ['[data-hero-edit]', 'hero'],
  ['.eyebrow', 'eyebrow'],
  ['h1, h2, h3, h4, h5, h6', 'heading'],
  ['.accent, .marker, mark', 'mark'],
  ['.badge', 'badge'],
  ['.icon-badge, .service__icon, .feature__icon, .contact-list__icon', 'icon'],
  ['.stat, .stats__item', 'stat'],
  ['.btn, .copy-btn, button', 'button'],
  ['.site-header__brand, .logo', 'logo'],
  ['a', 'link'],
  ['.card, .feature, .job-card, article', 'card'],
  ['p', 'text'],
  ['li', 'listItem'],
  ['ul, ol', 'list'],
  ['img, picture, video, .media', 'image'],
  ['figure', 'figure'],
  ['figcaption', 'caption'],
  ['blockquote', 'quote'],
  ['form', 'form'],
  ['fieldset', 'fieldset'],
  ['label, legend', 'label'],
  ['input, textarea, select', 'input'],
  ['hr', 'divider'],
  ['nav', 'nav'],
  ['dl, .facts', 'facts'],
  ['section', 'section'],
];

/** Elementart eines Seitenelements (Elemente aus dem Baukasten benennt der Element-Editor) */
export function kindOf(el: Element, isText = false): Kind {
  for (const [selector, id] of MATCH) if (el.matches(selector)) return KINDS[id];
  // Oberste Ebene unter <main> = Abschnitt der Seite
  if (el.parentElement?.matches('main')) return KINDS.section;
  const tag = el.tagName.toLowerCase();
  if (tag === 'header') return { ...KINDS.area, name: 'Kopfbereich' };
  if (tag === 'footer') return { ...KINDS.area, name: 'Fußbereich' };
  if (tag === 'aside') return { ...KINDS.area, name: 'Seitenbereich' };
  if (isText) return isInline(el) ? KINDS.textPart : KINDS.text;
  const display = getComputedStyle(el).display;
  if (display.includes('grid')) return KINDS.grid;
  if (display.includes('flex')) return KINDS.group;
  return KINDS.area;
}
