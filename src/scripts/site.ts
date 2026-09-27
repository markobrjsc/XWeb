/**
 * Client-Skripte der Website – von Astro gebündelt und per CSP abgesichert ausgeliefert.
 *
 *  Header ........... kompakter Zustand beim Scrollen, ausklappbares Menü, Lesefortschritt
 *  Reveal ........... Elemente mit [data-reveal] beim Scrollen einblenden ([data-reveal-group] = gestaffelt)
 *  Zähler ........... [data-count-to] zählt beim Sichtbarwerden hoch
 *  Scroll-Effekte ... [data-parallax] Parallaxe, [data-progress] Fortschrittslinie
 *  Galerien ......... [data-carousel] Zähler „2/13“, Punkte und Pfeile (Instagram-Stil)
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
/* Bildergalerien                                                            */
/* ------------------------------------------------------------------------ */
function initCarousels() {
  const DOT = 11; // Punktbreite + Abstand in px (siehe --dot / --dot-gap in Carousel.astro)

  document.querySelectorAll<HTMLElement>('[data-carousel]').forEach((carousel) => {
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
  });
}

/* ------------------------------------------------------------------------ */
initHeader();
initReveal();
initCounters();
initScrollEffects();
initCarousels();
