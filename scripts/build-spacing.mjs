/**
 * Abstände aus dem Bearbeiten-Modus (src/content/spacing.json) in CSS übersetzen.
 * Läuft automatisch vor `npm run dev`, `npm run build` und `npm run check`.
 *
 * spacing.json: { "<CSS-Selektor>": { "margin-top": "24px", "padding-left": "1rem", … } }
 * Ausgabe:      src/styles/custom-spacing.css (wird von global.css eingebunden)
 */
import fs from 'node:fs';

const SOURCE = 'src/content/spacing.json';
const TARGET = 'src/styles/custom-spacing.css';
const PROPS = new Set([
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
]);
const SELECTOR = /^[a-zA-Z0-9\s\-_.#[\]="/:>()*,]{1,500}$/;
const VALUE = /^(-?\d{1,4}(\.\d{1,3})?(px|rem|em|%)|0|auto)$/;

const data = fs.existsSync(SOURCE) ? JSON.parse(fs.readFileSync(SOURCE, 'utf8')) : {};
const rules = Object.entries(data)
  .filter(([selector]) => SELECTOR.test(selector))
  .map(([selector, props]) => {
    const lines = Object.entries(props ?? {})
      .filter(([prop, value]) => PROPS.has(prop) && VALUE.test(String(value)))
      .map(([prop, value]) => `  ${prop}: ${value} !important;`);
    return lines.length ? `${selector} {\n${lines.join('\n')}\n}` : '';
  })
  .filter(Boolean);

const css =
  '/* Automatisch erzeugt aus src/content/spacing.json (Bearbeiten-Modus → Abstände) – nicht von Hand ändern. */\n' +
  (rules.length ? `${rules.join('\n\n')}\n` : '');
fs.writeFileSync(TARGET, css);
console.log(`Abstände: ${rules.length} Regel(n)`);
