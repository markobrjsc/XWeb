/**
 * Weiches Scrollen per Animation – sieht aus, als würde man selbst scrollen, nur automatisch.
 * Unabhängig von der Browser-/System-Einstellung, weil es nur auf ausdrücklichen Klick bzw. den
 * ersten Scroll im Vollbild-Kopf ausgelöst wird.
 */
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

let frame = 0;
let locked = false;

/**
 * Scrollt zu `top` (px). Dauer passt sich der Strecke an (ca. 450–1100 ms). Promise endet nach der Animation.
 * `lock`: Mausrad/Touch brechen die Animation nicht ab (für den Sprung aus dem Vollbild-Kopf).
 */
export function smoothScrollTo(top: number, { duration, lock = false }: { duration?: number; lock?: boolean } = {}): Promise<void> {
  cancelAnimationFrame(frame);
  locked = false;
  const start = window.scrollY;
  const maxTop = document.documentElement.scrollHeight - window.innerHeight;
  const target = Math.max(0, Math.min(top, maxTop));
  const distance = target - start;
  if (Math.abs(distance) < 2) return Promise.resolve();
  locked = lock;

  const time = duration ?? Math.min(1100, Math.max(450, Math.abs(distance) * 0.45));
  const begin = performance.now();

  return new Promise((resolve) => {
    const step = (now: number) => {
      const progress = Math.min(1, (now - begin) / time);
      window.scrollTo({ top: start + distance * easeInOutCubic(progress), behavior: 'instant' });
      if (progress < 1) frame = requestAnimationFrame(step);
      else {
        locked = false;
        resolve();
      }
    };
    frame = requestAnimationFrame(step);
  });
}

/** Läuft gerade ein Sprung, den Mausrad/Touch nicht abbrechen dürfen? */
export const isScrollLocked = () => locked;
// Animation abbrechen, sobald die Person selbst eingreift
['wheel', 'touchstart', 'keydown'].forEach((type) =>
  window.addEventListener(
    type,
    () => {
      if (!locked) cancelAnimationFrame(frame);
    },
    { passive: true },
  ),
);
