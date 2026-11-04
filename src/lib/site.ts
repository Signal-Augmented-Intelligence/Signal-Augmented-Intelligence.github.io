/** Menus and tabs. Page content lives in content/; this file only decides structure. */
/** `requires`: shown only when the lab has official contact details / at least one album with photos / at least one alumnus. */
export type NavItem = { title: string; href: string; match?: string[]; requires?: 'contact' | 'album' | 'alumni' };

/**
 * Research areas stay in content/research/ and the 관리 화면, but the public site hides them until their content is settled:
 * no Areas tab, Research opens Publications, /research/ and /research/<area>/ forward to Publications, Home has no areas section.
 */
export const SHOW_RESEARCH_AREAS = false;

export const MAIN_NAV: NavItem[] = [
  { title: 'Members', href: '/members/professor/', match: ['/members/'] },
  { title: 'Research', href: SHOW_RESEARCH_AREAS ? '/research/' : '/research/publications/', match: ['/research/', '/publications/'] },
  { title: 'Seminars', href: '/seminars/', match: ['/seminars/'] },
  { title: '뉴스', href: '/news/', match: ['/news/', '/album/'] },
  { title: 'Notices', href: '/notices/' },
  { title: 'Home', href: '/' },
];

export const MEMBERS_TABS: NavItem[] = [
  { title: 'Professor', href: '/members/professor/' },
  { title: 'Our Team', href: '/members/our-team/' },
  { title: 'Alumni', href: '/members/alumni/', requires: 'alumni' },
];

/** With areas hidden only Publications is left, so pages show no tab bar. */
export const RESEARCH_TABS: NavItem[] = SHOW_RESEARCH_AREAS ? [
  { title: 'Areas', href: '/research/' },
  { title: 'Publications', href: '/research/publications/' },
] : [];

/** Album has no menu item of its own: it is a tab under 뉴스. */
export const NEWS_TABS: NavItem[] = [
  { title: '뉴스', href: '/news/' },
  { title: 'Album', href: '/album/', match: ['/album/'], requires: 'album' },
];

/** Same order as the main menu, with Research and 뉴스 split into their tabs. */
export const FOOTER_LINKS: NavItem[] = [
  { title: 'Members', href: '/members/professor/' },
  ...(SHOW_RESEARCH_AREAS ? [{ title: 'Research Areas', href: '/research/' }] : []),
  { title: 'Publications', href: '/research/publications/' },
  { title: 'Seminars', href: '/seminars/' },
  { title: '뉴스', href: '/news/' },
  { title: 'Album', href: '/album/', requires: 'album' },
  { title: 'Notices', href: '/notices/' },
  { title: 'Contact', href: '/contact/', requires: 'contact' },
];

/** Our Team sections, in display order. Faculty is on Professor, alumni on Alumni. */
export const TEAM_GROUPS = [
  { id: 'phd', title: 'Ph.D. Students' },
  { id: 'ms', title: 'M.S. Students' },
  { id: 'undergrad', title: 'Undergraduate Researchers' },
] as const;

export const SITE_URL = 'https://signal-augmented-intelligence.github.io';
