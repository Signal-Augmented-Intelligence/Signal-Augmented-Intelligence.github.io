import { Fragment, type Mark, type Node as PMNode, Schema, Slice } from 'prosemirror-model';
import { MARK_COLORS, type MarkColor, serializeRuns, type TextRun, textRuns } from '@/lib/text-marks';

/**
 * 공지 편집기(components/MarkEditor)의 문서와 저장 글 사이 변환 (guideline "내용 표기").
 * 문서는 저장 표기와 1:1입니다: 줄 하나 = 문단 하나, 글자 표시는 굵게와 두 가지 색뿐. 읽기는 공개 사이트와 같은 textRuns,
 * 쓰기는 text-marks의 serializeRuns(이스케이프 포함)로 합니다. 화면 없이 시험할 수 있게 DOM을 쓰지 않습니다.
 */
const COLORS = Object.keys(MARK_COLORS) as MarkColor[];
export const markSchema = new Schema({
  nodes: {
    doc: { content: 'paragraph+' },
    paragraph: { content: 'text*', parseDOM: [{ tag: 'p' }], toDOM: () => ['p', 0] },
    text: {},
  },
  marks: {
    bold: { parseDOM: [{ tag: 'strong' }], toDOM: () => ['strong', 0] },
    color: {
      attrs: { color: {} },
      parseDOM: [{ tag: 'span[data-mark-color]', getAttrs: (el) => {
        const c = (el as HTMLElement).dataset.markColor as MarkColor;
        return COLORS.includes(c) ? { color: c } : false;
      } }],
      toDOM: (m) => ['span', { 'data-mark-color': m.attrs.color, style: `color: ${MARK_COLORS[m.attrs.color as MarkColor]}` }, 0],
    },
  },
});

/** 저장 글 → 문서. 읽기는 공개 사이트와 같은 textRuns로 합니다. */
export function toDoc(value: string): PMNode {
  const lines = value.split('\n').map((line) => {
    const nodes = textRuns(line).filter((r) => r.text).map((r) => {
      const marks: Mark[] = [];
      if (r.bold) marks.push(markSchema.marks.bold.create());
      if (r.color) marks.push(markSchema.marks.color.create({ color: r.color }));
      return markSchema.text(r.text, marks);
    });
    return markSchema.nodes.paragraph.create(null, nodes);
  });
  return markSchema.nodes.doc.create(null, lines);
}

/** 한 줄의 조각들. */
export function lineRuns(p: PMNode): TextRun[] {
  const runs: TextRun[] = [];
  p.forEach((n) => {
    const bold = n.marks.some((m) => m.type === markSchema.marks.bold) ? true : undefined;
    const color = n.marks.find((m) => m.type === markSchema.marks.color)?.attrs.color as MarkColor | undefined;
    runs.push({ text: n.text ?? '', ...(bold ? { bold } : {}), ...(color ? { color } : {}) });
  });
  return runs;
}

/** 문서 → 저장 글. */
export function toValue(doc: PMNode): string {
  const lines: string[] = [];
  doc.forEach((p) => lines.push(serializeRuns(lineRuns(p))));
  return lines.join('\n');
}

/** 이 편집기에서 복사한 것이 아니면 글자만 붙여 넣습니다(다른 색·서식·링크가 들어오지 않게). */
export function plainPaste(slice: Slice, fromEditor: boolean): Slice {
  if (fromEditor) return slice;
  const text = slice.content.textBetween(0, slice.content.size, '\n', '\n');
  const paras = text.split(/\r?\n/).map((line) => markSchema.nodes.paragraph.create(null, line ? markSchema.text(line) : null));
  return new Slice(Fragment.from(paras), 1, 1);
}
