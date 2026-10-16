/**
 * Bearbeiten-Modus – Texte der Seite.
 * Beim Start wird jeder Textabschnitt mit seinem Original gemerkt; geändert wird in der Seitenleiste. Änderungen
 * landen als „Original → neuer Text“ in den Vormerkungen (./pending.ts) – Kopf- und Fußzeile für alle Seiten, sonst
 * für diese Seite – und werden auf jeder Seite wieder eingesetzt. Mit „Speichern“ → src/content/edits.json
 * (eingesetzt von src/middleware.ts).
 */
import { TEXT_SKIP, isGlobal } from './dom';
import { pending, type TextChange } from './pending';

type Tracked = { node: Text; original: string; scope: 'global' | 'page' };

const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();

/** Neuer Text – Leerraum am Rand bleibt erhalten, damit Wortabstände zu Nachbar-Elementen stimmen */
function setText(node: Text, value: string) {
  const current = node.textContent ?? '';
  const lead = /^\s/.test(current) ? ' ' : '';
  const trail = /\s$/.test(current) ? ' ' : '';
  node.textContent = `${lead}${value.replace(/\s+/g, ' ').trim()}${trail}`;
}

export function createTexts() {
  let tracked = new Map<Text, Tracked>();
  const page = () => location.pathname;

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

  /** Änderungen auf dieser Seite */
  const changes = (): TextChange[] => {
    const list: TextChange[] = [];
    for (const { node, original, scope } of tracked.values()) {
      // Nicht mehr auf der Seite (z. B. durch eine Vorschau ersetzt): keine Änderung – sonst würde der Text beim
      // Speichern überall durch „leer“ ersetzt
      if (!node.isConnected) continue;
      const from = normalize(original);
      const to = normalize(node.textContent ?? '');
      if (from !== to && !list.some((change) => change.scope === scope && change.from === from)) list.push({ scope, page: page(), from, to });
    }
    return list;
  };

  /** Vormerkungen mit dem Stand dieser Seite abgleichen (Texte anderer Seiten bleiben, wie sie sind) */
  const sync = () => {
    const globalsHere = new Set([...tracked.values()].filter((entry) => entry.scope === 'global').map((entry) => normalize(entry.original)));
    const current = changes();
    pending.update((draft) => {
      draft.texts = draft.texts.filter((change) => (change.scope === 'page' ? change.page !== page() : !globalsHere.has(change.from)));
      draft.texts.push(...current);
    });
  };

  return {
    collect,
    /** Vorgemerkte Texte dieser Seite (und der Kopf-/Fußzeile) einsetzen – das Original bleibt der Ausgangspunkt */
    applyPending() {
      const list = pending.get().texts.filter((change) => change.scope === 'global' || change.page === page());
      if (!list.length) return;
      for (const { node, original, scope } of tracked.values()) {
        const change = list.find((item) => item.scope === scope && item.from === normalize(original));
        if (change) setText(node, change.to);
      }
    },
    /** Wird dieser Text gespeichert? (Texte in Galerien, Zählern usw. nicht) */
    has: (node: Text) => tracked.has(node),
    set(node: Text, value: string) {
      setText(node, value);
      sync();
    },
    changed: (node: Text) => {
      const entry = tracked.get(node);
      return Boolean(entry && normalize(entry.original) !== normalize(node.textContent ?? ''));
    },
  };
}
