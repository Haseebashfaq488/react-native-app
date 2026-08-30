/** Shared formatting helpers. */

/** "10m ago", "2h ago", "1d ago" — relative time for ticket cards. */
export function timeAgo(iso: string | Date): string {
  const then = typeof iso === "string" ? new Date(iso) : iso;
  const seconds = Math.max(0, Math.floor((Date.now() - then.getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return then.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/** "10:42 AM" style timestamp for chat bubbles. */
export function clockTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Display id as "#TCK-0008" per the design. */
export function ticketTag(id: number): string {
  return `#TCK-${String(id).padStart(4, "0")}`;
}
