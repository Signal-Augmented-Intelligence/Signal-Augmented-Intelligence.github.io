import type { Metadata } from 'next';
import { NewsList } from '@/components/NewsList';
import { PageHeader } from '@/components/PageHeader';
import { getNews } from '@/lib/content';

export const metadata: Metadata = { title: '뉴스', description: 'SAI Lab의 수상, 발표, 논문 게재 소식입니다.' };

export default function NewsPage() {
  const news = getNews();
  return (
    <>
      <PageHeader title="뉴스" />
      <div className="container">
        {news.length === 0 ? <p className="muted">아직 소식이 없습니다.</p> : <NewsList news={news} />}
      </div>
    </>
  );
}
