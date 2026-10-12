import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/common/Icon';
import Modal from '../components/common/Modal';
import { categoryService } from '../services/catalogService';
import { productService } from '../services/productService';
import { useUiStore } from '../store/uiStore';
import IconPicker from '../components/common/IconPicker';
import { CATEGORY_ICONS } from '../utils/icons';
import { stockFromQty, stockTone } from '../utils/stock';

const EMPTY_CAT = { name: '', icon: 'cake', isBox: false, order: 0 };
const byOrderThenName = (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name);

export default function CategoriesStock() {
  const navigate = useNavigate();
  const pushToast = useUiStore((s) => s.pushToast);
  const [categories, setCategories] = useState([]);
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState(null); // 'new' | category id
  const [form, setForm] = useState(EMPTY_CAT);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [removing, setRemoving] = useState(false);
  const [qtyDraft, setQtyDraft] = useState({}); // productId -> string being typed
  const [busyIds, setBusyIds] = useState({});
  const [savedIds, setSavedIds] = useState({}); // productId -> true for a moment after a save
  const [stockQ, setStockQ] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setLoadError('');
    Promise.all([categoryService.list(), productService.list()])
      .then(([cats, products]) => {
        setCategories([...cats].sort(byOrderThenName));
        setStock(products);
      })
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleActive = async (cat) => {
    try {
      await categoryService.update(cat._id, { active: !cat.active });
      setCategories((prev) => prev.map((c) => (c._id === cat._id ? { ...c, active: !c.active } : c)));
    } catch (e) {
      pushToast({ title: 'Could not update category', subtitle: e.message, kind: 'err' });
    }
  };

  const openAdd = () => {
    setForm({ ...EMPTY_CAT, order: categories.length });
    setEditing('new');
  };
  const openEdit = (c) => {
    setForm({ name: c.name, icon: c.icon || 'cake', isBox: !!c.isBox, order: c.order ?? 0 });
    setEditing(c._id);
  };

  const saveCategory = async (e) => {
    e?.preventDefault();
    if (saving) return;
    const name = form.name.trim();
    if (!name) {
      pushToast({ title: 'Category name is required', kind: 'err' });
      return;
    }
    const payload = { name, icon: form.icon, isBox: !!form.isBox, order: Number(form.order) || 0 };
    setSaving(true);
    try {
      if (editing === 'new') await categoryService.create(payload);
      else await categoryService.update(editing, payload);
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
    setRemoving(true);
    try {
      await categoryService.remove(deleting._id);
      pushToast({ title: 'Category deleted', kind: 'info' });
      setDeleting(null);
      load();
    } catch (err) {
      setDeleting(null);
      pushToast({ title: 'Could not delete category', subtitle: err.message, kind: 'err' });
    } finally {
      setRemoving(false);
    }
  };

  /** Sets an absolute quantity; status follows the quantity (same rule the server uses for ±). */
  const setQty = async (product, nextQty) => {
    const qty = Math.max(0, Math.floor(Number(nextQty)));
    if (!Number.isFinite(qty)) return;
    setQtyDraft((d) => { const n = { ...d }; delete n[product._id]; return n; });
    if (qty === product.qty && stockFromQty(qty) === product.stock) return;
    setBusyIds((b) => ({ ...b, [product._id]: true }));
    try {
      const updated = await productService.update(product._id, { qty, stock: stockFromQty(qty) });
      setStock((prev) => prev.map((p) => (p._id === product._id ? { ...p, ...updated } : p)));
      setSavedIds((m) => ({ ...m, [product._id]: true }));
      setTimeout(() => setSavedIds((m) => { const n = { ...m }; delete n[product._id]; return n; }), 1800);
    } catch (e) {
      pushToast({ title: 'Could not update stock', subtitle: e.message, kind: 'err' });
    } finally {
      setBusyIds((b) => { const n = { ...b }; delete n[product._id]; return n; });
    }
  };

  if (loading) return <div className="a-panel a-empty"><p className="muted">Loading…</p></div>;
  if (loadError) {
    return (
      <div className="a-panel a-empty">
        <p className="muted">Could not load categories and stock: {loadError}</p>
        <button className="btn btn-outline btn-sm" onClick={load}>Try again</button>
      </div>
    );
  }

  const shownStock = stock.filter((p) => `${p.name} ${p.cat}`.toLowerCase().includes(stockQ.trim().toLowerCase()));

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
              <tr><th>Category</th><th className="tight">Cakes</th><th className="tight">Shown</th><th className="act" /></tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c._id} onClick={() => openEdit(c)}>
                  <td>
                    <span className="row gap-2 center">
                      <Icon name={c.icon} className="icon icon-sm" />
                      <span style={{ minWidth: 0 }}>
                        <span className="cell-main">{c.name}</span>
                        <span className="cell-sub">
                          {[c.isBox ? 'Box · single price' : null, !c.active ? 'Hidden' : null, `#${c.order ?? 0}`].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className="tight">{stock.filter((p) => p.cat === c.name).length}</td>
                  <td className="tight" onClick={(e) => e.stopPropagation()}>
                    <label className="check" style={{ display: 'inline-flex' }} title={c.active ? 'Shown on the storefront' : 'Hidden from the storefront'}>
                      <input type="checkbox" checked={c.active} onChange={() => toggleActive(c)} aria-label={`Show ${c.name} on storefront`} />
                    </label>
                  </td>
                  <td className="act rowact" onClick={(e) => e.stopPropagation()}>
                    <button className="iconbtn acc" aria-label={`Add a cake to ${c.name}`} title="Add a cake to this category" onClick={() => navigate(`/cakes?new=1&cat=${encodeURIComponent(c.name)}`)}>
                      <Icon name="plus" className="icon icon-sm" />
                    </button>
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
          <div className="field" style={{ minWidth: 0, flex: '1 1 160px', maxWidth: 240 }}>
            <input className="input input-sm" placeholder="Search cakes…" value={stockQ} onChange={(e) => setStockQ(e.target.value)} />
          </div>
        </div>
        <p className="a-intro">Status updates automatically from the quantity: <b>0</b> = Out of stock, <b>1–6</b> = Low stock, <b>7+</b> = In stock. Type a number (Enter to save) or use − / +.</p>
        <div className="a-table-wrap">
          <table className="tbl tbl-mini">
            <thead>
              <tr><th>Cake</th><th className="tight">Qty</th><th className="tight">Status</th></tr>
            </thead>
            <tbody>
              {shownStock.map((s) => {
                const busy = !!busyIds[s._id];
                const draft = qtyDraft[s._id];
                return (
                  <tr key={s._id} style={{ cursor: 'default' }}>
                    <td className="cell-wrap">
                      <span className="cell-main">{s.name}</span>
                      <span className="cell-sub">{s.cat}</span>
                    </td>
                    <td className="tight">
                      <span className="qty-ctl">
                        <button className="iconbtn" aria-label="Decrease" disabled={busy || s.qty <= 0} onClick={() => setQty(s, (s.qty || 0) - 1)}>
                          <Icon name="minus" className="icon icon-sm" />
                        </button>
                        <input
                          className="input qty-input"
                          type="number"
                          min="0"
                          step="1"
                          inputMode="numeric"
                          aria-label={`Quantity of ${s.name}`}
                          value={draft ?? String(s.qty ?? 0)}
                          disabled={busy}
                          onChange={(e) => setQtyDraft((d) => ({ ...d, [s._id]: e.target.value }))}
                          onBlur={() => draft !== undefined && draft !== '' && setQty(s, draft)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') e.currentTarget.blur();
                            if (e.key === 'Escape') setQtyDraft((d) => { const n = { ...d }; delete n[s._id]; return n; });
                          }}
                        />
                        <button className="iconbtn" aria-label="Increase" disabled={busy} onClick={() => setQty(s, (s.qty || 0) + 1)}>
                          <Icon name="plus" className="icon icon-sm" />
                        </button>
                      </span>
                    </td>
                    <td className="tight">
                      <span className="stack gap-1" style={{ alignItems: 'flex-start' }}>
                        <span className={`badge ${stockTone(s.stock)}`}>{s.stock}</span>
                        <span className={`qty-saved ${busy ? 'busy' : savedIds[s._id] ? 'on' : ''}`} aria-live="polite">
                          {busy ? 'Saving…' : savedIds[s._id] ? '✓ Saved' : ''}
                        </span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={!!editing}
        onClose={() => !saving && setEditing(null)}
        kicker={editing === 'new' ? 'New category' : 'Edit category'}
        title={editing === 'new' ? 'Add a category' : form.name || 'Category'}
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
            <IconPicker value={form.icon} onChange={(icon) => setForm({ ...form, icon })} options={CATEGORY_ICONS} />
            <span className="field-hint">Shown next to the category in the shop menus. Hover an icon to see its name.</span>
          </div>
          <div className="form-grid two">
            <div className="field">
              <label>Position</label>
              <input className="input" type="number" inputMode="numeric" value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })} />
              <span className="field-hint">Lower numbers show first in menus.</span>
            </div>
            <div className="field">
              <label>Pricing</label>
              <label className="check">
                <input type="checkbox" checked={form.isBox} onChange={(e) => setForm({ ...form, isBox: e.target.checked })} />
                Sold as a box — single price, no weight choice
              </label>
              <span className="field-hint">For brownies, cupcakes, jars… Customers pay the base price; no 0.5/1/2 KG picker.</span>
            </div>
          </div>
          <button type="submit" hidden />
        </form>
      </Modal>

      <Modal
        open={!!deleting}
        onClose={() => !removing && setDeleting(null)}
        kicker="Confirm"
        title={`Delete "${deleting?.name}"?`}
        foot={
          <>
            <button className="btn btn-ghost" onClick={() => setDeleting(null)} disabled={removing}>Cancel</button>
            <button className="btn btn-primary" style={{ background: 'var(--c-error)' }} onClick={confirmDelete} disabled={removing}>{removing ? 'Deleting…' : 'Delete'}</button>
          </>
        }
      >
        <p className="muted">A category can only be deleted once no cakes or occasions use it. To just hide it from the shop, untick &ldquo;Shown&rdquo; instead.</p>
      </Modal>
    </div>
  );
}
