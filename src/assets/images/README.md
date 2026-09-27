# Fotos für die Website

Fotos in **diesem Ordner** werden automatisch gefunden und beim Build optimiert
(AVIF + WebP in mehreren Größen, passend für Handy bis Großbildschirm).
Unterstützte Formate: `.jpg`, `.jpeg`, `.png`, `.webp`, `.avif` – am besten Querformat, ca. 1600–2400 px breit.
Die Originale liegen unverändert in `fotos-original/` (wird nicht veröffentlicht).

| Datei / Ordner                     | Wo es erscheint                                                         |
| ---------------------------------- | ----------------------------------------------------------------------- |
| `hero.jpg`                         | Startseite, Hintergrundbild (abgedunkelt)                               |
| `referenzen/<projekt>/01.jpg …`    | Galerie der Referenz `src/content/referenzen/<projekt>.md` (01 = Titelbild) |
| `betrieb/team/01.jpg …`            | „Unser Betrieb“: Team-Galerie; einzelne Bilder auch als Seitenkopf       |
| `betrieb/historie/01.jpg …`        | „Unser Betrieb“: Galerie „Firmengeschichte“                             |
| `gartenbau.jpg`, `tiefbau.jpg`, `strassenbau.jpg` | optional: ersetzen die technischen Zeichnungen auf der Leistungsseite |

Reihenfolge in einer Galerie = Reihenfolge der Dateinamen. Ein Foto im Seitenkopf wird über den Namen
angesprochen, z. B. `image="betrieb/team/06"` in `src/pages/kontakt.astro`.

**Neues Projekt:** Ordner `referenzen/<projekt>/` anlegen, Fotos als `01.jpg`, `02.jpg` … hineinlegen und
`src/content/referenzen/<projekt>.md` mit Titel, Fachbereich und Beschreibung anlegen.
