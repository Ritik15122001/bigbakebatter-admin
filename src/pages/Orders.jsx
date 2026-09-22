import { useEffect, useMemo, useState } from 'react';
import Icon from '../components/common/Icon';
import Modal from '../components/common/Modal';
import EmptyState from '../components/common/EmptyState';
import { orderService } from '../services/orderService';
import { useUiStore } from '../store/uiStore';
import { money, fmtDateTime } from '../utils/format';

const STATUS_TABS = ['All', 'New', 'Baking', 'Out for delivery', 'Delivered', 'Cancelled'];
const STATUS_OPTS = ['New', 'Baking', 'Out for delivery', 'Delivered', 'Cancelled'];

export default function Orders() {
  const pushToast = useUiStore((s) => s.pushToast);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('All');
  const [q, setQ] = useState('');
  const [active, setActive] = useState(null);

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
                <tr key={o._id}>
                  <td onClick={() => setActive(o)}>
                    <span className="cell-main">{o.code}</span>
                    <span className="cell-sub">{new Date(o.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                  </td>
                  <td onClick={() => setActive(o)}>
                    <span className="cell-main">{o.customer}</span>
                    <span className="cell-sub">{o.phone}</span>
                  </td>
                  <td onClick={() => setActive(o)}>{o.items.map((i) => i.name).join(', ')}</td>
                  <td className="num cell-main" onClick={() => setActive(o)}>{money(o.amount)}</td>
                  <td className="tight" onClick={(e) => e.stopPropagation()}>
                    <select className="mini-select" value={o.status} onChange={(e) => handleStatusChange(o._id, e.target.value)}>
                      {STATUS_OPTS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td className="act rowact" onClick={(e) => e.stopPropagation()}>
                    <button className="iconbtn wide" title="View order details" aria-label="View order details" onClick={() => setActive(o)}>
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

      <Modal open={!!active} onClose={() => setActive(null)} kicker="Order detail" title={active?.code} width={620}>
        {active && (
          <div className="stack gap-5">
            <div className="dv-top">
              <span className="row gap-3 center">
                <span className="dv-top-ico">
                  <Icon name="bag" className="icon icon-md" />
                </span>
                <span className="stack gap-1">
                  <b style={{ fontSize: '1.1rem' }}>{active.code}</b>
                  <span className="tiny muted">Placed {fmtDateTime(active.createdAt)}</span>
                </span>
              </span>
              <span className="stack gap-1" style={{ alignItems: 'flex-end' }}>
                <span className="dv-top-amt">{money(active.amount)}</span>
                <span className={`badge ${active.status === 'Delivered' ? 'success' : active.status === 'Cancelled' ? 'err' : 'warn'}`}>{active.status}</span>
              </span>
            </div>

            <div>
              <p className="dv-sec-title">Items</p>
              <div className="dv-items">
                {active.items.map((it, i) => (
                  <div className="dv-item" key={i}>
                    <span className="grow small">{it.name} <span className="muted">&times; {it.qty}</span> {it.weight && <span className="muted">({it.weight})</span>}</span>
                    <b className="small">{money(it.line)}</b>
                  </div>
                ))}
              </div>
              <div className="sum-row total"><span>Total</span><span>{money(active.amount)}</span></div>
            </div>

            <div>
              <p className="dv-sec-title">Customer</p>
              <div className="dv-grid">
                <div className="dv-field"><label>Name</label><div className="v">{active.customer}</div></div>
                <div className="dv-field"><label>Phone</label><div className="v">{active.phone}</div></div>
                <div className="dv-field full"><label>Email</label><div className="v">{active.email}</div></div>
                <div className="dv-field full"><label>Delivery address</label><div className="v">{active.addr}</div></div>
              </div>
            </div>

            <div>
              <p className="dv-sec-title">Delivery</p>
              <div className="dv-grid">
                <div className="dv-field"><label>Deliver by</label><div className="v">{active.deliver || '—'}</div></div>
                <div className="dv-field"><label>Slot</label><div className="v">{active.slot || '—'}</div></div>
                {active.msg && <div className="dv-field full"><label>Cake message</label><div className="v">&ldquo;{active.msg}&rdquo;</div></div>}
                {active.notes && <div className="dv-field full"><label>Notes</label><div className="v">{active.notes}</div></div>}
              </div>
            </div>

            <div>
              <p className="dv-sec-title">Payment</p>
              <div className="dv-grid">
                <div className="dv-field"><label>Method</label><div className="v">{active.pay}</div></div>
                <div className="dv-field"><label>Amount paid</label><div className="v">{money(active.amount)}</div></div>
                <div className="dv-field full"><label>Razorpay order ID</label><div className="v dv-mono">{active.razorpayOrderId || '—'}</div></div>
                <div className="dv-field full"><label>Razorpay payment ID</label><div className="v dv-mono">{active.razorpayPaymentId || '—'}</div></div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
