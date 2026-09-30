/**
 * Lucide-Icons als SVG-Text – für HTML, das nicht aus Astro-Komponenten entsteht
 * (Elemente aus dem Bearbeiten-Modus, siehe src/lib/blocks/). Komponenten nutzen <Icon />.
 */
import { getIconData, iconToSVG } from '@iconify/utils';
import type { IconifyJSON } from '@iconify/types';
import lucide from '@iconify-json/lucide/icons.json';

export function iconSvg(name: string): string {
  const data = getIconData(lucide as IconifyJSON, name);
  if (!data) return '';
  const { attributes, body } = iconToSVG(data);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${attributes.viewBox}" width="1em" height="1em" class="icon" aria-hidden="true" focusable="false">${body}</svg>`;
}
