/** Non-component helpers for the ext-web kit pieces (kept separate for fast refresh). */
import { useEffect } from 'react';

export const STOREFRONT_URL = (import.meta.env.VITE_STOREFRONT_URL || 'http://localhost:5301').replace(/\/$/, '');

/** Internal path ("/shop"), http(s) URL, mailto: or tel: — same rule as the API (mailto/tel only where allowed). */
export const isValidLink = (v, { allowMailTel = false } = {}) => {
  const s = String(v || '').trim();
  if (!s) return true;
  if (s.startsWith('/') || /^https?:\/\/[^\s]+$/i.test(s)) return true;
  return allowMailTel && /^(mailto|tel):/i.test(s);
};

const ICON_LABELS = {
  veg: 'Pure-veg mark', insta: 'Instagram', fb: 'Facebook', tw: 'X / Twitter', cal: 'Calendar', pkg: 'Package',
  msg: 'Message', eggoff: 'Eggless', aupright: 'Arrow', gem: 'Gem', pin: 'Location pin', percent: 'Percent',
};
export const iconLabel = (n) => ICON_LABELS[n] || (n ? n.charAt(0).toUpperCase() + n.slice(1) : '');

/** 0–4 score + label for a password strength hint. */
export function passwordStrength(pw = '') {
  if (!pw) return { score: 0, label: '', tone: 'gray' };
  let s = 0;
  if (pw.length >= 8) s += 1;
  if (pw.length >= 12) s += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s += 1;
  if (/\d/.test(pw)) s += 0.5;
  if (/[^A-Za-z0-9]/.test(pw)) s += 0.5;
  const score = Math.min(4, Math.floor(s));
  return [
    { score: 0, label: 'Too weak', tone: 'red' },
    { score: 1, label: 'Weak', tone: 'red' },
    { score: 2, label: 'Fair', tone: 'amber' },
    { score: 3, label: 'Good', tone: 'green' },
    { score: 4, label: 'Strong', tone: 'green' },
  ][score];
}

export const moveItem = (list, i, dir) => {
  const j = i + dir;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
};

/** Copy text to the clipboard with a fallback for non-secure contexts. */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

/** Warn before closing the tab while there are unsaved edits. */
export function useUnloadGuard(dirty) {
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
}
