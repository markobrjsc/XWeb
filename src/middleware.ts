/**
 * Setzt die im Bearbeiten-Modus gespeicherten Texte (src/content/edits.json) in jede Seite ein.
 * Läuft beim Build für alle statischen Seiten und im Entwicklungsmodus bei jedem Aufruf.
 */
import { defineMiddleware } from 'astro:middleware';
import { applyEdits } from '@/lib/edits';

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();
  if (!response.headers.get('content-type')?.includes('text/html')) return response;

  const html = await response.text();
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return new Response(applyEdits(html, context.url.pathname), { status: response.status, headers });
});
