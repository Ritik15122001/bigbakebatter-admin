import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Page, Card, Stat, Button, Status, Cell, DataTable, Tabs, Loader, useAsync, useConfirm, toast, downloadCsv,
} from '../ui';
import { FilterBar, TableEmpty } from '../ui/ext-sales';
import {
  useTableFilters, deliveryBucket, parseDeliver, inThisWeek, telHref, waHref, copyText, iso, plural,
} from '../ui/ext-sales-utils';
import { orderService, ORDER_STATUSES } from '../services/orderService';
import { money, fmtDateTime, fmtDate } from '../utils/format';

const TABS = ['All', ...ORDER_STATUSES];
const STATUS_ICON = { New: 'bag', Baking: 'cake', 'Out for delivery': 'truck', Delivered: 'check', Cancelled: 'ban' };

const loadOrders = () => orderService.list();

const itemsText = (o) => (o.items || []).map((i) => `${i.name}${i.weight ? ` (${i.weight})` : ''}${i.qty > 1 ? ` ×${i.qty}` : ''}`).join(', ');
const itemCount = (o) => (o.items || []).reduce((s, i) => s + i.qty, 0);

const FILTERS = [
  {
    key: 'when', label: 'Delivery date',
    options: [
      { value: 'today', label: 'Today' }, { value: 'tomorrow', label: 'Tomorrow' }, { value: 'thisweek', label: 'This week' },
      { value: 'upcoming', label: 'Later' }, { value: 'past', label: 'Past' },
    ],
    test: (o, v) => (v === 'thisweek' ? ['today', 'tomorrow', 'week'].includes(deliveryBucket(o.deliver)) && inThisWeek(parseDeliver(o.deliver)) : deliveryBucket(o.deliver) === v),
  },
  { key: 'pay', label: 'Payment method', options: ['UPI', 'Card', 'Net Banking'], test: (o, v) => o.pay === v },
  {
    key: 'extra', label: 'More filters',
    options: [
      { value: 'promo', label: 'Used a promo code' }, { value: 'msg', label: 'Has a cake message' },
      { value: 'eggless', label: 'Has eggless items' }, { value: 'guest', label: 'Guest checkout' },
    ],
    test: (o, v) => (v === 'promo' ? !!o.promoCode : v === 'msg' ? !!(o.msg || o.items?.some((i) => i.note)) : v === 'eggless' ? !!o.items?.some((i) => i.eggless) : !o.user),
  },
];

const searchText = (o) => [o.code, o.customer, o.phone, o.email, itemsText(o), o.addr, o.promoCode].join(' ');

export default function Orders() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();
  const tab = TABS.includes(params.get('status')) ? params.get('status') : 'All';
  const { data, setData, loading, error, reload } = useAsync(loadOrders);
  const orders = useMemo(() => data || [], [data]);

  const inTab = useMemo(() => (tab === 'All' ? orders : orders.filter((o) => o.status === tab)), [orders, tab]);
  const f = useTableFilters(inTab, { search: searchText, filters: FILTERS });

  const counts = useMemo(() => {
    const c = { All: orders.length };
    ORDER_STATUSES.forEach((s) => { c[s] = orders.filter((o) => o.status === s).length; });
    return c;
  }, [orders]);

  const stats = useMemo(() => {
    const live = orders.filter((o) => o.status !== 'Cancelled');
    const today = live.filter((o) => deliveryBucket(o.deliver) === 'today');
    const tomorrow = live.filter((o) => deliveryBucket(o.deliver) === 'tomorrow');
    const todayOpen = today.filter((o) => o.status !== 'Delivered');
    const progress = orders.filter((o) => ['New', 'Baking', 'Out for delivery'].includes(o.status));
    const deliveredAt = (o) => [...(o.statusHistory || [])].reverse().find((h) => h.status === 'Delivered')?.at || parseDeliver(o.deliver) || o.updatedAt;
    const deliveredWeek = orders.filter((o) => o.status === 'Delivered' && inThisWeek(deliveredAt(o)));
    const cancelled = orders.filter((o) => o.status === 'Cancelled');
    return { today, todayOpen, tomorrow, progress, deliveredWeek, cancelled };
  }, [orders]);

  const setTab = (t) => {
    const next = new URLSearchParams(params);
    if (t === 'All') next.delete('status'); else next.set('status', t);
    setParams(next, { replace: true });
  };

  const changeStatus = async (o, status) => {
    if (status === 'Cancelled') {
      const ok = await confirm({
        title: `Cancel order ${o.code}?`,
        message: `The order moves to Cancelled and leaves the kitchen queue. This does not refund the ${money(o.amount)} the customer paid — record the refund under Payments and issue it from the Razorpay dashboard.`,
        confirmLabel: 'Cancel order', cancelLabel: 'Keep order', danger: true,
      });
      if (!ok) return;
    }
    try {
      const updated = await orderService.updateStatus(o._id, status);
      setData((list) => list.map((x) => (x._id === o._id ? updated : x)));
      toast.success(`${o.code} marked ${status}`, o.customer);
    } catch (err) {
      toast.error('Could not update the order', err.message);
    }
  };

  const exportCsv = () => {
    downloadCsv(
      tab === 'All' ? 'orders' : `orders-${tab.toLowerCase().replace(/\s+/g, '-')}`,
      ['Order', 'Placed at', 'Status', 'Customer', 'Phone', 'Email', 'Items', 'Item count', 'Subtotal', 'Discount', 'Promo code', 'Delivery fee', 'Total', 'Payment method', 'Razorpay order ID', 'Razorpay payment ID', 'Delivery date', 'Slot', 'Address', 'Cake message', 'Customer notes', 'Internal note', 'Account'],
      f.rows.map((o) => [
        o.code, iso(o.createdAt), o.status, o.customer, o.phone, o.email,
        (o.items || []).map((i) => `${i.qty} × ${i.name}${i.weight ? ` ${i.weight}` : ''}${i.eggless ? ' (eggless)' : ''}${i.note ? ` [msg: ${i.note}]` : ''}`).join('; '),
        itemCount(o),
        o.subtotal ?? (o.items || []).reduce((s, i) => s + (i.line || 0), 0), o.discount || 0, o.promoCode || '', o.delivery || 0, o.amount,
        o.pay, o.razorpayOrderId || '', o.razorpayPaymentId || '', o.deliver, o.slot, o.addr, o.msg || '', o.notes || '', o.adminNote || '', o.user ? 'Registered' : 'Guest',
      ])
    );
  };

  const rowActions = (o) => [
    { label: 'View order', icon: 'eye', onClick: () => navigate(`/orders/${o._id}`) },
    { heading: 'Move to' },
    ...ORDER_STATUSES.filter((s) => s !== o.status).map((s) => ({
      label: s === 'Cancelled' ? 'Cancel order…' : s, icon: STATUS_ICON[s], danger: s === 'Cancelled', onClick: () => changeStatus(o, s),
    })),
    { divider: true },
    telHref(o.phone) && { label: 'Call customer', icon: 'phone', href: telHref(o.phone) },
    waHref(o.phone) && { label: 'WhatsApp', icon: 'whatsapp', href: waHref(o.phone, `Hi ${o.customer.split(' ')[0]}, this is BigBakeBatter about your order ${o.code}.`), external: true },
    { label: 'Copy address', icon: 'copy', onClick: () => copyText(o.addr, 'Address copied') },
  ];

  return (
    <Page
      title="Orders"
      description="Every cake order from the website — track it from the oven to the doorstep."
      actions={<Button icon="refresh" onClick={reload} loading={loading && !!data}>Refresh</Button>}
    >
      <Loader loading={loading && !data} error={!data ? error : ''} onRetry={reload} rows={6}>
        <div className="u-stack">
          <div className="u-grid cols-4">
            <Stat
              label="Today's deliveries" icon="truck" tone="brand" value={stats.today.length}
              note={`${stats.todayOpen.length} still to go · ${stats.tomorrow.length} tomorrow`}
              onClick={() => { setTab('All'); f.setValue('when', 'today'); }}
            />
            <Stat label="In progress" icon="cake" tone="amber" value={stats.progress.length} note={`${counts.New} new · ${counts.Baking} baking · ${counts['Out for delivery']} out`} onClick={() => setTab('Baking')} />
            <Stat label="Delivered this week" icon="check" tone="green" value={stats.deliveredWeek.length} note={`${money(stats.deliveredWeek.reduce((s, o) => s + o.amount, 0))} in sales`} onClick={() => setTab('Delivered')} />
            <Stat label="Cancelled" icon="ban" tone="red" value={stats.cancelled.length} note={`${money(stats.cancelled.reduce((s, o) => s + o.amount, 0))} all-time`} onClick={() => setTab('Cancelled')} />
          </div>

          <Card flush>
            <Tabs items={TABS.map((t) => ({ value: t, label: t === 'All' ? 'All orders' : t, count: counts[t] ?? 0 }))} value={tab} onChange={setTab} />
            <FilterBar f={f} filters={FILTERS} placeholder="Search code, customer, phone, email, items…" onExport={exportCsv} exportDisabled={!f.rows.length} />
            <DataTable
              rows={f.rows}
              onRowClick={(o) => navigate(`/orders/${o._id}`)}
              highlight={(o) => o.status === 'New'}
              rowActions={rowActions}
              pageSize={15}
              initialSort={{ key: 'createdAt', dir: 'desc' }}
              empty={
                <TableEmpty total={inTab.length} f={f} icon="bag" title={tab === 'All' ? 'No orders yet' : `No ${tab.toLowerCase()} orders`}>
                  {tab === 'All' ? 'Orders placed on the website appear here as soon as the payment goes through.' : 'Orders move into this tab as you update their status.'}
                </TableEmpty>
              }
              columns={[
                {
                  key: 'createdAt', header: 'Order', sortable: true, sortValue: (o) => new Date(o.createdAt).getTime(),
                  render: (o) => <Cell title={o.code} sub={fmtDateTime(o.createdAt)} />,
                },
                { key: 'customer', header: 'Customer', render: (o) => <Cell avatar={o.customer} title={o.customer} sub={o.phone} /> },
                {
                  key: 'items', header: 'Items',
                  render: (o) => (
                    <Cell
                      title={plural(itemCount(o), 'item')}
                      sub={<span title={itemsText(o)} style={{ display: 'inline-block', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom' }}>{itemsText(o)}</span>}
                    />
                  ),
                },
                {
                  key: 'deliver', header: 'Delivery', sortable: true, sortValue: (o) => parseDeliver(o.deliver)?.getTime() ?? 0,
                  render: (o) => {
                    const b = deliveryBucket(o.deliver);
                    const live = !['Delivered', 'Cancelled'].includes(o.status);
                    const d = parseDeliver(o.deliver);
                    const title = live && b === 'today' ? <span style={{ color: 'var(--u-brand-2)' }}>Today</span> : live && b === 'tomorrow' ? 'Tomorrow' : d ? fmtDate(d) : o.deliver || '—';
                    return <Cell title={title} sub={o.slot || 'Any time'} />;
                  },
                },
                { key: 'pay', header: 'Payment', render: (o) => <Cell title={o.pay} sub={o.promoCode ? `Promo ${o.promoCode}` : undefined} /> },
                { key: 'amount', header: 'Amount', align: 'right', sortable: true, sortValue: (o) => o.amount, render: (o) => <b className="u-strong u-num">{money(o.amount)}</b> },
                { key: 'status', header: 'Status', shrink: true, render: (o) => <Status>{o.status}</Status> },
              ]}
            />
          </Card>
        </div>
      </Loader>
    </Page>
  );
}
