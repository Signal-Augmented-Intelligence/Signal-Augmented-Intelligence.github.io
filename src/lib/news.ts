import { getAlbums, getNews, getPeople, getPublications, type NewsItem } from './content';
import { mediaUrl } from './media';

/** Read from the news title (guideline §News): 수상, 게재 승인, 발표. */
export type NewsKind = '수상' | '게재' | '발표' | '';

export type NewsEntry = NewsItem & {
  kind: NewsKind;
  /** The title without its closing "(이름, 이름)". */
  headline: string;
  /** Names in the closing parentheses; `photo` is set when the name is a member's Korean name and the member has a photo. */
  members: { name: string; photo: string }[];
  /** Where the news link goes: a paper id opens the paper itself (article or PDF), any other link is used as written. */
  href: string;
  hrefLabel: '논문' | '기사' | '';
  /** The album of the same date, if there is one. */
  album: { href: string; cover: string } | null;
};

function kindOf(text: string): NewsKind {
  if (text.includes('수상')) return '수상';
  if (text.includes('게재')) return '게재';
  if (text.includes('발표')) return '발표';
  return '';
}

export function getNewsEntries(): NewsEntry[] {
  const publications = getPublications();
  const people = getPeople();
  const albums = getAlbums();
  return getNews().map((n) => {
    const names = n.text.match(/\(([^()]+)\)\s*$/);
    const paper = n.link.startsWith('/publications/');
    const href = paper ? publications.find((p) => p.url === n.link)?.href ?? '' : n.link;
    const album = n.date ? albums.find((a) => a.date === n.date) : undefined;
    return {
      ...n,
      kind: kindOf(n.text),
      headline: names ? n.text.slice(0, names.index).trim() : n.text,
      members: (names ? names[1].split(',') : []).map((s) => s.trim()).filter(Boolean).map((name) => {
        const person = people.find((p) => p.name_ko === name);
        return { name, photo: person?.photo ? mediaUrl(`/images/people/${person.photo}`) : '' };
      }),
      href,
      hrefLabel: href ? (paper ? '논문' : '기사') : '',
      album: album ? { href: `/album/${album.slug}/`, cover: album.cover.src } : null,
    };
  });
}
