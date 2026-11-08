'use client';

import { usePublish } from '@admin/lib/usePublish';
import { HomeSlidesScreen } from './HomeSlidesScreen';
import { HomeContentScreen } from './HomeContentScreen';

/** 첫 화면의 모든 편집 항목이 하나의 공개 반영 대기 목록을 공유합니다. */
export function HomePageContent() {
  const publish = usePublish();
  return <><HomeSlidesScreen publish={publish} /><HomeContentScreen publish={publish} /></>;
}
