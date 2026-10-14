import { useEffect, useMemo, useState } from 'react';
import Icon from '../components/common/Icon';
import {
  Page, Card, Button, Drawer, Field, Input, Textarea, Switch, Status, DataTable, EmptyState, Loader, Stat,
  useConfirm, toast, useAsync,
} from '../ui';
import { IconPicker, StoreIcon, MoveButtons } from '../ui/ext-web';
import { STOREFRONT_URL, iconLabel, isValidLink, moveItem, useUnloadGuard } from '../ui/ext-web-utils';
import { announcementService } from '../services/catalogService';
import { BAR_ICONS } from '../utils/icons';
import { fmtDate } from '../utils/format';

const MAX = 160;
const EMPTY = { text: '', icon: 'sparkles', link: '', order: 0, active: true };
const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0);
/** Only the fields the API accepts. */
const toPayload = (a) => ({ text: a.text.trim(), icon: a.icon || 'sparkles', link: (a.link || '').trim(), order: Number(a.order) || 0, active: !!a.active });

/* ---------------- storefront top-bar mock ---------------- */

function BarPreview({ items }) {
  const [i, setI] = useState(0);
  const n = items.length;
  useEffect(() => {
    if (n < 2) return undefined;
    const t = setInterval(() => setI((x) => (x + 1) % n), 3500);
    return () => clearInterval(t);
  }, [n]);
  const idx = n ? Math.min(i, n - 1) : 0;
  const cur = items[idx];
  return (
    <div className="w-browser">
      <div className="w-browser-bar">
        <span><i /><i /><i /></span>
        <span className="w-browser-url">{STOREFRONT_URL.replace(/^https?:\/\//, '')}/</span>
      </div>
      {cur ? (
        <div className="w-annbar">
          {n > 1 && <button type="button" className="w-annbar-nav l" aria-label="Previous message" onClick={() => setI((idx - 1 + n) % n)}><Icon name="cleft" /></button>}
          <span className="w-annbar-msg" key={cur._id || idx}>
            <StoreIcon name={cur.icon} size={15} />
            {cur.link ? <u>{cur.text}</u> : cur.text}
          </span>
          {n > 1 && <button type="button" className="w-annbar-nav r" aria-label="Next message" onClick={() => setI((idx + 1) % n)}><Icon name="cright" /></button>}
        </div>
      ) : (
        <div className="w-annbar" style={{ background: 'var(--u-gray-soft)', color: 'var(--u-muted)' }}>No active messages — the bar is hidden on the website.</div>
      )}
      <div className="w-annbar-site">
        <b>BigBakeBatter</b>
        <span className="hide-xs">Shop</span><span className="hide-xs">Custom cakes</span><span className="hide-xs">Corporate</span><span className="hide-xs">Blog</span>
        <Icon name="bag" />
      </div>
      {n > 1 && <div className="u-xs u-muted" style={{ padding: '8px 14px' }}>Message {idx + 1} of {n} · rotates every few seconds</div>}
    </div>
  );
}

/* ---------------- page ---------------- */

export default function Announcements() {
  const confirm = useConfirm();
  const { data, setData, loading, error, reload } = useAsync(announcementService.list);
  const list = useMemo(() => [...(data || [])].sort(byOrder), [data]);
  const active = list.filter((a) => a.active);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);

  const replace = (u) => setData((prev) => (prev || []).map((a) => (a._id === u._id ? u : a)));

  const toggle = async (a, value) => {
    replace({ ...a, active: value });
    try {
      replace(await announcementService.update(a._id, { active: value }));
      toast.success(value ? 'Message is live' : 'Message hidden', value ? 'It now rotates in the top bar.' : 'It stays saved but is no longer shown.');
    } catch (e) {
      replace(a);
      toast.error('Could not update', e.message);
    }
  };

  /** Renumbers positions 1…n after a move and saves only the ones that changed. */
  const move = async (index, dir) => {
    const next = moveItem(list, index, dir).map((a, i) => ({ ...a, order: i + 1 }));
    const changed = next.filter((a) => list.find((b) => b._id === a._id)?.order !== a.order);
    setBusy(true);
    setData(next);
    try {
      await Promise.all(changed.map((a) => announcementService.update(a._id, { order: a.order })));
    } catch (e) {
      toast.error('Could not reorder', e.message);
      reload();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (a) => {
    const ok = await confirm({ title: 'Delete this message?', message: `“${a.text}” will be removed from the top bar permanently.`, confirmLabel: 'Delete', danger: true });
    if (!ok) return false;
    try {
      await announcementService.remove(a._id);
      setData((prev) => (prev || []).filter((x) => x._id !== a._id));
      toast.success('Message deleted');
      return true;
    } catch (e) {
      toast.error('Could not delete', e.message);
      return false;
    }
  };

  const nextOrder = list.length ? Math.max(...list.map((a) => a.order || 0)) + 1 : 1;

  return (
    <Page
      title="Announcements"
      description="The thin rotating bar at the very top of every storefront page. Hidden messages stay saved but aren’t shown."
      actions={<Button variant="primary" icon="plus" onClick={() => setEditing({ ...EMPTY, order: nextOrder })}>New message</Button>}
    >
      <Loader loading={loading && !data} error={!data ? error : ''} onRetry={reload}>
        {data && (
          <div className="u-stack">
            <div className="u-grid main-side">
              <Card title="Live preview" subtitle="The top of the website as visitors see it right now">
                <BarPreview items={active} />
              </Card>
              <div className="u-stack tight">
                <Stat label="Showing now" icon="eye" tone="green" value={active.length} note="in rotation" />
                <Stat label="Hidden" icon="eyeoff" tone="gray" value={list.length - active.length} note="saved for later" />
              </div>
            </div>

            <Card title="All messages" subtitle="Shown in this order. Use the arrows to reorder and the switch to show or hide." flush>
              <DataTable
                rows={list}
                onRowClick={(a) => setEditing(a)}
                pageSize={20}
                exportName="announcements"
                search={{ placeholder: 'Search messages…', fields: ['text', 'link', 'icon'] }}
                filters={[{ key: 'status', label: 'All statuses', options: ['Active', 'Hidden'], test: (a, v) => (v === 'Active') === !!a.active }]}
                empty={
                  <EmptyState icon="megaphone" title="No announcements" actions={<Button variant="primary" icon="plus" onClick={() => setEditing({ ...EMPTY, order: 1 })}>New message</Button>}>
                    The top bar on the website stays hidden until you add a message — great for offers, delivery cut-offs and festive greetings.
                  </EmptyState>
                }
                columns={[
                  {
                    key: 'order', header: 'Position', shrink: true, sortable: true, sortValue: (a) => a.order,
                    render: (a) => (
                      <span className="w-pos" onClick={(e) => e.stopPropagation()}>
                        <b className="u-num u-strong" style={{ minWidth: 18 }}>{list.indexOf(a) + 1}</b>
                        <MoveButtons index={list.indexOf(a)} count={list.length} onMove={move} disabled={busy} />
                      </span>
                    ),
                  },
                  {
                    key: 'text', header: 'Message', sortable: true,
                    render: (a) => (
                      <span className="u-cell">
                        <span className="w-ann-ico" title={iconLabel(a.icon)}><StoreIcon name={a.icon} /></span>
                        <span className="u-cell-text"><b style={{ whiteSpace: 'normal' }}>{a.text}</b><span>{a.link ? `Links to ${a.link}` : 'No link'}</span></span>
                      </span>
                    ),
                  },
                  { key: 'icon', header: 'Icon', csv: (a) => a.icon, render: (a) => <span className="u-small u-muted">{iconLabel(a.icon)}</span> },
                  { key: 'updatedAt', header: 'Updated', sortable: true, csv: (a) => fmtDate(a.updatedAt), render: (a) => <span className="u-small u-muted">{fmtDate(a.updatedAt)}</span> },
                  {
                    key: 'active', header: 'Status', shrink: true, csv: (a) => (a.active ? 'Active' : 'Hidden'),
                    render: (a) => (
                      <span className="u-row" style={{ gap: 8, flexWrap: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                        <Switch checked={a.active} onChange={(v) => toggle(a, v)} />
                        <Status size="sm">{a.active ? 'Active' : 'Hidden'}</Status>
                      </span>
                    ),
                  },
                ]}
                rowActions={(a) => [
                  { label: 'Edit', icon: 'edit', onClick: () => setEditing(a) },
                  { label: a.active ? 'Hide from website' : 'Show on website', icon: a.active ? 'eyeoff' : 'eye', onClick: () => toggle(a, !a.active) },
                  { label: 'Duplicate', icon: 'copy', onClick: () => setEditing({ ...toPayload(a), active: false, order: nextOrder }) },
                  { divider: true },
                  { label: 'Delete', icon: 'trash', danger: true, onClick: () => remove(a) },
                ]}
              />
            </Card>
          </div>
        )}
      </Loader>

      {editing && (
        <AnnouncementEditor
          key={editing._id || 'new'}
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={(saved, isNew) => {
            setData((prev) => (isNew ? [...(prev || []), saved] : (prev || []).map((a) => (a._id === saved._id ? saved : a))));
            setEditing(null);
          }}
          onDelete={async () => { if (await remove(editing)) setEditing(null); }}
        />
      )}
    </Page>
  );
}

function AnnouncementEditor({ initial, onClose, onSaved, onDelete }) {
  const confirm = useConfirm();
  const isNew = !initial._id;
  const [form, setForm] = useState({ ...EMPTY, ...initial });
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);
  const dirty = JSON.stringify(toPayload(form)) !== JSON.stringify(toPayload({ ...EMPTY, ...initial }));
  useUnloadGuard(dirty);

  const errors = {
    text: !form.text.trim() ? 'Write the message' : form.text.length > MAX ? `Keep it under ${MAX} characters` : '',
    link: !isValidLink(form.link) ? 'Must start with / (a page on this site) or https://' : '',
  };
  const invalid = Object.values(errors).some(Boolean);

  const close = async () => {
    if (dirty && !(await confirm({ title: 'Discard changes?', message: 'Your edits to this message have not been saved.', confirmLabel: 'Discard', cancelLabel: 'Keep editing', danger: true }))) return;
    onClose();
  };

  const save = async () => {
    setTried(true);
    if (invalid) return;
    setSaving(true);
    try {
      const saved = isNew ? await announcementService.create(toPayload(form)) : await announcementService.update(initial._id, toPayload(form));
      toast.success(isNew ? 'Message added' : 'Message saved', saved.active ? 'Live in the top bar.' : 'Saved as hidden.');
      onSaved(saved, isNew);
    } catch (e) {
      toast.error('Could not save', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      open
      onClose={close}
      title={isNew ? 'New announcement' : 'Edit announcement'}
      description={isNew ? 'A short message for the rotating top bar.' : `Last updated ${fmtDate(initial.updatedAt)}`}
      footer={
        <>
          {!isNew && <Button variant="danger-soft" icon="trash" onClick={onDelete} disabled={saving}>Delete</Button>}
          <span className="u-spacer" />
          <Button onClick={close} disabled={saving}>Cancel</Button>
          <Button variant="primary" icon="check" onClick={save} loading={saving} disabled={!isNew && !dirty}>{isNew ? 'Add message' : 'Save'}</Button>
        </>
      }
    >
      <div className="u-stack">
        <div className="u-stack tight">
          <span className="u-label">Preview</span>
          <div className="w-browser">
            <div className="w-annbar"><span className="w-annbar-msg"><StoreIcon name={form.icon} size={15} />{form.text ? (form.link ? <u>{form.text}</u> : form.text) : <span style={{ opacity: 0.6 }}>Your message…</span>}</span></div>
          </div>
        </div>
        <Field label="Message" required error={tried ? errors.text : ''} hint={<span className={form.text.length > MAX ? 'u-error' : ''}>{form.text.length}/{MAX} characters</span>}>
          {(id) => <Textarea id={id} rows={2} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} placeholder="e.g. FIRST20 — 20% off your first order" error={tried && !!errors.text} style={{ minHeight: 64 }} autoFocus={isNew} />}
        </Field>
        <Field label="Icon" hint="Shown before the message. Use the pure-veg mark for veg claims.">
          <IconPicker value={form.icon} onChange={(icon) => setForm({ ...form, icon })} options={BAR_ICONS} allowVeg />
        </Field>
        <div className="u-form-grid two">
          <Field label="Link (optional)" error={errors.link} hint={errors.link ? '' : 'Where the message goes when tapped.'}>
            {(id) => <Input id={id} icon="link" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="/shop or https://…" error={!!errors.link} />}
          </Field>
          <Field label="Position" hint="Lower numbers show first.">
            {(id) => <Input id={id} type="number" min="0" value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })} />}
          </Field>
        </div>
        <Switch checked={form.active} onChange={(active) => setForm({ ...form, active })} label="Show on the website" description={form.active ? 'This message rotates in the top bar.' : 'Saved but hidden from visitors.'} />
      </div>
    </Drawer>
  );
}
