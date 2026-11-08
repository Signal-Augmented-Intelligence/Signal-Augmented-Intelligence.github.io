'use client';

import { createContext, type ReactNode, useCallback, useContext, useRef, useState } from 'react';
import styles from './Dialog.module.css';

/**
 * 팝업 하나로 확인 창과 오류 창을 모두 띄웁니다 (규칙 문서 1부 7장).
 * - confirm: 주 버튼(동작 이름) + "취소". 누른 쪽을 true/false로 돌려줍니다.
 * - error: "닫기" (+ 다시 시도할 수 있으면 "다시 시도"). 다시 시도를 누르면 true.
 * 내용(body)은 없어도 됩니다 (제목만 있는 오류 창).
 * 성공은 알리지 않습니다.
 */
type Request = { kind: 'confirm' | 'error'; title: string; body?: ReactNode; action?: string; retry?: boolean; retryLabel?: string };
type Api = {
  confirm: (title: string, body: ReactNode, action: string) => Promise<boolean>;
  error: (title: string, body?: ReactNode, options?: { retry?: boolean; retryLabel?: string }) => Promise<boolean>;
};

const DialogContext = createContext<Api | null>(null);

export function useDialog(): Api {
  const api = useContext(DialogContext);
  if (!api) throw new Error('useDialog must be used inside <DialogProvider>');
  return api;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const resolver = useRef<(value: boolean) => void>(() => {});
  const [request, setRequest] = useState<Request | null>(null);

  const open = useCallback((r: Request) => new Promise<boolean>((resolve) => {
    resolver.current = resolve;
    setRequest(r);
    requestAnimationFrame(() => ref.current?.showModal());
  }), []);

  const close = (value: boolean) => {
    ref.current?.close();
    resolver.current(value);
    setRequest(null);
  };

  const api = useRef<Api>({
    confirm: (title, body, action) => open({ kind: 'confirm', title, body, action }),
    error: (title, body, options) => open({ kind: 'error', title, body, retry: options?.retry, retryLabel: options?.retryLabel }),
  }).current;

  return (
    <DialogContext.Provider value={api}>
      {children}
      <dialog ref={ref} className={styles.dialog} aria-labelledby="dialog-title" onCancel={(e) => { e.preventDefault(); close(false); }}>
        {request && (
          <>
            <h2 id="dialog-title" className={styles.title}>{request.title}</h2>
            {request.body && <div className={styles.body}>{request.body}</div>}
            <div className={styles.actions}>
              {request.kind === 'confirm' ? (
                <>
                  <button type="button" className="admin-text-button" onClick={() => close(false)}>취소</button>
                  <button type="button" className="admin-button" onClick={() => close(true)} autoFocus>{request.action}</button>
                </>
              ) : (
                <>
                  {request.retry && <button type="button" className="admin-text-button" onClick={() => close(true)}>{request.retryLabel ?? '다시 시도'}</button>}
                  <button type="button" className="admin-button" onClick={() => close(false)} autoFocus>닫기</button>
                </>
              )}
            </div>
          </>
        )}
      </dialog>
    </DialogContext.Provider>
  );
}
