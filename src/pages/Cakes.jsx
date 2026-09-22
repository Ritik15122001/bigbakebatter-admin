import { useEffect, useMemo, useState } from 'react';
import Icon from '../components/common/Icon';
import Modal from '../components/common/Modal';
import { productService } from '../services/productService';
import { categoryService } from '../services/catalogService';
import { uploadService } from '../services/uploadService';
import { useUiStore } from '../store/uiStore';
import { money } from '../utils/format';

// Same default multipliers the storefront uses to compute 1/1.5/2 KG prices
// from the 0.5 KG base price when an admin hasn't set an explicit price for
// that weight. Kept in sync with BigBakeBatter/src/data/products.js.
const WEIGHT_TIERS = [
  { w: '1 KG', mult: 1.7 },
  { w: '1.5 KG', mult: 2.39 },
  { w: '2 KG', mult: 3.08 },
];
const autoPrice = (base, mult) => Math.round(((Number(base) || 0) * mult) / 10) * 10;

const EMPTY = {
  name: '', cat: '', flavour: '', base: '', stock: 'In stock', tag: '',
  eggless: true, veg: true, corporate: false, desc: '', img: [],
  weights: { '1 KG': '', '1.5 KG': '', '2 KG': '' },
};

export default function Cakes() {
  const pushToast = useUiStore((s) => s.pushToast);
  const [list, setList] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const load = () => {
    setLoading(true);
    Promise.all([productService.list(), categoryService.list()])
      .then(([products, cats]) => {
        setList(products);
        setCategories(cats);
      })
      .catch((e) => pushToast({ title: 'Failed to load cakes', subtitle: e.message, kind: 'err' }))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const filtered = useMemo(
    () => list.filter((p) => `${p.name} ${p.cat}`.toLowerCase().includes(q.toLowerCase())),
    [list, q]
  );

  const openAdd = () => {
    setEditing('new');
    setForm({ ...EMPTY, cat: categories[0]?.name || '' });
  };
  const openEdit = (p) => {
    setEditing(p._id);
    const weightMap = new Map((p.weights || []).map((w) => [w.w, w.price]));
    setForm({
      name: p.name, cat: p.cat, flavour: p.flavour || '', base: p.base, stock: p.stock, tag: p.tag,
      eggless: p.eggless !== false, veg: p.veg !== false, corporate: !!p.corporate, desc: p.desc || '', img: p.img || [],
      weights: Object.fromEntries(WEIGHT_TIERS.map((t) => [t.w, weightMap.has(t.w) ? String(weightMap.get(t.w)) : ''])),
    });
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadService.upload(file);
      setForm((f) => ({ ...f, img: [...f.img, url] }));
    } catch (err) {
      pushToast({ title: 'Upload failed', subtitle: err.message, kind: 'err' });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const removeImage = (idx) => {
    setForm((f) => ({ ...f, img: f.img.filter((_, i) => i !== idx) }));
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.base) {
      pushToast({ title: 'Fill in name and price', kind: 'err' });
      return;
    }
    // Only tiers the admin actually typed a price for are saved as an
    // override; anything left blank keeps following the storefront's
    // default multiplier of the base price.
    const weights = WEIGHT_TIERS
      .filter((t) => form.weights[t.w] !== '')
      .map((t) => ({ w: t.w, price: Number(form.weights[t.w]) }));
    const payload = { ...form, base: Number(form.base), weights };
    try {
      if (editing === 'new') {
        await productService.create(payload);
        pushToast({ title: 'Cake added', kind: 'ok' });
      } else {
        await productService.update(editing, payload);
        pushToast({ title: 'Cake updated', kind: 'ok' });
      }
      setEditing(null);
      load();
    } catch (err) {
      pushToast({ title: 'Save failed', subtitle: err.message, kind: 'err' });
    }
  };

  const confirmDelete = async () => {
    try {
      await productService.remove(deleting._id);
      pushToast({ title: 'Cake deleted', kind: 'info' });
      setDeleting(null);
      load();
    } catch (err) {
      pushToast({ title: 'Delete failed', subtitle: err.message, kind: 'err' });
    }
  };

  return (
    <div className="a-panel">
      <div className="a-panel-head">
        <div className="field" style={{ minWidth: 240 }}>
          <input className="input" placeholder="Search cakes..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className="btn btn-primary btn-sm" onClick={openAdd}>
          <Icon name="plus" className="icon icon-sm" />
          Add cake
        </button>
      </div>

      {loading ? (
        <div className="a-empty"><p className="muted">Loading cakes…</p></div>
      ) : (
        <div className="a-table-wrap">
          <table className="tbl">
            <thead>
              <tr><th>Cake</th><th>Category</th><th>Price</th><th>Stock</th><th /></tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p._id}>
                  <td>
                    <span className="row gap-3 center">
                      <span style={{ width: 40, height: 40, borderRadius: 8, overflow: 'hidden', flex: 'none', background: 'var(--c-bg-warm)' }}>
                        {p.img?.[0] && <img src={p.img[0]} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                      </span>
                      <span>
                        <span className="cell-main">{p.name}</span>
                        <span className="cell-sub">{p.tag || '—'}</span>
                      </span>
                    </span>
                  </td>
                  <td>{p.cat}</td>
                  <td>{money(p.base)}</td>
                  <td>
                    <span className={`badge ${p.stock === 'Out of stock' ? 'err' : p.stock === 'Low stock' ? 'warn' : 'success'}`}>{p.stock}</span>
                  </td>
                  <td className="rowact">
                    <button className="iconbtn" aria-label="Edit" onClick={() => openEdit(p)}>
                      <Icon name="edit" className="icon icon-sm" />
                    </button>
                    <button className="iconbtn danger" aria-label="Delete" onClick={() => setDeleting(p)}>
                      <Icon name="x" className="icon icon-sm" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        kicker={editing === 'new' ? 'New cake' : 'Edit cake'}
        title={editing === 'new' ? 'Add a cake' : form.name}
        foot={<button className="btn btn-primary btn-block" onClick={save}>Save cake</button>}
      >
        <form className="stack gap-4" onSubmit={save}>
          <div className="field">
            <label>Photos</label>
            <div className="row gap-3 wrap" style={{ marginBottom: form.img.length ? 10 : 0 }}>
              {form.img.map((src, i) => (
                <span key={src} style={{ position: 'relative', width: 72, height: 72, borderRadius: 8, overflow: 'hidden', flex: 'none' }}>
                  <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  {i === 0 && <span className="badge success" style={{ position: 'absolute', left: 3, bottom: 3, fontSize: 9, padding: '1px 5px' }}>Cover</span>}
                  <button
                    type="button"
                    className="iconbtn danger"
                    aria-label="Remove photo"
                    onClick={() => removeImage(i)}
                    style={{ position: 'absolute', top: 2, right: 2, width: 20, height: 20, background: 'rgba(0,0,0,.55)', color: '#fff' }}
                  >
                    <Icon name="x" className="icon icon-sm" style={{ width: 12, height: 12 }} />
                  </button>
                </span>
              ))}
            </div>
            <label className="dropzone" style={{ display: 'block', padding: 16 }}>
              {uploading ? 'Uploading…' : form.img.length ? 'Add another photo' : 'Click to upload a photo'}
              <input type="file" accept="image/*" className="sr-only" onChange={handleFile} disabled={uploading} />
            </label>
            <span className="field-hint">The first photo is used as the cover image everywhere on the site.</span>
          </div>
          <div className="field">
            <label>Name</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Belgian Chocolate Truffle" />
          </div>
          <div className="form-grid two">
            <div className="field">
              <label>Category</label>
              <select className="select" value={form.cat} onChange={(e) => setForm({ ...form, cat: e.target.value })}>
                {categories.map((c) => (
                  <option key={c._id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Flavour</label>
              <input className="input" value={form.flavour} onChange={(e) => setForm({ ...form, flavour: e.target.value })} placeholder="e.g. Belgian Chocolate" />
            </div>
            <div className="field">
              <label>Base price (0.5 KG)</label>
              <input className="input" type="number" value={form.base} onChange={(e) => setForm({ ...form, base: e.target.value })} placeholder="e.g. 649" />
            </div>
            <div className="field">
              <label>Stock status</label>
              <select className="select" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })}>
                <option>In stock</option>
                <option>Low stock</option>
                <option>Out of stock</option>
              </select>
            </div>
            <div className="field span2">
              <label>Tag (optional)</label>
              <input className="input" value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} placeholder="Bestseller, New..." />
            </div>
          </div>

          <div className="field">
            <label>Pricing by weight</label>
            <div className="weight-price-grid">
              <div className="weight-price-row">
                <span className="w-lab">0.5 KG</span>
                <span className="w-val">{money(Number(form.base) || 0)}</span>
                <span className="tiny muted">Base price, set above</span>
              </div>
              {WEIGHT_TIERS.map((t) => (
                <div className="weight-price-row" key={t.w}>
                  <span className="w-lab">{t.w}</span>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    value={form.weights[t.w]}
                    onChange={(e) => setForm({ ...form, weights: { ...form.weights, [t.w]: e.target.value } })}
                    placeholder={String(autoPrice(form.base, t.mult))}
                  />
                  {form.weights[t.w] === '' ? (
                    <span className="tiny muted">Auto &middot; {money(autoPrice(form.base, t.mult))}</span>
                  ) : (
                    <button type="button" className="tiny link-underline" onClick={() => setForm({ ...form, weights: { ...form.weights, [t.w]: '' } })}>
                      Reset to auto
                    </button>
                  )}
                </div>
              ))}
            </div>
            <span className="field-hint">Leave a weight blank to auto-price it from the base price. Set a value to override it for this cake.</span>
          </div>

          <div className="field">
            <label>Description</label>
            <textarea
              className="textarea"
              rows={3}
              value={form.desc}
              onChange={(e) => setForm({ ...form, desc: e.target.value })}
              placeholder="Shown on the cake's product page, e.g. Layers of dark chocolate sponge soaked in cocoa syrup…"
            />
          </div>
          <div className="form-grid two">
            <label className="check">
              <input type="checkbox" checked={form.eggless} onChange={(e) => setForm({ ...form, eggless: e.target.checked })} />
              Eggless
            </label>
            <label className="check">
              <input type="checkbox" checked={form.veg} onChange={(e) => setForm({ ...form, veg: e.target.checked })} />
              Pure veg
            </label>
            <label className="check span2">
              <input type="checkbox" checked={form.corporate} onChange={(e) => setForm({ ...form, corporate: e.target.checked })} />
              Show in Corporate Cakes (bulk/office gifting page)
            </label>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        kicker="Confirm"
        title={`Delete ${deleting?.name}?`}
        foot={
          <>
            <button className="btn btn-ghost" onClick={() => setDeleting(null)}>Cancel</button>
            <button className="btn btn-primary" style={{ background: 'var(--c-error)' }} onClick={confirmDelete}>Delete</button>
          </>
        }
      >
        <p className="muted">This removes the cake from the live menu. This can't be undone.</p>
      </Modal>
    </div>
  );
}
