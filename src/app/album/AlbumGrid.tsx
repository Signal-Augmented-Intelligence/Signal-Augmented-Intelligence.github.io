'use client';

import { type CSSProperties, type KeyboardEvent, useRef, useState } from 'react';
import styles from './album.module.css';

type Photo = { src: string; alt: string };

/** Thumbnail grid for one album; a photo opens in a dialog with previous/next. */
export function AlbumGrid({ title, photos }: { title: string; photos: Photo[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);
  const open = (i: number) => { setIndex(i); dialog.current?.showModal(); };
  const step = (d: number) => setIndex((i) => (i + d + photos.length) % photos.length);
  const onKeyDown = (e: KeyboardEvent<HTMLDialogElement>) => {
    if (e.key === 'ArrowRight') step(1);
    if (e.key === 'ArrowLeft') step(-1);
  };
  const current = photos[index];

  return (
    <>
      {/* 3–5 columns by photo count, so a short event still fills the row. */}
      <ul className={styles.grid} style={{ '--cols': Math.min(5, Math.max(3, photos.length)) } as CSSProperties}>
        {photos.map((p, i) => (
          <li key={p.src}>
            <button type="button" className={styles.thumb} onClick={() => open(i)} aria-label={`${title}: photo ${i + 1} of ${photos.length}${p.alt ? `, ${p.alt}` : ''}`}>
              <img src={p.src} alt="" loading="lazy" />
            </button>
          </li>
        ))}
      </ul>
      <dialog ref={dialog} className={styles.dialog} onKeyDown={onKeyDown} onClick={(e) => { if (e.target === dialog.current) dialog.current?.close(); }} aria-label={title}>
        {current && (
          <figure className={styles.figure}>
            <img src={current.src} alt={current.alt} />
            <figcaption className={styles.caption}>
              <span>{current.alt || title}</span>
              <span className="num">{index + 1} / {photos.length}</span>
            </figcaption>
          </figure>
        )}
        <div className={styles.controls}>
          {photos.length > 1 && <button type="button" onClick={() => step(-1)}>Previous</button>}
          {photos.length > 1 && <button type="button" onClick={() => step(1)}>Next</button>}
          <button type="button" onClick={() => dialog.current?.close()}>Close</button>
        </div>
      </dialog>
    </>
  );
}
