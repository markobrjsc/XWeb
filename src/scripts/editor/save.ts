/**
 * Bearbeiten-Modus – „Speichern“: alle Vormerkungen (./pending.ts, auch von anderen Seiten) in einem Commit.
 *  1. neue Dateien, die noch gebraucht werden, als Git-Blobs hochladen (PUT /api/edit/datei/) – noch kein Commit
 *  2. alles zusammen an POST /api/edit/speichern/ → ein Commit auf main → Cloudflare baut einmal neu
 */
import { colorsPayload } from './colors';
import { imagePath, pending, type Pending } from './pending';

/** Vorgemerkte Dateien, auf die noch etwas verweist (entfernte Bilder werden nicht hochgeladen) */
function usedFiles(state: Pending): string[] {
  const used = new Set<string>();
  const add = (path: string) => state.files[path] && used.add(path);
  if (state.logo?.image) add(`src/assets/brand/eigene/${state.logo.image}`);
  Object.values(state.heroes).forEach((name) => add(imagePath(name)));
  for (const [folder, gallery] of Object.entries(state.galleries)) gallery.order.forEach((name) => add(imagePath(`${folder}/${name}`)));
  state.projects.added.forEach((project) => project.photos.forEach((name) => add(imagePath(name))));
  state.certificates?.forEach((cert) => add(`src/assets/zertifikate/${cert.name}.pdf`));
  // Bilder aus dem Baukasten: nur die, die in einem Element vorkommen
  const blocks = JSON.stringify(state.blocks);
  for (const path of Object.keys(state.files)) {
    const name = path.replace(/^src\/assets\/images\//, '').replace(/\.jpg$/, '');
    if (path.startsWith('src/assets/images/bausteine/') && blocks.includes(`"${name}"`)) used.add(path);
  }
  return [...used];
}

export async function saveAll(progress: (text: string) => void) {
  const state = pending.get();
  const paths = usedFiles(state);
  const dateien: { path: string; sha: string }[] = [];
  for (const [index, path] of paths.entries()) {
    progress(`Lade Datei ${index + 1} von ${paths.length} hoch …`);
    const base64 = await pending.fileBase64(path);
    if (!base64) throw new Error('Ein neues Bild fehlt im Browser-Speicher – bitte noch einmal hinzufügen.');
    const response = await fetch(`/api/edit/datei/?path=${encodeURIComponent(path)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/plain' },
      body: base64,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.error || 'Hochladen fehlgeschlagen.');
    dateien.push({ path, sha: String(result.sha) });
  }

  progress('Wird gespeichert …');
  const response = await fetch('/api/edit/speichern/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dateien,
      texte: state.texts,
      galerien: state.galleries,
      kopfbilder: state.heroes,
      farben: state.colors ? colorsPayload(state.colors) : undefined,
      gestaltung: state.styles,
      elemente: state.blocks,
      logo: state.logo,
      zertifikate: state.certificates?.map(({ name, title, issuer, year, hidden }) => ({ name, title, issuer, year, hidden })),
      projekte: {
        added: state.projects.added.map(({ photos: _photos, ...project }) => project),
        deleted: state.projects.deleted,
      },
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) throw new Error(result.error || 'Speichern fehlgeschlagen.');
}
