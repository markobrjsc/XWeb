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

/** Alle Fotos mit Name und Dateipfad (für Auswertungen beim Build, z. B. Helligkeit in der Design-Vorschau) */
export function listImages(): { name: string; image: ImageMetadata; file: string }[] {
  return Object.entries(modules).map(([path, module]) => ({
    name: path.replace('/src/assets/images/', '').replace(/.[^.]+$/, '').toLowerCase(),
    image: module.default,
    file: path.slice(1),
  }));
}

export function findImage(name: string | undefined): ImageMetadata | undefined {
  if (!name) return undefined;
  return imagesByName.get(name.toLowerCase());
}

/**
 * Alle Fotos eines Ordners, sortiert nach Dateiname (01.jpg, 02.jpg …) – z. B. für Bildergalerien:
 *   findImages('referenzen/hofeinfahrt-betonpflaster')
 */
export function findImages(folder: string | undefined): ImageMetadata[] {
  if (!folder) return [];
  const prefix = `${folder.toLowerCase().replace(/\/$/, '')}/`;
  return [...imagesByName.entries()]
    .filter(([name]) => name.startsWith(prefix) && !name.slice(prefix.length).includes('/'))
    .sort(([a], [b]) => a.localeCompare(b, 'de', { numeric: true }))
    .map(([, image]) => image);
}
