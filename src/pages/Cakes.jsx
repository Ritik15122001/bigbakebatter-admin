import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Icon from '../components/common/Icon';
import Modal from '../components/common/Modal';
import EmptyState from '../components/common/EmptyState';
import Pagination from '../components/common/Pagination';
import { productService } from '../services/productService';
import { categoryService, flavourService } from '../services/catalogService';
import { uploadService } from '../services/uploadService';
import { useUiStore } from '../store/uiStore';
import { money } from '../utils/format';
import { resolveImg } from '../utils/media';
import { stockFromQty, stockTone } from '../utils/stock';

// Same default multipliers the storefront uses to compute 1/1.5/2 KG prices
// from the 0.5 KG base price when an admin hasn't set an explicit price for
// that weight. Kept in sync with BigBakeBatter/src/data/products.js.
const WEIGHT_TIERS = [
  { w: '1 KG', mult: 1.7 },
  { w: '1.5 KG', mult: 2.39 },
  { w: '2 KG', mult: 3.08 },
];
const TIER_LABELS = new Set(WEIGHT_TIERS.map((t) => t.w));
const autoPrice = (base, mult) => Math.round(((Number(base) || 0) * mult) / 10) * 10;
const PAGE_SIZE = 10;

const EMPTY = {
  name: '', cat: '', flavour: '', base: '', qty: '20', tag: '',
  eggless: true, veg: true, corporate: false, desc: '', img: [],
  weights: { '1 KG': '', '1.5 KG': '', '2 KG': '' },
  extraWeights: [], // [{ w, price }] — any weight label other than the standard tiers
};

const isNonNegNumber = (v) => v !== '' && v !== null && Number.isFinite(Number(v)) && Number(v) >= 0;

export default function Cakes() {
  const pushToast = useUiStore((s) => s.pushToast);
  const [params, setParams] = useSearchParams();
  const [list, setList] = useState([]);
  const [categories, setCategories] = useState([]);
  const [flavours, setFlavours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [q, setQ] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [removing, setRemoving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError('');
    Promise.all([productService.list(), categoryService.list()])
      .then(([products, cats]) => {
        setList(products);
        setCategories([...cats].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name)));
      })
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoading(false));
    flavourService.list().then((f) => setFlavours(f.map((x) => x.name).sort())).catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const catByName = useMemo(() => new Map(categories.map((c) => [c.name, c])), [categories]);
  const isBoxCat = !!catByName.get(form.cat)?.isBox;

  const openAdd = useCallback((cat) => {
    setEditing('new');
    setErrors({});
    setForm({ ...EMPTY, cat: cat || categories.find((c) => c.active)?.name || categories[0]?.name || '' });
  }, [categories]);

  // Deep link from Categories & Stock: /cakes?new=1&cat=Birthday
  useEffect(() => {
    if (loading || params.get('new') !== '1') return;
    openAdd(params.get('cat') || undefined);
    setParams({}, { replace: true });
  }, [loading, params, openAdd, setParams]);

  const filtered = useMemo(
    () => list.filter((p) => (catFilter === 'All' || p.cat === catFilter) && `${p.name} ${p.cat} ${p.flavour || ''}`.toLowerCase().includes(q.trim().toLowerCase())),
    [list, q, catFilter]
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const paged = useMemo(() => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE), [filtered, safePage]);

  const openEdit = (p) => {
    setEditing(p._id);
    setErrors({});
    const weights = Array.isArray(p.weights) ? p.weights : [];
    const weightMap = new Map(weights.map((w) => [w.w, w.price]));
    setForm({
      name: p.name || '', cat: p.cat || '', flavour: p.flavour || '', base: p.base ?? '', qty: String(p.qty ?? 0), tag: p.tag || '',
      eggless: p.eggless !== false, veg: p.veg !== false, corporate: !!p.corporate, desc: p.desc || '', img: Array.isArray(p.img) ? p.img : [],
      weights: Object.fromEntries(WEIGHT_TIERS.map((t) => [t.w, weightMap.has(t.w) ? String(weightMap.get(t.w)) : ''])),
      extraWeights: weights.filter((w) => !TIER_LABELS.has(w.w)).map((w) => ({ w: w.w, price: String(w.price) })),
    });
  };

  const closeEditor = () => {
    if (saving || uploading) return;
    setEditing(null);
  };

  const handleFile = async (e) => {
    const input = e.target;
    const files = Array.from(input.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files) {
        const url = await uploadService.upload(file);
        setForm((f) => ({ ...f, img: [...f.img, url] }));
      }
    } catch (err) {
      pushToast({ title: 'Upload failed', subtitle: err.message, kind: 'err' });
    } finally {
      setUploading(false);
      input.value = '';
    }
  };

  const removeImage = (idx) => setForm((f) => ({ ...f, img: f.img.filter((_, i) => i !== idx) }));
  const moveImage = (idx, dir) => setForm((f) => {
    const j = idx + dir;
    if (j < 0 || j >= f.img.length) return f;
    const img = [...f.img];
    [img[idx], img[j]] = [img[j], img[idx]];
    return { ...f, img };
  });

  const setExtra = (i, patch) => setForm((f) => ({ ...f, extraWeights: f.extraWeights.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  const addExtra = () => setForm((f) => ({ ...f, extraWeights: [...f.extraWeights, { w: '', price: '' }] }));
  const removeExtra = (i) => setForm((f) => ({ ...f, extraWeights: f.extraWeights.filter((_, j) => j !== i) }));

  const validate = () => {
    const errs = {};
    if (form.name.trim().length < 2) errs.name = 'Enter a name (at least 2 characters).';
    if (!form.cat) errs.cat = 'Choose a category.';
    if (!isNonNegNumber(form.base) || Number(form.base) <= 0) errs.base = 'Enter a price greater than 0.';
    if (!isNonNegNumber(form.qty) || !Number.isInteger(Number(form.qty))) errs.qty = 'Enter a whole number, 0 or more.';
    if (!isBoxCat) {
      WEIGHT_TIERS.forEach((t) => {
        const v = form.weights[t.w];
        if (v !== '' && !isNonNegNumber(v)) errs[`w:${t.w}`] = 'Price must be 0 or more.';
      });
      const seen = new Set(TIER_LABELS);
      form.extraWeights.forEach((x, i) => {
        const label = x.w.trim();
        if (!label) errs[`x:${i}`] = 'Enter a weight label, e.g. 3 KG.';
        else if (seen.has(label)) errs[`x:${i}`] = `"${label}" is already listed.`;
        else if (!isNonNegNumber(x.price)) errs[`x:${i}`] = 'Enter a price for this weight.';
        seen.add(label);
      });
    }
    return errs;
  };

  const save = async (e) => {
    e?.preventDefault();
    if (saving || uploading) return;
    const errs = validate();
    setErrors(errs);
    const firstErr = Object.values(errs)[0];
    if (firstErr) {
      pushToast({ title: 'Please fix the highlighted fields', subtitle: firstErr, kind: 'err' });
      return;
    }
    // Standard tiers left blank keep following the storefront's default
    // multiplier; typed ones become overrides. Extra weights are always saved.
    const weights = isBoxCat
      ? [
        // a box has no weight picker — keep whatever was stored so switching category back loses nothing
        ...WEIGHT_TIERS.filter((t) => form.weights[t.w] !== '').map((t) => ({ w: t.w, price: Number(form.weights[t.w]) })),
        ...form.extraWeights.filter((x) => x.w.trim() && isNonNegNumber(x.price)).map((x) => ({ w: x.w.trim(), price: Number(x.price) })),
      ]
      : [
        ...WEIGHT_TIERS.filter((t) => form.weights[t.w] !== '').map((t) => ({ w: t.w, price: Number(form.weights[t.w]) })),
        ...form.extraWeights.map((x) => ({ w: x.w.trim(), price: Number(x.price) })),
      ];
    const qty = Math.max(0, Math.floor(Number(form.qty)));
    const payload = {
      name: form.name.trim(),
      cat: form.cat,
      flavour: form.flavour.trim(),
      base: Number(form.base),
      weights,
      qty,
      stock: stockFromQty(qty),
      tag: form.tag.trim(),
      eggless: form.eggless,
      veg: form.veg,
      corporate: form.corporate,
      desc: form.desc,
      img: form.img,
    };
    setSaving(true);
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
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    setRemoving(true);
    try {
      await productService.remove(deleting._id);
      pushToast({ title: 'Cake deleted', kind: 'info' });
      setDeleting(null);
      load();
    } catch (err) {
      pushToast({ title: 'Delete failed', subtitle: err.message, kind: 'err' });
    } finally {
      setRemoving(false);
    }
  };

  const err = (k) => errors[k] && <span className="field-hint field-err">{errors[k]}</span>;
  const derivedStock = stockFromQty(form.qty);

  return (
    <div className="a-panel">
      <div className="a-panel-head">
        <div className="a-filters" style={{ border: 0, padding: 0, background: 'none', flex: '1 1 320px' }}>
          <div className="field f-grow">
            <input className="input" placeholder="Search cakes..." value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          </div>
          <div className="field f-sm">
            <select className="select" value={catFilter} onChange={(e) => { setCatFilter(e.target.value); setPage(1); }}>
              <option>All</option>
              {categories.map((c) => <option key={c._id} value={c.name}>{c.name}{c.active ? '' : ' (hidden)'}</option>)}
            </select>
          </div>
          {!loading && <span className="a-count">{filtered.length} cake{filtered.length === 1 ? '' : 's'}</span>}
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => openAdd()} disabled={loading}>
          <Icon name="plus" className="icon icon-sm" />
          Add cake
        </button>
      </div>

      {loading ? (
        <div className="a-empty"><p className="muted">Loading cakes…</p></div>
      ) : loadError ? (
        <div className="a-empty">
          <p className="muted">Could not load cakes: {loadError}</p>
          <button className="btn btn-outline btn-sm" onClick={load}>Try again</button>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="cake" title="No cakes found" message="Try a different search or category, or add a new cake." />
      ) : (
        <>
          <div className="a-table-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Cake</th><th>Category</th><th className="num">Price</th><th className="tight">Stock</th><th className="act" /></tr>
              </thead>
              <tbody>
                {paged.map((p) => (
                  <tr key={p._id} onClick={() => openEdit(p)}>
                    <td>
                      <span className="row gap-3 center">
                        <span className="tbl-thumb">
                          {p.img?.[0] && <img src={resolveImg(p.img[0])} alt="" />}
                        </span>
                        <span style={{ minWidth: 0 }}>
                          <span className="cell-main">{p.name}</span>
                          <span className="cell-sub">{[p.flavour, p.tag].filter(Boolean).join(' · ') || '—'}</span>
                        </span>
                      </span>
                    </td>
                    <td>
                      {p.cat}
                      {catByName.get(p.cat) && !catByName.get(p.cat).active && <span className="cell-sub">Category hidden</span>}
                    </td>
                    <td className="num cell-main">{money(p.base)}</td>
                    <td className="tight">
                      <span className={`badge ${stockTone(p.stock)}`}>{p.stock}</span>
                      <span className="cell-sub">Qty {p.qty ?? 0}</span>
                    </td>
                    <td className="act rowact" onClick={(e) => e.stopPropagation()}>
                      <button className="iconbtn" aria-label="Edit" onClick={() => openEdit(p)}>
                        <Icon name="edit" className="icon icon-sm" />
                      </button>
                      <button className="iconbtn danger" aria-label="Delete" onClick={() => setDeleting(p)}>
                        <Icon name="trash" className="icon icon-sm" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={safePage} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} />
        </>
      )}

      <Modal
        open={!!editing}
        onClose={closeEditor}
        kicker={editing === 'new' ? 'New cake' : 'Edit cake'}
        title={editing === 'new' ? 'Add a cake' : form.name || 'Cake'}
        foot={
          <button className="btn btn-primary btn-block" onClick={save} disabled={saving || uploading}>
            {saving ? 'Saving…' : uploading ? 'Uploading photo…' : 'Save cake'}
          </button>
        }
      >
        <form className="stack gap-4" onSubmit={save}>
          <div className="field">
            <label>Photos</label>
            {form.img.length > 0 && (
              <div className="img-strip">
                {form.img.map((src, i) => (
                  <span key={`${src}-${i}`} className="img-strip-item">
                    <img src={resolveImg(src)} alt="" />
                    {i === 0 && <span className="badge success img-strip-cover">Cover</span>}
                    <button type="button" className="img-strip-rm" aria-label="Remove photo" onClick={() => removeImage(i)}>
                      <Icon name="x" className="icon icon-sm" />
                    </button>
                    <span className="img-strip-move">
                      <button type="button" aria-label="Move left" disabled={i === 0} onClick={() => moveImage(i, -1)}>
                        <Icon name="cleft" className="icon icon-sm" />
                      </button>
                      <button type="button" aria-label="Move right" disabled={i === form.img.length - 1} onClick={() => moveImage(i, 1)}>
                        <Icon name="cright" className="icon icon-sm" />
                      </button>
                    </span>
                  </span>
                ))}
              </div>
            )}
            <label className={`dropzone img-field-drop ${uploading ? 'busy' : ''}`}>
              {uploading ? 'Uploading…' : form.img.length ? 'Add more photos' : 'Click to upload photos'}
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="sr-only" onChange={handleFile} disabled={uploading} />
            </label>
            <span className="field-hint">The first photo is the cover used everywhere on the site — use the arrows to change the order.</span>
          </div>
          <div className="field">
            <label>Name *</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Belgian Chocolate Truffle" aria-invalid={!!errors.name} />
            {err('name')}
          </div>
          <div className="form-grid two">
            <div className="field">
              <label>Category *</label>
              <select className="select" value={form.cat} onChange={(e) => setForm({ ...form, cat: e.target.value })} aria-invalid={!!errors.cat}>
                {!form.cat && <option value="">Choose…</option>}
                {form.cat && !catByName.has(form.cat) && <option value={form.cat}>{form.cat} (missing)</option>}
                {categories.map((c) => (
                  <option key={c._id} value={c.name}>{c.name}{c.active ? '' : ' (hidden)'}</option>
                ))}
              </select>
              {err('cat')}
              {catByName.get(form.cat) && !catByName.get(form.cat).active && <span className="field-hint">This category is hidden, so the cake won&rsquo;t show in its menu until the category is shown again.</span>}
            </div>
            <div className="field">
              <label>Flavour</label>
              <input className="input" list="cake-flavours" value={form.flavour} onChange={(e) => setForm({ ...form, flavour: e.target.value })} placeholder="Pick or type, e.g. Belgian Chocolate" />
              <datalist id="cake-flavours">
                {flavours.map((f) => <option key={f} value={f} />)}
              </datalist>
            </div>
            <div className="field">
              <label>{isBoxCat ? 'Price (per box) *' : 'Base price (0.5 KG) *'}</label>
              <input className="input" type="number" min="0" inputMode="decimal" value={form.base} onChange={(e) => setForm({ ...form, base: e.target.value })} placeholder="e.g. 649" aria-invalid={!!errors.base} />
              {err('base')}
            </div>
            <div className="field">
              <label>Quantity in stock *</label>
              <input className="input" type="number" min="0" step="1" inputMode="numeric" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} aria-invalid={!!errors.qty} />
              {err('qty')}
              <span className="field-hint">
                Status: <span className={`badge ${stockTone(derivedStock)}`}>{derivedStock}</span> &mdash; set automatically (0 = out, 1–6 = low, 7+ = in stock).
              </span>
            </div>
            <div className="field span2">
              <label>Tag (optional)</label>
              <input className="input" value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} placeholder="Bestseller, New..." />
            </div>
          </div>

          {isBoxCat ? (
            <div className="field">
              <label>Pricing</label>
              <p className="field-hint">&ldquo;{form.cat}&rdquo; is sold as a box: customers pay the single price above and don&rsquo;t pick a weight.</p>
            </div>
          ) : (
            <div className="field">
              <label>Pricing by weight</label>
              <div className="weight-price-grid">
                <div className="weight-price-row">
                  <span className="w-lab">0.5 KG</span>
                  <span className="w-val">{money(Number(form.base) || 0)}</span>
                  <span className="tiny muted">Base price, set above</span>
                </div>
                {WEIGHT_TIERS.map((t) => (
                  <div key={t.w}>
                    <div className="weight-price-row">
                      <span className="w-lab">{t.w}</span>
                      <input
                        className="input"
                        type="number"
                        min="0"
                        inputMode="decimal"
                        value={form.weights[t.w]}
                        onChange={(e) => setForm({ ...form, weights: { ...form.weights, [t.w]: e.target.value } })}
                        placeholder={String(autoPrice(form.base, t.mult))}
                        aria-invalid={!!errors[`w:${t.w}`]}
                      />
                      {form.weights[t.w] === '' ? (
                        <span className="tiny muted">Auto &middot; {money(autoPrice(form.base, t.mult))}</span>
                      ) : (
                        <button type="button" className="tiny link-underline" onClick={() => setForm({ ...form, weights: { ...form.weights, [t.w]: '' } })}>
                          Reset to auto
                        </button>
                      )}
                    </div>
                    {err(`w:${t.w}`)}
                  </div>
                ))}
                {form.extraWeights.map((x, i) => (
                  <div key={i}>
                    <div className="weight-price-row extra">
                      <input className="input" value={x.w} onChange={(e) => setExtra(i, { w: e.target.value })} placeholder="e.g. 3 KG" aria-label="Weight label" aria-invalid={!!errors[`x:${i}`]} />
                      <input className="input" type="number" min="0" inputMode="decimal" value={x.price} onChange={(e) => setExtra(i, { price: e.target.value })} placeholder="Price" aria-label="Price" aria-invalid={!!errors[`x:${i}`]} />
                      <button type="button" className="tiny link-underline" onClick={() => removeExtra(i)}>Remove</button>
                    </div>
                    {err(`x:${i}`)}
                  </div>
                ))}
                <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={addExtra}>
                  <Icon name="plus" className="icon icon-sm" />
                  Add another weight
                </button>
              </div>
              <span className="field-hint">Leave 1 / 1.5 / 2 KG blank to auto-price them from the base price, or type a price to override. Extra weights (e.g. 3 KG) show as additional options with exactly the price you set.</span>
            </div>
          )}

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
          <button type="submit" hidden />
        </form>
      </Modal>

      <Modal
        open={!!deleting}
        onClose={() => !removing && setDeleting(null)}
        kicker="Confirm"
        title={`Delete ${deleting?.name}?`}
        foot={
          <>
            <button className="btn btn-ghost" onClick={() => setDeleting(null)} disabled={removing}>Cancel</button>
            <button className="btn btn-primary" style={{ background: 'var(--c-error)' }} onClick={confirmDelete} disabled={removing}>{removing ? 'Deleting…' : 'Delete'}</button>
          </>
        }
      >
        <p className="muted">This removes the cake from the live menu. This can&rsquo;t be undone.</p>
      </Modal>
    </div>
  );
}
