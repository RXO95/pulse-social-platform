/**
 * Shared utility helpers for Pulse Mobile
 */

/**
 * Convert a date string into a human-readable "time ago" label.
 * Mirrors the web frontend's timeAgo function exactly.
 */
export function timeAgo(dateString) {
  if (!dateString) return "";
  const now = new Date();
  // Backend stores UTC datetimes without Z suffix — force UTC parsing
  let raw = String(dateString);
  if (!raw.endsWith("Z") && !raw.includes("+")) raw += "Z";
  const date = new Date(raw);
  const seconds = Math.floor((now - date) / 1000);
  if (seconds < 0) return "now";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
