/**
 * Bilder-Verwaltung: Alle Fotos in src/assets/images werden automatisch gefunden und beim Build
 * optimiert (AVIF/WebP in mehreren Größen). Angesprochen werden sie über ihren Dateinamen ohne Endung:
 *
 *   src/assets/images/hero.jpg                     → findImage('hero')
 *   src/assets/images/referenzen/hofeinfahrt.jpg   → findImage('referenzen/hofeinfahrt')
 *
 * Fehlt ein Foto, zeigen die Komponenten automatisch einen gestalteten Platzhalter.
 */
import type { ImageMetadata } from 'astro';

const modules = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/images/**/*.{jpg,jpeg,png,webp,avif,JPG,JPEG,PNG,WEBP,AVIF}',
  { eager: true },
);

const imagesByName = new Map<string, ImageMetadata>();

for (const [path, module] of Object.entries(modules)) {
  const name = path
    .replace('/src/assets/images/', '')
    .replace(/\.[^.]+$/, '')
    .toLowerCase();
  imagesByName.set(name, module.default);
}

export function findImage(name: string | undefined): ImageMetadata | undefined {
  if (!name) return undefined;
  return imagesByName.get(name.toLowerCase());
}
