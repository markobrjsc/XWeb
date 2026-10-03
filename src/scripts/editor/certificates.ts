/**
 * Bearbeiten-Modus – Zertifikate (src/components/sections/CertificatesSection.astro).
 * Dialog wie bei den Galerien: sortieren (Ziehen oder Pfeile), aus-/einblenden, Titel/Aussteller/Jahr ändern und neue
 * PDFs hochladen. Speichern im Dialog:
 *   neue PDFs → PUT /api/edit/zertifikat/?name=… → src/assets/zertifikate/<name>.pdf
 *   Liste     → POST /api/edit/zertifikate/      → src/assets/zertifikate/zertifikate.json (Reihenfolge, Angaben, hidden)
 * Die Vorschaubilder neuer PDFs erzeugt der Build (scripts/build-zertifikate.mjs).
 */
const DONE = 'Gespeichert – nach dem automatischen Build in ca. 2 Minuten live.';
/** Base64 wird ca. 4/3 so groß – der Worker nimmt bis 12 MB an */
const MAX_PDF_BYTES = 9 * 1024 * 1024;

type Item = { name: string; title: string; issuer: string; year: string; hidden: boolean; thumb: string; file?: File };

const readAsDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/g, '') || 'zertifikat';

export function createCertificates(ui: HTMLElement) {
  const dialog = ui.querySelector<HTMLDialogElement>('[data-certs-dialog]')!;
  const list = dialog.querySelector<HTMLOListElement>('[data-certs-list]')!;
  const status = dialog.querySelector<HTMLElement>('[data-certs-status]')!;
  const addInput = dialog.querySelector<HTMLInputElement>('[data-certs-add]')!;
  const saveButton = dialog.querySelector<HTMLButtonElement>('[data-certs-save]')!;
  let items: Item[] = [];
  let section: HTMLElement | null = null;
  let dragIndex = -1;

  const move = (from: number, to: number) => {
    if (from < 0 || to < 0 || from >= items.length || to >= items.length || from === to) return;
    const [item] = items.splice(from, 1);
    items.splice(to, 0, item);
    render();
  };

  const tool = (text: string, title: string, fn: () => void, disabled = false) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.title = title;
    b.disabled = disabled;
    b.setAttribute('aria-label', title);
    b.addEventListener('click', fn);
    return b;
  };

  const field = (label: string, value: string, onInput: (value: string) => void, cls = '') => {
    const wrap = document.createElement('label');
    wrap.className = `certs-edit__field ${cls}`;
    const span = document.createElement('span');
    span.textContent = label;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = value;
    input.addEventListener('input', () => onInput(input.value));
    wrap.append(span, input);
    return wrap;
  };

  function render() {
    list.replaceChildren(
      ...items.map((item, index) => {
        const li = document.createElement('li');
        li.className = 'certs-edit__item';
        li.draggable = true;
        if (item.hidden) li.dataset.hidden = '';
        if (item.file) li.dataset.new = '';

        const thumb = document.createElement('span');
        thumb.className = 'certs-edit__thumb';
        if (item.thumb) thumb.append(Object.assign(document.createElement('img'), { src: item.thumb, alt: '' }));
        else thumb.textContent = 'PDF';

        const badge = document.createElement('span');
        badge.className = 'certs-edit__badge';
        badge.textContent = item.file ? 'neu – Vorschau nach dem Build' : item.hidden ? 'ausgeblendet' : `${items.slice(0, index + 1).filter((i) => !i.hidden).length}. auf der Seite`;

        const fields = document.createElement('div');
        fields.className = 'certs-edit__fields';
        fields.append(
          badge,
          field('Titel', item.title, (v) => (item.title = v), 'certs-edit__field--wide'),
          field('Aussteller', item.issuer, (v) => (item.issuer = v)),
          field('Jahr', item.year, (v) => (item.year = v), 'certs-edit__field--year'),
        );

        const tools = document.createElement('span');
        tools.className = 'certs-edit__tools';
        tools.append(
          tool('↑', 'Nach vorne', () => move(index, index - 1), index === 0),
          tool('↓', 'Nach hinten', () => move(index, index + 1), index === items.length - 1),
          item.file
            ? tool('✕', 'Nicht hochladen', () => {
                items.splice(index, 1);
                render();
              })
            : tool(item.hidden ? '◌' : '◉', item.hidden ? 'Einblenden' : 'Ausblenden', () => {
                item.hidden = !item.hidden;
                render();
              }),
        );

        li.append(thumb, fields, tools);
        li.addEventListener('dragstart', (event) => {
          // Nicht beim Markieren von Text in den Feldern
          if ((event.target as Element).closest('input')) return event.preventDefault();
          dragIndex = index;
        });
        li.addEventListener('dragover', (event) => event.preventDefault());
        li.addEventListener('drop', (event) => {
          event.preventDefault();
          move(dragIndex, index);
        });
        return li;
      }),
    );
  }

  addInput.addEventListener('change', () => {
    const taken = new Set(items.map((item) => item.name));
    for (const file of addInput.files ?? []) {
      if (file.type && file.type !== 'application/pdf') {
        status.textContent = `„${file.name}“ ist kein PDF.`;
        continue;
      }
      if (file.size > MAX_PDF_BYTES) {
        status.textContent = `„${file.name}“ ist zu groß (höchstens 9 MB).`;
        continue;
      }
      const title = file.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim();
      let name = slugify(title);
      for (let n = 2; taken.has(name); n++) name = `${slugify(title)}-${n}`;
      taken.add(name);
      items.push({ name, title, issuer: '', year: String(new Date().getFullYear()), hidden: false, thumb: '', file });
    }
    addInput.value = '';
    render();
  });

  /** Reihenfolge, Texte und Sichtbarkeit sofort auf der Seite zeigen (neue PDFs erst nach dem Build) */
  function previewOnPage() {
    const ul = section?.querySelector<HTMLElement>('.certs__list');
    if (!ul) return;
    for (const item of items) {
      const li = ul.querySelector<HTMLElement>(`[data-cert-item="${CSS.escape(item.name)}"]`);
      if (!li) continue;
      li.hidden = item.hidden;
      ul.append(li);
      const title = li.querySelector('.cert__title');
      const meta = li.querySelector('.cert__meta');
      if (title) title.textContent = item.title;
      if (meta) meta.textContent = [item.issuer, item.year].filter(Boolean).join(' · ');
    }
    ul.dataset.certsAll = JSON.stringify(items.filter((item) => !item.file).map(({ file, ...rest }) => rest));
  }

  saveButton.addEventListener('click', async () => {
    saveButton.disabled = true;
    try {
      const fresh = items.filter((item) => item.file);
      for (const [index, item] of fresh.entries()) {
        status.textContent = `Lade PDF ${index + 1} von ${fresh.length} hoch …`;
        const base64 = (await readAsDataUrl(item.file!)).split(',')[1];
        const response = await fetch(`/api/edit/zertifikat/?name=${encodeURIComponent(`${item.name}.pdf`)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'text/plain' },
          body: base64,
        });
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.error || 'Hochladen fehlgeschlagen.');
        item.file = undefined;
      }
      status.textContent = 'Speichere Reihenfolge und Angaben …';
      const response = await fetch('/api/edit/zertifikate/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: items.map(({ name, title, issuer, year, hidden }) => ({ name, title, issuer, year, hidden })) }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || 'Speichern fehlgeschlagen.');
      previewOnPage();
      status.textContent = fresh.length ? `${DONE} Neue Zertifikate erscheinen dann mit Vorschau.` : DONE;
      render();
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Speichern fehlgeschlagen.';
    } finally {
      saveButton.disabled = false;
    }
  });

  return {
    open(target: HTMLElement) {
      section = target;
      try {
        items = JSON.parse(target.querySelector<HTMLElement>('[data-certs-all]')?.dataset.certsAll ?? '[]');
      } catch {
        items = [];
      }
      status.textContent = '';
      saveButton.disabled = false;
      render();
      dialog.showModal();
    },
  };
}
