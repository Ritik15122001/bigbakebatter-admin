import { useEffect, useState } from 'react';
import Icon from '../components/common/Icon';
import Modal from '../components/common/Modal';
import { bannerService } from '../services/bannerService';
import { uploadService } from '../services/uploadService';
import { useUiStore } from '../store/uiStore';

export default function Banners() {
  const pushToast = useUiStore((s) => s.pushToast);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const load = () => {
    setLoading(true);
    bannerService
      .list()
      .then((banners) => {
        const sorted = [...banners].sort((a, b) => a.order - b.order);
        setList(sorted);
        setActiveId((cur) => cur || sorted[0]?._id);
      })
      .catch((e) => pushToast({ title: 'Failed to load banners', subtitle: e.message, kind: 'err' }))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const active = list.find((b) => b._id === activeId);

  const update = (patch) => setList((prev) => prev.map((b) => (b._id === activeId ? { ...b, ...patch } : b)));

  const move = async (id, direction) => {
    try {
      const updated = await bannerService.reorder(id, direction);
      setList([...updated].sort((a, b) => a.order - b.order));
    } catch (e) {
      pushToast({ title: 'Could not reorder', subtitle: e.message, kind: 'err' });
    }
  };

  const save = async (status) => {
    try {
      const updated = await bannerService.update(activeId, { ...active, status });
      setList((prev) => prev.map((b) => (b._id === activeId ? updated : b)));
      pushToast({ title: `Banner ${status === 'Published' ? 'published' : status === 'Draft' ? 'saved as draft' : 'deactivated'}`, kind: 'ok' });
    } catch (e) {
      pushToast({ title: 'Save failed', subtitle: e.message, kind: 'err' });
    }
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
        order: list.length,
        img: 'https://placehold.co/1200x600?text=Banner',
      });
      setList((prev) => [...prev, created]);
      setActiveId(created._id);
      pushToast({ title: 'Banner added', kind: 'ok' });
    } catch (e) {
      pushToast({ title: 'Could not add banner', subtitle: e.message, kind: 'err' });
    } finally {
      setAdding(false);
    }
  };

  const confirmDelete = async () => {
    try {
      await bannerService.remove(deleting._id);
      setList((prev) => {
        const next = prev.filter((b) => b._id !== deleting._id);
        setActiveId((cur) => (cur === deleting._id ? next[0]?._id : cur));
        return next;
      });
      pushToast({ title: 'Banner deleted', kind: 'info' });
      setDeleting(null);
    } catch (e) {
      pushToast({ title: 'Delete failed', subtitle: e.message, kind: 'err' });
    }
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !active) return;
    setUploading(true);
    try {
      const url = await uploadService.upload(file);
      update({ img: url });
    } catch (err) {
      pushToast({ title: 'Upload failed', subtitle: err.message, kind: 'err' });
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div className="a-panel a-empty"><p className="muted">Loading…</p></div>;

  return (
    <div className="a-grid-2">
      <div className="a-panel">
        <div className="a-panel-head">
          <h3>Homepage banners</h3>
          <button className="btn btn-primary btn-sm" onClick={addBanner} disabled={adding}>
            <Icon name="plus" className="icon icon-sm" />
            Add banner
          </button>
        </div>
        <div className="banner-list" style={{ padding: 'var(--s-5)' }}>
          {list.length === 0 && <p className="muted">No banners yet. Add one to feature it on the homepage.</p>}
          {list.map((b) => (
            <div key={b._id} className={`banner-item ${b._id === activeId ? 'on' : ''}`} onClick={() => setActiveId(b._id)}>
              <span className="bth">
                {b.img && <img src={b.img} alt={b.headline} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              </span>
              <span className="stack gap-1 grow">
                <b className="small">{b.headline}</b>
                <span className={`badge ${b.status === 'Published' ? 'success' : 'neutral'}`} style={{ alignSelf: 'flex-start' }}>{b.status}</span>
              </span>
              <span className="stack gap-1" onClick={(e) => e.stopPropagation()}>
                <button className="iconbtn" aria-label="Move up" onClick={() => move(b._id, -1)}>
                  <Icon name="arrowup" className="icon icon-sm" />
                </button>
                <button className="iconbtn" aria-label="Move down" onClick={() => move(b._id, 1)}>
                  <Icon name="arrowdown" className="icon icon-sm" />
                </button>
                <button className="iconbtn danger" aria-label="Delete banner" onClick={() => setDeleting(b)}>
                  <Icon name="x" className="icon icon-sm" />
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
            </div>
            <form className="stack gap-4" style={{ padding: 'var(--s-5)' }} onSubmit={(e) => e.preventDefault()}>
              <div className="field">
                <label>Photo</label>
                <label className="dropzone" style={{ display: 'block', padding: 16 }}>
                  {uploading ? 'Uploading…' : 'Change photo'}
                  <input type="file" accept="image/*" className="sr-only" onChange={handleFile} />
                </label>
              </div>
              <div className="field">
                <label>Kicker</label>
                <input className="input" value={active.kicker} onChange={(e) => update({ kicker: e.target.value })} placeholder="e.g. Made for the moment" />
              </div>
              <div className="field">
                <label>Headline</label>
                <textarea className="textarea" rows={2} value={active.headline} onChange={(e) => update({ headline: e.target.value })} placeholder="e.g. Freshly baked cakes for life's sweetest celebrations" />
              </div>
              <div className="field">
                <label>Subtext</label>
                <textarea className="textarea" rows={2} value={active.sub} onChange={(e) => update({ sub: e.target.value })} placeholder="A short supporting line shown under the headline" />
              </div>
              <div className="form-grid two">
                <div className="field">
                  <label>CTA label</label>
                  <input className="input" value={active.cta} onChange={(e) => update({ cta: e.target.value })} placeholder="e.g. Shop now" />
                </div>
                <div className="field">
                  <label>CTA link</label>
                  <input className="input" value={active.ctaHref} onChange={(e) => update({ ctaHref: e.target.value })} placeholder="/shop" />
                </div>
                <div className="field">
                  <label>Badge value</label>
                  <input className="input" value={active.badge[0]} onChange={(e) => update({ badge: [e.target.value, active.badge[1]] })} placeholder="e.g. 20%" />
                </div>
                <div className="field">
                  <label>Badge label</label>
                  <input className="input" value={active.badge[1]} onChange={(e) => update({ badge: [active.badge[0], e.target.value] })} placeholder="e.g. OFF FIRST ORDER" />
                </div>
              </div>
              <div className="row gap-3">
                <button type="button" className="btn btn-outline" onClick={() => save('Draft')}>Save as draft</button>
                <button type="button" className="btn btn-primary" onClick={() => save('Published')}>Publish</button>
                {active.status === 'Published' && (
                  <button type="button" className="btn btn-ghost" onClick={() => save('Inactive')}>Deactivate</button>
                )}
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
                {active.img && <img src={active.img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
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
        onClose={() => setDeleting(null)}
        kicker="Confirm"
        title={`Delete "${deleting?.headline}"?`}
        foot={
          <>
            <button className="btn btn-ghost" onClick={() => setDeleting(null)}>Cancel</button>
            <button className="btn btn-primary" style={{ background: 'var(--c-error)' }} onClick={confirmDelete}>Delete</button>
          </>
        }
      >
        <p className="muted">This removes the banner permanently from the homepage.</p>
      </Modal>
    </div>
  );
}
