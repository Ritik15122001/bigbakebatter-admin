import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/common/Icon';
import { orderService } from '../services/orderService';
import { useUiStore } from '../store/uiStore';
import { money, fmtDateTime } from '../utils/format';

const STATUS_OPTS = ['New', 'Baking', 'Out for delivery', 'Delivered', 'Cancelled'];
const STATUS_TONE = { New: 'warn', Baking: 'warn', 'Out for delivery': 'gold', Delivered: 'success', Cancelled: 'err' };
const STEPS = ['New', 'Baking', 'Out for delivery', 'Delivered'];

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const pushToast = useUiStore((s) => s.pushToast);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    orderService
      .get(id)
      .then(setData)
      .catch((e) => setError(e.message));
  };

  useEffect(load, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const changeStatus = async (status) => {
    setSaving(true);
    try {
      const order = await orderService.updateStatus(id, status);
      setData((d) => ({ ...d, order }));
      pushToast({ title: `Order marked ${status}`, kind: 'ok' });
    } catch (e) {
      pushToast({ title: 'Could not update status', subtitle: e.message, kind: 'err' });
    } finally {
      setSaving(false);
    }
  };

  if (error) {
    return (
      <div className="a-panel a-empty">
        <p className="muted">{error}</p>
        <button className="btn btn-outline btn-sm" onClick={() => navigate('/orders')} style={{ marginTop: 12 }}>Back to orders</button>
      </div>
    );
  }
  if (!data) return <div className="a-panel a-empty"><p className="muted">Loading order…</p></div>;

  const { order, transaction } = data;
  const stepIndex = order.status === 'Cancelled' ? -1 : STEPS.indexOf(order.status);

  return (
    <div className="stack gap-5">
      <button className="a-back" onClick={() => navigate('/orders')}>
        <Icon name="arrowdown" className="icon icon-sm" style={{ transform: 'rotate(90deg)' }} />
        Back to orders
      </button>

      <div className="a-panel">
        <div className="dv-top" style={{ padding: 'var(--s-2) var(--s-6) var(--s-6)', margin: 0 }}>
          <span className="row gap-3 center">
            <span className="dv-top-ico">
              <Icon name="bag" className="icon icon-md" />
            </span>
            <span className="stack gap-1">
              <b style={{ fontSize: '1.3rem' }}>{order.code}</b>
              <span className="tiny muted">Placed {fmtDateTime(order.createdAt)}</span>
            </span>
          </span>
          <span className="stack gap-2" style={{ alignItems: 'flex-end' }}>
            <span className="dv-top-amt">{money(order.amount)}</span>
            <select className="mini-select" value={order.status} disabled={saving} onChange={(e) => changeStatus(e.target.value)}>
              {STATUS_OPTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </span>
        </div>

        {order.status !== 'Cancelled' && (
          <div className="od-steps" style={{ padding: '0 var(--s-6) var(--s-6)' }}>
            {STEPS.map((s, i) => (
              <div className={`od-step ${i <= stepIndex ? 'done' : ''} ${i === stepIndex ? 'current' : ''}`} key={s}>
                <span className="od-step-dot">{i < stepIndex ? <Icon name="check" className="icon icon-sm" /> : i + 1}</span>
                <span className="od-step-lab">{s}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="a-grid-2">
        <div className="a-panel">
          <div className="a-panel-head"><h3>Items</h3></div>
          <div style={{ padding: 'var(--s-2) var(--s-6) var(--s-6)' }}>
            <div className="dv-items">
              {order.items.map((it, i) => (
                <div className="dv-item" key={i}>
                  <span className="grow small">{it.name} <span className="muted">&times; {it.qty}</span> {it.weight && <span className="muted">({it.weight})</span>}</span>
                  <b className="small">{money(it.line)}</b>
                </div>
              ))}
            </div>
            <div className="sum-row total"><span>Total</span><span>{money(order.amount)}</span></div>
            {order.msg && (
              <div className="dv-field full" style={{ marginTop: 'var(--s-4)' }}>
                <label>Cake message</label>
                <div className="v">&ldquo;{order.msg}&rdquo;</div>
              </div>
            )}
            {order.notes && (
              <div className="dv-field full" style={{ marginTop: 'var(--s-4)' }}>
                <label>Notes</label>
                <div className="v">{order.notes}</div>
              </div>
            )}
          </div>
        </div>

        <div className="a-panel">
          <div className="a-panel-head"><h3>Customer</h3></div>
          <div className="dv-grid" style={{ padding: 'var(--s-2) var(--s-6) var(--s-6)' }}>
            <div className="dv-field"><label>Name</label><div className="v">{order.customer}</div></div>
            <div className="dv-field"><label>Phone</label><div className="v">{order.phone}</div></div>
            <div className="dv-field full"><label>Email</label><div className="v">{order.email}</div></div>
            <div className="dv-field full"><label>Delivery address</label><div className="v">{order.addr}</div></div>
          </div>
        </div>
      </div>

      <div className="a-grid-2">
        <div className="a-panel">
          <div className="a-panel-head"><h3>Delivery</h3></div>
          <div className="dv-grid" style={{ padding: 'var(--s-2) var(--s-6) var(--s-6)' }}>
            <div className="dv-field"><label>Deliver by</label><div className="v">{order.deliver || '—'}</div></div>
            <div className="dv-field"><label>Slot</label><div className="v">{order.slot || '—'}</div></div>
          </div>
        </div>

        <div className="a-panel">
          <div className="a-panel-head">
            <h3>Payment</h3>
            {transaction && (
              <Link className="a-linkbtn" to="/transactions">
                {transaction.txnId}
                <Icon name="aright" className="icon icon-sm" />
              </Link>
            )}
          </div>
          <div className="dv-grid" style={{ padding: 'var(--s-2) var(--s-6) var(--s-6)' }}>
            <div className="dv-field"><label>Method</label><div className="v">{order.pay}</div></div>
            <div className="dv-field">
              <label>Payment status</label>
              <div className="v">
                {transaction ? <span className={`badge ${transaction.status === 'Paid' ? 'success' : transaction.status === 'Refunded' ? 'warn' : 'err'}`}>{transaction.status}</span> : '—'}
              </div>
            </div>
            <div className="dv-field full"><label>Razorpay order ID</label><div className="v dv-mono">{order.razorpayOrderId || '—'}</div></div>
            <div className="dv-field full"><label>Razorpay payment ID</label><div className="v dv-mono">{order.razorpayPaymentId || '—'}</div></div>
          </div>
        </div>
      </div>

      <div className="row gap-2" style={{ justifyContent: 'flex-end' }}>
        {STATUS_OPTS.filter((s) => s !== order.status).map((s) => (
          <button key={s} className={`badge ${STATUS_TONE[s]} od-quickstatus`} disabled={saving} onClick={() => changeStatus(s)}>
            Mark {s}
          </button>
        ))}
      </div>
    </div>
  );
}
