/**
 * Vorlagen für den Element-Editor: fertig zusammengesetzte Elemente aus den Basis-Bausteinen
 * (src/lib/blocks/schema.ts). Nach dem Einfügen ist jedes Teil einzeln änderbar, verschiebbar und löschbar.
 * Alle Vorlagen passen sich an Handy, Tablet und Computer an (Spalten stapeln sich auf schmalen Bildschirmen).
 */
import { site } from '@/config/site';
import { type Block, type BlockStyle, createBlock as b } from './schema';

export type Preset = { id: string; label: string; description: string; icon: string; build: () => Block };

const IMG = {
  garten: 'referenzen/garten-holzdeck-wasserspiel/01',
  hof: 'referenzen/hofeinfahrt-betonpflaster/01',
  hang: 'referenzen/hanggarten-natursteinmauern/01',
  terrasse: 'referenzen/terrassengarten-trockenmauern/08',
  granit: 'referenzen/granitpflaster-bogen/01',
  garage: 'referenzen/garagenzufahrt-natursteinmauern/01',
  team: 'betrieb/team/01',
  team2: 'betrieb/team/06',
  team3: 'betrieb/team/03',
};

/** `align` gehört zur Gestaltung (style), alles andere zu den Feldern (props) */
const container =
  (type: 'section' | 'card') =>
  ({ align, ...props }: Record<string, unknown>, children: Block[]) =>
    b(type, props, [children], align ? { align: align as BlockStyle['align'] } : undefined);
const section = container('section');
const card = container('card');
const columns = (props: Record<string, unknown>, cols: Block[][]) => b('columns', { count: String(cols.length), ...props }, cols);

const textAndImage = (reverse: boolean): Block => {
  const text = [
    b('eyebrow', { text: 'Aus der Praxis' }),
    b('heading', { text: 'Sauber geplant,', accent: 'dauerhaft gebaut.' }),
    b('text', {
      text: 'Beschreiben Sie hier Ihr Angebot oder ein Projekt. Kurze Absätze lesen sich auf dem Handy am besten – Zeilenumbrüche setzen Sie einfach mit Enter.',
    }),
    b('list', { items: ['Fester Ansprechpartner', 'Eigenes Team und eigene Maschinen', 'Termintreue Ausführung'] }),
    b('button', { label: 'Projekt anfragen', href: '/kontakt/' }),
  ];
  const image = [b('image', { image: IMG.garten, alt: 'Gartenanlage mit Holzdeck', ratio: '4-3' })];
  return section({}, [columns({ valign: 'mitte', reverse }, reverse ? [image, text] : [text, image])]);
};

export const PRESETS: Preset[] = [
  {
    id: 'text-bild',
    label: 'Text mit Bild',
    description: 'Überschrift, Text, Liste und Button links – Foto rechts.',
    icon: 'layout-panel-left',
    build: () => textAndImage(false),
  },
  {
    id: 'bild-text',
    label: 'Bild mit Text',
    description: 'Wie „Text mit Bild“, das Foto steht links.',
    icon: 'layout-panel-left',
    build: () => textAndImage(true),
  },
  {
    id: 'intro',
    label: 'Überschrift & Einleitung',
    description: 'Zentrierte Überzeile, Überschrift und Einleitungstext.',
    icon: 'heading',
    build: () =>
      section({ align: 'center', width: 'schmal' }, [
        b('eyebrow', { text: 'Überzeile' }),
        b('heading', { text: 'Eine starke Überschrift', accent: 'für Ihren Abschnitt.' }),
        b('text', { text: 'Ein, zwei Sätze Einleitung, die neugierig auf den Rest der Seite machen.', size: 'gross' }),
      ]),
  },
  {
    id: 'vorteile',
    label: 'Drei Vorteile',
    description: 'Überschrift und drei Karten mit Symbol, Titel und Text.',
    icon: 'layout-grid',
    build: () =>
      section({ tone: 'grau' }, [
        b('eyebrow', { text: 'Ihre Vorteile' }),
        b('heading', { text: 'Warum Kunden', accent: 'mit uns bauen.' }),
        columns({ valign: 'strecken' }, [
          [card({ style: 'schatten' }, [b('iconbox', { icon: 'handshake', title: 'Alles aus einer Hand', text: 'Planung, Ausführung und Abnahme mit einem festen Ansprechpartner.' })])],
          [card({ style: 'schatten' }, [b('iconbox', { icon: 'hard-hat', title: 'Eigenes Team', text: 'Erfahrene Fachkräfte und moderne Maschinen – keine Subunternehmer.' })])],
          [card({ style: 'schatten' }, [b('iconbox', { icon: 'calendar', title: 'Verlässliche Termine', text: 'Wir sagen, wann wir kommen – und halten uns daran.' })])],
        ]),
      ]),
  },
  {
    id: 'karten',
    label: 'Karten mit Bild',
    description: 'Drei Karten mit Foto, Titel, Text und Link – z. B. für Leistungen.',
    icon: 'layout-dashboard',
    build: () => {
      const item = (image: string, title: string, text: string) => [
        card({ style: 'rahmen' }, [
          b('image', { image, ratio: '4-3', alt: title }),
          b('heading', { text: title, accent: '', size: 'klein' }),
          b('text', { text, size: 'klein' }),
          b('button', { label: 'Mehr erfahren', href: '/leistungen/', variant: 'secondary' }),
        ]),
      ];
      return section({}, [
        b('heading', { text: 'Unsere', accent: 'Schwerpunkte.' }),
        columns({ valign: 'strecken' }, [
          item(IMG.hof, 'Pflasterarbeiten', 'Hofeinfahrten, Wege und Plätze aus Beton- und Naturstein.'),
          item(IMG.hang, 'Gartenbau', 'Mauern, Terrassen, Pflanzungen und Wasserspiele.'),
          item(IMG.garage, 'Tief- & Straßenbau', 'Erdbau, Leitungen, Asphalt und Erschließungen.'),
        ]),
      ]);
    },
  },
  {
    id: 'zahlen',
    label: 'Kennzahlen',
    description: 'Dunkles Band mit vier großen Zahlen.',
    icon: 'chart-no-axes-column',
    build: () =>
      section({ tone: 'dunkel', space: 'klein' }, [
        columns({}, [
          [b('stat', { value: `${new Date().getFullYear() - site.foundingYear}+`, label: 'Jahre Erfahrung' })],
          [b('stat', { value: '3', label: 'Fachbereiche' })],
          [b('stat', { value: '100 %', label: 'eigenes Team' })],
          [b('stat', { value: '1', label: 'fester Ansprechpartner' })],
        ]),
      ]),
  },
  {
    id: 'cta',
    label: 'Aufruf mit Buttons',
    description: 'Heller Kasten mit Überschrift, Text und zwei Buttons.',
    icon: 'megaphone',
    build: () =>
      section({ space: 'klein' }, [
        card({ style: 'grau' }, [
          columns({ ratio: 'links', valign: 'mitte' }, [
            [
              b('heading', { text: 'Sie planen ein Projekt?', accent: '', size: 'mittel' }),
              b('text', { text: 'Rufen Sie uns an oder schreiben Sie uns – wir beraten Sie gerne und kommen für ein Angebot vorbei.' }),
            ],
            [
              b('button', { label: 'Kontakt aufnehmen', href: '/kontakt/' }),
              b('button', { label: site.contact.phone, href: site.contact.phoneHref, variant: 'secondary', icon: 'phone' }),
            ],
          ]),
        ]),
      ]),
  },
  {
    id: 'band',
    label: 'Dunkles Aufruf-Band',
    description: 'Zentrierte Überschrift mit Text und Button auf Onyx.',
    icon: 'rectangle-horizontal',
    build: () =>
      section({ tone: 'dunkel', align: 'center', width: 'schmal' }, [
        b('eyebrow', { text: 'Jetzt anfragen' }),
        b('heading', { text: 'Gemeinsam bauen wir', accent: 'Ihr nächstes Projekt.' }),
        b('text', { text: 'Unverbindliche Beratung vor Ort – im ganzen Landkreis Konstanz.', size: 'gross' }),
        b('button', { label: 'Kontakt aufnehmen', href: '/kontakt/' }),
      ]),
  },
  {
    id: 'galerie',
    label: 'Bildergalerie',
    description: 'Überschrift und Fotos im Raster.',
    icon: 'images',
    build: () =>
      section({}, [
        b('heading', { text: 'Einblicke', accent: 'von der Baustelle.' }),
        b('gallery', { images: [IMG.garten, IMG.hof, IMG.hang, IMG.terrasse, IMG.granit, IMG.garage], columns: '3' }),
      ]),
  },
  {
    id: 'faq',
    label: 'Häufige Fragen',
    description: 'Aufklappbare Fragen und Antworten.',
    icon: 'circle-help',
    build: () =>
      section({ width: 'schmal' }, [
        b('eyebrow', { text: 'FAQ' }),
        b('heading', { text: 'Häufige', accent: 'Fragen.' }),
        b('faq', { question: 'Wie schnell bekomme ich ein Angebot?', answer: 'In der Regel innerhalb weniger Tage nach dem Termin vor Ort.' }),
        b('faq', { question: 'Arbeiten Sie auch für Privatkunden?', answer: 'Ja – vom kleinen Gartenweg bis zur großen Hofeinfahrt.' }),
        b('faq', { question: 'In welchem Gebiet sind Sie tätig?', answer: site.serviceArea.summary }),
      ]),
  },
  {
    id: 'zitat',
    label: 'Kundenstimme',
    description: 'Großes Zitat auf hellgrauem Grund.',
    icon: 'quote',
    build: () => section({ tone: 'grau', width: 'schmal', align: 'center' }, [b('quote', {})]),
  },
  {
    id: 'team',
    label: 'Ansprechpartner',
    description: 'Drei Personen-Karten mit Foto, Name und Aufgabe.',
    icon: 'users',
    build: () => {
      const person = (image: string, name: string, role: string) => [
        card({ style: 'rahmen', align: 'center' }, [
          b('image', { image, ratio: '1-1', alt: name }),
          b('heading', { text: name, accent: '', size: 'klein' }),
          b('text', { text: role, size: 'klein' }),
        ]),
      ];
      return section({}, [
        b('heading', { text: 'Ihre', accent: 'Ansprechpartner.' }),
        columns({}, [
          person(IMG.team, 'Vorname Nachname', 'Geschäftsführung'),
          person(IMG.team2, 'Vorname Nachname', 'Bauleitung'),
          person(IMG.team3, 'Vorname Nachname', 'Büro & Termine'),
        ]),
      ]);
    },
  },
  {
    id: 'kontakt',
    label: 'Kontakt-Kasten',
    description: 'Dunkle Karte mit Telefon, E-Mail und Bürozeiten.',
    icon: 'phone',
    build: () =>
      section({ space: 'klein' }, [
        card({ style: 'dunkel' }, [
          columns({ valign: 'mitte' }, [
            [
              b('eyebrow', { text: 'Kontakt' }),
              b('heading', { text: 'Rufen Sie uns an.', accent: '', size: 'mittel' }),
              b('text', { text: site.openingHours.label }),
            ],
            [
              b('button', { label: site.contact.phone, href: site.contact.phoneHref, icon: 'phone' }),
              b('button', { label: 'E-Mail schreiben', href: `mailto:${site.contact.email}`, variant: 'secondary', icon: 'mail' }),
            ],
          ]),
        ]),
      ]),
  },
];
