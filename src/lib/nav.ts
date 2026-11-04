import { getAlbums, getLab, getPeople, hasContact } from './content';
import type { NavItem } from './site';

/** Whether the Alumni page has anyone to list. */
export const hasAlumni = () => getPeople().some((p) => p.group === 'alumni');

/** Drops menu items whose page has nothing to show yet (no contact details, no album photos, no alumni). */
export function visibleNav(items: NavItem[]): NavItem[] {
  const shown = { contact: hasContact(getLab()), album: getAlbums().length > 0, alumni: hasAlumni() };
  return items.filter((i) => !i.requires || shown[i.requires]);
}
