/**
 * Reads the lab's content files at build time. All page content comes from content/.
 * Nothing here runs in the browser.
 */
import fs from 'node:fs';
import path from 'node:path';
import { load } from 'js-yaml';
import { marked } from 'marked';
import { mediaHtml, mediaUrl } from './media';

const ROOT = path.join(process.cwd(), 'content');

function readYaml<T>(file: string, fallback: T): T {
  const value = load(fs.readFileSync(path.join(ROOT, file), 'utf8'));
  return (value ?? fallback) as T;
}

function readMarkdownDir<T>(dir: string): (T & { slug: string; html: string })[] {
  const full = path.join(ROOT, dir);
  return fs
    .readdirSync(full)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const text = fs.readFileSync(path.join(full, f), 'utf8');
      const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
      if (!match) throw new Error(`${dir}/${f}: missing front matter`);
      const data = (load(match[1]) ?? {}) as T;
      const body = match[2].trim();
      return { ...data, slug: f.replace(/\.md$/, ''), html: body ? mediaHtml(marked.parse(body) as string) : '' };
    });
}

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));

/* ---------- lab ---------- */
export type Lab = {
  name: string;
  full_name: string;
  name_ko: string;
  institution: string;
  advisor: string;
  intro: string;
  email: string;
  location: string;
  logo: string;
  draft: boolean;
};
export function getLab(): Lab {
  const raw = readYaml<Record<string, unknown>>('lab.yml', {});
  return {
    name: str(raw.name),
    full_name: str(raw.full_name),
    name_ko: str(raw.name_ko),
    institution: str(raw.institution),
    advisor: str(raw.advisor),
    intro: str(raw.intro),
    email: str(raw.email),
    location: str(raw.location),
    logo: mediaUrl(str(raw.logo)),
    draft: raw.draft !== false,
  };
}
export const hasContact = (lab: Lab) => lab.email !== '' || lab.location !== '';

/* ---------- people ---------- */
export type Group = 'faculty' | 'phd' | 'ms' | 'undergrad' | 'alumni';
export type Person = {
  id: string;
  name: string;
  name_ko: string;
  group: Group;
  role: string;
  bio: string;
  photo: string;
  url: string;
  after: string;
  /** Other spellings of the English name used in papers. */
  aliases: string[];
};
export function getPeople(): Person[] {
  return readYaml<Record<string, unknown>[]>('people.yml', []).map((p) => ({
    id: str(p.id),
    name: str(p.name),
    name_ko: str(p.name_ko),
    group: str(p.group) as Group,
    role: str(p.role),
    bio: str(p.bio),
    photo: str(p.photo),
    url: str(p.url),
    after: str(p.after),
    aliases: ((p.aliases as string[] | null) ?? []).map(str),
  }));
}
/** Where a member's name links to (author lists, seminar presenters). */
export function personHref(p: Person): string {
  if (p.group === 'faculty') return '/members/professor/';
  if (p.group === 'alumni') return `/members/alumni/#${p.id}`;
  return `/members/our-team/#${p.id}`;
}

/* ---------- professor ---------- */
export type Professor = {
  name: string;
  name_ko: string;
  position: string;
  affiliation: string;
  field: string;
  office: string;
  email: string;
  phone: string;
  photo: string;
  links: { label: string; url: string }[];
  bio: string;
  education: { degree: string; date: string; school: string }[];
  career: { period: string; role: string }[];
  research_areas: { en: string; ko: string }[];
  keywords: string;
  teaching: { course: string; terms: string }[];
  publications: { date: string; title: string; venue: string; authors: string; doi: string }[];
  software: { date: string; title: string; note: string }[];
  patents: { status: string; date: string; title: string; number: string }[];
  projects: { period: string; title: string; role: string; funding: string }[];
  services: { date: string; text: string }[];
  student_awards: string[];
};
export function getProfessor(): Professor {
  const raw = readYaml<Record<string, unknown>>('professor.yml', {});
  const list = <T,>(key: string) => ((raw[key] as T[] | null) ?? []).map((item) =>
    typeof item === 'object' && item !== null
      ? (Object.fromEntries(Object.entries(item).map(([k, v]) => [k, str(v)])) as T)
      : (str(item) as T),
  );
  return {
    name: str(raw.name),
    name_ko: str(raw.name_ko),
    position: str(raw.position),
    affiliation: str(raw.affiliation),
    field: str(raw.field),
    office: str(raw.office),
    email: str(raw.email),
    phone: str(raw.phone),
    photo: str(raw.photo),
    links: list('links'),
    bio: str(raw.bio),
    education: list('education'),
    career: list('career'),
    research_areas: list('research_areas'),
    keywords: str(raw.keywords),
    teaching: list('teaching'),
    publications: list('publications'),
    software: list('software'),
    patents: list('patents'),
    projects: list('projects'),
    services: list('services'),
    student_awards: list('student_awards'),
  };
}

/* ---------- publications ---------- */
export const PUBLICATION_TYPES = [
  { id: 'journal', title: 'Journal Articles', label: 'Journal article' },
  { id: 'conference-paper', title: 'Conference Papers', label: 'Conference paper' },
  { id: 'conference-poster', title: 'Conference Posters', label: 'Conference poster' },
  { id: 'other', title: 'Others', label: 'Other' },
] as const;
export type Publication = {
  slug: string;
  /** The `permalink`: an id that research areas and news use to point at a paper (not a page). */
  url: string;
  title: string;
  title_ko: string;
  type: string;
  authors: string[];
  venue: string;
  pub_date: string;
  status: string;
  award: string;
  links: { label: string; url: string }[];
  /** PDF in public/files/publications/ (conference papers that are not in a journal). */
  pdf: string;
  /**
   * Where the title goes: the published article (first entry of `links`, e.g. DOI or KCI) or, without one, the PDF.
   * Empty: the title is plain text. There are no per-paper pages on this site.
   */
  href: string;
  /** Which kind of link `href` is, shown after the venue: "Article" or "PDF". */
  hrefLabel: string;
  excerpt: string;
  figure: string;
  figure_alt: string;
  figure_caption: string;
  html: string;
};
export function getPublications(): Publication[] {
  return readMarkdownDir<Record<string, unknown>>('publications')
    .map((p) => ({
      slug: str(p.permalink).replace(/^\/publications\/|\/$/g, '') || p.slug,
      url: str(p.permalink) || `/publications/${p.slug}/`,
      title: str(p.title),
      title_ko: str(p.title_ko),
      type: str(p.type),
      authors: ((p.authors as string[]) ?? []).map(str),
      venue: str(p.venue),
      pub_date: str(p.pub_date),
      status: str(p.status),
      award: str(p.award),
      links: ((p.links as { label: string; url: string }[] | null) ?? []).map((l) => ({ label: str(l.label), url: mediaUrl(str(l.url)) })),
      pdf: str(p.pdf),
      excerpt: str(p.excerpt),
      figure: mediaUrl(str(p.figure)),
      figure_alt: str(p.figure_alt),
      figure_caption: str(p.figure_caption),
      html: p.html,
    }))
    .map((p) => {
      const link = p.links.find((l) => l.url);
      const pdf = p.pdf ? mediaUrl(`/files/publications/${p.pdf}`) : '';
      // One label per kind, whatever the record calls its link (DOI, KCI record …): the article, or the PDF.
      return { ...p, href: link?.url ?? pdf, hrefLabel: link ? 'Article' : pdf ? 'PDF' : '' };
    })
    .sort((a, b) => b.pub_date.localeCompare(a.pub_date));
}

/* ---------- research areas ---------- */
export type ResearchArea = {
  slug: string;
  title: string;
  order: number;
  summary: string;
  figure: string;
  figure_alt: string;
  figure_caption: string;
  publications: string[];
  html: string;
};
export function getResearchAreas(): ResearchArea[] {
  return readMarkdownDir<Record<string, unknown>>('research')
    .map((r) => ({
      slug: r.slug,
      title: str(r.title),
      order: Number(r.order ?? 99),
      summary: str(r.summary),
      figure: mediaUrl(str(r.figure)),
      figure_alt: str(r.figure_alt),
      figure_caption: str(r.figure_caption),
      publications: ((r.publications as string[] | null) ?? []).map(str),
      html: r.html,
    }))
    .sort((a, b) => a.order - b.order);
}

/* ---------- seminars ---------- */
export const SEMINAR_TYPES: Record<string, string> = {
  research: 'Research meeting',
  'paper-review': 'Paper review',
  tutorial: 'Tutorial',
  invited: 'Invited talk',
};
export type Seminar = {
  date: string;
  presenter: string;
  title: string;
  summary: string;
  area: string;
  type: string;
  topics: string[];
  file: string;
  cover: string;
  highlight: boolean;
};
export function getSeminars(): Seminar[] {
  return readYaml<Record<string, unknown>[]>('seminars.yml', [])
    .map((s) => {
      const date = str(s.date).slice(0, 10);
      return {
        date,
        presenter: str(s.presenter),
        title: str(s.title),
        summary: str(s.summary),
        area: str(s.area).trim(),
        type: str(s.type),
        topics: ((s.topics as string[] | null) ?? []).map(str),
        file: str(s.file),
        cover: str(s.cover),
        highlight: s.highlight === true,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}
export const seminarFileUrl = (s: Seminar) => (s.file ? mediaUrl(`/files/seminars/${s.file}`) : '');

/* ---------- news ---------- */
export type NewsItem = { date: string; text: string; link: string };
export function getNews(): NewsItem[] {
  return readYaml<Record<string, unknown>[]>('news.yml', [])
    .map((n) => ({ date: str(n.date), text: str(n.text), link: mediaUrl(str(n.link)) }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/* ---------- notices ---------- */
export type Notice = {
  id: string; date: string; event_date: string; kind: 'seminar' | 'conference' | 'recruitment' | 'other';
  title: string; body: string; link: string; popup: boolean;
};
export function getNotices(): Notice[] {
  return readYaml<Record<string, unknown>[]>('notices.yml', [])
    .map((n) => ({ id: str(n.id), date: str(n.date), event_date: str(n.event_date),
      kind: str(n.kind) as Notice['kind'], title: str(n.title), body: str(n.body),
      link: mediaUrl(str(n.link)), popup: n.popup === true }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/* ---------- poem ---------- */
export type Poem = { title: string; hero: string[]; credit: string; stanzas: string[][] };
export function getPoem(): Poem {
  const raw = readYaml<Record<string, unknown>>('poem.yml', {});
  const stanzas = ((raw.stanzas as unknown[][] | null) ?? []).map((s) => s.map(str));
  const index = Math.min(Math.max(Number(raw.hero ?? 1), 1), Math.max(stanzas.length, 1)) - 1;
  return { title: str(raw.title), hero: stanzas[index] ?? [], credit: str(raw.credit), stanzas };
}

/* ---------- album ---------- */
/**
 * One event in the album. `slug` is its folder name and its page address (/album/<slug>/).
 * `cover` is the photo shown on the album list (the `cover` file in album.yml, or the first photo).
 */
export type Album = { slug: string; date: string; title: string; cover: { src: string; alt: string }; photos: { src: string; alt: string }[] };
export function getAlbums(): Album[] {
  return readYaml<Record<string, unknown>[]>('album.yml', [])
    .map((a) => {
      const folder = str(a.folder).replace(/^\/+|\/+$/g, '');
      const photos = ((a.photos as Record<string, unknown>[] | null) ?? [])
        .map((p) => ({ src: mediaUrl(`/images/album/${folder ? `${folder}/` : ''}${str(p.file)}`), alt: str(p.alt) }))
        .filter((p) => !p.src.endsWith('/'));
      const coverFile = str(a.cover);
      const cover = photos.find((p) => coverFile && p.src.endsWith(`/${coverFile}`)) ?? photos[0];
      return { slug: folder, date: str(a.date), title: str(a.title), cover, photos };
    })
    .filter((a) => a.photos.length > 0 && a.slug !== '')
    .sort((a, b) => b.date.localeCompare(a.date));
}

/* ---------- home ---------- */
/** Photo URLs for the Home first-screen carousel (content/home.yml). */
export function getHomeSlides(): string[] {
  const raw = readYaml<Record<string, unknown>>('home.yml', {});
  return ((raw.slides as unknown[] | null) ?? []).map(str).filter(Boolean).map((f) => mediaUrl(`/images/home/${f.replace(/^\/+/, '')}`));
}
