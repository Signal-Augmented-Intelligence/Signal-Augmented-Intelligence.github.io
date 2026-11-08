import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { getAlbums } from '@/lib/content';
import { formatDate } from '@/lib/format';
import { AlbumGrid } from '../AlbumGrid';

type Params = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return getAlbums().map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const album = getAlbums().find((a) => a.slug === slug);
  return album ? { title: album.title, description: `Photos from ${album.title}, SAI Lab.` } : {};
}

/** One event: all its photos in a square grid; a photo opens full size with previous/next. */
export default async function AlbumEventPage({ params }: Params) {
  const { slug } = await params;
  const album = getAlbums().find((a) => a.slug === slug);
  if (!album) notFound();
  return (
    <>
      <PageHeader
        title={album.title}
        lede={<><span className="num">{formatDate(album.date)}</span> · 사진 <span className="num">{album.photos.length}</span>장</>}
        back={<Link href="/album/">Back to Album</Link>}
        long
      />
      <div className="container">
        <AlbumGrid title={album.title} photos={album.photos} />
      </div>
    </>
  );
}
