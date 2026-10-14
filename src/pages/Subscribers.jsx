import { useMemo } from 'react';
import {
  Page, Card, Stat, Button, DataTable, Cell, AreaChart, EmptyState, Loader, useConfirm, toast, useAsync, downloadCsv,
} from '../ui';
import { copyText } from '../ui/ext-web-utils';
import { adminService } from '../services/adminService';
import { fmtDate, fmtDateShort, fmtDateTime, fmtRelative } from '../utils/format';

const DAY = 86400000;
const domainOf = (email) => email.split('@')[1] || '';

export default function Subscribers() {
  const confirm = useConfirm();
  const { data, setData, loading, error, reload } = useAsync(adminService.listSubscribers);
  const list = useMemo(() => data || [], [data]);

  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
    const t = (s) => new Date(s.createdAt).getTime();
    const thisMonth = list.filter((s) => t(s) >= monthStart).length;
    const lastMonth = list.filter((s) => t(s) >= prevStart && t(s) < monthStart).length;
    const last7 = list.filter((s) => t(s) >= Date.now() - 7 * DAY).length;
    // Daily sign-ups for the last 30 days.
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29).getTime();
    const series = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(start + i * DAY);
      const next = d.getTime() + DAY;
      return { label: fmtDateShort(d), value: list.filter((s) => t(s) >= d.getTime() && t(s) < next).length };
    });
    const domains = {};
    list.forEach((s) => { const d = domainOf(s.email); domains[d] = (domains[d] || 0) + 1; });
    const topDomain = Object.entries(domains).sort((a, b) => b[1] - a[1])[0];
    return { thisMonth, lastMonth, last7, series, domains: Object.keys(domains).sort(), topDomain };
  }, [list]);

  const copyAll = async (rows = list) => {
    const text = rows.map((s) => s.email).join(', ');
    if (await copyText(text)) toast.success(`${rows.length} email${rows.length === 1 ? '' : 's'} copied`, 'Paste them into the BCC field of your email.');
    else toast.error('Could not copy to the clipboard');
  };

  const copyOne = async (s) => {
    if (await copyText(s.email)) toast.success('Email copied', s.email);
    else toast.error('Could not copy to the clipboard');
  };

  const remove = async (s) => {
    const ok = await confirm({
      title: 'Remove this subscriber?',
      message: `${s.email} will stop receiving newsletters. They can sign up again from the website at any time.`,
      confirmLabel: 'Remove', danger: true,
    });
    if (!ok) return;
    try {
      await adminService.removeSubscriber(s._id);
      setData((prev) => (prev || []).filter((x) => x._id !== s._id));
      toast.success('Subscriber removed', s.email);
    } catch (e) {
      toast.error('Could not remove', e.message);
    }
  };

  const exportAll = () => downloadCsv('subscribers', ['Email', 'Subscribed'], list.map((s) => [s.email, fmtDateTime(s.createdAt)]));

  return (
    <Page
      title="Subscribers"
      description="People who signed up for the newsletter on the website. Copy their emails into your mail tool to send offers and news."
      actions={
        <>
          <Button icon="download" onClick={exportAll} disabled={!list.length}>Export all</Button>
          <Button variant="primary" icon="copy" onClick={() => copyAll()} disabled={!list.length}>Copy all emails</Button>
        </>
      }
    >
      <Loader loading={loading && !data} error={!data ? error : ''} onRetry={reload} rows={6}>
        {data && (
          <div className="u-stack">
            <div className="u-grid cols-4">
              <Stat label="Total subscribers" icon="mail" tone="brand" value={list.length} note={list[0] ? `Latest ${fmtRelative(list[0].createdAt)}` : 'No sign-ups yet'} />
              <Stat
                label="New this month" icon="trend" tone="green" value={stats.thisMonth}
                delta={stats.lastMonth ? ((stats.thisMonth - stats.lastMonth) / stats.lastMonth) * 100 : undefined}
                note={`${stats.lastMonth} last month`} trend={stats.series.map((d) => d.value)}
              />
              <Stat label="Last 7 days" icon="cal" tone="blue" value={stats.last7} note="new sign-ups" />
              <Stat label="Top email provider" icon="users" tone="violet" value={stats.topDomain ? stats.topDomain[0] : '—'} note={stats.topDomain ? `${stats.topDomain[1]} of ${list.length} subscribers` : ''} />
            </div>

            {list.length > 0 && (
              <Card title="Sign-ups" subtitle="New subscribers per day · last 30 days">
                <AreaChart height={180} data={stats.series} format={(v) => `${v} sign-up${v === 1 ? '' : 's'}`} tone="green" />
              </Card>
            )}

            <Card flush>
              <DataTable
                rows={list}
                exportName="subscribers"
                initialSort={{ key: 'createdAt', dir: 'desc' }}
                onRowClick={copyOne}
                search={{ placeholder: 'Search emails…', fields: ['email'] }}
                filters={[
                  {
                    key: 'when', label: 'Any time',
                    options: [{ value: '7', label: 'Last 7 days' }, { value: '30', label: 'Last 30 days' }, { value: '90', label: 'Last 90 days' }],
                    test: (s, v) => new Date(s.createdAt).getTime() >= Date.now() - Number(v) * DAY,
                  },
                  { key: 'domain', label: 'All providers', options: stats.domains, test: (s, v) => domainOf(s.email) === v },
                ]}
                empty={
                  <EmptyState icon="mail" title="No subscribers yet">
                    When visitors join the newsletter from the website footer or homepage, their emails appear here.
                  </EmptyState>
                }
                columns={[
                  { key: 'email', header: 'Email', sortable: true, render: (s) => <Cell avatar={s.email} title={s.email} sub={domainOf(s.email)} /> },
                  {
                    key: 'createdAt', header: 'Subscribed', sortable: true, sortValue: (s) => new Date(s.createdAt).getTime(), csv: (s) => fmtDateTime(s.createdAt),
                    render: (s) => <Cell title={fmtDate(s.createdAt)} sub={fmtRelative(s.createdAt)} />,
                  },
                ]}
                rowActions={(s) => [
                  { label: 'Copy email', icon: 'copy', onClick: () => copyOne(s) },
                  { label: 'Send an email', icon: 'mail', href: `mailto:${s.email}` },
                  { divider: true },
                  { label: 'Remove', icon: 'trash', danger: true, onClick: () => remove(s) },
                ]}
              />
            </Card>
          </div>
        )}
      </Loader>
    </Page>
  );
}
