/**
 * Bearbeiten-Modus: speichert Änderungen aus der Website direkt als Commit im GitHub-Repository.
 * Nach jedem Commit baut Cloudflare (mit GitHub verbunden) die Seite neu – so bleiben die Änderungen dauerhaft.
 *
 *  GET  /api/edit/status/            { enabled } – ist der Bearbeiten-Modus verfügbar?
 *  POST /api/edit/texte/             { page, changes: [{ scope: 'global' | 'page', from, to }] } → src/content/edits.json
 *  POST /api/edit/galerie/           { folder, order: [..], hidden: [..] }                        → src/content/galleries.json
 *  PUT  /api/edit/bild/?folder=&name=  Bild als Base64-Text (vom Browser verkleinert)             → src/assets/images/<folder>/<name>
 *
 * Einrichtung: GitHub-Token (Fine-grained, nur dieses Repository, „Contents: Read and write“)
 *   npx wrangler secret put GITHUB_TOKEN
 * Abschalten (z. B. für den Livegang): in wrangler.jsonc "EDIT_MODE": "0" setzen.
 * Achtung: Ohne Zugangsschutz kann jeder, der die Adresse kennt, Inhalte ändern.
 */
import { normalizeText } from '../src/lib/text';

type EditsFile = { global: Record<string, string>; pages: Record<string, Record<string, string>> };

export interface EditEnv {
  GITHUB_TOKEN?: string;
  /** z. B. "markobrjsc/XWeb" */
  GITHUB_REPO?: string;
  GITHUB_BRANCH?: string;
  /** "0" schaltet den Bearbeiten-Modus ab */
  EDIT_MODE?: string;
}

declare const FixedLengthStream: {
  new (length: number): { readable: ReadableStream; writable: WritableStream };
};

const EDITS_PATH = 'src/content/edits.json';
const GALLERIES_PATH = 'src/content/galleries.json';
const FOLDER_PATTERN = /^[a-z0-9-]+(\/[a-z0-9-]+){0,2}$/;
const NAME_PATTERN = /^[a-z0-9][a-z0-9_-]{0,80}$/;
const FILE_PATTERN = /^[a-z0-9][a-z0-9_-]{0,80}\.(jpg|jpeg|png|webp)$/;
const MAX_IMAGE_BASE64 = 12 * 1024 * 1024;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
const fail = (message: string, status = 400) => json({ ok: false, error: message }, status);

const enabled = (env: EditEnv) => Boolean(env.GITHUB_TOKEN && env.GITHUB_REPO) && env.EDIT_MODE !== '0';

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

/** Bild als Datei committen – der Base64-Text wird unverändert durchgereicht (kostet kaum Rechenzeit) */
async function uploadImage(request: Request, env: EditEnv, url: URL) {
  const folder = url.searchParams.get('folder') ?? '';
  const name = (url.searchParams.get('name') ?? '').toLowerCase();
  const length = Number(request.headers.get('Content-Length'));
  if (!FOLDER_PATTERN.test(folder) || !FILE_PATTERN.test(name)) return fail('Ungültiger Ordner oder Dateiname.');
  if (!request.body || !Number.isFinite(length) || length <= 0) return fail('Bild fehlt.');
  if (length > MAX_IMAGE_BASE64) return fail('Das Bild ist zu groß.', 413);

  const encoder = new TextEncoder();
  const prefix = encoder.encode(
    `{"message":${JSON.stringify(`Bild hinzugefügt: ${folder}/${name}`)},"branch":${JSON.stringify(env.GITHUB_BRANCH ?? 'main')},"content":"`,
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

  const response = await fetch(contentsUrl(env, `src/assets/images/${folder}/${name}`), {
    method: 'PUT',
    headers: { ...ghHeaders(env), 'Content-Type': 'application/json' },
    body: readable,
  });
  await pump;
  if (!response.ok) {
    const detail = await response.text();
    console.error('GitHub-Upload', response.status, detail);
    return fail(response.status === 422 ? 'Ein Bild mit diesem Namen gibt es schon.' : 'Hochladen fehlgeschlagen.', 502);
  }
  return json({ ok: true, name: name.replace(/\.[^.]+$/, '') });
}

/* ------------------------------------------------------------------------ */
export async function handleEdit(request: Request, env: EditEnv, url: URL, pathname: string): Promise<Response | null> {
  if (pathname === '/api/edit/status') return json({ enabled: enabled(env) });
  if (!pathname.startsWith('/api/edit/')) return null;
  if (!enabled(env)) return fail('Der Bearbeiten-Modus ist nicht eingerichtet.', 503);

  try {
    if (pathname === '/api/edit/texte' && request.method === 'POST') return await saveTexts(request, env);
    if (pathname === '/api/edit/galerie' && request.method === 'POST') return await saveGallery(request, env);
    if (pathname === '/api/edit/bild' && request.method === 'PUT') return await uploadImage(request, env, url);
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : '';
    if (/\((401|403)\)/.test(message)) return fail('GitHub-Schlüssel fehlt, ist abgelaufen oder hat keine Schreibrechte.', 502);
    return fail(message.startsWith('GitHub') ? 'GitHub hat das Speichern abgelehnt – bitte erneut versuchen.' : message || 'Speichern fehlgeschlagen.', 502);
  }
  return fail('Nicht gefunden.', 404);
}
