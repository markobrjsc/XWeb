/**
 * Gestaltung einzelner Elemente (Farben, Schrift, Abstände, Rahmen, Breite …) → CSS.
 * Jedes gestaltete Element bekommt die Klasse `ub-i-<id>`; die Regeln dazu entstehen hier.
 *  · Build: src/lib/blocks/server.ts setzt sie als <style> in den <head> (Hash in der Content-Security-Policy)
 *  · Editor: src/scripts/block-editor.ts setzt sie live über ein CSSOM-Stylesheet (von der CSP erlaubt)
 * Ausrichtung, Schatten und Sichtbarkeit sind Klassen (src/styles/blocks.css).
 * Große Werte (Schrift, Abstände) werden auf kleinen Bildschirmen automatisch verkleinert.
 */
import type { Block, BlockStyle, BlockType, Sides } from './schema';

export type StyleGroup = 'align' | 'colors' | 'font' | 'spacing' | 'box' | 'size' | 'visibility';

type StyleOptions = {
  groups: StyleGroup[];
  /** Worauf Schriftgröße/-stärke wirken (Selektor relativ zum Element, '' = das Element selbst) */
  font?: string;
  /** Worauf die Eckenrundung wirkt */
  radius?: string;
};

const BOX: StyleGroup[] = ['align', 'colors', 'spacing', 'box', 'size', 'visibility'];
const TEXT: StyleGroup[] = ['align', 'colors', 'font', 'spacing', 'box', 'size', 'visibility'];

/** Welche Gestaltungs-Gruppen der Editor je Elementtyp anbietet – ohne Unnötiges */
export const STYLE_OPTIONS: Record<BlockType, StyleOptions> = {
  section: { groups: ['align', 'colors', 'spacing', 'box', 'visibility'] },
  columns: { groups: BOX },
  card: { groups: BOX },
  eyebrow: { groups: TEXT, font: '' },
  heading: { groups: TEXT, font: '' },
  text: { groups: TEXT, font: '' },
  image: { groups: ['align', 'colors', 'font', 'spacing', 'box', 'size', 'visibility'], font: ' .ub-image__caption', radius: ' .ub-image__frame' },
  button: { groups: TEXT, font: '' },
  list: { groups: TEXT, font: '' },
  iconbox: { groups: TEXT, font: ' .ub-iconbox__title' },
  stat: { groups: TEXT, font: ' .ub-stat__value' },
  quote: { groups: TEXT, font: ' .ub-quote__text' },
  faq: { groups: TEXT, font: ' .ub-faq__q' },
  gallery: { groups: ['spacing', 'box', 'size', 'visibility'], radius: ' .ub-gallery__item' },
  spacer: { groups: ['spacing', 'visibility'] },
  divider: { groups: ['align', 'spacing', 'visibility'] },
};

type ImageResolver = (name: string) => { src: string } | undefined;

/** Auf kleinen Bildschirmen mitschrumpfen: volle Größe ab 1280 px Breite, darunter bis auf 70 % */
const fluid = (value: number) =>
  Math.abs(value) <= 32 ? `${value}px` : value > 0 ? `clamp(${Math.round(value * 0.7)}px, ${(value / 12.8).toFixed(2)}vw, ${value}px)` : `clamp(${value}px, ${(value / 12.8).toFixed(2)}vw, ${Math.round(value * 0.7)}px)`;

/** Seitliche Abstände: auf dem Handy höchstens so viel, dass der Inhalt Platz behält */
const fluidX = (value: number) =>
  Math.abs(value) <= 16 ? `${value}px` : value > 0 ? `min(${value}px, ${(value / 12.8).toFixed(2)}vw)` : `max(${value}px, ${(value / 12.8).toFixed(2)}vw)`;

const sides = (prefix: 'padding' | 'margin', values: Sides | undefined) =>
  (['top', 'right', 'bottom', 'left'] as const)
    .filter((side) => values?.[side] !== undefined)
    .map((side) => `${prefix}-${side}: ${side === 'left' || side === 'right' ? fluidX(values![side]!) : fluid(values![side]!)}`);

/** Lesbare Schrift auf einer Farbe: dunkel auf hellen, weiß auf dunklen Tönen */
const contrastOn = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#0b0b0c' : '#ffffff';
};

const darker = (color: string) => `color-mix(in srgb, ${color} 86%, #000)`;

/** CSS-Regeln für genau ein Element (ohne Kinder) */
export function blockRules(block: Block, image?: ImageResolver): string {
  const style: BlockStyle = block.style ?? {};
  const options = STYLE_OPTIONS[block.type];
  const root: string[] = [];
  const font: string[] = [];
  const radius: string[] = [];
  const isButton = block.type === 'button';

  if (style.textColor) {
    const c = style.textColor;
    root.push(isButton ? `--btn-fg: ${c}` : `color: ${c}`);
    if (!isButton) root.push(`--color-heading: ${c}`, `--color-text: ${c}`, `--color-text-muted: ${c}`, `--color-text-subtle: ${c}`, `--color-highlight: ${c}`, `--color-link: ${c}`);
  }
  if (style.bgColor) {
    const c = style.bgColor;
    root.push(...(isButton ? [`--btn-bg: ${c}`, `--btn-border: ${c}`, `--btn-bg-hover: ${darker(c)}`, `--btn-border-hover: ${darker(c)}`] : [`background-color: ${c}`]));
    if (isButton && !style.textColor) root.push(`--btn-fg: ${contrastOn(c)}`);
  }
  if (style.accentColor) {
    const c = style.accentColor;
    root.push(`--color-accent: ${c}`, `--color-highlight-mark: ${c}`, `--color-cta: ${c}`, `--color-cta-hover: ${darker(c)}`, `--color-cta-fg: ${contrastOn(c)}`);
  }
  root.push(...sides('padding', style.padding), ...sides('margin', style.margin));
  if (style.borderWidth !== undefined) root.push(`border: ${style.borderWidth}px solid ${style.borderColor ?? 'var(--color-border)'}`);
  else if (style.borderColor) root.push(`border-color: ${style.borderColor}`);
  if (style.radius !== undefined) (options.radius ? radius : root).push(`border-radius: ${style.radius}px`, 'overflow: hidden');
  if (style.maxWidth !== undefined) root.push(`max-width: min(100%, ${style.maxWidth}px)`);

  if (options.font !== undefined) {
    if (style.fontSize !== undefined) font.push(`font-size: ${fluid(style.fontSize)}`, ...(style.fontSize > 28 ? ['line-height: 1.12'] : []));
    if (style.fontWeight) font.push(`font-weight: ${style.fontWeight}`);
    if (style.italic) font.push('font-style: italic');
    if (style.uppercase) font.push('text-transform: uppercase', 'letter-spacing: 0.04em');
  }

  // Eigene Felder mancher Elemente
  const p = block.props;
  if (block.type === 'section' && typeof p.bgImage === 'string' && p.bgImage) {
    const src = image?.(p.bgImage)?.src;
    const dim = Number(p.overlay) || 0;
    if (src) {
      root.push(
        `background-image: linear-gradient(rgb(11 11 12 / ${dim}%), rgb(11 11 12 / ${dim}%)), url("${src.replace(/["\\\n]/g, '')}")`,
        'background-size: cover',
        'background-position: center',
      );
    }
  }
  if (block.type === 'divider') {
    const color = typeof p.color === 'string' && p.color ? p.color : 'var(--color-border-strong)';
    root.push(`border-top: ${Number(p.thickness) || 1}px ${String(p.line || 'solid')} ${color}`);
    if (p.width === 'kurz') root.push('max-width: 4rem');
    else if (p.width && p.width !== '100') root.push(`max-width: ${Number(p.width)}%`);
  }

  const selector = `.ub-i-${block.id}.ub-i-${block.id}`;
  const rule = (target: string, decls: string[]) => (decls.length ? `${selector}${target}{${decls.map((d) => `${d} !important`).join(';')}}` : '');
  return rule('', root) + rule(options.font ?? '', font) + rule(options.radius ?? '', radius);
}

/** CSS für alle Elemente eines Baums */
export function blocksCss(blocks: Block[], image?: ImageResolver): string {
  return blocks.map((block) => blockRules(block, image) + (block.slots ?? []).map((slot) => blocksCss(slot, image)).join('')).join('');
}

/** Klassen für Ausrichtung, Schatten, Sichtbarkeit und (wenn nötig) die eigenen Regeln */
export function styleClasses(block: Block, image?: ImageResolver): string {
  const style = block.style ?? {};
  return [
    style.align && `ub-al-${style.align}`,
    style.shadow && `ub-shadow-${style.shadow}`,
    style.hide && `ub-hide-${style.hide}`,
    blockRules(block, image) && `ub-i-${block.id}`,
  ]
    .filter(Boolean)
    .join(' ');
}
