'use client';

import { type ChangeEvent, type DragEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { ApiError, signedOut } from '@admin/lib/api';
import { type FileInfo, type FilePurpose, uploadFile, uploadingLabel } from '@admin/lib/files';
import { fieldList } from '@admin/lib/errors';
import { useDialog } from './Dialog';
import styles from './PhotoGrid.module.css';

/**
 * 사진이 주인 목록 (규칙 문서 1부 3장, 3-1): 사진 칸, 칸 아래 글과 동작 글자 버튼.
 * Album 행사의 사진(정사각형)과 Home 첫 화면 사진(16:9, `wide`)이 같이 씁니다.
 * 첫 화면 사진은 공개 사이트에서 16:9로 보이므로 관리 화면에서도 같은 비율로 보여 줍니다.
 *
 * 칸 아래는 칸마다 같은 높이가 되게 줄 수를 고정합니다: 글 한 줄(비어 있어도 자리 유지), 상태 한 줄,
 * 동작 한 줄(cell.actions), 순서 한 줄(cell.order: 앞으로·뒤로). 칸이 좁아도 순서 버튼만 따로 떨어지지 않게 하려는 것입니다.
 *
 * - 순서: 칸을 끌어 옮기거나 "앞으로·뒤로"(키보드·휴대폰용).
 * - 올리기: 여러 장을 한 번에 고르거나 칸 위로 끌어다 놓습니다. 사진마다 칸에 상태를 보여 주고,
 *   처리가 끝난 사진부터 onReady로 넘겨 항목에 붙입니다. 실패한 사진은 모두 끝난 뒤 팝업 하나로 알립니다.
 * - 올리는 중·처리 중에는 창을 닫거나 새로고침하면 브라우저가 확인을 묻습니다(아직 항목에 붙지 않은 사진이라 이어 받을 수 없음).
 */
export type GridItem = { id: string; preview_url: string | null };

type Upload = { key: number; name: string; percent: number | null }; // -1: 대기, null: 처리 중

export function usePhotoUploads({ purpose, maxBytes, types, tooLarge, onReady }: {
  purpose: FilePurpose;
  maxBytes: number;
  types: string[];
  tooLarge: string;
  onReady: (info: FileInfo) => Promise<void>;
}) {
  const dialog = useDialog();
  const [uploads, setUploads] = useState<Upload[]>([]);
  const failures = useRef<string[]>([]);
  const running = useRef(0);
  const key = useRef(0);
  const ready = useRef(onReady);
  ready.current = onReady;

  const busy = uploads.length > 0;
  useEffect(() => {
    if (!busy) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [busy]);

  const finish = () => {
    running.current -= 1;
    if (running.current > 0 || failures.current.length === 0) return;
    const items = failures.current;
    failures.current = [];
    void dialog.error('사진을 올리지 못했습니다', fieldList(items));
  };

  const add = (files: File[]) => {
    for (const file of files) {
      // 브라우저가 형식을 모르는 사진(예: 일부 HEIC)은 type이 비어 있습니다. 그때는 관리 서버의 검사에 맡깁니다.
      if (file.type && !types.includes(file.type)) { failures.current.push(`${file.name}: 사진 파일이 아닙니다.`); continue; }
      if (file.size > maxBytes) { failures.current.push(`${file.name}: ${tooLarge}`); continue; }
      const k = ++key.current;
      running.current += 1;
      setUploads((u) => [...u, { key: k, name: file.name, percent: -1 }]);
      const set = (percent: number | null) => setUploads((u) => u.map((x) => (x.key === k ? { ...x, percent } : x)));
      uploadFile(file, purpose, set, () => set(null), () => set(-1))
        .then((info) => ready.current(info))
        .catch((err: unknown) => {
          if (signedOut(err)) return;
          failures.current.push(`${file.name}: ${err instanceof ApiError ? err.message : '파일을 처리하지 못했습니다.'}`);
        })
        .finally(() => { setUploads((u) => u.filter((x) => x.key !== k)); finish(); });
    }
    if (running.current === 0 && failures.current.length > 0) { running.current = 1; finish(); }
  };

  return { uploads, add };
}

/** "사진 올리기" 글자 버튼: 숨은 파일 칸을 엽니다. */
export function PickPhotos({ accept, onFiles, disabled }: { accept: string; onFiles: (files: File[]) => void; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const change = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length > 0) onFiles(files);
  };
  return (
    <>
      <input ref={input} type="file" accept={accept} multiple hidden onChange={change} />
      <button type="button" className="admin-text-button" disabled={disabled} onClick={() => input.current?.click()}>사진 올리기</button>
    </>
  );
}

export function PhotoGrid<T extends GridItem>({ items, uploads, onDropFiles, onMove, alt, wide = false, children }: {
  items: T[];
  uploads: Upload[];
  onDropFiles?: (files: File[]) => void;
  onMove: (from: number, to: number) => void;
  alt: (item: T) => string;
  /** 16:9 칸 (첫 화면 사진). 기본은 정사각형. */
  wide?: boolean;
  /** 칸 아래: 글과 동작 글자 버튼. 앞으로·뒤로는 여기서 붙입니다. */
  children: (item: T, index: number) => ReactNode;
}) {
  const dragging = useRef<number | null>(null);
  const [over, setOver] = useState(false);

  const dropOnGrid = (e: DragEvent) => {
    if (!onDropFiles || e.dataTransfer.files.length === 0) return;
    e.preventDefault();
    setOver(false);
    onDropFiles(Array.from(e.dataTransfer.files));
  };

  return (
    <ul
      className={wide ? `${styles.grid} ${styles.wide}` : styles.grid}
      data-over={over || undefined}
      onDragOver={(e) => { if (onDropFiles && e.dataTransfer.types.includes('Files')) { e.preventDefault(); setOver(true); } }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setOver(false); }}
      onDrop={dropOnGrid}
    >
      {items.map((item, i) => (
        <li
          key={item.id}
          className={styles.cell}
          draggable
          onDragStart={(e) => { dragging.current = i; e.dataTransfer.effectAllowed = 'move'; }}
          onDragOver={(e) => { if (dragging.current !== null) e.preventDefault(); }}
          onDrop={(e) => {
            if (dragging.current === null) return;
            e.preventDefault();
            e.stopPropagation();
            const from = dragging.current;
            dragging.current = null;
            if (from !== i) onMove(from, i);
          }}
          onDragEnd={() => { dragging.current = null; }}
        >
          <span className={styles.photo}>{item.preview_url && <img src={item.preview_url} alt={alt(item)} draggable={false} />}</span>
          {children(item, i)}
        </li>
      ))}
      {uploads.map((u) => (
        <li key={`up-${u.key}`} className={styles.cell}>
          <span className={styles.photo} />
          <p className={styles.caption}>{u.name}</p>
          <p className={styles.meta}>{u.percent === null ? '처리 중' : u.percent < 0 ? '대기 중' : uploadingLabel(u.percent)}</p>
          <span className={styles.actions} />
          <span className={styles.order} />
        </li>
      ))}
    </ul>
  );
}

/** 칸 아래 글 한 줄과 동작 줄. */
export const cell = styles;

/**
 * 칸 아래 글(설명·메모)을 그 자리에서 고칩니다. 비워 두면 빈 글로 저장합니다.
 * open/onOpen으로 화면이 "지금 어느 칸의 글을 고치는지"를 들고 있게 합니다. 고치는 동안 다른 칸의 동작과 올리기를 막기 위해서입니다.
 */
export function TextEdit({ label, value, onSave, disabled, open, onOpen }: {
  label: string;
  value: string;
  onSave: (text: string) => Promise<boolean>;
  disabled?: boolean;
  open: boolean;
  onOpen: (open: boolean) => void;
}) {
  const [text, setText] = useState(value);
  const [saving, setSaving] = useState(false);
  if (!open) {
    return <button type="button" className="admin-text-button" disabled={disabled} onClick={() => { setText(value); onOpen(true); }}>{label} 수정</button>;
  }
  const save = async () => {
    setSaving(true);
    const done = await onSave(text.trim());
    setSaving(false);
    if (done) onOpen(false);
  };
  return (
    <form className={styles.edit} onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <input aria-label={label} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
      <span>
        <button type="submit" className="admin-text-button" disabled={saving}>{saving ? '저장 중' : '저장'}</button>
        <button type="button" className="admin-text-button" disabled={saving} onClick={() => onOpen(false)}>취소</button>
      </span>
    </form>
  );
}
