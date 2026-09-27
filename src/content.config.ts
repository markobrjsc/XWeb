/**
 * Inhalts-Sammlungen: Referenzen und Stellenangebote liegen als Markdown-Dateien in src/content/.
 * Neue Einträge = neue .md-Datei anlegen. Das Schema unten prüft beim Build, ob alle Angaben stimmen.
 */
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const referenzen = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/referenzen' }),
  schema: z.object({
    title: z.string(),
    /** Fachbereich: gartenbau | tiefbau | strassenbau */
    category: z.enum(['gartenbau', 'tiefbau', 'strassenbau']),
    location: z.string(),
    year: z.number().int().optional(),
    summary: z.string(),
    services: z.array(z.string()).default([]),
    /** Icon für den Platzhalter, solange kein Foto vorhanden ist */
    icon: z.string().default('image'),
    /** Foto-Name in src/assets/images – Standard: referenzen/<Dateiname> */
    image: z.string().optional(),
    /** Auf der Startseite zeigen */
    featured: z.boolean().default(false),
    /** Beispiel-Eintrag: zeigt ein „Beispiel“-Etikett, bis echte Projektdaten eingetragen sind */
    placeholder: z.boolean().default(false),
    order: z.number().default(100),
  }),
});

const stellenangebote = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/stellenangebote' }),
  schema: z.object({
    title: z.string(),
    type: z.enum(['Vollzeit', 'Teilzeit', 'Ausbildung', 'Minijob']),
    /** Für Google for Jobs: FULL_TIME, PART_TIME, OTHER (z. B. Ausbildung) … */
    employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACTOR', 'TEMPORARY', 'INTERN', 'OTHER']).default('FULL_TIME'),
    start: z.string().default('ab sofort'),
    location: z.string().default('Radolfzell & Landkreis Konstanz'),
    icon: z.string().default('hard-hat'),
    summary: z.string(),
    tasks: z.array(z.string()),
    profile: z.array(z.string()),
    datePosted: z.coerce.date(),
    validThrough: z.coerce.date().optional(),
    /** Auf false setzen, um die Stelle auszublenden, ohne sie zu löschen */
    active: z.boolean().default(true),
    order: z.number().default(100),
  }),
});

export const collections = { referenzen, stellenangebote };
