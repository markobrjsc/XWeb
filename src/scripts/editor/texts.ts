/**
 * Bearbeiten-Modus – Texte der Seite.
 * Beim Start wird jeder Textabschnitt mit seinem Original gemerkt; geändert wird in der Seitenleiste.
 * Gespeichert als „Original → neuer Text“ (POST /api/edit/texte/ → src/content/edits.json, eingesetzt von src/middleware.ts).
 */
import { TEXT_SKIP, isGlobal } from './dom';

type Tracked = { node: Text; original: string; scope: 'global' | 'page' };
export type TextChange = { scope: 'global' | 'page'; from: string; to: string };

const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();

export function createTexts() {
  let tracked = new Map<Text, Tracked>();

  const collect = () => {
    tracked = new Map();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) =>
        normalize(node.textContent ?? '') && !node.parentElement?.closest(TEXT_SKIP) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
    });
    for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
      tracked.set(node, { node, original: node.textContent ?? '', scope: isGlobal(node.parentElement!) ? 'global' : 'page' });
    }
  };

  const changes = (): TextChange[] => {
    const list: TextChange[] = [];
    for (const { node, original, scope } of tracked.values()) {
      // Nicht mehr auf der Seite (z. B. durch eine Vorschau ersetzt): keine Änderung – sonst würde der Text beim
      // Speichern überall durch „leer“ ersetzt
      if (!node.isConnected) continue;
      const from = normalize(original);
      const to = normalize(node.textContent ?? '');
      if (from !== to) list.push({ scope, from, to });
    }
    return list;
  };

  return {
    collect,
    changes,
    /** Wird dieser Text gespeichert? (Texte in Galerien, Zählern usw. nicht) */
    has: (node: Text) => tracked.has(node),
    /** Neuer Text – Leerraum am Rand bleibt erhalten, damit Wortabstände zu Nachbar-Elementen stimmen */
    set(node: Text, value: string) {
      const current = node.textContent ?? '';
      const lead = /^\s/.test(current) ? ' ' : '';
      const trail = /\s$/.test(current) ? ' ' : '';
      node.textContent = `${lead}${value.replace(/\s+/g, ' ').trim()}${trail}`;
    },
    changed: (node: Text) => {
      const entry = tracked.get(node);
      return Boolean(entry && normalize(entry.original) !== normalize(node.textContent ?? ''));
    },
    discard() {
      for (const { node, original } of tracked.values()) if (node.isConnected) node.textContent = original;
    },
    async save() {
      const list = changes();
      if (!list.length) return 0;
      const response = await fetch('/api/edit/texte/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: location.pathname, changes: list }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || 'Texte konnten nicht gespeichert werden.');
      // Gespeicherter Stand ist der neue Ausgangspunkt
      collect();
      return list.length;
    },
  };
}
