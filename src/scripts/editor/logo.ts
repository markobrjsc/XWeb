/**
 * Bearbeiten-Modus – Logo in der Kopfzeile (src/components/layout/HeaderLogo.astro).
 * Design wählen (Vorlagen aus EditMode.astro, <template data-ed-logo>) oder eigenes Bild hochladen; Vorschau sofort
 * im Header, gespeichert über den gemeinsamen Knopf:
 *   eigenes Bild → PUT /api/edit/logo-bild/?name=… → src/assets/brand/eigene/<name>
 *   Auswahl      → POST /api/edit/logo/ { logo, image?, background? } → src/content/brand.json
 */
import { type LogoDesign, LOGO_DESIGNS } from '@/lib/logo';

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
  /** Original-Markup für „Verwerfen“ */
  let original = current()?.cloneNode(true) as HTMLElement | undefined;
  /** Neu gewähltes Bild (bis zum Speichern nur im Browser) */
  let file: File | null = null;
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
    },
    setBackground(background: 'hell' | 'ohne') {
      state = { ...state, background };
      show();
    },
    /** Eigenes Bild wählen – wird sofort als Vorschau gezeigt */
    upload(next: File) {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
      file = next;
      fileUrl = URL.createObjectURL(next);
      state = { ...state, logo: 'eigenes' };
      show();
    },
    dirty: () => Boolean(file) || state.logo !== saved.logo || (state.logo === 'eigenes' && state.background !== saved.background),
    discard() {
      if (!this.dirty()) return;
      file = null;
      if (fileUrl) URL.revokeObjectURL(fileUrl);
      fileUrl = '';
      state = { ...saved };
      const el = current();
      if (el && original) el.replaceWith(original.cloneNode(true));
    },
    async save() {
      if (!this.dirty()) return;
      let image = '';
      if (state.logo === 'eigenes' && file) {
        const name = `logo-${Date.now().toString(36)}.png`;
        const response = await fetch(`/api/edit/logo-bild/?name=${encodeURIComponent(name)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'text/plain' },
          body: await shrinkLogo(file),
        });
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.error || 'Logo konnte nicht hochgeladen werden.');
        image = name;
      }
      const response = await fetch('/api/edit/logo/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logo: state.logo, ...(image ? { image } : {}), background: state.background }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || 'Logo konnte nicht gespeichert werden.');
      // Vorschau bleibt stehen, bis der Build das neue Logo ausliefert
      file = null;
      saved = { ...state };
      original = current()?.cloneNode(true) as HTMLElement | undefined;
    },
  };
}
