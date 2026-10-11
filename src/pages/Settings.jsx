import { useEffect, useState } from 'react';
import { settingsService } from '../services/settingsService';
import { useUiStore } from '../store/uiStore';

export default function Settings() {
  const pushToast = useUiStore((s) => s.pushToast);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    settingsService
      .get()
      .then((s) => setForm({
        name: s.name || '', since: s.since || '', phones: (s.phones || []).join(', '), email: s.email || '',
        addressFull: s.addressFull || '', mapsLink: s.mapsLink || '', mapsEmbedSrc: s.mapsEmbedSrc || '',
        facebook: s.social?.facebook || '', twitter: s.social?.twitter || '', instagram: s.social?.instagram || '',
      }))
      .catch((e) => pushToast({ title: 'Failed to load settings', subtitle: e.message, kind: 'err' }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!form) return <div className="a-panel a-empty"><p className="muted">Loading…</p></div>;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await settingsService.update({
        name: form.name,
        since: Number(form.since) || undefined,
        phones: form.phones.split(',').map((p) => p.trim()).filter(Boolean),
        email: form.email.trim(),
        addressFull: form.addressFull,
        mapsLink: form.mapsLink,
        mapsEmbedSrc: form.mapsEmbedSrc,
        social: { facebook: form.facebook, twitter: form.twitter, instagram: form.instagram },
      });
      pushToast({ title: 'Settings saved', kind: 'ok' });
    } catch (err) {
      pushToast({ title: 'Could not save settings', subtitle: err.message, kind: 'err' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="a-panel" onSubmit={save}>
      <div className="a-panel-head"><h3>Business details</h3></div>
      <div className="form-grid two" style={{ padding: 'var(--s-5)' }}>
        <div className="field"><label>Business name</label><input className="input" value={form.name} onChange={set('name')} /></div>
        <div className="field"><label>Baking since (year)</label><input className="input" type="number" value={form.since} onChange={set('since')} /></div>
        <div className="field"><label>Phone numbers</label><input className="input" value={form.phones} onChange={set('phones')} placeholder="9899660338, 9650632501" /><span className="field-hint">Comma separated. The first one shows in the header.</span></div>
        <div className="field"><label>Email</label><input className="input" type="email" value={form.email} onChange={set('email')} /></div>
        <div className="field span2"><label>Address</label><textarea className="textarea" rows={2} value={form.addressFull} onChange={set('addressFull')} /></div>
        <div className="field"><label>Google Maps link</label><input className="input" value={form.mapsLink} onChange={set('mapsLink')} /></div>
        <div className="field"><label>Google Maps embed URL</label><input className="input" value={form.mapsEmbedSrc} onChange={set('mapsEmbedSrc')} /></div>
        <div className="field"><label>Instagram</label><input className="input" value={form.instagram} onChange={set('instagram')} /></div>
        <div className="field"><label>Facebook</label><input className="input" value={form.facebook} onChange={set('facebook')} /></div>
        <div className="field"><label>X (Twitter)</label><input className="input" value={form.twitter} onChange={set('twitter')} /></div>
        <div className="span2"><button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</button></div>
      </div>
    </form>
  );
}
