import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import itemStyles from '@/components/Items.module.css';
import { PageHeader } from '@/components/PageHeader';
import { PublicationItem } from '@/components/PublicationItem';
import { Section } from '@/components/Section';
import { SeminarItem } from '@/components/SeminarItem';
import { getPeople, getPublications, getResearchAreas, getSeminars } from '@/lib/content';
import { Redirect, redirectMetadata } from '@/components/Redirect';
import { SHOW_RESEARCH_AREAS } from '@/lib/site';
import styles from '../research.module.css';

type Params = { params: Promise<{ slug: string }> };

export const dynamicParams = false;
export function generateStaticParams() {
  return getResearchAreas().map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const area = getResearchAreas().find((a) => a.slug === slug);
  if (!SHOW_RESEARCH_AREAS) return { title: area?.title, ...redirectMetadata };
  return area ? { title: area.title, description: area.summary } : {};
}

export default async function ResearchAreaPage({ params }: Params) {
  const { slug } = await params;
  const area = getResearchAreas().find((a) => a.slug === slug);
  if (!area) notFound();
  // Hidden for now: old links to an area forward to Publications (the pages are still built so they do not 404).
  if (!SHOW_RESEARCH_AREAS) return <Redirect to="/research/publications/" />;
  const people = getPeople();
  const all = getPublications();
  const publications = area.publications.map((u) => all.find((p) => p.url === u)).filter((p) => p !== undefined)
    .sort((a, b) => b.pub_date.localeCompare(a.pub_date));
  const seminars = getSeminars().filter((s) => s.topics.includes(area.slug));

  return (
    <>
      <PageHeader title={area.title} lede={area.summary} back={<Link href="/research/">Back to Research Areas</Link>} />
      {area.figure && (
        <figure className={`container ${styles.detailFigure}`}>
          <img src={area.figure} alt={area.figure_alt} />
          {area.figure_caption && <figcaption>{area.figure_caption}</figcaption>}
        </figure>
      )}
      {area.html && (
        <Section id="overview" title="Overview">
          <div className="prose" dangerouslySetInnerHTML={{ __html: area.html }} />
        </Section>
      )}
      {publications.length > 0 && (
        <Section id="related-publications" title="Related Publications">
          <ol className={itemStyles.list}>{publications.map((p) => <PublicationItem key={p.url} pub={p} people={people} />)}</ol>
        </Section>
      )}
      {seminars.length > 0 && (
        <Section id="related-seminars" title="Related Seminars">
          <ol className={itemStyles.list}>{seminars.map((s) => <SeminarItem key={s.date + s.title} seminar={s} people={people} />)}</ol>
        </Section>
      )}
    </>
  );
}
