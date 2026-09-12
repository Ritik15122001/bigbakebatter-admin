import { useEffect, useMemo, useState } from 'react';
import Modal from '../components/common/Modal';
import { customerService } from '../services/customerService';
import { useUiStore } from '../store/uiStore';
import { money } from '../utils/format';

export default function Customers() {
  const pushToast = useUiStore((s) => s.pushToast);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(null);

  useEffect(() => {
    customerService
      .list()
      .then(setCustomers)
      .catch((e) => pushToast({ title: 'Failed to load customers', subtitle: e.message, kind: 'err' }))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () => customers.filter((c) => `${c.name} ${c.email} ${c.addr}`.toLowerCase().includes(q.toLowerCase())),
    [customers, q]
  );

  return (
    <div className="a-panel">
      <div className="a-panel-head">
        <h3>Customers</h3>
        <div className="field" style={{ minWidth: 240 }}>
          <input className="input" placeholder="Search customers..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="a-empty"><p className="muted">Loading…</p></div>
      ) : (
        <div className="a-table-wrap">
          <table className="tbl">
            <thead>
              <tr><th>Customer</th><th>Phone</th><th>Orders</th><th>Total spent</th><th>Customer since</th></tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c._id} onClick={() => setActive(c)}>
                  <td>
                    <span className="cell-main">{c.name}</span>
                    <span className="cell-sub">{c.email}</span>
                  </td>
                  <td>{c.phone}</td>
                  <td>{c.orders}</td>
                  <td>{money(c.spent)}</td>
                  <td>{new Date(c.since).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!active} onClose={() => setActive(null)} kicker="Customer" title={active?.name}>
        {active && (
          <div className="stack gap-4">
            <div className="row gap-3 center">
              <span className="avatar" style={{ width: 48, height: 48 }}>{active.name[0]}</span>
              <span>
                <b style={{ display: 'block' }}>{active.name}</b>
                <span className="small muted">{active.email} · {active.phone}</span>
              </span>
            </div>
            <div className="sum-row"><span>Address</span><span style={{ textAlign: 'right', maxWidth: '60%' }}>{active.addr || '—'}</span></div>
            <div className="sum-row"><span>Customer since</span><span>{new Date(active.since).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span></div>
            <div className="sum-row total"><span>Total spent</span><span>{money(active.spent)}</span></div>
            <div className="sum-row"><span>Total orders</span><span>{active.orders}</span></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
