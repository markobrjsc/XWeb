/**
 * Bearbeiten-Modus – vorgemerkte Änderungen.
 * Alles, was im Bearbeiten-Modus geändert wird, landet zuerst hier und nicht auf dem Server: die Angaben im
 * localStorage, neue Bilder und PDFs (Base64) in IndexedDB. So bleibt alles über Seitenwechsel, Vorschau und
 * Neuladen erhalten, und jede Seite zeigt es beim Laden als Vorschau. Erst „Speichern“ lädt die Dateien hoch und
 * übernimmt alles in einem Commit (POST /api/edit/speichern/, worker/edit.ts) – ein Build pro Speichern.
 *
 * Dateien werden über ihren späteren Pfad im Repository angesprochen (z. B. src/assets/images/hero/neu-abc.jpg).
 */
import type { PageBlocks } from '@/lib/blocks/schema';

export type TextChange = { scope: 'global' | 'page'; page: string; from: string; to: string };
/** Gestaltung je Selektor: geänderte Eigenschaften (null = Eigenschaft entfernen) bzw. null = alles zurücksetzen */
export type StyleChange = Record<string, string | null> | null;
export type GalleryChange = { order: string[]; hidden: string[] };
export type NewProject = {
  slug: string;
  service: string;
  pillar: string;
  title: string;
  summary: string;
  location: string;
  year: string;
  /** Bildnamen der Fotos, z. B. referenzen/<slug>/01 */
  photos: string[];
};
export type CertItem = { name: string; title: string; issuer: string; year: string; hidden: boolean; thumb?: string; isNew?: boolean };
export type LogoChange = { logo: string; background: 'hell' | 'ohne'; image?: string };

export type Pending = {
  texts: TextChange[];
  styles: Record<string, StyleChange>;
  /** Kompletter neuer Stand der Elemente je geänderter Seite */
  blocks: Record<string, PageBlocks>;
  /** Grundfarben (nur wenn geändert) */
  colors: Record<string, string> | null;
  logo: LogoChange | null;
  /** Seite → Bildname */
  heroes: Record<string, string>;
  galleries: Record<string, GalleryChange>;
  projects: { added: NewProject[]; deleted: string[] };
  certificates: CertItem[] | null;
  /** Neue Dateien: Pfad im Repository → MIME-Typ (Inhalt in IndexedDB) */
  files: Record<string, string>;
};

const KEY = 'ed-pending';

const empty = (): Pending => ({
  texts: [],
  styles: {},
  blocks: {},
  colors: null,
  logo: null,
  heroes: {},
  galleries: {},
  projects: { added: [], deleted: [] },
  certificates: null,
  files: {},
});

function load(): Pending {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return value && typeof value === 'object' ? { ...empty(), ...value, projects: { ...empty().projects, ...value.projects } } : empty();
  } catch {
    return empty();
  }
}

let state = load();
const listeners = new Set<() => void>();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* Speicher voll oder gesperrt – die Änderungen bleiben bis zum Seitenwechsel im Browser */
  }
}

/* ---------------- Dateien (IndexedDB) ---------------- */
let database: Promise<IDBDatabase> | null = null;
const open = () =>
  (database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('ed-dateien', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('files');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }));

async function store<T>(mode: IDBTransactionMode, action: (files: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction('files', mode);
    const request = action(transaction.objectStore('files'));
    transaction.oncomplete = () => resolve(request.result as T);
    transaction.onerror = () => reject(transaction.error);
  });
}

const urls = new Map<string, string>();

export const pending = {
  get: () => state,
  /** Ändern, sichern und die Seitenleiste benachrichtigen */
  update(change: (draft: Pending) => void) {
    change(state);
    persist();
    listeners.forEach((listener) => listener());
  },
  onChange(listener: () => void) {
    listeners.add(listener);
  },
  /** Alles verwerfen (nach dem Speichern oder mit „Verwerfen“) */
  async clear() {
    state = empty();
    persist();
    urls.clear();
    listeners.forEach((listener) => listener());
    await store('readwrite', (files) => files.clear()).catch(() => undefined);
  },

  /** Kurzfassung für die Statuszeile */
  parts(): string[] {
    const s = state;
    const n = (count: number, one: string, many: string) => (count ? [`${count} ${count === 1 ? one : many}`] : []);
    return [
      ...n(s.texts.length, 'Text', 'Texte'),
      ...n(Object.keys(s.styles).length, 'Gestaltung', 'Gestaltungen'),
      ...n(Object.keys(s.blocks).length, 'Seite mit Elementen', 'Seiten mit Elementen'),
      ...(s.colors ? ['Farben'] : []),
      ...(s.logo ? ['Logo'] : []),
      ...n(Object.keys(s.heroes).length, 'Kopfbild', 'Kopfbilder'),
      ...n(Object.keys(s.galleries).length, 'Galerie', 'Galerien'),
      ...n(s.projects.added.length, 'neues Projekt', 'neue Projekte'),
      ...n(s.projects.deleted.length, 'gelöschtes Projekt', 'gelöschte Projekte'),
      ...(s.certificates ? ['Zertifikate'] : []),
    ];
  },
  count(): number {
    const s = state;
    return (
      s.texts.length +
      Object.keys(s.styles).length +
      Object.keys(s.blocks).length +
      (s.colors ? 1 : 0) +
      (s.logo ? 1 : 0) +
      Object.keys(s.heroes).length +
      Object.keys(s.galleries).length +
      s.projects.added.length +
      s.projects.deleted.length +
      (s.certificates ? 1 : 0)
    );
  },

  /* ---------------- Dateien ---------------- */
  /** Neue Datei vormerken (Base64 ohne „data:“-Vorspann) */
  async putFile(path: string, base64: string, mime: string) {
    await store('readwrite', (files) => files.put(base64, path));
    urls.set(path, `data:${mime};base64,${base64}`);
    pending.update((draft) => {
      draft.files[path] = mime;
    });
  },
  fileBase64: (path: string) => store<string | undefined>('readonly', (files) => files.get(path)),
  /** Vorschau-Adresse einer vorgemerkten Datei (data:-URL) – undefined, wenn es sie nicht gibt */
  async fileUrl(path: string) {
    if (urls.has(path)) return urls.get(path);
    const mime = state.files[path];
    if (!mime) return undefined;
    const base64 = await pending.fileBase64(path).catch(() => undefined);
    if (!base64) return undefined;
    const url = `data:${mime};base64,${base64}`;
    urls.set(path, url);
    return url;
  },
};

/** Pfad eines neuen Bildes zum Bildnamen (z. B. hero/neu-abc → src/assets/images/hero/neu-abc.jpg) */
export const imagePath = (name: string) => `src/assets/images/${name}.jpg`;

/** Vorschau eines vorgemerkten Bildes zum Bildnamen */
export const pendingImage = (name: string) => pending.fileUrl(imagePath(name));

/** Kurze, eindeutige Kennung für neue Dateinamen */
export const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
