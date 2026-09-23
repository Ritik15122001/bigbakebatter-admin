import { useEffect, useMemo, useState } from 'react';
import Modal from '../components/common/Modal';
import EmptyState from '../components/common/EmptyState';
import Pagination from '../components/common/Pagination';
import { customerService } from '../services/customerService';
import { useUiStore } from '../store/uiStore';
import { money, fmtDate } from '../utils/format';

const PAGE_SIZE = 10;

export default function Customers() {
  const pushToast = useUiStore((s) => s.pushToast);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [active, setActive] = useState(null);

  useEffect(() => {
    customerService
      .list()
      .then(setCustomers)
      .catch((e) => pushToast({ title: 'Failed to load customers', subtitle: e.message, kind: 'err' }))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(
    () => customers.filter((c) => `${c.name} ${c.email} ${c.addr}`.toLowerCase().includes(q.toLowerCase())),
    [customers, q]
  );
  useEffect(() => setPage(1), [q]);
  const paged = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);

  return (
    <div className="a-panel">
      <div className="a-panel-head">
        <h3>Customers</h3>
        <div className="row gap-3 center">
          {!loading && <span className="a-count">{filtered.length} customer{filtered.length === 1 ? '' : 's'}</span>}
          <div className="field" style={{ minWidth: 240 }}>
            <input className="input" placeholder="Search customers..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="a-empty"><p className="muted">Loading customers…</p></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="user" title="No customers found" message="Try a different search." />
      ) : (
        <>
          <div className="a-table-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Customer</th><th>Phone</th><th className="num">Orders</th><th className="num">Total spent</th><th>Customer since</th></tr>
              </thead>
              <tbody>
                {paged.map((c) => (
                  <tr key={c._id} onClick={() => setActive(c)}>
                    <td>
                      <span className="cell-main">{c.name}</span>
                      <span className="cell-sub">{c.email}</span>
                    </td>
                    <td>{c.phone}</td>
                    <td className="num">{c.orders}</td>
                    <td className="num cell-main">{money(c.spent)}</td>
                    <td>{fmtDate(c.since)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} />
        </>
      )}

      <Modal open={!!active} onClose={() => setActive(null)} kicker="Customer" title={active?.name} width={520}>
        {active && (
          <div className="stack gap-5">
            <div className="dv-top">
              <span className="row gap-3 center">
                <span className="dv-top-ico">{active.name[0]}</span>
                <span className="stack gap-1">
                  <b style={{ fontSize: '1.05rem' }}>{active.name}</b>
                  <span className="tiny muted">{active.email}</span>
                </span>
              </span>
              <span className="stack gap-1" style={{ alignItems: 'flex-end' }}>
                <span className="dv-top-amt">{money(active.spent)}</span>
                <span className="tiny muted">lifetime spend</span>
              </span>
            </div>
            <div className="dv-grid">
              <div className="dv-field"><label>Phone</label><div className="v">{active.phone}</div></div>
              <div className="dv-field"><label>Total orders</label><div className="v">{active.orders}</div></div>
              <div className="dv-field full"><label>Address</label><div className="v">{active.addr || '—'}</div></div>
              <div className="dv-field"><label>Customer since</label><div className="v">{fmtDate(active.since)}</div></div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
