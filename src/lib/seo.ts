/**
 * Strukturierte Daten (schema.org / JSON-LD) für Suchmaschinen.
 * Google nutzt diese Angaben u. a. für lokale Suchergebnisse, Brotkrumen und Google for Jobs.
 */
import { site } from '@/config/site';
import { pillars } from '@/data/services';

export interface BreadcrumbItem {
  label: string;
  href: string;
}

type JsonLd = Record<string, unknown>;

const dayMap: Record<string, string> = {
  Monday: 'https://schema.org/Monday',
  Tuesday: 'https://schema.org/Tuesday',
  Wednesday: 'https://schema.org/Wednesday',
  Thursday: 'https://schema.org/Thursday',
  Friday: 'https://schema.org/Friday',
  Saturday: 'https://schema.org/Saturday',
  Sunday: 'https://schema.org/Sunday',
};

export const organizationId = (origin: string) => `${origin}/#organization`;
export const websiteId = (origin: string) => `${origin}/#website`;

export function postalAddress(): JsonLd {
  return {
    '@type': 'PostalAddress',
    streetAddress: site.address.street,
    postalCode: site.address.postalCode,
    addressLocality: site.address.city,
    addressRegion: site.address.region,
    addressCountry: site.address.country,
  };
}

/** Das Unternehmen als lokaler Handwerks-/Baubetrieb. */
export function organizationSchema(origin: string): JsonLd {
  return {
    '@type': 'HomeAndConstructionBusiness',
    '@id': organizationId(origin),
    name: site.name,
    legalName: site.legalName,
    alternateName: ['Hildebrand Pflasterarbeiten', 'Pflasterarbeiten Hildebrand'],
    slogan: site.claim,
    description: site.description,
    url: `${origin}/`,
    logo: {
      '@type': 'ImageObject',
      url: `${origin}/logo-512.png`,
      width: 512,
      height: 512,
    },
    image: `${origin}/og-image.jpg`,
    telephone: site.contact.phoneInternational,
    faxNumber: site.contact.faxInternational,
    email: site.contact.email,
    foundingDate: String(site.foundingYear),
    address: postalAddress(),
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: site.openingHours.days.map((day) => dayMap[day]),
        opens: site.openingHours.opens,
        closes: site.openingHours.closes,
      },
    ],
    areaServed: [
      { '@type': 'AdministrativeArea', name: 'Landkreis Konstanz' },
      ...site.serviceArea.places.map((name) => ({ '@type': 'City', name })),
    ],
    knowsAbout: pillars.flatMap((pillar) => [pillar.title, ...pillar.services.map((s) => s.title)]),
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Leistungen',
      itemListElement: pillars.map((pillar) => ({
        '@type': 'OfferCatalog',
        name: pillar.title,
        itemListElement: pillar.services.map((service) => ({
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: service.title,
            description: service.description,
            areaServed: { '@type': 'AdministrativeArea', name: 'Landkreis Konstanz' },
          },
        })),
      })),
    },
    sameAs: [site.social.instagram, site.social.facebook],
  };
}

export function websiteSchema(origin: string): JsonLd {
  return {
    '@type': 'WebSite',
    '@id': websiteId(origin),
    url: `${origin}/`,
    name: site.name,
    inLanguage: site.locale,
    publisher: { '@id': organizationId(origin) },
  };
}

export function breadcrumbSchema(origin: string, items: BreadcrumbItem[]): JsonLd {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.label,
      item: new URL(item.href, origin).href,
    })),
  };
}

export function webPageSchema(options: {
  origin: string;
  url: string;
  title: string;
  description: string;
  type?: string;
  breadcrumbs?: BreadcrumbItem[];
}): JsonLd {
  const { origin, url, title, description, type = 'WebPage', breadcrumbs } = options;
  return {
    '@type': type,
    '@id': `${url}#webpage`,
    url,
    name: title,
    description,
    inLanguage: site.locale,
    isPartOf: { '@id': websiteId(origin) },
    about: { '@id': organizationId(origin) },
    ...(breadcrumbs && breadcrumbs.length > 1 ? { breadcrumb: breadcrumbSchema(origin, breadcrumbs) } : {}),
  };
}

/** Kürzt Text an einer Wortgrenze (für Meta-Beschreibungen, max. ~155 Zeichen). */
export function truncate(text: string, max = 155): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:–-]$/, '')}…`;
}

/** Fügt mehrere Knoten zu einem @graph zusammen. */
export function graph(nodes: JsonLd[]): JsonLd {
  return { '@context': 'https://schema.org', '@graph': nodes };
}
