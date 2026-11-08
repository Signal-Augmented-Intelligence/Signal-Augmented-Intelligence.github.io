import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@fontsource-variable/instrument-sans/wght.css';
import '@fontsource/stix-two-text/400-italic.css';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './globals.css';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { getLab } from '@/lib/content';
import { SITE_URL } from '@/lib/site';

const lab = getLab();

/**
 * Runs before paint on every full page load. On Home with a wide screen and motion allowed, starts the night-sky
 * phase of the hero (see components/Hero.tsx). Menu navigation does not rerun it.
 */
const HERO_SCRIPT = "try{var d=document.documentElement;if(location.pathname==='/'&&matchMedia('(min-width: 961px)').matches&&!matchMedia('(prefers-reduced-motion: reduce)').matches){d.dataset.hero='night'}}catch(e){}";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${lab.name} — ${lab.full_name}`, template: `%s | ${lab.name}` },
  description: `${lab.name} (${lab.full_name}) at ${lab.institution}. ${lab.intro}`,
  robots: lab.draft ? { index: false, follow: false } : undefined,
  // Link previews (KakaoTalk, Slack, …). The image is app/opengraph-image.png; the icons are app/icon.svg and app/apple-icon.png.
  openGraph: {
    type: 'website',
    siteName: lab.name,
    title: `${lab.name} — ${lab.full_name}`,
    description: `${lab.full_name}, ${lab.institution}`,
    locale: 'en_US',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: HERO_SCRIPT }} />
      </head>
      <body>
        <a className="skip-link" href="#main">Skip to content</a>
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
