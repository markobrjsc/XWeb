/**
 * Elemente beim Build in die Seiten einsetzen (aufgerufen von src/middleware.ts).
 * Liest src/content/blocks.json, optimiert die verwendeten Fotos (WebP in mehreren Größen) und setzt jede Zone
 * als <ub-zone> zwischen die Abschnitte in <main> – oder an ein beliebiges Element darin („@Pfad|Position“). Die Zone wird als eigenes Tag eingefügt, damit
 * Selektoren wie „div:nth-of-type(2)“ (Abstände aus dem Bearbeiten-Modus) unverändert weiter passen.
 */
import { getImage } from 'astro:assets';
import blocksFile from '@/content/blocks.json';
import { iconSvg } from '@/lib/icons';
import { findImage } from '@/lib/images';
import { renderZone, type RenderContext } from './render';
import { type PageBlocks, clampZones, collectImages, parseAnchor, sanitizePage } from './schema';
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

/** Element im HTML-Text: Beginn, Ende des Start-Tags, Beginn des End-Tags, Ende – dazu die Kind-Elemente */
export type HtmlNode = { start: number; openEnd: number; closeStart: number; end: number; children: HtmlNode[] };

/**
 * Elementbaum von <main> aus dem HTML-Text (ohne Textknoten und Kommentare).
 * Gleiche Zählweise wie im Editor (src/scripts/block-editor.ts): Kind-Elemente ab 1.
 */
export function mainTree(html: string): HtmlNode | null {
  const open = /<main\b[^>]*>/i.exec(html);
  if (!open) return null;
  const root: HtmlNode = { start: open.index, openEnd: open.index + open[0].length, closeStart: -1, end: -1, children: [] };
  const stack: HtmlNode[] = [root];
  let i = root.openEnd;
  const lower = html.toLowerCase();
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
    const parent = stack[stack.length - 1];
    if (closing) {
      const node = stack.pop()!;
      node.closeStart = lt;
      node.end = i;
      if (node === root) return root;
      continue;
    }
    const node: HtmlNode = { start: lt, openEnd: i, closeStart: i, end: i, children: [] };
    parent.children.push(node);
    if (RAW.has(name)) {
      const close = lower.indexOf(`</${name}`, i);
      if (close === -1) return null;
      node.closeStart = close;
      i = node.end = html.indexOf('>', close) + 1;
      continue;
    }
    if (VOID.has(name) || selfClosing) continue;
    stack.push(node);
  }
  return null;
}

/** Position einer Zone im HTML-Text; unbekanntes Element → Ende von <main> */
function zoneOffset(root: HtmlNode, key: string): { at: number; order: number } {
  const anchor = parseAnchor(key);
  if (!anchor) {
    const n = Number(key);
    return { at: n === 0 ? root.openEnd : (root.children[n - 1]?.end ?? root.closeStart), order: 1 };
  }
  let node: HtmlNode | undefined = root;
  for (const index of anchor.path) node = node?.children[index - 1];
  if (!node) return { at: root.closeStart, order: 2 };
  const isVoid = node.openEnd === node.end;
  switch (anchor.position) {
    case 'before':
      return { at: node.start, order: 0 };
    case 'start':
      return { at: isVoid ? node.end : node.openEnd, order: 0 };
    case 'end':
      return { at: isVoid ? node.end : node.closeStart, order: 1 };
    default:
      return { at: node.end, order: 1 };
  }
}

/** Zonen einer Seite in fertiges HTML einsetzen */
export async function applyBlocks(html: string, path: string): Promise<string> {
  const page = blocksForPage(path);
  const keys = Object.keys(page);
  if (!keys.length) return html;
  const tree = mainTree(html);
  if (!tree) return html;

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

  // Alle Positionen zuerst im unveränderten HTML bestimmen, dann von hinten nach vorn einsetzen.
  // Zonen hinter dem letzten Abschnitt (z. B. weil die Seite im Code gekürzt wurde) landen am Ende.
  // Gleiche Position: „davor“ des nächsten Elements zuerst einsetzen, damit „dahinter“ des vorigen davor steht.
  const zones = clampZones(page, tree.children.length);
  const placed = Object.keys(zones)
    .map((key) => ({ key, ...zoneOffset(tree, key) }))
    .sort((a, b) => b.at - a.at || a.order - b.order);
  let out = html;
  for (const { key, at } of placed) {
    const zone = `<ub-zone data-ub-zone="${key}">${renderZone(zones[key], ctx, key)}</ub-zone>`;
    out = out.slice(0, at) + zone + out.slice(at);
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
