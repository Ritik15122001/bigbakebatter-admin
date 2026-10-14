import { useMemo, useState } from 'react';
import { Page, Card, Button, Field, Input, Textarea, FormSection, Alert, Loader, toast, useAsync } from '../ui';
import { TagInput, SaveBar } from '../ui/ext-web';
import { STOREFRONT_URL, isValidLink, useUnloadGuard } from '../ui/ext-web-utils';
import { settingsService } from '../services/settingsService';
import { money } from '../utils/format';

const DEFAULT_SLOTS = ['10 AM – 12 PM', '12 PM – 2 PM', '2 PM – 4 PM', '4 PM – 6 PM', '6 PM – 8 PM'];
const THIS_YEAR = new Date().getFullYear();

const toForm = (s = {}) => ({
  name: s.name || '', since: s.since == null ? '' : String(s.since), phones: s.phones || [], email: s.email || '',
  addressFull: s.addressFull || '', hours: s.hours || '', mapsLink: s.mapsLink || '', mapsEmbedSrc: s.mapsEmbedSrc || '',
  instagram: s.social?.instagram || '', facebook: s.social?.facebook || '', twitter: s.social?.twitter || '',
  deliveryFee: String(s.deliveryFee ?? 49), freeDeliveryAbove: String(s.freeDeliveryAbove ?? 1500),
  slots: Array.isArray(s.slots) && s.slots.length ? s.slots : DEFAULT_SLOTS,
  sameDayCutoffHour: String(s.sameDayCutoffHour ?? 14),
});

const hourLabel = (h) => {
  const n = Number(h);
  if (h === '' || !Number.isInteger(n) || n < 0 || n > 23) return '';
  return `${n % 12 === 0 ? 12 : n % 12} ${n < 12 ? 'AM' : 'PM'}`;
};

const validatePhone = (v) => (/^\+?[\d\s-]{8,15}$/.test(v) ? '' : 'Enter a valid phone number');
const isHttps = (v) => !v || /^https?:\/\/\S+$/i.test(v.trim());

function validate(f) {
  const e = {};
  if (!f.name.trim()) e.name = 'The business name is shown across the website';
  if (f.since !== '' && !(Number.isInteger(Number(f.since)) && Number(f.since) >= 1900 && Number(f.since) <= THIS_YEAR)) e.since = `Enter a year between 1900 and ${THIS_YEAR}`;
  if (!f.phones.length) e.phones = 'Add at least one phone number';
  if (f.email && !/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = 'Enter a valid email address';
  if (!isValidLink(f.mapsLink) || !isHttps(f.mapsLink)) e.mapsLink = 'Must be a full https:// link';
  if (f.mapsEmbedSrc && !/^https:\/\/(www\.)?google\.[a-z.]+\/maps\/embed/i.test(f.mapsEmbedSrc.trim())) e.mapsEmbedSrc = 'Paste the src="…" link from Google Maps → Share → Embed a map';
  ['instagram', 'facebook', 'twitter'].forEach((k) => { if (!isHttps(f[k])) e[k] = 'Must be a full https:// link'; });
  if (!(f.deliveryFee !== '' && Number(f.deliveryFee) >= 0)) e.deliveryFee = 'Enter 0 or more';
  if (!(f.freeDeliveryAbove !== '' && Number(f.freeDeliveryAbove) >= 0)) e.freeDeliveryAbove = 'Enter 0 or more';
  if (!f.slots.length) e.slots = 'Add at least one delivery slot';
  if (!hourLabel(f.sameDayCutoffHour)) e.sameDayCutoffHour = 'Enter an hour from 0 to 23';
  return e;
}

const toPayload = (f) => ({
  name: f.name.trim(),
  since: f.since === '' ? undefined : Number(f.since),
  phones: f.phones,
  email: f.email.trim(),
  addressFull: f.addressFull.trim(),
  hours: f.hours.trim(),
  mapsLink: f.mapsLink.trim(),
  mapsEmbedSrc: f.mapsEmbedSrc.trim(),
  deliveryFee: Number(f.deliveryFee),
  freeDeliveryAbove: Number(f.freeDeliveryAbove),
  slots: f.slots,
  sameDayCutoffHour: Number(f.sameDayCutoffHour),
  social: { instagram: f.instagram.trim(), facebook: f.facebook.trim(), twitter: f.twitter.trim() },
});

export default function Settings() {
  const { data, loading, error, reload } = useAsync(settingsService.get);
  return (
    <Page
      title="Store settings"
      description="Contact details, delivery charges and time slots used across the website and at checkout."
      actions={<Button as="a" href={STOREFRONT_URL} target="_blank" rel="noreferrer" icon="external">View website</Button>}
    >
      <Loader loading={loading && !data} error={!data ? error : ''} onRetry={reload} rows={8}>
        {data && <SettingsForm initial={toForm(data)} />}
      </Loader>
    </Page>
  );
}

function SettingsForm({ initial }) {
  const [form, setForm] = useState(initial);
  const [saved, setSaved] = useState(() => JSON.stringify(initial));
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const dirty = JSON.stringify(form) !== saved;
  useUnloadGuard(dirty);
  const errors = useMemo(() => validate(form), [form]);
  const savedForm = useMemo(() => JSON.parse(saved), [saved]);
  // Only flag a field once it has been edited, or after a save attempt.
  const err = (k) => (showErrors || JSON.stringify(form[k]) !== JSON.stringify(savedForm[k]) ? errors[k] : '');

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setVal = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (Object.keys(errors).length) {
      setShowErrors(true);
      toast.error('Check the highlighted fields', Object.values(errors)[0]);
      return;
    }
    setSaving(true);
    try {
      const res = await settingsService.update(toPayload(form));
      const next = res && typeof res === 'object' ? toForm(res) : form;
      setForm(next);
      setSaved(JSON.stringify(next));
      setShowErrors(false);
      toast.success('Settings saved', 'The website shows the new details straight away.');
    } catch (e) {
      toast.error('Could not save settings', e.message);
    } finally {
      setSaving(false);
    }
  };

  const fee = Number(form.deliveryFee) || 0;
  const freeAbove = Number(form.freeDeliveryAbove) || 0;
  const cutoff = hourLabel(form.sameDayCutoffHour);

  return (
    <div className="u-stack">
      <Card>
        <FormSection title="Business details" description="Shown in the header, footer, contact page and order emails.">
          <div className="u-form-grid two">
            <Field label="Business name" required error={err('name')}>
              {(id) => <Input id={id} value={form.name} onChange={set('name')} error={err('name')} />}
            </Field>
            <Field label="Baking since" hint="Year, used in “Baking since …” on the About page." error={err('since')}>
              {(id) => <Input id={id} type="number" inputMode="numeric" value={form.since} onChange={set('since')} error={err('since')} placeholder="e.g. 2016" />}
            </Field>
          </div>
          <Field label="Phone numbers" required hint="Press Enter after each number. The first one shows in the header." error={err('phones')}>
            <TagInput value={form.phones} onChange={setVal('phones')} validate={validatePhone} inputMode="tel" placeholder="e.g. 9899660338" error={err('phones')} />
          </Field>
          <Field label="Email" error={err('email')}>
            {(id) => <Input id={id} type="email" icon="mail" value={form.email} onChange={set('email')} error={err('email')} placeholder="hello@bigbakebatter.com" />}
          </Field>
        </FormSection>
      </Card>

      <Card>
        <FormSection title="Location & hours" description="Where customers can find you, and when the shop is open.">
          <Field label="Address">
            {(id) => <Textarea id={id} rows={2} value={form.addressFull} onChange={set('addressFull')} />}
          </Field>
          <Field label="Opening hours" hint="Shown on the contact page and in the footer.">
            {(id) => <Input id={id} icon="clock" value={form.hours} onChange={set('hours')} placeholder="e.g. Open daily, 10 AM – 9 PM" />}
          </Field>
          <Field label="Google Maps link" hint="Opens when customers tap “Get directions”." error={err('mapsLink')}>
            {(id) => <Input id={id} icon="pin" value={form.mapsLink} onChange={set('mapsLink')} error={err('mapsLink')} placeholder="https://maps.app.goo.gl/…" />}
          </Field>
          <Field label="Google Maps embed URL" hint="Google Maps → Share → Embed a map → copy only the src link." error={err('mapsEmbedSrc')}>
            {(id) => <Input id={id} icon="link" value={form.mapsEmbedSrc} onChange={set('mapsEmbedSrc')} error={err('mapsEmbedSrc')} placeholder="https://www.google.com/maps/embed?pb=…" />}
          </Field>
          {form.mapsEmbedSrc && !errors.mapsEmbedSrc && (
            <iframe title="Map preview" src={form.mapsEmbedSrc} loading="lazy" referrerPolicy="no-referrer-when-downgrade" style={{ width: '100%', height: 200, border: 0, borderRadius: 12 }} />
          )}
        </FormSection>
      </Card>

      <Card>
        <FormSection title="Delivery" description="Charges and time slots offered at checkout.">
          <div className="u-form-grid two">
            <Field label="Delivery fee" required error={err('deliveryFee')}>
              {(id) => <Input id={id} prefix="₹" type="number" min="0" inputMode="numeric" value={form.deliveryFee} onChange={set('deliveryFee')} error={err('deliveryFee')} />}
            </Field>
            <Field label="Free delivery above" required hint="Set 0 to always charge the fee." error={err('freeDeliveryAbove')}>
              {(id) => <Input id={id} prefix="₹" type="number" min="0" inputMode="numeric" value={form.freeDeliveryAbove} onChange={set('freeDeliveryAbove')} error={err('freeDeliveryAbove')} />}
            </Field>
          </div>
          {!errors.deliveryFee && !errors.freeDeliveryAbove && (
            <Alert tone="blue" icon="truck">
              {fee === 0
                ? 'Delivery is free on every order.'
                : freeAbove > 0
                  ? `Customers pay ${money(fee)} for delivery, or nothing when their cart is ${money(freeAbove)} or more.`
                  : `Every order is charged ${money(fee)} for delivery.`}
            </Alert>
          )}
          <Field
            label="Same-day order cut-off" required error={err('sameDayCutoffHour')}
            hint={cutoff ? `After ${cutoff}, customers can't choose today as the delivery date.` : '24-hour clock, e.g. 14 = 2 PM.'}
          >
            {(id) => <Input id={id} type="number" min="0" max="23" step="1" inputMode="numeric" suffix={cutoff || 'hour'} value={form.sameDayCutoffHour} onChange={set('sameDayCutoffHour')} error={err('sameDayCutoffHour')} />}
          </Field>
          <Field label="Delivery time slots" required hint="Press Enter after each slot. They appear at checkout in this order." error={err('slots')}>
            <TagInput value={form.slots} onChange={setVal('slots')} placeholder="e.g. 10 AM – 12 PM" error={err('slots')} />
          </Field>
          {JSON.stringify(form.slots) !== JSON.stringify(DEFAULT_SLOTS) && (
            <div><Button size="sm" variant="ghost" icon="refresh" onClick={() => setVal('slots')(DEFAULT_SLOTS)}>Reset to default slots</Button></div>
          )}
        </FormSection>
      </Card>

      <Card>
        <FormSection title="Social links" description="Icons in the footer link here. Leave a field empty to hide that icon.">
          <Field label="Instagram" error={err('instagram')}>
            {(id) => <Input id={id} icon="insta" value={form.instagram} onChange={set('instagram')} error={err('instagram')} placeholder="https://instagram.com/…" />}
          </Field>
          <Field label="Facebook" error={err('facebook')}>
            {(id) => <Input id={id} icon="fb" value={form.facebook} onChange={set('facebook')} error={err('facebook')} placeholder="https://facebook.com/…" />}
          </Field>
          <Field label="X (Twitter)" error={err('twitter')}>
            {(id) => <Input id={id} icon="tw" value={form.twitter} onChange={set('twitter')} error={err('twitter')} placeholder="https://x.com/…" />}
          </Field>
        </FormSection>
      </Card>

      <SaveBar
        dirty={dirty}
        saving={saving}
        onSave={save}
        onDiscard={() => { setForm(savedForm); setShowErrors(false); }}
        saveLabel="Save settings"
        note={dirty ? 'Nothing changes on the website until you save.' : undefined}
      />
    </div>
  );
}
