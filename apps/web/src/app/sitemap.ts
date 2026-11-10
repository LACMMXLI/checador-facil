import type { MetadataRoute } from 'next';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return ['', '/registro', '/login', '/privacidad', '/terminos'].map((p) => ({
    url: `${SITE}${p}`, lastModified: now, changeFrequency: p === '' ? 'weekly' : 'monthly', priority: p === '' ? 1 : p === '/registro' ? 0.8 : 0.4,
  }));
}
