/**
 * Designs für das Logo in der Kopfzeile (src/components/layout/HeaderLogo.astro) – Auswahl im Bearbeiten-Modus.
 * Gespeichert in src/content/brand.json, eigene Bilder in src/assets/brand/eigene/.
 */
export const LOGO_DESIGNS = [
  ['standard', 'Standard', 'Maskottchen und Schriftzug im weißen Label'],
  ['band', 'Schriftband', 'Das längliche Logo – Band in der Akzentfarbe'],
  ['badge', 'Namens-Label', 'Maskottchen vor einem Label in der Akzentfarbe'],
  ['schrift', 'Schriftzug', 'Nur der Name, hell mit Akzentstrich'],
  ['monogramm', 'Monogramm', '„H“ in der Akzentfarbe mit Schriftzug'],
  ['maskottchen', 'Maskottchen', 'Nur die Figur im weißen Kreis'],
] as const;

export type LogoDesign = (typeof LOGO_DESIGNS)[number][0] | 'eigenes';

export type BrandConfig = { logo?: string; image?: string; background?: 'hell' | 'ohne' };
