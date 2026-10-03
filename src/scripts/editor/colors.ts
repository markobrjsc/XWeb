/**
 * Bearbeiten-Modus – Grundfarben der Website (Reiter „Farben“).
 * Aus wenigen Grundfarben werden alle abhängigen Töne berechnet (Akzent-Abstufungen, dunkle Flächen, Schrift auf
 * dem Akzent …) und sofort als Vorschau auf :root gesetzt – jedes Element, das die Farben über var(--…) nutzt,
 * passt sich mit an. Gespeichert über den gemeinsamen Knopf: POST /api/edit/farben/ → src/styles/custom-colors.css.
 */

export type BaseColor = { name: string; label: string; hint: string; fallback: string };

/** Einstellbare Grundfarben – Standardwerte wie in src/styles/tokens.css */
export const BASE_COLORS: BaseColor[] = [
  { name: '--yellow-500', label: 'Akzentfarbe', hint: 'Buttons, Markierungen, Symbole, Linien', fallback: '#f3a505' },
  { name: '--onyx-950', label: 'Dunkel', hint: 'Überschriften, dunkle Abschnitte und Karten', fallback: '#0b0b0c' },
  { name: '--onyx-800', label: 'Dunkel 2', hint: 'Zweite dunkle Fläche, Farbwelt „Marke“', fallback: '#19191a' },
  { name: '--onyx-600', label: 'Grundton', hint: 'Aktive Reiter, Symbolflächen, Hauptfarbe', fallback: '#2c2c2d' },
  { name: '--gray-50', label: 'Heller Hintergrund', hint: 'Hellgraue Abschnitte und Flächen', fallback: '#f7f7f6' },
];

/** Vorschläge für die Akzentfarbe */
export const ACCENT_PRESETS: [string, string][] = [
  ['RAL 1018 Zinkgelb', '#f3a505'],
  ['Signalorange', '#ea6b0c'],
  ['Ziegelrot', '#b8402c'],
  ['Grün', '#3f8f3a'],
  ['Petrol', '#1f6f78'],
  ['Blau', '#2563c9'],
];

const hexToRgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const rgbToHex = (rgb: number[]) => `#${rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;
const mix = (hex: string, target: string, amount: number) => {
  const a = hexToRgb(hex);
  const b = hexToRgb(target);
  return rgbToHex(a.map((v, i) => v + (b[i] - v) * amount));
};

/** Relative Helligkeit (WCAG) */
export const luminance = (hex: string) => {
  const [r, g, b] = hexToRgb(hex).map((c) => c / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** Aus den Grundfarben alle abhängigen Töne berechnen (gleiche Namen wie in tokens.css) */
export function derive(base: Record<string, string>): Record<string, string> {
  const accent = base['--yellow-500'];
  const dark = base['--onyx-950'];
  // Schrift auf der Akzentfarbe: dunkel auf hellen, weiß auf kräftigen/dunklen Tönen
  const onAccent = contrast(accent, dark) >= contrast(accent, '#ffffff') ? dark : '#ffffff';
  return {
    ...base,
    '--yellow-50': mix(accent, '#ffffff', 0.9),
    '--yellow-100': mix(accent, '#ffffff', 0.75),
    '--yellow-300': mix(accent, '#ffffff', 0.35),
    '--yellow-600': mix(accent, '#000000', 0.1),
    '--yellow-700': mix(accent, '#000000', 0.45),
    '--onyx-900': mix(dark, '#ffffff', 0.03),
    '--ink': hexToRgb(dark).join(' '),
    '--color-cta-fg': onAccent,
    '--color-highlight': onAccent,
  };
}

const toHex = (value: string) => {
  const v = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase();
  const probe = document.createElement('span');
  probe.style.color = v;
  document.body.append(probe);
  const rgb = getComputedStyle(probe).color.match(/\d+/g)?.slice(0, 3).map(Number) ?? [0, 0, 0];
  probe.remove();
  return rgbToHex(rgb);
};

export function createColors() {
  const root = document.documentElement;
  const defaults = Object.fromEntries(BASE_COLORS.map((c) => [c.name, c.fallback]));
  /** Gespeicherter Stand (aus custom-colors.css bzw. tokens.css beim Laden der Seite) */
  let saved: Record<string, string> = {};
  let current: Record<string, string> = {};
  let previewed: string[] = [];

  const read = () => {
    const styles = getComputedStyle(root);
    return Object.fromEntries(BASE_COLORS.map((c) => [c.name, toHex(styles.getPropertyValue(c.name) || c.fallback)]));
  };

  const apply = () => {
    for (const name of previewed) root.style.removeProperty(name);
    previewed = [];
    if (!dirty()) return;
    for (const [name, value] of Object.entries(derive(current))) {
      root.style.setProperty(name, value);
      previewed.push(name);
    }
  };

  const dirty = () => BASE_COLORS.some((c) => current[c.name] !== saved[c.name]);

  return {
    load() {
      saved = read();
      current = { ...saved };
    },
    value: (name: string) => current[name] ?? saved[name] ?? defaults[name],
    set(name: string, value: string) {
      current = { ...current, [name]: value.toLowerCase() };
      apply();
    },
    /** Alle Grundfarben auf die Werte aus tokens.css (Vorschau, Speichern übernimmt) */
    resetToDefaults() {
      current = { ...defaults };
      apply();
    },
    isDefault: () => BASE_COLORS.every((c) => current[c.name] === defaults[c.name]),
    dirty,
    discard() {
      current = { ...saved };
      apply();
    },
    async save() {
      if (!dirty()) return;
      const isDefault = BASE_COLORS.every((c) => current[c.name] === defaults[c.name]);
      const response = await fetch('/api/edit/farben/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colors: isDefault ? {} : derive(current) }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || 'Farben konnten nicht gespeichert werden.');
      // Vorschau bleibt stehen, bis der Build die Farben übernommen hat
      saved = { ...current };
      previewed = [];
    },
  };
}
