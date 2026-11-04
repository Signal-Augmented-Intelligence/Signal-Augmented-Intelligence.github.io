'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import styles from './NewsHighlights.module.css';

export type Highlight = {
  kind: string;
  date: string;
  headline: string;
  members: { name: string; photo: string }[];
  photo: string;
  album: string;
  link: { href: string; label: string } | null;
};

const SLIDE_MS = 6000;

/**
 * 뉴스 highlights: text on the left, the event photo on the right. The next photo wipes in from the right
 * and the text rises; a bar per slide fills while it shows. Pauses while hovered or focused;
 * with reduced motion it does not advance on its own.
 */
export function NewsHighlights({ items }: { items: Highlight[] }) {
  const [current, setCurrent] = useState(0);
  const [previous, setPrevious] = useState(-1);
  const [cycle, setCycle] = useState(0);
  const [paused, setPaused] = useState(false);
  const [still, setStill] = useState(true);
  const currentRef = useRef(0);

  const go = useCallback((n: number) => {
    const next = (n + items.length) % items.length;
    setPrevious(currentRef.current === next ? -1 : currentRef.current);
    currentRef.current = next;
    setCurrent(next);
    setCycle((c) => c + 1);
  }, [items.length]);

  useEffect(() => { setStill(window.matchMedia('(prefers-reduced-motion: reduce)').matches); }, []);
  useEffect(() => {
    if (still || paused || items.length < 2) return;
    const timer = window.setTimeout(() => go(currentRef.current + 1), SLIDE_MS);
    return () => window.clearTimeout(timer);
  }, [cycle, paused, still, go, items.length]);

  return (
    <section
      className={styles.highlights}
      aria-roledescription="carousel"
      aria-label="뉴스 하이라이트"
      data-paused={paused || still || undefined}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false); }}
    >
      <div className={styles.text}>
        <div className={styles.slot}>
          {items.map((it, k) => (
            <div key={k} className={styles.slide} data-state={k === current ? 'on' : k === previous ? 'out' : undefined}
              aria-roledescription="slide" aria-label={`${k + 1} / ${items.length}`} aria-hidden={k !== current} inert={k !== current}>
              <p className={styles.meta}><strong className={styles.kind}>{it.kind}</strong><span className="num">{it.date}</span></p>
              <h2 className={styles.headline} lang="ko">{it.headline}</h2>
              {it.members.length > 0 && (
                <p className={styles.members} lang="ko">
                  {it.members.map((m) => m.photo && <img key={m.name} src={m.photo} alt="" />)}
                  {it.members.map((m) => m.name).join(', ')}
                </p>
              )}
              <p className={styles.links} lang="ko">
                <Link href={it.album}>사진 더 보기 →</Link>
                {it.link && (it.link.href.startsWith('/') && !it.link.href.startsWith('/files/')
                  ? <Link href={it.link.href}>{it.link.label} →</Link>
                  : <a href={it.link.href}>{it.link.label} →</a>)}
              </p>
            </div>
          ))}
        </div>
        {items.length > 1 && (
          <div className={styles.controls}>
            <span className={`${styles.count} num`}><b>{String(current + 1).padStart(2, '0')}</b> / {String(items.length).padStart(2, '0')}</span>
            <div className={styles.bars}>
              {items.map((_, k) => (
                <button key={k === current ? `${k}-${cycle}` : k} type="button" className={styles.bar} aria-label={`${k + 1}번째 소식`}
                  aria-current={k === current || undefined} data-state={k < current ? 'done' : k === current ? 'run' : undefined} onClick={() => go(k)}>
                  <i />
                </button>
              ))}
            </div>
            <div className={styles.arrows}>
              <button type="button" aria-label="이전 소식" onClick={() => go(current - 1)}>‹</button>
              <button type="button" aria-label="다음 소식" onClick={() => go(current + 1)}>›</button>
            </div>
          </div>
        )}
      </div>
      <div className={styles.photo}>
        {items.map((it, k) => (
          <img key={k === current ? `${k}-${cycle}` : k} src={it.photo} alt="" loading={k === 0 ? 'eager' : 'lazy'}
            data-state={k === current ? 'on' : k === previous ? 'out' : undefined} />
        ))}
      </div>
    </section>
  );
}
