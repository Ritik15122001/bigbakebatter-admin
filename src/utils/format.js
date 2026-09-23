export function money(n) {
  return '₹' + Number(Math.round(n)).toLocaleString('en-IN');
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function fmtDateShort(d) {
  return `${d.getDate()} ${MON[d.getMonth()]}`;
}

function toDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function fmtDate(value) {
  const d = toDate(value);
  return d ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}

export function fmtTime(value) {
  const d = toDate(value);
  if (!d) return '—';
  // en-GB renders the meridiem lowercase; the admin tables read better uppercased
  return d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase();
}

export function fmtDateTime(value) {
  const d = toDate(value);
  return d ? `${fmtDate(d)}, ${fmtTime(d)}` : '—';
}

/** "2m ago", "3h ago", "5d ago" — falls back to a short date beyond a week. */
export function fmtRelative(value) {
  const d = toDate(value);
  if (!d) return '—';
  const seconds = Math.round((Date.now() - d.getTime()) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return fmtDateShort(d);
}
