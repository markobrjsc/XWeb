# TODO – Website Pflasterarbeiten Hildebrand

Stand: 30.09.2026 · Hinweis: Jede Speicherung im Bearbeiten-Modus ist ein Commit auf `main` – vor Arbeiten am Code immer `git pull`.

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

## Erledigt (29.09.2026, Runde 3)

- [x] **Header-Logo** wieder im alten Stil: weißes Label mit Maskottchen (SVG) und dunklem Schriftzug, ohne Akzentfarbe
- [x] **Header-Reiter** ohne gelbe Unterstreichung, Schrift fetter (Reiter, aktiver Reiter, Telefonnummer)
- [x] **Marker-Striche** laufen von unten gelb nach oben transparent aus (`--marker-fade` in `tokens.css`)
- [x] **Abstände im Bearbeiten-Modus** (Stift → „Abstände“): Element überfahren zeigt Außen- (orange) und Innenabstände (grün), Klick öffnet Einstellfeld für alle 8 Werte; Speichern schreibt `src/content/spacing.json`, `scripts/build-spacing.mjs` erzeugt daraus `src/styles/custom-spacing.css`; Header/Footer seitenübergreifend, sonst je Seite
- [x] **Zertifikat-Ansicht** mit zwei Karten: links Titel, Aussteller, Jahr, „PDF herunterladen“ und „Schließen“ (zentriert), rechts das Zertifikat mit X oben rechts; auf dem Handy untereinander
- [x] **Geschäftswagen** → „Geschäftswagen (Außendienst / optional)“
- [x] **Social-Vorschaubild** (`public/og-image.jpg`) im neuen Design: Onyx, Gelb, Startbild

## Erledigt (30.09.2026)

- [x] **Elemente im Bearbeiten-Modus** – „+ Element hier einfügen“ zwischen allen Abschnitten: 13 Vorlagen (Text mit Bild, Bild mit Text, Überschrift & Einleitung, Drei Vorteile, Karten mit Bild, Kennzahlen, Aufruf mit Buttons, Dunkles Aufruf-Band, Bildergalerie, Häufige Fragen, Kundenstimme, Ansprechpartner, Kontakt-Kasten), 13 Basis-Elemente und 3 Container (Abschnitt, Spalten, Karte) – beliebig verschachtelbar, Texte/Bilder direkt änderbar, Werkzeugleiste mit Verschieben (auch in andere Elemente), Duplizieren, Einstellungen, Löschen; alles passt sich an Handy, Tablet und Computer an. Gespeichert in `src/content/blocks.json` (siehe README → „Elemente im Bearbeiten-Modus“)

- [x] **Gestaltung je Element** – Ausrichtung (links/Mitte/rechts/Blocksatz), Schrift-/Hintergrund-/Akzentfarbe mit Hausfarben-Schnellwahl, Schriftgröße/-stärke/kursiv/Großbuchstaben, Außen- und Innenabstände je Seite, Rahmen, Ecken, Schatten, max. Breite, Sichtbarkeit Handy/Computer; Trennlinie (hr) mit Farbe, Stärke, Stil und Breite; Abschnitt mit Hintergrundbild, Spaltenabstand, Button-Größe/volle Breite/Textlink, Bild-Link und Bildausschnitt, verlinkte Karten
- [x] **Stellenangebote** – Titel zentriert, „Was wir Ihnen bieten“ als 5 × 2 flache Karten; **Leistungen** – ausgewählter Fachbereich und Projekt-Label mit gelbem Rahmen statt gelber Fläche; **Kontakt/Bewerbung** – Titel zentriert, Formulare kompakter

## Offen / mit Kunde klären

- [ ] **Gelbton** – jetzt `rgb(243, 165, 5)`; mit dem Kunden am Bildschirm gegenprüfen, Feinabstimmung direkt über Stift → „Farben“
- [ ] **Zuordnung Projekte → Leistungen** prüfen (`references` in `src/data/services.ts`)
- [ ] **Social-Vorschaubild** nach größeren Design-Änderungen neu erzeugen (`npm run build && npm run og-image`)
- [ ] Vor dem Livegang: Formular-Empfänger zurück auf t-online, Resend-Domain bestätigen, Bearbeiten-Modus abschalten oder absichern (`EDIT_MODE` in `wrangler.jsonc`)
