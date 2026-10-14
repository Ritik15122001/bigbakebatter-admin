/**
 * Kit extensions for the catalogue screens (Cakes, Cake editor, Categories & stock,
 * Catalogue extras, Coupons). Built only on the `u-*` kit; styles in ext-cat.css.
 *
 *   IconGrid      – searchable icon picker grid (category / add-on group icons)
 *   Gallery       – multi-image uploader with reorder / set cover / remove / paste URL
 *   QtyStepper    – − / number / + quantity editor that commits on Enter or blur
 *   StarInput     – 1–5 star selector;  Stars – read-only star row
 *   ColorInput    – native colour picker + hex text field
 *   CopyButton    – copies text to the clipboard with a tick
 *   SaveBar       – sticky "Unsaved changes" bar with Discard / Save
 *   CakeCardPreview – how a cake card looks on the storefront
 *   ReviewCard / ReviewDrawer – testimonial preview and create/edit form (used by Cake editor + Catalogue extras)
 */
import { useEffect, useRef, useState } from 'react';
import Icon from '../components/common/Icon';
import { Button, Field, Input, Select, Status, Textarea } from './core';
import { Drawer } from './overlays';
import { toast } from './toast.jsx';
import { uploadService } from '../services/uploadService';
import { reviewService } from '../services/catalogService';
import { resolveImg } from '../utils/media';
import { money } from '../utils/format';
import './ext-cat.css';

const cx = (...c) => c.filter(Boolean).join(' ');

/* ---------------- Icon grid picker ---------------- */
export function IconGrid({ value, onChange, options = [] }) {
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const shown = options.filter((n) => !needle || n.includes(needle));
  return (
    <div className="u-x-icongrid-wrap">
      <div className="u-row" style={{ gap: 8 }}>
        <span className="u-x-icon-current" title={value}><Icon name={value || 'cake'} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Input icon="search" placeholder={`Filter ${options.length} icons…`} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <div className="u-x-icongrid" role="listbox" aria-label="Icon">
        {shown.map((n) => (
          <button
            key={n}
            type="button"
            role="option"
            aria-selected={n === value}
            title={n}
            className={cx('u-x-icon-opt', n === value && 'on')}
            onClick={() => onChange(n)}
          >
            <Icon name={n} />
            <span>{n}</span>
          </button>
        ))}
        {shown.length === 0 && <p className="u-small u-muted" style={{ gridColumn: '1 / -1', padding: 8 }}>No icon matches “{q}”.</p>}
      </div>
    </div>
  );
}

/* ---------------- Multi-image gallery ---------------- */
export function Gallery({ value = [], onChange, max = 12 }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(0);
  const [paste, setPaste] = useState('');
  const list = Array.isArray(value) ? value : [];

  const onFiles = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, Math.max(0, max - list.length));
    e.target.value = '';
    if (!files.length) return;
    setBusy(files.length);
    let next = [...list];
    for (const file of files) {
      try {
        const url = await uploadService.upload(file);
        next = [...next, url];
        onChange(next);
      } catch (err) {
        toast.error(`Couldn't upload ${file.name}`, err.message);
      }
      setBusy((b) => b - 1);
    }
  };
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const n = [...list];
    [n[i], n[j]] = [n[j], n[i]];
    onChange(n);
  };
  const cover = (i) => onChange([list[i], ...list.filter((_, k) => k !== i)]);
  const remove = (i) => onChange(list.filter((_, k) => k !== i));
  const addUrl = () => {
    const u = paste.trim();
    if (!/^https?:\/\/\S+$/.test(u)) { toast.error('Enter a full image URL', 'It should start with http:// or https://'); return; }
    onChange([...list, u]);
    setPaste('');
  };

  return (
    <div className="u-stack tight">
      <div className="u-x-gallery">
        {list.map((src, i) => (
          <figure key={`${src}-${i}`} className={cx('u-x-gal-item', i === 0 && 'cover')}>
            <img src={resolveImg(src)} alt={`Photo ${i + 1}`} />
            {i === 0 ? <span className="u-x-gal-badge">Cover</span> : <span className="u-x-gal-num">{i + 1}</span>}
            <div className="u-x-gal-bar">
              <button type="button" aria-label="Move left" title="Move left" disabled={i === 0} onClick={() => move(i, -1)}><Icon name="cleft" /></button>
              {i !== 0 && <button type="button" aria-label="Set as cover" title="Set as cover" onClick={() => cover(i)}><Icon name="star" /></button>}
              <button type="button" aria-label="Move right" title="Move right" disabled={i === list.length - 1} onClick={() => move(i, 1)}><Icon name="cright" /></button>
              <button type="button" aria-label="Remove photo" title="Remove" className="danger" onClick={() => remove(i)}><Icon name="trash" /></button>
            </div>
          </figure>
        ))}
        {list.length < max && (
          <button type="button" className="u-x-gal-add" onClick={() => ref.current?.click()} disabled={busy > 0}>
            {busy > 0 ? <span className="u-spin" /> : <Icon name="upload" />}
            <b>{busy > 0 ? `Uploading ${busy}…` : list.length ? 'Add photos' : 'Upload photos'}</b>
            <span className="u-xs">JPG, PNG, WebP · 5 MB each</span>
          </button>
        )}
        <input ref={ref} type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={onFiles} />
      </div>
      <div className="u-row" style={{ gap: 8, flexWrap: 'nowrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Input icon="link" placeholder="…or paste an image URL" value={paste} onChange={(e) => setPaste(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addUrl(); } }} />
        </div>
        <Button onClick={addUrl} disabled={!paste.trim()}>Add</Button>
      </div>
    </div>
  );
}

/* ---------------- Quantity stepper ---------------- */
export function QtyStepper({ value, onCommit, busy, saved, label = 'Quantity' }) {
  const [draft, setDraft] = useState(null);
  const cur = Number(value) || 0;
  const commit = (raw) => {
    setDraft(null);
    if (raw === '' || raw === null) return;
    const n = Math.max(0, Math.floor(Number(raw)));
    if (!Number.isFinite(n) || n === cur) return;
    onCommit(n);
  };
  return (
    <span className="u-x-qty" onClick={(e) => e.stopPropagation()}>
      <button type="button" aria-label="Decrease" disabled={busy || cur <= 0} onClick={() => onCommit(cur - 1)}><Icon name="minus" /></button>
      <input
        type="number" min="0" step="1" inputMode="numeric" aria-label={label}
        value={draft ?? String(cur)} disabled={busy}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => draft !== null && commit(draft)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') setDraft(null);
        }}
      />
      <button type="button" aria-label="Increase" disabled={busy} onClick={() => onCommit(cur + 1)}><Icon name="plus" /></button>
      <span className={cx('u-x-qty-state', busy && 'busy', saved && 'ok')} aria-live="polite">
        {busy ? <span className="u-spin" /> : saved ? <Icon name="check" /> : null}
      </span>
    </span>
  );
}

/* ---------------- Stars ---------------- */
export function Stars({ rating = 0, size }) {
  const r = Math.round(Number(rating) || 0);
  return (
    <span className={cx('u-x-stars', size)} aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => <Icon key={i} name="star" className={cx('icon', i <= r && 'on')} />)}
    </span>
  );
}

export function StarInput({ value, onChange }) {
  const [hover, setHover] = useState(0);
  const show = hover || Number(value) || 0;
  const words = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];
  return (
    <span className="u-row" style={{ gap: 10 }}>
      <span className="u-x-stars input" onMouseLeave={() => setHover(0)} role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((i) => (
          <button key={i} type="button" role="radio" aria-checked={Number(value) === i} aria-label={`${i} star${i > 1 ? 's' : ''}`} onMouseEnter={() => setHover(i)} onClick={() => onChange(i)}>
            <Icon name="star" className={cx('icon', i <= show && 'on')} />
          </button>
        ))}
      </span>
      <span className="u-small u-muted">{show ? `${show}/5 · ${words[show]}` : 'Pick a rating'}</span>
    </span>
  );
}

/* ---------------- Colour ---------------- */
export function ColorInput({ value, onChange, error }) {
  const v = value || '#E4CBA1';
  const valid = /^#[0-9a-f]{6}$/i.test(v);
  return (
    <div className="u-row" style={{ gap: 10, flexWrap: 'nowrap' }}>
      <label className="u-x-color" style={{ background: valid ? v : '#fff' }} title="Pick a colour">
        <input type="color" value={valid ? v : '#e4cba1'} onChange={(e) => onChange(e.target.value.toUpperCase())} aria-label="Colour picker" />
      </label>
      <div style={{ flex: 1 }}>
        <Input className="u-mono" value={value} onChange={(e) => onChange(e.target.value)} placeholder="#E4CBA1" error={error} maxLength={7} />
      </div>
    </div>
  );
}

/* ---------------- Copy ---------------- */
export function CopyButton({ text, label = 'Copy' }) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return undefined;
    const t = setTimeout(() => setDone(false), 1500);
    return () => clearTimeout(t);
  }, [done]);
  const copy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
    } catch {
      toast.error('Could not copy', 'Your browser blocked clipboard access.');
    }
  };
  return (
    <button type="button" className={cx('u-x-copy', done && 'ok')} onClick={copy} aria-label={`${label} ${text}`} title={done ? 'Copied' : label}>
      <Icon name={done ? 'check' : 'copy'} />
    </button>
  );
}

/* ---------------- Save bar ---------------- */
export function SaveBar({ dirty, saving, onSave, onDiscard, message = 'You have unsaved changes', saveLabel = 'Save changes' }) {
  if (!dirty && !saving) return null;
  return (
    <div className="u-x-savebar" role="region" aria-label="Unsaved changes">
      <span className="u-x-savebar-dot" />
      <span className="u-x-savebar-msg">{message}</span>
      <span className="u-spacer" />
      <Button variant="ghost" onClick={onDiscard} disabled={saving}>Discard</Button>
      <Button variant="primary" icon="check" onClick={onSave} loading={saving}>{saveLabel}</Button>
    </div>
  );
}

/* ---------------- Storefront cake card preview ---------------- */
export function CakeCardPreview({ name, flavour, img, tag, price, priceLabel = 'Starting at', rating, reviews, stock, qty, cat }) {
  const out = stock === 'Out of stock';
  return (
    <article className={cx('u-x-pcard', out && 'out')}>
      <div className="u-x-pcard-media">
        {img ? <img src={resolveImg(img)} alt="" /> : <span className="u-x-pcard-ph"><Icon name="cake" /><span>No photo yet</span></span>}
        <div className="u-x-pcard-badges">
          {tag && <span className={cx('u-x-pcard-tag', tag === 'Seasonal' && 'gold')}>{tag}</span>}
          {stock === 'Low stock' && <span className="u-x-pcard-tag warn">Only {qty} left</span>}
        </div>
        {out && <span className="u-x-pcard-out">Sold out</span>}
      </div>
      <div className="u-x-pcard-body">
        <b className="u-x-pcard-name">{name || 'Cake name'}</b>
        <span className="u-xs u-muted">{flavour || 'Flavour'}</span>
        <span className="u-row" style={{ gap: 6 }}>
          <Stars rating={rating} size="sm" />
          <span className="u-xs"><b className="u-strong">{Number(rating) || 0}</b> <span className="u-muted">({Number(reviews) || 0})</span></span>
        </span>
        <div className="u-row between" style={{ marginTop: 4 }}>
          <span className="u-x-pcard-price"><small>{priceLabel}</small><b>{money(Number(price) || 0)}</b></span>
          {out ? <Status tone="red" size="sm" plain>Sold out</Status> : cat ? <Status tone="gray" size="sm" plain>{cat}</Status> : null}
        </div>
      </div>
    </article>
  );
}

/* ---------------- Reviews ---------------- */
export function ReviewCard({ name, occ, rating, text, cake }) {
  return (
    <div className="u-x-review">
      <Stars rating={rating} />
      <p>“{text || 'The review text appears here.'}”</p>
      <span className="u-small"><b className="u-strong">{name || 'Customer name'}</b>{occ && <span className="u-muted"> · {occ}</span>}</span>
      {cake && <span className="u-xs u-muted">On {cake}</span>}
    </div>
  );
}

/**
 * Create / edit a review in a drawer.
 * review: existing review or null (new) · presetProduct: product _id to link new reviews to
 * products: [{_id, name}] for the cake select · onSaved(review)
 */
export function ReviewDrawer({ open, review, ...rest }) {
  if (!open) return null;
  return <ReviewForm key={review?._id || 'new'} review={review} {...rest} />;
}

function ReviewForm({ review, presetProduct = '', products = [], onClose, onSaved }) {
  const [form, setForm] = useState(() => ({
    name: review?.name || '', occ: review?.occ || '', rating: review?.rating || 5, text: review?.text || '',
    product: review ? (review.product ? String(review.product) : '') : presetProduct || '',
  }));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (patch) => { setForm((f) => ({ ...f, ...patch })); setErrors((e) => ({ ...e, ...Object.fromEntries(Object.keys(patch).map((k) => [k, ''])) })); };
  const sorted = [...products].sort((a, b) => a.name.localeCompare(b.name));
  const cakeName = products.find((p) => p._id === form.product)?.name;

  const save = async (e) => {
    e?.preventDefault();
    const errs = {};
    if (!form.name.trim()) errs.name = 'Enter the customer\'s name.';
    if (!form.text.trim()) errs.text = 'Write the review text.';
    if (!(form.rating >= 1 && form.rating <= 5)) errs.rating = 'Pick 1 to 5 stars.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const payload = { name: form.name.trim(), occ: form.occ.trim(), rating: Number(form.rating), text: form.text.trim(), product: form.product || null };
    setSaving(true);
    try {
      const saved = review ? await reviewService.update(review._id, payload) : await reviewService.create(payload);
      toast.success(review ? 'Review updated' : 'Review added', saved.name);
      onSaved?.(saved);
      onClose();
    } catch (err) {
      toast.error('Could not save review', err.message);
    } finally {
      setSaving(false);
    }
  };

  const formId = `review-form-${review?._id || 'new'}`;
  return (
    <Drawer
      open
      onClose={onClose}
      title={review ? 'Edit review' : 'Add a review'}
      description={review ? `By ${review.name} · added ${new Date(review.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : 'Testimonials appear on the homepage; linked ones also show first on that cake\'s page.'}
      width={520}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form={formId} variant="primary" icon="check" loading={saving}>{review ? 'Save review' : 'Add review'}</Button>
        </>
      }
    >
    <form id={formId} className="u-stack" onSubmit={save}>
      <div className="u-form-grid two">
        <Field label="Customer name" required error={errors.name}>
          {(id) => <Input id={id} value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Priya S." error={errors.name} autoFocus />}
        </Field>
        <Field label="Occasion" hint="Optional, e.g. Birthday">
          {(id) => <Input id={id} value={form.occ} onChange={(e) => set({ occ: e.target.value })} placeholder="Birthday" />}
        </Field>
      </div>
      <Field label="Rating" required error={errors.rating}>
        {() => <StarInput value={form.rating} onChange={(rating) => set({ rating })} />}
      </Field>
      <Field label="Review" required error={errors.text} hint={`${form.text.length} characters`}>
        {(id) => <Textarea id={id} rows={5} value={form.text} onChange={(e) => set({ text: e.target.value })} placeholder="The cake was gorgeous and tasted even better…" error={errors.text} />}
      </Field>
      <Field label="Cake" hint="Link the review to a cake to show it first on that cake's page.">
        {(id) => <Select id={id} value={form.product} onChange={(e) => set({ product: e.target.value })} options={[{ value: '', label: 'Not linked — general testimonial' }, ...sorted.map((p) => ({ value: p._id, label: p.name }))]} />}
      </Field>
      <div className="u-stack tight" style={{ gap: 8 }}>
        <span className="u-x-preview-label">Preview</span>
        <ReviewCard name={form.name} occ={form.occ} rating={form.rating} text={form.text} cake={cakeName} />
      </div>
    </form>
    </Drawer>
  );
}
