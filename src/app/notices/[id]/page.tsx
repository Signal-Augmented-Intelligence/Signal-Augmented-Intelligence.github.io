import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { MarkedText } from '@/components/MarkedText';
import { PageHeader } from '@/components/PageHeader';
import { Redirect, redirectMetadata } from '@/components/Redirect';
import { getNotices, type Notice } from '@/lib/content';
import { formatDate } from '@/lib/format';
import { NOTICE_KINDS, noticeTitle } from '@/lib/notices';
import styles from '../notices.module.css';

type Params = { params: Promise<{ id: string }> };

/** Static export needs at least one page: with no notices, a stand-in page forwards to the list. */
const EMPTY = 'none';
export function generateStaticParams() {
  const ids = getNotices().map((n) => ({ id: n.id }));
  return ids.length > 0 ? ids : [{ id: EMPTY }];
}
export const dynamicParams = false;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const n = getNotices().find((x) => x.id === id);
  return n ? { title: noticeTitle(n), description: `${NOTICE_KINDS[n.kind]} notice from SAI Lab.` } : redirectMetadata;
}

/** Remarks keep their line breaks; **bold** and web addresses are drawn by MarkedText (guideline "내용 표기"). */
function Remarks({ text }: { text: string }) {
  return <p className={styles.remarks}><MarkedText text={text} /></p>;
}

function facts(n: Notice): [string, ReactNode][] {
  const day = (d: string) => d && <span className="num">{formatDate(d)}</span>;
  const rows: [string, ReactNode][] = n.kind === 'conference'
    ? [['Host', n.host], ['Paper deadline', day(n.paper_deadline)], ['Registration', day(n.registration_deadline)], ['Presentation', day(n.event_date)]]
    : [['Type', NOTICE_KINDS[n.kind]], ['Date', day(n.event_date)]];
  return rows.filter(([, v]) => v);
}

/** One notice: its facts on the left, the poster on the right (below on phones), then remarks and links. */
export default async function NoticePage({ params }: Params) {
  const { id } = await params;
  const n = getNotices().find((x) => x.id === id);
  if (!n && id === EMPTY) return <Redirect to="/notices/" />;
  if (!n) notFound();
  const rows = facts(n);
  return (
    <>
      <PageHeader title={noticeTitle(n)} back={<Link href="/notices/">Back to Notices</Link>} long />
      <div className="container">
        <div className={`${styles.detail} ${n.photo ? '' : styles.noPoster}`}>
          <div>
            {rows.length > 0 && (
              <dl className={styles.facts}>
                {rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
              </dl>
            )}
            {n.body && <Remarks text={n.body} />}
            {n.link && <p className={styles.links}>{n.link.startsWith('/')
              ? <Link href={n.link}>Details</Link>
              : <a href={n.link} target="_blank" rel="noopener noreferrer">Details</a>}</p>}
            {n.date && <p className={styles.posted}>Posted <span className="num">{formatDate(n.date)}</span></p>}
          </div>
          {n.photo && (
            <a href={n.photo} className={styles.poster} target="_blank" rel="noopener noreferrer" aria-label={`Open ${n.kind === 'conference' ? 'poster' : 'photo'}: ${noticeTitle(n)}`}>
              <img src={n.photo} alt={n.kind === 'conference' ? `Poster: ${noticeTitle(n)}` : noticeTitle(n)} />
            </a>
          )}
        </div>
      </div>
    </>
  );
}
