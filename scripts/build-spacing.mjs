/**
 * Gestaltung aus dem Bearbeiten-Modus (src/content/spacing.json) in CSS übersetzen.
 * Läuft automatisch vor `npm run dev`, `npm run build` und `npm run check`.
 *
 * spacing.json: { "<CSS-Selektor>": { "margin-top": "24px", "color": "#ffffff", "tone": "dark", "hide": "mobile", … } }
 * Ausgabe:      src/styles/custom-spacing.css (wird von global.css eingebunden)
 *
 * Erlaubte Eigenschaften und Werte: gleiche Regeln wie worker/edit.ts (STYLE_PROPS).
 * „tone“ / „ink“ / „shade“ (light | dark) sind das Design Hell/Dunkel – Fläche, Schrift bzw. Bild (src/lib/tone-css.mjs).
 * „hide“ blendet aus (all | mobile | desktop) – im Bearbeiten-Modus bleibt das Element abgeblendet sichtbar.
 */
import fs from 'node:fs';
import { designCss } from '../src/lib/tone-css.mjs';

const SOURCE = 'src/content/spacing.json';
const TARGET = 'src/styles/custom-spacing.css';
const LENGTH = /^(-?\d{1,4}(\.\d{1,3})?(px|rem|em|%)|0|auto)$/;
const COLOR = /^(#[0-9a-f]{6}|transparent)$/i;
const PROPS = {
  'margin-top': LENGTH,
  'margin-right': LENGTH,
  'margin-bottom': LENGTH,
  'margin-left': LENGTH,
  'padding-top': LENGTH,
  'padding-right': LENGTH,
  'padding-bottom': LENGTH,
  'padding-left': LENGTH,
  color: COLOR,
  'background-color': COLOR,
  'font-size': /^\d{1,3}(\.\d{1,2})?(px|rem)$/,
  'font-weight': /^[1-9]00$/,
  'text-align': /^(left|center|right|justify)$/,
  'border-radius': /^\d{1,4}(px|%)$/,
  'max-width': /^(\d{1,4}px|none)$/,
  gap: LENGTH,
};
const HIDE = { all: '', mobile: '(max-width: 47.99rem)', desktop: '(min-width: 48rem)' };
const SELECTOR = /^[a-zA-Z0-9\s\-_.#[\]="/:>()*,]{1,500}$/;

const data = fs.existsSync(SOURCE) ? JSON.parse(fs.readFileSync(SOURCE, 'utf8')) : {};
const rules = [];
for (const [selector, props] of Object.entries(data)) {
  if (!SELECTOR.test(selector)) continue;
  // Design zuerst – eigene Farben (color, background-color) gehen vor
  const design = designCss(selector, props ?? {});
  if (design) rules.push(design);
  const lines = Object.entries(props ?? {})
    .filter(([prop, value]) => PROPS[prop]?.test(String(value)))
    .map(([prop, value]) => `  ${prop}: ${value} !important;`);
  if (lines.length) rules.push(`${selector} {\n${lines.join('\n')}\n}`);

  const hide = props?.hide;
  if (hide in HIDE) {
    const hidden = `html:not(.is-editing) ${selector} {\n  display: none !important;\n}`;
    rules.push(HIDE[hide] ? `@media ${HIDE[hide]} {\n${hidden}\n}` : hidden);
    rules.push(`html.is-editing ${selector} {\n  opacity: 0.4 !important;\n}`);
  }
}

const css =
  '/* Automatisch erzeugt aus src/content/spacing.json (Bearbeiten-Modus → Gestaltung) – nicht von Hand ändern. */\n' +
  (rules.length ? `${rules.join('\n\n')}\n` : '');
fs.writeFileSync(TARGET, css);
console.log(`Gestaltung: ${rules.length} Regel(n)`);
