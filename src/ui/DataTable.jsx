import { useMemo, useState } from 'react';
import Icon from '../components/common/Icon';
import { Button, EmptyState, Input, Select, Skeleton } from './core';
import { Menu } from './overlays';
import { downloadCsv } from './csv';

const cx = (...c) => c.filter(Boolean).join(' ');
const get = (row, key) => key.split('.').reduce((v, k) => (v == null ? v : v[k]), row);

/**
 * Feature-complete table used by every list page.
 *
 * columns: [{ key, header, render(row), sortable, sortValue(row), align: 'right'|'center', shrink, csv(row) }]
 * rows, rowKey(row), onRowClick(row), highlight(row)
 * search: { placeholder, fields: [keys] | fn(row) → string }
 * filters: [{ key, label, options: [{value,label}], test(row, value) }]
 * rowActions(row) → menu items
 * exportName: file name for "Export CSV" (uses column.csv or plain values)
 * toolbar: extra nodes on the right of the toolbar
 */
export default function DataTable({
  columns, rows = [], rowKey = (r) => r._id, onRowClick, highlight,
  search, filters = [], rowActions, exportName, toolbar,
  loading, empty, pageSize = 12, initialSort,
}) {
  const [q, setQ] = useState('');
  const [fv, setFv] = useState({});
  const [sort, setSort] = useState(initialSort || null); // { key, dir }
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = rows.filter((r) => {
      if (needle && search) {
        const hay = typeof search.fields === 'function' ? search.fields(r) : (search.fields || []).map((k) => get(r, k)).join(' ');
        if (!String(hay).toLowerCase().includes(needle)) return false;
      }
      return filters.every((f) => !fv[f.key] || (f.test ? f.test(r, fv[f.key]) : String(get(r, f.key)) === fv[f.key]));
    });
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      const val = col?.sortValue || ((r) => get(r, sort.key));
      out = [...out].sort((a, b) => {
        const x = val(a);
        const y = val(b);
        const cmp = typeof x === 'number' && typeof y === 'number' ? x - y : String(x ?? '').localeCompare(String(y ?? ''), undefined, { numeric: true });
        return sort.dir === 'asc' ? cmp : -cmp;
      });
    }
    return out;
  }, [rows, q, fv, sort, search, filters, columns]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const cur = Math.min(page, pages);
  const visible = filtered.slice((cur - 1) * pageSize, cur * pageSize);
  const activeFilters = Object.values(fv).filter(Boolean).length + (q ? 1 : 0);

  const toggleSort = (c) => {
    if (!c.sortable) return;
    setSort((s) => (s?.key === c.key ? (s.dir === 'desc' ? { key: c.key, dir: 'asc' } : null) : { key: c.key, dir: 'desc' }));
  };

  const exportCsv = () => {
    const cols = columns.filter((c) => c.header && c.csv !== false);
    downloadCsv(
      exportName,
      cols.map((c) => c.header),
      filtered.map((r) => cols.map((c) => (c.csv ? c.csv(r) : c.sortValue ? c.sortValue(r) : get(r, c.key))))
    );
  };

  const hasToolbar = search || filters.length || exportName || toolbar;

  return (
    <div className="u-dt">
      {hasToolbar && (
        <div className="u-dt-toolbar">
          {search && (
            <div className="u-dt-search">
              <Input icon="search" placeholder={search.placeholder || 'Search…'} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
            </div>
          )}
          {filters.length > 0 && (
            <div className="u-dt-filters">
              {filters.map((f) => (
                <Select key={f.key} value={fv[f.key] || ''} onChange={(e) => { setFv({ ...fv, [f.key]: e.target.value }); setPage(1); }} placeholder={f.label} options={f.options} aria-label={f.label} />
              ))}
            </div>
          )}
          {activeFilters > 0 && <Button variant="ghost" size="sm" onClick={() => { setQ(''); setFv({}); setPage(1); }}>Clear</Button>}
          <div className="u-dt-actions">
            {toolbar}
            {exportName && <Button size="sm" icon="download" onClick={exportCsv} disabled={!filtered.length}>Export</Button>}
          </div>
        </div>
      )}

      <div className="u-dt-scroll">
        <table className="u-table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={cx(c.sortable && 'sortable', sort?.key === c.key && 'sorted', c.align, c.shrink && 'shrink')} onClick={() => toggleSort(c)} aria-sort={sort?.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                  {c.header}
                  {c.sortable && <Icon name={sort?.key === c.key ? (sort.dir === 'asc' ? 'chevup' : 'cdown') : 'sort'} />}
                </th>
              ))}
              {rowActions && <th className="shrink" aria-label="Actions" />}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }, (_, i) => (
                  <tr key={i}>
                    {columns.map((c) => <td key={c.key}><Skeleton width={c.shrink ? 60 : '70%'} /></td>)}
                    {rowActions && <td />}
                  </tr>
                ))
              : visible.map((r) => (
                  <tr key={rowKey(r)} className={cx(onRowClick && 'clickable', highlight?.(r) && 'highlight')} onClick={onRowClick ? () => onRowClick(r) : undefined}>
                    {columns.map((c) => (
                      <td key={c.key} className={cx(c.align, c.shrink && 'shrink')}>{c.render ? c.render(r) : get(r, c.key) ?? '—'}</td>
                    ))}
                    {rowActions && (
                      <td className="shrink right" onClick={(e) => e.stopPropagation()}>
                        <Menu items={rowActions(r)} />
                      </td>
                    )}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {!loading && filtered.length === 0 && (
        <div className="u-dt-empty">
          {rows.length === 0 && empty ? empty : (
            <EmptyState icon="search" title="No results" actions={<Button size="sm" onClick={() => { setQ(''); setFv({}); }}>Clear filters</Button>}>
              Nothing matches your search or filters.
            </EmptyState>
          )}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="u-dt-foot">
          <span>
            Showing <b className="u-strong">{(cur - 1) * pageSize + 1}–{Math.min(cur * pageSize, filtered.length)}</b> of <b className="u-strong">{filtered.length}</b>
            {filtered.length !== rows.length && ` (filtered from ${rows.length})`}
          </span>
          {pages > 1 && (
            <div className="u-pager">
              <Button size="sm" icon="cleft" onClick={() => setPage(cur - 1)} disabled={cur === 1}>Prev</Button>
              <span className="u-small">Page {cur} of {pages}</span>
              <Button size="sm" iconRight="cright" onClick={() => setPage(cur + 1)} disabled={cur === pages}>Next</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
