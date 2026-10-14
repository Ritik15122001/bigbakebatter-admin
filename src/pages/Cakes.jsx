import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../components/common/Icon';
import {
  Page, Card, Stat, Button, Status, Cell, DataTable, Segmented, Select, Input, Menu, EmptyState, Loader,
  Tag, useAsync, useConfirm, toast, downloadCsv,
} from '../ui';
import { Stars } from '../ui/ext-cat';
import { productService } from '../services/productService';
import { categoryService } from '../services/catalogService';
import { money, fmtDate } from '../utils/format';
import { resolveImg } from '../utils/media';

const STOREFRONT_URL = (import.meta.env.VITE_STOREFRONT_URL || 'http://localhost:5301').replace(/\/$/, '');

const loadAll = () => Promise.all([productService.list(), categoryService.list()]).then(([products, categories]) => ({ products, categories }));

const SORTS = [
  { value: 'new', label: 'Newest first', fn: (a, b) => new Date(b.createdAt) - new Date(a.createdAt) },
  { value: 'price-hi', label: 'Price: high to low', fn: (a, b) => b.base - a.base },
  { value: 'price-lo', label: 'Price: low to high', fn: (a, b) => a.base - b.base },
  { value: 'sold', label: 'Best selling', fn: (a, b) => (b.sold || 0) - (a.sold || 0) },
  { value: 'rating', label: 'Top rated', fn: (a, b) => (b.rating || 0) - (a.rating || 0) },
  { value: 'qty-lo', label: 'Stock: lowest first', fn: (a, b) => (a.qty || 0) - (b.qty || 0) },
  { value: 'qty-hi', label: 'Stock: highest first', fn: (a, b) => (b.qty || 0) - (a.qty || 0) },
  { value: 'name', label: 'Name A–Z', fn: (a, b) => a.name.localeCompare(b.name) },
];

const NO_FILTERS = { cat: '', stock: '', tag: '', eggless: '' };

const readView = () => {
  try { return localStorage.getItem('bbb_cakes_view') === 'grid' ? 'grid' : 'table'; } catch { return 'table'; }
};

export default function Cakes() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [params] = useSearchParams();
  const { data, setData, loading, error, reload } = useAsync(loadAll);
  const [view, setViewState] = useState(readView);
  const [q, setQ] = useState('');
  const [f, setF] = useState(NO_FILTERS);
  const [sort, setSort] = useState('new');

  // Deep link from Categories & stock (/cakes?new=1&cat=Birthday) → the editor.
  useEffect(() => {
    if (params.get('new') === '1') {
      const cat = params.get('cat');
      navigate(`/cakes/new${cat ? `?cat=${encodeURIComponent(cat)}` : ''}`, { replace: true });
    }
  }, [params, navigate]);

  const setView = (v) => {
    setViewState(v);
    try { localStorage.setItem('bbb_cakes_view', v); } catch { /* storage unavailable */ }
  };

  const products = useMemo(() => data?.products || [], [data]);
  const categories = useMemo(
    () => [...(data?.categories || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name)),
    [data]
  );
  const catByName = useMemo(() => new Map(categories.map((c) => [c.name, c])), [categories]);
  const tags = useMemo(() => [...new Set(products.map((p) => p.tag).filter(Boolean))].sort(), [products]);

  const counts = useMemo(() => ({
    total: products.length,
    in: products.filter((p) => p.stock === 'In stock').length,
    low: products.filter((p) => p.stock === 'Low stock').length,
    out: products.filter((p) => p.stock === 'Out of stock').length,
    units: products.reduce((s, p) => s + (p.qty || 0), 0),
  }), [products]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const sorter = SORTS.find((s) => s.value === sort)?.fn;
    return products
      .filter((p) => {
        if (needle && !`${p.name} ${p.flavour} ${p.cat} ${p.tag} ${p.desc}`.toLowerCase().includes(needle)) return false;
        if (f.cat && p.cat !== f.cat) return false;
        if (f.stock && p.stock !== f.stock) return false;
        if (f.tag && (f.tag === '__none' ? p.tag : p.tag !== f.tag)) return false;
        if (f.eggless === 'yes' && p.eggless === false) return false;
        if (f.eggless === 'no' && p.eggless !== false) return false;
        return true;
      })
      .sort(sorter);
  }, [products, q, f, sort]);

  const activeFilters = Object.values(f).filter(Boolean).length + (q ? 1 : 0);
  const clear = () => { setQ(''); setF(NO_FILTERS); };

  const duplicate = async (p) => {
    try {
      const copy = await productService.duplicate(p);
      setData((d) => ({ ...d, products: [copy, ...d.products] }));
      toast.success('Cake duplicated', `“${copy.name}” was created — opening it now.`);
      navigate(`/cakes/${copy._id}`);
    } catch (err) {
      toast.error('Could not duplicate', err.message);
    }
  };

  const remove = async (p) => {
    const ok = await confirm({
      title: `Delete “${p.name}”?`,
      message: 'It disappears from the shop straight away. Past orders keep their own copy of the name and price. This can’t be undone.',
      confirmLabel: 'Delete cake',
      danger: true,
    });
    if (!ok) return;
    try {
      await productService.remove(p._id);
      setData((d) => ({ ...d, products: d.products.filter((x) => x._id !== p._id) }));
      toast.success('Cake deleted', p.name);
    } catch (err) {
      toast.error('Could not delete', err.message);
    }
  };

  const rowActions = (p) => [
    { label: 'Edit', icon: 'edit', onClick: () => navigate(`/cakes/${p._id}`) },
    { label: 'Duplicate', icon: 'copy', onClick: () => duplicate(p) },
    { label: 'View on store', icon: 'external', href: `${STOREFRONT_URL}/product/${p._id}`, external: true },
    { divider: true },
    { label: 'Delete', icon: 'trash', danger: true, onClick: () => remove(p) },
  ];

  const isBox = (p) => !!catByName.get(p.cat)?.isBox;

  const exportCsv = () => {
    downloadCsv(
      'cakes',
      ['Name', 'Category', 'Flavour', 'Base price', 'Weight prices', 'Qty', 'Stock', 'Sold', 'Rating', 'Reviews', 'Tag', 'Eggless', 'Veg', 'Corporate', 'Photos', 'Added'],
      filtered.map((p) => [
        p.name, p.cat, p.flavour, p.base, (p.weights || []).map((w) => `${w.w}: ${w.price}`).join('; '), p.qty ?? 0, p.stock, p.sold || 0,
        p.rating || 0, p.reviews || 0, p.tag, p.eggless !== false ? 'Yes' : 'No', p.veg !== false ? 'Yes' : 'No', p.corporate ? 'Yes' : 'No',
        (p.img || []).length, fmtDate(p.createdAt),
      ])
    );
  };

  const columns = [
    {
      key: 'name', header: 'Cake', sortable: true,
      render: (p) => <Cell thumb={p.img?.[0] || ''} title={p.name} sub={[p.flavour, p.eggless !== false ? 'Eggless' : 'Contains egg'].filter(Boolean).join(' · ')} />,
    },
    {
      key: 'cat', header: 'Category', sortable: true,
      render: (p) => (
        <span className="u-cell-text">
          <span style={{ color: 'var(--u-ink)', fontWeight: 500 }}>{p.cat}</span>
          {catByName.get(p.cat) && !catByName.get(p.cat).active && <span>Category hidden</span>}
          {!catByName.get(p.cat) && <span style={{ color: 'var(--u-red)' }}>Category missing</span>}
        </span>
      ),
    },
    { key: 'tag', header: 'Tag', render: (p) => (p.tag ? <Tag>{p.tag}</Tag> : <span className="u-faint">—</span>) },
    {
      key: 'base', header: 'Price', sortable: true, align: 'right',
      render: (p) => <span className="u-cell-text" style={{ alignItems: 'flex-end' }}><b className="u-num">{money(p.base)}</b><span>{isBox(p) ? 'per box' : 'from 0.5 KG'}</span></span>,
    },
    { key: 'qty', header: 'Stock', sortable: true, sortValue: (p) => p.qty || 0, render: (p) => <span className="u-row" style={{ gap: 8, flexWrap: 'nowrap' }}><Status size="sm">{p.stock}</Status><span className="u-small u-num u-muted">{p.qty ?? 0} left</span></span> },
    { key: 'sold', header: 'Sold', sortable: true, align: 'right', sortValue: (p) => p.sold || 0, render: (p) => <span className="u-num">{p.sold || 0}</span> },
    {
      key: 'rating', header: 'Rating', sortable: true, sortValue: (p) => p.rating || 0,
      render: (p) => <span className="u-row" style={{ gap: 6, flexWrap: 'nowrap' }}><Stars rating={p.rating} size="sm" /><span className="u-small u-num">{p.rating || 0} <span className="u-muted">({p.reviews || 0})</span></span></span>,
    },
  ];

  return (
    <Page
      title="Cakes"
      description="Everything on the menu — photos, prices by weight, stock and ratings. Click a cake to edit it."
      actions={
        <>
          <Button icon="grid" onClick={() => navigate('/stock')}>Categories & stock</Button>
          <Button variant="primary" icon="plus" onClick={() => navigate('/cakes/new')}>Add cake</Button>
        </>
      }
    >
      <Loader loading={loading && !data} error={!data ? error : ''} onRetry={reload} rows={6}>
        {data && (
          <div className="u-stack">
            <div className="u-grid cols-4 u-x-stats">
              <Stat label="Total cakes" icon="cake" tone="brand" value={counts.total} note={`${categories.length} categories · ${counts.units} units`} onClick={() => setF({ ...f, stock: '' })} />
              <Stat label="In stock" icon="check" tone="green" value={counts.in} note="7 or more available" onClick={() => setF({ ...f, stock: 'In stock' })} />
              <Stat label="Low stock" icon="alert" tone="amber" value={counts.low} note="1–6 left · restock soon" onClick={() => setF({ ...f, stock: 'Low stock' })} />
              <Stat label="Out of stock" icon="ban" tone="red" value={counts.out} note="Shown as sold out" onClick={() => setF({ ...f, stock: 'Out of stock' })} />
            </div>

            <Card flush className="u-x-mintable">
              <div className="u-dt-toolbar">
                <div className="u-dt-search">
                  <Input icon="search" placeholder="Search name, flavour, category…" value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
                <div className="u-dt-filters">
                  <Select
                    aria-label="Category" placeholder="All categories" value={f.cat} onChange={(e) => setF({ ...f, cat: e.target.value })}
                    options={categories.map((c) => ({ value: c.name, label: `${c.name}${c.active ? '' : ' (hidden)'}` }))}
                  />
                  <Select aria-label="Stock" placeholder="Any stock" value={f.stock} onChange={(e) => setF({ ...f, stock: e.target.value })} options={['In stock', 'Low stock', 'Out of stock']} />
                  <Select aria-label="Tag" placeholder="Any tag" value={f.tag} onChange={(e) => setF({ ...f, tag: e.target.value })} options={[...tags, { value: '__none', label: 'No tag' }]} />
                  <Select aria-label="Egg" placeholder="Egg / eggless" value={f.eggless} onChange={(e) => setF({ ...f, eggless: e.target.value })} options={[{ value: 'yes', label: 'Eggless only' }, { value: 'no', label: 'Contains egg' }]} />
                  <Select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value)} options={SORTS.map((s) => ({ value: s.value, label: `Sort: ${s.label}` }))} />
                </div>
                {activeFilters > 0 && <Button variant="ghost" size="sm" onClick={clear}>Clear</Button>}
                <div className="u-dt-actions">
                  <Segmented value={view} onChange={setView} items={[{ value: 'table', label: 'Table' }, { value: 'grid', label: 'Grid' }]} />
                  <Button size="sm" icon="download" onClick={exportCsv} disabled={!filtered.length}>Export</Button>
                </div>
              </div>

              {products.length === 0 ? (
                <div className="u-dt-empty">
                  <EmptyState icon="cake" title="No cakes on the menu yet" actions={<Button variant="primary" icon="plus" onClick={() => navigate('/cakes/new')}>Add your first cake</Button>}>
                    Cakes you add here appear in the shop under their category, with photos, weights and prices.
                  </EmptyState>
                </div>
              ) : filtered.length === 0 ? (
                <div className="u-dt-empty">
                  <EmptyState icon="search" title="No cakes match" actions={<Button size="sm" onClick={clear}>Clear filters</Button>}>
                    Try a different search, or clear the filters to see all {products.length} cakes.
                  </EmptyState>
                </div>
              ) : view === 'table' ? (
                <DataTable
                  key={sort}
                  rows={filtered}
                  columns={columns}
                  onRowClick={(p) => navigate(`/cakes/${p._id}`)}
                  highlight={(p) => p.stock === 'Out of stock'}
                  rowActions={rowActions}
                  pageSize={15}
                />
              ) : (
                <>
                  <div className="u-x-cakegrid">
                    {filtered.map((p) => (
                      <article key={p._id} className="u-x-cakecard" onClick={() => navigate(`/cakes/${p._id}`)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate(`/cakes/${p._id}`)}>
                        <div className="u-x-cakecard-img">
                          {p.img?.[0] ? <img src={resolveImg(p.img[0])} alt="" loading="lazy" /> : <Icon name="cake" />}
                          <div className="u-x-cakecard-top">
                            <Status size="sm">{p.stock}</Status>
                            <Menu items={rowActions(p)} />
                          </div>
                        </div>
                        <div className="u-x-cakecard-body">
                          <span className="u-row between" style={{ gap: 6 }}>
                            <span className="u-xs u-muted">{p.cat}{catByName.get(p.cat) && !catByName.get(p.cat).active ? ' · hidden' : ''}</span>
                            {p.tag && <Tag>{p.tag}</Tag>}
                          </span>
                          <b className="name">{p.name}</b>
                          <span className="u-row" style={{ gap: 6 }}><Stars rating={p.rating} size="sm" /><span className="u-xs u-muted">{p.rating || 0} ({p.reviews || 0})</span></span>
                          <div className="u-x-cakecard-meta">
                            <b className="u-strong u-num" style={{ fontSize: 15 }}>{money(p.base)}<span className="u-xs u-muted" style={{ fontWeight: 500 }}> {isBox(p) ? '/box' : '/0.5 KG'}</span></b>
                            <span className="u-num">{p.qty ?? 0} left · {p.sold || 0} sold</span>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                  <div className="u-dt-foot"><span>Showing <b className="u-strong">{filtered.length}</b> of <b className="u-strong">{products.length}</b> cakes</span></div>
                </>
              )}
            </Card>
          </div>
        )}
      </Loader>
    </Page>
  );
}
