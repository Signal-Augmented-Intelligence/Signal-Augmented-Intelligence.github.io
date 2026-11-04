import type { Metadata } from 'next';
import { NewsHighlights, type Highlight } from '@/components/NewsHighlights';
import { NewsList } from '@/components/NewsList';
import { PageHeader } from '@/components/PageHeader';
import { Section } from '@/components/Section';
import { formatDate } from '@/lib/format';
import { visibleNav } from '@/lib/nav';
import { getNewsEntries } from '@/lib/news';
import { NEWS_TABS } from '@/lib/site';

export const metadata: Metadata = { title: '뉴스', description: 'SAI Lab의 수상, 발표, 논문 게재 소식입니다.' };

/** Highlights: the newest news that have an album of the same date, at most this many. */
const HIGHLIGHTS = 5;

export default function NewsPage() {
  const news = getNewsEntries();
  const tabs = visibleNav(NEWS_TABS);
  const highlights: Highlight[] = news.filter((n) => n.album).slice(0, HIGHLIGHTS).map((n) => ({
    kind: n.kind,
    date: formatDate(n.date),
    headline: n.headline,
    members: n.members,
    photo: n.album!.cover,
    album: n.album!.href,
    link: n.href ? { href: n.href, label: n.hrefLabel } : null,
  }));
  return (
    <>
      <PageHeader title="뉴스" tabs={tabs.length > 1 ? tabs : undefined} />
      {highlights.length > 0 && <div className="container"><NewsHighlights items={highlights} /></div>}
      <Section id="all" title="전체 소식" hideTitle={highlights.length === 0}>
        {news.length === 0 ? <p className="muted">아직 소식이 없습니다.</p> : <NewsList news={news} />}
      </Section>
    </>
  );
}
