/**
 * Bearbeiten-Modus – Gestaltung einzelner Seitenelemente: Design Hell/Dunkel, Abstände, Farben, Schrift, Ecken,
 * Breite, Lücke, Ausblenden. Vorschau sofort (Inline-Style bzw. für das Design dieselben Regeln wie beim Build);
 * vorgemerkt je CSS-Selektor (./pending.ts – Selektoren enthalten die Seite, gelten also nur dort), mit „Speichern“
 * → src/content/spacing.json, beim Build zu src/styles/custom-spacing.css (scripts/build-spacing.mjs – dort auch die
 * erlaubten Werte).
 */
import { designCss } from '@/lib/tone-css.mjs';
import { selectorFor } from './dom';
import { pending } from './pending';

export type StyleProp =
  | 'margin-top'
  | 'margin-right'
  | 'margin-bottom'
  | 'margin-left'
  | 'padding-top'
  | 'padding-right'
  | 'padding-bottom'
  | 'padding-left'
  | 'color'
  | 'background-color'
  | 'font-size'
  | 'font-weight'
  | 'text-align'
  | 'border-radius'
  | 'max-width'
  | 'gap'
  | 'tone'
  | 'ink'
  | 'shade'
  | 'hide';

type Rules = Record<string, Record<string, string>>;

/** Design Hell/Dunkel – kein CSS-Wert, sondern ein Satz Regeln (src/lib/tone-css.mjs) */
const DESIGN = new Set(['tone', 'ink', 'shade']);

export function createStyles() {
  /** Gespeicherter Stand (aus GitHub) */
  let saved: Rules = {};
  const changes = () => pending.get().styles;
  /** Vorschau des Designs: gleiche Regeln wie beim Build, als CSSOM-Stylesheet (von der CSP erlaubt) */
  const sheet = new CSSStyleSheet();
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];

  /** Stand je Selektor: gespeichert + vorgemerkte Änderungen */
  const merged = (key: string): Record<string, string> => {
    if (!(key in changes())) return { ...(saved[key] ?? {}) };
    const change = changes()[key];
    if (change === null) return {};
    const next = { ...(saved[key] ?? {}) };
    for (const [prop, value] of Object.entries(change)) {
      if (value) next[prop] = value;
      else delete next[prop];
    }
    return next;
  };

  // Wie beim Build (scripts/build-spacing.mjs): Design zuerst, eigene Farben gehen vor – sonst überdeckt die
  // Vorschau z. B. die eigene Hintergrundfarbe einer „hell“ gesetzten Kopfzeile
  const updateDesign = () => {
    const keys = new Set([...Object.keys(saved), ...Object.keys(changes())]);
    const css = [...keys].map((key) => {
      const props = merged(key);
      const design = designCss(key, props);
      const own = ['color', 'background-color'].filter((prop) => props[prop]).map((prop) => `  ${prop}: ${props[prop]} !important;`);
      return design && own.length ? `${design}\n${key} {\n${own.join('\n')}\n}` : design;
    });
    sheet.replaceSync(css.join('\n'));
  };

  const preview = (el: Element, prop: string, value: string | null) => {
    const target = el as HTMLElement;
    if (DESIGN.has(prop)) updateDesign();
    else if (prop === 'hide') {
      if (value) target.dataset.edHide = value;
      else delete target.dataset.edHide;
    } else if (value) target.style.setProperty(prop, value, 'important');
    else target.style.removeProperty(prop);
  };

  return {
    async load() {
      try {
        const result = await (await fetch('/api/edit/abstaende/')).json();
        if (result?.ok) saved = result.rules ?? {};
      } catch {
        /* ohne gespeicherte Werte weiterarbeiten */
      }
      updateDesign();
    },
    /** Vorgemerkte Gestaltung auf dieser Seite zeigen */
    applyPending() {
      for (const [key, change] of Object.entries(changes())) {
        let elements: Element[] = [];
        try {
          elements = [...document.querySelectorAll(key)];
        } catch {
          continue;
        }
        const props = change === null ? Object.keys(saved[key] ?? {}) : Object.keys(change);
        const values = merged(key);
        for (const el of elements) for (const prop of props) preview(el, prop, values[prop] ?? null);
      }
      updateDesign();
    },
    /** Eigener Wert (vorgemerkt oder gespeichert) – leer = Standard der Seite */
    value(el: Element, prop: StyleProp): string {
      return merged(selectorFor(el))[prop] ?? '';
    },
    set(el: Element, prop: StyleProp, value: string | null) {
      const key = selectorFor(el);
      pending.update((draft) => {
        const current = draft.styles[key];
        // Nach „zurücksetzen“ zählen die gespeicherten Werte als entfernt
        const base = current === null ? Object.fromEntries(Object.keys(saved[key] ?? {}).map((name) => [name, null])) : (current ?? {});
        draft.styles[key] = { ...base, [prop]: value };
      });
      preview(el, prop, value);
    },
    /** Alle eigenen Werte des Elements entfernen */
    reset(el: Element) {
      const key = selectorFor(el);
      const props = new Set([...Object.keys(saved[key] ?? {}), ...Object.keys(changes()[key] ?? {})]);
      pending.update((draft) => {
        draft.styles[key] = null;
      });
      for (const prop of props) preview(el, prop, null);
      updateDesign();
    },
    hasOwn: (el: Element) => Object.keys(merged(selectorFor(el))).length > 0,
    /** Nach dem Speichern: vorgemerkte Werte gelten als gespeichert (die Vorschau bleibt bis zum Build stehen) */
    committed() {
      for (const key of Object.keys(changes())) {
        const next = merged(key);
        if (Object.keys(next).length) saved[key] = next;
        else delete saved[key];
      }
    },
  };
}
