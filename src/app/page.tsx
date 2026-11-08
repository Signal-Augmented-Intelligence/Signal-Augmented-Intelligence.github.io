import Link from 'next/link';
import { Hero } from '@/components/Hero';
import itemStyles from '@/components/Items.module.css';
import { PublicationItem } from '@/components/PublicationItem';
import { Section } from '@/components/Section';
import { NewsList } from '@/components/NewsList';
import { RecruitmentBanner } from '@/components/RecruitmentBanner';
import { getHomeSlides, getLab, getNotices, getPeople, getPoem, getPublications, getResearchAreas } from '@/lib/content';
import { getNewsEntries } from '@/lib/news';
import { SHOW_RESEARCH_AREAS } from '@/lib/site';
import styles from './home.module.css';

export default function HomePage() {
  const lab = getLab();
  const poem = getPoem();
  const people = getPeople();
  const areas = getResearchAreas();
  const publications = getPublications().slice(0, 3);
  const news = getNewsEntries().slice(0, 5);
  const recruitment = getNotices().find((notice) => notice.popup && notice.kind === 'recruitment');

  return (
    <>
      {recruitment && <RecruitmentBanner notice={recruitment} />}
      <Hero
        name={lab.name}
        institution={lab.institution}
        quote={poem.hero}
        poemTitle={poem.stanzas.length > 0 ? poem.title : ''}
        slides={getHomeSlides()}
      />

      {news.length > 0 && (
        <Section id="news" title="뉴스" aside={<Link href="/news/">View all</Link>}>
          <NewsList news={news} />
        </Section>
      )}

      {SHOW_RESEARCH_AREAS && <Section id="research" title="Research Areas" aside={<Link href="/research/">All areas</Link>}>
        <ul className={styles.areas}>
          {areas.map((a) => (
            <li key={a.slug}>
              <h3 className={styles.areaTitle}><Link href={`/research/${a.slug}/`}>{a.title}</Link></h3>
              <p className={styles.areaSummary}>{a.summary}</p>
            </li>
          ))}
        </ul>
      </Section>}

      <Section id="recent-publications" title="Recent Publications" aside={<Link href="/research/publications/">All publications</Link>}>
        <ol className={itemStyles.list}>
          {publications.map((p) => <PublicationItem key={p.url} pub={p} people={people} />)}
        </ol>
      </Section>

      {poem.stanzas.length > 0 && (
        <Section id="poem" title={poem.title}>
          <div className={styles.poem} lang="ko">
            {poem.stanzas.map((stanza, i) => (
              <div key={i}>{stanza.map((line) => <p key={line}>{line}</p>)}</div>
            ))}
            {poem.credit && <p className={styles.credit}>{poem.credit}</p>}
          </div>
        </Section>
      )}
    </>
  );
}
