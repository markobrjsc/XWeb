/**
 * Bearbeiten-Modus – Fotos: Kopfbilder ([data-hero-edit]) und Galerien (Carousel mit `folder`).
 *  · Kopfbild: aus allen Fotos wählen oder neues hochladen → src/content/heroes.json (+ src/assets/images/hero/).
 *    Die Wahl ist erst eine Vorschau; gespeichert wird mit dem gemeinsamen „Speichern“ der Seitenleiste.
 *  · Galerie: Bilder hinzufügen, per Ziehen sortieren, ausblenden → src/content/galleries.json (+ Bilddateien),
 *    gespeichert mit „Galerie speichern“ im Dialog.
 */
const DONE = 'Gespeichert – nach dem automatischen Build in ca. 2 Minuten live.';

const readAsDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

/** Neue Bilder vor dem Hochladen auf max. 2400 px verkleinern (JPEG) → Base64 */
export async function shrink(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Bild konnte nicht verarbeitet werden.'))), 'image/jpeg', 0.85),
  );
  return (await readAsDataUrl(blob)).split(',')[1];
}

/** Bild hochladen (Base64) → Name ohne Endung */
export async function uploadImage(folder: string, name: string, base64: string) {
  const response = await fetch(`/api/edit/bild/?folder=${encodeURIComponent(folder)}&name=${encodeURIComponent(name)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'text/plain' },
    body: base64,
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.error || 'Hochladen fehlgeschlagen.');
  return String(result.name);
}

export function createMedia(ui: HTMLElement, hooks: { onChange(): void }) {
  // Schließen: X-Knopf und Klick auf den abgedunkelten Hintergrund (alle Dialoge)
  ui.querySelectorAll<HTMLDialogElement>('dialog').forEach((dlg) => {
    dlg.querySelector('.gallery-dialog__close')?.addEventListener('click', (event) => {
      event.preventDefault();
      dlg.close();
    });
    let pressedOnBackdrop = false;
    dlg.addEventListener('pointerdown', (event) => (pressedOnBackdrop = event.target === dlg));
    dlg.addEventListener('click', (event) => {
      if (event.target === dlg && pressedOnBackdrop) dlg.close();
    });
  });

  /* ---------------- Kopfbilder ---------------- */
  // Auswahl im Dialog ist nur eine Vorschau – live geht das neue Kopfbild erst mit „Speichern“ in der Seitenleiste
  // (vorher hat schon ein Klick auf ein Foto sofort gespeichert; Durchklicken landete so direkt auf der Website).
  const heroDialog = ui.querySelector<HTMLDialogElement>('[data-hero-dialog]')!;
  const heroStatus = heroDialog.querySelector<HTMLElement>('[data-hero-status]')!;
  const heroChoices = [...heroDialog.querySelectorAll<HTMLButtonElement>('[data-hero-choice]')];
  let heroSection: HTMLElement | null = null;
  type PendingHero = { section: HTMLElement; page: string; image?: string; file?: File; base64?: string; original: HTMLElement };
  let pendingHero: PendingHero | null = null;

  /** Große Fassungen aller Fotos (1600 px, aus /bearbeiten/bausteine.json) – einmal geladen */
  let largeImages: Promise<Map<string, string>> | null = null;
  const largeImage = (name: string) => {
    largeImages ??= fetch('/bearbeiten/bausteine.json')
      .then((response) => response.json() as Promise<{ images: { name: string; src: string }[] }>)
      .then((data) => new Map(data.images.map((image) => [image.name, image.src])))
      .catch(() => new Map<string, string>());
    return largeImages.then((map) => map.get(name));
  };

  const heroFrame = (section: HTMLElement) => section.querySelector<HTMLElement>('.hero__bg, .page-hero__photo');

  // Vorschau auf der Seite (volle Qualität nach dem Build). Bei einem Foto aus der Auswahl erst die große Fassung
  // laden und dann tauschen – das Miniaturbild über die ganze Breite gezogen wäre verpixelt.
  const previewHero = async (section: HTMLElement, src: string, name?: string) => {
    const img = section.querySelector<HTMLImageElement>('.hero__bg img, .page-hero__photo img');
    if (!img) return;
    const large = name ? await largeImage(name) : undefined;
    const next = large ?? src;
    await new Promise<void>((resolve) => {
      const probe = new Image();
      probe.onload = probe.onerror = () => resolve();
      probe.src = next;
    });
    img.closest('picture')?.querySelectorAll('source').forEach((source) => source.remove());
    img.removeAttribute('srcset');
    img.src = next;
  };

  /** Neue Wahl merken (Original fürs Verwerfen nur beim ersten Mal sichern) */
  const choose = (change: Omit<PendingHero, 'section' | 'page' | 'original'>) => {
    const section = heroSection!;
    const frame = heroFrame(section);
    if (!frame) return;
    const original = pendingHero?.section === section ? pendingHero.original : (frame.cloneNode(true) as HTMLElement);
    pendingHero = { section, page: section.dataset.heroEdit ?? location.pathname, original, ...change };
    heroChoices.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.heroChoice === change.image && !change.file)));
    heroStatus.textContent = 'Vorschau – mit „Speichern“ in der Seitenleiste übernehmen, „Verwerfen“ macht es rückgängig.';
    hooks.onChange();
  };

  heroChoices.forEach((button) =>
    button.addEventListener('click', async () => {
      const image = button.dataset.heroChoice ?? '';
      choose({ image });
      heroStatus.textContent = 'Vorschau wird geladen …';
      await previewHero(heroSection!, button.querySelector('img')?.src ?? '', image);
      heroStatus.textContent = 'Vorschau – mit „Speichern“ in der Seitenleiste übernehmen, „Verwerfen“ macht es rückgängig.';
    }),
  );

  heroDialog.querySelector<HTMLInputElement>('[data-hero-upload]')!.addEventListener('change', async (event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !heroSection) return;
    try {
      heroStatus.textContent = 'Bild wird vorbereitet …';
      const base64 = await shrink(file);
      choose({ file, base64 });
      await previewHero(heroSection, `data:image/jpeg;base64,${base64}`);
    } catch (error) {
      heroStatus.textContent = error instanceof Error ? error.message : 'Bild konnte nicht verarbeitet werden.';
    }
  });

  const hero = {
    dirty: () => Boolean(pendingHero),
    /** Mit dem gemeinsamen Speichern-Knopf: ggf. neues Bild hochladen, dann heroes.json */
    async save() {
      if (!pendingHero) return;
      let image = pendingHero.image ?? '';
      if (pendingHero.base64) image = `hero/${await uploadImage('hero', `neu-${Date.now().toString(36)}.jpg`, pendingHero.base64)}`;
      const response = await fetch('/api/edit/hero/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: pendingHero.page, image }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || 'Kopfbild konnte nicht gespeichert werden.');
      // Vorschau bleibt stehen, bis der Build das neue Kopfbild ausliefert
      pendingHero = null;
      heroStatus.textContent = DONE;
    },
    discard() {
      if (!pendingHero) return;
      heroFrame(pendingHero.section)?.replaceWith(pendingHero.original);
      pendingHero = null;
      heroChoices.forEach((b) => b.removeAttribute('aria-pressed'));
      heroStatus.textContent = '';
    },
  };

  /* ---------------- Galerien ---------------- */
  const dialog = ui.querySelector<HTMLDialogElement>('[data-gallery-dialog]')!;
  const grid = dialog.querySelector<HTMLOListElement>('[data-gallery-grid]')!;
  const galleryStatus = dialog.querySelector<HTMLElement>('[data-gallery-status]')!;
  const addInput = dialog.querySelector<HTMLInputElement>('[data-gallery-add]')!;
  const gallerySave = dialog.querySelector<HTMLButtonElement>('[data-gallery-save]')!;
  type Item = { name: string; thumb: string; hidden: boolean; file?: File };
  let items: Item[] = [];
  let folder = '';
  let dragIndex = -1;

  const move = (from: number, to: number) => {
    if (from < 0 || to < 0 || from >= items.length || to >= items.length || from === to) return;
    const [item] = items.splice(from, 1);
    items.splice(to, 0, item);
    renderGrid();
  };

  const tool = (text: string, title: string, fn: () => void) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.title = title;
    b.setAttribute('aria-label', title);
    b.addEventListener('click', fn);
    return b;
  };

  function renderGrid() {
    grid.replaceChildren(
      ...items.map((item, index) => {
        const li = document.createElement('li');
        li.className = 'gallery-item';
        li.draggable = true;
        if (item.hidden) li.dataset.hidden = '';
        if (item.file) li.dataset.new = '';
        const img = document.createElement('img');
        img.alt = item.name;
        if (item.thumb) img.src = item.thumb;
        const label = document.createElement('span');
        label.className = 'gallery-item__label';
        label.textContent = item.file ? 'neu' : item.hidden ? 'ausgeblendet' : `${index + 1}`;
        const tools = document.createElement('span');
        tools.className = 'gallery-item__tools';
        tools.append(
          tool('←', 'Nach vorne', () => move(index, index - 1)),
          tool(item.hidden ? '◌' : '◉', item.hidden ? 'Einblenden' : 'Ausblenden', () => {
            if (item.file) items.splice(index, 1);
            else item.hidden = !item.hidden;
            renderGrid();
          }),
          tool('→', 'Nach hinten', () => move(index, index + 1)),
        );
        li.append(img, label, tools);
        li.addEventListener('dragstart', () => (dragIndex = index));
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
    for (const file of addInput.files ?? []) items.push({ name: '', thumb: await readAsDataUrl(file), hidden: false, file });
    addInput.value = '';
    renderGrid();
  });

  gallerySave.addEventListener('click', async () => {
    gallerySave.disabled = true;
    try {
      const fresh = items.filter((item) => item.file);
      for (const [index, item] of fresh.entries()) {
        galleryStatus.textContent = `Lade Bild ${index + 1} von ${fresh.length} hoch …`;
        item.name = await uploadImage(folder, `neu-${Date.now().toString(36)}-${index}.jpg`, await shrink(item.file!));
        item.file = undefined;
      }
      galleryStatus.textContent = 'Speichere Reihenfolge …';
      const response = await fetch('/api/edit/galerie/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder, order: items.map((item) => item.name), hidden: items.filter((item) => item.hidden).map((item) => item.name) }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || 'Speichern fehlgeschlagen.');
      galleryStatus.textContent = DONE;
      renderGrid();
    } catch (error) {
      galleryStatus.textContent = error instanceof Error ? error.message : 'Speichern fehlgeschlagen.';
    } finally {
      gallerySave.disabled = false;
    }
  });

  return {
    hero,
    openHero(section: HTMLElement) {
      heroSection = section;
      if (!pendingHero) {
        heroStatus.textContent = 'Foto anklicken für eine Vorschau – live erst nach „Speichern“ in der Seitenleiste.';
        heroChoices.forEach((b) => b.removeAttribute('aria-pressed'));
      }
      heroDialog.showModal();
    },
    openGallery(carousel: HTMLElement) {
      folder = carousel.dataset.gallery ?? '';
      dialog.querySelector('[data-gallery-title]')!.textContent = carousel.dataset.galleryLabel ?? folder;
      const visible = [...carousel.querySelectorAll<HTMLElement>('.carousel__slide[data-name]')].map((slide) => {
        const img = slide.querySelector('img');
        return { name: slide.dataset.name ?? '', thumb: img?.currentSrc || img?.src || '', hidden: false };
      });
      const hidden = (carousel.dataset.galleryHidden ?? '')
        .split(',')
        .filter(Boolean)
        .map((name) => ({ name, thumb: '', hidden: true }));
      items = [...visible, ...hidden];
      galleryStatus.textContent = '';
      gallerySave.disabled = false;
      renderGrid();
      dialog.showModal();
    },
  };
}
