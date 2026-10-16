/**
 * Bearbeiten-Modus – Fotos: Kopfbilder ([data-hero-edit]) und Galerien (Carousel mit `folder`).
 *  · Kopfbild: aus allen Fotos wählen oder neues hochladen → src/content/heroes.json (+ src/assets/images/hero/).
 *  · Galerie: Bilder hinzufügen, per Ziehen sortieren, ausblenden → src/content/galleries.json (+ Bilddateien).
 * Beides wird nur vorgemerkt (./pending.ts) und sofort auf der Seite gezeigt; übernommen wird es mit „Speichern“.
 */
import { imagePath, newId, pending, pendingImage } from './pending';
import { catalog, imageSrc, previewGallery } from './preview';

const readAsDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

/** Neue Bilder auf max. 2400 px verkleinern (JPEG) → Base64 */
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

/** Neues Bild vormerken (verkleinert) – liefert seine Vorschau-Adresse */
export async function stageImage(name: string, file: File) {
  const base64 = await shrink(file);
  await pending.putFile(imagePath(name), base64, 'image/jpeg');
  return `data:image/jpeg;base64,${base64}`;
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
  const heroDialog = ui.querySelector<HTMLDialogElement>('[data-hero-dialog]')!;
  const heroStatus = heroDialog.querySelector<HTMLElement>('[data-hero-status]')!;
  const heroChoices = [...heroDialog.querySelectorAll<HTMLButtonElement>('[data-hero-choice]')];
  let heroSection: HTMLElement | null = null;
  const NOTE = 'Vorgemerkt – live erst nach „Speichern“ in der Seitenleiste.';

  const heroPage = (section: HTMLElement) => section.dataset.heroEdit || location.pathname;

  // Vorschau auf der Seite: große Fassung laden und dann tauschen (das Miniaturbild über die ganze Breite wäre verpixelt)
  const previewHero = async (section: HTMLElement, name: string) => {
    const img = section.querySelector<HTMLImageElement>('.hero__bg img, .page-hero__photo img');
    const src = await imageSrc(name);
    if (!img || !src) return;
    await new Promise<void>((resolve) => {
      const probe = new Image();
      probe.onload = probe.onerror = () => resolve();
      probe.src = src;
    });
    img.closest('picture')?.querySelectorAll('source').forEach((source) => source.remove());
    img.removeAttribute('srcset');
    img.src = src;
  };

  const chooseHero = async (name: string) => {
    const section = heroSection;
    if (!section) return;
    pending.update((draft) => {
      draft.heroes[heroPage(section)] = name;
    });
    heroChoices.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.heroChoice === name)));
    heroStatus.textContent = 'Vorschau wird geladen …';
    hooks.onChange();
    await previewHero(section, name);
    heroStatus.textContent = NOTE;
  };

  heroChoices.forEach((button) => button.addEventListener('click', () => void chooseHero(button.dataset.heroChoice ?? '')));

  heroDialog.querySelector<HTMLInputElement>('[data-hero-upload]')!.addEventListener('change', async (event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !heroSection) return;
    try {
      heroStatus.textContent = 'Bild wird vorbereitet …';
      const name = `hero/neu-${newId()}`;
      await stageImage(name, file);
      await chooseHero(name);
    } catch (error) {
      heroStatus.textContent = error instanceof Error ? error.message : 'Bild konnte nicht verarbeitet werden.';
    }
  });

  const hero = {
    /** Vorgemerkte Kopfbilder dieser Seite zeigen */
    async applyPending() {
      const heroes = pending.get().heroes;
      await Promise.all(
        [...document.querySelectorAll<HTMLElement>('[data-hero-edit]')].map((section) => {
          const name = heroes[heroPage(section)];
          return name ? previewHero(section, name) : undefined;
        }),
      );
    },
  };

  /* ---------------- Galerien ---------------- */
  const dialog = ui.querySelector<HTMLDialogElement>('[data-gallery-dialog]')!;
  const grid = dialog.querySelector<HTMLOListElement>('[data-gallery-grid]')!;
  const galleryStatus = dialog.querySelector<HTMLElement>('[data-gallery-status]')!;
  const addInput = dialog.querySelector<HTMLInputElement>('[data-gallery-add]')!;
  const galleryApply = dialog.querySelector<HTMLButtonElement>('[data-gallery-save]')!;
  type Item = { name: string; thumb: string; hidden: boolean; isNew?: boolean };
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
        if (item.isNew) li.dataset.new = '';
        const img = document.createElement('img');
        img.alt = item.name;
        if (item.thumb) img.src = item.thumb;
        const label = document.createElement('span');
        label.className = 'gallery-item__label';
        label.textContent = item.hidden ? 'ausgeblendet' : item.isNew ? 'neu' : `${index + 1}`;
        const tools = document.createElement('span');
        tools.className = 'gallery-item__tools';
        tools.append(
          tool('←', 'Nach vorne', () => move(index, index - 1)),
          tool(item.hidden ? '◌' : '◉', item.isNew ? 'Entfernen' : item.hidden ? 'Einblenden' : 'Ausblenden', () => {
            if (item.isNew) items.splice(index, 1);
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
    const files = [...(addInput.files ?? [])];
    addInput.value = '';
    try {
      for (const [index, file] of files.entries()) {
        galleryStatus.textContent = `Bereite Bild ${index + 1} von ${files.length} vor …`;
        const name = `neu-${newId()}`;
        items.push({ name, thumb: await stageImage(`${folder}/${name}`, file), hidden: false, isNew: true });
        renderGrid();
      }
      galleryStatus.textContent = '';
    } catch (error) {
      galleryStatus.textContent = error instanceof Error ? error.message : 'Bild konnte nicht verarbeitet werden.';
    }
  });

  galleryApply.addEventListener('click', async () => {
    pending.update((draft) => {
      draft.galleries[folder] = {
        order: items.map((item) => item.name),
        hidden: items.filter((item) => item.hidden).map((item) => item.name),
      };
    });
    hooks.onChange();
    await previewGallery(folder);
    dialog.close();
  });

  /** Fotos einer Galerie fürs Bearbeiten: vorgemerkter Stand oder der der Seite – mit Vorschaubildern auch für
   *  ausgeblendete Fotos (die stehen nicht auf der Seite, deshalb aus dem Bildkatalog) */
  async function loadItems(carousel: HTMLElement): Promise<Item[]> {
    const change = pending.get().galleries[folder];
    const names = change
      ? change.order.map((name) => ({ name, hidden: change.hidden.includes(name) }))
      : [
          ...[...carousel.querySelectorAll<HTMLElement>('.carousel__slide[data-name]')].map((slide) => ({ name: slide.dataset.name ?? '', hidden: false })),
          ...(carousel.dataset.galleryHidden ?? '').split(',').filter(Boolean).map((name) => ({ name, hidden: true })),
        ];
    const images = await catalog();
    return Promise.all(
      names.map(async ({ name, hidden }) => {
        const staged = await pendingImage(`${folder}/${name}`);
        const slide = carousel.querySelector<HTMLImageElement>(`.carousel__slide[data-name="${CSS.escape(name)}"] img`);
        const thumb = staged ?? images.get(`${folder}/${name}`)?.thumb ?? slide?.currentSrc ?? slide?.src ?? '';
        return { name, hidden, thumb, isNew: Boolean(staged) };
      }),
    );
  }

  return {
    hero,
    openHero(section: HTMLElement) {
      heroSection = section;
      const chosen = pending.get().heroes[heroPage(section)];
      heroStatus.textContent = chosen ? NOTE : 'Foto anklicken für eine Vorschau – live erst nach „Speichern“ in der Seitenleiste.';
      heroChoices.forEach((b) => b.setAttribute('aria-pressed', String(Boolean(chosen) && b.dataset.heroChoice === chosen)));
      heroDialog.showModal();
    },
    async openGallery(carousel: HTMLElement) {
      folder = carousel.dataset.gallery ?? '';
      dialog.querySelector('[data-gallery-title]')!.textContent = carousel.dataset.galleryLabel ?? folder;
      galleryStatus.textContent = 'Fotos werden geladen …';
      items = [];
      renderGrid();
      dialog.showModal();
      items = await loadItems(carousel);
      galleryStatus.textContent = '';
      renderGrid();
    },
    /** Vorgemerkte Galerien dieser Seite zeigen */
    async applyPending() {
      await Promise.all(Object.keys(pending.get().galleries).map((name) => previewGallery(name)));
    },
  };
}
