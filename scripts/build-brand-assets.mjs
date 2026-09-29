/**
 * Erzeugt Favicons, App-Icons und das quadratische Logo aus dem Firmenlogo.
 *
 *   npm run assets
 *
 * Quelle:  src/assets/brand/hildebrand-maskottchen.svg (Maskottchen mit Stein-„H“, Vektor)
 * Ausgabe: public/favicon.svg, public/favicon.ico, public/apple-touch-icon.png,
 *          public/icon-192.png, public/icon-512.png, public/icon-maskable-512.png,
 *          public/logo-512.png, public/site.webmanifest
 *
 * Nur nötig, wenn sich das Logo ändert – die erzeugten Dateien liegen bereits im Repository.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pub = (file) => path.join(root, 'public', file);
const logoPath = path.join(root, 'src/assets/brand/hildebrand-maskottchen.svg');

const NAVY = '#0b0b0c'; // Onyx
const WHITE = '#ffffff';

/** Monogramm „H“ für kleine Größen (Browser-Tab), wo die Figur nicht mehr erkennbar wäre. */
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="${NAVY}"/>
  <path d="M9 8h3.2v6.4h7.6V8H23v16h-3.2v-6.6h-7.6V24H9z" fill="#f8f32b"/>
</svg>
`;

/** Logo mittig auf weißem Quadrat platzieren. `scale` = Anteil der Höhe, den das Logo einnimmt. */
async function logoOnSquare(size, scale) {
  const logo = await sharp(logoPath, { density: 300 })
    .resize({ height: Math.round(size * scale), fit: 'inside' })
    .toBuffer();
  const meta = await sharp(logo).metadata();
  return sharp({
    create: { width: size, height: size, channels: 4, background: WHITE },
  })
    .composite([
      {
        input: logo,
        left: Math.round((size - meta.width) / 2),
        top: Math.round((size - meta.height) / 2),
      },
    ])
    .flatten({ background: WHITE })
    .png({ compressionLevel: 9 });
}

/** ICO-Datei mit eingebettetem PNG (von allen aktuellen Browsern unterstützt). */
function pngToIco(png, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserviert
  header.writeUInt16LE(1, 2); // Typ: Icon
  header.writeUInt16LE(1, 4); // Anzahl Bilder
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size >= 256 ? 0 : size, 0);
  entry.writeUInt8(size >= 256 ? 0 : size, 1);
  entry.writeUInt8(0, 2); // Palette
  entry.writeUInt8(0, 3); // reserviert
  entry.writeUInt16LE(1, 4); // Farbebenen
  entry.writeUInt16LE(32, 6); // Bit pro Pixel
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(6 + 16, 12);
  return Buffer.concat([header, entry, png]);
}

async function main() {
  await readFile(logoPath); // bricht mit verständlicher Meldung ab, falls das Logo fehlt

  await writeFile(pub('favicon.svg'), faviconSvg);
  const favicon32 = await sharp(Buffer.from(faviconSvg)).resize(32, 32).png().toBuffer();
  await writeFile(pub('favicon.ico'), pngToIco(favicon32, 32));

  await (await logoOnSquare(180, 0.86)).toFile(pub('apple-touch-icon.png'));
  await (await logoOnSquare(192, 0.86)).toFile(pub('icon-192.png'));
  await (await logoOnSquare(512, 0.86)).toFile(pub('icon-512.png'));
  // Maskable: Motiv innerhalb der „sicheren Zone“ (ca. 80 % Durchmesser)
  await (await logoOnSquare(512, 0.66)).toFile(pub('icon-maskable-512.png'));
  // Logo für strukturierte Daten (Google) – quadratisch, weißer Hintergrund
  await (await logoOnSquare(512, 0.9)).toFile(pub('logo-512.png'));

  const manifest = {
    name: 'Pflasterarbeiten Hildebrand GmbH',
    short_name: 'Hildebrand',
    description: 'Gartenbau, Tiefbau und Straßenbau aus Radolfzell am Bodensee.',
    lang: 'de',
    start_url: '/',
    display: 'browser',
    background_color: WHITE,
    theme_color: '#07172c',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
  await writeFile(pub('site.webmanifest'), `${JSON.stringify(manifest, null, 2)}\n`);

  console.log('Brand-Assets erzeugt: favicon.svg/.ico, App-Icons, logo-512.png, site.webmanifest');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
