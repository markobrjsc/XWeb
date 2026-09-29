/** Vergleichsform eines Textes: Leerraum zusammenfassen, außen kürzen (Bearbeiten-Modus, Website und Worker) */
export const normalizeText = (text: string) => text.replace(/\s+/g, ' ').trim();
