import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/common/Icon';
import {
  Page, Card, Stat, Button, Status, Cell, DataTable, AreaChart, BarList, SegmentBar, Segmented,
  EmptyState, Loader, useAsync,
} from '../ui';
import { dashboardService } from '../services/dashboardService';
import { useAuthStore } from '../store/authStore';
import { money, fmtDateShort } from '../utils/format';

const PIPELINE = [
  ['New', 'blue'], ['Baking', 'amber'], ['Out for delivery', 'violet'], ['Delivered', 'green'], ['Cancelled', 'red'],
];

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

const pct = (cur, prev) => (prev > 0 ? ((cur - prev) / prev) * 100 : cur > 0 ? 100 : 0);

export default function Dashboard() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { data, loading, error, reload } = useAsync(dashboardService.getStats);
  const [range, setRange] = useState(30);

  const first = (user?.name || 'there').split(' ')[0];
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <Page
      title={`${greeting()}, ${first}`}
      description={`Here's what's happening at BigBakeBatter today — ${today}.`}
      actions={
        <>
          <Button icon="refresh" onClick={reload} loading={loading && !!data}>Refresh</Button>
          <Button variant="primary" icon="plus" onClick={() => navigate('/cakes/new')}>Add cake</Button>
        </>
      }
    >
      <Loader loading={loading && !data} error={!data ? error : ''} onRetry={reload} rows={6}>
        {data && <DashboardBody data={data} range={range} setRange={setRange} />}
      </Loader>
    </Page>
  );
}

function DashboardBody({ data, range, setRange }) {
  const navigate = useNavigate();
  const series = data.series || [];
  const last14 = series.slice(-14);
  const ordersLast30 = series.reduce((s, d) => s + d.orders, 0);
  const ordersPrev = series.slice(-14, -7).reduce((s, d) => s + d.orders, 0);
  const ordersCur = series.slice(-7).reduce((s, d) => s + d.orders, 0);
  const shown = series.slice(-range);
  const rangeRevenue = shown.reduce((s, d) => s + d.revenue, 0);
  const statusItems = PIPELINE.map(([label, tone]) => ({ label, tone, value: data.statusCounts?.[label] || 0 }));

  return (
    <div className="u-stack">
      <div className="u-grid cols-4">
        <Stat
          label="Revenue · last 7 days" icon="rupee" tone="brand"
          value={money(data.revenue7 || 0)} delta={pct(data.revenue7, data.revenuePrev7)} note="vs previous 7 days"
          trend={last14.map((d) => d.revenue)} onClick={() => navigate('/transactions')}
        />
        <Stat
          label="Orders · last 30 days" icon="bag" tone="blue"
          value={ordersLast30} delta={pct(ordersCur, ordersPrev)} note={`${data.activeOrders} in progress`}
          trend={last14.map((d) => d.orders)} onClick={() => navigate('/orders')}
        />
        <Stat label="Average order value" icon="trend" tone="green" value={money(data.aov || 0)} note={`${data.totalOrders} orders all-time`} onClick={() => navigate('/transactions')} />
        <Stat
          label="Customers" icon="users" tone="violet" value={data.customers ?? 0}
          note={`+${data.newCustomers30 || 0} new this month · ${data.subscribers || 0} subscribers`}
          onClick={() => navigate('/customers')}
        />
      </div>

      <div className="u-grid main-side">
        <Card
          title="Revenue"
          subtitle={`${money(rangeRevenue)} from completed and active orders in the last ${range} days`}
          actions={<Segmented value={range} onChange={setRange} items={[{ value: 7, label: '7 days' }, { value: 14, label: '14 days' }, { value: 30, label: '30 days' }]} />}
        >
          <AreaChart
            height={260}
            format={money}
            data={shown.map((d) => ({ label: fmtDateShort(new Date(d.date)), value: d.revenue, sub: `${d.orders} order${d.orders === 1 ? '' : 's'}` }))}
          />
        </Card>

        <Card
          title="Today's deliveries"
          subtitle={data.todayLabel}
          flush
          actions={<Status tone={data.todayDeliveries.length ? 'brand' : 'gray'} plain>{data.todayDeliveries.length}</Status>}
          footer={
            <>
              <span className="u-small">Tomorrow: <b className="u-strong">{data.tomorrowDeliveries.length}</b> order{data.tomorrowDeliveries.length === 1 ? '' : 's'}</span>
              <button className="u-link u-small" onClick={() => navigate('/orders')}>All orders <Icon name="aright" /></button>
            </>
          }
        >
          {data.todayDeliveries.length === 0 ? (
            <EmptyState icon="truck" title="Nothing to deliver today">Orders scheduled for today will appear here with their slot.</EmptyState>
          ) : (
            <div className="u-list" style={{ maxHeight: 300, overflowY: 'auto' }}>
              {data.todayDeliveries.map((o) => (
                <div key={o._id} className="u-list-item clickable" onClick={() => navigate(`/orders/${o._id}`)}>
                  <Cell avatar={o.customer} title={o.customer} sub={`${o.code} · ${o.slot || 'Any time'}`} />
                  <span className="u-spacer" />
                  <Status size="sm">{o.status}</Status>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="u-grid cols-3">
        <Card title="Order pipeline" subtitle="Every order by its current status">
          <div className="u-stack tight">
            <SegmentBar items={statusItems} />
            <div className="u-list" style={{ marginInline: -20, marginBottom: -20, marginTop: 8 }}>
              {statusItems.map((s) => (
                <div key={s.label} className="u-list-item clickable" onClick={() => navigate(`/orders?status=${encodeURIComponent(s.label)}`)}>
                  <Status tone={s.tone}>{s.label}</Status>
                  <span className="u-spacer" />
                  <b className="u-strong u-num">{s.value}</b>
                  <Icon name="cright" className="icon u-faint" />
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card title="Best sellers" subtitle="Most-ordered cakes" actions={<button className="u-link u-small" onClick={() => navigate('/cakes')}>All cakes</button>}>
          {data.topSelling?.length ? (
            <BarList items={data.topSelling.map((p) => ({ label: p.name, value: p.sold || 0, display: `${p.sold || 0} sold` }))} />
          ) : (
            <EmptyState icon="cake" title="No sales yet" />
          )}
        </Card>

        <Card title="Needs attention" subtitle="Stock and enquiries waiting on you" flush>
          {data.lowStock.length === 0 && data.pendingEnquiries.length === 0 ? (
            <EmptyState icon="check" title="All clear">Stock is healthy and there are no new enquiries.</EmptyState>
          ) : (
            <div className="u-list">
              {data.pendingEnquiries.slice(0, 4).map((e) => (
                <div key={e._id} className="u-list-item clickable" onClick={() => navigate(`/enquiries?open=${e._id}`)}>
                  <span className="u-stat-ico tone-violet" style={{ width: 32, height: 32 }}><Icon name="msg" /></span>
                  <Cell title={`${e.name} · ${e.occasion}`} sub={`Enquiry ${e.code}`} />
                  <span className="u-spacer" />
                  <Status size="sm">New</Status>
                </div>
              ))}
              {data.lowStock.slice(0, 5).map((p) => (
                <div key={p._id} className="u-list-item clickable" onClick={() => navigate('/stock')}>
                  <span className={`u-stat-ico ${p.stock === 'Out of stock' ? 'tone-red' : 'tone-amber'}`} style={{ width: 32, height: 32 }}><Icon name="pkg" /></span>
                  <Cell title={p.name} sub={p.stock === 'Out of stock' ? 'Out of stock' : `Only ${p.qty} left`} />
                  <span className="u-spacer" />
                  <Status size="sm">{p.stock}</Status>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card title="Latest orders" subtitle="The six most recent orders" flush actions={<Button size="sm" iconRight="aright" onClick={() => navigate('/orders')}>View all orders</Button>}>
        <DataTable
          rows={data.recentOrders}
          onRowClick={(o) => navigate(`/orders/${o._id}`)}
          highlight={(o) => o.status === 'New'}
          pageSize={6}
          columns={[
            { key: 'code', header: 'Order', render: (o) => <Cell title={o.code} sub={new Date(o.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })} /> },
            { key: 'customer', header: 'Customer', render: (o) => <Cell avatar={o.customer} title={o.customer} sub={o.phone} /> },
            { key: 'items', header: 'Items', render: (o) => <span className="u-small">{o.items.map((i) => `${i.name}${i.qty > 1 ? ` ×${i.qty}` : ''}`).join(', ')}</span> },
            { key: 'deliver', header: 'Delivery', render: (o) => <Cell title={o.deliver || '—'} sub={o.slot} /> },
            { key: 'amount', header: 'Amount', align: 'right', render: (o) => <b className="u-strong u-num">{money(o.amount)}</b> },
            { key: 'status', header: 'Status', shrink: true, render: (o) => <Status>{o.status}</Status> },
          ]}
        />
      </Card>
    </div>
  );
}
