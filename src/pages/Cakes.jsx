import { useEffect, useMemo, useState } from 'react';
import Icon from '../components/common/Icon';
import Modal from '../components/common/Modal';
import { productService } from '../services/productService';
import { categoryService } from '../services/catalogService';
import { uploadService } from '../services/uploadService';
import { useUiStore } from '../store/uiStore';
import { money } from '../utils/format';

const EMPTY = { name: '', cat: '', base: '', stock: 'In stock', tag: '', corporate: false, img: [] };

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
    setForm({ name: p.name, cat: p.cat, base: p.base, stock: p.stock, tag: p.tag, corporate: !!p.corporate, img: p.img || [] });
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadService.upload(file);
      setForm((f) => ({ ...f, img: [url, ...f.img] }));
    } catch (err) {
      pushToast({ title: 'Upload failed', subtitle: err.message, kind: 'err' });
    } finally {
      setUploading(false);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.base) {
      pushToast({ title: 'Fill in name and price', kind: 'err' });
      return;
    }
    try {
      if (editing === 'new') {
        await productService.create({ ...form, base: Number(form.base) });
        pushToast({ title: 'Cake added', kind: 'ok' });
      } else {
        await productService.update(editing, { ...form, base: Number(form.base) });
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
            <label>Photo</label>
            <label className="dropzone" style={{ display: 'block', padding: 16 }}>
              {uploading ? 'Uploading…' : form.img[0] ? 'Change photo' : 'Click to upload a photo'}
              <input type="file" accept="image/*" className="sr-only" onChange={handleFile} />
            </label>
            {form.img[0] && (
              <span style={{ display: 'block', width: 80, height: 80, borderRadius: 8, overflow: 'hidden', marginTop: 8 }}>
                <img src={form.img[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </span>
            )}
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
            <div className="field">
              <label>Tag (optional)</label>
              <input className="input" value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} placeholder="Bestseller, New..." />
            </div>
            <div className="field span2">
              <label className="check">
                <input type="checkbox" checked={form.corporate} onChange={(e) => setForm({ ...form, corporate: e.target.checked })} />
                Show in Corporate Cakes (bulk/office gifting page)
              </label>
            </div>
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
