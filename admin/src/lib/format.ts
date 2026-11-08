/** 2026-10-26T10:30:00+09:00 → 2026.10.26 10:30 (보는 사람의 시간대) */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 2026-10-26 → 2026.10.26, 2026-10 → 2026.10 */
export function formatDay(date: string): string {
  return date.replaceAll('-', '.');
}
