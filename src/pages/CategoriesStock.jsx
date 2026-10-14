import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../components/common/Icon';
import {
  Page, Card, Stat, Button, Status, Cell, DataTable, Tabs, Drawer, Field, Input, Switch, Alert, Menu, EmptyState,
  Loader, useAsync, useConfirm, toast, downloadCsv,
} from '../ui';
import { IconGrid, QtyStepper } from '../ui/ext-cat';
import { categoryService, occasionService } from '../services/catalogService';
import { productService } from '../services/productService';
import { PICKABLE_ICONS } from '../utils/icons';
import { stockFromQty } from '../utils/stock';
import { fmtDate } from '../utils/format';

const byOrderThenName = (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name);
const loadAll = () =>
  Promise.all([categoryService.list(), productService.list(), occasionService.list().catch(() => [])])
    .then(([categories, products, occasions]) => ({ categories, products, occasions }));
const TONES = ['brand', 'green', 'amber', 'blue', 'violet', 'red'];

export default function CategoriesStock() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'stock' ? 'stock' : 'categories';
  const setTab = (t) => setParams(t === 'categories' ? {} : { tab: t }, { replace: true });
  const { data, setData, loading, error, reload } = useAsync(loadAll);

  const lowCount = (data?.products || []).filter((p) => p.stock !== 'In stock').length;

  return (
    <Page
      title="Categories & stock"
      description="Organise the menu into categories and keep quantities up to date. Stock status follows the quantity automatically."
      tabs={
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: 'categories', label: 'Categories', icon: 'grid', count: data?.categories.length },
            { value: 'stock', label: 'Stock levels', icon: 'pkg', count: data ? lowCount || undefined : undefined },
          ]}
        />
      }
    >
      <Loader loading={loading && !data} error={!data ? error : ''} onRetry={reload} rows={6}>
        {data && (tab === 'categories' ? <CategoriesTab data={data} setData={setData} reload={reload} /> : <StockTab data={data} setData={setData} />)}
      </Loader>
    </Page>
  );
}

/* ====================== Categories ====================== */
function CategoriesTab({ data, setData, reload }) {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null); // null | 'new' | category
  const categories = useMemo(() => [...data.categories].sort(byOrderThenName), [data.categories]);
  const countFor = (name) => data.products.filter((p) => p.cat === name).length;
  const occFor = (name) => data.occasions.filter((o) => o.cat === name).length;
  const shown = categories.filter((c) => !q.trim() || c.name.toLowerCase().includes(q.trim().toLowerCase()));

  const toggleActive = async (c, active) => {
    setData((d) => ({ ...d, categories: d.categories.map((x) => (x._id === c._id ? { ...x, active } : x)) }));
    try {
      await categoryService.update(c._id, { active });
      toast.success(active ? 'Category visible' : 'Category hidden', active ? `${c.name} shows in the shop menus again.` : `${c.name} and its cakes are hidden from the shop menus.`);
    } catch (err) {
      setData((d) => ({ ...d, categories: d.categories.map((x) => (x._id === c._id ? { ...x, active: c.active } : x)) }));
      toast.error('Could not update category', err.message);
    }
  };

  const remove = async (c) => {
    const n = countFor(c.name);
    const ok = await confirm({
      title: `Delete “${c.name}”?`,
      message: n
        ? `${n} cake${n === 1 ? ' is' : 's are'} still in this category, so the server will refuse. Move or delete them first — or hide the category instead.`
        : 'This removes the category from the shop menus. It can only be deleted when no cakes or occasions use it.',
      confirmLabel: 'Delete category',
      danger: true,
    });
    if (!ok) return;
    try {
      await categoryService.remove(c._id);
      setData((d) => ({ ...d, categories: d.categories.filter((x) => x._id !== c._id) }));
      toast.success('Category deleted', c.name);
    } catch (err) {
      toast.error('Can’t delete this category', err.message);
    }
  };

  const exportCsv = () => downloadCsv(
    'categories',
    ['Name', 'Icon', 'Cakes', 'Occasions', 'Sold as box', 'Visible', 'Position', 'Created'],
    categories.map((c) => [c.name, c.icon, countFor(c.name), occFor(c.name), c.isBox ? 'Yes' : 'No', c.active ? 'Yes' : 'No', c.order ?? 0, fmtDate(c.createdAt)])
  );

  return (
    <div className="u-stack">
      <Card flush className="u-x-mintable">
        <div className="u-dt-toolbar" style={{ borderBottom: 0 }}>
          <div className="u-dt-search"><Input icon="search" placeholder="Search categories…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <span className="u-small u-muted">
            {categories.filter((c) => c.active).length} visible · {categories.filter((c) => !c.active).length} hidden · {categories.filter((c) => c.isBox).length} sold as boxes
          </span>
          <div className="u-dt-actions">
            <Button size="sm" icon="download" onClick={exportCsv} disabled={!categories.length}>Export</Button>
            <Button size="sm" variant="primary" icon="plus" onClick={() => setEditing('new')}>Add category</Button>
          </div>
        </div>
      </Card>

      {categories.length === 0 ? (
        <Card>
          <EmptyState icon="grid" title="No categories yet" actions={<Button variant="primary" icon="plus" onClick={() => setEditing('new')}>Add a category</Button>}>
            Categories group your cakes in the shop menus and filters — e.g. Birthday, Anniversary, Brownies.
          </EmptyState>
        </Card>
      ) : shown.length === 0 ? (
        <Card><EmptyState icon="search" title="No categories match" actions={<Button size="sm" onClick={() => setQ('')}>Clear search</Button>}>Nothing is called “{q}”.</EmptyState></Card>
      ) : (
        <div className="u-x-catgrid">
          {shown.map((c, i) => {
            const n = countFor(c.name);
            return (
              <div key={c._id} className={`u-x-catcard${c.active ? '' : ' off'}`} onClick={() => setEditing(c)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setEditing(c)}>
                <div className="u-x-catcard-head">
                  <span className={`u-x-catcard-ico tone-${TONES[i % TONES.length]}`}><Icon name={c.icon || 'cake'} /></span>
                  <div className="u-cell-text" style={{ flex: 1 }}>
                    <b style={{ fontSize: 15 }}>{c.name}</b>
                    <span>{n} cake{n === 1 ? '' : 's'} · position {c.order ?? 0}</span>
                  </div>
                  <Menu items={[
                    { label: 'Edit', icon: 'edit', onClick: () => setEditing(c) },
                    { label: 'Add a cake here', icon: 'plus', onClick: () => navigate(`/cakes/new?cat=${encodeURIComponent(c.name)}`) },
                    { label: 'Show its stock', icon: 'pkg', onClick: () => navigate(`/stock?tab=stock&cat=${encodeURIComponent(c.name)}`) },
                    { divider: true },
                    { label: 'Delete', icon: 'trash', danger: true, onClick: () => remove(c) },
                  ]} />
                </div>
                <div className="u-row" style={{ gap: 6 }}>
                  <Status size="sm" tone={c.isBox ? 'violet' : 'blue'} plain>{c.isBox ? 'Sold as box' : 'Sold by weight'}</Status>
                  {!c.active && <Status size="sm">Hidden</Status>}
                  {occFor(c.name) > 0 && <Status size="sm" tone="gray" plain>{occFor(c.name)} occasion{occFor(c.name) === 1 ? '' : 's'}</Status>}
                </div>
                <div className="u-x-catcard-foot" onClick={(e) => e.stopPropagation()}>
                  <Switch checked={c.active} onChange={(v) => toggleActive(c, v)} label={c.active ? 'Visible' : 'Hidden'} />
                  <Button size="sm" variant="ghost" icon="plus" onClick={() => navigate(`/cakes/new?cat=${encodeURIComponent(c.name)}`)}>Add cake</Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <CategoryDrawer
          category={editing === 'new' ? null : editing}
          nextOrder={categories.length}
          cakeCount={editing === 'new' ? 0 : countFor(editing.name)}
          occasionCount={editing === 'new' ? 0 : occFor(editing.name)}
          onClose={() => setEditing(null)}
          onDelete={editing === 'new' ? null : () => { setEditing(null); remove(editing); }}
          onSaved={() => { setEditing(null); reload(); }}
        />
      )}
    </div>
  );
}

function CategoryDrawer({ category, nextOrder, cakeCount, occasionCount, onClose, onSaved, onDelete }) {
  const [form, setForm] = useState(() => ({
    name: category?.name || '', icon: category?.icon || 'cake', isBox: !!category?.isBox,
    order: String(category?.order ?? nextOrder), active: category ? category.active !== false : true,
  }));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (patch) => { setForm((f) => ({ ...f, ...patch })); setErrors({}); };
  const renamed = category && form.name.trim() && form.name.trim() !== category.name;

  const save = async (e) => {
    e?.preventDefault();
    const name = form.name.trim();
    const errs = {};
    if (!name) errs.name = 'Enter a category name.';
    else if (name.length > 60) errs.name = 'Keep it under 60 characters.';
    if (form.order !== '' && !Number.isFinite(Number(form.order))) errs.order = 'Enter a number.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const payload = { name, icon: form.icon, isBox: form.isBox, order: Number(form.order) || 0, active: form.active };
    setSaving(true);
    try {
      if (category) await categoryService.update(category._id, payload);
      else await categoryService.create(payload);
      toast.success(category ? 'Category saved' : 'Category added', renamed ? `Renamed to ${name} — ${cakeCount} cake${cakeCount === 1 ? '' : 's'} moved with it.` : name);
      onSaved();
    } catch (err) {
      if (err.status === 409) setErrors({ name: err.message });
      toast.error('Could not save category', err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={category ? `Edit “${category.name}”` : 'Add a category'}
      description={category ? `${cakeCount} cake${cakeCount === 1 ? '' : 's'}${occasionCount ? ` · ${occasionCount} occasion${occasionCount === 1 ? '' : 's'}` : ''} · added ${fmtDate(category.createdAt)}` : 'Categories appear in the shop menus, filters and footer.'}
      footer={
        <>
          {onDelete && <Button variant="danger-soft" icon="trash" onClick={onDelete} disabled={saving}>Delete</Button>}
          <span className="u-spacer" />
          <Button onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form="category-form" variant="primary" icon="check" loading={saving}>{category ? 'Save category' : 'Add category'}</Button>
        </>
      }
    >
      <form id="category-form" className="u-stack" onSubmit={save}>
        <Field label="Name" required error={errors.name}>
          {(id) => <Input id={id} value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Birthday" error={errors.name} autoFocus maxLength={60} />}
        </Field>
        {renamed && (cakeCount > 0 || occasionCount > 0) && (
          <Alert tone="amber" icon="alert" title="Renaming moves everything with it">
            {cakeCount} cake{cakeCount === 1 ? '' : 's'}{occasionCount ? ` and ${occasionCount} occasion${occasionCount === 1 ? '' : 's'}` : ''} in “{category.name}” will be moved to “{form.name.trim()}”. Links to the old category name stop working.
          </Alert>
        )}
        <Field label="Icon" hint="Shown next to the category in the shop menus.">
          {() => <IconGrid value={form.icon} onChange={(icon) => set({ icon })} options={PICKABLE_ICONS} />}
        </Field>
        <Switch
          checked={form.isBox} onChange={(v) => set({ isBox: v })} label="Sold as a box"
          description="For brownies, cupcakes, jars… Customers pay one fixed price and don't pick a weight. Cakes in this category hide the 0.5 / 1 / 2 KG options."
        />
        <Switch
          checked={form.active} onChange={(v) => set({ active: v })} label="Visible in the shop"
          description="Hidden categories (and their cakes) disappear from menus and filters but stay editable here."
        />
        <Field label="Position" error={errors.order} hint="Lower numbers show first in menus. Categories with the same number sort A–Z.">
          {(id) => <Input id={id} type="number" inputMode="numeric" value={form.order} onChange={(e) => set({ order: e.target.value })} style={{ maxWidth: 160 }} error={errors.order} />}
        </Field>
      </form>
    </Drawer>
  );
}

/* ====================== Stock levels ====================== */
function StockTab({ data, setData }) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [busy, setBusy] = useState({});
  const [saved, setSaved] = useState({});
  const products = data.products;
  const categories = useMemo(() => [...data.categories].sort(byOrderThenName), [data.categories]);
  const presetCat = params.get('cat') || '';

  const setQty = async (p, next) => {
    const qty = Math.max(0, Math.floor(Number(next)));
    if (!Number.isFinite(qty) || qty === p.qty) return;
    setBusy((b) => ({ ...b, [p._id]: true }));
    try {
      const updated = await productService.update(p._id, { qty, stock: stockFromQty(qty) });
      setData((d) => ({ ...d, products: d.products.map((x) => (x._id === p._id ? { ...x, ...updated } : x)) }));
      setSaved((m) => ({ ...m, [p._id]: true }));
      setTimeout(() => setSaved((m) => ({ ...m, [p._id]: false })), 1800);
    } catch (err) {
      toast.error(`Could not update ${p.name}`, err.message);
    } finally {
      setBusy((b) => ({ ...b, [p._id]: false }));
    }
  };

  const syncStatus = async (p) => {
    setBusy((b) => ({ ...b, [p._id]: true }));
    try {
      const updated = await productService.update(p._id, { qty: p.qty || 0, stock: stockFromQty(p.qty) });
      setData((d) => ({ ...d, products: d.products.map((x) => (x._id === p._id ? { ...x, ...updated } : x)) }));
      toast.success('Status updated', `${p.name} is now “${updated.stock}”.`);
    } catch (err) {
      toast.error(`Could not update ${p.name}`, err.message);
    } finally {
      setBusy((b) => ({ ...b, [p._id]: false }));
    }
  };

  const units = products.reduce((s, p) => s + (p.qty || 0), 0);
  const count = (s) => products.filter((p) => p.stock === s).length;

  return (
    <div className="u-stack">
      <div className="u-grid cols-4 u-x-stats">
        <Stat label="Units in stock" icon="pkg" tone="brand" value={units} note={`across ${products.length} cakes`} />
        <Stat label="In stock" icon="check" tone="green" value={count('In stock')} note="7 or more" />
        <Stat label="Low stock" icon="alert" tone="amber" value={count('Low stock')} note="1–6 left" />
        <Stat label="Out of stock" icon="ban" tone="red" value={count('Out of stock')} note="Shown as sold out" />
      </div>
      <Alert tone="blue" icon="info">
        Type a quantity and press <b style={{ display: 'inline' }}>Enter</b> (or click away) to save, or use − / +. Status follows the quantity: 0 = Out of stock, 1–6 = Low stock, 7+ = In stock.
      </Alert>
      {presetCat && (
        <div className="u-row">
          <span className="u-small">Showing only <b className="u-strong">{presetCat}</b></span>
          <Button size="sm" variant="ghost" icon="x" onClick={() => setParams({ tab: 'stock' }, { replace: true })}>Show all categories</Button>
        </div>
      )}
      <Card flush className="u-x-mintable">
        <DataTable
          key={presetCat}
          rows={presetCat ? products.filter((p) => p.cat === presetCat) : products}
          exportName="stock-levels"
          search={{ placeholder: 'Search cakes…', fields: ['name', 'cat', 'flavour'] }}
          filters={[
            !presetCat && { key: 'cat', label: 'All categories', options: categories.map((c) => ({ value: c.name, label: `${c.name}${c.active ? '' : ' (hidden)'}` })) },
            { key: 'stock', label: 'Any status', options: ['In stock', 'Low stock', 'Out of stock'] },
          ].filter(Boolean)}
          initialSort={{ key: 'qty', dir: 'asc' }}
          highlight={(p) => p.stock === 'Out of stock'}
          pageSize={20}
          rowActions={(p) => [
            { label: 'Edit cake', icon: 'edit', onClick: () => navigate(`/cakes/${p._id}`) },
            { label: 'Mark out of stock', icon: 'ban', disabled: !p.qty, onClick: () => setQty(p, 0) },
            { label: 'Add 10', icon: 'plus', onClick: () => setQty(p, (p.qty || 0) + 10) },
          ]}
          empty={<EmptyState icon="pkg" title="No cakes yet" actions={<Button variant="primary" icon="plus" onClick={() => navigate('/cakes/new')}>Add a cake</Button>}>Stock levels appear here once you add cakes.</EmptyState>}
          columns={[
            { key: 'name', header: 'Cake', sortable: true, render: (p) => <Cell thumb={p.img?.[0] || ''} title={p.name} sub={p.flavour || p.cat} /> },
            { key: 'cat', header: 'Category', sortable: true },
            { key: 'qty', header: 'Quantity', sortable: true, sortValue: (p) => p.qty || 0, csv: (p) => p.qty ?? 0, render: (p) => <QtyStepper value={p.qty ?? 0} busy={!!busy[p._id]} saved={!!saved[p._id]} onCommit={(n) => setQty(p, n)} label={`Quantity of ${p.name}`} /> },
            {
              key: 'stock', header: 'Status', sortable: true,
              render: (p) => {
                const should = stockFromQty(p.qty);
                return (
                  <span className="u-cell-text" style={{ alignItems: 'flex-start', gap: 3 }}>
                    <Status>{p.stock}</Status>
                    {should !== p.stock && (
                      <button type="button" className="u-link u-xs" onClick={(e) => { e.stopPropagation(); syncStatus(p); }} title="The saved status doesn't match the quantity">
                        Doesn’t match qty · set to {should}
                      </button>
                    )}
                  </span>
                );
              },
            },
            { key: 'sold', header: 'Sold', sortable: true, align: 'right', sortValue: (p) => p.sold || 0, render: (p) => <span className="u-num">{p.sold || 0}</span> },
          ]}
        />
      </Card>
    </div>
  );
}
