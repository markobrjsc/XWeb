/**
 * Bearbeiten-Modus – Bausteine des Einstellungsbereichs, gemeinsam für Seitenelemente (./index.ts) und
 * Elemente aus dem Baukasten (src/scripts/block-editor.ts):
 *  · subsection: einklappbarer Unterabschnitt (Inhalt, Design, Schrift, Abstände, Form, Sichtbarkeit)
 *  · designToggle: Schalter „Hell / Dunkel“ mit Farbmuster
 * Aussehen: src/components/debug/EditMode.astro (.ed-panel, .ed-sub, .ed-design).
 */
export type DesignMode = 'tone' | 'ink' | 'shade';
type Swatch = 'light' | 'gray' | 'dark';

/** Geöffnete Unterabschnitte bleiben beim Wechsel zwischen Elementen offen */
const open = new Set(['Inhalt', 'Design', 'Grundfarben', 'Akzentfarbe – Vorschläge']);

export function subsection(title: string, ...children: (Node | null | false | undefined)[]): HTMLDetailsElement {
  const details = document.createElement('details');
  details.className = 'ed-sub';
  details.open = open.has(title);
  const summary = document.createElement('summary');
  summary.textContent = title;
  const body = document.createElement('div');
  body.className = 'ed-sub__body';
  body.append(...children.filter((child): child is Node => Boolean(child)));
  details.append(summary, body);
  details.addEventListener('toggle', () => (details.open ? open.add(title) : open.delete(title)));
  return details;
}

const HINTS: Record<DesignMode, string> = {
  tone: 'Hintergrund und Schrift des Elements.',
  ink: 'Helle oder dunkle Schrift – passend zum Hintergrund.',
  shade: 'Bild aufhellen oder abdunkeln.',
};

/**
 * Schalter Hell/Dunkel. Ohne eigene `options` gilt „light“/„dark“, ein zweiter Klick auf die aktive Wahl
 * stellt den Standard der Seite wieder her (onChange('')).
 */
export function designToggle(opts: {
  mode: DesignMode;
  value: string;
  onChange: (value: string) => void;
  options?: [value: string, label: string, swatch: Swatch][];
}): HTMLElement {
  const options = opts.options ?? [
    ['light', 'Hell', 'light'],
    ['dark', 'Dunkel', 'dark'],
  ];
  const optional = !opts.options;
  let value = opts.value;
  const bar = document.createElement('div');
  bar.className = 'ed-design';
  bar.dataset.mode = opts.mode;
  const sync = () => bar.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === value)));
  for (const [option, label, swatch] of options) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ed-design__opt';
    b.dataset.value = option;
    const chip = document.createElement('span');
    chip.className = `ed-design__chip ed-design__chip--${swatch}`;
    chip.setAttribute('aria-hidden', 'true');
    if (opts.mode === 'ink') chip.textContent = 'Aa';
    const text = document.createElement('span');
    text.textContent = label;
    b.append(chip, text);
    b.addEventListener('click', (event) => {
      event.preventDefault();
      if (value === option && !optional) return;
      value = value === option ? '' : option;
      sync();
      opts.onChange(value);
    });
    bar.append(b);
  }
  sync();
  const hint = document.createElement('small');
  hint.className = 'ed-note';
  hint.textContent = optional ? `${HINTS[opts.mode]} Nochmals anklicken = Standard.` : HINTS[opts.mode];
  const wrap = document.createElement('div');
  wrap.className = 'ed-field';
  const title = document.createElement('span');
  title.textContent = 'Design';
  wrap.append(title, bar, hint);
  return wrap;
}
