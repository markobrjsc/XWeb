/**
 * Bearbeiten-Modus – vorgemerkte Änderungen auf der Seite zeigen, die sich nicht nur per Text oder Stil darstellen
 * lassen: Galerien neu aufbauen und Referenzprojekte hinzufügen bzw. entfernen. Neue Elemente entstehen als Kopie
 * vorhandener (so passen die Stile der Komponenten), Bilder kommen aus den Vormerkungen oder dem Bildkatalog.
 */
import { initCarousel } from '@/scripts/carousel';
import { initProjectSwitch } from '@/scripts/project-switch';
import { pending, pendingImage } from './pending';

type CatalogImage = { name: string; thumb: string; src: string };

/** Alle Fotos der Website mit kleiner und großer Fassung (/bearbeiten/bausteine.json) – einmal geladen */
let catalogData: Promise<Map<string, CatalogImage>> | null = null;
export const catalog = () =>
  (catalogData ??= fetch('/bearbeiten/bausteine.json')
    .then((response) => response.json() as Promise<{ images: CatalogImage[] }>)
    .then((data) => new Map(data.images.map((image) => [image.name, image])))
    .catch(() => new Map<string, CatalogImage>()));

/** Adresse eines Bildes für die Vorschau – vorgemerkt (data:-URL) oder aus dem Katalog */
export async function imageSrc(name: string, size: 'thumb' | 'src' = 'src') {
  return (await pendingImage(name)) ?? (await catalog()).get(name)?.[size] ?? '';
}

export type Slide = { name: string; src: string };

/** Galerie mit neuen Fotos neu aufbauen (ersetzt das Element, damit keine alten Klick-Handler bleiben) */
export function rebuildCarousel(carousel: HTMLElement, slides: Slide[], hidden: string[] = []): HTMLElement {
  const fresh = carousel.cloneNode(true) as HTMLElement;
  const track = fresh.querySelector<HTMLElement>('[data-carousel-track]');
  const template = carousel.querySelector('.carousel__slide') ?? document.querySelector('[data-carousel] .carousel__slide');
  if (!track || !template) return carousel;
  const label = fresh.dataset.galleryLabel ?? 'Galerie';
  const count = slides.length;

  track.replaceChildren(
    ...slides.map((slide, index) => {
      const li = template.cloneNode(true) as HTMLElement;
      li.dataset.name = slide.name;
      const img = li.querySelector('img');
      if (img) {
        img.removeAttribute('srcset');
        img.removeAttribute('sizes');
        img.src = slide.src;
        img.loading = index === 0 ? 'eager' : 'lazy';
        img.alt = `${label} – Foto ${index + 1} von ${count}`;
      }
      return li;
    }),
  );
  track.setAttribute('aria-label', `${label}: ${count} ${count === 1 ? 'Foto' : 'Fotos'}`);
  fresh.dataset.count = String(count);
  if (fresh.dataset.gallery !== undefined) fresh.dataset.galleryHidden = hidden.join(',');

  // Zähler, Pfeile und Punkte – aus einer Galerie mit mehreren Fotos übernehmen
  fresh.querySelectorAll('.carousel__counter, .carousel__nav, .carousel__dots').forEach((el) => el.remove());
  const source = document.querySelector('[data-carousel] [data-carousel-next]')?.closest('[data-carousel]');
  if (count > 1 && source) {
    const counter = source.querySelector('.carousel__counter')?.cloneNode(true) as HTMLElement | undefined;
    if (counter) {
      counter.replaceChildren(Object.assign(document.createElement('span'), { textContent: '1' }), `/${count}`);
      counter.firstElementChild?.setAttribute('data-carousel-current', '');
      fresh.append(counter);
    }
    source.querySelectorAll('.carousel__nav').forEach((nav) => fresh.append(nav.cloneNode(true)));
    const dots = source.querySelector('.carousel__dots')?.cloneNode(true) as HTMLElement | undefined;
    const strip = dots?.querySelector('[data-carousel-dots]');
    const dot = strip?.firstElementChild;
    if (dots && strip && dot) {
      strip.replaceChildren(
        ...slides.map((_, index) => {
          const copy = dot.cloneNode(true) as HTMLElement;
          copy.dataset.dist = String(Math.min(index, 3));
          return copy;
        }),
      );
      fresh.append(dots);
    }
  }

  carousel.replaceWith(fresh);
  initCarousel(fresh);
  return fresh;
}

/** Vorgemerkte Galerie-Reihenfolge auf allen Galerien dieses Ordners zeigen */
export async function previewGallery(folder: string) {
  const change = pending.get().galleries[folder];
  if (!change) return;
  const hidden = new Set(change.hidden);
  const visible = change.order.filter((name) => !hidden.has(name));
  const slides = await Promise.all(visible.map(async (name) => ({ name, src: await imageSrc(`${folder}/${name}`) })));
  document.querySelectorAll<HTMLElement>(`[data-carousel][data-gallery="${CSS.escape(folder)}"]`).forEach((carousel) => {
    rebuildCarousel(carousel, slides.filter((slide) => slide.src), change.hidden);
  });
}

/**
 * Referenzprojekte: gelöschte ausblenden (bleiben mit data-ed-deleted im Dokument, damit sie sich wiederherstellen
 * lassen), neue als Kopie eines vorhandenen Projekts in ihre Leistungskarte setzen.
 */
export async function previewProjects() {
  const { added, deleted } = pending.get().projects;
  document.querySelectorAll<HTMLElement>('[data-project-panel]').forEach((panel) => {
    const slug = panel.dataset.project ?? '';
    if (panel.hasAttribute('data-ed-new')) {
      if (!added.some((project) => project.slug === slug)) panel.remove();
      return;
    }
    panel.toggleAttribute('data-ed-deleted', deleted.includes(slug));
  });

  const template = document.querySelector<HTMLElement>('[data-project-panel]:not([data-ed-new])');
  const footerTemplate = document.querySelector('[data-projects]')?.closest('.card__footer');
  for (const project of added) {
    if (!template || document.querySelector(`[data-project-panel][data-project="${CSS.escape(project.slug)}"]`)) continue;
    const card = document.querySelector<HTMLElement>(`.service[data-service="${CSS.escape(project.service)}"]`);
    if (!card) continue;
    let root = card.querySelector<HTMLElement>('[data-projects]');
    if (!root && footerTemplate) {
      // Karte ohne Projekte: Projektbereich einer anderen Karte als Gerüst
      const footer = footerTemplate.cloneNode(true) as HTMLElement;
      footer.querySelectorAll('[data-project-panel]').forEach((panel) => panel.remove());
      card.querySelector('.card__body')?.append(footer);
      root = footer.querySelector<HTMLElement>('[data-projects]');
    }
    if (!root) continue;

    const panel = template.cloneNode(true) as HTMLElement;
    panel.id = `projekt-${project.service}-${project.slug}`;
    panel.dataset.project = project.slug;
    panel.dataset.title = project.title;
    panel.setAttribute('data-ed-new', '');
    panel.removeAttribute('data-ed-deleted');
    const title = panel.querySelector<HTMLElement>('.service__project-title');
    const summary = panel.querySelector<HTMLElement>('.service__project-summary');
    if (title) title.textContent = project.title;
    if (summary) summary.textContent = project.summary;
    const metaText = [project.location, project.year].filter(Boolean).join(' · ');
    let meta = panel.querySelector<HTMLElement>('.service__project-meta');
    if (metaText && !meta && title) {
      meta = title.cloneNode(false) as HTMLElement;
      meta.className = 'service__project-meta';
      title.after(meta);
    }
    if (meta) {
      if (metaText) meta.textContent = metaText;
      else meta.remove();
    }
    root.append(panel);

    const carousel = panel.querySelector<HTMLElement>('[data-carousel]');
    if (carousel) {
      carousel.dataset.gallery = `referenzen/${project.slug}`;
      carousel.dataset.galleryLabel = project.title;
      const slides = await Promise.all(project.photos.map(async (name) => ({ name: name.split('/').pop() ?? name, src: await imageSrc(name) })));
      rebuildCarousel(carousel, slides);
    }
  }

  document.querySelectorAll<HTMLElement>('[data-projects]').forEach(initProjectSwitch);
}
