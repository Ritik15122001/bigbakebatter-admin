/**
 * Helpers shared by the sales pages (Orders, Payments, Customers, Enquiries).
 * Plain functions only — components live in ext-sales.jsx.
 */
import { useMemo, useState } from 'react';
import { toast } from './toast.jsx';

/** Last 10 digits of an Indian phone number ("+91 98200 11223" → "9820011223"). */
export const phoneDigits = (phone = '') => String(phone).replace(/\D/g, '').slice(-10);
export const telHref = (phone) => (phoneDigits(phone) ? `tel:+91${phoneDigits(phone)}` : undefined);
export const waHref = (phone, text = '') => {
  const d = phoneDigits(phone);
  if (!d) return undefined;
  return `https://wa.me/91${d}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
};
export const mailHref = (email, subject = '') => (email ? `mailto:${email}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}` : undefined);
export const mapsHref = (addr) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr || '')}`;

export async function copyText(text, label = 'Copied') {
  try {
    await navigator.clipboard.writeText(String(text));
    toast.success(label, String(text).length > 60 ? `${String(text).slice(0, 60)}…` : String(text));
  } catch {
    toast.error('Could not copy', 'Your browser blocked clipboard access.');
  }
}

/** Day start in local time. */
export const startOfDay = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
/** Monday-start week containing `d`. */
export const startOfWeek = (d = new Date()) => { const s = startOfDay(d); return addDays(s, -((s.getDay() + 6) % 7)); };

/**
 * Orders store the delivery date as text ("20 August 2026" / "14 Oct 2026").
 * Returns a local-midnight Date or null when it can't be read.
 */
export function parseDeliver(text) {
  if (!text) return null;
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return null;
  return startOfDay(d);
}

/** 'today' | 'tomorrow' | 'week' (later this week) | 'upcoming' | 'past' | '' */
export function deliveryBucket(text, now = new Date()) {
  const d = parseDeliver(text);
  if (!d) return '';
  const today = startOfDay(now);
  const diff = Math.round((d - today) / 86400000);
  if (diff < 0) return 'past';
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (d < addDays(startOfWeek(now), 7)) return 'week';
  return 'upcoming';
}

export const inThisWeek = (date, now = new Date()) => {
  if (!date) return false;
  const d = new Date(date);
  const s = startOfWeek(now);
  return d >= s && d < addDays(s, 7);
};

/** Corporate enquiries prefix the note with "Company: X. …" — split it out. */
export function splitCompany(note = '') {
  const m = /^Company:\s*([^.\n]*)\.?\s*/i.exec(note || '');
  if (!m) return { company: '', brief: note || '' };
  return { company: m[1].trim(), brief: note.slice(m[0].length).trim() };
}

export const iso = (v) => (v ? new Date(v).toISOString() : '');
export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Search + select filters kept by the page (so CSV export and stats can use the filtered rows).
 * config: { search: row → string, filters: [{ key, label, options, test(row, value) }] }
 */
export function useTableFilters(rows, config, initial = {}) {
  const [q, setQ] = useState(initial.q || '');
  const [values, setValues] = useState(initial.values || {});
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (rows || []).filter((r) => {
      if (needle && config.search && !String(config.search(r)).toLowerCase().includes(needle)) return false;
      return (config.filters || []).every((f) => !values[f.key] || f.test(r, values[f.key]));
    });
    // config is rebuilt each render; its functions depend only on the row
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, values]);
  const active = Object.values(values).filter(Boolean).length + (q.trim() ? 1 : 0);
  return {
    q, setQ, values, active, rows: filtered,
    setValue: (key, v) => setValues((s) => ({ ...s, [key]: v })),
    clear: () => { setQ(''); setValues({}); },
  };
}
