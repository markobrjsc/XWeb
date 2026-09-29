/**
 * Cloudflare Worker – verschickt Kontaktanfragen und Bewerbungen über Resend (https://resend.com).
 * Er läuft nur für /api/* (siehe wrangler.jsonc → assets.run_worker_first), alle anderen Anfragen
 * beantwortet Cloudflare direkt aus dem statischen Build in ./dist.
 *
 *  PUT  /api/upload/     eine Datei (Rohdaten) → kurzzeitig im KV-Speicher UPLOADS, Antwort { id }
 *  GET  /api/datei/:id/  liefert eine hochgeladene Datei aus – von hier holt Resend die Anhänge ab
 *  POST /api/senden/     Formularfelder als JSON → Prüfung → E-Mail an MAIL_TO
 *  (Pfade enden wie alle Seiten auf „/“ – ohne Schrägstrich funktionieren sie ebenfalls)
 *
 * Warum Dateien nicht direkt mit dem Formular? Im kostenlosen Workers-Tarif stehen pro Anfrage nur 10 ms
 * Rechenzeit zur Verfügung – zu wenig, um mehrere MB zu entpacken und zu kodieren. Das Durchreichen eines
 * Datenstroms in den KV-Speicher kostet dagegen praktisch keine Rechenzeit.
 *
 * Einrichtung: siehe README.md, Abschnitt „Formulare & E-Mail-Versand“.
 */
import { site } from '../src/config/site';
import { handleEdit, type EditEnv } from './edit';
import { MIN_FILL_MS, UPLOAD_LIMITS, fileExtension, formatBytes, forms, type FormId, type FormSpec } from '../src/lib/forms';

interface KVNamespace {
  put(
    key: string,
    value: ReadableStream | string,
    options?: { expirationTtl?: number; metadata?: Record<string, unknown> },
  ): Promise<void>;
  getWithMetadata<M>(key: string, type: 'stream'): Promise<{ value: ReadableStream | null; metadata: M | null }>;
}

interface Env extends EditEnv {
  ASSETS: { fetch(request: Request): Promise<Response> };
  UPLOADS: KVNamespace;
  /** Geheimer Schlüssel von resend.com – `npx wrangler secret put RESEND_API_KEY` */
  RESEND_API_KEY?: string;
  /** Empfänger (Standard: E-Mail-Adresse aus src/config/site.ts) */
  MAIL_TO?: string;
  /** Absender – muss eine bei Resend bestätigte Domain nutzen */
  MAIL_FROM?: string;
  /** "1" = nichts verschicken, nur protokollieren (lokale Entwicklung) */
  MAIL_DRY_RUN?: string;
}

type FileMeta = { name: string; type: string; size: number };

/** Hochgeladene Dateien verfallen automatisch (Datenschutz) – Resend holt sie direkt beim Versand ab */
const UPLOAD_TTL_SECONDS = 6 * 60 * 60;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

const fail = (message: string, status = 400) => json({ ok: false, error: message }, status);

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ------------------------------------------------------------------------ */
/* Upload                                                                    */
/* ------------------------------------------------------------------------ */
async function handleUpload(request: Request, env: Env) {
  const size = Number(request.headers.get('Content-Length'));
  const name = decodeURIComponent(request.headers.get('X-File-Name') ?? '').slice(0, 180);
  const type = (request.headers.get('Content-Type') ?? 'application/octet-stream').slice(0, 100);

  if (!request.body || !name) return fail('Datei fehlt.');
  if (!Number.isFinite(size) || size <= 0) return fail('Die Datei ist leer.');
  if (size > UPLOAD_LIMITS.fileBytes) {
    return fail(`„${name}“ ist zu groß (max. ${formatBytes(UPLOAD_LIMITS.fileBytes)} pro Datei).`, 413);
  }
  if (!(UPLOAD_LIMITS.extensions as readonly string[]).includes(fileExtension(name))) {
    return fail(`Dateityp von „${name}“ wird nicht unterstützt.`, 415);
  }

  const id = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '');
  const metadata: FileMeta = { name, type, size };
  // Datenstrom direkt durchreichen – keine Verarbeitung im Worker
  await env.UPLOADS.put(`f:${id}`, request.body, { expirationTtl: UPLOAD_TTL_SECONDS, metadata });
  return json({ ok: true, id });
}

async function handleDownload(id: string, env: Env) {
  if (!/^[a-f0-9]{64}$/.test(id)) return new Response('Nicht gefunden', { status: 404 });
  const { value, metadata } = await env.UPLOADS.getWithMetadata<FileMeta>(`f:${id}`, 'stream');
  if (!value || !metadata) return new Response('Nicht gefunden', { status: 404 });
  return new Response(value, {
    headers: {
      'Content-Type': metadata.type,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(metadata.name)}`,
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
}

/* ------------------------------------------------------------------------ */
/* Formular prüfen                                                           */
/* ------------------------------------------------------------------------ */
type Payload = {
  form?: string;
  fields?: Record<string, unknown>;
  files?: { field?: unknown; id?: unknown }[];
  startedAt?: unknown;
  website?: unknown;
};

type Clean = { values: Record<string, string | string[]>; errors: string[] };

function validateFields(spec: FormSpec, input: Record<string, unknown>): Clean {
  const values: Clean['values'] = {};
  const errors: string[] = [];

  for (const [key, field] of Object.entries(spec.fields)) {
    const raw = input[key];

    if (field.kind === 'multi') {
      const list = (Array.isArray(raw) ? raw : raw ? [raw] : []).map(String);
      const picked = list.filter((item) => field.options?.includes(item));
      if (field.required && picked.length === 0) errors.push(`Bitte „${field.label}“ auswählen.`);
      if (picked.length) values[key] = [...new Set(picked)];
      continue;
    }

    const text = typeof raw === 'string' ? raw.trim().replace(/\r\n/g, '\n') : '';
    if (!text) {
      if (field.required) errors.push(`Bitte „${field.label}“ ausfüllen.`);
      continue;
    }
    if (field.max && text.length > field.max) {
      errors.push(`„${field.label}“ ist zu lang (max. ${field.max} Zeichen).`);
      continue;
    }
    if (field.kind === 'choice' && field.options && !field.options.includes(text)) {
      errors.push(`Ungültige Auswahl bei „${field.label}“.`);
      continue;
    }
    if (field.kind === 'email' && !/^[^\s@<>()",;]+@[^\s@<>()",;]+\.[a-z]{2,}$/i.test(text)) {
      errors.push('Bitte eine gültige E-Mail-Adresse angeben.');
      continue;
    }
    values[key] = text;
  }

  return { values, errors };
}

/* ------------------------------------------------------------------------ */
/* E-Mail                                                                    */
/* ------------------------------------------------------------------------ */
type Attachment = { label: string; meta: FileMeta; id: string };

function buildEmail(formId: FormId, spec: FormSpec, values: Clean['values'], attachments: Attachment[]) {
  const str = (key: string) => {
    const value = values[key];
    return Array.isArray(value) ? value.join(', ') : (value ?? '');
  };

  const subject =
    formId === 'bewerbung'
      ? `Bewerbung: ${str('stelle')} – ${str('vorname')} ${str('nachname')}`
      : `Anfrage: ${str('anliegen')}${str('bereiche') ? ` (${str('bereiche')})` : ''} – ${str('name')}`;

  const rows = Object.entries(spec.fields)
    .filter(([key]) => str(key))
    .map(([key, field]) => [field.label, str(key)] as const);

  const fileRows = attachments.map((file) => [file.label, `${file.meta.name} (${formatBytes(file.meta.size)})`] as const);

  const text = [
    `${spec.title} über die Website`,
    '',
    ...rows.map(([label, value]) => `${label}:\n${value}\n`),
    ...(fileRows.length ? ['Anhänge:', ...fileRows.map(([label, value]) => `- ${label}: ${value}`)] : []),
  ].join('\n');

  const cell = 'padding:8px 12px;border-bottom:1px solid #e3e8ef;vertical-align:top;font:14px/1.5 Arial,sans-serif;';
  const tableRows = [...rows, ...fileRows.map(([label, value]) => [`Anhang: ${label}`, value] as const)]
    .map(
      ([label, value]) =>
        `<tr><th style="${cell}text-align:left;color:#51627a;font-weight:600;width:190px">${escapeHtml(label)}</th>` +
        `<td style="${cell}color:#0b1a2e;white-space:pre-wrap">${escapeHtml(value)}</td></tr>`,
    )
    .join('');

  const html =
    `<div style="max-width:680px;margin:0 auto;font-family:Arial,sans-serif">` +
    `<h1 style="font-size:20px;color:#0b1a2e;margin:0 0 4px">${escapeHtml(spec.title)} über die Website</h1>` +
    `<p style="margin:0 0 16px;color:#51627a;font-size:14px">Antworten Sie einfach auf diese E-Mail, um direkt zu reagieren.</p>` +
    `<table style="border-collapse:collapse;width:100%;border-top:1px solid #e3e8ef">${tableRows}</table>` +
    `</div>`;

  return { subject, text, html };
}

async function handleSend(request: Request, env: Env, origin: string) {
  if (Number(request.headers.get('Content-Length') ?? 0) > 64 * 1024) return fail('Anfrage zu groß.', 413);

  let payload: Payload;
  try {
    payload = await request.json();
  } catch {
    return fail('Ungültige Anfrage.');
  }

  const formId = payload.form as FormId;
  const spec = forms[formId];
  if (!spec) return fail('Unbekanntes Formular.');

  // Spam-Schutz: verstecktes Feld ausgefüllt oder zu schnell abgeschickt → still „erfolgreich“ beenden
  const startedAt = Number(payload.startedAt);
  if (payload.website || !Number.isFinite(startedAt) || Date.now() - startedAt < MIN_FILL_MS) {
    return json({ ok: true });
  }

  const { values, errors } = validateFields(spec, payload.fields ?? {});

  // Anhänge: nur bekannte Felder, nur vorhandene Dateien, Gesamtgröße begrenzt
  const attachments: Attachment[] = [];
  const perField: Record<string, number> = {};
  for (const entry of (payload.files ?? []).slice(0, UPLOAD_LIMITS.maxFiles)) {
    const field = String(entry.field ?? '');
    const id = String(entry.id ?? '');
    const fileSpec = spec.files[field];
    if (!fileSpec || !/^[a-f0-9]{64}$/.test(id)) continue;
    perField[field] = (perField[field] ?? 0) + 1;
    if (perField[field] > fileSpec.max) continue;

    const { value, metadata } = await env.UPLOADS.getWithMetadata<FileMeta>(`f:${id}`, 'stream');
    await value?.cancel();
    if (!metadata) {
      errors.push('Eine Datei ist abgelaufen – bitte das Formular erneut absenden.');
      continue;
    }
    attachments.push({ label: fileSpec.label, meta: metadata, id });
  }
  const total = attachments.reduce((sum, file) => sum + file.meta.size, 0);
  if (total > UPLOAD_LIMITS.totalBytes) errors.push(`Die Anhänge sind zusammen zu groß (max. ${formatBytes(UPLOAD_LIMITS.totalBytes)}).`);

  if (errors.length) return json({ ok: false, error: errors.join(' '), errors }, 422);

  const { subject, text, html } = buildEmail(formId, spec, values, attachments);
  const to = env.MAIL_TO || site.contact.email;
  const from = env.MAIL_FROM || 'Website <onboarding@resend.dev>';

  const message = {
    from,
    to: [to],
    reply_to: String(values.email),
    subject,
    text,
    html,
    attachments: attachments.map((file) => ({
      // „Fotos / Pläne“ → „Fotos-Pläne“: keine Schrägstriche o. Ä. in Dateinamen
      filename: `${file.label.replace(/\s*[/\\:*?"<>|]+\s*/g, '-')} - ${file.meta.name}`,
      path: `${origin}/api/datei/${file.id}/`,
    })),
  };

  if (env.MAIL_DRY_RUN === '1') {
    console.log('[MAIL_DRY_RUN] E-Mail würde verschickt:', JSON.stringify({ ...message, html: `${html.length} Zeichen` }, null, 2));
    return json({ ok: true, dryRun: true });
  }

  if (!env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY fehlt – E-Mail nicht verschickt.');
    return fail('Der Versand ist gerade nicht möglich. Bitte rufen Sie uns an oder schreiben Sie uns direkt eine E-Mail.', 503);
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    console.error('Resend-Fehler', response.status, await response.text());
    return fail('Der Versand ist fehlgeschlagen. Bitte versuchen Sie es später erneut oder rufen Sie uns an.', 502);
  }

  return json({ ok: true });
}

/* ------------------------------------------------------------------------ */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    const pathname = url.pathname.replace(/\/+$/, '');

    // Absenden nur von der eigenen Website (lokal läuft die Seite über den Astro-Dev-Server auf einem anderen Port)
    const requestOrigin = request.headers.get('Origin');
    const isLocal = (host: string) => host === 'localhost' || host === '127.0.0.1';
    const allowed =
      !requestOrigin ||
      requestOrigin === url.origin ||
      (isLocal(url.hostname) && isLocal(new URL(requestOrigin).hostname));
    if (request.method !== 'GET' && !allowed) return fail('Nicht erlaubt.', 403);

    const edit = await handleEdit(request, env, url, pathname);
    if (edit) return edit;

    try {
      if (pathname === '/api/upload' && request.method === 'PUT') return await handleUpload(request, env);
      if (pathname === '/api/senden' && request.method === 'POST') return await handleSend(request, env, url.origin);
      const download = pathname.match(/^\/api\/datei\/([a-f0-9]+)$/);
      if (download && request.method === 'GET') return await handleDownload(download[1], env);
    } catch (error) {
      console.error(error);
      return fail('Unerwarteter Fehler. Bitte versuchen Sie es später erneut.', 500);
    }

    return fail('Nicht gefunden.', 404);
  },
};
