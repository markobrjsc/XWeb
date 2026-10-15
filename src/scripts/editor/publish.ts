/**
 * Bearbeiten-Modus – Abschluss jedes Speicherns: Die einzelnen Commits liegen zunächst auf dem Arbeits-Branch
 * „bearbeitung“ (worker/edit.ts). Erst dieser Aufruf übernimmt sie auf main – damit baut Cloudflare nur einmal.
 */
export async function publishEdits() {
  const response = await fetch('/api/edit/veroeffentlichen/', { method: 'POST' });
  const result = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!response.ok || !result.ok) throw new Error(result.error || 'Veröffentlichen fehlgeschlagen.');
}
