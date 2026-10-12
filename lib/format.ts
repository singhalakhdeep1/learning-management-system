// Formatting helpers that are safe to use from both server and client components.

export function money(value: number): string {
  return value === 0 ? 'Free' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export function formatDuration(seconds: number): string {
  if (!seconds) return '';
  const minutes = Math.max(1, Math.round(seconds / 60));
  return minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`;
}
