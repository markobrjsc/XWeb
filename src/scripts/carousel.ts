/**
 * Verhalten einer Bildergalerie (src/components/ui/Carousel.astro): Zähler, Pfeile, Punkte, Tastatur.
 * Aufgerufen für alle Galerien in src/scripts/site.ts und vom Bearbeiten-Modus für neu aufgebaute Vorschau-Galerien.
 */
const DOT = 11; // Punktbreite + Abstand in px (siehe --dot / --dot-gap in Carousel.astro)
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function initCarousel(carousel: HTMLElement) {
  const track = carousel.querySelector<HTMLElement>('[data-carousel-track]');
  const count = Number(carousel.dataset.count);
  if (!track || count < 2) return;

  const current = carousel.querySelector<HTMLElement>('[data-carousel-current]');
  const prev = carousel.querySelector<HTMLButtonElement>('[data-carousel-prev]');
  const next = carousel.querySelector<HTMLButtonElement>('[data-carousel-next]');
  const strip = carousel.querySelector<HTMLElement>('[data-carousel-dots]');
  const dots = strip ? [...strip.children].filter((el): el is HTMLElement => el instanceof HTMLElement) : [];
  let index = -1;

  const render = (i: number) => {
    if (i === index) return;
    index = i;
    if (current) current.textContent = String(i + 1);
    if (prev) prev.disabled = i === 0;
    if (next) next.disabled = i === count - 1;
    // Fenster aus max. fünf Punkten, aktiver Punkt möglichst mittig
    const start = Math.max(0, Math.min(i - 2, count - 5));
    dots.forEach((dot, d) => {
      const inWindow = d >= start && d < start + 5;
      const edge = count > 5 && ((d === start && start > 0) || (d === start + 4 && start + 5 < count));
      dot.dataset.dist = d === i ? '0' : !inWindow ? '3' : edge ? '2' : '1';
    });
    strip?.style.setProperty('--dots-offset', `${-start * DOT}px`);
  };

  let frame = 0;
  track.addEventListener(
    'scroll',
    () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => render(Math.round(track.scrollLeft / Math.max(track.clientWidth, 1))));
    },
    { passive: true },
  );

  const go = (delta: number) => {
    const target = clamp(index + delta, 0, count - 1);
    track.scrollTo({ left: target * track.clientWidth, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
  };
  prev?.addEventListener('click', () => go(-1));
  next?.addEventListener('click', () => go(1));

  track.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      go(event.key === 'ArrowRight' ? 1 : -1);
    }
  });

  render(0);
}
