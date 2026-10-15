// @ts-check
/**
 * Baut das Schriftband-Logo für helle (z. B. gelbe) Kopfzeilen: Maskottchen aus dem bisherigen Logo,
 * Schriftzug „HILDEBRAND“ und „Pflasterarbeiten GmbH“ neu als saubere Vektorpfade aus der Hausschrift Archivo.
 * (Der Schriftzug im alten Logo ist aus einem Pixelbild nachgezeichnet – wellige Kanten, unscharfe Unterzeile.)
 *
 * Ausgabe: src/assets/brand/hildebrand-logo-ohne-band-hell.svg (genutzt von HeaderLogo.astro)
 * Aufruf:  node scripts/build-logo-schrift.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { create } from 'fontkitten';

const SOURCE = 'src/assets/brand/hildebrand-logo-ohne-band.svg';
const TARGET = 'src/assets/brand/hildebrand-logo-ohne-band-hell.svg';
const FONT = 'node_modules/@fontsource-variable/archivo/files/archivo-latin-standard-normal.woff2';
const INK = '#0b0b0c';

// Maße im Koordinatensystem des alten Logos (Höhe 288.8) – so passt das Seitenverhältnis in HeaderLogo.astro weiter
const HEIGHT = 288.8;
const TEXT_X = 252;
const NAME = { text: 'HILDEBRAND', wdth: 62, wght: 850, cap: 118, baseline: 196, tracking: 0.03 };
const SUB = { text: 'Pflasterarbeiten GmbH', wdth: 100, wght: 650, cap: 33, gap: 26 };

const buffer = readFileSync(FONT);
const base = create(buffer);

/**
 * Schnitt mit Breite/Stärke. fontkitten kann das bei WOFF2 nicht selbst (getVariation liest die komprimierten Tabellen
 * falsch, und WOFF2-Glyphen überspringen die Variation) – daher Schrift mit Koordinaten neu anlegen und die
 * Glyphenpunkte hier verschieben.
 */
function variation(/** @type {Record<string, number>} */ settings) {
  const Stream = /** @type {any} */ (base).stream.constructor;
  const Font = /** @type {any} */ (base).constructor;
  const coords = /** @type {any} */ (base).fvar.axis.map((/** @type {any} */ a) => settings[a.axisTag.trim()] ?? a.defaultValue);
  return new Font(new Stream(new Uint8Array(buffer)), coords);
}

{
  const proto = Object.getPrototypeOf(base.glyphsForString('H')[0]);
  const decode = proto._decode;
  const clone = (/** @type {any} */ p, o = {}) => Object.assign(Object.create(Object.getPrototypeOf(p)), p, o);
  proto._decode = function () {
    const glyph = decode.call(this);
    const processor = this._font._variationProcessor;
    if (!glyph?.points?.length || !processor) return glyph;
    const points = glyph.points.map((/** @type {any} */ p) => clone(p));
    // vier Phantompunkte (Laufweite) – deren Verschiebung übernimmt HVAR, hier nur Platzhalter
    const phantom = [0, 1, 2, 3].map(() => clone(points[0], { x: 0, y: 0, onCurve: false, endContour: true }));
    const all = [...points, ...phantom];
    processor.transformPoints(this.id, all);
    return clone(glyph, { points: all.slice(0, points.length) });
  };
}

/** Pfade eines Textes; tracking als Anteil der Versalhöhe, spread verteilt Restbreite auf die Zwischenräume */
function textPaths(/** @type {{ text: string; wdth: number; wght: number; cap: number; tracking?: number }} */ o, x, baseline, spread = 0) {
  const font = variation({ wdth: o.wdth, wght: o.wght });
  const scale = o.cap / base.capHeight;
  const glyphs = font.glyphsForString(o.text);
  const tracking = (o.tracking ?? 0) * o.cap;
  let pen = x;
  let out = '';
  glyphs.forEach((g, i) => {
    const d = g.path.toSVG();
    if (d) out += `<path transform="translate(${pen.toFixed(2)} ${baseline}) scale(${scale.toFixed(5)} ${(-scale).toFixed(5)})" d="${d}"/>`;
    pen += g.advanceWidth * scale + tracking + (i < glyphs.length - 1 ? spread : 0);
  });
  return { out, width: pen - x - tracking };
}

const name = textPaths(NAME, TEXT_X, NAME.baseline);
// Unterzeile genauso breit wie „HILDEBRAND“: Restbreite gleichmäßig zwischen die Buchstaben
const subNatural = textPaths(SUB, 0, 0);
const spread = (name.width - subNatural.width) / (SUB.text.length - 1);
const subBaseline = NAME.baseline + SUB.gap + SUB.cap;
const sub = textPaths(SUB, TEXT_X, subBaseline, spread);

// Maskottchen: alle Pfade des alten Logos bis auf die drei des Schriftzugs (Kontur, Füllung, Unterzeile)
const svg = readFileSync(SOURCE, 'utf8');
const paths = [...svg.matchAll(/<path[^>]*\/>/g)].map((m) => m[0]);
const mascot = paths.slice(0, -3).join('');

const width = Math.ceil(TEXT_X + name.width + 4);
const result =
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${HEIGHT}" viewBox="0 0 ${width} ${HEIGHT}">` +
  `<title>Hildebrand Pflasterarbeiten GmbH</title>${mascot}<g fill="${INK}">${name.out}${sub.out}</g></svg>`;

writeFileSync(TARGET, result);
console.log(`${TARGET}: ${width} × ${HEIGHT}, ${(result.length / 1024).toFixed(0)} KB`);
