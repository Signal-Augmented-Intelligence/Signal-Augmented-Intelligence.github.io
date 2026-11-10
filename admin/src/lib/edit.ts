/**
 * 폼 공통: 쓰던 내용 임시 보관과 "바꾼 칸만" 보내기 (규칙 문서 3-3 원칙 5, api.md 1장 PATCH).
 */
import { useRef } from 'react';

/** 브라우저에 임시 보관한 쓰던 내용. 보관하지 못해도 폼은 그대로 씁니다. */
export function readDraft<T>(key: string): T | null {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : null; } catch { return null; }
}
export function writeDraft<T>(key: string, value: T | null) {
  try { if (value) localStorage.setItem(key, JSON.stringify(value)); else localStorage.removeItem(key); } catch { /* 보관 못 해도 폼은 그대로 */ }
}

/** 공용 컴퓨터에서 명시적으로 로그아웃하면 이전 작성자의 임시 입력을 남기지 않습니다. */
export function clearLocalWork() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const key = localStorage.key(i);
      if (key?.startsWith('sai-admin:')) localStorage.removeItem(key);
    }
  } catch { /* 저장소를 쓸 수 없어도 로그아웃은 계속합니다. */ }
}

/** 원래 값과 다른 칸만 (배열·객체는 내용으로 비교). */
export function changedFields<T extends object>(original: T, body: Partial<T>): Partial<T> {
  return Object.fromEntries(Object.entries(body).filter(([k, v]) =>
    JSON.stringify(v ?? null) !== JSON.stringify((original as Record<string, unknown>)[k] ?? null))) as Partial<T>;
}

/** 겹친 칸을 알릴 때 쓰는 이름. 없는 칸은 API 이름 그대로 보입니다. */
const FIELD_LABELS: Record<string, string> = {
  name: '이름', name_ko: '한글 이름', group: '구분', grade: '학년', since: '시작', until: '끝',
  bio: '한 줄 소개(국문)', bio_en: '한 줄 소개(영문)', url: 'Website', email: '학교 메일', after: '졸업 뒤', photo_file_id: '사진',
  title: '제목', title_ko: '한글 제목', date: '날짜', text: '내용', link: '링크', body: '본문', summary: '요약',
  hidden: '숨김', pinned: '상단 고정', host: '주최', paper_deadline: '논문 마감', registration_deadline: '등록 마감',
  authors: '저자', venue: '발표처', pub_date: '발표일', status: '상태', award: '수상', links: '링크',
  area_ids: '연구 분야', pdf_file_id: 'PDF', excerpt: '발췌', figure_file_id: '그림', figure_alt: '그림 설명',
  figure_caption: '그림 캡션', speaker: '발표자', cover: '표지',
};
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * 폼을 연 때의 원본을 기억합니다. 폼이 열린 사이 목록을 다시 불러오면 `current`가 최신 값이 됩니다.
 * - changes: 폼을 연 뒤 사용자가 실제로 바꾼 칸만. 최신 값과 비교하면, 그사이 다른 곳에서 고친 칸이
 *   폼에 남은 옛 값으로 되돌아갑니다.
 * - clashes: 사용자가 바꾼 칸 가운데 그사이 다른 곳에서도 바뀐 칸의 이름. 저장 전에 덮어쓸지 묻습니다.
 * 새 항목(current 없음)은 보낸 내용 그대로이고 겹칠 일이 없습니다.
 */
export function useEditBase<T extends object>(current: T | undefined,
  diff: (original: T, body: Partial<T>) => Partial<T> = changedFields) {
  const base = useRef(current);
  const at = (value: T | undefined, key: string) => (value as Record<string, unknown> | undefined)?.[key];
  return {
    changes: (body: Partial<T>): Partial<T> => (base.current ? diff(base.current, body) : body),
    clashes: (changes: Partial<T>): string[] => (!base.current || !current ? [] : Object.keys(changes)
      .filter((key) => !same(at(current, key), at(base.current, key)))
      .map((key) => FIELD_LABELS[key] ?? key)),
    /** 폼을 닫지 않고 이어 쓰는 화면(앨범)에서 자기 저장이 끝난 뒤 그 결과를 새 기준으로 삼습니다. */
    rebase: (next: T) => { base.current = next; },
  };
}

/** 겹친 칸이 있으면 덮어쓸지 묻습니다. 겹친 칸이 없거나 덮어쓰기를 고르면 true. */
export async function overwriteOk(dialog: { confirm: (title: string, body: string, action: string) => Promise<boolean> },
  clashes: string[]): Promise<boolean> {
  if (clashes.length === 0) return true;
  return dialog.confirm('다른 곳에서 먼저 바뀐 칸이 있습니다',
    `폼을 연 뒤 다른 곳에서 ${clashes.join(', ')} 칸을 고쳤습니다. 지금 입력한 내용으로 덮어쓸까요? `
    + '취소하면 저장하지 않고 폼을 그대로 둡니다. 폼을 닫았다 다시 열면 바뀐 내용을 볼 수 있습니다.', '덮어쓰기');
}

/** YYYY, YYYY-MM, YYYY-MM-DD (아는 만큼만 적는 날짜). */
export const PARTIAL_DATE = /^\d{4}(?:-\d{2}(?:-\d{2})?)?$/;
