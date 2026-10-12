import { useCallback, useEffect, useState } from 'react';
import Icon from '../components/common/Icon';
import ImageField from '../components/common/ImageField';
import { settingsService } from '../services/settingsService';
import { useUiStore } from '../store/uiStore';
import { resolveImg } from '../utils/media';

const STOREFRONT_URL = import.meta.env.VITE_STOREFRONT_URL || 'http://localhost:5301';

// Must match FESTIVAL_PRESETS in the storefront (src/festive/presets.js).
const PRESETS = [{ value: 'diwali', label: 'Diwali', swatch: ['#4a120a', '#e2570a', '#f4b740'] }];

const EFFECTS = [
  { key: 'palette', label: 'Festive colours', hint: 'Saffron buttons, maroon announcement bar, gold-trimmed footer.' },
  { key: 'banner', label: 'Homepage festival banner', hint: 'Greeting, headline and button with flickering diyas, under the main slider.' },
  { key: 'garland', label: 'Marigold garland', hint: 'A toran of marigolds and bells hanging under the top menu on every page.' },
  { key: 'lights', label: 'Floating diya lights', hint: 'Soft glowing lights drifting up the screen.' },
  { key: 'fireworks', label: 'Fireworks', hint: 'Occasional small firework bursts at the top of the screen.' },
];

const DEFAULTS = {
  enabled: false, preset: 'diwali', startsAt: '', endsAt: '', greeting: 'Happy Diwali',
  headline: 'Light up the festival with something sweet',
  sub: 'Festive cakes, gifting boxes and mithai-inspired bakes — baked fresh and delivered across the city.',
  cta: 'Shop Diwali treats', ctaHref: '/shop', image: '', intensity: 'medium',
  effects: { palette: true, banner: true, garland: true, lights: true, fireworks: true },
};

const toDateInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const toForm = (f = {}) => ({
  ...DEFAULTS, ...f,
  startsAt: toDateInput(f.startsAt), endsAt: toDateInput(f.endsAt),
  effects: { ...DEFAULTS.effects, ...(f.effects || {}) },
});

/** Mirrors the storefront's "is it live right now" rule. */
function liveStatus(f) {
  if (!f.enabled) return { label: 'Off', tone: 'neutral', note: 'The website shows its normal design.' };
  const today = new Date().toISOString().slice(0, 10);
  if (f.startsAt && today < f.startsAt) return { label: 'Scheduled', tone: 'warn', note: `Turns on automatically on ${f.startsAt}.` };
  if (f.endsAt && today > f.endsAt) return { label: 'Ended', tone: 'neutral', note: `The end date (${f.endsAt}) has passed, so the website shows its normal design.` };
  return { label: 'Live now', tone: 'success', note: f.endsAt ? `Showing on the website until the end of ${f.endsAt}.` : 'Showing on the website until you turn it off.' };
}

export default function FestivalTheme() {
  const pushToast = useUiStore((s) => s.pushToast);
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(() => {
    setError('');
    settingsService
      .get()
      .then((s) => {
        const f = toForm(s.festival);
        setForm(f);
        setSaved(JSON.stringify(f));
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  if (error) {
    return (
      <div className="a-panel a-empty">
        <p className="muted">Could not load the festive theme: {error}</p>
        <button className="btn btn-outline btn-sm" onClick={load} style={{ marginTop: 12 }}>Try again</button>
      </div>
    );
  }
  if (!form) return <div className="a-panel a-empty"><p className="muted">Loading…</p></div>;

  const dirty = JSON.stringify(form) !== saved;
  const status = liveStatus(form);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setEffect = (k, v) => setForm({ ...form, effects: { ...form.effects, [k]: v } });
  const preset = PRESETS.find((p) => p.value === form.preset) || PRESETS[0];

  const save = async (next = form) => {
    if (next.startsAt && next.endsAt && next.startsAt > next.endsAt) {
      pushToast({ title: 'End date must be after the start date', kind: 'err' });
      return;
    }
    setSaving(true);
    try {
      const res = await settingsService.update({ festival: { ...next, startsAt: next.startsAt || null, endsAt: next.endsAt || null } });
      const f = toForm(res.festival);
      setForm(f);
      setSaved(JSON.stringify(f));
      pushToast({ title: f.enabled ? 'Festive theme saved' : 'Festive theme turned off', subtitle: liveStatus(f).note, kind: 'ok' });
    } catch (err) {
      pushToast({ title: 'Could not save', subtitle: err.message, kind: 'err' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="a-grid-2">
      <div className="stack gap-5">
        <div className="a-panel">
          <div className="a-panel-head">
            <h3>Festive theme</h3>
            <span className={`badge ${status.tone}`}>{status.label}</span>
          </div>
          <div className="stack gap-4" style={{ padding: 'var(--s-5)' }}>
            <p className="small muted">
              Dress the website up for a festival. Nothing changes on the website until you switch this on — and switching it off
              brings the normal design straight back.
            </p>
            <label className="check">
              <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
              <span><b>Show the festive theme on the website</b><br /><span className="muted">{status.note}</span></span>
            </label>
            <div className="form-grid two">
              <div className="field">
                <label>Festival</label>
                <select className="select" value={form.preset} onChange={set('preset')}>
                  {PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Effect strength</label>
                <select className="select" value={form.intensity} onChange={set('intensity')}>
                  <option value="subtle">Subtle</option>
                  <option value="medium">Medium</option>
                  <option value="festive">Full festive</option>
                </select>
              </div>
              <div className="field">
                <label>Start date (optional)</label>
                <input className="input" type="date" value={form.startsAt} onChange={set('startsAt')} />
              </div>
              <div className="field">
                <label>End date (optional)</label>
                <input className="input" type="date" value={form.endsAt} min={form.startsAt || undefined} onChange={set('endsAt')} />
                <span className="field-hint">Leave the dates empty to show it until you switch it off.</span>
              </div>
            </div>
          </div>
        </div>

        <div className="a-panel">
          <div className="a-panel-head"><h3>Effects</h3></div>
          <div className="stack gap-4" style={{ padding: 'var(--s-5)' }}>
            {EFFECTS.map((fx) => (
              <label className="check" key={fx.key}>
                <input type="checkbox" checked={!!form.effects[fx.key]} onChange={(e) => setEffect(fx.key, e.target.checked)} />
                <span><b>{fx.label}</b><br /><span className="muted">{fx.hint}</span></span>
              </label>
            ))}
            <span className="field-hint">Animations switch off automatically for visitors who have “reduce motion” turned on in their device settings.</span>
          </div>
        </div>
      </div>

      <div className="stack gap-5">
        <div className="a-panel">
          <div className="a-panel-head"><h3>Festival banner</h3></div>
          <div className="form-grid two" style={{ padding: 'var(--s-5)' }}>
            <div className="field"><label>Greeting</label><input className="input" value={form.greeting} onChange={set('greeting')} placeholder="Happy Diwali" /></div>
            <div className="field"><label>Button text</label><input className="input" value={form.cta} onChange={set('cta')} placeholder="Shop Diwali treats" /></div>
            <div className="field span2"><label>Headline</label><input className="input" value={form.headline} onChange={set('headline')} /></div>
            <div className="field span2"><label>Text</label><textarea className="textarea" rows={2} value={form.sub} onChange={set('sub')} /></div>
            <div className="field span2">
              <label>Button link</label>
              <input className="input" value={form.ctaHref} onChange={set('ctaHref')} placeholder="/shop or https://…" />
              <span className="field-hint">Tip: link to a category, e.g. /shop?category=Brownies</span>
            </div>
            <div className="field span2">
              <label>Banner photo (optional)</label>
              <ImageField value={form.image} onChange={(v) => setForm({ ...form, image: v })} onUploadingChange={setUploading} />
              <span className="field-hint">Without a photo the banner shows an illustrated rangoli.</span>
            </div>
          </div>

          <div style={{ padding: '0 var(--s-5) var(--s-5)' }}>
            <span className="field-hint" style={{ display: 'block', marginBottom: 8 }}>Preview</span>
            <div
              style={{
                display: 'grid', gridTemplateColumns: form.image ? '1.4fr 1fr' : '1fr', borderRadius: 12, overflow: 'hidden',
                background: `radial-gradient(rgba(255,209,102,.14) 1.2px, transparent 1.6px) 0 0/18px 18px, linear-gradient(135deg, ${preset.swatch[0]}, #2a0b06)`,
                color: '#f6dfbd', opacity: form.effects.banner ? 1 : 0.45,
              }}
            >
              <div style={{ padding: 18 }}>
                <div style={{ fontFamily: 'var(--f-script)', fontSize: 26, color: '#ffcf5c', lineHeight: 1 }}>{form.greeting}</div>
                <div style={{ color: '#fff4dc', fontWeight: 700, fontSize: 17, margin: '6px 0 4px' }}>{form.headline}</div>
                <div style={{ fontSize: 12.5, color: '#efd2a8' }}>{form.sub}</div>
                {form.cta && <span className="btn btn-sm" style={{ marginTop: 10, background: preset.swatch[1], color: '#fff' }}>{form.cta} <Icon name="aright" className="icon icon-sm" /></span>}
              </div>
              {form.image && <img src={resolveImg(form.image)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', minHeight: 120 }} />}
            </div>
            {!form.effects.banner && <span className="field-hint">The banner is switched off in Effects.</span>}
          </div>
        </div>

        <div className="a-panel">
          <div className="row gap-3 wrap" style={{ padding: 'var(--s-5)', alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={() => save()} disabled={saving || uploading || !dirty}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            {dirty && <button className="btn btn-ghost" onClick={() => setForm(JSON.parse(saved))} disabled={saving}>Undo</button>}
            <a className="btn btn-outline" href={STOREFRONT_URL} target="_blank" rel="noreferrer">
              <Icon name="external" className="icon icon-sm" />
              View website
            </a>
            {dirty && <span className="badge warn">Unsaved changes</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
