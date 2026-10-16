/**
 * Bearbeiten-Modus: Änderungen aus der Website landen als Commit im GitHub-Repository; Cloudflare (mit GitHub
 * verbunden) baut die Seite danach neu – so bleiben sie dauerhaft.
 *
 * Alles wird zuerst nur im Browser vorgemerkt (src/scripts/editor/pending.ts) und mit „Speichern“ in EINEM Commit
 * übernommen – ein Build pro Speichern, egal auf wie vielen Seiten bearbeitet wurde.
 *
 *  GET  /api/edit/status/            { enabled, loggedIn } – ist der Bearbeiten-Modus verfügbar?
 *  POST /api/edit/login/ · /logout/  Anmeldung mit Passwort (signiertes Cookie)
 *  GET  /api/edit/abstaende/         gespeicherte Gestaltung je Element (direkt aus GitHub)
 *  GET  /api/edit/bausteine/?page=   aktueller Stand der Elemente einer Seite (direkt aus GitHub, auch vor dem Build)
 *  PUT  /api/edit/datei/?path=       Bild/Logo/PDF als Base64-Text → Git-Blob (noch kein Commit) → { sha }
 *  POST /api/edit/speichern/         alles in einem Commit:
 *         dateien     [{ path, sha }]                                   Bilder, Logo, PDFs (vorher als Blob hochgeladen)
 *         texte       [{ scope, page, from, to }]                       → src/content/edits.json
 *         galerien    { "<Ordner>": { order, hidden } }                 → src/content/galleries.json
 *         kopfbilder  { "<Seite>": "<Bild>" }                           → src/content/heroes.json
 *         farben      { "--yellow-500": "#f3a505", … } ({} = Standard)  → src/styles/custom-colors.css
 *         gestaltung  { "<Selektor>": { "margin-top": "24px", … } | null } → src/content/spacing.json
 *         elemente    { "<Seite>": { "2": [Block, …] } }                 → src/content/blocks.json
 *         logo        { logo, image?, background? }                     → src/content/brand.json
 *         zertifikate [{ name, title, issuer, year, hidden }]           → src/assets/zertifikate/zertifikate.json
 *         projekte    { added: [{ slug, service, pillar, title, summary, location?, year? }], deleted: [slug] }
 *                                                                       → src/content/referenzen/<slug>.md (+ Fotos)
 *
 * Einrichtung: GitHub-Token (Fine-grained, nur dieses Repository, „Contents: Read and write“)
 *   npx wrangler secret put GITHUB_TOKEN
 * Abschalten (z. B. für den Livegang): in wrangler.jsonc "EDIT_MODE": "0" setzen.
 * Achtung: Ohne Zugangsschutz kann jeder, der die Adresse kennt, Inhalte ändern.
 */
import { type BlocksFile, sanitizePage } from '../src/lib/blocks/schema';
import { normalizeText } from '../src/lib/text';

type EditsFile = { global: Record<string, string>; pages: Record<string, Record<string, string>> };

export interface EditEnv {
  GITHUB_TOKEN?: string;
  /** z. B. "markobrjsc/XWeb" */
  GITHUB_REPO?: string;
  GITHUB_BRANCH?: string;
  /** "0" schaltet den Bearbeiten-Modus ab */
  EDIT_MODE?: string;
  /** Passwort-Hash "pbkdf2$<Runden>$<Salz>$<Hash>" (Base64) – erzeugen mit `npm run edit-password` */
  EDIT_PASSWORD_HASH?: string;
  /** Fehlversuche je IP (Sperre nach zu vielen falschen Passwörtern) */
  UPLOADS?: KVNamespace;
}

declare const FixedLengthStream: {
  new (length: number): { readable: ReadableStream; writable: WritableStream };
};

const EDITS_PATH = 'src/content/edits.json';
const GALLERIES_PATH = 'src/content/galleries.json';
const HEROES_PATH = 'src/content/heroes.json';
const COLORS_PATH = 'src/styles/custom-colors.css';
const SPACING_PATH = 'src/content/spacing.json';
const BLOCKS_PATH = 'src/content/blocks.json';
const BRAND_PATH = 'src/content/brand.json';
const CERTS_DIR = 'src/assets/zertifikate';
const CERTS_INFO_PATH = `${CERTS_DIR}/zertifikate.json`;
const PAGE_PATTERN = /^\/[a-z0-9/_-]*$/i;

/** Gestaltung je Element: erlaubte Eigenschaften und Werte (gleiche Regeln wie scripts/build-spacing.mjs) */
const LENGTH = /^(-?\d{1,4}(\.\d{1,3})?(px|rem|em|%)|0|auto)$/;
const COLOR = /^(#[0-9a-f]{6}|transparent)$/i;
const STYLE_PROPS: Record<string, RegExp> = {
  'margin-top': LENGTH,
  'margin-right': LENGTH,
  'margin-bottom': LENGTH,
  'margin-left': LENGTH,
  'padding-top': LENGTH,
  'padding-right': LENGTH,
  'padding-bottom': LENGTH,
  'padding-left': LENGTH,
  color: COLOR,
  'background-color': COLOR,
  'font-size': /^\d{1,3}(\.\d{1,2})?(px|rem)$/,
  'font-weight': /^[1-9]00$/,
  'text-align': /^(left|center|right|justify)$/,
  'border-radius': /^\d{1,4}(px|%)$/,
  'max-width': /^(\d{1,4}px|none)$/,
  gap: LENGTH,
  /** Design Hell/Dunkel: Fläche, Schrift bzw. Bild (src/lib/tone-css.mjs) */
  tone: /^(light|dark)$/,
  ink: /^(light|dark)$/,
  shade: /^(light|dark)$/,
  /** Ausblenden: all | mobile | desktop (wird zu display: none, im Bearbeiten-Modus nur abgeblendet) */
  hide: /^(all|mobile|desktop)$/,
};
const SPACING_SELECTOR = /^[a-zA-Z0-9\s\-_.#[\]="/:>()*,]{1,500}$/;
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+){0,12}$/;
const PILLARS = new Set(['gartenbau', 'tiefbau', 'strassenbau']);
const PROJECTS_DIR = 'src/content/referenzen';

/** Farb-Variablen, die der Bearbeiten-Modus setzen darf (Standardwerte: src/styles/tokens.css) */
const COLOR_VARIABLES = new Set([
  '--yellow-50',
  '--yellow-100',
  '--yellow-300',
  '--yellow-500',
  '--yellow-600',
  '--yellow-700',
  '--onyx-600',
  '--onyx-800',
  '--onyx-900',
  '--onyx-950',
  '--gray-50',
  '--ink',
  /** Schrift auf der Akzentfarbe (Buttons, Markierungen) – dunkel oder weiß, je nach Akzent */
  '--color-cta-fg',
  '--color-highlight',
]);
const FOLDER_PATTERN = /^[a-z0-9-]+(\/[a-z0-9-]+){0,2}$/;
const NAME_PATTERN = /^[a-z0-9][a-z0-9_-]{0,80}$/;
const MAX_IMAGE_BASE64 = 12 * 1024 * 1024;
const LOGO_FILE_PATTERN = /^logo-[a-z0-9-]{1,40}\.png$/;
/** Logo-Designs (src/lib/logo.ts) */
const LOGO_DESIGNS = new Set(['standard', 'band', 'badge', 'schrift', 'monogramm', 'maskottchen', 'eigenes']);

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
const fail = (message: string, status = 400) => json({ ok: false, error: message }, status);

const enabled = (env: EditEnv) =>
  Boolean(env.GITHUB_TOKEN && env.GITHUB_REPO && env.EDIT_PASSWORD_HASH) && env.EDIT_MODE !== '0';

/* ------------------------------------------------------------------------ */
/* Anmeldung                                                                 */
/* ------------------------------------------------------------------------ */
// Das Passwort wird nur hier im Worker geprüft (PBKDF2, Einweg-Hash) – der Hash liegt als Secret
// im Worker, nie im Browser. Danach gilt ein signiertes Cookie; ohne es lehnt jede /api/edit/-Anfrage ab.
const SESSION_COOKIE = 'ed_session';
const SESSION_SECONDS = 12 * 60 * 60;
const MAX_FAILS = 5;
const LOCK_SECONDS = 15 * 60;

const b64 = (bytes: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unb64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

/** Vergleich in konstanter Zeit, damit die Antwortzeit nichts verrät */
function sameBytes(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function checkPassword(password: string, stored: string) {
  const [scheme, rounds, salt, hash] = stored.split('$');
  if (scheme !== 'pbkdf2' || !rounds || !salt || !hash) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: unb64(salt), iterations: Number(rounds) },
    key,
    256,
  );
  return sameBytes(new Uint8Array(bits), unb64(hash));
}

/** Signaturschlüssel aus dem Passwort-Hash – ein neues Passwort meldet automatisch alle Sitzungen ab */
const sessionKey = (env: EditEnv) =>
  crypto.subtle.importKey('raw', new TextEncoder().encode(`session:${env.EDIT_PASSWORD_HASH}`), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);

async function createSession(env: EditEnv) {
  const expires = String(Math.floor(Date.now() / 1000) + SESSION_SECONDS);
  const signature = await crypto.subtle.sign('HMAC', await sessionKey(env), new TextEncoder().encode(expires));
  return `${expires}.${b64(signature).replace(/=+$/, '')}`;
}

async function hasSession(request: Request, env: EditEnv) {
  const cookie = request.headers.get('Cookie') ?? '';
  const value = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`))?.[1];
  const [expires, signature] = value?.split('.') ?? [];
  if (!expires || !signature || Number(expires) < Date.now() / 1000) return false;
  try {
    const padded = signature + '='.repeat((4 - (signature.length % 4)) % 4);
    return await crypto.subtle.verify('HMAC', await sessionKey(env), unb64(padded), new TextEncoder().encode(expires));
  } catch {
    return false;
  }
}

const sessionCookie = (value: string, maxAge: number) =>
  `${SESSION_COOKIE}=${value}; Path=/api/edit; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;

async function login(request: Request, env: EditEnv) {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unbekannt';
  const failKey = `login-fail:${ip}`;
  const fails = Number((await env.UPLOADS?.get(failKey)) ?? 0);
  if (fails >= MAX_FAILS) return fail('Zu viele Fehlversuche – bitte in 15 Minuten erneut versuchen.', 429);

  let password = '';
  try {
    password = String(((await request.json()) as { password?: unknown }).password ?? '');
  } catch {
    return fail('Ungültige Anfrage.');
  }
  if (!password || password.length > 200 || !(await checkPassword(password, env.EDIT_PASSWORD_HASH!))) {
    await env.UPLOADS?.put(failKey, String(fails + 1), { expirationTtl: LOCK_SECONDS });
    return fail('Falsches Passwort.', 401);
  }
  await env.UPLOADS?.delete(failKey);
  const response = json({ ok: true });
  response.headers.append('Set-Cookie', sessionCookie(await createSession(env), SESSION_SECONDS));
  return response;
}

/* ------------------------------------------------------------------------ */
/* GitHub                                                                    */
/* ------------------------------------------------------------------------ */
const ghHeaders = (env: EditEnv) => ({
  Authorization: `Bearer ${env.GITHUB_TOKEN}`,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'hildebrand-website-editor',
  'X-GitHub-Api-Version': '2022-11-28',
});

const repoUrl = (env: EditEnv, path: string) => `https://api.github.com/repos/${env.GITHUB_REPO}/${path}`;
const encodePath = (path: string) => path.split('/').map(encodeURIComponent).join('/');
const mainBranch = (env: EditEnv) => env.GITHUB_BRANCH ?? 'main';

/** GitHub-API als JSON – 404, 409 und 422 kommen als Status zurück, alles andere wirft */
async function github<T>(env: EditEnv, path: string, init: RequestInit = {}): Promise<{ status: number; data: T }> {
  const response = await fetch(repoUrl(env, path), {
    ...init,
    headers: { ...ghHeaders(env), ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
  });
  if (!response.ok && ![404, 409, 422].includes(response.status)) {
    throw new Error(`GitHub (${response.status}): ${await response.text()}`);
  }
  return { status: response.status, data: (await response.json().catch(() => null)) as T };
}

/** Datei als Text lesen (null = gibt es nicht) – roh statt Base64, klappt auch bei großen Dateien */
async function readText(env: EditEnv, path: string, ref: string): Promise<string | null> {
  const response = await fetch(`${repoUrl(env, `contents/${encodePath(path)}`)}?ref=${encodeURIComponent(ref)}`, {
    headers: { ...ghHeaders(env), Accept: 'application/vnd.github.raw+json' },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GitHub (${response.status}): ${await response.text()}`);
  return response.text();
}

async function readJsonFile<T>(env: EditEnv, path: string, fallback: T): Promise<T> {
  const text = await readText(env, path, mainBranch(env));
  return text ? (JSON.parse(text) as T) : fallback;
}

/*
 * Sammel-Commit: Alles, was im Bearbeiten-Modus vorgemerkt wurde (auch auf anderen Seiten), geht mit einem Klick auf
 * „Speichern“ als EIN Commit auf main – Cloudflare baut dann genau einmal. Gelesen wird vom Stand, auf dem der Commit
 * aufsetzt; hat sich main inzwischen bewegt, wird alles auf dem neuen Stand wiederholt.
 */
type TreeEntry = { path: string; mode: '100644'; type: 'blob'; sha?: string | null; content?: string };

class Changes {
  private base = '';
  private baseTree = '';
  private readonly entries = new Map<string, TreeEntry>();
  private readonly cache = new Map<string, string | null>();
  /** Für die Commit-Nachricht */
  readonly summary: string[] = [];

  constructor(private readonly env: EditEnv) {}

  async begin() {
    const ref = await github<{ object: { sha: string } }>(this.env, `git/ref/heads/${encodePath(mainBranch(this.env))}`);
    this.base = ref.data.object.sha;
    const commit = await github<{ tree: { sha: string } }>(this.env, `git/commits/${this.base}`);
    this.baseTree = commit.data.tree.sha;
  }

  /** Inhalt einer Textdatei – mit den Änderungen dieses Speicherns */
  async text(path: string): Promise<string | null> {
    const entry = this.entries.get(path);
    if (entry) return entry.sha === null ? null : (entry.content ?? '');
    if (!this.cache.has(path)) this.cache.set(path, await readText(this.env, path, this.base));
    return this.cache.get(path) ?? null;
  }

  async json<T>(path: string, fallback: T): Promise<T> {
    const text = await this.text(path);
    return text ? (JSON.parse(text) as T) : fallback;
  }

  write(path: string, content: string) {
    this.entries.set(path, { path, mode: '100644', type: 'blob', content });
  }

  writeJson(path: string, data: unknown) {
    this.write(path, `${JSON.stringify(data, null, 2)}\n`);
  }

  /** Datei aus einem vorher hochgeladenen Blob (Bilder, PDFs) */
  blob(path: string, sha: string) {
    this.entries.set(path, { path, mode: '100644', type: 'blob', sha });
  }

  /** Löschen – Dateien des letzten Stands werden entfernt, gerade erst hinzugefügte fallen einfach weg */
  remove(path: string, existed: boolean) {
    if (existed) this.entries.set(path, { path, mode: '100644', type: 'blob', sha: null });
    else this.entries.delete(path);
  }

  /** Dateien direkt in einem Ordner: letzter Stand plus in diesem Speichern hinzugefügte */
  async list(dir: string) {
    const { status, data } = await github<{ path: string; type: string }[]>(this.env, `contents/${encodePath(dir)}?ref=${this.base}`);
    const existing = status === 200 && Array.isArray(data) ? data.filter((item) => item.type === 'file').map((item) => item.path) : [];
    const added = [...this.entries.keys()].filter(
      (path) => path.startsWith(`${dir}/`) && !path.slice(dir.length + 1).includes('/') && !existing.includes(path),
    );
    return [...existing.map((path) => ({ path, existed: true })), ...added.map((path) => ({ path, existed: false }))];
  }

  get size() {
    return this.entries.size;
  }

  /** Ein Commit mit allen Änderungen auf main – false, wenn main sich inzwischen bewegt hat */
  async commit(message: string) {
    const tree = await github<{ sha: string; message?: string }>(this.env, 'git/trees', {
      method: 'POST',
      body: JSON.stringify({ base_tree: this.baseTree, tree: [...this.entries.values()] }),
    });
    if (tree.status !== 201) throw new Error(`GitHub (${tree.status}): ${tree.data?.message ?? 'Baum'}`);
    const commit = await github<{ sha: string; message?: string }>(this.env, 'git/commits', {
      method: 'POST',
      body: JSON.stringify({ message, tree: tree.data.sha, parents: [this.base] }),
    });
    if (commit.status !== 201) throw new Error(`GitHub (${commit.status}): ${commit.data?.message ?? 'Commit'}`);
    const update = await github(this.env, `git/refs/heads/${encodePath(mainBranch(this.env))}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha: commit.data.sha, force: false }),
    });
    return update.status === 200;
  }
}

/** Ein Teil des Speicherns: Fehlermeldung oder null */
type Step = (tx: Changes, input: unknown) => Promise<string | null>;
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/* ------------------------------------------------------------------------ */
/* Dateien (Bilder, Logo, PDFs)                                              */
/* ------------------------------------------------------------------------ */
/** Wohin Dateien aus dem Bearbeiten-Modus dürfen */
const FILE_PATHS = [
  /^src\/assets\/images\/[a-z0-9-]+(\/[a-z0-9-]+){0,2}\/[a-z0-9][a-z0-9_-]{0,80}\.(jpg|jpeg|png|webp)$/,
  /^src\/assets\/brand\/eigene\/logo-[a-z0-9-]{1,40}\.png$/,
  /^src\/assets\/zertifikate\/[a-z0-9][a-z0-9-]{0,80}\.pdf$/,
];
const allowedFile = (path: string) => FILE_PATHS.some((pattern) => pattern.test(path));

/**
 * Datei als Base64-Text aus dem Anfrage-Körper direkt als Git-Blob an GitHub weiterreichen (ohne sie im Worker zu
 * puffern – kostet kaum Rechenzeit). Ein Blob ist noch kein Commit: Er landet erst mit „Speichern“ im Repository.
 */
async function uploadBlob(request: Request, env: EditEnv, url: URL) {
  const path = url.searchParams.get('path') ?? '';
  if (!allowedFile(path)) return fail('Ungültiger Dateiname.');
  const length = Number(request.headers.get('Content-Length'));
  if (!request.body || !Number.isFinite(length) || length <= 0) return fail('Datei fehlt.');
  if (length > MAX_IMAGE_BASE64) return fail('Die Datei ist zu groß (höchstens ca. 9 MB).', 413);

  const encoder = new TextEncoder();
  const prefix = encoder.encode('{"encoding":"base64","content":"');
  const suffix = encoder.encode('"}');
  const { readable, writable } = new FixedLengthStream(prefix.length + length + suffix.length);

  const pump = (async () => {
    const writer = writable.getWriter();
    await writer.write(prefix);
    const reader = request.body!.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      await writer.write(value);
    }
    await writer.write(suffix);
    await writer.close();
  })();

  const response = await fetch(repoUrl(env, 'git/blobs'), {
    method: 'POST',
    headers: { ...ghHeaders(env), 'Content-Type': 'application/json' },
    body: readable,
  });
  await pump;
  if (!response.ok) {
    console.error('GitHub-Upload', response.status, await response.text());
    return fail('Hochladen fehlgeschlagen.', 502);
  }
  const { sha } = (await response.json()) as { sha: string };
  return json({ ok: true, sha });
}

const applyFiles: Step = async (tx, input) => {
  const files = Array.isArray(input) ? input.slice(0, 300).map(record) : [];
  for (const file of files) {
    const path = String(file.path ?? '');
    const sha = String(file.sha ?? '');
    if (!allowedFile(path) || !/^[0-9a-f]{40}$/.test(sha)) return 'Ungültige Datei.';
    tx.blob(path, sha);
  }
  return null;
};

/* ------------------------------------------------------------------------ */
/* Texte                                                                     */
/* ------------------------------------------------------------------------ */
const applyTexts: Step = async (tx, input) => {
  const changes = (Array.isArray(input) ? input : [])
    .slice(0, 500)
    .map(record)
    .map((change) => ({
      scope: change.scope === 'global' ? ('global' as const) : ('page' as const),
      page: String(change.page ?? ''),
      from: normalizeText(String(change.from ?? '')).slice(0, 5000),
      to: normalizeText(String(change.to ?? '')).slice(0, 5000),
    }))
    .filter((change) => change.from && change.from !== change.to && PAGE_PATTERN.test(change.page));
  if (!changes.length) return null;

  const file = await tx.json<EditsFile>(EDITS_PATH, { global: {}, pages: {} });
  file.global ??= {};
  file.pages ??= {};
  for (const { scope, page, from, to } of changes) {
    const map = scope === 'global' ? file.global : (file.pages[page] ??= {});
    // Schon einmal bearbeitet? Dann den ursprünglichen Schlüssel weiterführen (Original → neuester Text)
    const original = Object.keys(map).find((key) => map[key] === from) ?? from;
    if (original === to) delete map[original];
    else map[original] = to;
    if (scope === 'page' && Object.keys(map).length === 0) delete file.pages[page];
  }
  tx.writeJson(EDITS_PATH, file);
  tx.summary.push(plural(changes.length, 'Text', 'Texte'));
  return null;
};

/* ------------------------------------------------------------------------ */
/* Galerien und Kopfbilder                                                   */
/* ------------------------------------------------------------------------ */
type Galleries = Record<string, { order?: string[]; hidden?: string[] }>;

const applyGalleries: Step = async (tx, input) => {
  const entries = Object.entries(record(input)).slice(0, 100);
  if (!entries.length) return null;
  const clean = (list: unknown) =>
    [...new Set((Array.isArray(list) ? list : []).map(String).filter((name) => NAME_PATTERN.test(name)))].slice(0, 200);
  const file = await tx.json<Galleries>(GALLERIES_PATH, {});
  for (const [folder, raw] of entries) {
    if (!FOLDER_PATTERN.test(folder)) return 'Ungültiger Galerie-Ordner.';
    const hidden = clean(record(raw).hidden);
    file[folder] = { order: clean(record(raw).order), ...(hidden.length ? { hidden } : {}) };
  }
  tx.writeJson(GALLERIES_PATH, file);
  tx.summary.push(entries.length === 1 ? `Galerie ${entries[0][0]}` : `${entries.length} Galerien`);
  return null;
};

const applyHeroes: Step = async (tx, input) => {
  const entries = Object.entries(record(input)).slice(0, 50);
  if (!entries.length) return null;
  const file = await tx.json<Record<string, string>>(HEROES_PATH, {});
  for (const [page, raw] of entries) {
    const image = String(raw ?? '').toLowerCase();
    if (!PAGE_PATTERN.test(page) || !/^[a-z0-9][a-z0-9/_-]{0,160}$/.test(image)) return 'Ungültiges Kopfbild.';
    file[page] = image;
  }
  tx.writeJson(HEROES_PATH, file);
  tx.summary.push(plural(entries.length, 'Kopfbild', 'Kopfbilder'));
  return null;
};

/* ------------------------------------------------------------------------ */
/* Farben                                                                    */
/* ------------------------------------------------------------------------ */
/** input: { "--yellow-500": "#f3a505", … } – ein leeres Objekt setzt auf die Standardfarben zurück */
const applyColors: Step = async (tx, input) => {
  if (input === undefined || input === null) return null;
  if (typeof input !== 'object' || Array.isArray(input)) return 'Ungültige Farben.';
  const entries = Object.entries(input as Record<string, unknown>)
    .filter(([name]) => COLOR_VARIABLES.has(name))
    .map(([name, value]) => [name, String(value).trim().toLowerCase()] as const)
    .filter(([name, value]) => (name === '--ink' ? /^\d{1,3} \d{1,3} \d{1,3}$/.test(value) : /^#[0-9a-f]{6}$/.test(value)));
  if (Object.keys(input).length > 0 && entries.length === 0) return 'Ungültige Farbwerte.';

  const lines = entries.map(([name, value]) => `  ${name}: ${value};`).join('\n');
  tx.write(
    COLORS_PATH,
    '/* Farbänderungen aus dem Bearbeiten-Modus der Website (Stift oben rechts → Farben).\n' +
      '   Diese Datei wird beim Speichern automatisch überschrieben; Standardwerte stehen in tokens.css. */\n' +
      `:root {\n${lines ? `${lines}\n` : ''}}\n`,
  );
  tx.summary.push(entries.length ? 'Farben' : 'Farben zurückgesetzt');
  return null;
};

/* ------------------------------------------------------------------------ */
/* Gestaltung je Element                                                     */
/* ------------------------------------------------------------------------ */
type Spacing = Record<string, Record<string, string>>;

/** input: { "<Selektor>": { "margin-top": "24px", … } | null } – null entfernt alle eigenen Werte */
const applySpacing: Step = async (tx, input) => {
  const changes = Object.entries(record(input))
    .slice(0, 300)
    .filter(([selector]) => SPACING_SELECTOR.test(selector));
  if (!changes.length) return null;
  const file = await tx.json<Spacing>(SPACING_PATH, {});
  for (const [selector, props] of changes) {
    if (props === null) {
      delete file[selector];
      continue;
    }
    const next = { ...(file[selector] ?? {}) };
    for (const [prop, raw] of Object.entries(record(props))) {
      const rule = STYLE_PROPS[prop];
      if (!rule) continue;
      if (raw === null || raw === '') delete next[prop];
      else if (rule.test(String(raw).trim())) next[prop] = String(raw).trim();
    }
    if (Object.keys(next).length) file[selector] = next;
    else delete file[selector];
  }
  tx.writeJson(SPACING_PATH, file);
  tx.summary.push(plural(changes.length, 'Gestaltung', 'Gestaltungen'));
  return null;
};

async function loadSpacing(env: EditEnv) {
  return json({ ok: true, rules: await readJsonFile<Spacing>(env, SPACING_PATH, {}) });
}

/* ------------------------------------------------------------------------ */
/* Elemente aus dem Baukasten                                                */
/* ------------------------------------------------------------------------ */
async function loadBlocks(env: EditEnv, url: URL) {
  const page = url.searchParams.get('page') ?? '';
  if (!PAGE_PATTERN.test(page)) return fail('Ungültige Seite.');
  const data = await readJsonFile<BlocksFile>(env, BLOCKS_PATH, {});
  return json({ ok: true, zones: sanitizePage(data[page]) });
}

/** input: { "<Seite>": { "2": [Block, …] } } – der komplette neue Stand je geänderter Seite */
const applyBlocks: Step = async (tx, input) => {
  const pages = Object.entries(record(input)).slice(0, 50);
  if (!pages.length) return null;
  const file = await tx.json<BlocksFile>(BLOCKS_PATH, {});
  for (const [page, raw] of pages) {
    if (!PAGE_PATTERN.test(page)) return 'Ungültige Seite.';
    const zones = sanitizePage(raw);
    if (Object.values(zones).some((blocks) => blocks.length)) file[page] = zones;
    else delete file[page];
  }
  tx.writeJson(BLOCKS_PATH, file);
  tx.summary.push(pages.length === 1 ? `Elemente ${pages[0][0]}` : `Elemente auf ${pages.length} Seiten`);
  return null;
};

/* ------------------------------------------------------------------------ */
/* Logo                                                                      */
/* ------------------------------------------------------------------------ */
/** input: { logo, image?, background? } → src/content/brand.json (das eigene Bild kommt über die Dateien) */
const applyLogo: Step = async (tx, input) => {
  if (!input) return null;
  const body = record(input);
  const logo = String(body.logo ?? '');
  const image = body.image === undefined ? undefined : String(body.image);
  if (!LOGO_DESIGNS.has(logo)) return 'Unbekanntes Logo-Design.';
  if (image !== undefined && !LOGO_FILE_PATTERN.test(image)) return 'Ungültiges Logo-Bild.';
  const file = await tx.json<Record<string, string>>(BRAND_PATH, {});
  file.logo = logo;
  if (image) file.image = image;
  file.background = body.background === 'ohne' ? 'ohne' : 'hell';
  tx.writeJson(BRAND_PATH, file);
  tx.summary.push(`Logo: ${logo}`);
  return null;
};

/* ------------------------------------------------------------------------ */
/* Zertifikate                                                               */
/* ------------------------------------------------------------------------ */
/** input: [{ name, title, issuer, year, hidden }] – Reihenfolge = Reihenfolge auf der Seite (neue PDFs über die Dateien) */
const applyCertificates: Step = async (tx, input) => {
  if (!Array.isArray(input)) return null;
  const text = (value: unknown, max: number) => normalizeText(String(value ?? '')).slice(0, max);
  const items = input
    .slice(0, 100)
    .map(record)
    .map((item) => ({ name: String(item.name ?? ''), title: text(item.title, 300), issuer: text(item.issuer, 300), year: text(item.year, 20), hidden: item.hidden === true }))
    .filter((item) => /^[a-z0-9][a-z0-9-]{0,80}$/.test(item.name));
  const next: Record<string, Record<string, unknown>> = {};
  for (const { name, title, issuer, year, hidden } of items) {
    next[name] = { ...(title ? { title } : {}), ...(issuer ? { issuer } : {}), ...(year ? { year } : {}), ...(hidden ? { hidden: true } : {}) };
  }
  tx.writeJson(CERTS_INFO_PATH, next);
  tx.summary.push(plural(items.length, 'Zertifikat', 'Zertifikate'));
  return null;
};

/* ------------------------------------------------------------------------ */
/* Referenzprojekte                                                          */
/* ------------------------------------------------------------------------ */
/**
 * input: { added: [{ slug, service, pillar, title, summary, location?, year? }], deleted: [slug] }
 * Neue Projekte: src/content/referenzen/<slug>.md (Fotos kommen über die Dateien nach referenzen/<slug>/).
 * Gelöschte: Projektdatei, Galerie-Eintrag und Fotos – Fotos, die noch woanders genutzt werden (Kopfbild, Elemente,
 * Vorlagen), bleiben liegen, damit der Build nicht bricht.
 */
const applyProjects: Step = async (tx, input) => {
  const body = record(input);
  const added = (Array.isArray(body.added) ? body.added : []).slice(0, 30).map(record);
  const deleted = [...new Set((Array.isArray(body.deleted) ? body.deleted : []).map(String))].slice(0, 30);

  for (const project of added) {
    const text = (key: string, max: number) => String(project[key] ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
    const slug = String(project.slug ?? '');
    const service = String(project.service ?? '');
    const pillar = String(project.pillar ?? '');
    const title = text('title', 120);
    const summary = text('summary', 500);
    const location = text('location', 80);
    const year = Number(project.year);
    if (!SLUG_PATTERN.test(slug) || slug.length > 80) return 'Ungültiger Projektname.';
    if (!/^[a-z0-9-]{1,60}$/.test(service) || !PILLARS.has(pillar)) return 'Ungültige Leistung.';
    if (!title || !summary) return 'Bitte Titel und Kurzbeschreibung angeben.';
    const path = `${PROJECTS_DIR}/${slug}.md`;
    if ((await tx.text(path)) !== null) return `Ein Projekt „${slug}“ gibt es schon.`;
    const validYear = Number.isInteger(year) && year >= 1950 && year <= 2100;
    // JSON-Strings sind gültige YAML-Werte (doppelte Anführungszeichen, Escapes)
    const lines = [
      '---',
      `# Angelegt im Bearbeiten-Modus. Fotos: src/assets/images/referenzen/${slug}/ (erstes Foto = Titelbild)`,
      `title: ${JSON.stringify(title)}`,
      `category: ${pillar}`,
      ...(location ? [`location: ${JSON.stringify(location)}`] : []),
      ...(validYear ? [`year: ${year}`] : []),
      `summary: ${JSON.stringify(summary)}`,
      `leistungen: [${service}]`,
      'icon: image',
      'order: 100',
      '---',
      '',
    ];
    tx.write(path, lines.join('\n'));
    tx.summary.push(`Neues Projekt: ${title}`);
  }

  for (const slug of deleted) {
    if (!SLUG_PATTERN.test(slug) || slug.length > 80) return 'Ungültiges Projekt.';
    const folder = `referenzen/${slug}`;
    const path = `${PROJECTS_DIR}/${slug}.md`;
    if ((await tx.text(path)) === null) continue;
    tx.remove(path, true);

    // Wird ein Foto des Projekts noch woanders verwendet?
    const usage = await Promise.all([HEROES_PATH, BLOCKS_PATH, 'src/lib/blocks/presets.ts'].map((file) => tx.text(file)));
    if (!usage.some((content) => content?.includes(`${folder}/`))) {
      for (const photo of await tx.list(`src/assets/images/${folder}`)) tx.remove(photo.path, photo.existed);
    }
    const galleries = await tx.json<Galleries>(GALLERIES_PATH, {});
    if (folder in galleries) {
      delete galleries[folder];
      tx.writeJson(GALLERIES_PATH, galleries);
    }
    tx.summary.push(`Projekt gelöscht: ${slug}`);
  }
  return null;
};

/* ------------------------------------------------------------------------ */
/* Speichern                                                                 */
/* ------------------------------------------------------------------------ */
/**
 * Alle vorgemerkten Änderungen in einem Commit. Dateien vorher per PUT /api/edit/datei/ hochladen.
 * Reihenfolge: Projekte zuletzt – ihr Löschen prüft, ob Fotos noch als Kopfbild oder in Elementen vorkommen.
 */
async function saveAll(request: Request, env: EditEnv) {
  if (Number(request.headers.get('Content-Length') ?? 0) > 4 * 1024 * 1024) return fail('Zu viele Änderungen auf einmal.', 413);
  const body = record(await request.json().catch(() => null));
  const steps: [Step, unknown][] = [
    [applyFiles, body.dateien],
    [applyTexts, body.texte],
    [applyGalleries, body.galerien],
    [applyHeroes, body.kopfbilder],
    [applyColors, body.farben],
    [applySpacing, body.gestaltung],
    [applyBlocks, body.elemente],
    [applyLogo, body.logo],
    [applyCertificates, body.zertifikate],
    [applyProjects, body.projekte],
  ];

  for (let attempt = 0; attempt < 3; attempt++) {
    const tx = new Changes(env);
    await tx.begin();
    for (const [step, input] of steps) {
      const error = await step(tx, input);
      if (error) return fail(error);
    }
    if (!tx.size) return json({ ok: true, saved: 0 });
    const summary = tx.summary.length ? tx.summary.join(' · ') : 'Dateien';
    if (await tx.commit(`Bearbeitet: ${summary}`)) return json({ ok: true, saved: tx.summary.length });
    // main hat sich gerade bewegt (z. B. Code-Update) – alles auf dem neuen Stand wiederholen
  }
  return fail('Gleichzeitig wurde etwas anderes gespeichert – bitte noch einmal auf „Speichern“ klicken.', 409);
}

/* ------------------------------------------------------------------------ */
export async function handleEdit(request: Request, env: EditEnv, url: URL, pathname: string): Promise<Response | null> {
  if (!pathname.startsWith('/api/edit/')) return null;
  if (!enabled(env)) {
    return pathname === '/api/edit/status' ? json({ enabled: false }) : fail('Der Bearbeiten-Modus ist nicht eingerichtet.', 503);
  }
  if (pathname === '/api/edit/status') return json({ enabled: true, loggedIn: await hasSession(request, env) });
  if (pathname === '/api/edit/login' && request.method === 'POST') return await login(request, env);
  if (pathname === '/api/edit/logout' && request.method === 'POST') {
    const response = json({ ok: true });
    response.headers.append('Set-Cookie', sessionCookie('', 0));
    return response;
  }
  if (!(await hasSession(request, env))) return fail('Bitte zuerst anmelden.', 401);

  try {
    if (pathname === '/api/edit/abstaende' && request.method === 'GET') return await loadSpacing(env);
    if (pathname === '/api/edit/bausteine' && request.method === 'GET') return await loadBlocks(env, url);
    if (pathname === '/api/edit/datei' && request.method === 'PUT') return await uploadBlob(request, env, url);
    if (pathname === '/api/edit/speichern' && request.method === 'POST') return await saveAll(request, env);
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : '';
    if (/\((401|403)\)/.test(message)) return fail('GitHub-Schlüssel fehlt, ist abgelaufen oder hat keine Schreibrechte.', 502);
    return fail(message.startsWith('GitHub') ? 'GitHub hat das Speichern abgelehnt – bitte erneut versuchen.' : message || 'Speichern fehlgeschlagen.', 502);
  }
  return fail('Nicht gefunden.', 404);
}
