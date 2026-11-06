import type { Notice } from './content';

export const NOTICE_KINDS: Record<Notice['kind'], string> = {
  seminar: 'Seminar', conference: 'Conference', recruitment: 'Recruitment', other: 'Notice',
};

/** Days a pinned notice stays on top after its last date (presentation, paper deadline or registration). */
export const PIN_GRACE_DAYS = 7;

/** Full dates only (YYYY-MM-DD); a partial date cannot end a pin. */
const FULL_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Whether a notice is still pinned on `today` (YYYY-MM-DD, viewer's local day).
 * The pin ends PIN_GRACE_DAYS after the latest of its dates; with no full date it stays until unpinned.
 */
export function isPinned(n: Notice, today: string): boolean {
  if (!n.pinned) return false;
  const last = [n.event_date, n.paper_deadline, n.registration_deadline].filter((d) => FULL_DATE.test(d)).sort().pop();
  if (!last) return true;
  const end = new Date(`${last}T00:00:00`);
  end.setDate(end.getDate() + PIN_GRACE_DAYS);
  return new Date(`${today}T00:00:00`) <= end;
}

/** Pinned first (newest post first among them), then the rest newest first. */
export function orderNotices(notices: Notice[], today: string): (Notice & { pinnedNow: boolean })[] {
  return notices
    .map((n) => ({ ...n, pinnedNow: isPinned(n, today) }))
    .sort((a, b) => Number(b.pinnedNow) - Number(a.pinnedNow) || b.date.localeCompare(a.date));
}

/** A title to show even when the name was left empty. */
export const noticeTitle = (n: Notice) => n.title || n.host || NOTICE_KINDS[n.kind];

export function localDay(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
