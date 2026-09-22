import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/common/Icon';
import Modal from '../components/common/Modal';
import EmptyState from '../components/common/EmptyState';
import { transactionService } from '../services/transactionService';
import { useUiStore } from '../store/uiStore';
import { money, fmtDate, fmtTime, fmtDateTime } from '../utils/format';

const STATUSES = ['All', 'Paid', 'Refunded', 'Failed'];
const METHODS = ['All', 'UPI', 'Card', 'Net Banking'];

const STATUS_TONE = { Paid: 'success', Refunded: 'warn', Failed: 'err' };
const STATUS_ICON = { Paid: 'check', Refunded: 'refresh', Failed: 'alert' };
const METHOD_ICON = { UPI: 'phone', Card: 'card', 'Net Banking': 'home' };

export default function Transactions() {
  const pushToast = useUiStore((s) => s.pushToast);
  const [summary, setSummary] = useState(null);
  const [list, setList] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refunding, setRefunding] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [busy, setBusy] = useState(false);

  const [q, setQ] = useState('');
  const [status, setStatus] = useState('All');
  const [method, setMethod] = useState('All');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    transactionService.summary().then(setSummary).catch(() => {});
  }, []);

  const load = () => {
    setLoading(true);
    transactionService
      .list({ q, status, method, from, to })
      .then(setList)
      .catch((e) => pushToast({ title: 'Could not load transactions', subtitle: e.message, kind: 'err' }))
      .finally(() => setLoading(false));
  };

  useEffect(load, [status, method, from, to]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const id = setTimeout(load, q ? 350 : 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const clearFilters = () => {
    setQ(''); setStatus('All'); setMethod('All'); setFrom(''); setTo('');
  };
  const filtersActive = q || status !== 'All' || method !== 'All' || from || to;

  const shownTotal = useMemo(() => (list || []).reduce((sum, t) => sum + (t.status === 'Refunded' ? 0 : t.amount), 0), [list]);

  const maxDaily = useMemo(() => Math.max(1, ...(summary?.daily || []).map((d) => d.revenue)), [summary]);
  const maxMethod = useMemo(() => Math.max(1, ...(summary?.byMethod || []).map((m) => m.revenue)), [summary]);
  const todayLabel = new Date().toLocaleDateString('en-GB', { weekday: 'short' });

  const confirmRefund = async () => {
    setBusy(true);
    try {
      await transactionService.refund(refunding._id);
      pushToast({ title: `${refunding.txnId} refunded`, subtitle: 'The linked order has been cancelled.', kind: 'ok' });
      setRefunding(null);
      load();
      transactionService.summary().then(setSummary).catch(() => {});
    } catch (e) {
      pushToast({ title: 'Refund failed', subtitle: e.message, kind: 'err' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="kpi-grid k5">
        <div className="kpi">
          <span className="kico" style={{ background: 'var(--c-accent-soft)', color: 'var(--c-accent)' }}>
            <Icon name="card" className="icon icon-sm" />
          </span>
          <div className="kv">{summary ? money(summary.grossRevenue) : '—'}</div>
          <div className="kl">Gross revenue</div>
        </div>
        <div className="kpi">
          <span className="kico" style={{ background: 'var(--c-success-soft)', color: 'var(--c-success)' }}>
            <Icon name="check" className="icon icon-sm" />
          </span>
          <div className="kv">{summary ? money(summary.netRevenue) : '—'}</div>
          <div className="kl">Net revenue</div>
        </div>
        <div className="kpi">
          <span className="kico" style={{ background: '#eef2ff', color: '#4338ca' }}>
            <Icon name="clock" className="icon icon-sm" />
          </span>
          <div className="kv">{summary ? money(summary.todayRevenue) : '—'}</div>
          <div className="kl">Today &middot; {summary?.todayCount || 0} payment{summary?.todayCount === 1 ? '' : 's'}</div>
        </div>
        <div className="kpi">
          <span className="kico" style={{ background: '#f0fdfa', color: '#0f766e' }}>
            <Icon name="gift" className="icon icon-sm" />
          </span>
          <div className="kv">{summary ? money(summary.aov) : '—'}</div>
          <div className="kl">Average order value</div>
        </div>
        <div className="kpi">
          <span className="kico" style={{ background: 'var(--c-warning-soft)', color: 'var(--c-warning)' }}>
            <Icon name="refresh" className="icon icon-sm" />
          </span>
          <div className="kv">{summary ? money(summary.refundedAmount) : '—'}</div>
          <div className="kl">Refunded &middot; {summary?.refundedCount || 0}</div>
        </div>
      </div>

      <div className="a-grid-2">
        <div className="a-panel">
          <div className="a-panel-head">
            <h3>Revenue, last 7 days</h3>
            {summary && <span className="a-count">{money(summary.last7dRevenue)} total</span>}
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
            <h3>By payment method</h3>
          </div>
          {summary ? (
            <div className="meth-list">
              {summary.byMethod.map((m, i) => (
                <div className={`meth-row ${i === 0 ? 'top' : ''}`} key={m.method}>
                  <span className="mh">
                    <b><Icon name={METHOD_ICON[m.method]} className="icon icon-sm" style={{ marginRight: 6, verticalAlign: -2 }} />{m.method}</b>
                    <span>{money(m.revenue)} &middot; {m.count}</span>
                  </span>
                  <span className="meth-bar">
                    <i style={{ width: `${(m.revenue / maxMethod) * 100}%` }} />
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="a-empty small"><p className="muted">Loading…</p></div>
          )}
          {summary && (
            <div className="fin-note">
              <span>Total transactions <b>{summary.totalTransactions}</b></span>
              <span>Paid <b>{summary.paidCount}</b></span>
              <span>Failed <b>{summary.failedCount}</b></span>
            </div>
          )}
        </div>
      </div>

      <div className="a-panel">
        <div className="a-panel-head">
          <h3>All transactions</h3>
          <span className="a-count">{list ? `${list.length} shown` : ''}</span>
        </div>

        <div className="a-filters">
          <div className="field f-grow">
            <label>Search</label>
            <input className="input" placeholder="Txn id, order, customer, email…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="field f-sm">
            <label>Status</label>
            <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="field f-sm">
            <label>Method</label>
            <select className="select" value={method} onChange={(e) => setMethod(e.target.value)}>
              {METHODS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div className="field f-date">
            <label>From</label>
            <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="field f-date">
            <label>To</label>
            <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          {filtersActive && (
            <div className="f-actions">
              <button className="btn btn-ghost btn-sm" onClick={clearFilters}>
                <Icon name="x" className="icon icon-sm" />
                Clear
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="a-empty"><p className="muted">Loading transactions…</p></div>
        ) : !list || list.length === 0 ? (
          <EmptyState
            icon="card"
            title="No transactions match these filters"
            message="Try widening your date range or clearing filters."
            action={filtersActive ? <button className="btn btn-outline btn-sm" onClick={clearFilters}>Clear filters</button> : null}
          />
        ) : (
          <>
            <div className="a-table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Txn</th>
                    <th>Order</th>
                    <th>Customer</th>
                    <th className="tight">Method</th>
                    <th>Date &amp; time</th>
                    <th className="num">Amount</th>
                    <th className="tight">Status</th>
                    <th className="act" />
                  </tr>
                </thead>
                <tbody>
                  {list.map((t) => (
                    <tr key={t._id} onClick={() => setViewing(t)} style={{ cursor: 'pointer' }}>
                      <td><span className="cell-main" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.8em' }}>{t.txnId}</span></td>
                      <td>
                        {t.orderCode ? (
                          <Link className="a-linkbtn" to="/orders" onClick={(e) => e.stopPropagation()}>{t.orderCode}</Link>
                        ) : <span className="cell-sub">—</span>}
                      </td>
                      <td>
                        <span className="cell-main">{t.customer}</span>
                        <span className="cell-sub">{t.email}</span>
                      </td>
                      <td className="tight">
                        <span className="row gap-2 center small">
                          <Icon name={METHOD_ICON[t.method]} className="icon icon-sm" style={{ color: 'var(--c-muted)' }} />
                          {t.method}
                        </span>
                      </td>
                      <td>
                        <span className="cell-main">{fmtDate(t.paidAt)}</span>
                        <span className="cell-sub">{fmtTime(t.paidAt)}</span>
                      </td>
                      <td className="num cell-main">{money(t.amount)}</td>
                      <td className="tight">
                        <span className={`badge ${STATUS_TONE[t.status]}`}>
                          <Icon name={STATUS_ICON[t.status]} className="icon icon-sm" />
                          {t.status}
                        </span>
                      </td>
                      <td className="act rowact" onClick={(e) => e.stopPropagation()}>
                        <button className="iconbtn" title="View transaction details" aria-label="View details" onClick={() => setViewing(t)}>
                          <Icon name="eye" className="icon icon-sm" />
                        </button>
                        {t.status === 'Paid' && (
                          <button className="iconbtn" title="Refund this transaction" aria-label="Refund" onClick={() => setRefunding(t)}>
                            <Icon name="refresh" className="icon icon-sm" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="a-resultbar">
              <span>Showing <b>{list.length}</b> transaction{list.length === 1 ? '' : 's'}</span>
              <span className="rtotal">Total shown: <b>{money(shownTotal)}</b></span>
            </div>
          </>
        )}
      </div>

      <Modal
        open={!!refunding}
        onClose={() => setRefunding(null)}
        kicker="Confirm refund"
        title={refunding ? `Refund ${refunding.txnId}?` : ''}
        foot={
          <>
            <button className="btn btn-ghost" onClick={() => setRefunding(null)}>Cancel</button>
            <button className="btn btn-primary" style={{ background: 'var(--c-error)' }} disabled={busy} onClick={confirmRefund}>
              {busy ? 'Refunding…' : 'Refund & cancel order'}
            </button>
          </>
        }
      >
        {refunding && (
          <p className="lede">
            This marks the {money(refunding.amount)} payment for order <b>{refunding.orderCode}</b> ({refunding.customer}) as refunded
            and cancels the order. This cannot be undone from here.
          </p>
        )}
      </Modal>

      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        kicker="Payment receipt"
        title={viewing?.txnId}
        width={560}
        foot={
          viewing?.status === 'Paid' && (
            <button
              className="btn btn-primary"
              style={{ background: 'var(--c-error)' }}
              onClick={() => { setRefunding(viewing); setViewing(null); }}
            >
              <Icon name="refresh" className="icon icon-sm" />
              Refund this payment
            </button>
          )
        }
      >
        {viewing && (
          <div className="stack gap-5">
            <div className="dv-top">
              <span className="row gap-3 center">
                <span className="dv-top-ico">
                  <Icon name={STATUS_ICON[viewing.status]} className="icon icon-md" />
                </span>
                <span className="stack gap-1">
                  <b style={{ fontSize: '1.05rem' }} className="dv-mono">{viewing.txnId}</b>
                  <span className="tiny muted">{fmtDateTime(viewing.paidAt)}</span>
                </span>
              </span>
              <span className="stack gap-1" style={{ alignItems: 'flex-end' }}>
                <span className="dv-top-amt">{money(viewing.amount)}</span>
                <span className={`badge ${STATUS_TONE[viewing.status]}`}>{viewing.status}</span>
              </span>
            </div>

            <div>
              <p className="dv-sec-title">Order &amp; customer</p>
              <div className="dv-grid">
                <div className="dv-field">
                  <label>Order</label>
                  <div className="v">
                    {viewing.orderCode ? <Link className="a-linkbtn" to="/orders" onClick={() => setViewing(null)}>{viewing.orderCode}</Link> : '—'}
                  </div>
                </div>
                <div className="dv-field"><label>Method</label><div className="v">{viewing.method}</div></div>
                <div className="dv-field"><label>Customer</label><div className="v">{viewing.customer}</div></div>
                <div className="dv-field"><label>Email</label><div className="v">{viewing.email || '—'}</div></div>
              </div>
            </div>

            <div>
              <p className="dv-sec-title">Razorpay reference</p>
              <div className="dv-grid">
                <div className="dv-field full"><label>Razorpay order ID</label><div className="v dv-mono">{viewing.razorpayOrderId || '—'}</div></div>
                <div className="dv-field full"><label>Razorpay payment ID</label><div className="v dv-mono">{viewing.razorpayPaymentId || '—'}</div></div>
              </div>
            </div>

            {viewing.status === 'Refunded' && (
              <div>
                <p className="dv-sec-title">Refund</p>
                <div className="dv-grid">
                  <div className="dv-field full"><label>Refunded on</label><div className="v">{viewing.refundedAt ? fmtDateTime(viewing.refundedAt) : '—'}</div></div>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
