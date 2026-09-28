/**
 * Formulare (Kontakt, Bewerbung) – Dateiauswahl sammeln, Dateien einzeln hochladen und die Felder
 * als JSON an den Worker schicken (worker/index.ts). Ablauf und Grenzen: src/lib/forms.ts
 */
import { UPLOAD_LIMITS, fileExtension, formatBytes } from '@/lib/forms';

const REMOVE_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';

type Picked = { file: File; error?: string };

/* ------------------------------------------------------------------------ */
/* Dateifelder                                                               */
/* ------------------------------------------------------------------------ */
const fileState = new Map<HTMLInputElement, Picked[]>();

function checkFile(file: File): string | undefined {
  if (!(UPLOAD_LIMITS.extensions as readonly string[]).includes(fileExtension(file.name))) return 'Dateityp nicht unterstützt';
  if (file.size > UPLOAD_LIMITS.fileBytes) return `zu groß (max. ${formatBytes(UPLOAD_LIMITS.fileBytes)})`;
  if (file.size === 0) return 'leere Datei';
  return undefined;
}

function initFileField(field: HTMLElement) {
  const input = field.querySelector<HTMLInputElement>('input[type="file"]');
  const list = field.querySelector<HTMLUListElement>('[data-file-list]');
  if (!input || !list) return;
  const max = Number(field.dataset.max) || 1;
  fileState.set(input, []);

  // Das Eingabefeld selbst hält nur die gültigen Dateien – so bleibt es mit der Anzeige synchron
  const sync = () => {
    const transfer = new DataTransfer();
    fileState.get(input)?.forEach((entry) => !entry.error && transfer.items.add(entry.file));
    input.files = transfer.files;
  };

  const render = () => {
    list.replaceChildren(
      ...(fileState.get(input) ?? []).map((entry, index) => {
        const item = document.createElement('li');
        if (entry.error) item.dataset.error = '';
        const name = document.createElement('span');
        name.className = 'file__name';
        name.textContent = entry.file.name;
        const size = document.createElement('span');
        size.className = 'file__size';
        size.textContent = entry.error ?? formatBytes(entry.file.size);
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'file__remove';
        remove.setAttribute('aria-label', `${entry.file.name} entfernen`);
        remove.innerHTML = REMOVE_ICON;
        remove.addEventListener('click', () => {
          fileState.get(input)?.splice(index, 1);
          sync();
          render();
          input.focus();
        });
        item.append(name, size, remove);
        return item;
      }),
    );
  };

  input.addEventListener('change', () => {
    const incoming = [...(input.files ?? [])].map((file) => ({ file, error: checkFile(file) }));
    // Einzeldatei: neue Auswahl ersetzt die alte · mehrere: sammeln (bis zum Maximum)
    const current = max === 1 ? [] : (fileState.get(input) ?? []).filter((entry) => !entry.error);
    const merged = [...current, ...incoming].slice(0, max);
    fileState.set(input, merged);
    sync();
    render();
  });

  field.addEventListener('dragenter', () => field.setAttribute('data-dragover', ''));
  ['dragleave', 'drop'].forEach((type) => field.addEventListener(type, () => field.removeAttribute('data-dragover')));
}

/* ------------------------------------------------------------------------ */
/* Absenden                                                                  */
/* ------------------------------------------------------------------------ */
async function readJson(response: Response): Promise<{ ok?: boolean; id?: string; error?: string }> {
  try {
    return await response.json();
  } catch {
    return { ok: false, error: response.status === 404 ? 'Der Versand-Dienst ist nicht erreichbar.' : undefined };
  }
}

function initForm(form: HTMLFormElement) {
  const shell = form.closest<HTMLElement>('.form-shell');
  const status = form.querySelector<HTMLElement>('[data-form-status]');
  const success = shell?.querySelector<HTMLElement>('[data-form-success]');
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const startedAt = Date.now();

  form.querySelectorAll<HTMLElement>('[data-file-field]').forEach(initFileField);

  const setStatus = (text: string, state: 'busy' | 'error' | '' = '') => {
    if (!status) return;
    status.textContent = text;
    status.dataset.state = state;
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const inputs = [...form.querySelectorAll<HTMLInputElement>('input[type="file"]')];
    const uploads = inputs.flatMap((input) =>
      (fileState.get(input) ?? []).filter((entry) => !entry.error).map((entry) => ({ field: input.name, file: entry.file })),
    );
    const total = uploads.reduce((sum, upload) => sum + upload.file.size, 0);
    if (total > UPLOAD_LIMITS.totalBytes) {
      setStatus(`Die Anhänge sind zusammen ${formatBytes(total)} groß – erlaubt sind ${formatBytes(UPLOAD_LIMITS.totalBytes)}.`, 'error');
      return;
    }

    // Felder einsammeln (Mehrfachauswahl als Liste)
    const fields: Record<string, string | string[]> = {};
    for (const [key, value] of new FormData(form)) {
      if (value instanceof File || key === 'consent' || key === 'website') continue;
      const existing = fields[key];
      if (form.querySelector(`input[type="checkbox"][name="${key}"]`)) {
        fields[key] = [...(Array.isArray(existing) ? existing : []), value];
      } else {
        fields[key] = value;
      }
    }

    if (submit) submit.disabled = true;
    form.setAttribute('aria-busy', 'true');

    try {
      const files: { field: string; id: string }[] = [];
      for (const [index, upload] of uploads.entries()) {
        setStatus(`Lade ${upload.file.name} hoch (${index + 1} von ${uploads.length}) …`, 'busy');
        const response = await fetch('/api/upload/', {
          method: 'PUT',
          headers: {
            'Content-Type': upload.file.type || 'application/octet-stream',
            'X-File-Name': encodeURIComponent(upload.file.name),
          },
          body: upload.file,
        });
        const result = await readJson(response);
        if (!response.ok || !result.id) throw new Error(result.error || `„${upload.file.name}“ konnte nicht hochgeladen werden.`);
        files.push({ field: upload.field, id: result.id });
      }

      setStatus('Wird gesendet …', 'busy');
      const website = (form.elements.namedItem('website') as HTMLInputElement | null)?.value ?? '';
      const response = await fetch('/api/senden/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ form: form.dataset.form, fields, files, startedAt, website }),
      });
      const result = await readJson(response);
      if (!response.ok || !result.ok) throw new Error(result.error || 'Der Versand ist fehlgeschlagen.');

      // Erfolg: Formular durch die Bestätigung ersetzen
      form.hidden = true;
      if (success) {
        success.hidden = false;
        success.focus({ preventScroll: true });
        shell?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Der Versand ist fehlgeschlagen.';
      setStatus(`${message} Sie erreichen uns auch telefonisch oder per E-Mail.`, 'error');
    } finally {
      if (submit) submit.disabled = false;
      form.removeAttribute('aria-busy');
    }
  });
}

document.querySelectorAll<HTMLFormElement>('form[data-form]').forEach(initForm);
