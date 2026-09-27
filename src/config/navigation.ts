/**
 * Navigation – Hauptmenü, Footer-Menü und Rechtliches.
 * Ein neuer Menüpunkt wird hier ergänzt und erscheint automatisch in Header (Desktop & Mobil) und Footer.
 */
export interface NavItem {
  label: string;
  href: string;
  /** Kurzbeschreibung, wird im mobilen Menü angezeigt. */
  description?: string;
}

export const mainNav: NavItem[] = [
  { label: 'Start', href: '/', description: 'Zur Startseite' },
  { label: 'Leistungen', href: '/#leistungen', description: 'Gartenbau, Tiefbau & Straßenbau' },
  { label: 'Unser Betrieb', href: '/betrieb/', description: 'Familienbetrieb aus Radolfzell' },
  { label: 'Referenzen', href: '/referenzen/', description: 'Ausgewählte Projekte' },
  { label: 'Stellenangebote', href: '/stellenangebote/', description: 'Karriere & Ausbildung' },
];

/** Ziel des Kontakt-Buttons: Jede Seite endet mit dem Kontaktbereich (id="kontakt"). */
export const contactNavItem: NavItem = { label: 'Kontakt', href: '#kontakt' };

export const legalNav: NavItem[] = [
  { label: 'Impressum', href: '/impressum/' },
  { label: 'Datenschutz', href: '/datenschutz/' },
];
