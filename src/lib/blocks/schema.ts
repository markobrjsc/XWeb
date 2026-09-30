/**
 * Elemente (Bausteine) aus dem Bearbeiten-Modus – Aufbau, Felder und Prüfung.
 * Wird von drei Stellen gemeinsam genutzt: Build (src/lib/blocks/server.ts), Editor im Browser
 * (src/scripts/block-editor.ts) und Speichern im Worker (worker/edit.ts).
 *
 * Gespeichert in src/content/blocks.json, je Seite und Einfügestelle („Zone“):
 *   { "/leistungen/": { "2": [ Block, Block ] } }
 * Zone n = nach dem n-ten Abschnitt der Seite (Kinder von <main>, gezählt ab 1).
 * Achtung: Werden im Code Abschnitte einer Seite ergänzt oder entfernt, verschieben sich die Zonen dahinter.
 *
 * Ein Block: { id, type, props, slots? } – Container (Abschnitt, Spalten, Karte) haben `slots`,
 * darin wieder beliebige Blöcke (auch weitere Container).
 */

export type Block = {
  id: string;
  type: BlockType;
  props: Record<string, unknown>;
  slots?: Block[][];
  /** Gestaltung, die jedes Element hat (Ausrichtung, Farben, Schrift, Abstände …) – siehe BlockStyle */
  style?: BlockStyle;
};

/** Abstände je Seite in px – fehlender Wert = Standard */
export type Sides = Partial<Record<'top' | 'right' | 'bottom' | 'left', number>>;

/**
 * Gestaltung eines Elements. Wird beim Build zu CSS für genau dieses Element (src/lib/blocks/style.ts),
 * Ausrichtung, Schatten und Sichtbarkeit als Klassen (src/styles/blocks.css).
 */
export type BlockStyle = {
  align?: 'left' | 'center' | 'right' | 'justify';
  textColor?: string;
  bgColor?: string;
  /** Akzent: Marker, Buttons, Icons, Linien */
  accentColor?: string;
  /** Schriftgröße in px (auf dem Handy automatisch etwas kleiner) */
  fontSize?: number;
  fontWeight?: '400' | '500' | '600' | '700' | '800';
  italic?: boolean;
  uppercase?: boolean;
  padding?: Sides;
  margin?: Sides;
  radius?: number;
  borderWidth?: number;
  borderColor?: string;
  shadow?: 'klein' | 'gross';
  /** Maximale Breite in px */
  maxWidth?: number;
  hide?: 'mobil' | 'desktop';
};

/** Zonen einer Seite: Schlüssel = Position (Anzahl der Seitenabschnitte davor) */
export type PageBlocks = Record<string, Block[]>;
export type BlocksFile = Record<string, PageBlocks>;

type Option = readonly [value: string, label: string];

export type Field =
  | { key: string; label: string; kind: 'text' | 'textarea' | 'link'; placeholder?: string; hint?: string }
  | { key: string; label: string; kind: 'select'; options: readonly Option[] }
  | { key: string; label: string; kind: 'toggle' }
  | { key: string; label: string; kind: 'image' }
  | { key: string; label: string; kind: 'images' }
  | { key: string; label: string; kind: 'icon' }
  | { key: string; label: string; kind: 'lines'; hint?: string }
  | { key: string; label: string; kind: 'color' }
  | { key: string; label: string; kind: 'number'; min: number; max: number; unit?: string };

export type BlockGroup = 'container' | 'basis';

export type BlockDef = {
  label: string;
  /** Lucide-Icon für die Auswahl */
  icon: string;
  group: BlockGroup;
  description: string;
  defaults: Record<string, unknown>;
  fields: Field[];
  /** Anzahl der Bereiche für Kind-Elemente (nur Container) */
  slots?: (props: Record<string, unknown>) => number;
  /** Beschriftung der Bereiche im Editor */
  slotLabel?: string;
};

/* ------------------------------------------------------------------------ */
/* Auswahllisten                                                             */
/* ------------------------------------------------------------------------ */
const TONES = [
  ['hell', 'Weiß'],
  ['grau', 'Hellgrau'],
  ['dunkel', 'Onyx (dunkel)'],
] as const;

/** Icons, die in Elementen zur Auswahl stehen (Lucide-Namen) */
export const BLOCK_ICONS = [
  'hard-hat', 'shovel', 'construction', 'truck', 'tractor', 'hammer', 'wrench', 'ruler',
  'trees', 'leaf', 'sprout', 'flower-2', 'fence', 'brick-wall', 'mountain', 'droplets',
  'route', 'map-pin', 'building-2', 'house', 'layers', 'grid-3x3', 'sun', 'snowflake',
  'phone', 'mail', 'message-square', 'clock', 'calendar', 'users', 'user-round', 'handshake',
  'check', 'circle-check', 'badge-check', 'shield-check', 'award', 'star', 'thumbs-up', 'heart',
  'sparkles', 'euro', 'timer', 'info', 'lightbulb', 'recycle', 'camera', 'instagram',
] as const;

/* ------------------------------------------------------------------------ */
/* Alle Elemente                                                             */
/* ------------------------------------------------------------------------ */
export const BLOCKS = {
  /* ---------------- Container ---------------- */
  section: {
    label: 'Abschnitt',
    icon: 'panels-top-left',
    group: 'container',
    description: 'Breiter Bereich über die ganze Seite mit Hintergrundfarbe – auf oberster Ebene die Grundlage jeder Vorlage.',
    defaults: { tone: 'hell', width: 'normal', space: 'normal', bgImage: '', overlay: '50' },
    fields: [
      { key: 'tone', label: 'Farbwelt', kind: 'select', options: TONES },
      { key: 'bgImage', label: 'Hintergrundbild (optional)', kind: 'image' },
      {
        key: 'overlay',
        label: 'Hintergrundbild abdunkeln',
        kind: 'select',
        options: [
          ['0', 'Nicht abdunkeln'],
          ['30', 'Leicht'],
          ['50', 'Mittel'],
          ['70', 'Stark'],
        ],
      },
      {
        key: 'width',
        label: 'Inhaltsbreite',
        kind: 'select',
        options: [
          ['schmal', 'Schmal (Lesetext)'],
          ['normal', 'Normal'],
          ['breit', 'Breit'],
        ],
      },
      {
        key: 'space',
        label: 'Abstand oben/unten',
        kind: 'select',
        options: [
          ['normal', 'Normal'],
          ['klein', 'Klein'],
          ['ohne', 'Ohne'],
        ],
      },
    ],
    slots: () => 1,
  },
  columns: {
    label: 'Spalten',
    icon: 'columns-3',
    group: 'container',
    description: '2–4 Spalten nebeneinander, auf dem Handy automatisch untereinander.',
    defaults: { count: '2', ratio: 'gleich', valign: 'oben', gap: 'normal' },
    fields: [
      {
        key: 'count',
        label: 'Spalten',
        kind: 'select',
        options: [
          ['2', '2 Spalten'],
          ['3', '3 Spalten'],
          ['4', '4 Spalten'],
        ],
      },
      {
        key: 'ratio',
        label: 'Aufteilung (bei 2 Spalten)',
        kind: 'select',
        options: [
          ['gleich', 'Gleich breit'],
          ['links', 'Links breiter (2 : 1)'],
          ['rechts', 'Rechts breiter (1 : 2)'],
        ],
      },
      {
        key: 'valign',
        label: 'Vertikal',
        kind: 'select',
        options: [
          ['oben', 'Oben ausrichten'],
          ['mitte', 'Mittig ausrichten'],
          ['strecken', 'Gleich hoch (Karten)'],
        ],
      },
      {
        key: 'gap',
        label: 'Abstand zwischen den Spalten',
        kind: 'select',
        options: [
          ['klein', 'Klein'],
          ['normal', 'Normal'],
          ['gross', 'Groß'],
        ],
      },
      { key: 'reverse', label: 'Auf dem Handy rechte Spalte zuerst', kind: 'toggle' },
    ],
    slots: (props) => Number(props.count) || 2,
    slotLabel: 'Spalte',
  },
  card: {
    label: 'Karte',
    icon: 'square',
    group: 'container',
    description: 'Kasten mit Innenabstand – z. B. für Vorteile, Leistungen oder Ansprechpartner.',
    defaults: { style: 'rahmen', href: '' },
    fields: [
      {
        key: 'style',
        label: 'Aussehen',
        kind: 'select',
        options: [
          ['rahmen', 'Weiß mit Rahmen'],
          ['schatten', 'Weiß mit Schatten'],
          ['grau', 'Hellgrau'],
          ['dunkel', 'Onyx (dunkel)'],
          ['akzent', 'Mit gelber Kante'],
        ],
      },
      { key: 'href', label: 'Ganze Karte verlinken (optional)', kind: 'link', hint: 'z. B. /kontakt/ – die Karte wird anklickbar' },
    ],
    slots: () => 1,
  },

  /* ---------------- Basis ---------------- */
  eyebrow: {
    label: 'Überzeile',
    icon: 'minus',
    group: 'basis',
    description: 'Kleine Zeile in Großbuchstaben über einer Überschrift.',
    defaults: { text: 'Überzeile' },
    fields: [{ key: 'text', label: 'Text', kind: 'text' }],
  },
  heading: {
    label: 'Überschrift',
    icon: 'heading',
    group: 'basis',
    description: 'Überschrift mit optionaler gelb markierter Hervorhebung.',
    defaults: { text: 'Neue Überschrift', accent: 'mit Hervorhebung.', size: 'gross' },
    fields: [
      { key: 'text', label: 'Text', kind: 'text' },
      { key: 'accent', label: 'Hervorhebung (gelb markiert, optional)', kind: 'text' },
      {
        key: 'size',
        label: 'Größe',
        kind: 'select',
        options: [
          ['gross', 'Groß (Abschnitt)'],
          ['mittel', 'Mittel'],
          ['klein', 'Klein (Karte)'],
        ],
      },
    ],
  },
  text: {
    label: 'Text',
    icon: 'text',
    group: 'basis',
    description: 'Absatz – Zeilenumbrüche mit Enter.',
    defaults: { text: 'Hier steht Ihr Text. Einfach anklicken und lostippen.', size: 'normal' },
    fields: [
      { key: 'text', label: 'Text', kind: 'textarea' },
      {
        key: 'size',
        label: 'Größe',
        kind: 'select',
        options: [
          ['normal', 'Normal'],
          ['gross', 'Einleitung (größer)'],
          ['klein', 'Klein'],
        ],
      },
    ],
  },
  image: {
    label: 'Bild',
    icon: 'image',
    group: 'basis',
    description: 'Foto aus der Bibliothek oder neu hochgeladen.',
    defaults: { image: '', alt: '', ratio: '4-3', caption: '', position: 'mitte', href: '' },
    fields: [
      { key: 'image', label: 'Bild', kind: 'image' },
      { key: 'alt', label: 'Bildbeschreibung (für Google & Screenreader)', kind: 'text' },
      {
        key: 'ratio',
        label: 'Format',
        kind: 'select',
        options: [
          ['original', 'Original'],
          ['16-9', 'Breit (16 : 9)'],
          ['4-3', 'Quer (4 : 3)'],
          ['1-1', 'Quadrat'],
          ['3-4', 'Hoch (3 : 4)'],
        ],
      },
      {
        key: 'position',
        label: 'Bildausschnitt',
        kind: 'select',
        options: [
          ['oben', 'Oben'],
          ['mitte', 'Mitte'],
          ['unten', 'Unten'],
        ],
      },
      { key: 'caption', label: 'Bildunterschrift (optional)', kind: 'text' },
      { key: 'href', label: 'Link beim Anklicken (optional)', kind: 'link' },
    ],
  },
  button: {
    label: 'Button',
    icon: 'mouse-pointer-click',
    group: 'basis',
    description: 'Schaltfläche mit Link. Mehrere Buttons hintereinander stehen nebeneinander.',
    defaults: { label: 'Kontakt aufnehmen', href: '/kontakt/', variant: 'primary', icon: 'arrow-right', size: 'normal', full: false, newTab: false },
    fields: [
      { key: 'label', label: 'Beschriftung', kind: 'text' },
      { key: 'href', label: 'Link', kind: 'link', hint: 'z. B. /kontakt/, tel:+49…, mailto:… oder https://…' },
      {
        key: 'variant',
        label: 'Aussehen',
        kind: 'select',
        options: [
          ['primary', 'Gelb (Hauptaktion)'],
          ['secondary', 'Weiß mit Rahmen'],
          ['dunkel', 'Onyx'],
          ['link', 'Nur Text mit Pfeil'],
        ],
      },
      {
        key: 'icon',
        label: 'Symbol',
        kind: 'select',
        options: [
          ['arrow-right', 'Pfeil'],
          ['phone', 'Telefon'],
          ['mail', 'E-Mail'],
          ['map-pin', 'Ort'],
          ['instagram', 'Instagram'],
          ['download', 'Download'],
          ['', 'Ohne'],
        ],
      },
      {
        key: 'size',
        label: 'Größe',
        kind: 'select',
        options: [
          ['klein', 'Klein'],
          ['normal', 'Normal'],
          ['gross', 'Groß'],
        ],
      },
      { key: 'full', label: 'Volle Breite', kind: 'toggle' },
      { key: 'newTab', label: 'In neuem Tab öffnen', kind: 'toggle' },
    ],
  },
  list: {
    label: 'Liste',
    icon: 'list-checks',
    group: 'basis',
    description: 'Aufzählung mit Haken, Punkten oder Nummern.',
    defaults: { items: ['Erster Punkt', 'Zweiter Punkt', 'Dritter Punkt'], style: 'haken' },
    fields: [
      { key: 'items', label: 'Einträge', kind: 'lines', hint: 'Ein Eintrag pro Zeile' },
      {
        key: 'style',
        label: 'Aufzählungszeichen',
        kind: 'select',
        options: [
          ['haken', 'Haken'],
          ['punkte', 'Punkte'],
          ['nummern', 'Nummern'],
        ],
      },
    ],
  },
  iconbox: {
    label: 'Icon mit Text',
    icon: 'badge-check',
    group: 'basis',
    description: 'Symbol, Titel und kurzer Text – ideal für Vorteile.',
    defaults: { icon: 'badge-check', title: 'Vorteil', text: 'Kurze Beschreibung in ein, zwei Sätzen.', layout: 'oben' },
    fields: [
      { key: 'icon', label: 'Symbol', kind: 'icon' },
      { key: 'title', label: 'Titel', kind: 'text' },
      { key: 'text', label: 'Text', kind: 'textarea' },
      {
        key: 'layout',
        label: 'Anordnung',
        kind: 'select',
        options: [
          ['oben', 'Symbol oben'],
          ['links', 'Symbol links'],
        ],
      },
    ],
  },
  stat: {
    label: 'Kennzahl',
    icon: 'chart-no-axes-column',
    group: 'basis',
    description: 'Große Zahl mit Beschriftung, z. B. „30+ Jahre Erfahrung“.',
    defaults: { value: '30+', label: 'Jahre Erfahrung' },
    fields: [
      { key: 'value', label: 'Zahl', kind: 'text' },
      { key: 'label', label: 'Beschriftung', kind: 'text' },
    ],
  },
  quote: {
    label: 'Zitat',
    icon: 'quote',
    group: 'basis',
    description: 'Kundenstimme oder Leitsatz mit Namen.',
    defaults: { text: 'Pünktlich, sauber und genau so, wie besprochen. Jederzeit wieder.', author: 'Familie Muster', role: 'Hofeinfahrt in Radolfzell' },
    fields: [
      { key: 'text', label: 'Zitat', kind: 'textarea' },
      { key: 'author', label: 'Name', kind: 'text' },
      { key: 'role', label: 'Zusatz (Ort, Projekt …)', kind: 'text' },
    ],
  },
  faq: {
    label: 'Frage & Antwort',
    icon: 'circle-help',
    group: 'basis',
    description: 'Aufklappbare Frage. Mehrere untereinander ergeben eine FAQ-Liste.',
    defaults: { question: 'Ihre Frage?', answer: 'Die passende Antwort.' },
    fields: [
      { key: 'question', label: 'Frage', kind: 'text' },
      { key: 'answer', label: 'Antwort', kind: 'textarea' },
    ],
  },
  gallery: {
    label: 'Bildergalerie',
    icon: 'images',
    group: 'basis',
    description: 'Mehrere Fotos im Raster.',
    defaults: { images: [], columns: '3', ratio: '4-3' },
    fields: [
      { key: 'images', label: 'Bilder', kind: 'images' },
      {
        key: 'columns',
        label: 'Spalten (Computer)',
        kind: 'select',
        options: [
          ['2', '2'],
          ['3', '3'],
          ['4', '4'],
        ],
      },
      {
        key: 'ratio',
        label: 'Format',
        kind: 'select',
        options: [
          ['4-3', 'Quer (4 : 3)'],
          ['1-1', 'Quadrat'],
          ['3-4', 'Hoch (3 : 4)'],
        ],
      },
    ],
  },
  spacer: {
    label: 'Abstand',
    icon: 'move-vertical',
    group: 'basis',
    description: 'Leerer Zwischenraum.',
    defaults: { size: 'm' },
    fields: [
      {
        key: 'size',
        label: 'Höhe',
        kind: 'select',
        options: [
          ['s', 'Klein'],
          ['m', 'Mittel'],
          ['l', 'Groß'],
        ],
      },
    ],
  },
  divider: {
    label: 'Trennlinie (hr)',
    icon: 'separator-horizontal',
    group: 'basis',
    description: 'Horizontale Linie – Farbe, Stärke, Stil und Breite einstellbar.',
    defaults: { color: '', thickness: 1, line: 'solid', width: '100' },
    fields: [
      { key: 'color', label: 'Farbe (leer = Standard)', kind: 'color' },
      { key: 'thickness', label: 'Stärke', kind: 'number', min: 1, max: 12, unit: 'px' },
      {
        key: 'line',
        label: 'Linienart',
        kind: 'select',
        options: [
          ['solid', 'Durchgezogen'],
          ['dashed', 'Gestrichelt'],
          ['dotted', 'Gepunktet'],
        ],
      },
      {
        key: 'width',
        label: 'Breite',
        kind: 'select',
        options: [
          ['100', 'Volle Breite'],
          ['75', '3/4'],
          ['50', 'Halb'],
          ['25', 'Kurz (1/4)'],
          ['kurz', 'Nur ein Strich (4 rem)'],
        ],
      },
    ],
  },
} satisfies Record<string, BlockDef>;

export type BlockType = keyof typeof BLOCKS;

export const blockDef = (type: string): BlockDef | undefined =>
  Object.hasOwn(BLOCKS, type) ? (BLOCKS as Record<string, BlockDef>)[type] : undefined;

export const slotCount = (block: Pick<Block, 'type' | 'props'>) => blockDef(block.type)?.slots?.(block.props) ?? 0;

/* ------------------------------------------------------------------------ */
/* Prüfen & Bereinigen (vor dem Speichern und beim Build)                    */
/* ------------------------------------------------------------------------ */
export const LIMITS = { depth: 6, blocksPerPage: 400, text: 3000, lines: 60, images: 40 } as const;

const ID_PATTERN = /^[a-z0-9]{4,16}$/;
const IMAGE_PATTERN = /^[a-z0-9][a-z0-9/_-]{0,160}$/;
const ICON_PATTERN = /^[a-z0-9-]{1,40}$/;
/** Erlaubte Links: Seiten der Website, Anker, Telefon, E-Mail und externe https-Adressen – nie javascript: */
const LINK_PATTERN = /^(\/[^\s]*|#[\w-]*|tel:\+?[\d\s/()-]{3,30}|mailto:[^\s<>"]{3,120}|https?:\/\/[^\s<>"]{3,500})$/i;

const COLOR_PATTERN = /^#[0-9a-f]{6}$/;

export const isValidLink = (link: string) => link === '' || LINK_PATTERN.test(link);

const cleanColor = (value: unknown) => {
  const color = String(value ?? '').trim().toLowerCase();
  return COLOR_PATTERN.test(color) ? color : undefined;
};

const cleanNumber = (value: unknown, min: number, max: number) => {
  if (value === '' || value === null || value === undefined) return undefined;
  const number = Math.round(Number(value));
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : undefined;
};

const cleanSides = (value: unknown, min: number, max: number): Sides | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const sides: Sides = {};
  for (const side of ['top', 'right', 'bottom', 'left'] as const) {
    const number = cleanNumber((value as Sides)[side], min, max);
    if (number !== undefined) sides[side] = number;
  }
  return Object.keys(sides).length ? sides : undefined;
};

const oneOf = <T extends string>(value: unknown, options: readonly T[]) =>
  options.includes(String(value) as T) ? (String(value) as T) : undefined;

/** Gestaltung prüfen – nur bekannte Eigenschaften mit gültigen Werten bleiben übrig */
export function sanitizeStyle(input: unknown): BlockStyle | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const raw = input as Record<string, unknown>;
  const style: BlockStyle = {
    align: oneOf(raw.align, ['left', 'center', 'right', 'justify'] as const),
    textColor: cleanColor(raw.textColor),
    bgColor: cleanColor(raw.bgColor),
    accentColor: cleanColor(raw.accentColor),
    fontSize: cleanNumber(raw.fontSize, 8, 160),
    fontWeight: oneOf(raw.fontWeight, ['400', '500', '600', '700', '800'] as const),
    italic: raw.italic === true || undefined,
    uppercase: raw.uppercase === true || undefined,
    padding: cleanSides(raw.padding, 0, 400),
    margin: cleanSides(raw.margin, -400, 400),
    radius: cleanNumber(raw.radius, 0, 200),
    borderWidth: cleanNumber(raw.borderWidth, 0, 20),
    borderColor: cleanColor(raw.borderColor),
    shadow: oneOf(raw.shadow, ['klein', 'gross'] as const),
    maxWidth: cleanNumber(raw.maxWidth, 40, 2400),
    hide: oneOf(raw.hide, ['mobil', 'desktop'] as const),
  };
  for (const key of Object.keys(style) as (keyof BlockStyle)[]) if (style[key] === undefined) delete style[key];
  return Object.keys(style).length ? style : undefined;
}

export const newId = () => Math.random().toString(36).slice(2, 10).padEnd(8, '0');

const cleanText = (value: unknown, max: number = LIMITS.text) =>
  String(value ?? '')
    .replace(/\r\n?/g, '\n')
    // Steuerzeichen entfernen, Zeilenumbrüche behalten
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '')
    .slice(0, max);

function cleanProp(field: Field, value: unknown, fallback: unknown): unknown {
  switch (field.kind) {
    case 'text':
      return cleanText(value, 500).replace(/\n+/g, ' ');
    case 'textarea':
      return cleanText(value);
    case 'link': {
      const link = String(value ?? '').trim();
      return link === '' || LINK_PATTERN.test(link) ? link : fallback;
    }
    case 'select': {
      const option = String(value ?? '');
      return field.options.some(([v]) => v === option) ? option : fallback;
    }
    case 'toggle':
      return value === true;
    case 'image': {
      const name = String(value ?? '').toLowerCase();
      return name === '' || IMAGE_PATTERN.test(name) ? name : '';
    }
    case 'images':
      return (Array.isArray(value) ? value : [])
        .map((name) => String(name).toLowerCase())
        .filter((name) => IMAGE_PATTERN.test(name))
        .slice(0, LIMITS.images);
    case 'icon': {
      const name = String(value ?? '');
      return ICON_PATTERN.test(name) ? name : fallback;
    }
    case 'lines':
      return (Array.isArray(value) ? value : String(value ?? '').split('\n'))
        .map((line) => cleanText(line, 500).replace(/\n+/g, ' '))
        .slice(0, LIMITS.lines);
    case 'color':
      return cleanColor(value) ?? '';
    case 'number':
      return cleanNumber(value, field.min, field.max) ?? fallback;
  }
}

/** Einen Block-Baum prüfen: unbekannte Typen und Felder fallen weg, Werte werden begrenzt */
export function sanitizeBlocks(input: unknown, depth = 0, counter = { n: 0 }): Block[] {
  if (!Array.isArray(input) || depth >= LIMITS.depth) return [];
  const result: Block[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object' || counter.n >= LIMITS.blocksPerPage) continue;
    const { id, type, props, slots, style } = raw as Partial<Block>;
    const def = blockDef(String(type));
    if (!def) continue;
    counter.n += 1;
    const source = props && typeof props === 'object' ? props : {};
    const clean: Record<string, unknown> = {};
    for (const field of def.fields) {
      const value = Object.hasOwn(source, field.key) ? source[field.key] : def.defaults[field.key];
      clean[field.key] = cleanProp(field, value, def.defaults[field.key]);
    }
    const block: Block = { id: ID_PATTERN.test(String(id)) ? String(id) : newId(), type: type as BlockType, props: clean };
    const cleanStyle = sanitizeStyle(style);
    if (cleanStyle) block.style = cleanStyle;
    const count = def.slots?.(clean) ?? 0;
    if (count) {
      const given = Array.isArray(slots) ? slots : [];
      block.slots = Array.from({ length: count }, (_, i) => sanitizeBlocks(given[i], depth + 1, counter));
    }
    result.push(block);
  }
  return result;
}

/** Alle Zonen einer Seite prüfen – leere Zonen fallen weg */
export function sanitizePage(input: unknown): PageBlocks {
  const page: PageBlocks = {};
  if (!input || typeof input !== 'object') return page;
  const counter = { n: 0 };
  for (const [key, blocks] of Object.entries(input as Record<string, unknown>)) {
    if (!/^\d{1,2}$/.test(key)) continue;
    const clean = sanitizeBlocks(blocks, 0, counter);
    if (clean.length) page[String(Number(key))] = clean;
  }
  return page;
}

/** Zonen hinter dem letzten Abschnitt (Seite im Code gekürzt) ans Ende legen – gleiche Regel beim Build und im Editor */
export function clampZones(page: PageBlocks, last: number): PageBlocks {
  const result: PageBlocks = {};
  for (const key of Object.keys(page).sort((a, b) => Number(a) - Number(b))) {
    const at = String(Math.min(Number(key), last));
    result[at] = [...(result[at] ?? []), ...page[key]];
  }
  return result;
}

/** Neuer Block mit Standardwerten (Container mit leeren Bereichen) */
export function createBlock(type: BlockType, props: Record<string, unknown> = {}, slots?: Block[][], style?: BlockStyle): Block {
  const def = BLOCKS[type] as BlockDef;
  const merged = { ...structuredClone(def.defaults), ...props };
  const count = def.slots?.(merged) ?? 0;
  const block: Block = { id: newId(), type, props: merged, ...(style ? { style } : {}) };
  if (count) block.slots = Array.from({ length: count }, (_, i) => slots?.[i] ?? []);
  return block;
}

/** Alle Bildnamen in einem Baum (für die Bildoptimierung beim Build) */
export function collectImages(blocks: Block[], into = new Set<string>()): Set<string> {
  for (const block of blocks) {
    const { image, images, bgImage } = block.props as { image?: unknown; images?: unknown; bgImage?: unknown };
    if (typeof image === 'string' && image) into.add(image);
    if (typeof bgImage === 'string' && bgImage) into.add(bgImage);
    if (Array.isArray(images)) images.forEach((name) => typeof name === 'string' && into.add(name));
    block.slots?.forEach((slot) => collectImages(slot, into));
  }
  return into;
}
