import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Page, Card, Stat, Button, Status, DataTable, Drawer, Field, Input, Switch, Alert, EmptyState, Loader,
  KeyValue, useAsync, useConfirm, toast,
} from '../ui';
import { CopyButton } from '../ui/ext-cat';
import { couponService } from '../services/catalogService';
import { money, fmtDate } from '../utils/format';

/** A pre-2000 date is how a cleared expiry was stored by older builds — treat it as "never". */
const hasExpiry = (c) => !!c.expiresAt && new Date(c.expiresAt).getFullYear() >= 2000;
const isExpired = (c) => hasExpiry(c) && new Date(c.expiresAt).getTime() < Date.now();
const statusOf = (c) => (!c.active ? 'Inactive' : isExpired(c) ? 'Expired' : 'Active');
const daysLeft = (c) => Math.ceil((new Date(c.expiresAt).getTime() - Date.now()) / 86400000);
const conditions = (c) => [c.minSubtotal > 0 ? `Min. order ${money(c.minSubtotal)}` : null, c.firstOrderOnly ? 'First order only' : null].filter(Boolean).join(' · ') || 'Anyone, any order';

const toDateInput = (v) => {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 2000) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randomCode = () => `BBB${Array.from({ length: 5 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('')}`;

export default function Coupons() {
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();
  const { data, setData, loading, error, reload } = useAsync(couponService.list);
  // /coupons?new=1 opens the create drawer straight away.
  const [editing, setEditing] = useState(() => (params.get('new') === '1' ? 'new' : null)); // null | 'new' | coupon
  useEffect(() => {
    if (params.get('new') === '1') setParams({}, { replace: true });
  }, [params, setParams]);

  const coupons = useMemo(() => data || [], [data]);
  const stats = useMemo(() => ({
    active: coupons.filter((c) => statusOf(c) === 'Active').length,
    expired: coupons.filter((c) => statusOf(c) === 'Expired').length,
    inactive: coupons.filter((c) => statusOf(c) === 'Inactive').length,
    first: coupons.filter((c) => c.firstOrderOnly).length,
    soon: coupons.filter((c) => statusOf(c) === 'Active' && hasExpiry(c) && daysLeft(c) <= 7).length,
  }), [coupons]);

  const upsert = (c) => setData((list) => (list.some((x) => x._id === c._id) ? list.map((x) => (x._id === c._id ? c : x)) : [...list, c].sort((a, b) => a.code.localeCompare(b.code))));

  const toggle = async (c) => {
    try {
      upsert(await couponService.update(c._id, { active: !c.active }));
      toast.success(c.active ? 'Coupon turned off' : 'Coupon turned on', c.code);
    } catch (err) {
      toast.error('Could not update coupon', err.message);
    }
  };

  const remove = async (c) => {
    const ok = await confirm({ title: `Delete ${c.code}?`, message: 'Customers can no longer apply this code. Orders that already used it are not affected. To pause it instead, turn it off.', confirmLabel: 'Delete coupon', danger: true });
    if (!ok) return;
    try {
      await couponService.remove(c._id);
      setData((list) => list.filter((x) => x._id !== c._id));
      toast.success('Coupon deleted', c.code);
      setEditing(null);
    } catch (err) {
      toast.error('Could not delete coupon', err.message);
    }
  };

  return (
    <Page
      title="Coupons"
      description="Percentage-off promo codes customers apply at checkout. The server checks every rule, so a code only works while it's active and not expired."
      actions={<Button variant="primary" icon="plus" onClick={() => setEditing('new')}>New coupon</Button>}
    >
      <Loader loading={loading && !data} error={!data ? error : ''} onRetry={reload} rows={5}>
        {data && (
          <div className="u-stack">
            <div className="u-grid cols-4 u-x-stats">
              <Stat label="Active codes" icon="percent" tone="green" value={stats.active} note={stats.soon ? `${stats.soon} expiring within 7 days` : 'Usable at checkout now'} />
              <Stat label="Expired" icon="clock" tone="amber" value={stats.expired} note="Past their expiry date" />
              <Stat label="Turned off" icon="ban" tone="red" value={stats.inactive} note="Paused by you" />
              <Stat label="First-order only" icon="sparkles" tone="violet" value={stats.first} note="Welcome offers for new customers" />
            </div>
            <Card flush className="u-x-mintable">
              <DataTable
                rows={coupons}
                onRowClick={setEditing}
                exportName="coupons"
                search={{ placeholder: 'Search codes or descriptions…', fields: ['code', 'description'] }}
                filters={[
                  { key: 'status', label: 'Any status', options: ['Active', 'Expired', 'Inactive'], test: (c, v) => statusOf(c) === v },
                  { key: 'who', label: 'Any customer', options: [{ value: 'first', label: 'First order only' }, { value: 'all', label: 'Everyone' }], test: (c, v) => (v === 'first' ? c.firstOrderOnly : !c.firstOrderOnly) },
                ]}
                highlight={(c) => statusOf(c) === 'Active' && hasExpiry(c) && daysLeft(c) <= 7}
                rowActions={(c) => [
                  { label: 'Edit', icon: 'edit', onClick: () => setEditing(c) },
                  { label: c.active ? 'Turn off' : 'Turn on', icon: c.active ? 'ban' : 'check', onClick: () => toggle(c) },
                  { divider: true },
                  { label: 'Delete', icon: 'trash', danger: true, onClick: () => remove(c) },
                ]}
                empty={
                  <EmptyState icon="percent" title="No coupons yet" actions={<Button variant="primary" icon="plus" onClick={() => setEditing('new')}>Create a coupon</Button>}>
                    Create a promo code like FIRST20 to reward new customers or run a festive sale.
                  </EmptyState>
                }
                columns={[
                  {
                    key: 'code', header: 'Code', sortable: true,
                    render: (c) => (
                      <span className="u-cell-text" style={{ gap: 4 }}>
                        <span className="u-x-code"><b>{c.code}</b><CopyButton text={c.code} label="Copy code" /></span>
                        {c.description && <span>{c.description}</span>}
                      </span>
                    ),
                  },
                  { key: 'pct', header: 'Discount', sortable: true, align: 'right', csv: (c) => `${c.pct}%`, render: (c) => <b className="u-strong u-num">{c.pct}% off</b> },
                  { key: 'rules', header: 'Conditions', csv: conditions, render: (c) => <span className="u-small">{conditions(c)}</span> },
                  {
                    key: 'expiresAt', header: 'Expires', sortable: true, sortValue: (c) => (hasExpiry(c) ? new Date(c.expiresAt).getTime() : Infinity), csv: (c) => (hasExpiry(c) ? fmtDate(c.expiresAt) : 'Never'),
                    render: (c) => (hasExpiry(c) ? <span className="u-cell-text"><span style={{ color: 'var(--u-ink)' }}>{fmtDate(c.expiresAt)}</span><span>{isExpired(c) ? 'Expired' : daysLeft(c) <= 1 ? 'Ends today' : `${daysLeft(c)} days left`}</span></span> : <span className="u-muted">Never</span>),
                  },
                  { key: 'status', header: 'Status', sortable: true, sortValue: statusOf, csv: statusOf, render: (c) => <Status>{statusOf(c)}</Status> },
                ]}
              />
            </Card>
          </div>
        )}
      </Loader>

      {editing && (
        <CouponDrawer
          coupon={editing === 'new' ? null : editing}
          taken={coupons.filter((c) => c._id !== editing?._id).map((c) => c.code)}
          onClose={() => setEditing(null)}
          onSaved={(c) => { upsert(c); setEditing(null); }}
          onDelete={editing === 'new' ? null : () => remove(editing)}
        />
      )}
    </Page>
  );
}

function CouponDrawer({ coupon, taken, onClose, onSaved, onDelete }) {
  const [f, setF] = useState(() => ({
    code: coupon?.code || '', pct: String(coupon?.pct ?? 10), description: coupon?.description || '',
    minSubtotal: String(coupon?.minSubtotal ?? 0), firstOrderOnly: !!coupon?.firstOrderOnly, active: coupon ? coupon.active !== false : true,
    expires: toDateInput(coupon?.expiresAt),
  }));
  const [initial] = useState(f);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (patch) => { setF((x) => ({ ...x, ...patch })); setErrors((e) => ({ ...e, ...Object.fromEntries(Object.keys(patch).map((k) => [k, ''])) })); };
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);
  const today = toDateInput(new Date());
  const pct = Number(f.pct) || 0;
  const min = Number(f.minSubtotal) || 0;

  const save = async (ev) => {
    ev?.preventDefault();
    const e = {};
    if (!/^[A-Z0-9_-]{3,30}$/.test(f.code)) e.code = 'Use 3–30 letters, numbers, - or _.';
    else if (taken.includes(f.code)) e.code = 'Another coupon already uses this code.';
    if (!Number.isInteger(Number(f.pct)) || pct < 1 || pct > 100) e.pct = 'Enter a whole number from 1 to 100.';
    if (f.minSubtotal !== '' && (!Number.isFinite(Number(f.minSubtotal)) || min < 0)) e.minSubtotal = 'Enter 0 or more.';
    if (f.description.length > 200) e.description = 'Keep it under 200 characters.';
    setErrors(e);
    if (Object.keys(e).length) return;
    const payload = {
      code: f.code, pct, description: f.description.trim(), minSubtotal: min, firstOrderOnly: f.firstOrderOnly, active: f.active,
      // Valid until the end of the chosen day (local time); '' = never expires.
      expiresAt: f.expires ? new Date(`${f.expires}T23:59:59`).toISOString() : '',
    };
    setSaving(true);
    try {
      const saved = coupon ? await couponService.update(coupon._id, payload) : await couponService.create(payload);
      toast.success(coupon ? 'Coupon saved' : 'Coupon created', `${saved.code} · ${saved.pct}% off`);
      onSaved(saved);
    } catch (err) {
      if (err.status === 409 || /duplicate|exists/i.test(err.message)) setErrors({ code: 'Another coupon already uses this code.' });
      toast.error('Could not save coupon', err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={coupon ? `Edit ${coupon.code}` : 'New coupon'}
      description={coupon ? `Created ${fmtDate(coupon.createdAt)} · currently ${statusOf(coupon).toLowerCase()}` : 'Customers type the code at checkout to get a percentage off their cakes.'}
      footer={
        <>
          {onDelete && <Button variant="danger-soft" icon="trash" onClick={onDelete} disabled={saving}>Delete</Button>}
          <span className="u-spacer" />
          <Button onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form="coupon-form" variant="primary" icon="check" loading={saving} disabled={!!coupon && !dirty}>{coupon ? 'Save coupon' : 'Create coupon'}</Button>
        </>
      }
    >
      <form id="coupon-form" className="u-stack" onSubmit={save}>
        <Field label="Code" required error={errors.code} hint="Customers type this at checkout — not case sensitive.">
          {(id) => (
            <div className="u-row" style={{ flexWrap: 'nowrap', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <Input id={id} className="u-mono" style={{ fontSize: 15, letterSpacing: '0.06em' }} value={f.code} onChange={(e) => set({ code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })} placeholder="FIRST20" maxLength={30} error={errors.code} autoFocus={!coupon} />
              </div>
              <Button icon="sparkles" onClick={() => set({ code: randomCode() })}>Generate</Button>
            </div>
          )}
        </Field>
        <div className="u-form-grid two">
          <Field label="Discount" required error={errors.pct}>
            {(id) => <Input id={id} type="number" min="1" max="100" step="1" suffix="% off" style={{ paddingLeft: 12 }} value={f.pct} onChange={(e) => set({ pct: e.target.value })} error={errors.pct} />}
          </Field>
          <Field label="Minimum order" error={errors.minSubtotal} hint="Cart subtotal needed. 0 = no minimum.">
            {(id) => <Input id={id} prefix="₹" type="number" min="0" step="1" value={f.minSubtotal} onChange={(e) => set({ minSubtotal: e.target.value })} error={errors.minSubtotal} />}
          </Field>
        </div>
        <Field label="Description" error={errors.description} hint={`${f.description.length}/200 · shown with the code where relevant`}>
          {(id) => <Input id={id} value={f.description} onChange={(e) => set({ description: e.target.value })} placeholder="20% off your first order" maxLength={200} error={errors.description} />}
        </Field>
        <Field label="Expires on" hint={f.expires ? 'Valid until the end of this day.' : 'Leave empty and the code never expires.'}>
          {(id) => (
            <div className="u-row" style={{ flexWrap: 'nowrap', gap: 8 }}>
              <div style={{ flex: 1 }}><Input id={id} type="date" min={coupon ? undefined : today} value={f.expires} onChange={(e) => set({ expires: e.target.value })} /></div>
              {f.expires && <Button variant="ghost" icon="x" onClick={() => set({ expires: '' })}>Clear</Button>}
            </div>
          )}
        </Field>
        {f.expires && f.expires < today && <Alert tone="amber" icon="clock">This date is in the past, so the code is expired and won’t work at checkout.</Alert>}
        <Switch checked={f.firstOrderOnly} onChange={(v) => set({ firstOrderOnly: v })} label="First order only" description="Only customers who haven't ordered before can use it." />
        <Switch checked={f.active} onChange={(v) => set({ active: v })} label="Active" description="Turn off to pause the code without deleting it." />

        <div className="u-stack tight" style={{ gap: 8 }}>
          <span className="u-x-preview-label">Summary</span>
          <Card>
            <KeyValue items={[
              ['Code', <span className="u-x-code" key="c"><b>{f.code || '—'}</b></span>],
              ['Customer saves', `${pct}% off the cakes`],
              ['Example', min > 0 ? `On a ${money(Math.max(min, 1000))} order: −${money((Math.max(min, 1000) * pct) / 100)}` : `On a ${money(1000)} order: −${money((1000 * pct) / 100)}`],
              ['Who', f.firstOrderOnly ? 'New customers, first order' : 'Everyone'],
              ['Valid', f.expires ? `Until ${fmtDate(`${f.expires}T23:59:59`)}` : 'No expiry'],
            ]} />
          </Card>
        </div>
      </form>
    </Drawer>
  );
}
