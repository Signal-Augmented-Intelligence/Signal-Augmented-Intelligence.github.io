'use client';

import { type ChangeEvent, type KeyboardEvent, useId, useRef } from 'react';
import { MarkedText } from '@/components/MarkedText';
import { BOLD_MARK } from '@/lib/text-marks';
import styles from './MarkedTextarea.module.css';

/**
 * 본문 칸 + [굵게] + 미리보기 (guideline "내용 표기"). 저장하는 글은 그대로 `**굵게**`이고, 미리보기는 공개 사이트와 같은
 * MarkedText로 그립니다(React 요소만, HTML 없음). 칸 이름 옆에 버튼이 있어 <label>로 감싸지 않고 htmlFor로 잇습니다.
 * 공개 사이트가 MarkedText로 그리는 칸에만 씁니다(지금은 공지 본문).
 */
export function MarkedTextarea({ label, optional, name, value, onChange, className }: {
  label: string; optional?: boolean; name: string; value: string; onChange: (value: string) => void; className?: string;
}) {
  const id = useId();
  const area = useRef<HTMLTextAreaElement>(null);

  /** 고른 글자를 `**`로 감쌉니다. 이미 감싸 있으면 풉니다. 고른 게 없으면 커서 자리에 `****`를 넣고 가운데에 둡니다. */
  const bold = () => {
    const el = area.current;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end } = el;
    const text = el.value;
    const m = BOLD_MARK.length;
    let from = start;
    let to = end;
    let insert: string;
    let select: [number, number];
    if (start >= m && text.slice(start - m, start) === BOLD_MARK && text.slice(end, end + m) === BOLD_MARK) {
      from = start - m; to = end + m;
      insert = text.slice(start, end);
      select = [from, from + insert.length];
    } else if (start === end) {
      insert = BOLD_MARK + BOLD_MARK;
      select = [start + m, start + m];
    } else if (text.slice(start, end).includes(BOLD_MARK)) {
      // 이미 굵은 글자가 섞여 있으면 고른 곳의 표시를 지웁니다(겹쳐 감싸면 짝이 엉킵니다). 다시 누르면 전체가 굵어집니다.
      insert = text.slice(start, end).split(BOLD_MARK).join('');
      select = [start, start + insert.length];
    } else {
      // 굵게는 한 줄 안에서만 맞으므로 줄마다 감쌉니다. 앞뒤 빈칸은 표시 밖에 둡니다.
      const lines = text.slice(start, end).split('\n').map((line) => /^(\s*)(.*?)(\s*)$/.exec(line) as RegExpExecArray);
      insert = lines.map(([line, lead, body, trail]) => (body ? `${lead}${BOLD_MARK}${body}${BOLD_MARK}${trail}` : line)).join('\n');
      const [, lead, body] = lines[0];
      // 한 줄이면 감싼 글자만, 여러 줄이면 바꾼 곳 전체를 고른 채로 둡니다.
      select = lines.length === 1 && body ? [start + lead.length + m, start + lead.length + m + body.length] : [start, start + insert.length];
    }
    el.focus();
    el.setSelectionRange(from, to);
    // insertText는 브라우저의 되돌리기(Ctrl/⌘+Z)에 남습니다. 지원하지 않으면 값을 직접 바꿉니다.
    const done = typeof document.execCommand === 'function' && document.execCommand('insertText', false, insert);
    if (!done || el.value === text) {
      onChange(text.slice(0, from) + insert + text.slice(to));
      requestAnimationFrame(() => area.current?.setSelectionRange(...select));
    } else {
      el.setSelectionRange(...select);
    }
  };

  const keyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      bold();
    }
  };

  return (
    <div className="admin-field">
      <div className={styles.head}>
        <label htmlFor={id}>{label}{optional && <small> (선택)</small>}</label>
        <button type="button" className={`admin-text-button ${styles.bold}`} aria-keyshortcuts="Control+B Meta+B"
          onMouseDown={(e) => e.preventDefault()} onClick={bold}>굵게</button>
      </div>
      <textarea ref={area} id={id} name={name} className={className} value={value}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)} onKeyDown={keyDown} />
      {value.trim() && <section className={styles.preview} aria-label="미리보기">
        <small>미리보기</small>
        <div className={styles.text}><MarkedText text={value} /></div>
      </section>}
    </div>
  );
}
