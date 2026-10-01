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

### Referenzprojekte & Zertifikate

- **Referenzen** erscheinen auf der Leistungsseite in den passenden Leistungskarten (Feld `references` in
  `src/data/services.ts` oder `leistungen` in der Projektdatei). Projekt anlegen: im Bearbeiten-Modus Leistungskarte
  anklicken → „Neues Projekt mit Galerie anlegen“ – oder von Hand: Markdown-Datei in `src/content/referenzen/`,
  Fotos in `src/assets/images/referenzen/<dateiname>/`.
- **Zertifikate:** PDF in `src/assets/zertifikate/` legen, Titel/Aussteller/Jahr in
  `src/assets/zertifikate/zertifikate.json` eintragen. Vorschaubilder erzeugt `scripts/build-zertifikate.mjs`
  automatisch vor `npm run dev` und `npm run build`.

### Bearbeiten-Modus

„Bearbeiten“ oben rechts öffnet links eine **Seitenleiste** (Dunkelgrün – alles, was zur Bearbeitung gehört, ist
so klar von der Website zu unterscheiden; auf dem Handy als Fenster von unten). Vier Werkzeuge:

- **Auswahl** – Element auf der Seite anklicken: Text → nur dieser Text, freie Fläche einer Karte → die ganze Karte.
  Die Leiste zeigt den Pfad (übergeordnete Elemente), das Textfeld, je nach Bereich Kopfbild, Galerie oder
  Referenzprojekte, die **Gestaltung** (Schriftfarbe, Hintergrund, Schriftgröße/-stärke, Ausrichtung, Ecken, Breite,
  auf Handy/Computer ausblenden), die **Abstände** (außen/innen je Seite), **Einfügen** (davor, dahinter, innen
  oben/unten) und die **enthaltenen Elemente**, die sich ebenso auswählen und bearbeiten lassen.
- **Einfügen** – Vorlagen, Basis-Elemente und Container mit echter Vorschau: an die gewählte Stelle, per
  Drag & Drop auf die Seite (grüne Linie zeigt die Stelle) oder antippen und Stelle anklicken.
- **Ebenen** – der Aufbau der ganzen Seite als Baum (Kopfzeile, Abschnitte, Inhalte, Fußzeile).
- **Abstände** – beim Überfahren werden Außen- (orange) und Innenabstände (blau) sichtbar, Klick wählt aus.

Das Hand-Symbol (oder Alt + Klick) schaltet auf „Seite bedienen“ – z. B. um Reiter zu wechseln. **Speichern** schreibt
Texte (`src/content/edits.json`), Gestaltung (`src/content/spacing.json` → `scripts/build-spacing.mjs`) und Elemente
(`src/content/blocks.json`) als Commit auf `main`; Kopfbilder, Galerien und neue Projekte speichern direkt.
Code: `src/components/debug/EditMode.astro` (Leiste), `src/scripts/editor/` (Auswahl, Inspektor, Texte, Gestaltung,
Fotos, Projekte), `src/scripts/block-editor.ts` (Elemente), Server: `worker/edit.ts`.

### Elemente aus dem Baukasten

Zur Auswahl stehen **Vorlagen** (Text mit Bild, Drei Vorteile, Karten, Kennzahlen, Aufruf, Galerie, FAQ, Kundenstimme,
Ansprechpartner, Kontakt-Kasten …), **Basis-Elemente** (Überschrift, Text, Bild, Button, Liste, Icon mit Text, Zitat …)
und **Container** (Abschnitt, Spalten, Karte), die weitere Elemente aufnehmen – auch ineinander verschachtelt.
In der Seitenleiste: hoch/runter, duplizieren, verschieben (Knopf ziehen oder klicken), löschen.
Jedes Element hat neben seinen eigenen Optionen eine **Gestaltung**: Ausrichtung,
Farben (Schrift, Hintergrund, Akzent), Schrift (Größe, Stärke, kursiv, Großbuchstaben), Außen-/Innenabstände je Seite,
Rahmen, Ecken, Schatten, maximale Breite und „nur auf Handy/Computer anzeigen“. Große Schriften und Abstände
werden auf kleinen Bildschirmen automatisch verkleinert. Daraus entsteht beim Build CSS je Element
(`src/lib/blocks/style.ts`), das mit Hash in die Content-Security-Policy eingetragen wird.

- Gespeichert in `src/content/blocks.json` (je Seite und Position), eingesetzt beim Build von `src/middleware.ts`
- Elementtypen und Felder: `src/lib/blocks/schema.ts` · Vorlagen: `src/lib/blocks/presets.ts` ·
  HTML: `src/lib/blocks/render.ts` · Aussehen: `src/styles/blocks.css` · Editor: `src/scripts/block-editor.ts`
- Position „2“ bedeutet: nach dem 2. Abschnitt der Seite; „@3.2.1|after“: hinter dem Element an Position 3 → 2 → 1
  ab `<main>` (auch before/start/end). Werden im Code Abschnitte oder Elemente einer Seite ergänzt oder entfernt,
  verschieben sich die Elemente dahinter entsprechend. Elemente, die Skripte erst im Browser einfügen, tragen
  `data-ub-ignore`, damit Editor und Build gleich zählen.

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
