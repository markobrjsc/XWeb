/**
 * Client-Skripte der Website – von Astro gebündelt und per CSP abgesichert ausgeliefert.
 *
 *  Header ........... Wechsel zur durchgehenden Leiste beim Scrollen, ausklappbares Menü
 *  Reveal ........... Elemente mit [data-reveal] beim Scrollen einblenden ([data-reveal-group] = gestaffelt)
 *  Zähler ........... [data-count-to] zählt beim Sichtbarwerden hoch
 *  Scroll-Effekte ... [data-parallax] Parallaxe, [data-progress] Fortschrittslinie
 *  Galerien ......... [data-carousel] Zähler „2/13“, Punkte und Pfeile (Instagram-Stil)
 *  Textmarker ....... .accent/.marker bekommen abwechselnd eine von vier Marker-Formen (data-mark)
 *  Nach oben ........ [data-scroll-top] scrollt sanft an den Seitenanfang
 *  Vollbild-Kopf .... [data-hero-snap] erster Scroll nach unten gleitet direkt unter den Kopf
 *
 * Alle Effekte respektieren „Bewegung reduzieren“ im Betriebssystem.
 */

import { smoothScrollTo } from './smooth-scroll';
import { site } from '@/config/site';

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

  // Header: nach dem Scrollen von der runden, schwebenden Leiste zur durchgehenden Leiste oben
  let ticking = false;
  const update = () => {
    const y = window.scrollY;
    header.dataset.scrolled = String(y > 24);
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
/* Nach oben                                                                 */
/* ------------------------------------------------------------------------ */
function initScrollTop() {
  document.querySelectorAll<HTMLAnchorElement>('[data-scroll-top]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      smoothScrollTo(0);
      // Tastaturfokus mitnehmen, ohne den Sprung zu stören
      document.querySelector<HTMLElement>('#main')?.focus({ preventScroll: true });
    });
  });
}

/* ------------------------------------------------------------------------ */
/* Vollbild-Seitenkopf: vom Kopf direkt zum Inhalt darunter gleiten          */
/* ------------------------------------------------------------------------ */
function initHeroSnap() {
  const hero = document.querySelector<HTMLElement>('[data-hero-snap]');
  if (!hero) return;
  const header = document.querySelector<HTMLElement>('[data-site-header]');
  const content = hero.nextElementSibling instanceof HTMLElement ? hero.nextElementSibling : null;

  // Ziel: Unterkante des Kopfes schließt mit dem Header ab – und zwar mit dessen Form *nach* dem Scrollen
  // (durchgehende Leiste ganz oben, ohne Abstand), sonst bliebe ein Streifen des Kopfes sichtbar
  const headerBar = header?.querySelector<HTMLElement>('.site-header__bar');
  const target = () => hero.offsetTop + hero.offsetHeight - (headerBar?.offsetHeight ?? header?.offsetHeight ?? 0);
  const inHero = () => window.scrollY < target() - 4;
  let busyUntil = 0;
  const busy = () => performance.now() < busyUntil;

  const glide = () => {
    // Weiche Animation (ca. 0,9 s) – nachlaufende Mausrad-Ereignisse werden währenddessen geschluckt
    busyUntil = performance.now() + 1000;
    smoothScrollTo(target(), { duration: 900, lock: true });
    if (content) {
      content.tabIndex = -1;
      content.focus({ preventScroll: true });
    }
  };

  // Mausrad / Touchpad – nachlaufende Ereignisse während der Animation schlucken
  window.addEventListener(
    'wheel',
    (event) => {
      if (busy()) {
        event.preventDefault();
        return;
      }
      if (event.deltaY <= 0 || event.ctrlKey || !inHero()) return;
      event.preventDefault();
      glide();
    },
    { passive: false },
  );

  // Wischen auf dem Handy
  let touchY = 0;
  window.addEventListener('touchstart', (event) => (touchY = event.touches[0].clientY), { passive: true });
  window.addEventListener(
    'touchmove',
    (event) => {
      if (busy()) {
        event.preventDefault();
        return;
      }
      if (touchY - event.touches[0].clientY < 12 || !inHero()) return;
      event.preventDefault();
      glide();
    },
    { passive: false },
  );

  // Tastatur
  document.addEventListener('keydown', (event) => {
    if (!['ArrowDown', 'PageDown', ' '].includes(event.key) || !inHero()) return;
    if ((event.target as HTMLElement).closest('input, textarea, select, button, [contenteditable]')) return;
    event.preventDefault();
    glide();
  });

  // Pfeil und Links auf den Inhalt direkt unter dem Kopf („Alle Stellen ansehen“)
  const selectors = ['[data-hero-scroll]'];
  if (content?.id) selectors.push(`a[href="#${content.id}"]`);
  document.querySelectorAll<HTMLAnchorElement>(selectors.join(',')).forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      glide();
    });
  });
}

/* ------------------------------------------------------------------------ */
/**
 * Adress-Links (a[data-maps]) öffnen die Standard-Karten-App des Geräts:
 * iPhone/iPad/Mac → Apple Karten, Android → geo:-Link (Standard-App), sonst Google Maps im Browser.
 */
function initMapsLinks() {
  const ua = navigator.userAgent;
  const isApple = /iPhone|iPad|iPod|Macintosh/.test(ua);
  const isAndroid = /Android/.test(ua);
  if (!isApple && !isAndroid) return;
  const query = encodeURIComponent(site.mapsQuery);
  document.querySelectorAll<HTMLAnchorElement>('a[data-maps]').forEach((link) => {
    link.href = isApple ? `https://maps.apple.com/?q=${query}` : `geo:0,0?q=${query}`;
    if (isAndroid) link.removeAttribute('target');
  });
}

initHeader();
initMapsLinks();
initReveal();
initCounters();
initScrollEffects();
initCarousels();
// Textmarker-Formen abwechseln (Pinselstrich, schräges Band, ausgefranstes Band, Doppelzug)
document.querySelectorAll<HTMLElement>('.accent, .marker').forEach((el, index) => (el.dataset.mark = String(index % 4)));
initScrollTop();
initHeroSnap();
