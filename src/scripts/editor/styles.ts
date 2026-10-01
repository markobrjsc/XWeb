/**
 * Bearbeiten-Modus – Gestaltung einzelner Seitenelemente: Abstände, Farben, Schrift, Ecken, Breite, Ausblenden.
 * Vorschau sofort per Inline-Style; gespeichert je CSS-Selektor (POST /api/edit/abstaende/ → src/content/spacing.json,
 * beim Build zu src/styles/custom-spacing.css, siehe scripts/build-spacing.mjs – dort auch die erlaubten Werte).
 */
import { selectorFor } from './dom';

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
  | 'hide';

type Rules = Record<string, Record<string, string>>;

export function createStyles() {
  let saved: Rules = {};
  /** Selektor → geänderte Eigenschaften (null = Eigenschaft entfernen) bzw. null = alles zurücksetzen */
  const pending = new Map<string, Record<string, string | null> | null>();
  /** Für „Verwerfen“: Elemente mit Vorschau-Styles */
  const touched = new Map<Element, Set<string>>();

  const preview = (el: Element, prop: string, value: string | null) => {
    const target = el as HTMLElement;
    if (prop === 'hide') {
      if (value) target.dataset.edHide = value;
      else delete target.dataset.edHide;
    } else if (value) target.style.setProperty(prop, value, 'important');
    else target.style.removeProperty(prop);
    if (!touched.has(el)) touched.set(el, new Set());
    touched.get(el)!.add(prop);
  };

  return {
    async load() {
      try {
        const result = await (await fetch('/api/edit/abstaende/')).json();
        if (result?.ok) saved = result.rules ?? {};
      } catch {
        /* ohne gespeicherte Werte weiterarbeiten */
      }
    },
    /** Eigener Wert (geändert oder gespeichert) – leer = Standard der Seite */
    value(el: Element, prop: StyleProp): string {
      const key = selectorFor(el);
      const change = pending.get(key);
      if (change === null) return '';
      if (change && prop in change) return change[prop] ?? '';
      return saved[key]?.[prop] ?? '';
    },
    set(el: Element, prop: StyleProp, value: string | null) {
      const key = selectorFor(el);
      const entry = pending.get(key) ?? {};
      pending.set(key, { ...entry, [prop]: value });
      preview(el, prop, value);
    },
    /** Alle eigenen Werte des Elements entfernen */
    reset(el: Element) {
      const key = selectorFor(el);
      pending.set(key, null);
      for (const prop of touched.get(el) ?? []) preview(el, prop, null);
      for (const prop of Object.keys(saved[key] ?? {})) preview(el, prop, null);
    },
    hasOwn(el: Element) {
      const key = selectorFor(el);
      const change = pending.get(key);
      if (change === null) return false;
      return Boolean(Object.keys(saved[key] ?? {}).length || Object.values(change ?? {}).some(Boolean));
    },
    count: () => pending.size,
    discard() {
      for (const [el, props] of touched) for (const prop of props) preview(el, prop, null);
      touched.clear();
      pending.clear();
    },
    async save() {
      if (!pending.size) return 0;
      const rules = Object.fromEntries(pending);
      const response = await fetch('/api/edit/abstaende/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || 'Gestaltung konnte nicht gespeichert werden.');
      // Gespeicherten Stand übernehmen (gleiche Logik wie im Worker)
      for (const [key, change] of pending) {
        if (change === null) {
          delete saved[key];
          continue;
        }
        const next = { ...(saved[key] ?? {}) };
        for (const [prop, value] of Object.entries(change)) {
          if (value) next[prop] = value;
          else delete next[prop];
        }
        if (Object.keys(next).length) saved[key] = next;
        else delete saved[key];
      }
      const count = pending.size;
      pending.clear();
      // Vorschau bleibt stehen, bis der Build die Werte ins CSS übernommen hat
      touched.clear();
      return count;
    },
  };
}
