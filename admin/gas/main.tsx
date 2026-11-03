/**
 * Apps Script 전환 빌드의 시작점. 기존 관리 화면(app/*)을 그대로 쓰고, 틀(app/layout.tsx)과 주소만 바꿉니다.
 * - 주소는 해시(#/members/). 화면 안의 "/members/" 같은 링크는 눌렀을 때 해시로 바꿉니다.
 * - Pretendard 글꼴은 HTML 틀(build.mjs)이 CDN에서 불러옵니다. 나머지 글꼴·CSS·그림은 이 파일 하나에 들어갑니다.
 */
import '@fontsource-variable/instrument-sans/wght.css';
import '@/app/globals.css';
import '@admin/components/admin.css';
import { type ComponentType, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AdminHome from '@admin/app/page';
import AlbumPage from '@admin/app/album/page';
import HomePage from '@admin/app/home/page';
import MembersPage from '@admin/app/members/page';
import NewsPage from '@admin/app/news/page';
import NoticesPage from '@admin/app/notices/page';
import ResearchPage from '@admin/app/research/page';
import SeminarsPage from '@admin/app/seminars/page';
import { AdminHeader } from '@admin/components/AdminHeader';
import { DialogProvider } from '@admin/components/Dialog';
import { SessionProvider } from '@admin/components/Session';
import { SITE_URL } from '@admin/site';
import { usePathname } from './navigation';
import { PendingNotice } from './PendingNotice';

const PAGES: Record<string, ComponentType> = {
  '/': AdminHome, '/home/': HomePage, '/members/': MembersPage, '/research/': ResearchPage,
  '/seminars/': SeminarsPage, '/album/': AlbumPage, '/news/': NewsPage, '/notices/': NoticesPage,
};

/** 화면 안의 관리 화면 링크("/", "/members/")를 해시 이동으로 바꿉니다. 새 탭 링크와 다른 사이트 링크는 그대로 둡니다. */
document.addEventListener('click', (e) => {
  const a = (e.target as Element | null)?.closest?.('a[href]');
  const href = a?.getAttribute('href');
  if (!a || !href?.startsWith('/') || href.startsWith('//') || a.getAttribute('target')) return;
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  location.hash = href;
  window.scrollTo(0, 0);
});

function App() {
  const path = usePathname();
  const Page = PAGES[path];
  if (!Page) { location.hash = '/'; return null; }
  return (
    <DialogProvider>
      <SessionProvider>
        <AdminHeader siteUrl={SITE_URL} />
        <main id="main"><Page /></main>
        <PendingNotice />
      </SessionProvider>
    </DialogProvider>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
