import { useEffect, useMemo, useState } from 'react';
import Icon from '../components/common/Icon';
import {
  Page, Card, Button, Field, Input, Textarea, Select, Switch, Status, Segmented, Alert, Loader, ImageUpload,
  KeyValue, toast, useAsync,
} from '../ui';
import { SaveBar } from '../ui/ext-web';
import { STOREFRONT_URL, isValidLink, useUnloadGuard } from '../ui/ext-web-utils';
import { settingsService } from '../services/settingsService';
import { resolveImg } from '../utils/media';
import { fmtDate } from '../utils/format';

// Must match FESTIVAL_PRESETS in the storefront (src/festive/presets.js) and the backend `preset` enum.
const PRESETS = [{ value: 'diwali', label: 'Diwali', swatch: ['#4a120a', '#e2570a', '#f4b740'] }];

const EFFECTS = [
  { key: 'palette', icon: 'palette', label: 'Festive colours', hint: 'Saffron buttons, maroon announcement bar and a gold-trimmed footer.' },
  { key: 'banner', icon: 'image', label: 'Homepage festival banner', hint: 'Greeting, headline and button with flickering diyas, under the main slider.' },
  { key: 'garland', icon: 'flower', label: 'Marigold garland', hint: 'A toran of marigolds and bells hanging under the top menu on every page.' },
  { key: 'lights', icon: 'flame', label: 'Floating diya lights', hint: 'Soft glowing lights drifting up the screen.' },
  { key: 'fireworks', icon: 'sparkles', label: 'Fireworks', hint: 'Occasional small firework bursts at the top of the screen.' },
];

const INTENSITY = [
  { value: 'subtle', label: 'Subtle', note: 'About 10 lights per screen, fireworks every 9–14 seconds.' },
  { value: 'medium', label: 'Medium', note: 'About 18 lights per screen, fireworks every 5–9 seconds.' },
  { value: 'festive', label: 'Full festive', note: 'About 28 lights per screen, fireworks every 3–5 seconds.' },
];

const DEFAULTS = {
  enabled: false, preset: 'diwali', startsAt: '', endsAt: '', greeting: 'Happy Diwali',
  headline: 'Light up the festival with something sweet',
  sub: 'Festive cakes, gifting boxes and mithai-inspired bakes — baked fresh and delivered across the city.',
  cta: 'Shop Diwali treats', ctaHref: '/shop', image: '', intensity: 'medium',
  effects: { palette: true, banner: true, garland: true, lights: true, fireworks: true },
};
const LIMITS = { greeting: 60, headline: 140, sub: 300, cta: 40 };

const toDateInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const toForm = (f = {}) => ({
  ...DEFAULTS, ...f,
  startsAt: toDateInput(f.startsAt), endsAt: toDateInput(f.endsAt),
  effects: { ...DEFAULTS.effects, ...(f.effects || {}) },
});
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const pretty = (ymd) => (ymd ? fmtDate(`${ymd}T00:00:00`) : '');

/** Mirrors the storefront's "is it live right now" rule. */
function liveStatus(f) {
  const today = localToday();
  if (!f.enabled) return { key: 'Off', note: 'The website shows its normal design.' };
  if (f.startsAt && today < f.startsAt) return { key: 'Scheduled', note: `Turns on automatically on ${pretty(f.startsAt)}${f.endsAt ? ` and runs until ${pretty(f.endsAt)}` : ''}.` };
  if (f.endsAt && today > f.endsAt) return { key: 'Ended', note: `The end date (${pretty(f.endsAt)}) has passed, so the website shows its normal design.` };
  return { key: 'Live', note: f.endsAt ? `Showing on the website until the end of ${pretty(f.endsAt)}.` : 'Showing on the website until you switch it off.' };
}
const STATUS_TONE = { Off: 'gray', Scheduled: 'blue', Live: 'green', Ended: 'gray' };

/* ---------------- banner preview ---------------- */

function DiwaliBanner({ form }) {
  return (
    <div className={`w-diwali ${form.image ? 'with-img' : ''} ${form.effects.banner ? '' : 'dim'}`}>
      <div className="w-diwali-copy">
        <span className="w-diwali-greet">{form.greeting || 'Greeting'}</span>
        <h3>{form.headline || 'Headline'}</h3>
        {form.sub && <p>{form.sub}</p>}
        {form.cta && <span className="w-diwali-cta">{form.cta}<Icon name="aright" /></span>}
        <div className="w-diyas" aria-hidden="true">{Array.from({ length: 5 }, (_, i) => <span key={i} className="w-diya" />)}</div>
      </div>
      {form.image ? (
        <div className="w-diwali-img"><img src={resolveImg(form.image)} alt="" /></div>
      ) : (
        <div className="w-rangoli hide-xs" aria-hidden="true"><span /></div>
      )}
    </div>
  );
}

/* ---------------- page ---------------- */

export default function FestivalTheme() {
  const { data, loading, error, reload } = useAsync(settingsService.get);
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    const f = toForm(data.festival);
    setForm(f);
    setSaved(JSON.stringify(f));
  }, [data]);

  const dirty = !!form && JSON.stringify(form) !== saved;
  useUnloadGuard(dirty);

  const errors = useMemo(() => {
    if (!form) return {};
    const e = {};
    if (form.startsAt && form.endsAt && form.startsAt > form.endsAt) e.endsAt = 'End date must be on or after the start date';
    if (!isValidLink(form.ctaHref)) e.ctaHref = 'Must start with / (a page on this site) or https://';
    Object.entries(LIMITS).forEach(([k, max]) => { if ((form[k] || '').length > max) e[k] = `Keep it under ${max} characters`; });
    return e;
  }, [form]);
  const invalid = Object.keys(errors).length > 0;

  const save = async () => {
    if (invalid) {
      toast.error('Check the highlighted fields', Object.values(errors)[0]);
      return;
    }
    setSaving(true);
    try {
      const res = await settingsService.updateFestival({ ...form, startsAt: form.startsAt || null, endsAt: form.endsAt || null });
      const f = toForm(res.festival);
      setForm(f);
      setSaved(JSON.stringify(f));
      const st = liveStatus(f);
      toast.success(f.enabled ? `Festive theme saved · ${st.key}` : 'Festive theme turned off', st.note);
    } catch (err) {
      toast.error('Could not save', err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page
      title="Festive theme"
      description="Dress the website up for a festival. Nothing changes until you switch it on — switching it off brings the normal design straight back."
      actions={<Button as="a" href={STOREFRONT_URL} target="_blank" rel="noreferrer" icon="external">View website</Button>}
    >
      <Loader loading={(loading && !data) || (data && !form)} error={!data ? error : ''} onRetry={reload} rows={6}>
        {form && <FestivalBody form={form} setForm={setForm} errors={errors} />}
        {form && (
          <SaveBar
            dirty={dirty}
            saving={saving}
            onSave={save}
            onDiscard={() => setForm(JSON.parse(saved))}
            note={dirty ? 'Nothing changes on the website until you save.' : liveStatus(JSON.parse(saved)).note}
            disabled={invalid}
          />
        )}
      </Loader>
    </Page>
  );
}

function FestivalBody({ form, setForm, errors }) {
  const status = liveStatus(form);
  const preset = PRESETS.find((p) => p.value === form.preset) || PRESETS[0];
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setEffect = (k, v) => setForm((f) => ({ ...f, effects: { ...f.effects, [k]: v } }));
  const onCount = EFFECTS.filter((fx) => form.effects[fx.key]).length;
  const count = (k) => <span className={(form[k] || '').length > LIMITS[k] ? 'u-error' : ''}>{(form[k] || '').length}/{LIMITS[k]}</span>;

  return (
    <div className="u-stack">
      <div className={`w-fest-hero ${form.enabled ? '' : 'off'}`}>
        <span className="w-fest-ico"><Icon name="flame" /></span>
        <div style={{ flex: '1 1 260px', minWidth: 0 }}>
          <div className="u-row" style={{ gap: 8 }}>
            <h2>{preset.label} theme</h2>
            <Status tone={STATUS_TONE[status.key]}>{status.key === 'Live' ? 'Live now' : status.key}</Status>
          </div>
          <p>{status.note}</p>
        </div>
        <div className="w-fest-switch">
          <Switch checked={form.enabled} onChange={(enabled) => setForm((f) => ({ ...f, enabled }))} label="Show on the website" description={form.enabled ? 'Switched on' : 'Switched off'} />
        </div>
        <div className="w-fest-steps" aria-label="Theme status">
          {['Off', 'Scheduled', 'Live', 'Ended'].map((k) => <span key={k} className={status.key === k ? 'on' : ''}>{k === 'Live' ? 'Live now' : k}</span>)}
        </div>
      </div>

      <div className="u-grid cols-2">
        <Card title="Festival & schedule" subtitle="Pick the festival and, optionally, when it runs." icon="cal">
          <div className="u-stack tight" style={{ gap: 16 }}>
            <Field label="Festival" hint={<span className="u-row" style={{ gap: 6 }}><span className="w-swatch">{preset.swatch.map((c) => <i key={c} style={{ background: c }} />)}</span>Colours, decorations and banner style</span>}>
              {(id) => <Select id={id} value={form.preset} onChange={set('preset')} options={PRESETS} />}
            </Field>
            <div className="u-form-grid two">
              <Field label="Start date" hint="Optional">
                {(id) => <Input id={id} type="date" value={form.startsAt} onChange={set('startsAt')} />}
              </Field>
              <Field label="End date" error={errors.endsAt} hint="Optional · last day shown">
                {(id) => <Input id={id} type="date" value={form.endsAt} min={form.startsAt || undefined} onChange={set('endsAt')} error={!!errors.endsAt} />}
              </Field>
            </div>
            <div className="u-row">
              <Button size="sm" icon="cal" onClick={() => setForm((f) => ({ ...f, startsAt: localToday() }))}>Start today</Button>
              {(form.startsAt || form.endsAt) && <Button size="sm" variant="ghost" icon="x" onClick={() => setForm((f) => ({ ...f, startsAt: '', endsAt: '' }))}>Clear dates</Button>}
            </div>
            <KeyValue
              items={[
                ['Starts', form.startsAt ? pretty(form.startsAt) : 'As soon as it’s switched on'],
                ['Ends', form.endsAt ? pretty(form.endsAt) : 'When you switch it off'],
                ['Right now', status.key === 'Live' ? 'Live on the website' : status.key],
              ]}
            />
          </div>
        </Card>

        <Card title="Effects" subtitle={`${onCount} of ${EFFECTS.length} switched on`} icon="sparkles">
          <div className="u-stack tight" style={{ gap: 0 }}>
            <Field label="Effect strength" hint={INTENSITY.find((i) => i.value === form.intensity)?.note}>
              <Segmented value={form.intensity} onChange={(intensity) => setForm((f) => ({ ...f, intensity }))} items={INTENSITY} />
            </Field>
            <div style={{ height: 18 }} />
            {EFFECTS.map((fx) => (
              <div className="w-effect" key={fx.key}>
                <span className="w-effect-ico"><Icon name={fx.icon} /></span>
                <Switch checked={!!form.effects[fx.key]} onChange={(v) => setEffect(fx.key, v)} label={fx.label} description={fx.hint} />
              </div>
            ))}
            <p className="u-xs u-muted" style={{ marginTop: 10 }}>Animations switch off automatically for visitors who turn on “reduce motion” in their device settings.</p>
          </div>
        </Card>
      </div>

      <Card title="Homepage festival banner" subtitle="Shown under the main slider while the theme is live." icon="image">
        <div className="u-grid cols-2">
          <div className="u-stack tight" style={{ gap: 16 }}>
            {!form.effects.banner && <Alert tone="amber" icon="eyeoff" title="Banner is switched off">Turn on “Homepage festival banner” in Effects to show it.</Alert>}
            <div className="u-form-grid two">
              <Field label="Greeting" error={errors.greeting} hint={count('greeting')}>
                {(id) => <Input id={id} value={form.greeting} onChange={set('greeting')} placeholder="Happy Diwali" error={!!errors.greeting} />}
              </Field>
              <Field label="Button text" error={errors.cta} hint={count('cta')}>
                {(id) => <Input id={id} value={form.cta} onChange={set('cta')} placeholder="Shop Diwali treats" error={!!errors.cta} />}
              </Field>
            </div>
            <Field label="Headline" error={errors.headline} hint={count('headline')}>
              {(id) => <Input id={id} value={form.headline} onChange={set('headline')} error={!!errors.headline} />}
            </Field>
            <Field label="Text" error={errors.sub} hint={count('sub')}>
              {(id) => <Textarea id={id} rows={2} value={form.sub} onChange={set('sub')} error={!!errors.sub} style={{ minHeight: 70 }} />}
            </Field>
            <Field label="Button link" error={errors.ctaHref} hint="Tip: link to a category, e.g. /shop?category=Brownies">
              {(id) => <Input id={id} icon="link" value={form.ctaHref} onChange={set('ctaHref')} placeholder="/shop or https://…" error={!!errors.ctaHref} />}
            </Field>
            <Field label="Banner photo (optional)" hint="Without a photo the banner shows an illustrated rangoli.">
              <ImageUpload value={form.image} onChange={(image) => setForm((f) => ({ ...f, image }))} />
            </Field>
          </div>
          <div className="u-stack tight" style={{ position: 'sticky', top: 80, alignSelf: 'start' }}>
            <span className="u-label">Preview</span>
            <DiwaliBanner form={form} />
            <span className="u-xs u-muted">{form.effects.banner ? 'Approximate look — the website adds gently drifting lights on top.' : 'The banner is switched off in Effects.'}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
