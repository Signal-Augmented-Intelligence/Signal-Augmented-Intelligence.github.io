'use client';

import { type ChangeEvent, type ReactNode, useId, useState } from 'react';
import styles from './Field.module.css';

/**
 * 입력 칸 묶음. 라벨은 위, 선택 항목과 제한은 라벨 뒤 괄호에 짧게: "PDF (선택, 100 MB 이하)" (규칙 문서 1부 4장).
 * 칸 아래 안내 문장은 두지 않습니다(1장 5). 오류는 칸에 표시하지 않고 오류 팝업으로 알립니다.
 * group: 안에 버튼·미리보기가 있어 <label>로 감싸면 안 되는 칸(FileUpload). <label>은 안쪽 어디를 눌러도 파일 선택 창을 엽니다.
 */
export function Field({ label, optional, limit, group, children }: { label: string; optional?: boolean; limit?: string; group?: boolean; children: ReactNode }) {
  const note = [optional ? '선택' : '', limit ?? ''].filter(Boolean).join(', ');
  const id = useId();
  if (group) {
    return (
      <div className="admin-field" role="group" aria-labelledby={id}>
        <span id={id}>{label}{note && <small> ({note})</small>}</span>
        {children}
      </div>
    );
  }
  return (
    <label className="admin-field">
      <span>{label}{note && <small> ({note})</small>}</span>
      {children}
    </label>
  );
}

/** 파일 선택 칸: "파일 선택" 버튼과 고른 파일 이름. 브라우저 기본 버튼 글자(언어별로 다름)를 쓰지 않습니다. */
export function FilePicker({ name, accept, multiple, onFiles }: { name: string; accept?: string; multiple?: boolean; onFiles?: (files: File[]) => void }) {
  const [label, setLabel] = useState('');
  const change = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setLabel(files.length === 0 ? '' : files.length === 1 ? files[0].name : `${files.length}개 파일`);
    onFiles?.(files);
  };
  return (
    <span className={styles.file}>
      <input type="file" name={name} accept={accept} multiple={multiple} onChange={change} />
      <span className={styles.button}>파일 선택</span>
      <span className={styles.name}>{label || '선택한 파일 없음'}</span>
    </span>
  );
}

/** 오류 팝업을 닫은 뒤 첫 번째 틀린 칸으로 커서를 옮깁니다. */
export function focusField(form: HTMLFormElement | null, names: string[]) {
  const first = names.map((n) => form?.elements.namedItem(n)).find((el): el is HTMLElement => el instanceof HTMLElement);
  first?.focus();
}
