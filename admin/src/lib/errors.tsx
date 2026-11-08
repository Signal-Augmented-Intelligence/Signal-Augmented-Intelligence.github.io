import type { ReactNode } from 'react';
import { ApiError } from './api';

/**
 * 오류를 팝업 본문으로 바꿉니다. 칸별 오류(fields)는 화면 칸 이름과 함께 목록으로 보여 줍니다 (api.md 1장).
 * labels: API 필드 이름 → 화면 칸 이름.
 */
export function errorBody(err: unknown, labels: Record<string, string> = {}): ReactNode {
  if (!(err instanceof ApiError)) return '요청을 처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요.';
  const fields = Object.entries(err.fields);
  if (fields.length === 0) return err.message;
  return <>{err.message}<ul>{fields.map(([k, v]) => <li key={k}>{labels[k] ?? k}: {v}</li>)}</ul></>;
}

/** 칸별 오류 목록만 (화면에서 미리 확인한 빈 칸). */
export function fieldList(items: string[]): ReactNode {
  return <ul>{items.map((t) => <li key={t}>{t}</li>)}</ul>;
}
