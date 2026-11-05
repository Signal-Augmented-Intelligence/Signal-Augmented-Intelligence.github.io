/**
 * Apps Script 전환 빌드의 화면 목록. 주소는 해시이므로 Next의 폴더 경로 대신 이 표로 화면을 찾습니다.
 * 표에 없는 주소는 반영·백업 화면으로 돌아가므로, 메뉴(menu.ts)에 화면을 더하면 여기에도 더합니다.
 * scripts/check-admin.mjs가 메뉴의 모든 화면이 여기 있는지 확인합니다.
 */
import type { ComponentType } from 'react';
import AdminHome from '@admin/app/page';
import AlbumPage from '@admin/app/album/page';
import HomePage from '@admin/app/home/page';
import MembersPage from '@admin/app/members/page';
import ProfessorPage from '@admin/app/members/professor/page';
import NewsPage from '@admin/app/news/page';
import NoticesPage from '@admin/app/notices/page';
import ResearchPage from '@admin/app/research/page';
import SeminarsPage from '@admin/app/seminars/page';

export const PAGES: Record<string, ComponentType> = {
  '/': AdminHome, '/home/': HomePage, '/members/professor/': ProfessorPage, '/members/': MembersPage,
  '/research/': ResearchPage, '/seminars/': SeminarsPage, '/album/': AlbumPage, '/news/': NewsPage, '/notices/': NoticesPage,
};
