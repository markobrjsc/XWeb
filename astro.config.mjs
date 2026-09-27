// @ts-check
import { createHash } from 'node:crypto';
import { defineConfig, fontProviders } from 'astro/config';
import sitemap, { ChangeFreqEnum } from '@astrojs/sitemap';
import { JS_DETECT_SCRIPT } from './src/lib/inline-scripts.mjs';

// Produktiv-Domain. Wird für Canonical-URLs, Open-Graph-Tags, Sitemap und robots.txt verwendet.
const SITE_URL = 'https://www.pflasterarbeiten-hildebrand.de';

/** @param {string} source */
const sha256 = (source) => /** @type {`sha256-${string}`} */ (`sha256-${createHash('sha256').update(source).digest('base64')}`);

export default defineConfig({
  site: SITE_URL,
  output: 'static',
  trailingSlash: 'always',

  build: {
    format: 'directory',
  },

  integrations: [
    sitemap({
      filter: (page) => !page.includes('/404'),
      serialize(item) {
        // Startseite hat höchste Priorität, Rechtstexte die niedrigste.
        const path = new URL(item.url).pathname;
        if (path === '/') return { ...item, priority: 1.0, changefreq: ChangeFreqEnum.MONTHLY };
        if (path.startsWith('/impressum') || path.startsWith('/datenschutz')) {
          return { ...item, priority: 0.2, changefreq: ChangeFreqEnum.YEARLY };
        }
        return { ...item, priority: 0.8, changefreq: ChangeFreqEnum.MONTHLY };
      },
    }),
  ],

  // Selbst gehostete Schrift (DSGVO-konform, keine Anfragen an Google & Co.).
  // Die Datei kommt aus dem installierten npm-Paket – beim Build wird nichts aus dem Netz geladen.
  // Archivo ist eine variable Schrift mit Achsen für Stärke (100–900) und Breite (62–125 %).
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'Archivo',
      cssVariable: '--font-archivo',
      fallbacks: ['system-ui', 'sans-serif'],
      options: {
        variants: [
          {
            src: ['@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2'],
            weight: '100 900',
            stretch: '62% 125%',
            style: 'normal',
          },
        ],
      },
    },
  ],

  markdown: {
    // Keine Code-Hervorhebung nötig (Shiki wäre zudem nicht CSP-kompatibel).
    syntaxHighlight: false,
  },

  image: {
    responsiveStyles: true,
  },

  // Content-Security-Policy: Astro erzeugt Hashes für alle eigenen Skripte und Styles.
  // Weitere Sicherheits-Header stehen in public/_headers (Cloudflare).
  security: {
    csp: {
      scriptDirective: {
        hashes: [sha256(JS_DETECT_SCRIPT)],
      },
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        'upgrade-insecure-requests',
      ],
    },
  },

  // Seiten werden beim Überfahren eines Links vorgeladen → spürbar schnellere Navigation.
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'hover',
  },

  devToolbar: {
    enabled: false,
  },
});
