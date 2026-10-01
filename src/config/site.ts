/**
 * Zentrale Firmendaten – die einzige Stelle, an der Name, Adresse, Telefon usw. gepflegt werden.
 * Alle Seiten, der Footer, das Impressum und die strukturierten Daten (SEO) lesen von hier.
 *
 * Quellen: bisherige Website pflasterarbeiten-hildebrand.de sowie öffentliche Firmenverzeichnisse
 * (Stand: September 2026). Mit „PRÜFEN“ markierte Angaben bitte vor dem Livegang vom Kunden bestätigen lassen.
 */
export const site = {
  /** Markenname, wie er auf der Website erscheint. */
  name: 'Pflasterarbeiten Hildebrand GmbH',
  shortName: 'Hildebrand',
  /** Firmierung laut Handelsregister (für Impressum & strukturierte Daten). PRÜFEN */
  legalName: 'Hildebrand Pflasterarbeiten GmbH',
  /** Slogan der bisherigen Website. */
  claim: 'Pflasterarbeiten in Perfektion',
  description:
    'Familienbetrieb aus Radolfzell am Bodensee für Gartenbau, Tiefbau und Straßenbau: Pflasterarbeiten, Pflanzungen, Erdbau, Asphaltbau und mehr im Landkreis Konstanz.',
  /** Gründungsjahr des Familienbetriebs. PRÜFEN */
  foundingYear: 1989,
  locale: 'de-DE',
  language: 'de',

  managingDirector: 'Dieter M. Hildebrand',

  address: {
    street: 'Litzelhardtweg 4',
    postalCode: '78315',
    city: 'Radolfzell am Bodensee',
    district: 'Liggeringen',
    region: 'Baden-Württemberg',
    country: 'DE',
    countryName: 'Deutschland',
  },

  contact: {
    phone: '07732 10374',
    phoneHref: 'tel:+49773210374',
    phoneInternational: '+49 7732 10374',
    fax: '07732 822790',
    faxInternational: '+49 7732 822790',
    email: 'hildebrand-pflasterarbeiten@t-online.de',
  },

  /** Öffnungs- bzw. Bürozeiten. */
  openingHours: {
    label: 'Mo – Fr: 07:30 – 17:00 Uhr',
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    opens: '07:30',
    closes: '17:00',
  },

  /** Einsatzgebiet – wird auf der Website und in den strukturierten Daten genutzt. */
  serviceArea: {
    summary: 'Landkreis Konstanz, Radolfzell, Singen und Umgebung',
    places: [
      'Radolfzell',
      'Singen',
      'Konstanz',
      'Stockach',
      'Allensbach',
      'Moos',
      'Steißlingen',
      'Engen',
      'Gottmadingen',
      'Rielasingen-Worblingen',
      'Hilzingen',
      'Gaienhofen',
      'Öhningen',
      'Bodman-Ludwigshafen',
    ],
  },

  register: {
    court: 'Amtsgericht Freiburg i. Br.',
    number: 'HRB 550385',
    /** Umsatzsteuer-Identifikationsnummer nach § 27a UStG. PRÜFEN */
    vatId: 'DE142779578',
  },

  social: {
    instagram: 'https://www.instagram.com/hildebrand_pflasterarbeiten_/',
    facebook: 'https://www.facebook.com/HildebrandPflasterarbeiten/',
  },

  /** Link zur Routenplanung (öffnet externen Kartendienst erst auf Klick – DSGVO-freundlich). */
  /** Adresse als Suchbegriff für Kartendienste (Apple Karten, Android-Standard-App, Google Maps). */
  mapsQuery: 'Litzelhardtweg 4, 78315 Radolfzell am Bodensee',
  mapsUrl:
    'https://www.google.com/maps/search/?api=1&query=Litzelhardtweg+4%2C+78315+Radolfzell+am+Bodensee',
} as const;

export type Site = typeof site;

/** Anzahl der Jahre seit Gründung (für „seit … Jahren“-Aussagen). */
export const yearsInBusiness = new Date().getFullYear() - site.foundingYear;
