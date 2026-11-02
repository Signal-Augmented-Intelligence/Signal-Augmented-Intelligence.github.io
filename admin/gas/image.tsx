/**
 * Apps Script 전환 빌드에서 next/image 대신 씁니다. HTML 파일 하나에 담기도록 관리 화면 그림을 data URI로 넣습니다.
 */
import type { ImgHTMLAttributes } from 'react';
import hanshin from '../public/images/admin/hanshin-university.png';
import saiLab from '../public/images/admin/sai-lab-black.png';

const ASSETS: Record<string, string> = {
  '/images/admin/hanshin-university.png': hanshin,
  '/images/admin/sai-lab-black.png': saiLab,
};

export default function Image({ src, alt, ...rest }: ImgHTMLAttributes<HTMLImageElement> & { src: string; alt: string }) {
  return <img src={ASSETS[src] ?? src} alt={alt} {...rest} />;
}
