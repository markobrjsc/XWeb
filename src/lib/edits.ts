/**
 * Text-Bearbeitungen aus dem Bearbeiten-Modus der Website (src/components/debug/EditMode.astro).
 *
 * Gespeichert in src/content/edits.json als „ursprünglicher Text → neuer Text“:
 *   { "global": { "Alter Text": "Neuer Text" },          ← Header/Footer, gilt auf allen Seiten
 *     "pages":  { "/leistungen/": { "Alt": "Neu" } } }    ← nur auf dieser Seite
 *
 * Beim Build ersetzt src/middleware.ts jeden Textabschnitt im HTML, dessen Inhalt (Leerraum
 * zusammengefasst) einem Schlüssel entspricht. Neue Texte werden immer als reiner Text eingesetzt.
 */
import edits from '@/content/edits.json';
import { normalizeText } from './text';

export { normalizeText };

export type EditMap = Record<string, string>;
export type EditsFile = { global: EditMap; pages: Record<string, EditMap> };

const decodeEntities = (text: string) =>
  text
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&amp;/g, '&');

const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Alle Bearbeitungen, die auf einer Seite gelten (Seite überschreibt global) */
export function editsForPage(path: string): Map<string, string> {
  const file = edits as EditsFile;
  return new Map([...Object.entries(file.global ?? {}), ...Object.entries(file.pages?.[path] ?? {})]);
}

/** Bearbeitungen in fertiges HTML einsetzen – nur in Textabschnitten, nie in Skripten, Styles oder Attributen */
export function applyEdits(html: string, path: string): string {
  const map = editsForPage(path);
  if (map.size === 0) return html;

  // Skript- und Style-Blöcke unangetastet lassen
  return html
    .split(/(<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>)/i)
    .map((part, index) => {
      if (index % 2 === 1) return part;
      return part.replace(/>([^<>]+)</g, (match, raw: string) => {
        const key = normalizeText(decodeEntities(raw));
        if (!key || !map.has(key)) return match;
        // Leerraum am Rand erhalten, damit Wortabstände zu Nachbar-Elementen bleiben
        const lead = /^\s/.test(raw) ? ' ' : '';
        const trail = /\s$/.test(raw) ? ' ' : '';
        return `>${lead}${escapeHtml(map.get(key) ?? '')}${trail}<`;
      });
    })
    .join('');
}
