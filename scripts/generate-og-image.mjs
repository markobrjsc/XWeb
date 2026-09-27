/**
 * Erzeugt das Vorschaubild für Social Media & Messenger (public/og-image.jpg, 1200 × 630 px)
 * aus der gebauten Website – mit echter Schrift, Logo und Lageplan-Zeichnung.
 *
 *   npm run build && npm run og-image
 *
 * Voraussetzung: einmalig `npx playwright install chromium`.
 * Eigener Browser-Pfad optional über die Umgebungsvariable PLAYWRIGHT_CHROMIUM_PATH.
 */
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dist = path.join(root, 'dist');
const output = path.join(root, 'public', 'og-image.jpg');

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.woff2': 'font/woff2',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

/** Minimaler statischer Server für dist/ */
function serve() {
  const server = http.createServer(async (req, res) => {
    let file = path.join(dist, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    try {
      if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' });
      createReadStream(file).pipe(res);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((resolve) => server.listen(0, () => resolve(server)));
}

const server = await serve();
const { port } = server.address();
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined });

try {
  const context = await browser.newContext({ viewport: { width: 1200, height: 630 }, bypassCSP: true, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle' });

  await page.evaluate(() => {
    const plan = document.querySelector('.lageplan')?.outerHTML ?? '';
    const logo = document.querySelector('.logo__mark');
    const logoSrc = logo?.currentSrc || logo?.getAttribute('src') || '';

    document.body.innerHTML = `
      <div id="og" data-tone="dark">
        <div class="og-grid"></div>
        <div class="og-text">
          <div class="og-brand">
            <img src="${logoSrc}" alt="" />
            <div><strong>Hildebrand</strong><span>Pflasterarbeiten GmbH</span></div>
          </div>
          <h1>Gartenbau, Tiefbau und Straßenbau <em>aus einer Hand.</em></h1>
          <p class="og-sub">Familienbetrieb aus Radolfzell am Bodensee · seit 1989</p>
          <p class="og-contact">07732 10374 &nbsp;·&nbsp; pflasterarbeiten-hildebrand.de</p>
        </div>
        <div class="og-plan">${plan}</div>
      </div>`;

    const style = document.createElement('style');
    style.textContent = `
      html, body { margin: 0; background: #07172c; }
      #og { position: relative; width: 1200px; height: 630px; overflow: hidden; font-family: var(--font-sans);
        background: linear-gradient(160deg, #07172c 0%, #0c2645 60%, #0e2b4d 100%); }
      .og-grid { position: absolute; inset: 0;
        background-image: linear-gradient(to bottom, rgb(255 255 255 / .06) 1px, transparent 1px),
          linear-gradient(to right, rgb(255 255 255 / .06) 1px, transparent 1px),
          linear-gradient(to bottom, rgb(255 255 255 / .025) 1px, transparent 1px),
          linear-gradient(to right, rgb(255 255 255 / .025) 1px, transparent 1px);
        background-size: 120px 120px, 120px 120px, 24px 24px, 24px 24px; }
      .og-text { position: absolute; left: 72px; top: 70px; width: 560px; color: #fff; }
      .og-brand { display: flex; align-items: center; gap: 18px; margin-bottom: 54px; }
      .og-brand img { height: 84px; width: auto; }
      .og-brand div { display: flex; flex-direction: column; gap: 6px; padding-left: 18px; border-left: 1px solid rgb(255 255 255 / .3); }
      .og-brand strong { font-size: 30px; letter-spacing: .08em; text-transform: uppercase; }
      .og-brand span { font-size: 14px; letter-spacing: .1em; text-transform: uppercase; color: rgb(255 255 255 / .7); }
      h1 { margin: 0; font-size: 54px; line-height: 1.08; font-weight: 700; letter-spacing: -.02em; font-stretch: 96%; }
      h1 em { font-style: normal; color: #91b8de; }
      .og-sub { margin: 26px 0 0; font-size: 21px; color: rgb(255 255 255 / .82); }
      .og-contact { margin: 12px 0 0; font-size: 18px; font-weight: 600; color: #c3d9ee; }
      .og-plan { position: absolute; right: 48px; top: 50%; width: 500px; transform: translateY(-50%);
        padding: 14px; border-radius: 8px; background: rgb(7 23 44 / .6); box-shadow: inset 0 0 0 1px rgb(255 255 255 / .12); }
    `;
    document.head.append(style);
  });

  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.locator('#og').screenshot({ path: output, type: 'jpeg', quality: 88 });
  console.log(`Vorschaubild gespeichert: ${path.relative(root, output)}`);
} finally {
  await browser.close();
  server.close();
}
