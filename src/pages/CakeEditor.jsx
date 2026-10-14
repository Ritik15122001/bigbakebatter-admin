import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Page, Card, Button, Field, Input, Select, Textarea, Switch, Status, Alert, KeyValue, Loader, EmptyState, Menu,
  useAsync, useConfirm, toast,
} from '../ui';
import { Gallery, SaveBar, CakeCardPreview, Stars, ReviewDrawer } from '../ui/ext-cat';
import { productService } from '../services/productService';
import { categoryService, flavourService, reviewService } from '../services/catalogService';
import { money, fmtDate, fmtDateTime } from '../utils/format';
import { stockFromQty } from '../utils/stock';

const STOREFRONT_URL = (import.meta.env.VITE_STOREFRONT_URL || 'http://localhost:5301').replace(/\/$/, '');

// Same multipliers the storefront uses to price 1 / 1.5 / 2 KG from the 0.5 KG base
// when no explicit price is set (BigBakeBatter/src/data/products.js).
const TIERS = [
  { w: '1 KG', mult: 1.7 },
  { w: '1.5 KG', mult: 2.39 },
  { w: '2 KG', mult: 3.08 },
];
const TIER_SET = new Set(TIERS.map((t) => t.w));
const autoPrice = (base, mult) => Math.round(((Number(base) || 0) * mult) / 10) * 10;
const TAG_PRESETS = ['Bestseller', 'New', 'Seasonal'];
const isNum = (v) => v !== '' && v !== null && v !== undefined && Number.isFinite(Number(v));

const EMPTY = {
  name: '', desc: '', flavour: '', tag: '', img: [], cat: '',
  base: '', tiers: { '1 KG': '', '1.5 KG': '', '2 KG': '' }, extra: [],
  rating: '0', reviews: '0', eggless: true, veg: true, corporate: false, qty: '20',
};

function toForm(p) {
  const weights = Array.isArray(p.weights) ? p.weights : [];
  const map = new Map(weights.map((w) => [w.w, w.price]));
  return {
    name: p.name || '', desc: p.desc || '', flavour: p.flavour || '', tag: p.tag || '', img: Array.isArray(p.img) ? p.img : [], cat: p.cat || '',
    base: p.base === undefined || p.base === null ? '' : String(p.base),
    tiers: Object.fromEntries(TIERS.map((t) => [t.w, map.has(t.w) ? String(map.get(t.w)) : ''])),
    extra: weights.filter((w) => !TIER_SET.has(w.w)).map((w) => ({ w: w.w, price: String(w.price) })),
    rating: String(p.rating ?? 0), reviews: String(p.reviews ?? 0),
    eggless: p.eggless !== false, veg: p.veg !== false, corporate: !!p.corporate, qty: String(p.qty ?? 0),
  };
}

function validate(form) {
  const e = {};
  if (form.name.trim().length < 2) e.name = 'Enter a name of at least 2 characters.';
  if (!form.cat) e.cat = 'Choose a category.';
  if (!isNum(form.base) || Number(form.base) <= 0) e.base = 'Enter a price greater than ₹0.';
  if (!isNum(form.qty) || Number(form.qty) < 0 || !Number.isInteger(Number(form.qty))) e.qty = 'Enter a whole number, 0 or more.';
  if (!isNum(form.rating) || Number(form.rating) < 0 || Number(form.rating) > 5) e.rating = 'Rating must be between 0 and 5.';
  if (!isNum(form.reviews) || Number(form.reviews) < 0 || !Number.isInteger(Number(form.reviews))) e.reviews = 'Enter a whole number, 0 or more.';
  TIERS.forEach((t) => {
    const v = form.tiers[t.w];
    if (v !== '' && (!isNum(v) || Number(v) < 0)) e[`t:${t.w}`] = 'Price must be 0 or more.';
  });
  const seen = new Set(['0.5 KG', ...TIER_SET]);
  form.extra.forEach((x, i) => {
    const label = x.w.trim();
    if (!label) e[`x:${i}`] = 'Enter a weight label, e.g. 3 KG.';
    else if (seen.has(label)) e[`x:${i}`] = `“${label}” is already listed.`;
    else if (!isNum(x.price) || Number(x.price) < 0) e[`x:${i}`] = 'Enter a price for this weight.';
    seen.add(label);
  });
  return e;
}

function toPayload(form, isBox) {
  const qty = Math.max(0, Math.floor(Number(form.qty) || 0));
  const extra = form.extra.filter((x) => x.w.trim() && isNum(x.price));
  return {
    name: form.name.trim(),
    desc: form.desc.trim(),
    flavour: form.flavour.trim(),
    tag: form.tag.trim(),
    img: form.img,
    cat: form.cat,
    base: Number(form.base),
    // Blank 1 / 1.5 / 2 KG rows follow the storefront multiplier; typed ones override it.
    // A box has no weight picker, but stored weights are kept so switching back loses nothing.
    weights: [
      ...TIERS.filter((t) => form.tiers[t.w] !== '' && isNum(form.tiers[t.w])).map((t) => ({ w: t.w, price: Number(form.tiers[t.w]) })),
      ...(isBox ? extra : form.extra).map((x) => ({ w: x.w.trim(), price: Number(x.price) })),
    ],
    rating: Math.round(Number(form.rating) * 10) / 10,
    reviews: Math.floor(Number(form.reviews)),
    eggless: form.eggless,
    veg: form.veg,
    corporate: form.corporate,
    qty,
    stock: stockFromQty(qty),
  };
}

export default function CakeEditor() {
  const { id } = useParams();
  const isNew = id === 'new';
  const [params] = useSearchParams();
  const presetCat = params.get('cat') || '';

  const load = useCallback(
    () => Promise.all([
      categoryService.list(),
      flavourService.list().catch(() => []),
      isNew ? Promise.resolve(null) : productService.get(id),
    ]).then(([categories, flavours, product]) => ({ categories, flavours, product })),
    [id, isNew]
  );
  const { data, loading, error, reload } = useAsync(load, [load]);

  return (
    <Loader loading={loading && !data} error={!data ? error : ''} onRetry={reload} rows={8}>
      {data && <Editor key={id} id={id} isNew={isNew} presetCat={presetCat} {...data} />}
    </Loader>
  );
}

function Editor({ id, isNew, presetCat, categories: rawCats, flavours, product: loaded }) {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const categories = useMemo(() => [...rawCats].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name)), [rawCats]);
  const catByName = useMemo(() => new Map(categories.map((c) => [c.name, c])), [categories]);

  const initial = useMemo(() => {
    if (loaded) return toForm(loaded);
    const cat = (presetCat && catByName.has(presetCat) ? presetCat : '') || categories.find((c) => c.active)?.name || categories[0]?.name || '';
    return { ...EMPTY, cat };
  }, [loaded, presetCat, catByName, categories]);

  const [product, setProduct] = useState(loaded);
  const [saved, setSaved] = useState(initial);
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [customTag, setCustomTag] = useState(!!initial.tag && !TAG_PRESETS.includes(initial.tag));

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const cat = catByName.get(form.cat);
  const isBox = !!cat?.isBox;
  const stock = stockFromQty(form.qty);

  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    const keys = Object.keys(patch);
    if (keys.some((k) => errors[k])) setErrors((e) => { const n = { ...e }; keys.forEach((k) => delete n[k]); return n; });
  };
  const setTier = (w, v) => { setForm((f) => ({ ...f, tiers: { ...f.tiers, [w]: v } })); setErrors((e) => ({ ...e, [`t:${w}`]: undefined })); };
  const setExtra = (i, patch) => { setForm((f) => ({ ...f, extra: f.extra.map((x, j) => (j === i ? { ...x, ...patch } : x)) })); setErrors((e) => ({ ...e, [`x:${i}`]: undefined })); };

  // Warn before closing the tab with unsaved edits.
  useEffect(() => {
    if (!dirty) return undefined;
    const onUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [dirty]);

  const save = async () => {
    if (saving) return;
    const errs = validate(form);
    setErrors(errs);
    const first = Object.values(errs).find(Boolean);
    if (first) {
      toast.error('Please fix the highlighted fields', first);
      return;
    }
    const payload = toPayload(form, isBox);
    setSaving(true);
    try {
      if (isNew) {
        const created = await productService.create(payload);
        setSaved(form);
        toast.success('Cake added', `${created.name} is now on the menu.`);
        navigate(`/cakes/${created._id}`, { replace: true });
      } else {
        const updated = await productService.update(id, payload);
        const next = toForm(updated);
        setProduct(updated);
        setSaved(next);
        setForm(next);
        toast.success('Changes saved', updated.name);
      }
    } catch (err) {
      toast.error('Could not save', err.message);
    } finally {
      setSaving(false);
    }
  };

  // Ctrl/Cmd+S saves.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (dirty) save();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const discard = async () => {
    if (!(await confirm({ title: 'Discard your changes?', message: 'Everything you changed since the last save will be lost.', confirmLabel: 'Discard', danger: true }))) return;
    setForm(saved);
    setErrors({});
    setCustomTag(!!saved.tag && !TAG_PRESETS.includes(saved.tag));
  };

  const remove = async () => {
    const ok = await confirm({
      title: `Delete “${product.name}”?`,
      message: 'It disappears from the shop straight away. Past orders keep their own copy of the name and price. This can’t be undone.',
      confirmLabel: 'Delete cake',
      danger: true,
    });
    if (!ok) return;
    try {
      await productService.remove(id);
      setSaved(form); // nothing left to protect
      toast.success('Cake deleted', product.name);
      navigate('/cakes', { replace: true });
    } catch (err) {
      toast.error('Could not delete', err.message);
    }
  };

  const duplicate = async () => {
    try {
      const copy = await productService.duplicate(product);
      toast.success('Cake duplicated', `Now editing “${copy.name}”.`);
      navigate(`/cakes/${copy._id}`);
    } catch (err) {
      toast.error('Could not duplicate', err.message);
    }
  };

  const err = (k) => errors[k];
  const title = isNew ? (form.name.trim() || 'New cake') : (saved.name || 'Cake');

  return (
    <Page
      back="/cakes"
      eyebrow="Cakes"
      title={title}
      badge={!isNew && <Status>{stockFromQty(saved.qty)}</Status>}
      description={isNew ? 'Fill in the details, add photos and set prices. The cake goes live as soon as you save.' : `${saved.cat}${saved.flavour ? ` · ${saved.flavour}` : ''} · last updated ${fmtDateTime(product?.updatedAt)}`}
      actions={
        <>
          {!isNew && (
            <Menu
              trigger={({ toggle }) => <Button icon="dots" onClick={toggle} aria-label="More actions" />}
              items={[
                { label: 'View on store', icon: 'external', href: `${STOREFRONT_URL}/product/${id}`, external: true },
                { label: 'Duplicate', icon: 'copy', onClick: duplicate },
                { divider: true },
                { label: 'Delete cake', icon: 'trash', danger: true, onClick: remove },
              ]}
            />
          )}
          {dirty && <Button onClick={discard} disabled={saving}>Discard</Button>}
          <Button variant="primary" icon="check" onClick={save} loading={saving} disabled={!isNew && !dirty}>{isNew ? 'Create cake' : 'Save'}</Button>
        </>
      }
    >
      <div className="u-grid main-side" style={{ alignItems: 'start' }}>
        {/* ---------------- main column ---------------- */}
        <div className="u-stack">
          <Card title="Basics" subtitle="Name, description and flavour shown on the product page.">
            <div className="u-form-grid two">
              <Field label="Name" required error={err('name')} className="span-all">
                {(fid) => <Input id={fid} value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Belgian Chocolate Truffle" error={err('name')} maxLength={80} />}
              </Field>
              <Field label="Description" hint={`${form.desc.length} characters · shown under the photos on the product page`} className="span-all">
                {(fid) => <Textarea id={fid} rows={4} value={form.desc} onChange={(e) => set({ desc: e.target.value })} placeholder="Layers of dark chocolate sponge soaked in cocoa syrup, filled with a silky truffle ganache…" />}
              </Field>
              <Field label="Flavour" hint={flavours.length ? 'Pick one of your flavours or type a new one.' : 'Type the flavour, e.g. Belgian Chocolate.'}>
                {(fid) => (
                  <>
                    <Input id={fid} list="cake-flavour-list" value={form.flavour} onChange={(e) => set({ flavour: e.target.value })} placeholder="e.g. Belgian Chocolate" />
                    <datalist id="cake-flavour-list">{flavours.map((fl) => <option key={fl._id} value={fl.name} />)}</datalist>
                  </>
                )}
              </Field>
              <Field label="Tag" hint="A small badge on the cake's photo in the shop.">
                {(fid) => (
                  <div className="u-stack tight" style={{ gap: 8 }}>
                    <Select
                      id={fid}
                      value={customTag ? '__custom' : form.tag}
                      onChange={(e) => {
                        if (e.target.value === '__custom') { setCustomTag(true); set({ tag: '' }); } else { setCustomTag(false); set({ tag: e.target.value }); }
                      }}
                      options={[{ value: '', label: 'No tag' }, ...TAG_PRESETS, { value: '__custom', label: 'Custom…' }]}
                    />
                    {customTag && <Input value={form.tag} onChange={(e) => set({ tag: e.target.value })} placeholder="e.g. Diwali Special" maxLength={24} autoFocus />}
                  </div>
                )}
              </Field>
            </div>
          </Card>

          <Card title="Photos" subtitle="The first photo is the cover used on every card and listing. Use the arrows to reorder or the star to make one the cover." actions={<span className="u-small u-muted">{form.img.length} photo{form.img.length === 1 ? '' : 's'}</span>}>
            <Gallery value={form.img} onChange={(img) => set({ img })} />
          </Card>

          <Card
            title="Pricing"
            subtitle={isBox ? `“${form.cat}” is sold as a box — customers pay one price and don't choose a weight.` : 'Base price is for 0.5 KG. Leave a weight blank to price it automatically, or type a price to override it.'}
          >
            <div className="u-stack">
              <div className="u-form-grid two">
                <Field label={isBox ? 'Box price' : 'Base price (0.5 KG)'} required error={err('base')}>
                  {(fid) => <Input id={fid} prefix="₹" type="number" min="0" inputMode="decimal" value={form.base} onChange={(e) => set({ base: e.target.value })} placeholder="649" error={err('base')} />}
                </Field>
              </div>
              {isBox ? (
                <Alert tone="blue" icon="info" title="No weight options for boxes">
                  Change the category in the Status panel if this cake should be sold by weight. {form.extra.length + TIERS.filter((t) => form.tiers[t.w] !== '').length > 0 && 'Weight prices you set earlier are kept and come back if you switch.'}
                </Alert>
              ) : (
                <div className="u-stack tight">
                  <div className="u-x-weights">
                    <div className="u-x-wrow head"><span>Weight</span><span>Price</span><span>Shown as</span></div>
                    <div className="u-x-wrow">
                      <span className="wlab">0.5 KG</span>
                      <span className="u-num u-strong">{money(Number(form.base) || 0)}</span>
                      <span className="u-xs u-muted">Base price</span>
                    </div>
                    {TIERS.map((t) => (
                      <div key={t.w}>
                        <div className="u-x-wrow">
                          <span className="wlab">{t.w}</span>
                          <Input prefix="₹" type="number" min="0" inputMode="decimal" aria-label={`${t.w} price`} value={form.tiers[t.w]} onChange={(e) => setTier(t.w, e.target.value)} placeholder={String(autoPrice(form.base, t.mult))} error={err(`t:${t.w}`)} />
                          {form.tiers[t.w] === '' ? (
                            <span className="u-xs u-muted">Auto · {money(autoPrice(form.base, t.mult))}</span>
                          ) : (
                            <button type="button" className="u-link u-xs" onClick={() => setTier(t.w, '')}>Reset to auto</button>
                          )}
                        </div>
                        {err(`t:${t.w}`) && <div className="u-x-wrow-err u-error">{err(`t:${t.w}`)}</div>}
                      </div>
                    ))}
                    {form.extra.map((x, i) => (
                      <div key={i}>
                        <div className="u-x-wrow">
                          <Input value={x.w} onChange={(e) => setExtra(i, { w: e.target.value })} placeholder="3 KG" aria-label="Weight label" error={err(`x:${i}`)} />
                          <Input prefix="₹" type="number" min="0" inputMode="decimal" value={x.price} onChange={(e) => setExtra(i, { price: e.target.value })} placeholder="Price" aria-label="Price" error={err(`x:${i}`)} />
                          <Button size="sm" variant="ghost" icon="trash" aria-label="Remove weight" onClick={() => set({ extra: form.extra.filter((_, j) => j !== i) })} />
                        </div>
                        {err(`x:${i}`) && <div className="u-x-wrow-err u-error">{err(`x:${i}`)}</div>}
                      </div>
                    ))}
                  </div>
                  <div className="u-row between">
                    <Button size="sm" icon="plus" onClick={() => set({ extra: [...form.extra, { w: '', price: '' }] })}>Add custom weight</Button>
                    <span className="u-xs u-muted">Custom weights (e.g. 3 KG, 5 KG) show as extra options at exactly the price you set.</span>
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card title="Ratings shown on the store" subtitle="The stars and review count on this cake's card. They're set by you, independent of the written reviews below.">
            <div className="u-form-grid two">
              <Field label="Rating (0–5)" error={err('rating')} hint={<span className="u-row" style={{ gap: 6 }}><Stars rating={form.rating} size="sm" /> as shown on the card</span>}>
                {(fid) => <Input id={fid} type="number" min="0" max="5" step="0.1" inputMode="decimal" value={form.rating} onChange={(e) => set({ rating: e.target.value })} error={err('rating')} />}
              </Field>
              <Field label="Number of reviews" error={err('reviews')} hint="Shown in brackets next to the stars.">
                {(fid) => <Input id={fid} type="number" min="0" step="1" inputMode="numeric" value={form.reviews} onChange={(e) => set({ reviews: e.target.value })} error={err('reviews')} />}
              </Field>
            </div>
          </Card>

          <Card title="Dietary & placement">
            <div className="u-stack tight" style={{ gap: 16 }}>
              <Switch checked={form.eggless} onChange={(v) => set({ eggless: v })} label="Eggless" description="Shows the eggless badge and appears under the eggless filter." />
              <Switch checked={form.veg} onChange={(v) => set({ veg: v })} label="Pure veg" description="Shows the green veg mark next to the name." />
              <Switch checked={form.corporate} onChange={(v) => set({ corporate: v })} label="Corporate gifting" description="Also lists this cake on the Corporate Cakes page for bulk and office orders." />
            </div>
          </Card>

          {!isNew && <ReviewsCard productId={id} onUseStats={(avg, count) => set({ rating: String(avg), reviews: String(count) })} />}
        </div>

        {/* ---------------- side column ---------------- */}
        <div className="u-stack">
          <Card title="Status">
            <div className="u-stack tight" style={{ gap: 16 }}>
              <Field label="Category" required error={err('cat')} hint={cat && !cat.active ? 'This category is hidden, so the cake won’t show in the shop menus until it’s visible again.' : cat?.isBox ? 'Sold as a box — single price.' : 'Sold by weight.'}>
                {(fid) => (
                  <Select
                    id={fid}
                    value={form.cat}
                    onChange={(e) => set({ cat: e.target.value })}
                    error={err('cat')}
                    placeholder={form.cat ? undefined : 'Choose a category'}
                    options={[
                      ...(form.cat && !catByName.has(form.cat) ? [{ value: form.cat, label: `${form.cat} (missing)` }] : []),
                      ...categories.map((c) => ({ value: c.name, label: `${c.name}${c.active ? '' : ' (hidden)'}${c.isBox ? ' · box' : ''}` })),
                    ]}
                  />
                )}
              </Field>
              <Field label="Quantity in stock" required error={err('qty')} hint="0 = out of stock · 1–6 = low stock · 7+ = in stock">
                {(fid) => (
                  <div className="u-row" style={{ flexWrap: 'nowrap' }}>
                    <div style={{ flex: 1 }}><Input id={fid} type="number" min="0" step="1" inputMode="numeric" value={form.qty} onChange={(e) => set({ qty: e.target.value })} error={err('qty')} /></div>
                    <Status>{stock}</Status>
                  </div>
                )}
              </Field>
            </div>
          </Card>

          <Card title="Store preview" subtitle="How the card looks in the shop.">
            <CakeCardPreview
              name={form.name} flavour={form.flavour} img={form.img[0]} tag={form.tag} price={form.base}
              priceLabel={isBox ? 'Per box' : 'Starting at'} rating={form.rating} reviews={form.reviews} stock={stock} qty={form.qty} cat={form.cat}
            />
          </Card>

          {!isNew && product && (
            <Card title="Sales">
              <KeyValue items={[
                ['Units sold', <b className="u-num" key="s">{product.sold || 0}</b>],
                ['Photos', form.img.length],
                ['Weight options', isBox ? 'Box · single price' : `${4 + form.extra.length} (0.5 / 1 / 1.5 / 2 KG${form.extra.length ? ' + custom' : ''})`],
                ['Added', fmtDate(product.createdAt)],
                ['Last updated', fmtDateTime(product.updatedAt)],
              ]} />
            </Card>
          )}

          {!isNew && (
            <Card title="Danger zone" className="u-x-danger">
              <div className="u-stack tight">
                <p className="u-small u-muted">Deleting removes the cake from the shop immediately. To pause sales instead, set the quantity to 0.</p>
                <Button variant="danger-soft" icon="trash" onClick={remove}>Delete this cake</Button>
              </div>
            </Card>
          )}
        </div>
      </div>

      <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={discard} saveLabel={isNew ? 'Create cake' : 'Save changes'} message={isNew ? 'New cake — not saved yet' : 'You have unsaved changes'} />
    </Page>
  );
}

/* ---------------- Reviews for this cake ---------------- */
function ReviewsCard({ productId, onUseStats }) {
  const confirm = useConfirm();
  const loader = useCallback(() => Promise.all([reviewService.listForProduct(productId), productService.list()]), [productId]);
  const { data, setData, loading, error, reload } = useAsync(loader, [loader]);
  const [editing, setEditing] = useState(null); // null | {} (new) | review
  const reviews = data?.[0] || [];
  const products = data?.[1] || [];

  const avg = reviews.length ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10 : 0;

  const onSaved = (r) => {
    setData(([list, prods]) => {
      const others = list.filter((x) => x._id !== r._id);
      // A review re-linked to another cake drops off this list.
      return [String(r.product) === String(productId) ? [r, ...others].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) : others, prods];
    });
  };

  const remove = async (r) => {
    if (!(await confirm({ title: 'Delete this review?', message: `${r.name}'s review will be removed from the site.`, confirmLabel: 'Delete', danger: true }))) return;
    try {
      await reviewService.remove(r._id);
      setData(([list, prods]) => [list.filter((x) => x._id !== r._id), prods]);
      toast.success('Review deleted');
    } catch (e) {
      toast.error('Could not delete review', e.message);
    }
  };

  return (
    <Card
      title="Customer reviews"
      subtitle={reviews.length ? `${reviews.length} written review${reviews.length === 1 ? '' : 's'} · average ${avg}/5 — shown first on this cake's page` : 'Written reviews linked to this cake appear first on its product page.'}
      flush
      actions={
        <>
          {reviews.length > 0 && <Button size="sm" onClick={() => { onUseStats(avg, reviews.length); toast.info('Ratings updated', `Set to ${avg}★ from ${reviews.length} reviews — save to apply.`); }}>Use for store rating</Button>}
          <Button size="sm" variant="primary" icon="plus" onClick={() => setEditing({})}>Add review</Button>
        </>
      }
    >
      <div style={{ padding: loading && !data ? 20 : 0 }}>
        <Loader loading={loading && !data} error={!data ? error : ''} onRetry={reload} rows={3}>
          {reviews.length === 0 ? (
            <EmptyState icon="quote" title="No reviews for this cake yet" actions={<Button size="sm" icon="plus" onClick={() => setEditing({})}>Add the first review</Button>}>
              Add testimonials from happy customers — they build trust right where people decide to order.
            </EmptyState>
          ) : (
            <div className="u-list">
              {reviews.map((r) => (
                <div key={r._id} className="u-list-item clickable" style={{ alignItems: 'flex-start' }} onClick={() => setEditing(r)}>
                  <div className="u-stack tight" style={{ gap: 4, flex: 1, minWidth: 0 }}>
                    <span className="u-row" style={{ gap: 8 }}>
                      <b className="u-strong">{r.name}</b>
                      {r.occ && <span className="u-xs u-muted">· {r.occ}</span>}
                      <Stars rating={r.rating} size="sm" />
                    </span>
                    <p className="u-small" style={{ color: 'var(--u-text)' }}>{r.text}</p>
                    <span className="u-xs u-faint">{fmtDate(r.createdAt)}</span>
                  </div>
                  <Menu items={[
                    { label: 'Edit', icon: 'edit', onClick: () => setEditing(r) },
                    { label: 'Delete', icon: 'trash', danger: true, onClick: () => remove(r) },
                  ]} />
                </div>
              ))}
            </div>
          )}
        </Loader>
      </div>
      <ReviewDrawer
        open={!!editing}
        review={editing?._id ? editing : null}
        presetProduct={productId}
        products={products}
        onClose={() => setEditing(null)}
        onSaved={onSaved}
      />
    </Card>
  );
}
