/**
 * Bearbeiten-Modus – Logo in der Kopfzeile (src/components/layout/HeaderLogo.astro).
 * Design wählen (Vorlagen aus EditMode.astro, <template data-ed-logo>) oder eigenes Bild hochladen; Vorschau sofort
 * im Header (auf allen Seiten), vorgemerkt in ./pending.ts. Mit „Speichern“:
 *   eigenes Bild → src/assets/brand/eigene/logo-<id>.png
 *   Auswahl      → src/content/brand.json { logo, image?, background? }
 */
import { type LogoDesign, LOGO_DESIGNS } from '@/lib/logo';
import { newId, pending } from './pending';

const imageFile = (image: string) => `src/assets/brand/eigene/${image}`;

type State = { logo: LogoDesign; image: string; background: 'hell' | 'ohne' };

const readAsDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

/** Logo-Bild auf höchstens 900 px verkleinern – als PNG, damit ein transparenter Hintergrund erhalten bleibt */
async function shrinkLogo(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 900 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Bild konnte nicht verarbeitet werden.'))), 'image/png'),
  );
  return (await readAsDataUrl(blob)).split(',')[1];
}

export function createLogo(ui: HTMLElement) {
  const link = document.querySelector<HTMLElement>('.site-header__brand');
  const templates = new Map(
    [...ui.querySelectorAll<HTMLTemplateElement>('template[data-ed-logo]')].map((t) => [t.dataset.edLogo as LogoDesign, t]),
  );

  const current = () => link?.querySelector<HTMLElement>('.hlogo');
  const read = (): State => {
    const el = current();
    const logo = (LOGO_DESIGNS.map(([id]) => id) as string[]).concat('eigenes').find((id) => el?.classList.contains(`hlogo--${id}`)) ?? 'standard';
    const image = el?.querySelector('img')?.getAttribute('src') ?? '';
    return { logo: logo as LogoDesign, image: logo === 'eigenes' ? image : '', background: el?.dataset.bg === 'ohne' ? 'ohne' : 'hell' };
  };

  let saved: State = read();
  let state: State = { ...saved };
  /** Neu gewähltes Bild (bis zum Speichern nur im Browser): Dateiname und Vorschau */
  let newImage = '';
  let fileUrl = '';
  /** Vorhandenes eigenes Bild (gespeichert) – zum Zurückwechseln */
  const savedImage = saved.logo === 'eigenes' ? (current()?.cloneNode(true) as HTMLElement) : null;

  /** Vorschau eines Designs als Element (für den Header und die Kacheln) */
  function render(design: LogoDesign, background = state.background): HTMLElement | null {
    if (design === 'eigenes') {
      if (fileUrl) {
        const span = document.createElement('span');
        span.className = 'hlogo hlogo--eigenes';
        span.dataset.bg = background;
        const img = document.createElement('img');
        img.className = 'hlogo__image';
        img.src = fileUrl;
        img.alt = 'Pflasterarbeiten Hildebrand GmbH';
        span.append(img);
        return span;
      }
      if (!savedImage) return null;
      const copy = savedImage.cloneNode(true) as HTMLElement;
      copy.dataset.bg = background;
      return copy;
    }
    const template = templates.get(design);
    return (template?.content.querySelector('.hlogo')?.cloneNode(true) as HTMLElement | undefined) ?? null;
  }

  const show = () => {
    const el = current();
    const next = render(state.logo);
    if (el && next) el.replaceWith(next);
  };

  const dirty = () => Boolean(newImage) || state.logo !== saved.logo || (state.logo === 'eigenes' && state.background !== saved.background);

  const remember = () =>
    pending.update((draft) => {
      draft.logo = dirty() ? { logo: state.logo, background: state.background, ...(newImage ? { image: newImage } : {}) } : null;
    });

  return {
    /** Alle Designs (ohne „eigenes“) mit Beschriftung */
    designs: LOGO_DESIGNS,
    state: () => state,
    hasCustom: () => Boolean(fileUrl || savedImage),
    render,
    choose(design: LogoDesign) {
      if (design === 'eigenes' && !fileUrl && !savedImage) return;
      state = { ...state, logo: design };
      show();
      remember();
    },
    setBackground(background: 'hell' | 'ohne') {
      state = { ...state, background };
      show();
      remember();
    },
    /** Eigenes Bild wählen – verkleinert vormerken und sofort als Vorschau zeigen */
    async upload(next: File) {
      const base64 = await shrinkLogo(next);
      newImage = `logo-${newId()}.png`;
      await pending.putFile(imageFile(newImage), base64, 'image/png');
      fileUrl = `data:image/png;base64,${base64}`;
      state = { ...state, logo: 'eigenes' };
      show();
      remember();
    },
    /** Vorgemerktes Logo zeigen (beim Start auf jeder Seite) */
    async applyPending() {
      const change = pending.get().logo;
      if (!change) return;
      if (change.image) {
        fileUrl = (await pending.fileUrl(imageFile(change.image))) ?? '';
        newImage = fileUrl ? change.image : '';
      }
      if (change.logo === 'eigenes' && !fileUrl && !savedImage) return;
      state = { logo: change.logo as LogoDesign, image: '', background: change.background };
      show();
    },
    /** Nach dem Speichern: der vorgemerkte Stand gilt als gespeichert (die Vorschau bleibt bis zum Build stehen) */
    committed() {
      newImage = '';
      saved = { ...state };
    },
  };
}
