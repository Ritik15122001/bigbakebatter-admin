import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../components/common/Icon';
import {
  Page, Card, Button, Status, Cell, DataTable, Tabs, Drawer, Field, Input, Select, Textarea, Switch, Alert,
  EmptyState, Loader, ImageUpload, Tag, useAsync, useConfirm, toast,
} from '../ui';
import { ColorInput, IconGrid, Stars, ReviewDrawer } from '../ui/ext-cat';
import {
  flavourService, occasionService, addonService, addonCategoryService, faqService, reviewService, categoryService,
} from '../services/catalogService';
import { productService } from '../services/productService';
import { money, fmtDate } from '../utils/format';
import { resolveImg } from '../utils/media';
import { PICKABLE_ICONS } from '../utils/icons';

const loadAll = () =>
  Promise.all([
    flavourService.list(), occasionService.list(), addonService.list(), addonCategoryService.list(), faqService.list(),
    reviewService.list(), categoryService.list(), productService.list(),
  ]).then(([flavours, occasions, addons, groups, faqs, reviews, categories, products]) => ({
    flavours, occasions, addons, groups, faqs, reviews, categories, products,
  }));

const TABS = [
  { value: 'flavours', label: 'Flavours', icon: 'bowl', noun: 'flavour', key: 'flavours', service: flavourService },
  { value: 'occasions', label: 'Occasions', icon: 'party', noun: 'occasion', key: 'occasions', service: occasionService },
  { value: 'addons', label: 'Add-ons', icon: 'gift', noun: 'add-on', key: 'addons', service: addonService },
  { value: 'addonGroups', label: 'Add-on groups', icon: 'grid', noun: 'add-on group', key: 'groups', service: addonCategoryService },
  { value: 'faqs', label: 'FAQs', icon: 'msg', noun: 'FAQ', key: 'faqs', service: faqService },
  { value: 'reviews', label: 'Reviews', icon: 'star', noun: 'review', key: 'reviews', service: reviewService },
];

const DESCRIPTIONS = {
  flavours: 'Flavour tiles on the homepage. Cakes pick their flavour from this list in the cake editor.',
  occasions: 'The “Shop by occasion” photo tiles on the homepage. Each links to a category.',
  addons: 'Extras offered with every cake — toppers, candles, cards. Each one sits in an add-on group.',
  addonGroups: 'Tabs inside the storefront’s add-ons pop-up. “Popular” is automatic (featured add-ons), so it isn’t a group.',
  faqs: 'Questions and answers in the FAQ section, in position order.',
  reviews: 'Customer testimonials on the homepage. Reviews linked to a cake also show first on that cake’s page.',
};

const clip = (s, n = 90) => (s && s.length > n ? `${s.slice(0, n)}…` : s || '');

export default function SiteContent() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.value === params.get('tab')) ? params.get('tab') : 'flavours';
  const setTab = (t) => setParams(t === 'flavours' ? {} : { tab: t }, { replace: true });
  const { data, setData, loading, error, reload } = useAsync(loadAll);
  const [editing, setEditing] = useState(null); // null | 'new' | item
  const confirm = useConfirm();
  const meta = TABS.find((t) => t.value === tab);

  const switchTab = (t) => { setEditing(null); setTab(t); };

  const upsert = (key, item) => setData((d) => ({ ...d, [key]: d[key].some((x) => x._id === item._id) ? d[key].map((x) => (x._id === item._id ? item : x)) : [item, ...d[key]] }));

  const remove = async (item, label, extra) => {
    const ok = await confirm({ title: `Delete ${label}?`, message: extra || 'It is removed from the website straight away. This can’t be undone.', confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    try {
      await meta.service.remove(item._id);
      setData((d) => ({ ...d, [meta.key]: d[meta.key].filter((x) => x._id !== item._id) }));
      toast.success(`${meta.noun[0].toUpperCase()}${meta.noun.slice(1)} deleted`, label.replace(/[“”]/g, ''));
    } catch (err) {
      toast.error('Could not delete', err.message);
    }
  };

  return (
    <Page
      title="Catalogue extras"
      description="Flavours, occasions, add-ons, FAQs and testimonials that fill out the shop around your cakes."
      actions={<Button variant="primary" icon="plus" onClick={() => setEditing('new')} disabled={!data}>Add {meta.noun}</Button>}
      tabs={<Tabs value={tab} onChange={switchTab} items={TABS.map((t) => ({ value: t.value, label: t.label, icon: t.icon, count: data?.[t.key]?.length }))} />}
    >
      <Loader loading={loading && !data} error={!data ? error : ''} onRetry={reload} rows={6}>
        {data && (
          <div className="u-stack">
            <p className="u-small u-muted" style={{ marginTop: -8 }}>{DESCRIPTIONS[tab]}</p>
            <Card flush className="u-x-mintable">
              <TabTable tab={tab} data={data} onEdit={setEditing} onNew={() => setEditing('new')} onDelete={remove} />
            </Card>
          </div>
        )}
      </Loader>

      {data && editing && tab !== 'reviews' && (
        <EditDrawer
          tab={tab}
          meta={meta}
          item={editing === 'new' ? null : editing}
          data={data}
          onClose={() => setEditing(null)}
          onSaved={(item) => { upsert(meta.key, item); setEditing(null); }}
        />
      )}
      {data && (
        <ReviewDrawer
          open={!!editing && tab === 'reviews'}
          review={editing && editing !== 'new' ? editing : null}
          products={data.products}
          onClose={() => setEditing(null)}
          onSaved={(r) => upsert('reviews', r)}
        />
      )}
    </Page>
  );
}

/* ====================== Tables ====================== */
function TabTable({ tab, data, onEdit, onNew, onDelete }) {
  const navigate = useNavigate();
  const groupLabel = (key) => data.groups.find((g) => g.key === key)?.label;
  const productName = (id) => data.products.find((p) => p._id === id)?.name;
  const catNames = data.categories.map((c) => c.name);
  const menu = (label, extra) => (row) => [
    { label: 'Edit', icon: 'edit', onClick: () => onEdit(row) },
    { divider: true },
    { label: 'Delete', icon: 'trash', danger: true, onClick: () => onDelete(row, label(row), extra?.(row)) },
  ];
  const empty = (icon, title, text) => (
    <EmptyState icon={icon} title={title} actions={<Button variant="primary" icon="plus" onClick={onNew}>Add the first one</Button>}>{text}</EmptyState>
  );
  const common = { onRowClick: onEdit, pageSize: 15 };

  if (tab === 'flavours') {
    return (
      <DataTable
        key="flavours" {...common} rows={data.flavours} exportName="flavours"
        search={{ placeholder: 'Search flavours…', fields: ['name'] }}
        initialSort={{ key: 'name', dir: 'asc' }}
        rowActions={menu((f) => `“${f.name}”`)}
        empty={empty('bowl', 'No flavours yet', 'Flavours show as colourful tiles on the homepage and as suggestions in the cake editor.')}
        columns={[
          { key: 'name', header: 'Flavour', sortable: true, render: (f) => <span className="u-row" style={{ gap: 12, flexWrap: 'nowrap' }}><span className="u-x-swatch" style={{ background: f.col }} /><b className="u-strong">{f.name}</b></span> },
          { key: 'col', header: 'Colour', render: (f) => <span className="u-mono u-muted">{f.col}</span> },
          { key: 'cakes', header: 'Cakes', align: 'right', sortable: true, sortValue: (f) => data.products.filter((p) => p.flavour === f.name).length, render: (f) => <span className="u-num">{data.products.filter((p) => p.flavour === f.name).length}</span> },
          { key: 'from', header: 'Starting price', align: 'right', sortable: true, render: (f) => <b className="u-num u-strong">{money(f.from || 0)}</b> },
        ]}
      />
    );
  }
  if (tab === 'occasions') {
    return (
      <DataTable
        key="occasions" {...common} rows={data.occasions} exportName="occasions"
        search={{ placeholder: 'Search occasions…', fields: ['name', 'blurb', 'cat'] }}
        filters={[{ key: 'cat', label: 'Any category', options: catNames }]}
        rowActions={menu((o) => `“${o.name}”`)}
        empty={empty('party', 'No occasions yet', 'Occasions are the “Shop by occasion” photo tiles that link shoppers to a category.')}
        columns={[
          { key: 'name', header: 'Occasion', sortable: true, render: (o) => <Cell thumb={o.img || ''} title={o.name} sub={o.cat ? `Opens ${o.cat}` : 'No category linked'} /> },
          { key: 'blurb', header: 'Blurb', render: (o) => <span className="u-small u-muted u-x-clip">{o.blurb || '—'}</span> },
          { key: 'cat', header: 'Category', sortable: true, render: (o) => (o.cat ? (catNames.includes(o.cat) ? <Tag>{o.cat}</Tag> : <Status tone="red" size="sm">{o.cat} (missing)</Status>) : <span className="u-faint">—</span>) },
        ]}
      />
    );
  }
  if (tab === 'addons') {
    return (
      <DataTable
        key="addons" {...common} rows={data.addons} exportName="add-ons"
        search={{ placeholder: 'Search add-ons…', fields: ['name', 'unit'] }}
        filters={[
          { key: 'cat', label: 'Any group', options: data.groups.map((g) => ({ value: g.key, label: g.label })) },
          { key: 'popular', label: 'Featured or not', options: [{ value: 'yes', label: 'Featured' }, { value: 'no', label: 'Not featured' }], test: (a, v) => (v === 'yes' ? !!a.popular : !a.popular) },
        ]}
        rowActions={menu((a) => `“${a.name}”`)}
        empty={empty('gift', 'No add-ons yet', 'Add-ons are extras like toppers and candles that shoppers add alongside a cake.')}
        columns={[
          { key: 'name', header: 'Add-on', sortable: true, render: (a) => <Cell thumb={a.img || ''} title={a.name} sub={a.unit || 'per item'} /> },
          { key: 'cat', header: 'Group', sortable: true, csv: (a) => groupLabel(a.cat) || a.cat, render: (a) => (groupLabel(a.cat) ? <Tag>{groupLabel(a.cat)}</Tag> : <Status tone="red" size="sm">{a.cat || 'none'} (no group)</Status>) },
          { key: 'popular', header: 'Featured', csv: (a) => (a.popular ? 'Yes' : 'No'), render: (a) => (a.popular ? <Status tone="violet" size="sm">Featured</Status> : <span className="u-faint">—</span>) },
          { key: 'price', header: 'Price', align: 'right', sortable: true, render: (a) => <b className="u-num u-strong">{money(a.price)}</b> },
        ]}
      />
    );
  }
  if (tab === 'addonGroups') {
    const count = (g) => data.addons.filter((a) => a.cat === g.key).length;
    return (
      <DataTable
        key="groups" {...common} rows={data.groups} exportName="add-on-groups"
        search={{ placeholder: 'Search groups…', fields: ['label', 'key'] }}
        initialSort={{ key: 'order', dir: 'asc' }}
        rowActions={menu((g) => `“${g.label}”`, (g) => (count(g) ? `${count(g)} add-on${count(g) === 1 ? ' is' : 's are'} in this group. They stay in the catalogue but won’t appear in any tab until you move them to another group.` : undefined))}
        empty={empty('grid', 'No add-on groups yet', 'Groups are the tabs in the add-ons pop-up, e.g. Toppers, Candles, Cards.')}
        columns={[
          { key: 'label', header: 'Group', sortable: true, render: (g) => <span className="u-row" style={{ gap: 12, flexWrap: 'nowrap' }}><span className="u-stat-ico tone-brand" style={{ width: 34, height: 34 }}><Icon name={g.icon || 'gift'} /></span><b className="u-strong">{g.label}</b></span> },
          { key: 'key', header: 'Key', render: (g) => <span className="u-mono">{g.key}</span> },
          { key: 'addons', header: 'Add-ons', align: 'right', sortable: true, sortValue: count, render: (g) => <span className="u-num">{count(g)}</span> },
          { key: 'order', header: 'Position', align: 'right', sortable: true, render: (g) => <span className="u-num">{g.order ?? 0}</span> },
        ]}
      />
    );
  }
  if (tab === 'faqs') {
    return (
      <DataTable
        key="faqs" {...common} rows={data.faqs} exportName="faqs"
        search={{ placeholder: 'Search questions and answers…', fields: ['q', 'a'] }}
        initialSort={{ key: 'order', dir: 'asc' }}
        rowActions={menu(() => 'this FAQ')}
        empty={empty('msg', 'No FAQs yet', 'Answer common questions about delivery, eggless options and custom cakes before customers have to ask.')}
        columns={[
          { key: 'order', header: '#', shrink: true, sortable: true, render: (f) => <span className="u-num u-muted">{f.order ?? 0}</span> },
          { key: 'q', header: 'Question', sortable: true, render: (f) => <b className="u-strong">{f.q}</b> },
          { key: 'a', header: 'Answer', render: (f) => <span className="u-small u-muted u-x-clip">{clip(f.a, 140)}</span> },
        ]}
      />
    );
  }
  // reviews
  return (
    <DataTable
      key="reviews" {...common} rows={data.reviews} exportName="reviews"
      search={{ placeholder: 'Search reviews…', fields: (r) => `${r.name} ${r.occ} ${r.text} ${productName(r.product) || ''}` }}
      filters={[
        { key: 'rating', label: 'Any rating', options: ['5', '4', '3', '2', '1'].map((v) => ({ value: v, label: `${v} stars` })) },
        { key: 'product', label: 'Linked or not', options: [{ value: 'linked', label: 'Linked to a cake' }, { value: 'general', label: 'General testimonial' }], test: (r, v) => (v === 'linked' ? !!r.product : !r.product) },
      ]}
      initialSort={{ key: 'createdAt', dir: 'desc' }}
      rowActions={(r) => [
        { label: 'Edit', icon: 'edit', onClick: () => onEdit(r) },
        r.product && productName(r.product) && { label: 'Open cake', icon: 'cake', onClick: () => navigate(`/cakes/${r.product}`) },
        { divider: true },
        { label: 'Delete', icon: 'trash', danger: true, onClick: () => onDelete(r, `${r.name}'s review`) },
      ]}
      empty={empty('star', 'No reviews yet', 'Testimonials from happy customers show on the homepage and build trust.')}
      columns={[
        { key: 'name', header: 'Customer', sortable: true, render: (r) => <Cell avatar={r.name} title={r.name} sub={r.occ || '—'} /> },
        { key: 'rating', header: 'Rating', sortable: true, render: (r) => <Stars rating={r.rating} size="sm" /> },
        { key: 'text', header: 'Review', render: (r) => <span className="u-small u-muted u-x-clip">{r.text}</span> },
        { key: 'product', header: 'Cake', csv: (r) => productName(r.product) || '', render: (r) => (r.product ? productName(r.product) ? <Tag>{productName(r.product)}</Tag> : <span className="u-faint">Deleted cake</span> : <span className="u-faint">General</span>) },
        { key: 'createdAt', header: 'Added', sortable: true, csv: (r) => fmtDate(r.createdAt), render: (r) => <span className="u-small u-muted">{fmtDate(r.createdAt)}</span> },
      ]}
    />
  );
}

/* ====================== Drawers ====================== */
const INITIAL = {
  flavours: (x) => ({ name: x?.name || '', from: String(x?.from ?? ''), col: x?.col || '#E4CBA1' }),
  occasions: (x, d) => ({ name: x?.name || '', cat: x ? x.cat || '' : d.categories.find((c) => c.active)?.name || '', blurb: x?.blurb || '', img: x?.img || '' }),
  addons: (x, d) => ({ name: x?.name || '', price: String(x?.price ?? ''), unit: x?.unit || '', cat: x?.cat || [...d.groups].sort((a, b) => a.order - b.order)[0]?.key || 'more', popular: !!x?.popular, img: x?.img || '' }),
  addonGroups: (x, d) => ({ label: x?.label || '', key: x?.key || '', icon: x?.icon || 'gift', order: String(x?.order ?? d.groups.length + 1) }),
  faqs: (x, d) => ({ q: x?.q || '', a: x?.a || '', order: String(x?.order ?? d.faqs.length + 1) }),
};

const slug = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
const num = (v) => v !== '' && Number.isFinite(Number(v));

function validateAndBuild(tab, f, item, data) {
  const e = {};
  let payload;
  if (tab === 'flavours') {
    if (!f.name.trim()) e.name = 'Enter a flavour name.';
    else if (data.flavours.some((x) => x._id !== item?._id && x.name.toLowerCase() === f.name.trim().toLowerCase())) e.name = 'That flavour already exists.';
    if (f.from !== '' && (!num(f.from) || Number(f.from) < 0)) e.from = 'Enter a price of 0 or more.';
    if (!/^#[0-9a-f]{6}$/i.test(f.col)) e.col = 'Use a hex colour like #E4CBA1.';
    payload = { name: f.name.trim(), from: Number(f.from) || 0, col: f.col.toUpperCase() };
  } else if (tab === 'occasions') {
    if (!f.name.trim()) e.name = 'Enter an occasion name.';
    else if (data.occasions.some((x) => x._id !== item?._id && x.name.toLowerCase() === f.name.trim().toLowerCase())) e.name = 'That occasion already exists.';
    payload = { name: f.name.trim(), cat: f.cat, blurb: f.blurb.trim(), img: f.img };
  } else if (tab === 'addons') {
    if (!f.name.trim()) e.name = 'Enter an add-on name.';
    if (!num(f.price) || Number(f.price) < 0) e.price = 'Enter a price of 0 or more.';
    if (!f.cat) e.cat = 'Choose a group.';
    payload = { name: f.name.trim(), price: Number(f.price), unit: f.unit.trim(), cat: f.cat, popular: f.popular, img: f.img };
  } else if (tab === 'addonGroups') {
    if (!f.label.trim()) e.label = 'Enter a label.';
    if (!/^[a-z0-9-]{1,30}$/.test(f.key)) e.key = 'Use 1–30 lowercase letters, numbers or dashes.';
    else if (f.key === 'popular') e.key = '“popular” is reserved for featured add-ons.';
    else if (data.groups.some((x) => x._id !== item?._id && x.key === f.key)) e.key = 'Another group already uses this key.';
    if (f.order !== '' && !num(f.order)) e.order = 'Enter a number.';
    payload = { label: f.label.trim(), key: f.key, icon: f.icon, order: Number(f.order) || 0 };
  } else {
    if (!f.q.trim()) e.q = 'Enter the question.';
    if (!f.a.trim()) e.a = 'Enter the answer.';
    if (f.order !== '' && !num(f.order)) e.order = 'Enter a number.';
    payload = { q: f.q.trim(), a: f.a.trim(), order: Number(f.order) || 0 };
  }
  return [e, payload];
}

function EditDrawer({ tab, meta, item, data, onClose, onSaved }) {
  const [f, setF] = useState(() => INITIAL[tab](item, data));
  const [initial] = useState(f);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [keyTouched, setKeyTouched] = useState(!!item);
  const set = (patch) => { setF((x) => ({ ...x, ...patch })); setErrors((e) => ({ ...e, ...Object.fromEntries(Object.keys(patch).map((k) => [k, ''])) })); };
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);
  const groups = useMemo(() => [...data.groups].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), [data.groups]);

  const save = async (ev) => {
    ev?.preventDefault();
    const [errs, payload] = validateAndBuild(tab, f, item, data);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const saved = item ? await meta.service.update(item._id, payload) : await meta.service.create(payload);
      toast.success(item ? 'Changes saved' : `${meta.noun[0].toUpperCase()}${meta.noun.slice(1)} added`, saved.name || saved.label || saved.q);
      onSaved(saved);
    } catch (err) {
      toast.error('Could not save', err.message);
    } finally {
      setSaving(false);
    }
  };

  const title = item ? `Edit ${meta.noun}` : `Add ${/^[aeiou]/i.test(meta.noun) ? 'an' : 'a'} ${meta.noun}`;
  const formId = `extras-form-${tab}`;
  const linkedAddons = tab === 'addonGroups' && item ? data.addons.filter((a) => a.cat === item.key).length : 0;

  return (
    <Drawer
      open
      onClose={onClose}
      title={title}
      description={item ? `Added ${fmtDate(item.createdAt)} · last changed ${fmtDate(item.updatedAt)}` : DESCRIPTIONS[tab]}
      footer={
        <>
          {dirty && <span className="u-small u-muted" style={{ marginRight: 'auto', alignSelf: 'center' }}>Unsaved changes</span>}
          <Button onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form={formId} variant="primary" icon="check" loading={saving} disabled={!!item && !dirty}>{item ? 'Save changes' : 'Add'}</Button>
        </>
      }
    >
      <form id={formId} className="u-stack" onSubmit={save}>
        {tab === 'flavours' && (
          <>
            <Field label="Name" required error={errors.name}>{(id) => <Input id={id} value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Belgian Chocolate" error={errors.name} autoFocus />}</Field>
            <div className="u-form-grid two">
              <Field label="Starting price" error={errors.from} hint="“From ₹…” on the tile. 0 hides it.">{(id) => <Input id={id} prefix="₹" type="number" min="0" value={f.from} onChange={(e) => set({ from: e.target.value })} placeholder="599" error={errors.from} />}</Field>
              <Field label="Tile colour" error={errors.col}>{() => <ColorInput value={f.col} onChange={(col) => set({ col })} error={errors.col} />}</Field>
            </div>
            <Preview>
              <div className="u-x-flav" style={{ background: (() => { const c = /^#[0-9a-f]{6}$/i.test(f.col) ? f.col : '#E4CBA1'; return `linear-gradient(140deg, ${c}, color-mix(in srgb, ${c} 62%, #000))`; })() }}>
                <div><b>{f.name || 'Flavour name'}</b>{Number(f.from) > 0 && <span>From {money(Number(f.from))}</span>}</div>
              </div>
            </Preview>
          </>
        )}

        {tab === 'occasions' && (
          <>
            <Field label="Name" required error={errors.name}>{(id) => <Input id={id} value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Birthday" error={errors.name} autoFocus />}</Field>
            <Field label="Links to category" hint="Clicking the tile opens this category in the shop.">
              {(id) => <Select id={id} value={f.cat} onChange={(e) => set({ cat: e.target.value })} options={[{ value: '', label: '— No link —' }, ...data.categories.map((c) => ({ value: c.name, label: `${c.name}${c.active ? '' : ' (hidden)'}` })), ...(f.cat && !data.categories.some((c) => c.name === f.cat) ? [{ value: f.cat, label: `${f.cat} (missing)` }] : [])]} />}
            </Field>
            <Field label="Short blurb" hint={`${f.blurb.length}/120 · one line under the name`}>{(id) => <Textarea id={id} rows={2} maxLength={120} value={f.blurb} onChange={(e) => set({ blurb: e.target.value })} placeholder="Make their day with a cake they'll remember" />}</Field>
            <Field label="Photo">{() => <ImageUpload value={f.img} onChange={(img) => set({ img })} />}</Field>
            <Preview>
              <div className="u-x-occ">
                {f.img ? <img src={resolveImg(f.img)} alt="" /> : <Icon name="image" />}
                <div className="u-x-occ-cap"><b>{f.name || 'Occasion'}</b><span>{f.blurb || 'Short blurb'}</span></div>
              </div>
            </Preview>
          </>
        )}

        {tab === 'addons' && (
          <>
            <Field label="Name" required error={errors.name}>{(id) => <Input id={id} value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Happy Birthday topper" error={errors.name} autoFocus />}</Field>
            <div className="u-form-grid two">
              <Field label="Price" required error={errors.price}>{(id) => <Input id={id} prefix="₹" type="number" min="0" value={f.price} onChange={(e) => set({ price: e.target.value })} placeholder="99" error={errors.price} />}</Field>
              <Field label="Unit" hint="Optional, e.g. per candle">{(id) => <Input id={id} value={f.unit} onChange={(e) => set({ unit: e.target.value })} placeholder="per piece" />}</Field>
            </div>
            <Field label="Group" required error={errors.cat} hint="The tab it appears under in the add-ons pop-up.">
              {(id) => <Select id={id} value={f.cat} onChange={(e) => set({ cat: e.target.value })} error={errors.cat} options={[...groups.map((g) => ({ value: g.key, label: g.label })), ...(f.cat && !groups.some((g) => g.key === f.cat) ? [{ value: f.cat, label: `${f.cat} (no such group)` }] : [])]} placeholder={groups.length ? undefined : 'Create a group first'} />}
            </Field>
            <Switch checked={f.popular} onChange={(popular) => set({ popular })} label="Featured" description="Also shows under the automatic “Popular” tab." />
            <Field label="Photo">{() => <ImageUpload value={f.img} onChange={(img) => set({ img })} />}</Field>
            <Preview>
              <div className="u-x-addon">
                <span className="u-thumb">{f.img ? <img src={resolveImg(f.img)} alt="" /> : <Icon name="gift" />}</span>
                <div className="u-cell-text" style={{ flex: 1 }}>
                  <b>{f.name || 'Add-on name'}</b>
                  <span>{money(Number(f.price) || 0)}{f.unit ? ` · ${f.unit}` : ''}</span>
                </div>
                {f.popular && <Status tone="violet" size="sm">Popular</Status>}
              </div>
            </Preview>
          </>
        )}

        {tab === 'addonGroups' && (
          <>
            <div className="u-form-grid two">
              <Field label="Label" required error={errors.label}>{(id) => <Input id={id} value={f.label} onChange={(e) => set(keyTouched ? { label: e.target.value } : { label: e.target.value, key: slug(e.target.value) })} placeholder="e.g. Cake Toppers" error={errors.label} autoFocus />}</Field>
              <Field label="Key" required error={errors.key} hint="Short id stored on each add-on.">{(id) => <Input id={id} className="u-mono" value={f.key} onChange={(e) => { setKeyTouched(true); set({ key: e.target.value.toLowerCase().replace(/\s+/g, '-') }); }} placeholder="toppers" error={errors.key} />}</Field>
            </div>
            {item && f.key !== item.key && linkedAddons > 0 && (
              <Alert tone="amber" icon="alert" title="Changing the key unlinks add-ons">
                {linkedAddons} add-on{linkedAddons === 1 ? ' uses' : 's use'} “{item.key}”. After saving they won’t appear in any tab until you move them to a group.
              </Alert>
            )}
            <Field label="Icon">{() => <IconGrid value={f.icon} onChange={(icon) => set({ icon })} options={PICKABLE_ICONS} />}</Field>
            <Field label="Position" error={errors.order} hint="Lower numbers show first.">{(id) => <Input id={id} type="number" value={f.order} onChange={(e) => set({ order: e.target.value })} style={{ maxWidth: 160 }} error={errors.order} />}</Field>
          </>
        )}

        {tab === 'faqs' && (
          <>
            <Field label="Question" required error={errors.q}>{(id) => <Input id={id} value={f.q} onChange={(e) => set({ q: e.target.value })} placeholder="Do you deliver on the same day?" error={errors.q} autoFocus />}</Field>
            <Field label="Answer" required error={errors.a} hint={`${f.a.length} characters`}>{(id) => <Textarea id={id} rows={6} value={f.a} onChange={(e) => set({ a: e.target.value })} placeholder="Yes — order before 4 PM for delivery the same evening…" error={errors.a} />}</Field>
            <Field label="Position" error={errors.order} hint="Lower numbers show first.">{(id) => <Input id={id} type="number" value={f.order} onChange={(e) => set({ order: e.target.value })} style={{ maxWidth: 160 }} error={errors.order} />}</Field>
          </>
        )}
      </form>
    </Drawer>
  );
}

function Preview({ children }) {
  return (
    <div className="u-stack tight" style={{ gap: 8 }}>
      <span className="u-x-preview-label">Preview</span>
      {children}
    </div>
  );
}
