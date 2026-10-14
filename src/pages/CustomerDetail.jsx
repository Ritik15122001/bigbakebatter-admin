import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/common/Icon';
import {
  Page, Card, Stat, Button, IconButton, Status, Cell, Avatar, Tabs, Tag, KeyValue, Alert, DataTable, EmptyState, Loader,
  useAsync, useConfirm, toast,
} from '../ui';
import { ContactButtons, CopyValue } from '../ui/ext-sales';
import { plural, splitCompany, copyText } from '../ui/ext-sales-utils';
import { customerService } from '../services/customerService';
import { money, fmtDate, fmtDateTime, fmtRelative } from '../utils/format';

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { data, setData, loading, error, reload } = useAsync(() => customerService.get(id), [id]);
  const [tab, setTab] = useState('orders');
  const [busy, setBusy] = useState(false);

  if (!data) {
    return (
      <Page title="Customer" eyebrow="Customers" back="/customers">
        <Loader loading={loading} error={error} onRetry={reload} rows={8} />
      </Page>
    );
  }

  const { customer: c, stats, orders = [], transactions = [], enquiries = [] } = data;
  const first = c.name.split(' ')[0];
  const addresses = c.addresses?.length ? c.addresses : c.addr ? [{ label: 'Address', line: c.addr, isDefault: true }] : [];
  const def = addresses.find((a) => a.isDefault) || addresses[0];
  const refunded = transactions.filter((t) => t.status === 'Refunded').reduce((s, t) => s + t.amount, 0);

  const toggleBlock = async () => {
    const blocking = !c.blocked;
    const ok = await confirm({
      title: blocking ? `Block ${c.name}?` : `Unblock ${c.name}?`,
      message: blocking
        ? `A blocked customer can't sign in to the website or place orders from their account. Their order history stays here, and you can unblock them any time.`
        : `${first} will be able to sign in and place orders again.`,
      confirmLabel: blocking ? 'Block customer' : 'Unblock', danger: blocking,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const updated = await customerService.setBlocked(c._id, blocking);
      setData((d) => ({ ...d, customer: { ...d.customer, blocked: updated.blocked } }));
      toast.success(blocking ? `${c.name} blocked` : `${c.name} unblocked`);
    } catch (err) {
      toast.error('Could not update the customer', err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page
      eyebrow="Customers"
      back="/customers"
      title={<span className="sales-title-avatar"><Avatar name={c.name} size="lg" />{c.name}</span>}
      badge={<Status>{c.blocked ? 'Blocked' : 'Active'}</Status>}
      description={
        <span className="sales-meta-line">
          <span><Icon name="mail" />{c.email}</span>
          {c.phone && <span><Icon name="phone" />{c.phone}</span>}
          <span><Icon name="cal" />Joined {fmtDate(c.createdAt)}</span>
        </span>
      }
      actions={
        <>
          <ContactButtons phone={c.phone} email={c.email} size={undefined} waText={`Hi ${first}, this is BigBakeBatter.`} />
          <Button variant={c.blocked ? 'primary' : 'danger-soft'} icon={c.blocked ? 'check' : 'ban'} loading={busy} onClick={toggleBlock}>{c.blocked ? 'Unblock' : 'Block'}</Button>
        </>
      }
    >
      <div className="u-stack">
        {c.blocked && <Alert tone="red" icon="ban" title="This customer is blocked">They can't sign in or place orders from their account until you unblock them.</Alert>}

        <div className="u-grid cols-4">
          <Stat label="Orders" icon="bag" tone="brand" value={stats.orders} note={`${orders.filter((o) => ['New', 'Baking', 'Out for delivery'].includes(o.status)).length} in progress`} onClick={() => setTab('orders')} />
          <Stat label="Total spent" icon="rupee" tone="green" value={money(stats.spent)} note={refunded ? `${money(refunded)} refunded` : 'Excludes cancelled orders'} onClick={() => setTab('payments')} />
          <Stat label="Average order" icon="trend" tone="blue" value={money(stats.aov)} note="Per non-cancelled order" />
          <Stat label="Last order" icon="clock" tone="violet" value={stats.lastOrderAt ? fmtRelative(stats.lastOrderAt) : '—'} note={stats.lastOrderAt ? fmtDate(stats.lastOrderAt) : 'Has not ordered yet'} />
        </div>

        <div className="u-grid main-side">
          <Card flush className="sales-tabs-card">
            <Tabs
              value={tab}
              onChange={setTab}
              items={[
                { value: 'orders', label: 'Orders', count: orders.length },
                { value: 'payments', label: 'Payments', count: transactions.length },
                { value: 'enquiries', label: 'Enquiries', count: enquiries.length },
                { value: 'addresses', label: 'Addresses', count: addresses.length },
              ]}
            />
            {tab === 'orders' && (
              <DataTable
                rows={orders}
                pageSize={8}
                onRowClick={(o) => navigate(`/orders/${o._id}`)}
                highlight={(o) => o.status === 'New'}
                empty={<EmptyState icon="bag" title="No orders yet">Orders {first} places on the website will show up here.</EmptyState>}
                columns={[
                  { key: 'createdAt', header: 'Order', sortable: true, sortValue: (o) => new Date(o.createdAt).getTime(), render: (o) => <Cell title={o.code} sub={fmtDateTime(o.createdAt)} /> },
                  { key: 'items', header: 'Items', render: (o) => <span className="u-small">{o.items.map((i) => `${i.name}${i.qty > 1 ? ` ×${i.qty}` : ''}`).join(', ')}</span> },
                  { key: 'deliver', header: 'Delivery', render: (o) => <Cell title={o.deliver || '—'} sub={o.slot} /> },
                  { key: 'amount', header: 'Amount', align: 'right', sortable: true, sortValue: (o) => o.amount, render: (o) => <b className="u-strong u-num">{money(o.amount)}</b> },
                  { key: 'status', header: 'Status', shrink: true, render: (o) => <Status>{o.status}</Status> },
                ]}
              />
            )}
            {tab === 'payments' && (
              <DataTable
                rows={transactions}
                pageSize={8}
                onRowClick={(t) => navigate(`/transactions?q=${encodeURIComponent(t.txnId)}&open=${t._id}`)}
                empty={<EmptyState icon="rupee" title="No payments yet">Razorpay payments for {first}'s orders will show up here.</EmptyState>}
                columns={[
                  { key: 'paidAt', header: 'Transaction', sortable: true, sortValue: (t) => new Date(t.paidAt).getTime(), render: (t) => <Cell title={t.txnId} sub={fmtDateTime(t.paidAt)} /> },
                  { key: 'orderCode', header: 'Order' },
                  { key: 'method', header: 'Method' },
                  { key: 'amount', header: 'Amount', align: 'right', render: (t) => <b className="u-strong u-num">{money(t.amount)}</b> },
                  { key: 'status', header: 'Status', shrink: true, render: (t) => <Status>{t.status}</Status> },
                ]}
              />
            )}
            {tab === 'enquiries' && (
              <DataTable
                rows={enquiries}
                pageSize={8}
                onRowClick={(e) => navigate(`/enquiries?open=${e._id}`)}
                empty={<EmptyState icon="msg" title="No enquiries">Custom and corporate cake enquiries from {first} will show up here.</EmptyState>}
                columns={[
                  { key: 'createdAt', header: 'Enquiry', render: (e) => <Cell title={e.code} sub={fmtDate(e.createdAt)} /> },
                  { key: 'occasion', header: 'Occasion', render: (e) => <Cell title={e.occasion} sub={splitCompany(e.note).company || undefined} /> },
                  { key: 'date', header: 'Needed by', render: (e) => e.date || '—' },
                  { key: 'quote', header: 'Quote', align: 'right', render: (e) => (e.quote != null ? <b className="u-num">{money(e.quote)}</b> : <span className="u-faint">—</span>) },
                  { key: 'status', header: 'Status', shrink: true, render: (e) => <Status>{e.status}</Status> },
                ]}
              />
            )}
            {tab === 'addresses' && (
              addresses.length ? (
                <div>
                  {addresses.map((a, i) => (
                    <div className="sales-addr" key={a._id || i}>
                      <Icon name={/office|work/i.test(a.label) ? 'briefcase' : 'home'} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="u-row" style={{ gap: 8 }}>
                          <b className="u-strong">{a.label || 'Address'}</b>
                          {a.isDefault && <Status tone="brand" size="sm">Default</Status>}
                        </div>
                        <div className="u-small" style={{ overflowWrap: 'anywhere' }}>{[a.line, a.city, a.pin].filter(Boolean).join(', ')}</div>
                      </div>
                      <IconButton icon="copy" label="Copy address" onClick={() => copyText([a.line, a.city, a.pin].filter(Boolean).join(', '), 'Address copied')} />
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon="pin" title="No saved addresses">{first} hasn't saved a delivery address to their account yet.</EmptyState>
              )
            )}
          </Card>

          <div className="u-stack">
            <Card title="Contact" icon="user">
              <KeyValue
                items={[
                  ['Email', <CopyValue key="e" value={c.email} label="Email copied" />],
                  ['Phone', c.phone ? <CopyValue key="p" value={c.phone} label="Phone copied" /> : 'Not added'],
                  ['Default address', def ? [def.line, def.city, def.pin].filter(Boolean).join(', ') : 'None saved'],
                ]}
              />
            </Card>
            <Card title="Account" icon="shield">
              <KeyValue
                items={[
                  ['Status', <Status key="s">{c.blocked ? 'Blocked' : 'Active'}</Status>],
                  ['Joined', fmtDateTime(c.createdAt)],
                  ['Last updated', fmtDateTime(c.updatedAt)],
                  c.passwordChangedAt && ['Password changed', fmtDateTime(c.passwordChangedAt)],
                  ['Orders', plural(stats.orders, 'order')],
                  ['Customer ID', <Tag key="i">{c._id.slice(-8)}</Tag>],
                ]}
              />
            </Card>
          </div>
        </div>
      </div>
    </Page>
  );
}
