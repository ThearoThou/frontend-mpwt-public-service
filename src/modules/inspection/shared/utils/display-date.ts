/** Formats citizen-facing calendar dates consistently as DD/MM/YYYY. */
export function formatDisplayDate (value: string | Date | null | undefined): string {
  if (!value) {
    return '—'
  }
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.valueOf())) {
    return '—'
  }
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Phnom_Penh',
    year: 'numeric',
  }).format(date)
}
