'use client';

import { useEffect, useState } from 'react';
import { METEORS, NIGHT_MS, SLIDE_MS } from './heroSky';
import styles from './Hero.module.css';

/** Renders "e^{jωn}" with a real superscript. */
function Formula({ text }: { text: string }) {
  const parts = text.split(/\^\{([^}]*)\}/);
  return <>{parts.map((part, i) => (i % 2 === 1 ? <sup key={i}>{part}</sup> : part))}</>;
}

type Props = { name: string; institution: string; quote: string[]; poemTitle: string; slides: string[] };

/**
 * Home first screen: a full-width photo hero of the lab (photos from content/home.yml; none yet: plain navy).
 * On every full page load (refresh or typed URL, wide screens, motion allowed) it opens as a night sky with
 * falling formulas, then the sky fades away to the photos after NIGHT_MS. The inline script in the root layout
 * sets html[data-hero="night"] before paint; returning to Home through the menu skips the night phase.
 */
export function Hero({ name, institution, quote, poemTitle, slides }: Props) {
  const [slide, setSlide] = useState(0);
  const [night, setNight] = useState(true);

  useEffect(() => {
    const root = document.documentElement;
    const isNight = root.dataset.hero === 'night';
    setNight(isNight);
    const timer = isNight ? window.setTimeout(() => { root.dataset.hero = 'day'; setNight(false); }, NIGHT_MS) : undefined;
    return () => {
      window.clearTimeout(timer);
      root.dataset.hero = 'day';
    };
  }, []);

  useEffect(() => {
    if (night || slides.length < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setSlide((s) => (s + 1) % slides.length), SLIDE_MS);
    return () => window.clearInterval(timer);
  }, [night, slide]);

  return (
    <section className={styles.hero} aria-label={name}>
      <div className={styles.slides} aria-hidden="true">
        {slides.map((src, i) => (
          <img key={src} src={src} alt="" className={styles.slide} data-active={i === slide} loading={i === 0 ? 'eager' : 'lazy'} />
        ))}
      </div>
      <div className={styles.shade} aria-hidden="true" />
      <div className={styles.sky} aria-hidden="true" />

      <div className={`container ${styles.inner}`}>
        <div className={styles.field} aria-hidden="true">
          {METEORS.map((m) => (
            <span key={m.text} className={styles.meteor} style={{ left: m.left, top: m.top, fontSize: m.size, animationDuration: `${m.duration}s`, animationDelay: `${m.delay}s` }}>
              <Formula text={m.text} />
            </span>
          ))}
        </div>

        <div className={styles.text}>
          <h1 className={styles.title}>{name}</h1>
          {institution && <p className={styles.institution}>{institution}</p>}
          {quote.length > 0 && (
            <blockquote className={styles.quote} lang="ko">
              {quote.map((line) => <p key={line}>{line}</p>)}
            </blockquote>
          )}
          {poemTitle && <a href="#poem" className={styles.poemLink} lang="ko">「{poemTitle}」 전문 읽기</a>}
        </div>

        {slides.length > 1 && (
          <div className={styles.dots}>
            {slides.map((src, i) => (
              <button key={src} type="button" className={styles.dot} aria-label={`Photo ${i + 1}`} aria-pressed={i === slide} onClick={() => setSlide(i)} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
