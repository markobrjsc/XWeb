/**
 * Bearbeiten-Modus – Hilfen rund um die Elemente der Seite:
 *  · pickTarget: welches Element passt am besten zur angeklickten Stelle (Text → nur der Text, freie Fläche → Karte/Abschnitt)
 *  · kindAt / nameOf: Elementart (Name, Symbol, sinnvolle Einstellungen – Katalog in ./kinds.ts)
 *  · childItems / parentOf / chainOf: Aufbau der Seite für Ebenen und Brotkrumen
 *  · selectorFor: stabiler CSS-Selektor für gespeicherte Gestaltung (src/content/spacing.json)
 */
import { kindOf } from './kinds';

/** Oberfläche des Bearbeiten-Modus und Design-Vorschau – nie auswählbar */
export const UI = '[data-edit-ui], [data-design-panel]';
export const isUi = (el: Element | null) => Boolean(el?.closest(UI));

/** Texte darin werden nicht bearbeitet (Skripte, Formularfelder, Zähler, Galerien, Elemente aus dem Baukasten …) */
export const TEXT_SKIP =
  'script, style, noscript, template, svg, textarea, select, option, input, [data-edit-ui], [data-design-panel], ub-zone, [data-count-to], [data-carousel], .visually-hidden, [aria-hidden="true"], .hlogo';

const NO_LIST = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'LINK', 'META', 'SOURCE', 'TRACK', 'BR', 'svg']);

const display = (el: Element) => getComputedStyle(el).display;
const isInline = (el: Element) => display(el).startsWith('inline') || display(el) === 'contents';

/** Durchsichtige Hüllen, die in der Seitenleiste übersprungen werden */
const isWrapper = (el: Element) => el.tagName === 'UB-ZONE' || el.matches('.ub-contain, .ub-slot') || display(el) === 'contents';

/** Alle bearbeitbaren Textstücke in einem Element */
export function textNodes(el: Element, limit = 24): Text[] {
  const nodes: Text[] = [];
  if (el.closest(TEXT_SKIP)) return nodes;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      node.textContent?.trim() && !node.parentElement?.closest(TEXT_SKIP) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
  });
  for (let node = walker.nextNode(); node && nodes.length < limit; node = walker.nextNode()) nodes.push(node as Text);
  return nodes;
}

/** Ein Textelement enthält Text und darin nur Inline-Elemente (z. B. Überschrift mit gelber Markierung) */
export function isTextElement(el: Element): boolean {
  if (el.matches('[data-ub], ub-zone, main, body') || !textNodes(el, 1).length) return false;
  return [...el.querySelectorAll('*')].every((child) => child.closest('svg') || isInline(child) || display(child) === 'none');
}

const alphaOf = (color: string) => {
  if (color === 'transparent') return 0;
  const parts = color.match(/\(([^)]+)\)/)?.[1].split(/[\s,/]+/).filter(Boolean) ?? [];
  return parts.length > 3 ? parseFloat(parts[3]) : 1;
};

/** Sichtbar abgegrenzt: Hintergrund, Rahmen oder Schatten – so erkennt man Karten und Flächen */
const hasBox = (el: Element) => {
  const cs = getComputedStyle(el);
  return (
    alphaOf(cs.backgroundColor) > 0.03 ||
    cs.backgroundImage !== 'none' ||
    cs.boxShadow !== 'none' ||
    (parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== 'none' && alphaOf(cs.borderTopColor) > 0.05)
  );
};

const BOXES =
  '[data-ub], button, a[href], label, input, textarea, select, section, article, li, figure, form, fieldset, aside, nav, dl, .card, .site-footer, .site-header__bar';

/** Textelement zum Treffer: Inline-Teile (Markierung, fett …) gehören zum umgebenden Text */
function textHost(el: Element): Element | null {
  if (!isTextElement(el)) return null;
  let node = el;
  while (node.parentElement && node.parentElement !== document.body && isInline(node) && isTextElement(node.parentElement)) {
    node = node.parentElement;
  }
  return node;
}

/** Freie Fläche → nächste sichtbar abgegrenzte Fläche (Karte, Abschnitt …) */
function boxFor(el: Element): Element | null {
  for (let node: Element | null = el; node && node !== document.body; node = node.parentElement) {
    if (node.matches('main, html')) return null;
    if (isWrapper(node)) continue;
    if (node.parentElement?.matches('main') || node.matches(BOXES) || hasBox(node)) return node;
  }
  return null;
}

/**
 * Bestes Element zur Trefferstelle: Text unter dem Mauszeiger → nur dieser Text;
 * Bild → Bild bzw. Galerie; freie Fläche → die Karte, der Abschnitt o. Ä. darum.
 */
export function pickTarget(hit: Element | null): Element | null {
  if (!hit || isUi(hit) || hit === document.body || hit === document.documentElement) return null;
  const block = hit.closest('[data-ub]');
  if (block) return block;
  if (hit.closest('ub-zone')) return null;
  const carousel = hit.closest('[data-carousel]');
  if (carousel) return carousel;
  // Logo in der Kopfzeile immer als Ganzes (Design wählen, eigenes Bild)
  const brand = hit.closest('.site-header__brand');
  if (brand) return brand;
  let el: Element = hit.closest('svg')?.parentElement ?? hit;
  const media = el.closest('img, picture, video');
  if (media) return media.closest('figure, .hero__bg, .page-hero__photo') ?? media.closest('picture') ?? media;
  if (el.matches('.ub-add')) return null;
  const text = textHost(el);
  if (text) return text;
  // Symbol-Hüllen (Icon-Badge) sind eigene Elemente
  if (hit.closest('svg') && hasBox(el)) return el;
  el = boxFor(el) ?? el;
  return el;
}

/** Stehen Nachbarn daneben (Raster, Spalten), liegen „davor/dahinter“ links/rechts – sonst oben/unten */
export function axisOf(el: Element): 'x' | 'y' {
  const r = el.getBoundingClientRect();
  return [...(el.parentElement?.children ?? [])].some((sibling) => {
    if (sibling === el || sibling.tagName === 'UB-ZONE') return false;
    const q = sibling.getBoundingClientRect();
    return q.width > 0 && q.height > 0 && q.top < r.bottom - 4 && q.bottom > r.top + 4 && (q.right <= r.left + 4 || q.left >= r.right - 4);
  })
    ? 'x'
    : 'y';
}

/** Übergeordnetes Element für die Seitenleiste (Hüllen übersprungen) – null an <main>, <body> */
export function parentOf(el: Element): Element | null {
  if (el.matches('[data-ub]')) {
    const block = el.parentElement?.closest('[data-ub]');
    if (block) return block;
  }
  let node = el.parentElement;
  while (node && isWrapper(node)) node = node.parentElement;
  if (!node || node.matches('main, body, html')) return null;
  return node;
}

/** Kette vom obersten Abschnitt bis zum Element (für die Brotkrumen) */
export function chainOf(el: Element): Element[] {
  const chain: Element[] = [];
  for (let node: Element | null = el; node; node = parentOf(node)) chain.unshift(node);
  return chain;
}

/** Kind-Elemente für „Enthält“ und die Ebenen – Hüllen werden aufgelöst, Unsichtbares weggelassen */
export function childItems(el: Element): Element[] {
  if (el.matches('[data-ub]')) {
    return [...el.querySelectorAll('[data-ub]')].filter((child) => child.parentElement?.closest('[data-ub]') === el);
  }
  if (isTextElement(el) || el.matches('[data-carousel], picture, img, svg, select')) return [];
  const out: Element[] = [];
  const visit = (parent: Element) => {
    for (const child of parent.children) {
      if (NO_LIST.has(child.tagName) || isUi(child) || child.matches('[data-ub-ignore], .visually-hidden, .ub-add, [aria-hidden="true"]:not([data-ub])')) continue;
      if (isWrapper(child)) {
        visit(child);
        continue;
      }
      const r = child.getBoundingClientRect();
      if (r.width < 1 && r.height < 1) continue;
      out.push(child);
    }
  };
  visit(el);
  // Eine einzelne, unauffällige Hülle (z. B. Karteninhalt) überspringen – direkt deren Inhalt zeigen
  const only = out[0];
  if (out.length === 1 && !only.matches(BOXES) && !hasBox(only) && !isTextElement(only)) return childItems(only);
  return out;
}

const shorten = (text: string, max = 48) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

/** Kurzer Textauszug für Listen („Für wen wir arbeiten.“) */
export function snippetOf(el: Element): string {
  if (el.matches('[data-carousel]')) return el.getAttribute('data-gallery-label') ?? '';
  if (el.matches('img')) return el.getAttribute('alt') ?? '';
  // Elemente aus dem Baukasten: Texte liegen in einer Zone (für Text-Bearbeitung ausgenommen)
  if (el.closest('[data-ub]')) return shorten((el.textContent ?? '').replace(/\s+/g, ' ').trim());
  const heading = el.matches('section, article, .card, [data-ub]') ? el.querySelector('h1, h2, h3, h4, h5, h6') : null;
  const source = heading ?? el;
  return shorten(
    textNodes(source, 12)
      .map((node) => node.textContent ?? '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

/** Elementart mit Name, Symbol und sinnvollen Einstellungen (Katalog: ./kinds.ts) */
export const kindAt = (el: Element) => kindOf(el, isTextElement(el));

/** Verständlicher Name eines Seitenelements (Elemente aus dem Baukasten benennt der Element-Editor) */
export const nameOf = (el: Element) => kindAt(el).name;

/** Eindeutiger, stabiler Selektor – Kopf- und Fußzeile gelten auf allen Seiten, sonst nur auf dieser Seite */
export function selectorFor(el: Element): string {
  const parts: string[] = [];
  let node: Element | null = el;
  while (node && node !== document.body) {
    const tag = node.tagName.toLowerCase();
    if (node.id && /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(node.id)) {
      parts.unshift(`${tag}#${node.id}`);
      break;
    }
    const classes = [...node.classList].filter((c) => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(c) && !/^(is-|js$|ub-hover|ub-selected)/.test(c));
    let part = tag + classes.map((c) => `.${c}`).join('');
    const parent: Element | null = node.parentElement;
    if (parent) {
      const same = [...parent.children].filter((child) => child.tagName === node!.tagName);
      if (same.length > 1) part += `:nth-of-type(${same.indexOf(node) + 1})`;
    }
    parts.unshift(part);
    node = parent;
  }
  const chain = parts.join(' > ');
  const rooted = node === document.body ? `> ${chain}` : chain;
  return isGlobal(el) ? `body ${rooted}` : `body[data-page="${location.pathname}"] ${rooted}`;
}

/** Kopf- und Fußzeile (und der Rechtshinweis im Startbild) gelten auf allen Seiten */
export const isGlobal = (el: Element) => Boolean(el.closest('.site-header, .site-footer, .hero__legal'));

/** Kleines DOM-Hilfsmittel: h('div', { class: 'x' }, kind1, 'Text') */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | boolean | undefined> = {},
  ...children: (Node | string | null | undefined | false)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (key === 'class') el.className = String(value);
    else el.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children) if (child) el.append(child);
  return el;
}
