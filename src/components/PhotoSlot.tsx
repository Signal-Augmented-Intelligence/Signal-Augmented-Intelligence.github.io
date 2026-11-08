import styles from './PhotoSlot.module.css';
import { mediaUrl } from '@/lib/media';

/** 3:4 photo slot. Without a photo it stays an empty tinted box of the same size. */
export function PhotoSlot({ photo, alt, className, eager = false }: { photo: string; alt: string; className?: string; eager?: boolean }) {
  return (
    <div className={`${styles.slot} ${className ?? ''}`}>
      {photo && <img src={mediaUrl(`/images/people/${photo}`)} alt={alt} width={600} height={800} loading={eager ? 'eager' : 'lazy'} />}
    </div>
  );
}
