/**
 * Formats a date into a human-readable UTC timestamp in French format.
 * Example: "21 mai 2026, 21:01 UTC"
 */
export function formatTimestamp(date: Date = new Date()): string {
  return date.toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  }) + ' UTC';
}
