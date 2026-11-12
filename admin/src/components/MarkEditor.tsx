'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { baseKeymap, splitBlock, toggleMark } from 'prosemirror-commands';
import { history, redo, undo } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import { type Mark } from 'prosemirror-model';
import { EditorState, Plugin } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { MARK_COLORS, type MarkColor } from '@/lib/text-marks';
import { markSchema as schema, plainPaste, toDoc, toValue } from '@admin/lib/markDoc';
import styles from './MarkEditor.module.css';

/**
 * 공지 내용 편집기 (guideline "내용 표기"). 글자를 고르면 [굵게]·[파랑]·[빨강]·[색 없음]이 뜹니다. Ctrl/⌘+B도 됩니다.
 * 저장하는 값은 HTML이 아니라 표기 글입니다(변환은 lib/markDoc). 붙여 넣기는 이 편집기에서 복사한 것만 표시를 지키고,
 * 그 밖은 글자만 받습니다.
 */

type Menu = { left: number; top: number; bold: boolean; color: MarkColor | null } | null;

export function MarkEditor({ label, optional, name, value, onChange }: {
  label: string; optional?: boolean; name: string; value: string; onChange: (value: string) => void;
}) {
  const id = useId();
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const last = useRef(value);
  const change = useRef(onChange);
  change.current = onChange;
  const [menu, setMenu] = useState<Menu>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const bold = toggleMark(schema.marks.bold);
    let fromEditor = false;
    const menuPlugin = new Plugin({
      view: () => ({
        update: (v) => {
          const { from, to, empty } = v.state.selection;
          if (empty || !v.hasFocus() || v.composing) { setMenu(null); return; }
          const box = el.getBoundingClientRect();
          const end = v.coordsAtPos(to);
          const start = v.coordsAtPos(from);
          const marks: Mark[] = [];
          v.state.doc.nodesBetween(from, to, (n) => { if (n.isText) marks.push(...n.marks); });
          const color = marks.find((m) => m.type === schema.marks.color)?.attrs.color ?? null;
          setMenu({ left: Math.max(0, Math.min(start.left, end.left) - box.left), top: Math.max(start.bottom, end.bottom) - box.top + 6,
            bold: schema.marks.bold.isInSet(marks) !== undefined, color });
        },
        destroy: () => setMenu(null),
      }),
    });
    const v = new EditorView(el, {
      state: EditorState.create({ doc: toDoc(value), plugins: [
        history(),
        keymap({ 'Mod-b': bold, 'Mod-z': undo, 'Shift-Mod-z': redo, 'Mod-y': redo, 'Shift-Enter': splitBlock }),
        keymap(baseKeymap),
        menuPlugin,
      ] }),
      attributes: { role: 'textbox', 'aria-multiline': 'true', 'aria-labelledby': `${id}-label`, class: styles.editor },
      handleDOMEvents: {
        paste: (_, e) => { fromEditor = (e as ClipboardEvent).clipboardData?.getData('text/html').includes('data-pm-slice') ?? false; return false; },
        blur: () => { setMenu(null); return false; },
      },
      transformPasted: (slice) => plainPaste(slice, fromEditor),
      dispatchTransaction(this: EditorView, tr) {
        const next = this.state.apply(tr);
        this.updateState(next);
        if (tr.docChanged) {
          const text = toValue(next.doc);
          last.current = text;
          change.current(text);
        }
      },
    });
    view.current = v;
    return () => { v.destroy(); view.current = null; };
    // 편집기는 한 번만 만듭니다. 바깥에서 값이 바뀌면 아래 효과가 문서를 갈아 끼웁니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 임시 보관 복원·취소처럼 바깥에서 값이 바뀐 경우.
  useEffect(() => {
    const v = view.current;
    if (!v || value === last.current) return;
    last.current = value;
    v.updateState(EditorState.create({ doc: toDoc(value), plugins: v.state.plugins }));
  }, [value]);

  const run = (fn: (v: EditorView) => void) => { const v = view.current; if (v) { fn(v); v.focus(); } };
  const setColor = (color: MarkColor | null) => run((v) => {
    const { from, to } = v.state.selection;
    let tr = v.state.tr.removeMark(from, to, schema.marks.color);
    if (color) tr = tr.addMark(from, to, schema.marks.color.create({ color }));
    v.dispatch(tr);
  });

  return (
    <div className="admin-field">
      <span id={`${id}-label`} onClick={() => view.current?.focus()}>{label}{optional && <small> (선택)</small>}</span>
      <div className={styles.wrap}>
        <div ref={host} />
        {/* 오류 때 focusField가 이름으로 찾는 칸. 받은 초점은 편집기로 넘깁니다. */}
        <textarea name={name} className={styles.proxy} value={value} readOnly tabIndex={-1} aria-hidden="true" onFocus={() => view.current?.focus()} />
        {menu && <div className={styles.menu} role="toolbar" aria-label="글자 표시" style={{ left: menu.left, top: menu.top }}
          onMouseDown={(e) => e.preventDefault()}>
          <button type="button" aria-pressed={menu.bold} className={styles.bold} onClick={() => run((v) => toggleMark(schema.marks.bold)(v.state, v.dispatch))}>굵게</button>
          <button type="button" aria-pressed={menu.color === 'blue'} style={{ color: MARK_COLORS.blue }} onClick={() => setColor('blue')}>파랑</button>
          <button type="button" aria-pressed={menu.color === 'red'} style={{ color: MARK_COLORS.red }} onClick={() => setColor('red')}>빨강</button>
          <button type="button" onClick={() => setColor(null)}>색 없음</button>
        </div>}
      </div>
    </div>
  );
}
