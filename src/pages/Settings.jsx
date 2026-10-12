import { useCallback, useEffect, useState } from 'react';
import { settingsService } from '../services/settingsService';
import { useUiStore } from '../store/uiStore';

const DEFAULT_SLOTS = ['10 AM – 12 PM', '12 PM – 2 PM', '2 PM – 4 PM', '4 PM – 6 PM', '6 PM – 8 PM'];

const toForm = (s) => ({
  name: s.name || '', since: s.since ?? '', phones: (s.phones || []).join(', '), email: s.email || '',
  addressFull: s.addressFull || '', mapsLink: s.mapsLink || '', mapsEmbedSrc: s.mapsEmbedSrc || '',
  facebook: s.social?.facebook || '', twitter: s.social?.twitter || '', instagram: s.social?.instagram || '',
  deliveryFee: s.deliveryFee ?? 49, freeDeliveryAbove: s.freeDeliveryAbove ?? 1500,
  slots: (Array.isArray(s.slots) && s.slots.length ? s.slots : DEFAULT_SLOTS).join('\n'),
  sameDayCutoffHour: s.sameDayCutoffHour ?? 14, hours: s.hours || '',
});

const hourLabel = (h) => {
  const n = Number(h);
  if (!Number.isInteger(n) || n < 0 || n > 23) return '';
  const suffix = n < 12 ? 'AM' : 'PM';
  const twelve = n % 12 === 0 ? 12 : n % 12;
  return `${twelve} ${suffix}`;
};

export default function Settings() {
  const pushToast = useUiStore((s) => s.pushToast);
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setError('');
    settingsService
      .get()
      .then((s) => setForm(toForm(s || {})))
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <div className="a-panel a-empty">
        <p className="muted">Could not load settings: {error}</p>
        <button className="btn btn-outline btn-sm" onClick={load}>Try again</button>
      </div>
    );
  }
  if (!form) return <div className="a-panel a-empty"><p className="muted">Loading…</p></div>;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    if (saving) return;
    const slots = form.slots.split('\n').map((s) => s.trim()).filter(Boolean);
    const cutoff = Number(form.sameDayCutoffHour);
    const fee = Number(form.deliveryFee);
    const freeAbove = Number(form.freeDeliveryAbove);
    if (!slots.length) return pushToast({ title: 'Add at least one delivery slot', kind: 'err' });
    if (!Number.isInteger(cutoff) || cutoff < 0 || cutoff > 23) return pushToast({ title: 'Same-day cut-off must be an hour from 0 to 23', kind: 'err' });
    if (!(fee >= 0) || !(freeAbove >= 0)) return pushToast({ title: 'Delivery amounts cannot be negative', kind: 'err' });

    setSaving(true);
    try {
      const saved = await settingsService.update({
        name: form.name.trim(),
        since: form.since === '' ? undefined : Number(form.since) || undefined,
        phones: form.phones.split(',').map((p) => p.trim()).filter(Boolean),
        email: form.email.trim(),
        addressFull: form.addressFull,
        mapsLink: form.mapsLink.trim(),
        mapsEmbedSrc: form.mapsEmbedSrc.trim(),
        deliveryFee: fee,
        freeDeliveryAbove: freeAbove,
        slots,
        sameDayCutoffHour: cutoff,
        hours: form.hours,
        social: { facebook: form.facebook.trim(), twitter: form.twitter.trim(), instagram: form.instagram.trim() },
      });
      if (saved && typeof saved === 'object') setForm(toForm(saved));
      pushToast({ title: 'Settings saved', kind: 'ok' });
    } catch (err) {
      pushToast({ title: 'Could not save settings', subtitle: err.message, kind: 'err' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="stack gap-5" onSubmit={save}>
      <div className="a-panel">
        <div className="a-panel-head"><h3>Business details</h3></div>
        <div className="form-grid two a-form-pad">
          <div className="field"><label>Business name</label><input className="input" value={form.name} onChange={set('name')} /></div>
          <div className="field"><label>Baking since (year)</label><input className="input" type="number" inputMode="numeric" value={form.since} onChange={set('since')} /></div>
          <div className="field"><label>Phone numbers</label><input className="input" value={form.phones} onChange={set('phones')} placeholder="9899660338, 9650632501" /><span className="field-hint">Comma separated. The first one shows in the header.</span></div>
          <div className="field"><label>Email</label><input className="input" type="email" value={form.email} onChange={set('email')} /></div>
          <div className="field span2"><label>Address</label><textarea className="textarea" rows={2} value={form.addressFull} onChange={set('addressFull')} /></div>
          <div className="field span2"><label>Opening hours</label><input className="input" value={form.hours} onChange={set('hours')} placeholder="e.g. Open daily, 10 AM – 9 PM" /><span className="field-hint">Shown on the contact page and footer.</span></div>
          <div className="field"><label>Google Maps link</label><input className="input" value={form.mapsLink} onChange={set('mapsLink')} /></div>
          <div className="field"><label>Google Maps embed URL</label><input className="input" value={form.mapsEmbedSrc} onChange={set('mapsEmbedSrc')} /></div>
        </div>
      </div>

      <div className="a-panel">
        <div className="a-panel-head"><h3>Delivery</h3></div>
        <div className="form-grid two a-form-pad">
          <div className="field"><label>Delivery fee (₹)</label><input className="input" type="number" min="0" inputMode="numeric" value={form.deliveryFee} onChange={set('deliveryFee')} /></div>
          <div className="field"><label>Free delivery above (₹)</label><input className="input" type="number" min="0" inputMode="numeric" value={form.freeDeliveryAbove} onChange={set('freeDeliveryAbove')} /><span className="field-hint">Orders at or above this subtotal ship free. Set 0 to always charge the fee.</span></div>
          <div className="field">
            <label>Same-day order cut-off (hour, 0–23)</label>
            <input className="input" type="number" min="0" max="23" step="1" inputMode="numeric" value={form.sameDayCutoffHour} onChange={set('sameDayCutoffHour')} />
            <span className="field-hint">{hourLabel(form.sameDayCutoffHour) ? `Orders after ${hourLabel(form.sameDayCutoffHour)} can't pick today's date.` : '24-hour clock, e.g. 14 = 2 PM.'}</span>
          </div>
          <div className="field">
            <label>Delivery time slots</label>
            <textarea className="textarea" rows={5} value={form.slots} onChange={set('slots')} placeholder={DEFAULT_SLOTS.join('\n')} />
            <span className="field-hint">One slot per line, in the order customers should see them.</span>
          </div>
        </div>
      </div>

      <div className="a-panel">
        <div className="a-panel-head"><h3>Social links</h3></div>
        <div className="form-grid two a-form-pad">
          <div className="field"><label>Instagram</label><input className="input" value={form.instagram} onChange={set('instagram')} placeholder="https://instagram.com/…" /></div>
          <div className="field"><label>Facebook</label><input className="input" value={form.facebook} onChange={set('facebook')} placeholder="https://facebook.com/…" /></div>
          <div className="field"><label>X (Twitter)</label><input className="input" value={form.twitter} onChange={set('twitter')} placeholder="https://x.com/…" /></div>
        </div>
      </div>

      <div className="a-savebar">
        <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</button>
      </div>
    </form>
  );
}
