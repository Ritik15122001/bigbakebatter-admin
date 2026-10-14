import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Page, Card, Stat, Button, Status, Cell, DataTable, Loader, useAsync, useConfirm, toast, downloadCsv,
} from '../ui';
import { FilterBar, TableEmpty } from '../ui/ext-sales';
import { useTableFilters, telHref, waHref, mailHref, iso } from '../ui/ext-sales-utils';
import { customerService } from '../services/customerService';
import { money, fmtDate, fmtRelative } from '../utils/format';

const loadCustomers = () => customerService.list();

const FILTERS = [
  {
    key: 'seg', label: 'All customers',
    options: [
      { value: 'orders', label: 'Has orders' }, { value: 'repeat', label: 'Repeat (2+ orders)' }, { value: 'none', label: 'No orders' },
      { value: 'new', label: 'Joined this month' }, { value: 'blocked', label: 'Blocked' }, { value: 'active', label: 'Active' },
    ],
    test: (c, v) => {
      if (v === 'orders') return c.orders > 0;
      if (v === 'repeat') return c.orders >= 2;
      if (v === 'none') return !c.orders;
      if (v === 'blocked') return !!c.blocked;
      if (v === 'active') return !c.blocked;
      const d = new Date(c.createdAt);
      const n = new Date();
      return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth();
    },
  },
];
const searchText = (c) => [c.name, c.email, c.phone, c.addr, ...(c.addresses || []).map((a) => `${a.line} ${a.city} ${a.pin}`)].join(' ');

export default function Customers() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { data, setData, loading, error, reload } = useAsync(loadCustomers);
  const customers = useMemo(() => data || [], [data]);
  const f = useTableFilters(customers, { search: searchText, filters: FILTERS });

  const stats = useMemo(() => {
    const n = new Date();
    const month = customers.filter((c) => { const d = new Date(c.createdAt); return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth(); });
    const buyers = customers.filter((c) => c.orders > 0);
    const repeat = customers.filter((c) => c.orders >= 2);
    const blocked = customers.filter((c) => c.blocked);
    return { month, buyers, repeat, blocked, spent: customers.reduce((s, c) => s + (c.spent || 0), 0) };
  }, [customers]);

  const toggleBlock = async (c) => {
    const blocking = !c.blocked;
    const ok = await confirm({
      title: blocking ? `Block ${c.name}?` : `Unblock ${c.name}?`,
      message: blocking
        ? `${c.name} won't be able to sign in or place orders from their account. Their past orders and details are kept, and you can unblock them at any time.`
        : `${c.name} will be able to sign in and order again.`,
      confirmLabel: blocking ? 'Block customer' : 'Unblock', danger: blocking,
    });
    if (!ok) return;
    try {
      const updated = await customerService.setBlocked(c._id, blocking);
      setData((list) => list.map((x) => (x._id === c._id ? { ...x, blocked: updated.blocked } : x)));
      toast.success(blocking ? `${c.name} blocked` : `${c.name} unblocked`, blocking ? "They can't sign in until you unblock them." : 'They can sign in again.');
    } catch (err) {
      toast.error('Could not update the customer', err.message);
    }
  };

  const exportCsv = () => downloadCsv(
    'customers',
    ['Name', 'Email', 'Phone', 'Orders', 'Total spent', 'Joined', 'Status', 'Default address', 'Saved addresses'],
    f.rows.map((c) => {
      const def = (c.addresses || []).find((a) => a.isDefault) || c.addresses?.[0];
      return [c.name, c.email, c.phone, c.orders || 0, c.spent || 0, iso(c.createdAt), c.blocked ? 'Blocked' : 'Active', def ? [def.line, def.city, def.pin].filter(Boolean).join(', ') : c.addr || '', (c.addresses || []).length];
    })
  );

  return (
    <Page
      title="Customers"
      description="Everyone who has created an account on the website, with what they've ordered and spent."
      actions={<Button icon="refresh" onClick={reload} loading={loading && !!data}>Refresh</Button>}
    >
      <Loader loading={loading && !data} error={!data ? error : ''} onRetry={reload} rows={6}>
        <div className="u-stack">
          <div className="u-grid cols-4">
            <Stat label="Total customers" icon="users" tone="brand" value={customers.length} note={`${stats.buyers.length} have ordered · ${money(stats.spent)} spent`} onClick={() => f.setValue('seg', '')} />
            <Stat label="New this month" icon="sparkles" tone="blue" value={stats.month.length} note={new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })} onClick={() => f.setValue('seg', 'new')} />
            <Stat label="Repeat customers" icon="heart" tone="green" value={stats.repeat.length} note={stats.buyers.length ? `${Math.round((stats.repeat.length / stats.buyers.length) * 100)}% of buyers ordered 2+ times` : 'No orders yet'} onClick={() => f.setValue('seg', 'repeat')} />
            <Stat label="Blocked" icon="ban" tone="red" value={stats.blocked.length} note="Can't sign in or order" onClick={() => f.setValue('seg', 'blocked')} />
          </div>

          <Card flush>
            <FilterBar f={f} filters={FILTERS} placeholder="Search name, email, phone, address…" onExport={exportCsv} exportDisabled={!f.rows.length} />
            <DataTable
              rows={f.rows}
              onRowClick={(c) => navigate(`/customers/${c._id}`)}
              highlight={(c) => c.blocked}
              pageSize={15}
              initialSort={{ key: 'createdAt', dir: 'desc' }}
              rowActions={(c) => [
                { label: 'View profile', icon: 'eye', onClick: () => navigate(`/customers/${c._id}`) },
                mailHref(c.email) && { label: 'Email', icon: 'mail', href: mailHref(c.email) },
                telHref(c.phone) && { label: 'Call', icon: 'phone', href: telHref(c.phone) },
                waHref(c.phone) && { label: 'WhatsApp', icon: 'whatsapp', href: waHref(c.phone, `Hi ${c.name.split(' ')[0]}, this is BigBakeBatter.`), external: true },
                { divider: true },
                c.blocked
                  ? { label: 'Unblock customer…', icon: 'check', onClick: () => toggleBlock(c) }
                  : { label: 'Block customer…', icon: 'ban', danger: true, onClick: () => toggleBlock(c) },
              ]}
              empty={
                <TableEmpty total={customers.length} f={f} icon="users" title="No customers yet">
                  Customers appear here once they create an account on the website.
                </TableEmpty>
              }
              columns={[
                { key: 'name', header: 'Customer', render: (c) => <Cell avatar={c.name} title={c.name} sub={c.email} /> },
                { key: 'phone', header: 'Phone', render: (c) => c.phone || <span className="u-faint">—</span> },
                { key: 'orders', header: 'Orders', align: 'right', sortable: true, sortValue: (c) => c.orders || 0, render: (c) => <span className="u-num">{c.orders || 0}</span> },
                { key: 'spent', header: 'Spent', align: 'right', sortable: true, sortValue: (c) => c.spent || 0, render: (c) => <b className="u-strong u-num">{money(c.spent || 0)}</b> },
                { key: 'createdAt', header: 'Joined', sortable: true, sortValue: (c) => new Date(c.createdAt).getTime(), render: (c) => <Cell title={fmtDate(c.createdAt)} sub={fmtRelative(c.createdAt)} /> },
                { key: 'status', header: 'Status', shrink: true, render: (c) => <Status>{c.blocked ? 'Blocked' : 'Active'}</Status> },
              ]}
            />
          </Card>
        </div>
      </Loader>
    </Page>
  );
}
