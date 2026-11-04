/**
 * 관리 화면 메뉴. 공개 사이트와 같은 이름을 쓰고, 메뉴 하나에 화면 하나입니다.
 * 랩 공용 계정 하나로 쓰므로 권한별 메뉴 구분은 없습니다.
 * 따로 화면을 두지 않는 것: 로그인(로그인 전이면 그 자리에 로그인 칸), 비밀번호 바꾸기(헤더의 팝업),
 * 변경 기록(항목마다 "이전 기록" 팝업).
 * `ready`: 그 화면이 만들어졌는지. 만들기 전에는 메뉴에 글자만 보이고 누를 수 없습니다.
 * `group`: 메뉴를 나누는 묶음. 묶음 사이에 가는 선을 둡니다.
 * `site`: 이 화면이 고치는 공개 사이트 주소. 헤더의 "공개 사이트" 링크가 지금 화면에 맞는 곳을 엽니다.
 * "첫 화면"은 공개 사이트 첫 화면(Home)만 가리킵니다. 관리 화면의 시작 화면은 "반영·백업"이라고 부릅니다.
 */
export type MenuItem = { title: string; href: string; site: string; ready: boolean; note: string; group: 'start' | 'content' };

/** 주소에 맞는 메뉴 항목. 없는 주소면 undefined. */
export function currentMenu(path: string): MenuItem | undefined {
  return MENU.find((m) => (m.href === '/' ? path === '/' : path.startsWith(m.href)));
}

export const MENU: MenuItem[] = [
  { title: '반영·백업', href: '/', site: '/', ready: true, note: '마지막 반영·백업, 원본 파일 저장소', group: 'start' },
  { title: 'Home', href: '/home/', site: '/', ready: true, note: '첫 화면 사진, 시, 랩 정보', group: 'content' },
  { title: 'Professor', href: '/members/professor/', site: '/members/professor/', ready: true, note: '교수님 소개와 활동', group: 'content' },
  { title: 'Members', href: '/members/', site: '/members/', ready: true, note: '멤버 추가와 관리', group: 'content' },
  { title: 'Research', href: '/research/', site: '/research/', ready: true, note: '연구 분야, 논문', group: 'content' },
  { title: 'Seminars', href: '/seminars/', site: '/seminars/', ready: true, note: '세미나 올리기, 세미나 분야', group: 'content' },
  { title: 'Album', href: '/album/', site: '/album/', ready: true, note: '행사, 사진, 대표 사진', group: 'content' },
  { title: '뉴스', href: '/news/', site: '/news/', ready: true, note: '소식', group: 'content' },
  { title: 'Notices', href: '/notices/', site: '/notices/', ready: true, note: '일정과 모집 공고', group: 'content' },
];
