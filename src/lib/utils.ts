export function cn(...classes: (string | undefined | null | boolean)[]) {
  return classes.filter(Boolean).join(' ');
}

export function getPosterUrl(path: string | null, size: string = 'w500'): string {
  if (!path) {
    // Return a beautiful elegant placeholder SVG data URI or simple gradient
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450"><rect width="300" height="450" fill="%231e293b"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="20" fill="%2364748b">No Poster Available</text></svg>`;
  }
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export function getBackdropUrl(path: string | null, size: string = 'w1280'): string {
  if (!path) {
    return '';
  }
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function formatCurrency(amount?: number): string {
  if (!amount) return 'N/A';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

export function formatRuntime(minutes?: number | null): string {
  if (!minutes) return 'N/A';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function getEpisodeCode(season: number, episode: number): string {
  const s = season < 10 ? `0${season}` : season;
  const e = episode < 10 ? `0${episode}` : episode;
  return `S${s}E${e}`;
}

export function transformPassword(rawPass: string): string {
  if (rawPass.length < 6) {
    return `${rawPass}_cinetrack_secure`;
  }
  return rawPass;
}
