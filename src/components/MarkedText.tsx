import { Fragment } from 'react';
import { splitLinks, textRuns } from '@/lib/text-marks';

/**
 * Draws stored plain text with its marks (lib/text-marks): **bold** becomes <strong>, web addresses become links.
 * Only React elements, never HTML from the text. Put it inside an element with `white-space: pre-line` to keep line breaks.
 * The 관리 화면 can use the same component for its preview.
 */
export function MarkedText({ text }: { text: string }) {
  return (
    <>
      {textRuns(text).map((run, i) => {
        const parts = splitLinks(run.text).map((p, k) => p.href
          ? <a key={k} href={p.href} target="_blank" rel="noopener noreferrer">{p.text}</a>
          : <Fragment key={k}>{p.text}</Fragment>);
        return run.bold ? <strong key={i}>{parts}</strong> : <Fragment key={i}>{parts}</Fragment>;
      })}
    </>
  );
}
