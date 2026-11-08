'use client';

import { type ChangeEvent, useEffect, useRef, useState } from 'react';
import { ApiError, signedOut } from '@admin/lib/api';
import { FileProcessingError, type FileInfo, type FilePurpose, formatSize, retryFile, uploadFile, uploadingLabel, waitForFile } from '@admin/lib/files';
import { useDialog } from './Dialog';
import styles from './Field.module.css';

/**
 * 올리기가 끝난 파일. 항목 저장에는 id를 씁니다.
 * processing: 올라갔고 관리 서버가 처리하는 중. 폼이 이 값을 브라우저에 임시 보관하므로, 새로고침해도 id로 이어서 기다립니다.
 * previous: 바꾸기 전의 파일. 처리에 실패하면 이 파일로 되돌립니다.
 */
export type FileValue = {
  id: string; name: string; size: number | null; preview_url: string | null; content_url?: string | null; warnings: string[];
  processing?: true; previous?: FileValue | null;
};

type Busy = { kind: 'queued' | 'processing'; name: string } | { kind: 'uploading'; name: string; percent: number };

const ready = (info: FileInfo, name: string): FileValue =>
  ({ id: info.id, name: info.original_name || name, size: info.public_size_bytes ?? null,
    preview_url: info.preview_url, content_url: info.content_url, warnings: info.warnings ?? [] });

/**
 * 파일 하나를 고르면 바로 올리고, 칸 안에 상태를 보통 글자로 보여 줍니다 (세미나 업로드 설계 5장).
 * 고르기 전 → 올리는 중 42% → 처리 중 → 준비됨(이름, 공개용 크기, 바꾸기, 미리보기).
 * 실패는 오류 팝업 뒤 바꾸기 전 파일(없으면 고르기 전)로 돌아갑니다.
 * 올리는 중에는 창을 닫거나 새로고침하면 브라우저가 확인을 묻습니다. 처리 중에는 묻지 않습니다(돌아와서 이어서 기다림).
 * onPending: 올리는 동안의 Promise를 넘깁니다. 저장은 이것을 기다렸다가 이어서 합니다.
 */
export function FileUpload({ name, label, purpose, accept, maxBytes, tooLarge, value, onChange, onPending }: {
  name: string;
  /** 파일 고르기 칸의 이름(화면 낭독용). Field group의 제목과 같게 둡니다. */
  label: string;
  purpose: FilePurpose;
  accept: string;
  maxBytes: number;
  tooLarge: string;
  value: FileValue | null;
  onChange: (value: FileValue | null) => void;
  onPending: (pending: Promise<FileValue | null> | null) => void;
}) {
  const dialog = useDialog();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<Busy | null>(null);
  const [failed, setFailed] = useState<{ id: string; name: string; previous: FileValue | null } | null>(null);
  const resumed = useRef<string | null>(null);

  const uploading = busy?.kind === 'uploading' || busy?.kind === 'queued';
  useEffect(() => {
    if (!uploading) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [uploading]);

  /** 실패하면 바꾸기 전 파일로 되돌리고 오류 팝업을 띄웁니다. */
  const fail = (err: unknown, previous: FileValue | null, name: string, retryId?: string) => {
    onChange(previous);
    setFailed(err instanceof FileProcessingError && err.retryable ? { id: err.fileId, name, previous }
      : retryId && err instanceof ApiError && ['CONFLICT', 'STORAGE_UNAVAILABLE'].includes(err.code)
        ? { id: retryId, name, previous } : null);
    if (signedOut(err)) return null;
    const message = err instanceof ApiError ? err.message : '파일을 처리하지 못했습니다.';
    void dialog.error('파일을 올리지 못했습니다', previous ? <>{message}<br />이전 파일은 그대로 남아 있습니다.</> : message);
    return null;
  };

  const track = (pending: Promise<FileValue | null>) => {
    onPending(pending.finally(() => { setBusy(null); onPending(null); }));
  };

  // 새로고침 전에 처리 중이던 파일: 같은 id로 이어서 기다립니다.
  useEffect(() => {
    if (!value?.processing || busy || resumed.current === value.id) return;
    resumed.current = value.id;
    const { previous = null } = value;
    setBusy({ kind: 'processing', name: value.name });
    track(waitForFile({ id: value.id, status: 'processing' })
      .then((info) => { const next = ready(info, value.name); onChange(next); return next; })
      .catch((err: unknown) => fail(err, previous, value.name)));
  });

  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > maxBytes) { void dialog.error('파일을 올리지 못했습니다', tooLarge); return; }

    setFailed(null);
    const previous = value?.processing ? value.previous ?? null : value;
    setBusy({ kind: 'queued', name: file.name });
    track(uploadFile(
      file, purpose,
      (percent) => setBusy({ kind: 'uploading', name: file.name, percent }),
      (info) => {
        resumed.current = info.id;
        setBusy({ kind: 'processing', name: file.name });
        onChange({ id: info.id, name: info.original_name || file.name, size: null, preview_url: null, warnings: [], processing: true, previous });
      },
      () => setBusy({ kind: 'queued', name: file.name }),
    ).then((info) => { const next = ready(info, file.name); onChange(next); return next; })
      .catch((err: unknown) => fail(err, previous, file.name)));
  };

  const retry = () => {
    if (!failed || busy) return;
    const { id, name: fileName, previous } = failed;
    setFailed(null);
    setBusy({ kind: 'queued', name: fileName });
    track(retryFile(id,
      () => setBusy({ kind: 'queued', name: fileName }),
      () => setBusy({ kind: 'processing', name: fileName }),
    ).then((info) => { const next = ready(info, fileName); onChange(next); return next; })
      .catch((err: unknown) => fail(err, previous, fileName, id)));
  };

  const status = busy
    ? (busy.kind === 'uploading' ? uploadingLabel(busy.percent) : busy.kind === 'queued' ? '대기 중' : '처리 중')
    : value && !value.processing ? formatSize(value.size) : '';

  return (
    <span className={styles.upload}>
      <span className={styles.file} data-state={busy ? 'busy' : value ? 'ready' : 'empty'}>
        <input ref={input} type="file" name={name} aria-label={label} accept={accept} onChange={pick} disabled={!!busy} tabIndex={value || busy ? -1 : 0} />
        {!value && !busy && <span className={styles.button}>파일 선택</span>}
        <span className={value || busy ? styles.chosen : styles.name}>{busy?.name ?? value?.name ?? '선택한 파일 없음'}</span>
        {status && <span className={styles.status}>{status}</span>}
        {value && !busy && (
          <span className={styles.change}>
            <button type="button" className="admin-text-button" onClick={() => input.current?.click()}>바꾸기</button>
            <button type="button" className="admin-text-button" onClick={() => onChange(null)}>빼기</button>
          </span>
        )}
      </span>
      {value?.preview_url && !busy && <img className={styles.preview} src={value.preview_url} alt="" />}
      {value?.content_url && !busy && <a href={value.content_url} target="_blank" rel="noopener noreferrer">PDF 열기</a>}
      {failed && !busy && <button type="button" className="admin-text-button" onClick={retry}>가공 다시 시도</button>}
    </span>
  );
}
