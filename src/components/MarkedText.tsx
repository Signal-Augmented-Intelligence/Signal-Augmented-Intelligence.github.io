import { Fragment, type ReactNode } from 'react';
import { MARK_COLORS, splitLinks, textRuns } from '@/lib/text-marks';

/** Links are underlined here so blue text ({blue|…}, the same accent color) is not mistaken for a link. */
const LINK_STYLE = { textDecoration: 'underline', textUnderlineOffset: '0.18em' } as const;

/**
 * Draws stored plain text with its marks (lib/text-marks): **bold** becomes <strong>, {blue|…}/{red|…} a colored span,
 * web addresses links. Only React elements, never HTML from the text.
 * Put it inside an element with `white-space: pre-line` to keep line breaks. The 관리 화면 can use it for its preview.
 */
export function MarkedText({ text }: { text: string }) {
  return (
    <>
      {textRuns(text).map((run, i) => {
        let node: ReactNode = splitLinks(run.text).map((p, k) => p.href
          ? <a key={k} href={p.href} target="_blank" rel="noopener noreferrer" style={LINK_STYLE}>{p.text}</a>
          : <Fragment key={k}>{p.text}</Fragment>);
        if (run.bold) node = <strong>{node}</strong>;
        if (run.color) node = <span style={{ color: MARK_COLORS[run.color] }}>{node}</span>;
        return <Fragment key={i}>{node}</Fragment>;
      })}
    </>
  );
}
