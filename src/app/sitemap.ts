import type { MetadataRoute } from 'next';
import { getAlbums, getResearchAreas } from '@/lib/content';
import { SHOW_RESEARCH_AREAS, SITE_URL } from '@/lib/site';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ['/', '/members/professor/', '/members/our-team/', '/members/alumni/', ...(SHOW_RESEARCH_AREAS ? ['/research/'] : []), '/research/publications/', '/seminars/', '/news/', '/notices/'];
  return [
    ...pages,
    ...(getAlbums().length > 0 ? ['/album/', ...getAlbums().map((a) => `/album/${a.slug}/`)] : []),
    ...(SHOW_RESEARCH_AREAS ? getResearchAreas().map((a) => `/research/${a.slug}/`) : []),
  ].map((path) => ({ url: `${SITE_URL}${path}` }));
}
