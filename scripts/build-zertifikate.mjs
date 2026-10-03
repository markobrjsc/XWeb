/**
 * Zertifikate vorbereiten – läuft automatisch vor `npm run dev` und `npm run build`.
 *
 * Neues Zertifikat: PDF in src/assets/zertifikate/ legen (Dateiname = Kennung, z. B. zertifikat-3.pdf),
 * optional Titel/Aussteller/Jahr in src/assets/zertifikate/zertifikate.json eintragen. Fertig.
 * Im Bearbeiten-Modus lassen sich PDFs hochladen, sortieren und ausblenden (Zertifikate anklicken):
 * Reihenfolge der Einträge in zertifikate.json = Reihenfolge auf der Seite, "hidden": true blendet aus.
 *
 * Erzeugt (nicht eingecheckt):
 *  · src/assets/zertifikate/_seiten/<name>-<seite>.png  – jede PDF-Seite als Bild (Vorschau + Großansicht)
 *  · src/assets/zertifikate/_seiten/manifest.json       – Liste für die Website
 *  · public/zertifikate/<name>.pdf                       – Original zum Herunterladen
 */
import fs from 'node:fs';
import path from 'node:path';
import * as mupdf from 'mupdf';

const SOURCE = 'src/assets/zertifikate';
const OUT = path.join(SOURCE, '_seiten');
const PUBLIC = 'public/zertifikate';
/** Breite der gerenderten Seiten in Pixel – reicht für die Großansicht auf großen Bildschirmen */
const TARGET_WIDTH = 1800;

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(PUBLIC, { recursive: true });

const infoFile = path.join(SOURCE, 'zertifikate.json');
const info = fs.existsSync(infoFile) ? JSON.parse(fs.readFileSync(infoFile, 'utf8')) : {};

const pdfs = fs
  .readdirSync(SOURCE)
  .filter((file) => file.toLowerCase().endsWith('.pdf'))
  .sort((a, b) => a.localeCompare(b, 'de', { numeric: true }));

const manifest = [];
for (const file of pdfs) {
  const name = file.replace(/\.pdf$/i, '').toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  const source = path.join(SOURCE, file);
  const doc = mupdf.Document.openDocument(fs.readFileSync(source), 'application/pdf');
  const pages = [];

  for (let index = 0; index < doc.countPages(); index++) {
    const page = doc.loadPage(index);
    const [x0, y0, x1, y1] = page.getBounds();
    const scale = TARGET_WIDTH / (x1 - x0);
    const pixmap = page.toPixmap(mupdf.Matrix.scale(scale, scale), mupdf.ColorSpace.DeviceRGB, false, true);
    const image = `${name}-${index + 1}.png`;
    const target = path.join(OUT, image);
    // Nur neu rendern, wenn das PDF neuer ist als das Bild
    if (!fs.existsSync(target) || fs.statSync(target).mtimeMs < fs.statSync(source).mtimeMs) {
      fs.writeFileSync(target, pixmap.asPNG());
    }
    pages.push({ image, width: pixmap.getWidth(), height: pixmap.getHeight() });
  }

  fs.copyFileSync(source, path.join(PUBLIC, `${name}.pdf`));
  const meta = info[name] ?? {};
  manifest.push({
    name,
    title: meta.title ?? doc.getMetaData('info:Title') ?? name,
    issuer: meta.issuer ?? '',
    year: meta.year ?? '',
    pdf: `/zertifikate/${name}.pdf`,
    hidden: meta.hidden === true,
    pages,
  });
}

// Reihenfolge wie in zertifikate.json, neue (dort noch nicht eingetragene) PDFs danach
const order = Object.keys(info);
const rank = (name) => (order.includes(name) ? order.indexOf(name) : Number.MAX_SAFE_INTEGER);
manifest.sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name, 'de', { numeric: true }));

fs.writeFileSync(path.join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Zertifikate: ${manifest.length} vorbereitet (${manifest.map((m) => m.name).join(', ') || '–'})`);
