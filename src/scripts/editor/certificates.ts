/**
 * Bearbeiten-Modus – Zertifikate (src/components/sections/CertificatesSection.astro).
 * Dialog wie bei den Galerien: sortieren (Ziehen oder Pfeile), aus-/einblenden, Titel/Aussteller/Jahr ändern und neue
 * PDFs hinzufügen. „Übernehmen“ merkt alles vor (./pending.ts) und zeigt es auf der Seite; mit „Speichern“:
 *   neue PDFs → src/assets/zertifikate/<name>.pdf
 *   Liste     → src/assets/zertifikate/zertifikate.json (Reihenfolge, Angaben, hidden)
 * Die Vorschaubilder neuer PDFs erzeugt der Build (scripts/build-zertifikate.mjs) – bis dahin ein Platzhalter.
 */
import { type CertItem, pending } from './pending';

/** Base64 wird ca. 4/3 so groß – der Worker nimmt bis 12 MB an */
const MAX_PDF_BYTES = 9 * 1024 * 1024;
const pdfPath = (name: string) => `src/assets/zertifikate/${name}.pdf`;
/** Platzhalter für neue PDFs, bis der Build ihre Vorschau erzeugt */
const PLACEHOLDER =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 210 297"><rect width="210" height="297" fill="#f4f4f5"/><text x="105" y="140" font-family="Arial" font-size="34" font-weight="700" text-anchor="middle" fill="#71717a">PDF</text><text x="105" y="178" font-family="Arial" font-size="16" text-anchor="middle" fill="#a1a1aa">Vorschau nach dem Speichern</text></svg>',
  );

type Item = CertItem & { thumb?: string };

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
  const applyButton = dialog.querySelector<HTMLButtonElement>('[data-certs-save]')!;
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
        if (item.isNew) li.dataset.new = '';

        const thumb = document.createElement('span');
        thumb.className = 'certs-edit__thumb';
        if (item.thumb) thumb.append(Object.assign(document.createElement('img'), { src: item.thumb, alt: '' }));
        else thumb.textContent = 'PDF';

        const badge = document.createElement('span');
        badge.className = 'certs-edit__badge';
        badge.textContent = item.isNew ? 'neu – Vorschau nach dem Speichern' : item.hidden ? 'ausgeblendet' : `${items.slice(0, index + 1).filter((i) => !i.hidden).length}. auf der Seite`;

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
          item.isNew
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

  addInput.addEventListener('change', async () => {
    const taken = new Set(items.map((item) => item.name));
    const files = [...(addInput.files ?? [])];
    addInput.value = '';
    for (const file of files) {
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
      await pending.putFile(pdfPath(name), (await readAsDataUrl(file)).split(',')[1], 'application/pdf');
      items.push({ name, title, issuer: '', year: String(new Date().getFullYear()), hidden: false, thumb: '', isNew: true });
    }
    render();
  });

  /** Reihenfolge, Texte und Sichtbarkeit auf der Seite zeigen – neue PDFs mit Platzhalter */
  function previewOnPage(target: HTMLElement, list: Item[]) {
    const ul = target.querySelector<HTMLElement>('.certs__list');
    const template = ul?.querySelector<HTMLElement>('[data-cert-item]:not([data-ed-new])');
    if (!ul) return;
    ul.querySelectorAll('[data-ed-new]').forEach((li) => li.remove());
    for (const item of list) {
      let li = ul.querySelector<HTMLElement>(`[data-cert-item="${CSS.escape(item.name)}"]`);
      if (!li && item.isNew && template) {
        li = template.cloneNode(true) as HTMLElement;
        li.dataset.certItem = item.name;
        li.setAttribute('data-ed-new', '');
        li.querySelector('template')?.remove();
        const button = li.querySelector<HTMLButtonElement>('[data-cert]');
        if (button) {
          button.dataset.cert = '';
          button.disabled = true;
        }
        const img = li.querySelector<HTMLImageElement>('img');
        if (img) img.src = PLACEHOLDER;
      }
      if (!li) continue;
      li.hidden = item.hidden;
      ul.append(li);
      const title = li.querySelector('.cert__title');
      const meta = li.querySelector('.cert__meta');
      if (title) title.textContent = item.title;
      if (meta) meta.textContent = [item.issuer, item.year].filter(Boolean).join(' · ');
    }
    ul.dataset.certsAll = JSON.stringify(list);
  }

  applyButton.addEventListener('click', () => {
    pending.update((draft) => {
      draft.certificates = items.map(({ name, title, issuer, year, hidden, thumb, isNew }) => ({ name, title, issuer, year, hidden, thumb, ...(isNew ? { isNew } : {}) }));
    });
    if (section) previewOnPage(section, items);
    dialog.close();
  });

  return {
    open(target: HTMLElement) {
      section = target;
      try {
        items = pending.get().certificates ?? JSON.parse(target.querySelector<HTMLElement>('[data-certs-all]')?.dataset.certsAll ?? '[]');
      } catch {
        items = [];
      }
      items = items.map((item) => ({ ...item }));
      status.textContent = '';
      render();
      dialog.showModal();
    },
    /** Vorgemerkte Zertifikate auf dieser Seite zeigen */
    applyPending() {
      const list = pending.get().certificates;
      if (!list) return;
      document.querySelectorAll<HTMLElement>('#zertifikate').forEach((target) => previewOnPage(target, list));
    },
  };
}
