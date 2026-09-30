/**
 * Daten für den Element-Editor im Bearbeiten-Modus (src/scripts/block-editor.ts), erst beim Öffnen geladen:
 *  · images: alle Fotos mit kleiner Vorschau (Auswahl) und mittlerer Größe (Vorschau auf der Seite)
 *  · icons:  SVG der Symbole, die Elemente verwenden
 */
import type { APIRoute } from 'astro';
import { getImage } from 'astro:assets';
import { BLOCK_ICONS } from '@/lib/blocks/schema';
import { iconSvg } from '@/lib/icons';
import { listImages } from '@/lib/images';

/** Symbole des Editors selbst und fest verwendete Symbole der Elemente */
const UI_ICONS = ['plus', 'align-left', 'align-center', 'align-right', 'align-justify', 'check', 'quote', 'chevron-down', 'image-plus', 'images', 'arrow-right', 'phone', 'mail', 'map-pin', 'download'];

export const GET: APIRoute = async () => {
  const images = await Promise.all(
    listImages()
      .filter(({ name }) => !name.startsWith('zertifikate/'))
      .sort((a, b) => a.name.localeCompare(b.name, 'de', { numeric: true }))
      .map(async ({ name, image }) => {
        const [thumb, preview] = await Promise.all([
          getImage({ src: image, width: Math.min(320, image.width), format: 'webp', quality: 60 }),
          getImage({ src: image, width: Math.min(1200, image.width), format: 'webp', quality: 72 }),
        ]);
        return { name, thumb: thumb.src, src: preview.src, width: image.width, height: image.height };
      }),
  );
  const icons = Object.fromEntries([...new Set([...UI_ICONS, ...BLOCK_ICONS])].map((name) => [name, iconSvg(name)]));

  return new Response(JSON.stringify({ images, icons }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
