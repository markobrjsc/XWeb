/**
 * Client-Skripte der Website – von Astro gebündelt und per CSP abgesichert ausgeliefert.
 *
 *  Header ........... kompakter Zustand beim Scrollen, ausklappbares Menü, Lesefortschritt
 *  Reveal ........... Elemente mit [data-reveal] beim Scrollen einblenden ([data-reveal-group] = gestaffelt)
 *  Zähler ........... [data-count-to] zählt beim Sichtbarwerden hoch
 *  Scroll-Effekte ... [data-parallax] Parallaxe, [data-progress] Fortschrittslinie
 *
 * Alle Effekte respektieren „Bewegung reduzieren“ im Betriebssystem.
 */

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const desktopNav = window.matchMedia('(min-width: 68.75rem)');

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

/* ------------------------------------------------------------------------ */
/* Header & mobiles Menü                                                     */
/* ------------------------------------------------------------------------ */
function initHeader() {
  const header = document.querySelector<HTMLElement>('[data-site-header]');
  if (!header) return;

  const toggle = header.querySelector<HTMLButtonElement>('[data-menu-toggle]');
  const menu = header.querySelector<HTMLElement>('[data-mobile-menu]');
  const label = header.querySelector<HTMLElement>('[data-menu-label]');
  const outside = [document.querySelector('main'), document.querySelector('footer')].filter(
    (el): el is HTMLElement => el instanceof HTMLElement,
  );

  const isOpen = () => header.dataset.menuOpen === 'true';

  const setOpen = (open: boolean, moveFocus = true) => {
    if (!toggle || !menu) return;
    header.dataset.menuOpen = String(open);
    toggle.setAttribute('aria-expanded', String(open));
    if (label) label.textContent = (open ? label.dataset.close : label.dataset.open) ?? label.textContent;
    document.documentElement.classList.toggle('menu-open', open);
    // Inhalte hinter dem Menü sind währenddessen nicht erreichbar (Tastatur & Screenreader)
    outside.forEach((el) => (el.inert = open));
    if (moveFocus) {
      if (open) menu.querySelector<HTMLElement>('a, button')?.focus({ preventScroll: true });
      else toggle.focus({ preventScroll: true });
    }
  };

  toggle?.addEventListener('click', () => setOpen(!isOpen()));

  menu?.addEventListener('click', (event) => {
    if ((event.target as Element).closest('a')) setOpen(false, false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen()) setOpen(false);
  });

  desktopNav.addEventListener('change', (event) => {
    if (event.matches && isOpen()) setOpen(false, false);
  });

  // Kompakter Header + Lesefortschritt
  let ticking = false;
  const update = () => {
    const y = window.scrollY;
    header.dataset.scrolled = String(y > 24);
    const max = document.documentElement.scrollHeight - window.innerHeight;
    header.style.setProperty('--page-progress', max > 0 ? clamp(y / max).toFixed(4) : '0');
    ticking = false;
  };

  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true },
  );
  update();
}

/* ------------------------------------------------------------------------ */
/* Scroll-Animationen                                                        */
/* ------------------------------------------------------------------------ */
function initReveal() {
  const elements = [...document.querySelectorAll<HTMLElement>('[data-reveal]')];
  if (!elements.length) return;

  // Gestaffelte Verzögerung innerhalb einer Gruppe
  document.querySelectorAll<HTMLElement>('[data-reveal-group]').forEach((group) => {
    const step = Number(group.dataset.revealGroup) || 90;
    group.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el, index) => {
      el.style.setProperty('--reveal-delay', `${Math.min(index, 8) * step}ms`);
    });
  });

  if (reducedMotion.matches || !('IntersectionObserver' in window)) {
    elements.forEach((el) => el.classList.add('is-revealed'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-revealed');
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
  );

  elements.forEach((el) => observer.observe(el));
}

/* ------------------------------------------------------------------------ */
/* Zähler                                                                    */
/* ------------------------------------------------------------------------ */
function initCounters() {
  const counters = [...document.querySelectorAll<HTMLElement>('[data-count-to]')];
  if (!counters.length || reducedMotion.matches || !('IntersectionObserver' in window)) return;

  const animate = (el: HTMLElement) => {
    const to = Number(el.dataset.countTo);
    const from = Number(el.dataset.countFrom ?? 0);
    const duration = 1800;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = clamp((now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 4);
      el.textContent = String(Math.round(from + (to - from) * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        animate(entry.target as HTMLElement);
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.5 },
  );

  counters.forEach((el) => {
    el.textContent = String(el.dataset.countFrom ?? 0);
    observer.observe(el);
  });
}

/* ------------------------------------------------------------------------ */
/* Scroll-gekoppelte Effekte                                                 */
/* ------------------------------------------------------------------------ */
function initScrollEffects() {
  const parallax = [...document.querySelectorAll<HTMLElement>('[data-parallax]')];
  const progress = [...document.querySelectorAll<HTMLElement>('[data-progress]')];
  if (!parallax.length && !progress.length) return;

  let ticking = false;
  const update = () => {
    ticking = false;
    const y = window.scrollY;
    const vh = window.innerHeight;

    if (!reducedMotion.matches) {
      parallax.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.bottom < -vh || rect.top > vh * 2) return;
        const speed = Number(el.dataset.parallax) || 0.15;
        el.style.setProperty('--parallax', `${(y * speed).toFixed(1)}px`);
      });

    }

    // Fortschrittslinien zeigen den Stand auch ohne Animation korrekt an
    progress.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const value = clamp((vh * 0.7 - rect.top) / Math.max(rect.height, 1));
      el.style.setProperty('--progress', value.toFixed(3));
    });
  };

  const request = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  };

  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', request);
  update();
}

/* ------------------------------------------------------------------------ */
initHeader();
initReveal();
initCounters();
initScrollEffects();
