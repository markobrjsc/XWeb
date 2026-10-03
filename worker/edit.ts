/**
 * Bearbeiten-Modus: speichert Änderungen aus der Website direkt als Commit im GitHub-Repository.
 * Nach jedem Commit baut Cloudflare (mit GitHub verbunden) die Seite neu – so bleiben die Änderungen dauerhaft.
 *
 *  GET  /api/edit/status/            { enabled } – ist der Bearbeiten-Modus verfügbar?
 *  POST /api/edit/texte/             { page, changes: [{ scope: 'global' | 'page', from, to }] } → src/content/edits.json
 *  POST /api/edit/galerie/           { folder, order: [..], hidden: [..] }                        → src/content/galleries.json
 *  POST /api/edit/hero/             { page, image }  – Kopfbild einer Seite                            → src/content/heroes.json
 *  POST /api/edit/farben/           { colors: { "--yellow-500": "#f3a505", … } }                    → src/styles/custom-colors.css
 *  GET  /api/edit/abstaende/         gespeicherte Gestaltung je Element (direkt aus GitHub)
 *  POST /api/edit/abstaende/        { rules: { "<Selektor>": { "margin-top": "24px", "color": "#fff", … } | null } }
 *                                   Abstände, Farben, Schrift, Ecken, Ausblenden je Element  → src/content/spacing.json
 *  GET  /api/edit/bausteine/?page=   aktueller Stand der Elemente einer Seite (direkt aus GitHub, auch vor dem Build)
 *  POST /api/edit/bausteine/        { page, zones: { "2": [Block, …] } } – Elemente einer Seite             → src/content/blocks.json
 *  PUT  /api/edit/bild/?folder=&name=  Bild als Base64-Text (vom Browser verkleinert)             → src/assets/images/<folder>/<name>
 *  PUT  /api/edit/logo-bild/?name=     eigenes Logo als Base64-Text (PNG)                          → src/assets/brand/eigene/<name>
 *  POST /api/edit/logo/             { logo, image?, background? } – Logo in der Kopfzeile            → src/content/brand.json
 *  PUT  /api/edit/zertifikat/?name=    neues Zertifikat (PDF) als Base64-Text                        → src/assets/zertifikate/<name>
 *  POST /api/edit/zertifikate/      { items: [{ name, title, issuer, year, hidden }] } – Reihenfolge,
 *                                   Angaben, Ausblenden                                → src/assets/zertifikate/zertifikate.json
 *  POST /api/edit/projekt/          { slug, service, pillar, title, summary, location?, year? } – neues Referenzprojekt
 *                                   in einer Leistungskarte (Fotos vorher per /bild/ nach referenzen/<slug>/) → src/content/referenzen/<slug>.md
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
const LOGO_DIR = 'src/assets/brand/eigene';
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
const FILE_PATTERN = /^[a-z0-9][a-z0-9_-]{0,80}\.(jpg|jpeg|png|webp)$/;
const MAX_IMAGE_BASE64 = 12 * 1024 * 1024;
const LOGO_FILE_PATTERN = /^logo-[a-z0-9-]{1,40}\.png$/;
const PDF_PATTERN = /^[a-z0-9][a-z0-9-]{0,80}\.pdf$/;
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

const contentsUrl = (env: EditEnv, path: string) =>
  `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;

const toBase64 = (text: string) => {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};
const fromBase64 = (b64: string) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), (c) => c.charCodeAt(0)));

async function readJsonFile<T>(env: EditEnv, path: string, fallback: T): Promise<{ data: T; sha?: string }> {
  const response = await fetch(`${contentsUrl(env, path)}?ref=${env.GITHUB_BRANCH ?? 'main'}`, { headers: ghHeaders(env) });
  if (response.status === 404) return { data: fallback };
  if (!response.ok) throw new Error(`GitHub (${response.status}): ${await response.text()}`);
  const file = (await response.json()) as { content: string; sha: string };
  return { data: JSON.parse(fromBase64(file.content)) as T, sha: file.sha };
}

/** Textdatei komplett ersetzen (legt sie bei Bedarf an) */
async function writeTextFile(env: EditEnv, path: string, content: string, message: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const current = await fetch(`${contentsUrl(env, path)}?ref=${env.GITHUB_BRANCH ?? 'main'}`, { headers: ghHeaders(env) });
    const sha = current.ok ? ((await current.json()) as { sha: string }).sha : undefined;
    const response = await fetch(contentsUrl(env, path), {
      method: 'PUT',
      headers: { ...ghHeaders(env), 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, content: toBase64(content), branch: env.GITHUB_BRANCH ?? 'main', ...(sha ? { sha } : {}) }),
    });
    if (response.ok) return;
    if (response.status !== 409 && response.status !== 422) throw new Error(`GitHub (${response.status}): ${await response.text()}`);
  }
  throw new Error('Speichern fehlgeschlagen – bitte erneut versuchen.');
}

/** JSON-Datei lesen, ändern, zurückschreiben – bei gleichzeitigen Änderungen bis zu 3 Versuche */
async function updateJsonFile<T>(env: EditEnv, path: string, fallback: T, mutate: (data: T) => void, message: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, sha } = await readJsonFile(env, path, fallback);
    mutate(data);
    const response = await fetch(contentsUrl(env, path), {
      method: 'PUT',
      headers: { ...ghHeaders(env), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        content: toBase64(`${JSON.stringify(data, null, 2)}\n`),
        branch: env.GITHUB_BRANCH ?? 'main',
        ...(sha ? { sha } : {}),
      }),
    });
    if (response.ok) return;
    if (response.status !== 409 && response.status !== 422) throw new Error(`GitHub (${response.status}): ${await response.text()}`);
  }
  throw new Error('Speichern fehlgeschlagen – bitte erneut versuchen.');
}

/* ------------------------------------------------------------------------ */
/* Texte                                                                     */
/* ------------------------------------------------------------------------ */
type TextChange = { scope?: unknown; from?: unknown; to?: unknown };

async function saveTexts(request: Request, env: EditEnv) {
  const body = (await request.json()) as { page?: unknown; changes?: TextChange[] };
  const page = String(body.page ?? '');
  if (!/^\/[a-z0-9/_-]*$/i.test(page)) return fail('Ungültige Seite.');

  const changes = (body.changes ?? [])
    .slice(0, 300)
    .map((change) => ({
      scope: change.scope === 'global' ? ('global' as const) : ('page' as const),
      from: normalizeText(String(change.from ?? '')).slice(0, 5000),
      to: normalizeText(String(change.to ?? '')).slice(0, 5000),
    }))
    .filter((change) => change.from && change.from !== change.to);
  if (!changes.length) return json({ ok: true, saved: 0 });

  await updateJsonFile<EditsFile>(
    env,
    EDITS_PATH,
    { global: {}, pages: {} },
    (file) => {
      file.global ??= {};
      file.pages ??= {};
      for (const { scope, from, to } of changes) {
        const map = scope === 'global' ? file.global : (file.pages[page] ??= {});
        // Schon einmal bearbeitet? Dann den ursprünglichen Schlüssel weiterführen (Original → neuester Text)
        const original = Object.keys(map).find((key) => map[key] === from) ?? from;
        if (original === to) delete map[original];
        else map[original] = to;
      }
      if (file.pages[page] && Object.keys(file.pages[page]).length === 0) delete file.pages[page];
    },
    `Texte bearbeitet: ${page} (${changes.length} ${changes.length === 1 ? 'Änderung' : 'Änderungen'})`,
  );
  return json({ ok: true, saved: changes.length });
}

/* ------------------------------------------------------------------------ */
/* Galerien                                                                  */
/* ------------------------------------------------------------------------ */
type Galleries = Record<string, { order?: string[]; hidden?: string[] }>;

async function saveGallery(request: Request, env: EditEnv) {
  const body = (await request.json()) as { folder?: unknown; order?: unknown[]; hidden?: unknown[] };
  const folder = String(body.folder ?? '');
  if (!FOLDER_PATTERN.test(folder)) return fail('Ungültiger Ordner.');
  const clean = (list: unknown[] | undefined) =>
    [...new Set((list ?? []).map(String).filter((name) => NAME_PATTERN.test(name)))].slice(0, 200);
  const order = clean(body.order);
  const hidden = clean(body.hidden);

  await updateJsonFile<Galleries>(
    env,
    GALLERIES_PATH,
    {},
    (file) => {
      file[folder] = { order, ...(hidden.length ? { hidden } : {}) };
    },
    `Galerie bearbeitet: ${folder}`,
  );
  return json({ ok: true });
}

async function saveHero(request: Request, env: EditEnv) {
  const body = (await request.json()) as { page?: unknown; image?: unknown };
  const page = String(body.page ?? '');
  const image = String(body.image ?? '').toLowerCase();
  if (!/^\/[a-z0-9/_-]*$/i.test(page) || !/^[a-z0-9][a-z0-9/_-]{0,160}$/.test(image)) return fail('Ungültige Angaben.');
  await updateJsonFile<Record<string, string>>(env, HEROES_PATH, {}, (file) => {
    file[page] = image;
  }, `Kopfbild geändert: ${page} → ${image}`);
  return json({ ok: true });
}

/* ------------------------------------------------------------------------ */
/* Farben                                                                    */
/* ------------------------------------------------------------------------ */
async function saveColors(request: Request, env: EditEnv) {
  const body = (await request.json()) as { colors?: Record<string, unknown> };
  const entries = Object.entries(body.colors ?? {})
    .filter(([name]) => COLOR_VARIABLES.has(name))
    .map(([name, value]) => [name, String(value).trim().toLowerCase()] as const)
    .filter(([name, value]) => (name === '--ink' ? /^\d{1,3} \d{1,3} \d{1,3}$/.test(value) : /^#[0-9a-f]{6}$/.test(value)));

  // Nur ein ausdrücklich leeres Objekt setzt zurück – fehlende oder ungültige Angaben werden abgelehnt
  if (!body.colors || typeof body.colors !== 'object') return fail('Farben fehlen.');
  if (Object.keys(body.colors).length > 0 && entries.length === 0) return fail('Ungültige Farbwerte.');

  const lines = entries.map(([name, value]) => `  ${name}: ${value};`).join('\n');
  const css =
    '/* Farbänderungen aus dem Bearbeiten-Modus der Website (Stift oben rechts → Farben).\n' +
    '   Diese Datei wird beim Speichern automatisch überschrieben; Standardwerte stehen in tokens.css. */\n' +
    `:root {\n${lines ? `${lines}\n` : ''}}\n`;

  await writeTextFile(env, COLORS_PATH, css, entries.length ? `Farben geändert (${entries.length} Werte)` : 'Farben auf Standard zurückgesetzt');
  return json({ ok: true, saved: entries.length });
}

/* ------------------------------------------------------------------------ */
/* Abstände                                                                  */
/* ------------------------------------------------------------------------ */
type Spacing = Record<string, Record<string, string>>;

async function saveSpacing(request: Request, env: EditEnv) {
  const body = (await request.json()) as { rules?: Record<string, Record<string, unknown> | null> };
  if (!body.rules || typeof body.rules !== 'object') return fail('Abstände fehlen.');

  const changes = Object.entries(body.rules)
    .slice(0, 200)
    .filter(([selector]) => SPACING_SELECTOR.test(selector));
  if (!changes.length) return fail('Ungültige Angaben.');

  await updateJsonFile<Spacing>(
    env,
    SPACING_PATH,
    {},
    (file) => {
      for (const [selector, props] of changes) {
        if (props === null) {
          delete file[selector];
          continue;
        }
        const next = { ...(file[selector] ?? {}) };
        for (const [prop, raw] of Object.entries(props)) {
          const rule = STYLE_PROPS[prop];
          if (!rule) continue;
          if (raw === null || raw === '') delete next[prop];
          else if (rule.test(String(raw).trim())) next[prop] = String(raw).trim();
        }
        if (Object.keys(next).length) file[selector] = next;
        else delete file[selector];
      }
    },
    `Gestaltung bearbeitet (${changes.length} ${changes.length === 1 ? 'Element' : 'Elemente'})`,
  );
  return json({ ok: true, saved: changes.length });
}

async function loadSpacing(env: EditEnv) {
  const { data } = await readJsonFile<Spacing>(env, SPACING_PATH, {});
  return json({ ok: true, rules: data });
}

/* ------------------------------------------------------------------------ */
/* Neue Referenzprojekte                                                     */
/* ------------------------------------------------------------------------ */
async function createProject(request: Request, env: EditEnv) {
  const body = (await request.json()) as Record<string, unknown>;
  const text = (key: string, max: number) => String(body[key] ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
  const slug = String(body.slug ?? '');
  const service = String(body.service ?? '');
  const pillar = String(body.pillar ?? '');
  const title = text('title', 120);
  const summary = text('summary', 500);
  const location = text('location', 80);
  const year = Number(body.year);
  if (!SLUG_PATTERN.test(slug) || slug.length > 80) return fail('Ungültiger Projektname.');
  if (!/^[a-z0-9-]{1,60}$/.test(service) || !PILLARS.has(pillar)) return fail('Ungültige Leistung.');
  if (!title || !summary) return fail('Bitte Titel und Kurzbeschreibung angeben.');
  const validYear = Number.isInteger(year) && year >= 1950 && year <= 2100;

  const path = `${PROJECTS_DIR}/${slug}.md`;
  const existing = await fetch(`${contentsUrl(env, path)}?ref=${env.GITHUB_BRANCH ?? 'main'}`, { headers: ghHeaders(env) });
  if (existing.ok) return fail('Ein Projekt mit diesem Namen gibt es schon.', 409);

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
  await writeTextFile(env, path, lines.join('\n'), `Neues Projekt: ${title} (${service})`);
  return json({ ok: true, slug });
}

/* ------------------------------------------------------------------------ */
/* Elemente                                                                  */
/* ------------------------------------------------------------------------ */
async function loadBlocks(env: EditEnv, url: URL) {
  const page = url.searchParams.get('page') ?? '';
  if (!PAGE_PATTERN.test(page)) return fail('Ungültige Seite.');
  const { data } = await readJsonFile<BlocksFile>(env, BLOCKS_PATH, {});
  return json({ ok: true, zones: sanitizePage(data[page]) });
}

async function saveBlocks(request: Request, env: EditEnv) {
  const body = (await request.json()) as { page?: unknown; zones?: unknown };
  const page = String(body.page ?? '');
  if (!PAGE_PATTERN.test(page)) return fail('Ungültige Seite.');
  if (!body.zones || typeof body.zones !== 'object') return fail('Elemente fehlen.');
  const zones = sanitizePage(body.zones);
  const count = Object.values(zones).reduce((sum, blocks) => sum + blocks.length, 0);

  await updateJsonFile<BlocksFile>(
    env,
    BLOCKS_PATH,
    {},
    (file) => {
      if (count) file[page] = zones;
      else delete file[page];
    },
    count ? `Elemente bearbeitet: ${page}` : `Elemente entfernt: ${page}`,
  );
  return json({ ok: true, zones });
}

/** Bild als Datei committen – der Base64-Text wird unverändert durchgereicht (kostet kaum Rechenzeit) */
async function uploadImage(request: Request, env: EditEnv, url: URL) {
  const folder = url.searchParams.get('folder') ?? '';
  const name = (url.searchParams.get('name') ?? '').toLowerCase();
  if (!FOLDER_PATTERN.test(folder) || !FILE_PATTERN.test(name)) return fail('Ungültiger Ordner oder Dateiname.');
  const error = await uploadFile(request, env, `src/assets/images/${folder}/${name}`, `Bild hinzugefügt: ${folder}/${name}`);
  return error ?? json({ ok: true, name: name.replace(/\.[^.]+$/, '') });
}

/** Eigenes Logo (PNG, im Browser verkleinert) → src/assets/brand/eigene/ */
async function uploadLogo(request: Request, env: EditEnv, url: URL) {
  const name = (url.searchParams.get('name') ?? '').toLowerCase();
  if (!LOGO_FILE_PATTERN.test(name)) return fail('Ungültiger Dateiname.');
  const error = await uploadFile(request, env, `${LOGO_DIR}/${name}`, `Logo hochgeladen: ${name}`);
  return error ?? json({ ok: true, name });
}

/** Neues Zertifikat (PDF) → src/assets/zertifikate/ – die Seitenbilder erzeugt der Build */
async function uploadCertificate(request: Request, env: EditEnv, url: URL) {
  const name = (url.searchParams.get('name') ?? '').toLowerCase();
  if (!PDF_PATTERN.test(name)) return fail('Ungültiger Dateiname.');
  const error = await uploadFile(request, env, `${CERTS_DIR}/${name}`, `Zertifikat hochgeladen: ${name}`);
  return error ?? json({ ok: true, name: name.replace(/\.pdf$/, '') });
}

/** Logo in der Kopfzeile: Design, eigenes Bild, Hintergrund → src/content/brand.json */
async function saveLogo(request: Request, env: EditEnv) {
  const body = (await request.json()) as { logo?: unknown; image?: unknown; background?: unknown };
  const logo = String(body.logo ?? '');
  const image = body.image === undefined ? undefined : String(body.image);
  if (!LOGO_DESIGNS.has(logo)) return fail('Unbekanntes Logo-Design.');
  if (image !== undefined && !LOGO_FILE_PATTERN.test(image)) return fail('Ungültiges Logo-Bild.');
  await updateJsonFile<Record<string, string>>(
    env,
    BRAND_PATH,
    {},
    (file) => {
      file.logo = logo;
      if (image) file.image = image;
      file.background = body.background === 'ohne' ? 'ohne' : 'hell';
    },
    `Logo geändert: ${logo}`,
  );
  return json({ ok: true });
}

/** Zertifikate: Reihenfolge, Titel, Aussteller, Jahr, ausgeblendet → src/assets/zertifikate/zertifikate.json */
async function saveCertificates(request: Request, env: EditEnv) {
  const body = (await request.json()) as { items?: unknown[] };
  if (!Array.isArray(body.items)) return fail('Zertifikate fehlen.');
  const text = (value: unknown, max: number) => normalizeText(String(value ?? '')).slice(0, max);
  const items = body.items
    .slice(0, 100)
    .map((raw) => raw as Record<string, unknown>)
    .map((item) => ({ name: String(item.name ?? ''), title: text(item.title, 300), issuer: text(item.issuer, 300), year: text(item.year, 20), hidden: item.hidden === true }))
    .filter((item) => /^[a-z0-9][a-z0-9-]{0,80}$/.test(item.name));
  await updateJsonFile<Record<string, Record<string, unknown>>>(
    env,
    CERTS_INFO_PATH,
    {},
    (file) => {
      // Neu aufbauen – die Reihenfolge der Einträge ist die Reihenfolge auf der Seite
      const next: Record<string, Record<string, unknown>> = {};
      for (const { name, title, issuer, year, hidden } of items) {
        next[name] = { ...(title ? { title } : {}), ...(issuer ? { issuer } : {}), ...(year ? { year } : {}), ...(hidden ? { hidden: true } : {}) };
      }
      for (const key of Object.keys(file)) delete file[key];
      Object.assign(file, next);
    },
    `Zertifikate bearbeitet (${items.length})`,
  );
  return json({ ok: true });
}

/**
 * Datei als Base64-Text aus dem Anfrage-Körper direkt an GitHub weiterreichen (ohne sie im Worker zu puffern).
 * Liefert eine Fehlerantwort oder null bei Erfolg.
 */
async function uploadFile(request: Request, env: EditEnv, path: string, message: string): Promise<Response | null> {
  const length = Number(request.headers.get('Content-Length'));
  if (!request.body || !Number.isFinite(length) || length <= 0) return fail('Datei fehlt.');
  if (length > MAX_IMAGE_BASE64) return fail('Die Datei ist zu groß (höchstens ca. 9 MB).', 413);

  const encoder = new TextEncoder();
  const prefix = encoder.encode(
    `{"message":${JSON.stringify(message)},"branch":${JSON.stringify(env.GITHUB_BRANCH ?? 'main')},"content":"`,
  );
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

  const response = await fetch(contentsUrl(env, path), {
    method: 'PUT',
    headers: { ...ghHeaders(env), 'Content-Type': 'application/json' },
    body: readable,
  });
  await pump;
  if (!response.ok) {
    const detail = await response.text();
    console.error('GitHub-Upload', response.status, detail);
    return fail(response.status === 422 ? 'Eine Datei mit diesem Namen gibt es schon.' : 'Hochladen fehlgeschlagen.', 502);
  }
  return null;
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
    if (pathname === '/api/edit/texte' && request.method === 'POST') return await saveTexts(request, env);
    if (pathname === '/api/edit/galerie' && request.method === 'POST') return await saveGallery(request, env);
    if (pathname === '/api/edit/hero' && request.method === 'POST') return await saveHero(request, env);
    if (pathname === '/api/edit/farben' && request.method === 'POST') return await saveColors(request, env);
    if (pathname === '/api/edit/abstaende' && request.method === 'POST') return await saveSpacing(request, env);
    if (pathname === '/api/edit/abstaende' && request.method === 'GET') return await loadSpacing(env);
    if (pathname === '/api/edit/projekt' && request.method === 'POST') return await createProject(request, env);
    if (pathname === '/api/edit/bausteine' && request.method === 'GET') return await loadBlocks(env, url);
    if (pathname === '/api/edit/bausteine' && request.method === 'POST') return await saveBlocks(request, env);
    if (pathname === '/api/edit/bild' && request.method === 'PUT') return await uploadImage(request, env, url);
    if (pathname === '/api/edit/logo-bild' && request.method === 'PUT') return await uploadLogo(request, env, url);
    if (pathname === '/api/edit/logo' && request.method === 'POST') return await saveLogo(request, env);
    if (pathname === '/api/edit/zertifikat' && request.method === 'PUT') return await uploadCertificate(request, env, url);
    if (pathname === '/api/edit/zertifikate' && request.method === 'POST') return await saveCertificates(request, env);
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : '';
    if (/\((401|403)\)/.test(message)) return fail('GitHub-Schlüssel fehlt, ist abgelaufen oder hat keine Schreibrechte.', 502);
    return fail(message.startsWith('GitHub') ? 'GitHub hat das Speichern abgelehnt – bitte erneut versuchen.' : message || 'Speichern fehlgeschlagen.', 502);
  }
  return fail('Nicht gefunden.', 404);
}
