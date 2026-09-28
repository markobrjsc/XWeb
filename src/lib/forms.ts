/**
 * Formulare – gemeinsame Definition für die Seiten (Beschriftungen, Auswahlmöglichkeiten) und den
 * Cloudflare Worker (Prüfung der Eingaben, Aufbau der E-Mail). Neue Felder werden hier ergänzt.
 *
 * Ablauf beim Absenden (src/scripts/forms.ts → worker/index.ts):
 *  1. Jede Datei wird einzeln an /api/upload geschickt und kurzzeitig im KV-Speicher abgelegt.
 *  2. Die Formularfelder gehen als kleines JSON an /api/senden.
 *  3. Der Worker prüft alles und verschickt die E-Mail über Resend – die Anhänge holt Resend per Link ab.
 */

/** Grenzen für Anhänge (Resend erlaubt max. 40 MB pro E-Mail, viele Postfächer nehmen ca. 25 MB an) */
export const UPLOAD_LIMITS = {
  fileBytes: 10 * 1024 * 1024,
  totalBytes: 20 * 1024 * 1024,
  maxFiles: 12,
  /** Dateiendungen, die angenommen werden */
  extensions: ['pdf', 'doc', 'docx', 'odt', 'rtf', 'txt', 'jpg', 'jpeg', 'png', 'heic', 'heif', 'webp'],
} as const;

export const ACCEPT_DOCUMENTS = '.pdf,.doc,.docx,.odt,.rtf,.txt,.jpg,.jpeg,.png,.heic,.heif,.webp';
export const ACCEPT_IMAGES = '.jpg,.jpeg,.png,.heic,.heif,.webp,.pdf';

/** Mindestzeit zwischen Laden der Seite und Absenden – Bots sind schneller */
export const MIN_FILL_MS = 3000;

export type FieldSpec = {
  label: string;
  required?: boolean;
  /** Maximale Länge (Zeichen) */
  max?: number;
  kind?: 'text' | 'email' | 'choice' | 'multi';
  options?: readonly string[];
};

export type FileSpec = { label: string; max: number };

export type FormSpec = {
  title: string;
  fields: Record<string, FieldSpec>;
  files: Record<string, FileSpec>;
};

/* ------------------------------------------------------------------------ */
/* Kontaktanfrage                                                            */
/* ------------------------------------------------------------------------ */
export const contactTopics = ['Angebot anfragen', 'Beratung vor Ort', 'Rückruf erbeten', 'Allgemeine Frage'] as const;
export const contactAreas = ['Gartenbau', 'Tiefbau', 'Straßenbau', 'Noch unklar'] as const;
export const contactTimeframes = ['So bald wie möglich', 'In den nächsten 3 Monaten', 'Im Laufe des Jahres', 'Noch offen'] as const;
export const contactChannels = ['E-Mail', 'Telefon'] as const;

export const contactForm: FormSpec = {
  title: 'Kontaktanfrage',
  fields: {
    anliegen: { label: 'Anliegen', required: true, kind: 'choice', options: contactTopics },
    bereiche: { label: 'Fachbereich', kind: 'multi', options: contactAreas },
    nachricht: { label: 'Nachricht', required: true, max: 5000 },
    projektort: { label: 'Ort der Baustelle', max: 200 },
    zeitraum: { label: 'Gewünschter Zeitraum', kind: 'choice', options: contactTimeframes },
    name: { label: 'Name', required: true, max: 120 },
    firma: { label: 'Firma / Gemeinde', max: 160 },
    email: { label: 'E-Mail', required: true, kind: 'email', max: 200 },
    telefon: { label: 'Telefon', max: 40 },
    adresse: { label: 'Straße und Hausnummer', max: 160 },
    ort: { label: 'PLZ und Ort', max: 120 },
    kontaktweg: { label: 'Bevorzugter Kontaktweg', kind: 'choice', options: contactChannels },
  },
  files: {
    fotos: { label: 'Fotos / Pläne', max: 8 },
  },
};

/* ------------------------------------------------------------------------ */
/* Bewerbung                                                                 */
/* ------------------------------------------------------------------------ */
export const employmentTypes = ['Vollzeit', 'Teilzeit', 'Ausbildung', 'Praktikum', 'Minijob'] as const;
export const licenseClasses = ['B', 'BE', 'C1', 'C1E', 'C', 'CE', 'Keinen'] as const;

export const applicationForm: FormSpec = {
  title: 'Bewerbung',
  fields: {
    stelle: { label: 'Stelle', required: true, max: 160 },
    art: { label: 'Gewünschte Anstellung', kind: 'choice', options: employmentTypes },
    vorname: { label: 'Vorname', required: true, max: 80 },
    nachname: { label: 'Nachname', required: true, max: 80 },
    email: { label: 'E-Mail', required: true, kind: 'email', max: 200 },
    telefon: { label: 'Telefon', required: true, max: 40 },
    strasse: { label: 'Straße und Hausnummer', max: 160 },
    plz: { label: 'PLZ', required: true, max: 10 },
    wohnort: { label: 'Wohnort', required: true, max: 120 },
    eintritt: { label: 'Frühester Eintritt', max: 100 },
    fuehrerschein: { label: 'Führerschein', kind: 'multi', options: licenseClasses },
    nachricht: { label: 'Kurz zu Ihnen', max: 5000 },
  },
  files: {
    anschreiben: { label: 'Anschreiben', max: 1 },
    lebenslauf: { label: 'Lebenslauf', max: 1 },
    zeugnisse: { label: 'Zeugnisse', max: 5 },
    weitere: { label: 'Weitere Unterlagen', max: 5 },
  },
};

export const forms = { kontakt: contactForm, bewerbung: applicationForm } as const;
export type FormId = keyof typeof forms;

/** Dateigröße lesbar: 1,4 MB */
export const formatBytes = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toLocaleString('de-DE', { maximumFractionDigits: 1 })} MB`;

export const fileExtension = (name: string) => name.split('.').pop()?.toLowerCase() ?? '';
