/**
 * Elemente beim Build in die Seiten einsetzen (aufgerufen von src/middleware.ts).
 * Liest src/content/blocks.json, optimiert die verwendeten Fotos (WebP in mehreren Größen) und setzt jede Zone
 * als <ub-zone> zwischen die Abschnitte in <main>. Die Zone wird als eigenes Tag eingefügt, damit
 * Selektoren wie „div:nth-of-type(2)“ (Abstände aus dem Bearbeiten-Modus) unverändert weiter passen.
 */
import { getImage } from 'astro:assets';
import blocksFile from '@/content/blocks.json';
import { iconSvg } from '@/lib/icons';
import { findImage } from '@/lib/images';
import { renderZone, type RenderContext } from './render';
import { type PageBlocks, clampZones, collectImages, sanitizePage } from './schema';
import { blocksCss } from './style';

const WIDTHS = [480, 800, 1200, 1600, 2000];

export function blocksForPage(path: string): PageBlocks {
  return sanitizePage((blocksFile as Record<string, unknown>)[path]);
}

async function resolveImages(page: PageBlocks) {
  const names = new Set<string>();
  Object.values(page).forEach((blocks) => collectImages(blocks, names));
  const resolved = new Map<string, { src: string; srcset: string; width: number; height: number }>();
  await Promise.all(
    [...names].map(async (name) => {
      const image = findImage(name);
      if (!image) return;
      const widths = WIDTHS.filter((w) => w < image.width);
      const result = await getImage({ src: image, widths: [...widths, image.width], format: 'webp', quality: 76 });
      resolved.set(name, { src: result.src, srcset: result.srcSet.attribute, width: image.width, height: image.height });
    }),
  );
  return resolved;
}

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const RAW = new Set(['script', 'style', 'textarea', 'title']);
const TAG = /<(\/?)([a-zA-Z][^\s/>]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*(\/?)>/y;

/**
 * Position nach jedem Kind-Element von <main> im HTML-Text.
 * ends[0] = direkt nach <main …>, ends[n] = nach dem n-ten Kind-Element.
 */
export function mainChildEnds(html: string): number[] | null {
  const open = /<main\b[^>]*>/i.exec(html);
  if (!open) return null;
  const ends = [open.index + open[0].length];
  let depth = 0;
  let i = ends[0];
  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt === -1) return null;
    if (html.startsWith('<!--', lt)) {
      const close = html.indexOf('-->', lt + 4);
      if (close === -1) return null;
      i = close + 3;
      continue;
    }
    TAG.lastIndex = lt;
    const match = TAG.exec(html);
    if (!match) {
      i = lt + 1;
      continue;
    }
    const [, closing, rawName, , selfClosing] = match;
    const name = rawName.toLowerCase();
    i = TAG.lastIndex;
    if (closing) {
      if (depth === 0 && name === 'main') return ends;
      depth -= 1;
      if (depth === 0) ends.push(i);
      continue;
    }
    if (RAW.has(name)) {
      const close = html.toLowerCase().indexOf(`</${name}`, i);
      if (close === -1) return null;
      i = html.indexOf('>', close) + 1;
      if (depth === 0) ends.push(i);
      continue;
    }
    if (VOID.has(name) || selfClosing) {
      if (depth === 0) ends.push(i);
      continue;
    }
    depth += 1;
  }
  return null;
}

/** Zonen einer Seite in fertiges HTML einsetzen */
export async function applyBlocks(html: string, path: string): Promise<string> {
  const page = blocksForPage(path);
  const keys = Object.keys(page);
  if (!keys.length) return html;
  const ends = mainChildEnds(html);
  if (!ends) return html;

  const images = await resolveImages(page);
  const icons = new Map<string, string>();
  const ctx: RenderContext = {
    image: (name) => images.get(name),
    icon: (name) => {
      if (!icons.has(name)) icons.set(name, iconSvg(name));
      return icons.get(name)!;
    },
    reveal: true,
  };

  // Von hinten nach vorn einsetzen, damit die gemerkten Positionen gültig bleiben.
  // Zonen hinter dem letzten Abschnitt (z. B. weil die Seite im Code gekürzt wurde) landen am Ende.
  const zones = clampZones(page, ends.length - 1);
  let out = html;
  for (const key of Object.keys(zones).sort((a, b) => Number(b) - Number(a))) {
    const zone = `<ub-zone data-ub-zone="${key}">${renderZone(zones[key], ctx, key)}</ub-zone>`;
    out = out.slice(0, ends[Number(key)]) + zone + out.slice(ends[Number(key)]);
  }
  return injectStyles(out, Object.values(zones).map((blocks) => blocksCss(blocks, ctx.image)).join(''));
}

/**
 * Gestaltung der Elemente als <style> in den <head>. Die Content-Security-Policy erlaubt nur Styles mit
 * bekanntem Hash – daher wird der Hash dieses Blocks in die style-src-Angabe des CSP-Meta-Tags eingetragen.
 */
async function injectStyles(html: string, css: string): Promise<string> {
  if (!css) return html;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(css));
  const hash = `'sha256-${btoa(String.fromCharCode(...new Uint8Array(digest)))}'`;
  return html
    .replace(/(<meta http-equiv="content-security-policy" content="[^"]*?style-src 'self')/i, `$1 ${hash}`)
    .replace('</head>', `<style data-ub-style>${css}</style></head>`);
}
