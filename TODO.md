# TODO – Website Pflasterarbeiten Hildebrand

Stand: 29.09.2026 · Hinweis: Jede Speicherung im Bearbeiten-Modus ist ein Commit auf `main` – vor Arbeiten am Code immer `git pull`.

## Erledigt (29.09.2026)

- [x] **Farbwelt nur Onyx, Zinkgelb RAL 1018 und Weiß** – `src/styles/tokens.css` (Onyx-Skala, neutrale Grautöne, Gelb nur für Aktionen/Hervorhebungen; Hervorhebungen auf hellem Grund als gelber Marker-Strich), alle fest eingetragenen Blautöne entfernt (Zeichnungen, Raster, Pflastermuster, Kopier-Knopf, Theme-Color), Farbschemata aus der Design-Vorschau entfernt, Formular-Rückmeldungen in Onyx/Gelb
- [x] **Logos als SVG** – Header: gelbes Schriftband (`src/assets/brand/hildebrand-logo.svg`), sonst Maskottchen (`hildebrand-maskottchen.svg`); Favicon (Onyx mit gelbem „H“) und App-Icons neu erzeugt (`npm run assets`)
- [x] **Header** – Start · Leistungen · Stellenangebote · Unser Betrieb, rechts Instagram, Telefon, Kontakt; Instagram auch im mobilen Menü
- [x] **Startseite** – zweiter Button „Stellenangebote“
- [x] **Referenzen in Leistungen** – Projekte je Leistungskarte als Instagram-Galerie, bei mehreren Projekten Auswahl per Chips; Seite `/referenzen/` entfernt, Weiterleitung auf `/leistungen/`
- [x] **Zertifikate** – über „So arbeiten wir“, Vorschau ~35vh, Klick zoomt in die Großansicht auf der Seite, „PDF herunterladen“; neue Zertifikate: PDF in `src/assets/zertifikate/` + Angaben in `zertifikate.json`
- [x] **Vorteile** – Tankgutscheine entfernt, Hansefit und Geschäftswagen ergänzt

## Erledigt (29.09.2026, Runde 2)

- [x] **Header-Logo** – Maskottchen (SVG) mit gelbem Pill-Label „HILDEBRAND“ (weiß mit schwarzer Kontur) dahinter, beides im weißen, abgerundeten Rahmen (`Logo.astro`, Variante `badge`)
- [x] **Header** – Reiter exakt mittig (Raster Logo · Reiter · Aktionen), Instagram dichter am Telefon, gelbe Unterstreichung am aktiven Reiter und beim Überfahren
- [x] **Leistungen: Auswahlleiste** – ausgewählter Fachbereich gelb, weniger Abstand oben, mehr unten
- [x] **Referenzprojekte** – „‹ vorheriges · aktuelles Projekt (2 / 3) · nächstes ›“ statt Chips, Tipp beim Überfahren, passt immer in die Karte
- [x] **Zertifikate** zentriert
- [x] **„Sie planen ein Projekt?“** ohne zusätzlichen Abstand oben
- [x] **„Auf einen Blick“** in Onyx mit weißen Icons und weißer Schrift (gilt für alle Eckdaten-Karten)
- [x] **Mehr gelbe Unterstreichungen** – Titel der Fachbereiche mit Marker (`.marker`), Leistungstitel beim Überfahren, gelbe Linien vor den Überzeilen, Header-Reiter
- [x] **Gelb = rgb(243, 165, 5)** und **Farbwähler im Bearbeiten-Modus** (Stift → „Farben“): Akzent, drei Onyx-Töne, heller Hintergrund; Vorschau sofort, Speichern schreibt `src/styles/custom-colors.css` auf `main`

## Offen / mit Kunde klären

- [ ] **Gelbton** – jetzt `rgb(243, 165, 5)`; mit dem Kunden am Bildschirm gegenprüfen, Feinabstimmung direkt über Stift → „Farben“
- [ ] **Geschäftswagen-Formulierung** bestätigen („Für den Außendienst – oder optional auch darüber hinaus“, `src/data/company.ts`)
- [ ] **Zuordnung Projekte → Leistungen** prüfen (`references` in `src/data/services.ts`)
- [ ] **Social-Vorschaubild** neu erzeugen, sobald die Seite final ist (`npm run build && npm run og-image`)
- [ ] Vor dem Livegang: Formular-Empfänger zurück auf t-online, Resend-Domain bestätigen, Bearbeiten-Modus abschalten oder absichern (`EDIT_MODE` in `wrangler.jsonc`)
