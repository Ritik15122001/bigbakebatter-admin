import { useEffect, useMemo, useState } from 'react';
import Icon from '../components/common/Icon';
import {
  Page, Card, Button, Drawer, Field, Input, Textarea, Segmented, Status, Menu, EmptyState, Loader, Alert, KeyValue,
  ImageUpload, useConfirm, toast, useAsync,
} from '../ui';
import { MoveButtons } from '../ui/ext-web';
import { STOREFRONT_URL, isValidLink, useUnloadGuard } from '../ui/ext-web-utils';
import { bannerService, toBannerPayload } from '../services/bannerService';
import { resolveImg } from '../utils/media';
import { fmtDate } from '../utils/format';

/** The API requires an image, so a draft saved without a photo keeps this placeholder until one is uploaded. */
const PLACEHOLDER_IMG = 'https://placehold.co/1200x600?text=Banner';
const hasPhoto = (b) => !!b?.img && b.img !== PLACEHOLDER_IMG;
const STATUSES = ['Published', 'Draft', 'Inactive'];
const STATUS_NOTE = {
  Published: 'Showing in the homepage slider.',
  Draft: 'Saved but not on the website yet.',
  Inactive: 'Switched off — kept for later.',
};
const EMPTY = { kicker: '', headline: '', sub: '', cta: 'Shop now', ctaHref: '/shop', badge: ['', ''], status: 'Draft', img: '' };
const sortBanners = (list) => [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
const editable = (b) => JSON.stringify(toBannerPayload({ ...b, order: 0 }));

/* ---------------- storefront hero mock ---------------- */

function HeroSlide({ banner }) {
  const img = hasPhoto(banner) ? resolveImg(banner.img) : '';
  return (
    <div className="w-hero">
      {img && <img src={img} alt="" />}
      {(banner.badge?.[0] || banner.badge?.[1]) && (
        <span className="w-hero-badge"><b>{banner.badge?.[0]}</b><span>{banner.badge?.[1]}</span></span>
      )}
      <div className="w-hero-copy">
        {banner.kicker && <span className="w-hero-kicker">{banner.kicker}</span>}
        <h3>{banner.headline || 'Your headline goes here'}</h3>
        {banner.sub && <p>{banner.sub}</p>}
        {banner.cta && <span className="w-hero-cta">{banner.cta}<Icon name="aright" /></span>}
      </div>
    </div>
  );
}

function HeroPreview({ banners }) {
  const [i, setI] = useState(0);
  const n = banners.length;
  useEffect(() => {
    if (n < 2) return undefined;
    const t = setInterval(() => setI((x) => (x + 1) % n), 5000);
    return () => clearInterval(t);
  }, [n]);
  const cur = banners[Math.min(i, n - 1)];
  return (
    <div className="w-browser">
      <div className="w-browser-bar">
        <span><i /><i /><i /></span>
        <span className="w-browser-url">{STOREFRONT_URL.replace(/^https?:\/\//, '')}/</span>
      </div>
      {cur ? (
        <div style={{ position: 'relative' }}>
          <HeroSlide key={cur._id} banner={cur} />
          {n > 1 && (
            <div className="w-hero-dots">
              {banners.map((b, j) => <button key={b._id} type="button" className={j === i ? 'on' : ''} aria-label={`Show banner ${j + 1}`} onClick={() => setI(j)} />)}
            </div>
          )}
        </div>
      ) : (
        <div className="w-hero"><div className="w-hero-empty"><b>No published banners</b><br />The homepage slider is hidden until you publish one.</div></div>
      )}
    </div>
  );
}

/* ---------------- page ---------------- */

export default function Banners() {
  const confirm = useConfirm();
  const { data, setData, loading, error, reload } = useAsync(bannerService.list);
  const list = useMemo(() => sortBanners(data || []), [data]);
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [moving, setMoving] = useState(false);
  const [editing, setEditing] = useState(null); // { original, form }

  const live = list.filter((b) => b.status === 'Published');
  const counts = Object.fromEntries(STATUSES.map((s) => [s, list.filter((b) => b.status === s).length]));
  const needle = q.trim().toLowerCase();
  const shown = list.filter((b) => (filter === 'all' || b.status === filter) && (!needle || `${b.kicker} ${b.headline} ${b.sub} ${b.cta}`.toLowerCase().includes(needle)));
  const canMove = filter === 'all' && !needle;

  const replace = (updated) => setData((prev) => (prev || []).map((b) => (b._id === updated._id ? updated : b)));

  const move = async (index, dir) => {
    if (moving) return;
    setMoving(true);
    try {
      setData(await bannerService.reorder(list[index]._id, dir));
    } catch (e) {
      toast.error('Could not reorder', e.message);
    } finally {
      setMoving(false);
    }
  };

  const setStatus = async (b, status) => {
    if (status === 'Published' && !hasPhoto(b)) {
      toast.error('Add a real photo first', 'This banner still uses the placeholder picture.');
      return;
    }
    try {
      replace(await bannerService.update(b._id, { status }));
      toast.success(status === 'Published' ? 'Banner published' : status === 'Draft' ? 'Moved to drafts' : 'Banner deactivated', STATUS_NOTE[status]);
    } catch (e) {
      toast.error('Could not update banner', e.message);
    }
  };

  const remove = async (b) => {
    const ok = await confirm({
      title: 'Delete this banner?',
      message: `“${b.headline}” will be removed from the homepage permanently.`,
      confirmLabel: 'Delete banner', danger: true,
    });
    if (!ok) return false;
    try {
      await bannerService.remove(b._id);
      setData((prev) => (prev || []).filter((x) => x._id !== b._id));
      toast.success('Banner deleted');
      return true;
    } catch (e) {
      toast.error('Could not delete', e.message);
      return false;
    }
  };

  const openNew = () => setEditing({ original: null, form: { ...EMPTY, badge: ['', ''] } });
  const openEdit = (b) => setEditing({ original: b, form: { ...b, badge: [b.badge?.[0] || '', b.badge?.[1] || ''], img: hasPhoto(b) ? b.img : '' } });

  return (
    <Page
      title="Homepage banners"
      description="The big sliding pictures at the top of the homepage. Only published banners are shown, in this order."
      actions={<Button variant="primary" icon="plus" onClick={openNew}>Add banner</Button>}
    >
      <Loader loading={loading && !data} error={!data ? error : ''} onRetry={reload} rows={6}>
        {data && (
          <div className="u-stack">
            <div className="u-grid main-side">
              <Card title="Live preview" subtitle={live.length ? `What visitors see now · ${live.length} slide${live.length === 1 ? '' : 's'}, changing every 5 seconds` : 'Nothing is published yet'}>
                <HeroPreview banners={live} />
              </Card>
              <Card title="At a glance" subtitle="Banners by status">
                <div className="u-stack tight">
                  <KeyValue items={STATUSES.map((s) => [s, <Status key={s} tone={s === 'Published' ? 'green' : 'gray'} plain>{counts[s]} {counts[s] === 1 ? 'banner' : 'banners'}</Status>])} />
                  {live.some((b) => !hasPhoto(b)) && <Alert tone="amber" icon="alert" title="Placeholder photo live">A published banner is still using the placeholder picture.</Alert>}
                  <Alert tone="blue" icon="info">Wide landscape photos work best — about 1600 × 800 px, subject on the right so the text stays readable.</Alert>
                  <Button as="a" href={`${STOREFRONT_URL}/`} target="_blank" rel="noreferrer" icon="external" block>Open homepage</Button>
                </div>
              </Card>
            </div>

            <Card
              title="All banners"
              subtitle={canMove ? 'Use the arrows to change the slide order.' : 'Clear the filter to reorder banners.'}
              actions={
                <>
                  <Input icon="search" placeholder="Search banners…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 220 }} />
                  <Segmented
                    value={filter}
                    onChange={setFilter}
                    items={[{ value: 'all', label: 'All', count: list.length }, ...STATUSES.map((s) => ({ value: s, label: s, count: counts[s] }))]}
                  />
                </>
              }
            >
              {list.length === 0 ? (
                <EmptyState icon="image" title="No banners yet" actions={<Button variant="primary" icon="plus" onClick={openNew}>Add banner</Button>}>
                  Banners are the large photos that slide across the top of the homepage. Add one to feature a cake, offer or season.
                </EmptyState>
              ) : shown.length === 0 ? (
                <EmptyState icon="search" title="No banners match" actions={<Button size="sm" onClick={() => { setFilter('all'); setQ(''); }}>Clear filters</Button>}>Try another status or search.</EmptyState>
              ) : (
                <div className="w-banners">
                  {shown.map((b) => {
                    const idx = list.indexOf(b);
                    return (
                      <article key={b._id} className="w-bcard" onClick={() => openEdit(b)}>
                        <div className="w-bcard-img">
                          {hasPhoto(b) ? <img src={resolveImg(b.img)} alt="" loading="lazy" /> : <span className="u-stack tight" style={{ alignItems: 'center', gap: 4 }}><Icon name="image" /><span className="u-xs">No photo yet</span></span>}
                          <span className="w-bcard-pos" title="Slide position">#{idx + 1}</span>
                          <span className="w-bcard-status"><Status size="sm">{b.status}</Status></span>
                        </div>
                        <div className="w-bcard-body">
                          {b.kicker && <span className="u-xs">{b.kicker}</span>}
                          <b>{b.headline}</b>
                          <span className="u-small u-muted">{b.cta ? <>Button “{b.cta}” → <span className="u-mono">{b.ctaHref || '/'}</span></> : 'No button'}</span>
                        </div>
                        <div className="w-bcard-foot" onClick={(e) => e.stopPropagation()}>
                          <span className="u-xs u-faint">Updated {fmtDate(b.updatedAt)}</span>
                          <span className="u-spacer" />
                          {canMove && <MoveButtons index={idx} count={list.length} onMove={move} disabled={moving} />}
                          <Menu
                            items={[
                              { label: 'Edit banner', icon: 'edit', onClick: () => openEdit(b) },
                              b.status !== 'Published' && { label: 'Publish', icon: 'eye', onClick: () => setStatus(b, 'Published') },
                              b.status === 'Published' && { label: 'Deactivate', icon: 'eyeoff', onClick: () => setStatus(b, 'Inactive') },
                              b.status !== 'Draft' && { label: 'Move to drafts', icon: 'file', onClick: () => setStatus(b, 'Draft') },
                              { divider: true },
                              { label: 'Delete', icon: 'trash', danger: true, onClick: () => remove(b) },
                            ]}
                          />
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        )}
      </Loader>

      {editing && (
        <BannerEditor
          key={editing.original?._id || 'new'}
          original={editing.original}
          initial={editing.form}
          nextOrder={list.length ? Math.max(...list.map((b) => b.order || 0)) + 1 : 1}
          onClose={() => setEditing(null)}
          onSaved={(b, isNew) => {
            if (isNew) setData((prev) => [...(prev || []), b]);
            else replace(b);
            setEditing(null);
          }}
          onDelete={async () => { if (await remove(editing.original)) setEditing(null); }}
        />
      )}
    </Page>
  );
}

/* ---------------- editor drawer ---------------- */

function BannerEditor({ original, initial, nextOrder, onClose, onSaved, onDelete }) {
  const confirm = useConfirm();
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);
  const isNew = !original;
  const dirty = editable(form) !== editable(initial);
  useUnloadGuard(dirty);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setBadge = (i) => (e) => setForm((f) => ({ ...f, badge: f.badge.map((x, j) => (j === i ? e.target.value : x)) }));

  const errors = {
    headline: !form.headline.trim() ? 'Add a headline' : '',
    ctaHref: !isValidLink(form.ctaHref) ? 'Must start with / (a page on this site) or https://' : '',
    img: form.status === 'Published' && !form.img ? 'Upload a photo before publishing' : '',
  };
  const invalid = Object.values(errors).some(Boolean);

  const close = async () => {
    if (dirty && !(await confirm({ title: 'Discard changes?', message: 'Your edits to this banner have not been saved.', confirmLabel: 'Discard', cancelLabel: 'Keep editing', danger: true }))) return;
    onClose();
  };

  const save = async () => {
    setTried(true);
    if (invalid) {
      toast.error('Check the highlighted fields', Object.values(errors).find(Boolean));
      return;
    }
    setSaving(true);
    try {
      const payload = toBannerPayload({ ...form, img: form.img || PLACEHOLDER_IMG, order: isNew ? nextOrder : original.order });
      const saved = isNew ? await bannerService.create(payload) : await bannerService.update(original._id, payload);
      toast.success(isNew ? 'Banner added' : 'Banner saved', STATUS_NOTE[saved.status]);
      onSaved(saved, isNew);
    } catch (e) {
      toast.error('Could not save banner', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      open
      onClose={close}
      width={640}
      title={isNew ? 'New banner' : 'Edit banner'}
      description={isNew ? 'Add a slide to the homepage hero.' : `Last updated ${fmtDate(original.updatedAt)}`}
      footer={
        <>
          {!isNew && <Button variant="danger-soft" icon="trash" onClick={onDelete} disabled={saving}>Delete</Button>}
          <span className="u-spacer" />
          <Button onClick={close} disabled={saving}>Cancel</Button>
          <Button variant="primary" icon="check" onClick={save} loading={saving} disabled={!isNew && !dirty}>{isNew ? 'Add banner' : 'Save banner'}</Button>
        </>
      }
    >
      <div className="u-stack">
        <div className="u-stack tight">
          <span className="u-label">Preview</span>
          <div className="w-browser"><HeroSlide banner={{ ...form, img: form.img }} /></div>
        </div>

        <Field label="Status" hint={STATUS_NOTE[form.status]}>
          <Segmented value={form.status} onChange={(status) => setForm((f) => ({ ...f, status }))} items={STATUSES.map((s) => ({ value: s, label: s }))} />
        </Field>

        <Field label="Photo" required={form.status === 'Published'} error={tried ? errors.img : ''} hint="Wide landscape photo, about 1600 × 800 px.">
          <ImageUpload value={form.img} onChange={(img) => setForm((f) => ({ ...f, img }))} />
        </Field>
        {!form.img && form.status !== 'Published' && (
          <Alert tone="amber" icon="image">No photo yet — you can save this as a draft, but it can’t be published until a real photo is added.</Alert>
        )}

        <Field label="Kicker" hint="Small script line above the headline.">
          {(id) => <Input id={id} value={form.kicker} onChange={set('kicker')} placeholder="e.g. Made for the moment" maxLength={60} />}
        </Field>
        <Field label="Headline" required error={tried ? errors.headline : ''}>
          {(id) => <Textarea id={id} rows={2} value={form.headline} onChange={set('headline')} placeholder="e.g. Freshly baked cakes for life's sweetest celebrations" error={tried && !!errors.headline} style={{ minHeight: 64 }} />}
        </Field>
        <Field label="Supporting text">
          {(id) => <Textarea id={id} rows={2} value={form.sub} onChange={set('sub')} placeholder="A short line shown under the headline" style={{ minHeight: 64 }} />}
        </Field>
        <div className="u-form-grid two">
          <Field label="Button label" hint="Leave empty to hide the button.">
            {(id) => <Input id={id} value={form.cta} onChange={set('cta')} placeholder="e.g. Shop now" />}
          </Field>
          <Field label="Button link" error={errors.ctaHref}>
            {(id) => <Input id={id} icon="link" value={form.ctaHref} onChange={set('ctaHref')} placeholder="/shop or https://…" error={!!errors.ctaHref} />}
          </Field>
          <Field label="Badge value" hint="Big text in the round sticker, e.g. 20%.">
            {(id) => <Input id={id} value={form.badge[0]} onChange={setBadge(0)} placeholder="e.g. 20%" maxLength={8} />}
          </Field>
          <Field label="Badge label" hint="Small text under it. Leave both empty for no badge.">
            {(id) => <Input id={id} value={form.badge[1]} onChange={setBadge(1)} placeholder="e.g. Off first order" maxLength={24} />}
          </Field>
        </div>
      </div>
    </Drawer>
  );
}
