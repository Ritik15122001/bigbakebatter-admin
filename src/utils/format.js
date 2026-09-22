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
