/**
 * Leistungen – gegliedert in die drei Fachbereiche Gartenbau, Tiefbau und Straßenbau.
 * Texte, Reihenfolge und Icons werden hier gepflegt; Startseite, Footer und SEO-Daten lesen automatisch mit.
 * Icons: beliebiger Name aus https://lucide.dev/icons
 */
export type PillarId = 'gartenbau' | 'tiefbau' | 'strassenbau';

export interface Service {
  id: string;
  title: string;
  icon: string;
  description: string;
  points: string[];
  /**
   * Referenzprojekte aus src/content/referenzen (Dateinamen ohne .md) – erscheinen in der Leistungskarte als
   * Bildergalerie; bei mehreren Projekten per Auswahl umschaltbar. Ein Projekt darf in mehreren Karten stehen.
   */
  references?: string[];
}

export interface Pillar {
  id: PillarId;
  number: string;
  title: string;
  subtitle: string;
  icon: string;
  /** Ein Satz für Karten und Übersichten. */
  teaser: string;
  /** Ausführlicher Einleitungstext im Leistungsbereich. */
  description: string;
  services: Service[];
}

export const pillars: Pillar[] = [
  {
    id: 'gartenbau',
    number: '01',
    title: 'Gartenbau',
    subtitle: 'Garten- & Landschaftsbau',
    icon: 'sprout',
    teaser: 'Höfe, Terrassen, Wege und Pflanzungen – Außenbereiche, die lange Freude machen.',
    description:
      'Ob Hofeinfahrt, Terrasse oder kompletter Garten: Wir gestalten Außenbereiche, die zu Ihrem Haus passen – vom sauber verlegten Pflaster bis zur fertigen Bepflanzung. Ihre Wünsche fließen von Anfang an in die Planung ein, auf Wunsch in enger Abstimmung mit Ihrem Landschaftsarchitekten.',
    services: [
      {
        id: 'pflasterarbeiten',
        references: ['hofeinfahrt-betonpflaster', 'garagenzufahrt-natursteinmauern', 'terrassengarten-trockenmauern'],
        title: 'Pflasterarbeiten',
        icon: 'layout-grid',
        description:
          'Höfe, Einfahrten, Terrassen und Wege aus Natur- oder Betonstein – mit tragfähigem Unterbau, sauberen Fugen und durchdachter Entwässerung.',
        points: ['Hofeinfahrten & Stellplätze', 'Terrassen & Gartenwege', 'Natur- & Betonsteinpflaster', 'Randeinfassungen & Stufen'],
      },
      {
        id: 'pflanzungen',
        references: ['vorgarten-hochbeete-staudenpflanzung', 'trockenmauern-neubau'],
        title: 'Pflanzungen',
        icon: 'sprout',
        description:
          'Bäume, Hecken, Sträucher und Stauden: Wir bereiten den Boden fachgerecht vor und pflanzen standortgerecht, damit Ihr Grün gut anwächst.',
        points: ['Bäume & Hecken', 'Stauden- & Gehölzbeete', 'Rasen & Rollrasen', 'Bodenvorbereitung'],
      },
      {
        id: 'gartengestaltung',
        references: ['garten-holzdeck-wasserspiel', 'hanggarten-natursteinmauern'],
        title: 'Gartengestaltung',
        icon: 'flower-2',
        description:
          'Natursteinmauern, Treppen, Zäune und Teiche: Wir verbinden Materialien und Pflanzen zu einem stimmigen, pflegeleichten Gesamtbild.',
        points: ['Natursteinmauern & Treppen', 'Teichbau', 'Zaunbau', 'Gartenpflege'],
      },
    ],
  },
  {
    id: 'tiefbau',
    number: '02',
    title: 'Tiefbau',
    subtitle: 'Kanal-, Leitungs- & Erdbau',
    icon: 'shovel',
    teaser: 'Kanäle, Leitungen und Erdarbeiten – solide Arbeit unter der Oberfläche.',
    description:
      'Was unter der Erde liegt, muss jahrzehntelang funktionieren. Wir verlegen Kanäle und Leitungen, heben Baugruben aus und schaffen mit sauberem Erdbau die Grundlage für jedes Bauvorhaben – für private Bauherren ebenso wie für Gemeinden und Versorger.',
    services: [
      {
        id: 'kanal-leitungsbau',
        references: ['leitungsbau-hausanschluss'],
        title: 'Kanal- & Leitungsbau',
        icon: 'cable',
        description:
          'Verlegung von Abwasser- und Regenwasserkanälen, Hausanschlüssen, Leerrohren und Kabeltrassen – inklusive Schachtbauwerken.',
        points: ['Abwasser- & Regenwasserkanäle', 'Hausanschlüsse', 'Leerrohre & Kabeltrassen', 'Schächte & Entwässerung'],
      },
      {
        id: 'erdbau',
        references: ['erdbau-baugrube', 'wirtschaftsweg-asphalt'],
        title: 'Erdbau',
        icon: 'mountain',
        description:
          'Geländemodellierung, Bodenaustausch, Planum und Verdichtung: Wir bereiten Ihr Grundstück so vor, dass alles Weitere auf festem Grund steht.',
        points: ['Geländeregulierung', 'Bodenaustausch', 'Planum & Verdichtung', 'Erschließungsarbeiten'],
      },
      {
        id: 'bauaushub',
        references: ['erdbau-baugrube', 'leitungsbau-hausanschluss'],
        title: 'Bauaushub',
        icon: 'truck',
        description:
          'Aushub von Baugruben und Gräben mit eigenem Gerät – inklusive Abtransport und fachgerechter Entsorgung oder Wiederverwertung des Materials.',
        points: ['Baugruben für Neubauten', 'Leitungsgräben', 'Abtransport & Entsorgung', 'Wiederverfüllung'],
      },
      {
        id: 'durchpressungen',
        references: ['leitungsbau-hausanschluss'],
        title: 'Durchpressungen',
        icon: 'drill',
        description:
          'Grabenlose Verlegung von Leitungen unter Straßen, Einfahrten oder Grünflächen hindurch – ohne die Oberfläche aufzureißen.',
        points: ['Unterquerung von Straßen & Wegen', 'Hausanschlüsse ohne Aufgraben', 'Schutz bestehender Flächen', 'Weniger Wiederherstellung'],
      },
    ],
  },
  {
    id: 'strassenbau',
    number: '03',
    title: 'Straßenbau',
    subtitle: 'Straßen-, Wege- & Asphaltbau',
    icon: 'construction',
    teaser: 'Straßen, Wege und Plätze – belastbar aufgebaut und sauber ausgeführt.',
    description:
      'Vom Gehweg über den Parkplatz bis zur Erschließungsstraße: Wir bauen Verkehrsflächen mit dem richtigen Aufbau für die jeweilige Belastung – inklusive Bordsteinen, Rinnen und Straßenentwässerung.',
    services: [
      {
        id: 'strassenbau',
        references: ['granitpflaster-bogen', 'wirtschaftsweg-asphalt'],
        title: 'Straßen- & Wegebau',
        icon: 'road',
        description:
          'Neubau und Sanierung von Straßen, Rad- und Gehwegen, Parkplätzen und Zufahrten – vom frostsicheren Unterbau bis zur fertigen Oberfläche.',
        points: ['Erschließungs- & Anliegerstraßen', 'Rad- & Gehwege', 'Parkplätze & Zufahrten', 'Bordsteine, Rinnen & Abläufe'],
      },
      {
        id: 'asphaltbau',
        references: ['wirtschaftsweg-asphalt'],
        title: 'Asphaltbau',
        icon: 'layers',
        description:
          'Einbau von Asphalttrag- und Deckschichten sowie Reparaturen an bestehenden Flächen – für Privatgrundstücke, Gewerbe und öffentliche Flächen.',
        points: ['Asphalttragschichten', 'Asphaltdeckschichten', 'Ausbesserungen & Aufbrüche', 'Hof- & Gewerbeflächen'],
      },
    ],
  },
];

/** Alle Einzelleistungen als flache Liste (z. B. für Laufband, Footer und SEO). */
export const allServices: Service[] = pillars.flatMap((pillar) => pillar.services);

export function getPillar(id: PillarId): Pillar {
  const pillar = pillars.find((p) => p.id === id);
  if (!pillar) throw new Error(`Unbekannter Fachbereich: ${id}`);
  return pillar;
}
