/**
 * Setzt die im Bearbeiten-Modus gespeicherten Texte (src/content/edits.json) und Elemente
 * (src/content/blocks.json) in jede Seite ein.
 * Läuft beim Build für alle statischen Seiten und im Entwicklungsmodus bei jedem Aufruf.
 */
import { defineMiddleware } from 'astro:middleware';
import { applyBlocks } from '@/lib/blocks/server';
import { applyEdits } from '@/lib/edits';

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();
  if (!response.headers.get('content-type')?.includes('text/html')) return response;

  const html = await response.text();
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  // Elemente erst nach den Text-Bearbeitungen einsetzen – deren Texte pflegt der Element-Editor selbst
  const path = context.url.pathname;
  return new Response(await applyBlocks(applyEdits(html, path), path), { status: response.status, headers });
});
