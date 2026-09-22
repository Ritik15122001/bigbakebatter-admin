import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/common/Icon';
import EmptyState from '../components/common/EmptyState';
import { dashboardService } from '../services/dashboardService';
import { transactionService } from '../services/transactionService';
import { money, fmtTime } from '../utils/format';

const SHORT_STATUS = { 'Out for delivery': 'Delivery' };
const STATUS_TONE = { Delivered: 'success', Cancelled: 'err', 'Out for delivery': 'gold' };
const METHOD_ICON = { UPI: 'phone', Card: 'card', 'Net Banking': 'home' };

const KPI_ICON_TONE = {
  revenue: { bg: 'var(--c-accent-soft)', color: 'var(--c-accent)' },
  orders: { bg: '#eef2ff', color: '#4338ca' },
  aov: { bg: 'var(--c-success-soft)', color: 'var(--c-success)' },
  enquiries: { bg: 'var(--c-warning-soft)', color: 'var(--c-warning)' },
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    dashboardService.getStats().then(setStats).catch((e) => setError(e.message));
    transactionService.summary().then(setSummary).catch(() => {});
  }, []);

  if (error) return <div className="a-panel a-empty"><p className="muted">{error}</p></div>;
  if (!stats) return <div className="a-panel a-empty"><p className="muted">Loading dashboard…</p></div>;

  const { totalRevenue, totalOrders, aov, pendingEnquiries, lowStock, topSelling, recentOrders } = stats;
  const maxDaily = Math.max(1, ...(summary?.daily || []).map((d) => d.revenue));
  const todayLabel = new Date().toLocaleDateString('en-GB', { weekday: 'short' });

  return (
    <>
      <div className="kpi-grid">
        <div className="kpi">
          <span className="kico" style={{ background: KPI_ICON_TONE.revenue.bg, color: KPI_ICON_TONE.revenue.color }}>
            <Icon name="percent" className="icon icon-sm" />
          </span>
          <div className="kv">{money(totalRevenue)}</div>
          <div className="kl">Total revenue</div>
        </div>
        <div className="kpi">
          <span className="kico" style={{ background: KPI_ICON_TONE.orders.bg, color: KPI_ICON_TONE.orders.color }}>
            <Icon name="bag" className="icon icon-sm" />
          </span>
          <div className="kv">{totalOrders}</div>
          <div className="kl">Total orders</div>
        </div>
        <div className="kpi">
          <span className="kico" style={{ background: KPI_ICON_TONE.aov.bg, color: KPI_ICON_TONE.aov.color }}>
            <Icon name="gift" className="icon icon-sm" />
          </span>
          <div className="kv">{money(aov)}</div>
          <div className="kl">Average order value</div>
        </div>
        <div className="kpi">
          <span className="kico" style={{ background: KPI_ICON_TONE.enquiries.bg, color: KPI_ICON_TONE.enquiries.color }}>
            <Icon name="msg" className="icon icon-sm" />
          </span>
          <div className="kv">{pendingEnquiries.length}</div>
          <div className="kl">Pending custom enquiries</div>
        </div>
      </div>

      <div className="a-grid-2">
        <div className="a-panel">
          <div className="a-panel-head">
            <h3>Revenue, last 7 days</h3>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/transactions')}>Finance</button>
          </div>
          {summary ? (
            <div className="fin-chart">
              {summary.daily.map((d) => (
                <div className={`fbar ${d.revenue === 0 ? 'zero' : ''} ${d.label === todayLabel ? 'on' : ''}`} key={d.date}>
                  <span className="fval">{d.revenue > 0 ? money(d.revenue) : ''}</span>
                  <span className="ftrack">
                    <span className="ffill" style={{ height: `${Math.max(4, (d.revenue / maxDaily) * 100)}%` }} />
                  </span>
                  <span className="flab">
                    <b>{d.label}</b>
                    <span>{d.count}</span>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="a-empty small"><p className="muted">Loading…</p></div>
          )}
        </div>

        <div className="a-panel">
          <div className="a-panel-head">
            <h3>Recent payments</h3>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/transactions')}>View all</button>
          </div>
          {summary && summary.recent.length > 0 ? (
            <div className="a-table-wrap">
              <table className="tbl tbl-mini">
                <thead>
                  <tr><th>Txn</th><th>Method</th><th>Amount</th></tr>
                </thead>
                <tbody>
                  {summary.recent.map((t) => (
                    <tr key={t._id} onClick={() => navigate('/transactions')}>
                      <td>
                        <span className="cell-main">{t.orderCode || t.txnId}</span>
                        <span className="cell-sub">{fmtTime(t.paidAt)}</span>
                      </td>
                      <td>
                        <span className="row gap-2 center small">
                          <Icon name={METHOD_ICON[t.method]} className="icon icon-sm" style={{ color: 'var(--c-muted)' }} />
                          {t.method}
                        </span>
                      </td>
                      <td>
                        <span className={t.status === 'Refunded' ? 'muted' : 'cell-main'} style={t.status === 'Refunded' ? { textDecoration: 'line-through' } : undefined}>
                          {money(t.amount)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState small icon="card" title="No payments yet" />
          )}
        </div>
      </div>

      <div className="a-grid-2">
        <div className="a-panel">
          <div className="a-panel-head">
            <h3>Top selling cakes</h3>
          </div>
          {topSelling.length === 0 ? (
            <EmptyState small icon="cake" title="No sales yet" />
          ) : (
            <div className="a-table-wrap">
              <table className="tbl tbl-mini">
                <thead>
                  <tr><th>Cake</th><th>Sold</th><th>Revenue</th></tr>
                </thead>
                <tbody>
                  {topSelling.map((p) => (
                    <tr key={p._id} onClick={() => navigate('/cakes')}>
                      <td>
                        <span className="cell-main">{p.name}</span>
                        <span className="cell-sub">{p.cat}</span>
                      </td>
                      <td>{p.sold}</td>
                      <td>{money(p.sold * p.base)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="a-panel">
          <div className="a-panel-head">
            <h3>Recent orders</h3>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/orders')}>View all</button>
          </div>
          {recentOrders.length === 0 ? (
            <EmptyState small icon="bag" title="No orders yet" />
          ) : (
            <div className="a-table-wrap">
              <table className="tbl tbl-mini">
                <thead>
                  <tr><th>Order</th><th>Customer</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {recentOrders.map((o) => (
                    <tr key={o._id} onClick={() => navigate('/orders')}>
                      <td>
                        <span className="cell-main">{o.code}</span>
                        <span className="cell-sub">{new Date(o.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                      </td>
                      <td>
                        <span className="cell-main">{o.customer}</span>
                        <span className="cell-sub">{money(o.amount)}</span>
                      </td>
                      <td>
                        <span className={`badge ${STATUS_TONE[o.status] || 'warn'}`} title={o.status}>{SHORT_STATUS[o.status] || o.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="a-grid-2">
        <div className="a-panel">
          <div className="a-panel-head">
            <h3>Low stock</h3>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/stock')}>Manage</button>
          </div>
          {lowStock.length === 0 ? (
            <EmptyState small icon="check" title="All cakes are well stocked" />
          ) : (
            <div className="stack gap-3" style={{ padding: 'var(--s-5)' }}>
              {lowStock.map((p) => (
                <div className="row between center" key={p._id}>
                  <span className="small">{p.name}</span>
                  <span className={`badge ${p.stock === 'Out of stock' ? 'err' : 'warn'}`}>{p.stock === 'Out of stock' ? 'Out' : `${p.qty} left`}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="a-panel">
          <div className="a-panel-head">
            <h3>Pending enquiries</h3>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/enquiries')}>Manage</button>
          </div>
          {pendingEnquiries.length === 0 ? (
            <EmptyState small icon="msg" title="No new enquiries" />
          ) : (
            <div className="stack gap-3" style={{ padding: 'var(--s-5)' }}>
              {pendingEnquiries.map((e) => (
                <div className="row between center" key={e._id}>
                  <span className="small">{e.name} · {e.occasion}</span>
                  <span className="badge neutral">{e.code}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
