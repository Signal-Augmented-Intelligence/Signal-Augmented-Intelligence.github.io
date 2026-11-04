import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { getAlbums } from '@/lib/content';
import { formatDate, langOf } from '@/lib/format';
import styles from './album.module.css';

export const metadata: Metadata = { title: 'Album', description: 'Photos from SAI Lab, Hanshin University.' };

/** Album list: one cover photo per event (newest first). A cover opens that event's photos. */
export default function AlbumPage() {
  const albums = getAlbums();
  return (
    <>
      <PageHeader title="Album" />
      <div className="container">
        {albums.length === 0 ? <p className="muted">Photos will be posted here.</p> : (
          <ul className={styles.albums}>
            {albums.map((a) => (
              <li key={a.slug}>
                <Link href={`/album/${a.slug}/`} className={styles.album}>
                  <span className={styles.cover}><img src={a.cover.src} alt="" loading="lazy" /></span>
                  <span className={styles.albumTitle} lang={langOf(a.title)}>{a.title}</span>
                  <span className={styles.albumMeta}>
                    <span className="num">{formatDate(a.date)}</span> · 사진 <span className="num">{a.photos.length}</span>장
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
