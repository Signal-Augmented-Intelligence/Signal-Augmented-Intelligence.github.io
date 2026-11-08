/**
 * 폼 공통: 쓰던 내용 임시 보관과 "바꾼 칸만" 보내기 (규칙 문서 3-3 원칙 5, api.md 1장 PATCH).
 */

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

/** YYYY, YYYY-MM, YYYY-MM-DD (아는 만큼만 적는 날짜). */
export const PARTIAL_DATE = /^\d{4}(?:-\d{2}(?:-\d{2})?)?$/;
