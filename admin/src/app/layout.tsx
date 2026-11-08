import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@fontsource-variable/instrument-sans/wght.css';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import '@/app/globals.css';
import '@admin/components/admin.css';
import icon from '@/app/icon.svg';
import { AdminHeader } from '@admin/components/AdminHeader';
import { DialogProvider } from '@admin/components/Dialog';
import { SessionProvider } from '@admin/components/Session';
import { SITE_URL } from '@admin/site';

export const metadata: Metadata = {
  title: { default: 'SAI Lab 관리', template: '%s | SAI Lab 관리' },
  robots: { index: false, follow: false },
  icons: { icon: { url: icon.src, type: 'image/svg+xml' } },
};

/** 관리 화면 공통 틀: 공개 사이트와 같은 토큰·글꼴·헤더 형식. 푸터는 두지 않습니다. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <a className="skip-link" href="#main">본문 바로가기</a>
        <DialogProvider>
          <SessionProvider>
            <AdminHeader siteUrl={SITE_URL} />
            <main id="main">{children}</main>
          </SessionProvider>
        </DialogProvider>
      </body>
    </html>
  );
}
