/**
 * Inhalte rund um den Betrieb: Werte, Arbeitsweise, Vorteile für Mitarbeitende.
 * Quelle der Aussagen: bisherige Website und Stellenanzeige des Betriebs.
 */
export interface Feature {
  icon: string;
  title: string;
  text: string;
}

/** „Warum Hildebrand?“ – Startseite und „Unser Betrieb“. */
export const values: Feature[] = [
  {
    icon: 'layers',
    title: 'Alles aus einer Hand',
    text: 'Garten-, Tief- und Straßenbau unter einem Dach: ein Ansprechpartner, kurze Wege und keine Reibungsverluste zwischen verschiedenen Firmen.',
  },
  {
    icon: 'hard-hat',
    title: 'Kompetente Fachkräfte',
    text: 'Ein eingespieltes Team aus ausgebildeten Fachleuten, das sein Handwerk versteht und mit modernem Gerät arbeitet.',
  },
  {
    icon: 'handshake',
    title: 'Ehrlich & fair',
    text: 'Transparente Angebote, faire Preise und klare Absprachen – Ehrlichkeit und Verlässlichkeit sind für uns selbstverständlich.',
  },
  {
    icon: 'pencil-ruler',
    title: 'Individuelle Planung',
    text: 'Ihre Wünsche fließen von Anfang an in die Planung ein – auf Wunsch in enger Abstimmung mit Ihrem Landschaftsarchitekten.',
  },
  {
    icon: 'map-pin',
    title: 'Regional verwurzelt',
    text: 'Als Familienbetrieb aus Radolfzell-Liggeringen sind wir im gesamten Landkreis Konstanz schnell für Sie vor Ort.',
  },
  {
    icon: 'graduation-cap',
    title: 'Ausbildungsbetrieb',
    text: 'Wir bilden junge Menschen aus und geben unser Wissen weiter – für gute Arbeit heute und morgen.',
  },
];

export interface Step {
  title: string;
  text: string;
}

/** Ablauf eines Projekts – Startseite. */
export const processSteps: Step[] = [
  {
    title: 'Anfrage & Beratung',
    text: 'Sie rufen an oder schreiben uns. Wir besprechen Ihr Vorhaben und sehen es uns gerne direkt vor Ort an.',
  },
  {
    title: 'Planung & Angebot',
    text: 'Sie erhalten ein transparentes Angebot mit klaren Positionen – abgestimmt auf Ihre Wünsche und Ihr Budget.',
  },
  {
    title: 'Fachgerechte Ausführung',
    text: 'Unser Team setzt Ihr Projekt sauber und zuverlässig um. Während der Bauzeit haben Sie einen festen Ansprechpartner.',
  },
  {
    title: 'Abnahme & Übergabe',
    text: 'Gemeinsam nehmen wir die fertige Arbeit ab. Auch danach sind wir für Sie da – etwa für Pflege und Wartung.',
  },
];

/** Vorteile für Mitarbeitende – Seite „Stellenangebote“ (laut Stellenanzeige des Betriebs). */
export const benefits: Feature[] = [
  {
    icon: 'heart-handshake',
    title: 'Familienbetrieb',
    text: 'Kurze Wege, persönlicher Umgang und ein sicherer Arbeitsplatz in der Region.',
  },
  {
    icon: 'clock',
    title: 'Keine Überstunden',
    text: 'Planbare Arbeitszeiten – Ihr Feierabend gehört Ihnen.',
  },
  {
    icon: 'sun',
    title: '30 Tage Urlaub',
    text: 'Genug Zeit, um sich zu erholen und die freien Tage zu genießen.',
  },
  {
    icon: 'euro',
    title: 'Leistungsgerechte Vergütung',
    text: 'Attraktive Bezahlung, die Ihren Einsatz und Ihr Können widerspiegelt.',
  },
  {
    icon: 'dumbbell',
    title: 'Hansefit – Firmenfitness',
    text: 'Zugang zu Fitnessstudios, Schwimmbädern und Kursen in der ganzen Region – für Ihre Gesundheit und den Ausgleich.',
  },
  {
    icon: 'car',
    title: 'Geschäftswagen (Außendienst / optional)',
    text: 'Ein Firmenwagen für den Außendienst – oder optional nach Absprache.',
  },
  {
    icon: 'cup-soda',
    title: 'Getränke inklusive',
    text: 'Komplette Getränkeversorgung – auf der Baustelle und im Betrieb.',
  },
  {
    icon: 'truck',
    title: 'Moderne Technik',
    text: 'Gut gewartete Maschinen und zeitgemäße Ausstattung für effizientes Arbeiten.',
  },
  {
    icon: 'trending-up',
    title: 'Aufstiegsmöglichkeiten',
    text: 'Wer mehr Verantwortung übernehmen will, bekommt bei uns die Chance dazu.',
  },
  {
    icon: 'party-popper',
    title: 'Junges Team & Ausflüge',
    text: 'Ein lebendiges Team, das auch außerhalb der Baustelle gemeinsam etwas unternimmt.',
  },
];

/** Bewerbungsablauf – Seite „Stellenangebote“. */
export const applicationSteps: Step[] = [
  {
    title: 'Kontakt aufnehmen',
    text: 'Bewerben Sie sich online mit Ihren Unterlagen oder rufen Sie uns einfach an – wir freuen uns auf Sie.',
  },
  {
    title: 'Kennenlernen',
    text: 'In einem persönlichen Gespräch lernen wir uns kennen und beantworten alle Ihre Fragen.',
  },
  {
    title: 'Loslegen',
    text: 'Passt es für beide Seiten, starten Sie in unserem Team – mit einer gründlichen Einarbeitung.',
  },
];

/** Für wen wir arbeiten – Seite „Unser Betrieb“. */
export const clientGroups: Feature[] = [
  {
    icon: 'house',
    title: 'Private Bauherren',
    text: 'Hofeinfahrten, Terrassen, Gärten und Hausanschlüsse – Ihr Eigenheim ist bei uns in guten Händen.',
  },
  {
    icon: 'building-2',
    title: 'Gewerbe & Industrie',
    text: 'Parkplätze, Zufahrten, Hof- und Lagerflächen, die dem täglichen Betrieb standhalten.',
  },
  {
    icon: 'landmark',
    title: 'Gemeinden & Versorger',
    text: 'Straßen-, Wege-, Kanal- und Leitungsbau für öffentliche Auftraggeber und Versorgungsunternehmen.',
  },
  {
    icon: 'pencil-ruler',
    title: 'Architekten & Planer',
    text: 'Zuverlässige Umsetzung Ihrer Planung – in enger Abstimmung auf der Baustelle.',
  },
];
