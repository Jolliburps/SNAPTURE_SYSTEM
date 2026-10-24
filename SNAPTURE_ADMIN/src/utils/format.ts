// Noon local time avoids UTC date-only parsing shifting a displayed day.
export function formatDate(date: string, includeWeekday = false) {
  const value = new Date(`${date}T12:00:00`)
  const formatted = new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  }).format(value)
  if (!includeWeekday) return formatted
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(value)
  return `${formatted} (${weekday})`
}
