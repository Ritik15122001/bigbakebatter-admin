import { useCallback, useEffect, useState } from 'react';
import Icon from '../components/common/Icon';
import Modal from '../components/common/Modal';
import ImageField from '../components/common/ImageField';
import { bannerService } from '../services/bannerService';
import { useUiStore } from '../store/uiStore';
import { resolveImg } from '../utils/media';

/** The API requires an image, so a brand-new banner starts with this until a photo is uploaded. */
const PLACEHOLDER_IMG = 'https://placehold.co/1200x600?text=Banner';
const EDITABLE = ['kicker', 'headline', 'sub', 'cta', 'ctaHref', 'badge', 'status', 'order', 'img'];

/** Only the fields the API accepts — never _id, __v or timestamps. */
const toPayload = (b) => ({
  kicker: b.kicker || '',
  headline: (b.headline || '').trim(),
  sub: b.sub || '',
  cta: b.cta || '',
  ctaHref: (b.ctaHref || '').trim(),
  badge: [b.badge?.[0] || '', b.badge?.[1] || ''],
  status: b.status,
  order: Number(b.order) || 0,
  img: b.img,
});
const contentOf = (b) => JSON.stringify(EDITABLE.filter((k) => k !== 'order').map((k) => b?.[k] ?? null));
const isValidLink = (v) => !v || v.startsWith('/') || /^https?:\/\//i.test(v);

export default function Banners() {
  const pushToast = useUiStore((s) => s.pushToast);
  const [list, setList] = useState([]);
  const [saved, setSaved] = useState({}); // id -> last saved version
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [activeId, setActiveId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [moving, setMoving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [removing, setRemoving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError('');
    bannerService
      .list()
      .then((banners) => {
        const sorted = [...banners].sort((a, b) => a.order - b.order);
        setList(sorted);
        setSaved(Object.fromEntries(sorted.map((b) => [b._id, b])));
        setActiveId((cur) => (cur && sorted.some((b) => b._id === cur) ? cur : sorted[0]?._id));
      })
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const active = list.find((b) => b._id === activeId);
  const isDirty = (b) => !!b && contentOf(b) !== contentOf(saved[b._id]);
  const activeDirty = isDirty(active);

  const update = (patch) => setList((prev) => prev.map((b) => (b._id === activeId ? { ...b, ...patch } : b)));

  const move = async (id, direction) => {
    if (moving) return;
    setMoving(true);
    try {
      const updated = await bannerService.reorder(id, direction);
      // Take the new order from the server but keep any unsaved edits in the editor.
      const orderById = new Map(updated.map((u) => [u._id, u.order]));
      setList((prev) => prev.map((b) => (orderById.has(b._id) ? { ...b, order: orderById.get(b._id) } : b)).sort((a, b) => a.order - b.order));
      setSaved((prev) => Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, orderById.has(k) ? { ...v, order: orderById.get(k) } : v])));
    } catch (e) {
      pushToast({ title: 'Could not reorder', subtitle: e.message, kind: 'err' });
    } finally {
      setMoving(false);
    }
  };

  const save = async (status) => {
    if (!active || saving) return;
    const payload = toPayload({ ...active, status });
    if (!payload.headline) return pushToast({ title: 'Add a headline first', kind: 'err' });
    if (!payload.img) return pushToast({ title: 'Add a photo first', kind: 'err' });
    if (!isValidLink(payload.ctaHref)) return pushToast({ title: 'Button link must start with / or https://', kind: 'err' });
    if (status === 'Published' && payload.img === PLACEHOLDER_IMG) {
      return pushToast({ title: 'Upload a real photo before publishing', subtitle: 'This banner still has the placeholder image.', kind: 'err' });
    }
    setSaving(true);
    try {
      const updated = await bannerService.update(active._id, payload);
      setList((prev) => prev.map((b) => (b._id === updated._id ? updated : b)));
      setSaved((prev) => ({ ...prev, [updated._id]: updated }));
      pushToast({ title: `Banner ${status === 'Published' ? 'published' : status === 'Draft' ? 'saved as draft' : 'deactivated'}`, kind: 'ok' });
    } catch (e) {
      pushToast({ title: 'Save failed', subtitle: e.message, kind: 'err' });
    } finally {
      setSaving(false);
    }
  };

  const revert = () => {
    if (!active) return;
    setList((prev) => prev.map((b) => (b._id === active._id ? { ...saved[b._id], order: b.order } : b)));
  };

  const addBanner = async () => {
    setAdding(true);
    try {
      const created = await bannerService.create({
        kicker: 'New banner',
        headline: 'New banner headline',
        sub: '',
        cta: 'Shop now',
        ctaHref: '/shop',
        badge: ['', ''],
        status: 'Draft',
        order: list.length ? Math.max(...list.map((b) => b.order || 0)) + 1 : 0,
        img: PLACEHOLDER_IMG,
      });
      setList((prev) => [...prev, created]);
      setSaved((prev) => ({ ...prev, [created._id]: created }));
      setActiveId(created._id);
      pushToast({ title: 'Banner added as a draft', subtitle: 'Upload a photo, edit the text, then Publish.', kind: 'ok' });
    } catch (e) {
      pushToast({ title: 'Could not add banner', subtitle: e.message, kind: 'err' });
    } finally {
      setAdding(false);
    }
  };

  const confirmDelete = async () => {
    setRemoving(true);
    try {
      await bannerService.remove(deleting._id);
      const next = list.filter((b) => b._id !== deleting._id);
      setList(next);
      setActiveId((cur) => (cur === deleting._id ? next[0]?._id : cur));
      pushToast({ title: 'Banner deleted', kind: 'info' });
      setDeleting(null);
    } catch (e) {
      pushToast({ title: 'Delete failed', subtitle: e.message, kind: 'err' });
    } finally {
      setRemoving(false);
    }
  };

  if (loading) return <div className="a-panel a-empty"><p className="muted">Loading…</p></div>;
  if (loadError) {
    return (
      <div className="a-panel a-empty">
        <p className="muted">Could not load banners: {loadError}</p>
        <button className="btn btn-outline btn-sm" onClick={load}>Try again</button>
      </div>
    );
  }

  const previewImg = active?.img ? resolveImg(active.img) : '';

  return (
    <div className="a-grid-2">
      <div className="a-panel">
        <div className="a-panel-head">
          <h3>Homepage banners</h3>
          <button className="btn btn-primary btn-sm" onClick={addBanner} disabled={adding}>
            <Icon name="plus" className="icon icon-sm" />
            {adding ? 'Adding…' : 'Add banner'}
          </button>
        </div>
        <p className="a-intro">The big sliding pictures at the top of the homepage. Only <b>Published</b> banners are shown, in this order.</p>
        <div className="banner-list" style={{ padding: 'var(--s-5)' }}>
          {list.length === 0 && <p className="muted">No banners yet. Add one to feature it on the homepage.</p>}
          {list.map((b, i) => (
            <div key={b._id} className={`banner-item ${b._id === activeId ? 'on' : ''}`} onClick={() => setActiveId(b._id)}>
              <span className="bth">
                {b.img && <img src={resolveImg(b.img)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              </span>
              <span className="stack gap-1 grow" style={{ minWidth: 0 }}>
                <b className="small banner-item-title">{b.headline || 'Untitled banner'}</b>
                <span className="row gap-2 wrap">
                  <span className={`badge ${b.status === 'Published' ? 'success' : 'neutral'}`}>{b.status}</span>
                  {isDirty(b) && <span className="badge warn">Unsaved</span>}
                </span>
              </span>
              <span className="stack gap-1" onClick={(e) => e.stopPropagation()}>
                <button className="iconbtn" aria-label="Move up" disabled={moving || i === 0} onClick={() => move(b._id, -1)}>
                  <Icon name="arrowup" className="icon icon-sm" />
                </button>
                <button className="iconbtn" aria-label="Move down" disabled={moving || i === list.length - 1} onClick={() => move(b._id, 1)}>
                  <Icon name="arrowdown" className="icon icon-sm" />
                </button>
                <button className="iconbtn danger" aria-label="Delete banner" onClick={() => setDeleting(b)}>
                  <Icon name="trash" className="icon icon-sm" />
                </button>
              </span>
            </div>
          ))}
        </div>
      </div>

      {active && (
        <div className="stack gap-5">
          <div className="a-panel">
            <div className="a-panel-head">
              <h3>Edit banner</h3>
              {activeDirty ? <span className="badge warn">Unsaved changes</span> : <span className={`badge ${active.status === 'Published' ? 'success' : 'neutral'}`}>{active.status}</span>}
            </div>
            <form className="stack gap-4" style={{ padding: 'var(--s-5)' }} onSubmit={(e) => e.preventDefault()}>
              <div className="field">
                <label>Photo</label>
                <ImageField value={active.img === PLACEHOLDER_IMG ? '' : active.img} onChange={(url) => update({ img: url || PLACEHOLDER_IMG })} onUploadingChange={setUploading} previewWidth={180} previewHeight={90} />
                {active.img === PLACEHOLDER_IMG && <span className="field-hint field-err">Still using the placeholder picture — upload a photo before publishing.</span>}
                <span className="field-hint">Wide landscape photos work best (about 1600 × 800).</span>
              </div>
              <div className="field">
                <label>Kicker</label>
                <input className="input" value={active.kicker || ''} onChange={(e) => update({ kicker: e.target.value })} placeholder="e.g. Made for the moment" />
              </div>
              <div className="field">
                <label>Headline *</label>
                <textarea className="textarea" rows={2} value={active.headline || ''} onChange={(e) => update({ headline: e.target.value })} placeholder="e.g. Freshly baked cakes for life's sweetest celebrations" />
              </div>
              <div className="field">
                <label>Subtext</label>
                <textarea className="textarea" rows={2} value={active.sub || ''} onChange={(e) => update({ sub: e.target.value })} placeholder="A short supporting line shown under the headline" />
              </div>
              <div className="form-grid two">
                <div className="field">
                  <label>Button label</label>
                  <input className="input" value={active.cta || ''} onChange={(e) => update({ cta: e.target.value })} placeholder="e.g. Shop now" />
                </div>
                <div className="field">
                  <label>Button link</label>
                  <input className="input" value={active.ctaHref || ''} onChange={(e) => update({ ctaHref: e.target.value })} placeholder="/shop or https://…" />
                  {!isValidLink(active.ctaHref || '') && <span className="field-hint field-err">Must start with / or https://</span>}
                </div>
                <div className="field">
                  <label>Badge value</label>
                  <input className="input" value={active.badge?.[0] || ''} onChange={(e) => update({ badge: [e.target.value, active.badge?.[1] || ''] })} placeholder="e.g. 20%" />
                </div>
                <div className="field">
                  <label>Badge label</label>
                  <input className="input" value={active.badge?.[1] || ''} onChange={(e) => update({ badge: [active.badge?.[0] || '', e.target.value] })} placeholder="e.g. OFF FIRST ORDER" />
                </div>
              </div>
              <div className="row gap-3 wrap">
                <button type="button" className="btn btn-outline" disabled={saving || uploading} onClick={() => save('Draft')}>{saving ? 'Saving…' : 'Save as draft'}</button>
                <button type="button" className="btn btn-primary" disabled={saving || uploading} onClick={() => save('Published')}>{active.status === 'Published' ? 'Save & keep live' : 'Publish'}</button>
                {active.status === 'Published' && (
                  <button type="button" className="btn btn-ghost" disabled={saving || uploading} onClick={() => save('Inactive')}>Deactivate</button>
                )}
                {activeDirty && <button type="button" className="btn btn-ghost" disabled={saving} onClick={revert}>Undo changes</button>}
              </div>
            </form>
          </div>

          <div className="preview-frame">
            <div className="preview-bar">
              <span className="dots"><i /><i /><i /></span>
              <span className="url">bigbakebatter.com</span>
            </div>
            <div className="preview-hero">
              <span className="ph-bg">
                {previewImg && <img src={previewImg} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              </span>
              <div className="ph-copy">
                <span className="kicker kicker-script" style={{ color: '#fff' }}>{active.kicker}</span>
                <h3>{active.headline}</h3>
                <p>{active.sub}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <Modal
        open={!!deleting}
        onClose={() => !removing && setDeleting(null)}
        kicker="Confirm"
        title={`Delete "${deleting?.headline}"?`}
        foot={
          <>
            <button className="btn btn-ghost" onClick={() => setDeleting(null)} disabled={removing}>Cancel</button>
            <button className="btn btn-primary" style={{ background: 'var(--c-error)' }} onClick={confirmDelete} disabled={removing}>{removing ? 'Deleting…' : 'Delete'}</button>
          </>
        }
      >
        <p className="muted">This removes the banner permanently from the homepage.</p>
      </Modal>
    </div>
  );
}
