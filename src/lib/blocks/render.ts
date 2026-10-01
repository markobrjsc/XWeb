/**
 * Elemente → HTML. Derselbe Code läuft beim Build (src/lib/blocks/server.ts) und live im Editor
 * (src/scripts/block-editor.ts) – die Vorschau beim Bearbeiten sieht dadurch genauso aus wie die fertige Seite.
 * Alle Texte werden maskiert; Aussehen: src/styles/blocks.css.
 */
import { type Block, blockDef } from './schema';
import { styleClasses } from './style';

export interface RenderContext {
  /** Bild auflösen – beim Build optimiert (srcset), im Editor eine Vorschau */
  image(name: string): { src: string; srcset?: string; width?: number; height?: number } | undefined;
  /** Lucide-Icon als SVG-Text */
  icon(name: string): string;
  /** Editor: Felder markieren, leere Felder zeigen, Einfüge-Knöpfe */
  editing?: boolean;
  /** Scroll-Animation für Elemente (nur beim Build) */
  reveal?: boolean;
}

type Env = { cols: number; reveal: boolean };

const escape = (text: unknown) =>
  String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const str = (value: unknown) => (typeof value === 'string' ? value : '');

/** Fotos: Breite je nach Spaltenzahl (max. Inhaltsbreite 1232 px) */
const sizesFor = (cols: number) =>
  cols <= 1 ? '(min-width: 80rem) 1232px, 100vw' : `(min-width: 80rem) ${Math.round(1232 / cols)}px, (min-width: 52rem) ${Math.round(100 / cols)}vw, 100vw`;

export function renderZone(blocks: Block[], ctx: RenderContext, zone: string): string {
  let html = '';
  let group: string[] = [];
  const flush = () => {
    if (group.length) html += `<div class="ub-contain">${group.join('')}</div>`;
    group = [];
  };
  // Abschnitte gehen über die ganze Breite, alles andere steht im normalen Seitenraster –
  // außer bei Zonen an einem Element innerhalb eines Abschnitts („@…“): dort gilt schon dessen Raster
  const nested = zone.startsWith('@');
  for (const block of blocks) {
    if (block.type === 'section' || nested) {
      flush();
      html += renderBlock(block, ctx, { cols: 1, reveal: nested && Boolean(ctx.reveal) && block.type !== 'section' });
    } else {
      group.push(renderBlock(block, ctx, { cols: 1, reveal: Boolean(ctx.reveal) }));
    }
  }
  flush();
  if (ctx.editing) html += addButton(ctx, `zone:${zone}`, 'Element hier einfügen', 'ub-add--zone');
  return html;
}

export function renderBlocks(blocks: Block[], ctx: RenderContext, env: Env): string {
  return blocks.map((block) => renderBlock(block, ctx, env)).join('');
}

function addButton(ctx: RenderContext, target: string, label: string, extra = '') {
  return `<button type="button" class="ub-add ${extra}" data-ub-add="${escape(target)}">${ctx.icon('plus')}<span>${label}</span></button>`;
}

function slot(block: Block, index: number, ctx: RenderContext, env: Env) {
  const children = block.slots?.[index] ?? [];
  const def = blockDef(block.type);
  const label = def?.slotLabel && (block.slots?.length ?? 0) > 1 ? `${def.slotLabel} ${index + 1}` : 'Element';
  return `<div class="ub-slot"${ctx.editing ? ` data-ub-slot="${block.id}:${index}"` : ''}>${renderBlocks(children, ctx, env)}${
    ctx.editing ? addButton(ctx, `${block.id}:${index}`, children.length ? label : `${label} einfügen`, children.length ? '' : 'ub-add--empty') : ''
  }</div>`;
}

function renderBlock(block: Block, ctx: RenderContext, env: Env): string {
  const p = block.props;
  const editing = Boolean(ctx.editing);
  const styled = styleClasses(block, ctx.image);
  const attrs = (cls: string, extra = '') =>
    `class="ub ub-${block.type}${cls ? ` ${cls}` : ''}${styled ? ` ${styled}` : ''}"${editing ? ` data-ub="${block.id}" data-ub-type="${block.type}"` : ''}${
      env.reveal ? ' data-reveal' : ''
    }${extra}`;

  /** Text-Feld: im Editor immer (auch leer, mit Platzhalter), sonst nur wenn gefüllt */
  const field = (key: string, tag: string, cls = '', { multiline = false, placeholder = '' } = {}) => {
    const value = str(p[key]);
    if (!editing && !value.trim()) return '';
    const editAttrs = editing
      ? ` data-ub-field="${key}"${multiline ? ' data-ub-multiline' : ''} data-placeholder="${escape(placeholder || blockDef(block.type)?.fields.find((f) => f.key === key)?.label || '')}"`
      : '';
    return `<${tag}${cls ? ` class="${cls}"` : ''}${editAttrs}>${escape(value)}</${tag}>`;
  };

  const inner: Env = { cols: env.cols, reveal: false };

  switch (block.type) {
    case 'section': {
      const tone = p.tone === 'grau' ? ' data-tone="subtle"' : p.tone === 'dunkel' ? ' data-tone="dark"' : '';
      const cls = `ub-section--w-${str(p.width)} ub-section--s-${str(p.space)}${p.bgImage ? ' ub-section--bild' : ''}`;
      return `<section ${attrs(cls, tone)}>${slot(block, 0, ctx, { cols: env.cols, reveal: Boolean(ctx.reveal) && env.cols === 1 })}</section>`;
    }

    case 'columns': {
      const count = block.slots?.length ?? 2;
      const cls = [
        `ub-columns--${count}`,
        count === 2 && p.ratio !== 'gleich' ? `ub-columns--r-${str(p.ratio)}` : '',
        `ub-columns--v-${str(p.valign)}`,
        p.gap && p.gap !== 'normal' ? `ub-columns--g-${str(p.gap)}` : '',
        p.reverse ? 'ub-columns--rev' : '',
      ]
        .filter(Boolean)
        .join(' ');
      const cols = { cols: env.cols * count, reveal: false };
      return `<div ${attrs(cls)}>${Array.from({ length: count }, (_, i) => slot(block, i, ctx, cols)).join('')}</div>`;
    }

    case 'card': {
      const tone = p.style === 'dunkel' ? ' data-tone="dark"' : p.style === 'grau' ? ' data-tone="subtle"' : '';
      // Verlinkte Karte: unsichtbarer Link über die ganze Fläche – Buttons darin bleiben eigenständig anklickbar
      const href = str(p.href);
      const title = block.slots?.[0]?.find((child) => child.type === 'heading')?.props.text;
      const link = href && !editing ? `<a class="ub-card__link" href="${escape(href)}" aria-label="${escape(title || 'Mehr erfahren')}"></a>` : '';
      return `<div ${attrs(`ub-card--${str(p.style)}${href ? ' ub-card--link' : ''}`, tone)}>${link}${slot(block, 0, ctx, inner)}</div>`;
    }

    case 'eyebrow':
      if (!editing && !str(p.text).trim()) return '';
      return `<p ${attrs('')}><span class="ub-eyebrow__line" aria-hidden="true"></span>${field('text', 'span')}</p>`;

    case 'heading': {
      const tag = p.size === 'klein' ? 'h4' : p.size === 'mittel' ? 'h3' : 'h2';
      const text = field('text', 'span');
      const accent = field('accent', 'span', 'accent');
      if (!text && !accent) return '';
      return `<${tag} ${attrs(`ub-heading--${str(p.size)}`)}>${text}${text && accent ? ' ' : ''}${accent}</${tag}>`;
    }

    case 'text': {
      const value = str(p.text);
      if (!editing && !value.trim()) return '';
      const editAttrs = editing ? ` data-ub-field="text" data-ub-multiline data-placeholder="Text"` : '';
      return `<p ${attrs(`ub-text--${str(p.size)}`, editAttrs)}>${escape(value)}</p>`;
    }

    case 'image': {
      const media = imageTag(ctx, str(p.image), str(p.alt), env.cols);
      const pick = editing ? ' data-ub-pick="image"' : '';
      const href = str(p.href);
      const body = media
        ? href && !editing
          ? `<a class="ub-image__frame" href="${escape(href)}">${media}</a>`
          : `<div class="ub-image__frame"${pick}>${media}</div>`
        : editing
          ? `<div class="ub-image__frame ub-image__empty"${pick}>${ctx.icon('image-plus')}<span>Bild wählen</span></div>`
          : '';
      if (!body) return '';
      return `<figure ${attrs(`ub-image--${str(p.ratio)} ub-image--pos-${str(p.position)}`)}>${body}${field('caption', 'figcaption', 'ub-image__caption', { placeholder: 'Bildunterschrift (optional)' })}</figure>`;
    }

    case 'button': {
      const label = field('label', 'span');
      if (!label) return '';
      const href = str(p.href);
      const icon = str(p.icon) ? ctx.icon(str(p.icon)) : '';
      const target = p.newTab ? ' target="_blank" rel="noopener noreferrer"' : '';
      const cls = `ub-button--${str(p.variant)} ub-button--s-${str(p.size) || 'normal'}${p.full ? ' ub-button--full' : ''}`;
      return href ? `<a ${attrs(cls, ` href="${escape(href)}"${target}`)}>${label}${icon}</a>` : `<span ${attrs(cls)}>${label}${icon}</span>`;
    }

    case 'list': {
      const items = (Array.isArray(p.items) ? p.items : []).map(String);
      const tag = p.style === 'nummern' ? 'ol' : 'ul';
      const check = p.style === 'haken' ? `<span class="ub-list__mark">${ctx.icon('check')}</span>` : '';
      const lis = items
        .map((item, i) => {
          if (!editing && !item.trim()) return '';
          const editAttrs = editing ? ` data-ub-field="items.${i}" data-placeholder="Eintrag"` : '';
          return `<li>${check}<span${editAttrs}>${escape(item)}</span></li>`;
        })
        .join('');
      if (!lis) return '';
      return `<${tag} ${attrs(`ub-list--${str(p.style)}`)}>${lis}</${tag}>`;
    }

    case 'iconbox': {
      const pick = editing ? ' data-ub-pick="icon"' : '';
      return `<div ${attrs(`ub-iconbox--${str(p.layout)}`)}><span class="ub-iconbox__icon"${pick}>${ctx.icon(str(p.icon) || 'badge-check')}</span><div class="ub-iconbox__body">${field('title', 'h3', 'ub-iconbox__title')}${field('text', 'p', 'ub-iconbox__text', { multiline: true })}</div></div>`;
    }

    case 'stat':
      return `<div ${attrs('')}>${field('value', 'p', 'ub-stat__value')}${field('label', 'p', 'ub-stat__label')}</div>`;

    case 'quote': {
      const by = field('author', 'strong') + field('role', 'span');
      return `<figure ${attrs('')}><span class="ub-quote__mark" aria-hidden="true">${ctx.icon('quote')}</span><blockquote class="ub-quote__text">${field('text', 'p', '', { multiline: true })}</blockquote>${
        by ? `<figcaption class="ub-quote__by">${by}</figcaption>` : ''
      }</figure>`;
    }

    case 'faq':
      return `<details ${attrs('', editing ? ' open' : '')}><summary class="ub-faq__q">${field('question', 'span')}<span class="ub-faq__chevron" aria-hidden="true">${ctx.icon('chevron-down')}</span></summary><div class="ub-faq__a">${field('answer', 'p', '', { multiline: true })}</div></details>`;

    case 'gallery': {
      const names = (Array.isArray(p.images) ? p.images : []).map(String);
      const columns = Number(p.columns) || 3;
      const figures = names
        .map((name) => {
          const media = imageTag(ctx, name, '', env.cols * columns);
          return media ? `<figure class="ub-gallery__item">${media}</figure>` : '';
        })
        .join('');
      const pick = editing ? ' data-ub-pick="images"' : '';
      if (!figures && !editing) return '';
      const empty = figures ? '' : `<div class="ub-image__empty">${ctx.icon('images')}<span>Bilder wählen</span></div>`;
      return `<div ${attrs(`ub-gallery--${columns} ub-gallery--${str(p.ratio)}`, pick)}>${figures}${empty}</div>`;
    }

    case 'spacer':
      return `<div ${attrs(`ub-spacer--${str(p.size)}`, ' aria-hidden="true"')}></div>`;

    case 'divider':
      return `<hr ${attrs('')} />`;
  }
}

function imageTag(ctx: RenderContext, name: string, alt: string, cols: number) {
  if (!name) return '';
  const image = ctx.image(name);
  if (!image) return '';
  const size = image.width && image.height ? ` width="${image.width}" height="${image.height}"` : '';
  const srcset = image.srcset ? ` srcset="${escape(image.srcset)}" sizes="${sizesFor(cols)}"` : '';
  return `<img src="${escape(image.src)}"${srcset}${size} alt="${escape(alt)}" loading="lazy" decoding="async" />`;
}
