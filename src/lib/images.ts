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
import galleries from '@/content/galleries.json';
import heroes from '@/content/heroes.json';

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
    name: path.replace('/src/assets/images/', '').replace(/\.[^.]+$/, '').toLowerCase(),
    image: module.default,
    file: path.slice(1),
  }));
}

/** Kopfbild einer Seite – im Bearbeiten-Modus änderbar (src/content/heroes.json: { "/pfad/": "bildname" }) */
export function heroImageName(path: string, fallback?: string): string | undefined {
  return (heroes as Record<string, string>)[path] ?? fallback;
}

export function findImage(name: string | undefined): ImageMetadata | undefined {
  if (!name) return undefined;
  return imagesByName.get(name.toLowerCase());
}

/** Reihenfolge und ausgeblendete Fotos je Galerie – gepflegt über den Bearbeiten-Modus der Website */
type GallerySettings = Record<string, { order?: string[]; hidden?: string[] }>;
const gallerySettings = galleries as GallerySettings;

/**
 * Alle Fotos eines Ordners mit Dateinamen – Reihenfolge laut src/content/galleries.json,
 * sonst nach Dateiname (01.jpg, 02.jpg …). `includeHidden`: auch ausgeblendete (für den Bearbeiten-Modus).
 */
export function findGallery(folder: string | undefined, { includeHidden = false } = {}) {
  if (!folder) return [];
  const key = folder.toLowerCase().replace(/\/$/, '');
  const prefix = `${key}/`;
  const settings = gallerySettings[key] ?? {};
  const order = settings.order ?? [];
  const hidden = new Set(settings.hidden ?? []);
  const rank = (name: string) => {
    const index = order.indexOf(name);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
  return [...imagesByName.entries()]
    .filter(([name]) => name.startsWith(prefix) && !name.slice(prefix.length).includes('/'))
    .map(([name, image]) => ({ name: name.slice(prefix.length), image, hidden: hidden.has(name.slice(prefix.length)) }))
    .filter((entry) => includeHidden || !entry.hidden)
    .sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name, 'de', { numeric: true }));
}

/**
 * Alle sichtbaren Fotos eines Ordners in Galerie-Reihenfolge – z. B. für Bildergalerien:
 *   findImages('referenzen/hofeinfahrt-betonpflaster')
 */
export function findImages(folder: string | undefined): ImageMetadata[] {
  return findGallery(folder).map((entry) => entry.image);
}
