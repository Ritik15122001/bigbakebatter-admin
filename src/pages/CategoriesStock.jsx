import { useEffect, useState } from 'react';
import Icon from '../components/common/Icon';
import Modal from '../components/common/Modal';
import { categoryService } from '../services/catalogService';
import { productService } from '../services/productService';
import { useUiStore } from '../store/uiStore';

const CATEGORY_ICONS = ['party', 'heart', 'cake', 'slice', 'cookie', 'bowl', 'gem', 'wheat', 'leaf', 'gift', 'star', 'sun', 'camera', 'bag'];

export default function CategoriesStock() {
  const pushToast = useUiStore((s) => s.pushToast);
  const [categories, setCategories] = useState([]);
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // 'new' | category id
  const [form, setForm] = useState({ name: '', icon: 'cake' });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const load = () => {
    setLoading(true);
    Promise.all([categoryService.list(), productService.list()])
      .then(([cats, products]) => {
        setCategories(cats);
        setStock(products);
      })
      .catch((e) => pushToast({ title: 'Failed to load', subtitle: e.message, kind: 'err' }))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const toggleActive = async (cat) => {
    try {
      await categoryService.update(cat._id, { active: !cat.active });
      setCategories((prev) => prev.map((c) => (c._id === cat._id ? { ...c, active: !c.active } : c)));
    } catch (e) {
      pushToast({ title: 'Could not update category', subtitle: e.message, kind: 'err' });
    }
  };

  const openAdd = () => {
    setForm({ name: '', icon: 'cake' });
    setEditing('new');
  };
  const openEdit = (c) => {
    setForm({ name: c.name, icon: c.icon || 'cake' });
    setEditing(c._id);
  };

  const saveCategory = async (e) => {
    e?.preventDefault();
    const name = form.name.trim();
    if (!name) {
      pushToast({ title: 'Category name is required', kind: 'err' });
      return;
    }
    setSaving(true);
    try {
      if (editing === 'new') await categoryService.create({ name, icon: form.icon });
      else await categoryService.update(editing, { name, icon: form.icon });
      pushToast({ title: editing === 'new' ? 'Category added' : 'Category updated', kind: 'ok' });
      setEditing(null);
      load();
    } catch (err) {
      pushToast({ title: 'Could not save category', subtitle: err.message, kind: 'err' });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    try {
      await categoryService.remove(deleting._id);
      pushToast({ title: 'Category deleted', kind: 'info' });
      setDeleting(null);
      load();
    } catch (err) {
      setDeleting(null);
      pushToast({ title: 'Could not delete category', subtitle: err.message, kind: 'err' });
    }
  };

  const adjustQty = async (product, delta) => {
    try {
      const updated = await productService.adjustStock(product._id, delta);
      setStock((prev) => prev.map((p) => (p._id === product._id ? updated : p)));
    } catch (e) {
      pushToast({ title: 'Could not update stock', subtitle: e.message, kind: 'err' });
    }
  };

  if (loading) return <div className="a-panel a-empty"><p className="muted">Loading…</p></div>;

  return (
    <div className="a-grid-2">
      <div className="a-panel">
        <div className="a-panel-head">
          <h3>Categories</h3>
          <button className="btn btn-primary btn-sm" onClick={openAdd}>
            <Icon name="plus" className="icon icon-sm" />
            Add category
          </button>
        </div>
        <div className="a-table-wrap">
          <table className="tbl tbl-mini">
            <thead>
              <tr><th>Category</th><th>Cakes</th><th>Active</th><th /></tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c._id}>
                  <td>
                    <span className="row gap-2 center">
                      <Icon name={c.icon} className="icon icon-sm" />
                      {c.name}
                    </span>
                  </td>
                  <td>{stock.filter((p) => p.cat === c.name).length}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <label className="check" style={{ display: 'inline-flex' }}>
                      <input type="checkbox" checked={c.active} onChange={() => toggleActive(c)} />
                    </label>
                  </td>
                  <td className="rowact" onClick={(e) => e.stopPropagation()}>
                    <button className="iconbtn" aria-label="Edit category" onClick={() => openEdit(c)}>
                      <Icon name="edit" className="icon icon-sm" />
                    </button>
                    <button className="iconbtn danger" aria-label="Delete category" onClick={() => setDeleting(c)}>
                      <Icon name="trash" className="icon icon-sm" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="a-panel">
        <div className="a-panel-head">
          <h3>Stock levels</h3>
        </div>
        <div className="a-table-wrap">
          <table className="tbl tbl-mini">
            <thead>
              <tr><th>Cake</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {stock.map((s) => (
                <tr key={s._id}>
                  <td>
                    <span className="cell-main">{s.name}</span>
                    <span className="cell-sub">{s.cat} · Qty {s.qty}</span>
                  </td>
                  <td>
                    <span className={`badge ${s.stock === 'Out of stock' ? 'err' : s.stock === 'Low stock' ? 'warn' : 'success'}`}>{s.stock}</span>
                  </td>
                  <td className="rowact">
                    <button className="iconbtn" aria-label="Decrease" onClick={() => adjustQty(s, -1)}>
                      <Icon name="minus" className="icon icon-sm" />
                    </button>
                    <button className="iconbtn" aria-label="Increase" onClick={() => adjustQty(s, 1)}>
                      <Icon name="plus" className="icon icon-sm" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        kicker={editing === 'new' ? 'New category' : 'Edit category'}
        title={editing === 'new' ? 'Add a category' : form.name}
        foot={<button className="btn btn-primary btn-block" onClick={saveCategory} disabled={saving}>{saving ? 'Saving…' : 'Save category'}</button>}
      >
        <form className="stack gap-4" onSubmit={saveCategory}>
          <div className="field">
            <label>Name</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Birthday" autoFocus />
            {editing !== 'new' && <span className="field-hint">Renaming also updates every cake and occasion in this category.</span>}
          </div>
          <div className="field">
            <label>Icon</label>
            <div className="row gap-2 wrap">
              {CATEGORY_ICONS.map((i) => (
                <button
                  key={i}
                  type="button"
                  className={`iconbtn ${form.icon === i ? 'on' : ''}`}
                  aria-label={i}
                  aria-pressed={form.icon === i}
                  onClick={() => setForm({ ...form, icon: i })}
                  style={form.icon === i ? { background: 'var(--c-ink)', color: '#fff' } : undefined}
                >
                  <Icon name={i} className="icon icon-sm" />
                </button>
              ))}
            </div>
          </div>
          <button type="submit" hidden />
        </form>
      </Modal>

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        kicker="Confirm"
        title={`Delete "${deleting?.name}"?`}
        foot={
          <>
            <button className="btn btn-ghost" onClick={() => setDeleting(null)}>Cancel</button>
            <button className="btn btn-primary" style={{ background: 'var(--c-error)' }} onClick={confirmDelete}>Delete</button>
          </>
        }
      >
        <p className="muted">A category can only be deleted once no cakes are assigned to it.</p>
      </Modal>
    </div>
  );
}
