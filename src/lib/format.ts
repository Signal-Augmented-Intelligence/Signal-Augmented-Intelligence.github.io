/** Displays known date parts in YYYY.MM[.DD] form without inventing missing parts. */
export function formatDate(value: string, style: 'full' | 'day' | 'month' = 'full'): string {
  if (!/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(value)) return value;
  const [year, month, day] = value.split('-');
  if (!month) return year;
  if (!day || style === 'month') return `${year}.${month}`;
  return `${year}.${month}.${day}`;
}

/** `lang="ko"` for text that contains Hangul (the page itself is `lang="en"`), so screen readers and line breaking treat it as Korean. */
export function langOf(text: string): 'ko' | undefined {
  return /[ㄱ-ㆎ가-힣]/.test(text) ? 'ko' : undefined;
}
