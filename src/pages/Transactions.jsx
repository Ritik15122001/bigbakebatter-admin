import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Page, Card, Stat, Button, Status, Cell, DataTable, Drawer, KeyValue, Alert, AreaChart, BarList, SegmentBar, Input,
  Loader, useAsync, useConfirm, toast, downloadCsv,
} from '../ui';
import { FilterBar, TableEmpty, CopyValue } from '../ui/ext-sales';
import { useTableFilters, iso, plural } from '../ui/ext-sales-utils';
import { transactionService } from '../services/transactionService';
import { money, fmtDateTime, fmtDateShort } from '../utils/format';

const METHOD_TONE = { UPI: 'brand', Card: 'blue', 'Net Banking': 'violet' };

const loadAll = () => Promise.all([transactionService.list(), transactionService.summary()]).then(([list, summary]) => ({ list, summary }));

const FILTERS = [
  { key: 'status', label: 'Status', options: ['Paid', 'Refunded', 'Failed'], test: (t, v) => t.status === v },
  { key: 'method', label: 'Method', options: ['UPI', 'Card', 'Net Banking'], test: (t, v) => t.method === v },
];
const searchText = (t) => [t.txnId, t.orderCode, t.customer, t.email, t.razorpayPaymentId, t.razorpayOrderId].join(' ');

export default function Transactions() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();
  const { data, setData, loading, error, reload } = useAsync(loadAll);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [refunding, setRefunding] = useState(false);
  const openId = params.get('open');

  const list = useMemo(() => data?.list || [], [data]);
  const inRange = useMemo(() => list.filter((t) => {
    // compare calendar days in local time
    const local = t.paidAt ? new Date(new Date(t.paidAt).getTime() - new Date(t.paidAt).getTimezoneOffset() * 60000).toISOString().slice(0, 10) : '';
    return (!from || local >= from) && (!to || local <= to);
  }), [list, from, to]);
  const f = useTableFilters(inRange, { search: searchText, filters: FILTERS }, { q: params.get('q') || '' });
  const dateActive = from || to;

  const open = list.find((t) => t._id === openId) || null;
  const setOpen = (t) => {
    const next = new URLSearchParams(params);
    if (t) next.set('open', t._id); else next.delete('open');
    setParams(next, { replace: true });
  };

  const refund = async (t) => {
    const ok = await confirm({
      title: `Mark ${t.txnId} as refunded?`,
      message: `This only records the refund in BigBakeBatter and cancels order ${t.orderCode || ''}. It does not move any money — refund ${money(t.amount)} to ${t.customer} from the Razorpay dashboard first.`,
      confirmLabel: 'Mark as refunded', danger: true,
    });
    if (!ok) return;
    setRefunding(true);
    try {
      const updated = await transactionService.refund(t._id);
      const summary = await transactionService.summary().catch(() => data.summary);
      setData((d) => ({ list: d.list.map((x) => (x._id === t._id ? updated : x)), summary }));
      toast.success(`${t.txnId} marked refunded`, `Order ${t.orderCode} was cancelled`);
    } catch (err) {
      toast.error('Could not record the refund', err.message);
    } finally {
      setRefunding(false);
    }
  };

  const exportCsv = () => downloadCsv(
    'payments',
    ['Transaction ID', 'Paid at', 'Status', 'Refunded at', 'Order', 'Customer', 'Email', 'Method', 'Amount', 'Currency', 'Razorpay order ID', 'Razorpay payment ID'],
    f.rows.map((t) => [t.txnId, iso(t.paidAt), t.status, iso(t.refundedAt), t.orderCode, t.customer, t.email, t.method, t.amount, t.currency || 'INR', t.razorpayOrderId, t.razorpayPaymentId])
  );

  const s = data?.summary;
  const filteredTotal = f.rows.filter((t) => t.status === 'Paid').reduce((a, t) => a + t.amount, 0);

  return (
    <Page
      title="Payments"
      description="Every Razorpay payment recorded against an order, with refunds and daily revenue."
      actions={<Button icon="refresh" onClick={reload} loading={loading && !!data}>Refresh</Button>}
    >
      <Loader loading={loading && !data} error={!data ? error : ''} onRetry={reload} rows={6}>
        {s && (
          <div className="u-stack">
            <div className="u-grid cols-4">
              <Stat label="Gross revenue" icon="rupee" tone="brand" value={money(s.grossRevenue)} note={`${money(s.last30dRevenue)} in the last 30 days`} trend={(s.daily || []).map((d) => d.revenue)} />
              <Stat label="Refunded" icon="refresh" tone="amber" value={money(s.refundedAmount)} note={plural(s.refundedCount, 'refund')} onClick={() => f.setValue('status', 'Refunded')} />
              <Stat label="Net revenue" icon="trend" tone="green" value={money(s.netRevenue)} note={`Avg ${money(s.aov)} per payment`} />
              <Stat label="Transactions" icon="barchart" tone="violet" value={s.totalTransactions} note={`${s.paidCount} paid · ${s.refundedCount} refunded · ${s.failedCount} failed`} />
            </div>

            <div className="u-grid main-side">
              <Card title="Daily revenue" subtitle={`${money(s.last7dRevenue)} over the last 7 days · ${money(s.todayRevenue)} today from ${plural(s.todayCount, 'payment')}`}>
                <AreaChart
                  height={240}
                  format={money}
                  data={(s.daily || []).map((d) => ({ label: `${d.label} ${fmtDateShort(new Date(d.date))}`, value: d.revenue, sub: plural(d.count, 'payment') }))}
                />
              </Card>
              <Card title="By method" subtitle="Paid transactions, all time">
                <div className="u-stack">
                  <BarList items={(s.byMethod || []).map((m) => ({ label: m.method, value: m.revenue, display: money(m.revenue), tone: METHOD_TONE[m.method] }))} />
                  <SegmentBar items={(s.byMethod || []).map((m) => ({ label: m.method, value: m.count, tone: METHOD_TONE[m.method] }))} />
                </div>
              </Card>
            </div>

            <Card flush>
              <FilterBar
                f={f}
                filters={FILTERS}
                placeholder="Search transaction, order, customer, Razorpay ID…"
                extra={
                  <div className="sales-date-range">
                    <Input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} aria-label="Paid from" />
                    <span>to</span>
                    <Input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} aria-label="Paid to" />
                    {dateActive && <Button size="sm" variant="ghost" onClick={() => { setFrom(''); setTo(''); }}>Any date</Button>}
                  </div>
                }
                actions={<span className="u-small u-muted hide-xs">{money(filteredTotal)} paid in view</span>}
                onExport={exportCsv}
                exportDisabled={!f.rows.length}
              />
              <DataTable
                rows={f.rows}
                onRowClick={setOpen}
                pageSize={15}
                initialSort={{ key: 'paidAt', dir: 'desc' }}
                highlight={(t) => t.status === 'Refunded'}
                rowActions={(t) => [
                  { label: 'View details', icon: 'eye', onClick: () => setOpen(t) },
                  t.order && { label: `Open order ${t.orderCode}`, icon: 'bag', onClick: () => navigate(`/orders/${t.order}`) },
                  t.status === 'Paid' && { divider: true },
                  t.status === 'Paid' && { label: 'Mark as refunded…', icon: 'refresh', danger: true, onClick: () => refund(t) },
                ]}
                empty={
                  <TableEmpty total={dateActive ? inRange.length : list.length} f={{ clear: () => { f.clear(); setFrom(''); setTo(''); } }} icon="rupee" title={dateActive ? 'No payments in this date range' : 'No payments yet'}>
                    Payments are recorded automatically when a customer pays for an order with Razorpay.
                  </TableEmpty>
                }
                columns={[
                  { key: 'paidAt', header: 'Transaction', sortable: true, sortValue: (t) => new Date(t.paidAt).getTime(), render: (t) => <Cell title={t.txnId} sub={fmtDateTime(t.paidAt)} /> },
                  { key: 'customer', header: 'Customer', render: (t) => <Cell avatar={t.customer} title={t.customer} sub={t.email} /> },
                  { key: 'orderCode', header: 'Order', render: (t) => (t.order ? <button className="u-link" onClick={(e) => { e.stopPropagation(); navigate(`/orders/${t.order}`); }}>{t.orderCode}</button> : t.orderCode || '—') },
                  { key: 'method', header: 'Method', render: (t) => <Cell title={t.method} sub={t.razorpayPaymentId ? <span className="u-mono">{t.razorpayPaymentId}</span> : undefined} /> },
                  { key: 'amount', header: 'Amount', align: 'right', sortable: true, sortValue: (t) => t.amount, render: (t) => <b className="u-strong u-num" style={t.status !== 'Paid' ? { textDecoration: 'line-through', color: 'var(--u-muted)' } : undefined}>{money(t.amount)}</b> },
                  { key: 'status', header: 'Status', shrink: true, render: (t) => <Status>{t.status}</Status> },
                ]}
              />
            </Card>
          </div>
        )}
      </Loader>

      <Drawer
        open={!!open}
        onClose={() => setOpen(null)}
        title={open ? `Payment ${open.txnId}` : ''}
        description={open ? `${money(open.amount)} · ${open.method} · ${fmtDateTime(open.paidAt)}` : ''}
        footer={open && (
          <>
            {open.order && <Button icon="bag" onClick={() => navigate(`/orders/${open.order}`)}>View order</Button>}
            <span className="u-spacer" />
            {open.status === 'Paid'
              ? <Button variant="danger-soft" icon="refresh" loading={refunding} onClick={() => refund(open)}>Mark as refunded</Button>
              : <Button onClick={() => setOpen(null)}>Close</Button>}
          </>
        )}
      >
        {open && (
          <div className="u-stack">
            <div className="u-row between">
              <Cell avatar={open.customer} title={open.customer} sub={open.email || 'No email'} />
              <Status>{open.status}</Status>
            </div>
            {open.status === 'Paid' && (
              <Alert tone="blue" icon="info" title="Refunds happen in Razorpay">
                “Mark as refunded” only records the refund here and cancels the order. Refund the money from the Razorpay dashboard using the payment ID below.
              </Alert>
            )}
            {open.status === 'Refunded' && <Alert tone="amber" icon="info" title="Refunded">Recorded as refunded on {fmtDateTime(open.refundedAt)}. The linked order was cancelled.</Alert>}
            {open.status === 'Failed' && <Alert tone="red" icon="alert" title="Payment failed">No money was captured for this attempt.</Alert>}
            <Card title="Payment">
              <KeyValue
                items={[
                  ['Amount', <b key="a" className="u-num">{money(open.amount)} {open.currency && open.currency !== 'INR' ? open.currency : ''}</b>],
                  ['Method', open.method],
                  ['Status', <Status key="s">{open.status}</Status>],
                  ['Paid at', fmtDateTime(open.paidAt)],
                  open.refundedAt && ['Refunded at', fmtDateTime(open.refundedAt)],
                  ['Transaction ID', <CopyValue key="t" value={open.txnId} label="Transaction ID copied" />],
                  ['Order', open.order ? <button key="o" className="u-link" onClick={() => navigate(`/orders/${open.order}`)}>{open.orderCode}</button> : open.orderCode || '—'],
                ]}
              />
            </Card>
            <Card title="Razorpay">
              <KeyValue
                items={[
                  ['Order ID', <CopyValue key="o" value={open.razorpayOrderId} label="Razorpay order ID copied" />],
                  ['Payment ID', <CopyValue key="p" value={open.razorpayPaymentId} label="Razorpay payment ID copied" />],
                  ['Recorded', fmtDateTime(open.createdAt)],
                  ['Last updated', fmtDateTime(open.updatedAt)],
                ]}
              />
            </Card>
            {open.user && <Button iconRight="aright" onClick={() => navigate(`/customers/${open.user}`)}>View customer profile</Button>}
          </div>
        )}
      </Drawer>
    </Page>
  );
}
