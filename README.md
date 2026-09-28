# Pflasterarbeiten Hildebrand GmbH – Website

Neue Website der **Pflasterarbeiten Hildebrand GmbH** (Radolfzell am Bodensee): Gartenbau, Tiefbau und Straßenbau.
Statische, sehr schnelle und sichere Website auf Basis von [Astro](https://astro.build), vorbereitet für das Hosting bei **Cloudflare**.

| Seite            | Pfad                        | Inhalt                                                                        |
| ---------------- | --------------------------- | ----------------------------------------------------------------------------- |
| Startseite       | `/`                         | Ein Bildschirm ohne Scrollen: Startfoto, Kernaussage, die 3 Fachbereiche als Kreis |
| Leistungen       | `/leistungen/`              | Alle Leistungen je Fachbereich, je Leistung ein Referenzprojekt, Ablauf        |
| Unser Betrieb    | `/betrieb/`                 | Familienbetrieb, Team-Fotos, Firmengeschichte, Auftraggeber, Werte           |
| Referenzen       | `/referenzen/`              | Projekte mit Foto-Galerien (Instagram-Stil), filterbar nach Fachbereich       |
| Stellenangebote  | `/stellenangebote/`         | Offene Stellen, Vorteile, Bewerbungsablauf                                    |
| Stellen-Details  | `/stellenangebote/<stelle>/`| Aufgaben, Profil, Bewerbung (mit Google-for-Jobs-Daten)                       |
| Kontakt          | `/kontakt/`                 | Telefon, E-Mail, Adresse, Bürozeiten, Route, Einsatzgebiet                   |
| Impressum / Datenschutz | `/impressum/`, `/datenschutz/` | Rechtstexte                                                          |

Jeder Menüpunkt ist eine eigene Seite. Beim Wechsel über das Menü gleitet die neue Seite von rechts herein, wenn
sie im Menü weiter rechts steht – sonst von links (View Transitions; Reihenfolge in `src/config/navigation.ts`
und `src/lib/inline-scripts.mjs`). Browser ohne Unterstützung wechseln die Seite ganz normal.

---

## Schnellstart

Voraussetzung: **Node.js 22** (siehe `.node-version`).

```bash
npm install        # Abhängigkeiten installieren
npm run dev        # Entwicklungsserver: http://localhost:4321
npm run build      # Produktionsversion nach dist/ bauen
npm run preview    # gebaute Version lokal ansehen
npm run check      # TypeScript-/Astro-Prüfung
```

---

## Inhalte pflegen

Alle Inhalte liegen an **einer** Stelle – Änderungen erscheinen automatisch überall (Header, Footer, Seiten, SEO-Daten).

| Was                                        | Datei                                       |
| ------------------------------------------ | ------------------------------------------- |
| Firmendaten (Adresse, Telefon, E-Mail, Öffnungszeiten, Register, Einsatzgebiet, Social Media) | `src/config/site.ts` |
| Menüpunkte                                  | `src/config/navigation.ts`                  |
| Fachbereiche & Leistungen (Texte, Stichpunkte, Icons) | `src/data/services.ts`            |
| Werte, Ablauf, Vorteile für Mitarbeitende, Auftraggeber | `src/data/company.ts`           |
| Referenzen (eine Markdown-Datei je Projekt)  | `src/content/referenzen/*.md`               |
| Stellenangebote (eine Markdown-Datei je Stelle) | `src/content/stellenangebote/*.md`       |
| Fotos                                       | `src/assets/images/` (siehe dortige README) |

**Neue Referenz:** Datei in `src/content/referenzen/` kopieren und anpassen, die Fotos in den Ordner
`src/assets/images/referenzen/<gleicher-dateiname>/` legen (`01.jpg`, `02.jpg` … – `01` ist das Titelbild).
Sie erscheinen automatisch als Galerie. Welche Referenz bei einer Leistung gezeigt wird, steht im Feld
`reference` in `src/data/services.ts`.
**Neue Stelle:** Datei in `src/content/stellenangebote/` anlegen; `active: false` blendet eine Stelle aus.
Beim Build prüft ein Schema (`src/content.config.ts`), ob alle Pflichtangaben vorhanden sind.

**Icons:** beliebiger Name aus [lucide.dev/icons](https://lucide.dev/icons), z. B. `icon: 'shovel'`.

### Fotos

Die Website nutzt verkleinerte Fotos (max. 1800 px) in `src/assets/images/` – beim Build werden daraus automatisch
AVIF/WebP-Dateien in mehreren Größen erzeugt. Die vollständige Liste steht in
[`src/assets/images/README.md`](src/assets/images/README.md).

Die **Originalfotos** (ca. 1,6 GB) liegen in `fotos-original/`. Dieser Ordner wird **nicht** veröffentlicht – in
`public/` würden alle Originale unverändert mit hochgeladen. Bitte keine Fotos nach `public/images` legen.

---

## Gestaltung & Komponenten

Das Erscheinungsbild ist sachlich-technisch: Blau, Weiß und Grau, klare Kanten, ruhige Bewegungen, technische
Zeichnungen (Regelquerschnitte, Lageplan) als Bildsprache.

**Design-Tokens** – `src/styles/tokens.css`: Farben, Schriftgrößen, Abstände, Radien, Schatten und Animationsdauern.
Eine Änderung dort wirkt sofort auf der ganzen Website (z. B. `--radius-button` für alle Buttons,
`--color-primary` für die Hauptfarbe).

**Farbwelten** – jeder Bereich mit `data-tone="dark"` oder `"brand"` schaltet alle enthaltenen Komponenten
automatisch auf helle Schrift um.

**Komponenten** – `src/components/`:

| Ordner         | Inhalt                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------ |
| `ui/`          | Grundbausteine: `Button`, `Card`, `Badge`, `Icon`, `IconBadge`, `Section`, `SectionHeader`, `Eyebrow`, `CheckList`, `FeatureCard`, `ServiceCard`, `ReferenceCard`, `JobCard`, `FactList`, `StatCounter`, `ContactList`, `Media`, `Logo`, `Breadcrumbs`, `TechGrid`, `PavingPattern` |
| `sections/`    | Seitenabschnitte aus den Grundbausteinen: `HomeHero`, `PageHero`, `ServicesSection`, `ContactSection` …  |
| `layout/`      | `Header` (einklappbare Navigation) und `Footer`                                           |
| `drawings/`    | Technische Zeichnungen als SVG (Straße, Leitungsgraben, Terrasse, Lageplan)                |
| `seo/`         | Meta-Angaben, Open Graph, strukturierte Daten                                              |

Beispiel: `<Button href="/referenzen/" variant="primary" icon="arrow-right">Referenzen</Button>` –
Varianten `primary`, `secondary`, `ghost`, `light`, `outline-light`.

**Animationen** – Elemente mit `data-reveal` werden beim Scrollen eingeblendet (`data-reveal-group` staffelt
Kinder-Elemente). Zähler (`StatCounter`), Fortschrittslinie im Ablauf, Parallaxe im Seitenkopf und der sich
„zeichnende“ Lageplan runden das ab. Alles respektiert die Systemeinstellung „Bewegung reduzieren“ und ist ohne
JavaScript voll lesbar. Logik: `src/scripts/site.ts`.

---

## SEO

- Eigener Titel, Beschreibung und Canonical-URL je Seite, Open-Graph-/Twitter-Vorschau (`public/og-image.jpg`)
- Strukturierte Daten (JSON-LD): lokales Unternehmen mit Adresse, Öffnungszeiten, Einsatzgebiet und
  Leistungskatalog, Website, Brotkrumen und **JobPosting** für Google for Jobs auf jeder Stellenseite
- `sitemap-index.xml` und `robots.txt` werden automatisch erzeugt
- Saubere Überschriften-Hierarchie, sprechende deutsche URLs, schnelle Ladezeiten
- 301-Weiterleitungen der alten Adressen (`/home.html`, `/kontakt.html`, `/impressum.html` …) in `public/_redirects`

Geprüft mit Lighthouse (Mobil): **Performance 99 · Barrierefreiheit 100 · Best Practices 100 · SEO 100**;
axe-core (WCAG 2.2 AA): keine Verstöße.

---

## Sicherheit & Datenschutz

- Content-Security-Policy mit Hashes für alle Skripte/Styles (Astro, `security.csp`) plus Sicherheits-Header in
  `public/_headers` (HSTS, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`)
- Keine Cookies, kein Tracking, keine eingebetteten Drittinhalte (Karten/Social Media nur als Links)
- Schrift (Archivo) selbst gehostet – keine Verbindung zu Google Fonts
- HTTPS automatisch über Cloudflare

---

## Formulare & E-Mail-Versand

Kontaktformular (`/kontakt/`) und Online-Bewerbung (`/stellenangebote/<stelle>/bewerben/`,
`/stellenangebote/initiativ/`) schicken ihre Daten an einen kleinen **Cloudflare Worker** (`worker/index.ts`), der
die E-Mail über **[Resend](https://resend.com)** an die Adresse aus `src/config/site.ts` verschickt. Beides ist im
kostenlosen Tarif enthalten (Resend: 3.000 E-Mails/Monat, 100/Tag).

- Felder, Auswahlmöglichkeiten und Grenzen für Anhänge: `src/lib/forms.ts` (gilt für Seiten _und_ Worker)
- Anhänge (max. 10 MB pro Datei, 20 MB insgesamt) werden einzeln hochgeladen, kurz im KV-Speicher abgelegt
  (Löschung nach 6 Stunden) und von Resend per Link abgeholt – so bleibt der Worker im kostenlosen CPU-Limit.
- Spam-Schutz: verstecktes Feld + Mindest-Ausfüllzeit; Absenden nur von der eigenen Domain.

### Einmalig einrichten

1. **Resend-Konto** anlegen (kostenlos) → **Domains → Add Domain** → `pflasterarbeiten-hildebrand.de` eintragen und
   die angezeigten DNS-Einträge (SPF/DKIM) bei Cloudflare hinzufügen. Bis die Domain bestätigt ist, in
   `wrangler.jsonc` als Absender `"Website <onboarding@resend.dev>"` eintragen – dann kann Resend aber nur an die
   E-Mail-Adresse des Resend-Kontos senden.
2. **API-Key** bei Resend erstellen (Berechtigung „Sending access“) und im Worker hinterlegen:
   ```bash
   npx wrangler secret put RESEND_API_KEY
   ```
3. **KV-Speicher** für Uploads anlegen und die ausgegebene `id` in `wrangler.jsonc` bei `kv_namespaces` eintragen:
   ```bash
   npx wrangler kv namespace create UPLOADS
   ```
4. Absender (`MAIL_FROM`) und ggf. abweichenden Empfänger (`MAIL_TO`) in `wrangler.jsonc` → `vars` prüfen.

### Lokal testen

```bash
cp .dev.vars.example .dev.vars   # MAIL_DRY_RUN=1: E-Mail wird nur im Terminal ausgegeben
npm run build                    # der Worker liefert die Seiten aus dist/
npm run dev:api                  # Worker auf Port 8787
npm run dev                      # Astro leitet /api/* an den Worker weiter
```

---

## Deployment auf Cloudflare

Die Seiten sind statisch (`dist/`), dazu kommt der Formular-Worker (`worker/index.ts`). Deshalb als **Cloudflare
Worker** bereitstellen (Cloudflare Pages führt den Worker nicht aus). Zwei Wege – beide kostenlos:

### Variante A: Mit GitHub verbinden (empfohlen – automatisches Deployment bei jedem Push)

1. Im Cloudflare-Dashboard: **Workers & Pages → Erstellen → Worker → Mit Git verbinden** und dieses Repository wählen.
2. Build-Befehl: `npm run build` · Deploy-Befehl: `npx wrangler deploy`
3. Speichern & bereitstellen. Jeder Push auf den Hauptbranch veröffentlicht automatisch.

### Variante B: Per Kommandozeile

```bash
npx wrangler login     # einmalig im Browser anmelden
npm run deploy         # baut die Seite und lädt dist/ + Worker hoch (Konfiguration: wrangler.jsonc)
```

### Domain verbinden

1. Domain `pflasterarbeiten-hildebrand.de` zu Cloudflare hinzufügen (Nameserver beim bisherigen Anbieter umstellen).
2. Im Projekt unter **Benutzerdefinierte Domains** `www.pflasterarbeiten-hildebrand.de` hinzufügen.
3. Weiterleitung ohne „www“ → mit „www“: **Regeln → Weiterleitungsregeln** (301) von
   `pflasterarbeiten-hildebrand.de/*` auf `https://www.pflasterarbeiten-hildebrand.de/${1}`.
4. **SSL/TLS → Edgezertifikate → „Immer HTTPS verwenden“** einschalten.

`_headers` und `_redirects` in `public/` werden von Cloudflare automatisch angewendet.
Soll eine andere Domain verwendet werden: `SITE_URL` in `astro.config.mjs` anpassen.

---

## Vor dem Livegang prüfen

- [ ] **Firmendaten** in `src/config/site.ts` bestätigen lassen – insbesondere die mit „PRÜFEN“ markierten Angaben:
      Gründungsjahr (1989), Firmierung laut Handelsregister, USt-IdNr., Registernummer
- [ ] **Impressum & Datenschutzerklärung** rechtlich prüfen lassen (Mustertexte, zugeschnitten auf diese Website)
- [ ] **Referenzen:** Titel und Beschreibungen wurden anhand der Fotos formuliert – bitte prüfen, bei Bedarf
      Ort und Jahr ergänzen (`location`, `year`)
- [ ] **Firmengeschichte:** Texte auf der Seite „Unser Betrieb“ bestätigen lassen
- [ ] **Stellenangebote** inhaltlich prüfen (Aufgaben, Profil, `datePosted`)
- [ ] **E-Mail-Versand** eingerichtet (siehe „Formulare & E-Mail-Versand“) und je eine Test-Anfrage und
      Test-Bewerbung mit Anhang abgeschickt
- [ ] Nach dem Livegang: Sitemap in der **Google Search Console** einreichen und das
      **Google-Unternehmensprofil** auf die neue Website verlinken

---

## Hilfsskripte

| Befehl              | Zweck                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------- |
| `npm run assets`    | Favicons, App-Icons und quadratisches Logo aus `src/assets/brand/hildebrand-logo.webp` erzeugen |
| `npm run og-image`  | Social-Media-Vorschaubild `public/og-image.jpg` aus der gebauten Seite erzeugen (vorher `npm run build`; einmalig `npx playwright install chromium`) |

Beide Ergebnisse liegen bereits im Repository – die Skripte sind nur nach einer Logo- oder Designänderung nötig.
