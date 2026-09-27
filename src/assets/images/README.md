# Fotos für die Website

Fotos in **diesem Ordner** werden automatisch gefunden und beim Build optimiert
(AVIF + WebP in mehreren Größen, passend für Handy bis Großbildschirm).
Solange ein Foto fehlt, zeigt die Website eine technische Zeichnung bzw. einen neutralen Platzhalter.

Unterstützte Formate: `.jpg`, `.jpeg`, `.png`, `.webp`, `.avif` – am besten Querformat, mind. 1600 px breit.
Groß-/Kleinschreibung des Dateinamens spielt keine Rolle.

| Dateiname                          | Wo es erscheint                                                         |
| ---------------------------------- | ----------------------------------------------------------------------- |
| `hero.jpg`                         | Startseite, Hintergrund des Startbildschirms (abgedunkelt)              |
| `gartenbau.jpg`                    | Startseite, Leistungsbereich „Gartenbau“ (ersetzt die Zeichnung)        |
| `tiefbau.jpg`                      | Startseite, Leistungsbereich „Tiefbau“ (ersetzt die Zeichnung)          |
| `strassenbau.jpg`                  | Startseite, Leistungsbereich „Straßenbau“ (ersetzt die Zeichnung)       |
| `betrieb.jpg`                      | Seite „Unser Betrieb“ (z. B. Teamfoto oder Betriebsgelände)             |
| `referenzen/<dateiname>.jpg`       | Referenz-Karte; `<dateiname>` = Name der Datei in `src/content/referenzen` |

Beispiel: Zur Referenz `src/content/referenzen/hofeinfahrt-natursteinpflaster.md`
gehört das Foto `src/assets/images/referenzen/hofeinfahrt-natursteinpflaster.jpg`.

**Hinweis:** Bitte keine Fotos nach `public/images` legen – dort werden sie nicht optimiert.
