import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/common/Icon';
import EmptyState from '../components/common/EmptyState';
import { orderService } from '../services/orderService';
import { useUiStore } from '../store/uiStore';
import { money } from '../utils/format';

const STATUS_TABS = ['All', 'New', 'Baking', 'Out for delivery', 'Delivered', 'Cancelled'];
const STATUS_OPTS = ['New', 'Baking', 'Out for delivery', 'Delivered', 'Cancelled'];

export default function Orders() {
  const navigate = useNavigate();
  const pushToast = useUiStore((s) => s.pushToast);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('All');
  const [q, setQ] = useState('');

  const load = () => {
    setLoading(true);
    orderService
      .list()
      .then(setOrders)
      .catch((e) => pushToast({ title: 'Failed to load orders', subtitle: e.message, kind: 'err' }))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (tab !== 'All' && o.status !== tab) return false;
      if (q && !`${o.code} ${o.customer} ${o.email}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [orders, tab, q]);

  const handleStatusChange = async (id, status) => {
    try {
      await orderService.updateStatus(id, status);
      setOrders((prev) => prev.map((o) => (o._id === id ? { ...o, status } : o)));
      pushToast({ title: `Order marked ${status}`, kind: 'ok' });
    } catch (e) {
      pushToast({ title: 'Could not update status', subtitle: e.message, kind: 'err' });
    }
  };

  const openOrder = (id) => navigate(`/orders/${id}`);

  return (
    <div className="a-panel">
      <div className="a-panel-head">
        <div className="row gap-2 center" style={{ flexWrap: 'wrap' }}>
          {STATUS_TABS.map((t) => (
            <button key={t} className="mini-select" style={tab === t ? { background: 'var(--c-ink)', color: '#fff' } : undefined} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
          {!loading && <span className="a-count">{filtered.length} order{filtered.length === 1 ? '' : 's'}</span>}
        </div>
        <div className="field" style={{ minWidth: 220 }}>
          <input className="input" placeholder="Search order, customer..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="a-empty"><p className="muted">Loading orders…</p></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="bag" title="No orders match this filter" message="Try a different status tab or clear your search." />
      ) : (
        <div className="a-table-wrap">
          <table className="tbl">
            <thead>
              <tr><th>Order</th><th>Customer</th><th>Items</th><th className="num">Amount</th><th className="tight">Status</th><th className="act" /></tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o._id} className={o.status === 'New' ? 'row-new' : ''}>
                  <td onClick={() => openOrder(o._id)}>
                    <span className="cell-main">{o.code}</span>
                    <span className="cell-sub">{new Date(o.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                  </td>
                  <td onClick={() => openOrder(o._id)}>
                    <span className="cell-main">{o.customer}</span>
                    <span className="cell-sub">{o.phone}</span>
                  </td>
                  <td onClick={() => openOrder(o._id)}>{o.items.map((i) => i.name).join(', ')}</td>
                  <td className="num cell-main" onClick={() => openOrder(o._id)}>{money(o.amount)}</td>
                  <td className="tight" onClick={(e) => e.stopPropagation()}>
                    <select className="mini-select" value={o.status} onChange={(e) => handleStatusChange(o._id, e.target.value)}>
                      {STATUS_OPTS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td className="act rowact" onClick={(e) => e.stopPropagation()}>
                    <button className="iconbtn wide" title="View order details" aria-label="View order details" onClick={() => openOrder(o._id)}>
                      <Icon name="eye" className="icon icon-sm" />
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
