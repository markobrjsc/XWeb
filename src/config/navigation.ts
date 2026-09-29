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
  { label: 'Leistungen', href: '/leistungen/', description: 'Gartenbau, Tiefbau & Straßenbau – mit Referenzprojekten' },
  { label: 'Stellenangebote', href: '/stellenangebote/', description: 'Karriere & Ausbildung' },
  { label: 'Unser Betrieb', href: '/betrieb/', description: 'Familienbetrieb aus Radolfzell' },
];

/** Kontakt – im Header als hervorgehobener Button, im mobilen Menü als letzter Punkt. */
export const contactNavItem: NavItem = { label: 'Kontakt', href: '/kontakt/', description: 'Anfrage, Anfahrt & Bürozeiten' };

/**
 * Reihenfolge der Seiten von links nach rechts – bestimmt die Richtung der Seitenübergänge
 * (Seite weiter rechts im Menü: neue Seite gleitet von rechts herein, sonst von links).
 */
export const navOrder: NavItem[] = [...mainNav, contactNavItem];

export const legalNav: NavItem[] = [
  { label: 'Impressum', href: '/impressum/' },
  { label: 'Datenschutz', href: '/datenschutz/' },
];
