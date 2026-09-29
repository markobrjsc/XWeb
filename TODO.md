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

## Offen / mit Kunde klären

- [ ] **RAL 1018 am Bildschirm abgleichen** – aktuell `#F8F32B` (`--yellow-500` in `src/styles/tokens.css`); RAL-Farben haben keinen festen Bildschirmwert, eine Änderung dort wirkt überall
- [ ] **Geschäftswagen-Formulierung** bestätigen („Für den Außendienst – oder optional auch darüber hinaus“, `src/data/company.ts`)
- [ ] **Zuordnung Projekte → Leistungen** prüfen (`references` in `src/data/services.ts`)
- [ ] **Social-Vorschaubild** neu erzeugen, sobald die Seite final ist (`npm run build && npm run og-image`)
- [ ] Vor dem Livegang: Formular-Empfänger zurück auf t-online, Resend-Domain bestätigen, Bearbeiten-Modus abschalten oder absichern (`EDIT_MODE` in `wrangler.jsonc`)
