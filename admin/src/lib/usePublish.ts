'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, type Publish, signedOut } from './api';
import { useDialog } from '@admin/components/Dialog';

const POLL_MS = 3000;
const FAILED = '공개 사이트에 반영하지 못했습니다';
const FAILED_BODY = '저장한 내용은 남아 있습니다.';
const UNKNOWN = '반영 상태를 확인하지 못했습니다';
const STORE = 'sai-admin:publishing';
/** 상태를 이만큼 연달아 묻지 못하면 오류 팝업을 한 번 띄웁니다. 그동안 그 줄은 계속 "반영 중"입니다. */
const MISS_LIMIT = 5;

type Waiting = Record<string, string>; // 항목 id → 반영 id

function readWaiting(): Waiting {
  try { const raw = localStorage.getItem(STORE); return raw ? JSON.parse(raw) as Waiting : {}; } catch { return {}; }
}
function writeWaiting(w: Waiting) {
  try { if (Object.keys(w).length > 0) localStorage.setItem(STORE, JSON.stringify(w)); else localStorage.removeItem(STORE); } catch { /* 보관 못 해도 이 창에서는 그대로 */ }
}

/**
 * 저장 뒤 공개 반영을 지켜봅니다 (api.md 4장, 규칙 문서 6장).
 * 반영 중인 항목 id를 돌려주고, 끝나면 알림 없이 빼고, 실패하면 오류 팝업("다시 반영" / "닫기")을 띄웁니다.
 * 지켜보는 목록은 브라우저에 보관해서, 새로고침하거나 다른 화면에 다녀와도 끝나기 전에는 "반영 중"으로 보입니다.
 * 상태를 묻지 못하면 "공개 중"으로 바꾸지 않고 "반영 중"으로 둔 채 계속 묻습니다. 반영 기록이 없다는 답(404)만 목록에서 뺍니다.
 */
export function usePublish() {
  const dialog = useDialog();
  const [waiting, setWaiting] = useState<Waiting>({});
  const [settled, setSettled] = useState(0);
  const failing = useRef(false);
  const polling = useRef(false);
  const misses = useRef<Record<string, number>>({});

  useEffect(() => { setWaiting(readWaiting()); }, []);

  const update = useCallback((change: (w: Waiting) => Waiting) => setWaiting((w) => {
    const next = change(w);
    writeWaiting(next);
    return next;
  }), []);

  const track = useCallback((itemId: string, publish?: Publish) => {
    if (!publish || publish.state === 'done') return;
    update((w) => ({ ...w, [itemId]: publish.id }));
  }, [update]);

  useEffect(() => {
    const ids = [...new Set(Object.values(waiting))];
    if (ids.length === 0) return;
    const timer = setInterval(async () => {
      if (polling.current) return;
      polling.current = true;
      try {
        for (const id of ids) {
          let result: Publish;
          try {
            result = (await api.get<Publish>(`/publish/${id}`)).data;
            misses.current[id] = 0;
          } catch (err) {
            if (signedOut(err)) return;
            if (err instanceof ApiError && err.code === 'NOT_FOUND') { update((w) => Object.fromEntries(Object.entries(w).filter(([, pub]) => pub !== id))); continue; }
            misses.current[id] = (misses.current[id] ?? 0) + 1;
            if (misses.current[id] === MISS_LIMIT && !failing.current) {
              failing.current = true;
              await dialog.error(UNKNOWN, err instanceof ApiError ? err.message : undefined);
              failing.current = false;
            }
            continue;
          }
          if (result.state !== 'done' && result.state !== 'failed') continue;
          let retried: Publish | null = null;
          if (result.state === 'failed' && !failing.current) {
            failing.current = true;
            const again = await dialog.error(FAILED, result.message ? `${result.message} ${FAILED_BODY}` : FAILED_BODY, { retry: true, retryLabel: '다시 반영' });
            failing.current = false;
            if (again) { try { retried = (await api.post<Publish>('/publish')).data; } catch { /* 다음 저장 때 다시 */ } }
          }
          delete misses.current[id];
          update((w) => Object.fromEntries(Object.entries(w).flatMap(([item, pub]) => pub !== id ? [[item, pub]] : retried ? [[item, retried.id]] : [])));
          setSettled((count) => count + 1);
        }
      } finally {
        polling.current = false;
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [waiting, dialog, update]);

  return { publishing: (itemId: string) => itemId in waiting, track, settled };
}
