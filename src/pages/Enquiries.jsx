import { useMemo, useState } from 'react';
import {
  Page, Card, Stat, Button, DataTable, Drawer, Cell, Status, Tabs, Segmented, KeyValue, Timeline, Field, Input, Textarea,
  Alert, Loader, useConfirm, toast, useAsync, downloadCsv,
} from '../ui';
import { FilterBar, TableEmpty, ContactButtons, CopyValue } from '../ui/ext-sales';
import { useTableFilters, telHref, waHref, mailHref, splitCompany, iso, plural } from '../ui/ext-sales-utils';
import { enquiryService, ENQUIRY_STATUSES } from '../services/enquiryService';
import { money, fmtDateTime, fmtRelative } from '../utils/format';

const TABS = ['All', ...ENQUIRY_STATUSES];
const DAY = 86400000;
const STATUS_ICON = { New: 'inbox', Quoted: 'rupee', Closed: 'check' };

const isCorporate = (e) => !!splitCompany(e.note).company;
const searchText = (e) => [e.code, e.name, e.email, e.phone, e.occasion, e.note, e.budget, e.adminNote].join(' ');
const waText = (e) => `Hi ${e.name}, this is BigBakeBatter about your ${e.occasion} cake enquiry ${e.code}.`;
const mailSubject = (e) => `Your cake enquiry ${e.code}`;

export default function Enquiries() {
  const confirm = useConfirm();
  const { data, setData, loading, error, reload } = useAsync(enquiryService.list);
  const list = useMemo(() => data || [], [data]);
  const [tab, setTab] = useState('All');
  const [activeId, setActiveId] = useState(null);
  const active = list.find((e) => e._id === activeId) || null;

  const occasions = useMemo(() => [...new Set(list.map((e) => e.occasion).filter(Boolean))].sort(), [list]);
  const filters = [
    { key: 'occasion', label: 'All occasions', options: occasions, test: (e, v) => e.occasion === v },
    {
      key: 'type', label: 'Personal & corporate',
      options: [{ value: 'corporate', label: 'Corporate' }, { value: 'personal', label: 'Personal' }],
      test: (e, v) => (v === 'corporate') === isCorporate(e),
    },
    {
      key: 'quote', label: 'Any quote',
      options: [{ value: 'yes', label: 'Has a quote' }, { value: 'no', label: 'No quote yet' }],
      test: (e, v) => (v === 'yes') === (e.quote != null),
    },
  ];

  const inTab = useMemo(() => (tab === 'All' ? list : list.filter((e) => e.status === tab)), [list, tab]);
  const f = useTableFilters(inTab, { search: searchText, filters });

  const counts = useMemo(() => {
    const c = { All: list.length };
    ENQUIRY_STATUSES.forEach((s) => { c[s] = list.filter((e) => e.status === s).length; });
    return c;
  }, [list]);

  const stats = useMemo(() => {
    const since = new Date().getTime() - 30 * DAY;
    const quoted = list.filter((e) => e.quote != null);
    const waiting = list.filter((e) => e.status === 'New').sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    return {
      quotedValue: quoted.reduce((s, e) => s + e.quote, 0),
      quotedCount: quoted.length,
      recent: list.filter((e) => new Date(e.createdAt).getTime() >= since).length,
      corporate: list.filter(isCorporate).length,
      oldestNew: waiting[0],
    };
  }, [list]);

  const replace = (updated) => setData((prev) => (prev || []).map((e) => (e._id === updated._id ? updated : e)));

  const setStatus = async (e, status) => {
    try {
      replace(await enquiryService.updateStatus(e._id, status));
      toast.success(`Enquiry marked ${status}`, `${e.code} · ${e.name}`);
    } catch (err) {
      toast.error('Could not update enquiry', err.message);
    }
  };

  const remove = async (e) => {
    const ok = await confirm({
      title: 'Delete this enquiry?',
      message: `${e.code} from ${e.name} and your notes on it will be removed for good. The customer is not notified.`,
      confirmLabel: 'Delete', danger: true,
    });
    if (!ok) return;
    try {
      await enquiryService.remove(e._id);
      setData((prev) => (prev || []).filter((x) => x._id !== e._id));
      setActiveId((id) => (id === e._id ? null : id));
      toast.success('Enquiry deleted', e.code);
    } catch (err) {
      toast.error('Could not delete', err.message);
    }
  };

  const exportCsv = () => downloadCsv(
    tab === 'All' ? 'enquiries' : `enquiries-${tab.toLowerCase()}`,
    ['Code', 'Received', 'Status', 'Name', 'Phone', 'Email', 'Occasion', 'Company', 'Date needed', 'Guests', 'Budget', 'Quote', 'Brief', 'Internal note'],
    f.rows.map((e) => {
      const { company, brief } = splitCompany(e.note);
      return [e.code, iso(e.createdAt), e.status, e.name, e.phone, e.email, e.occasion, company, e.date, e.guests, e.budget, e.quote ?? '', brief, e.adminNote || ''];
    }),
  );

  const rowActions = (e) => [
    { label: 'Open enquiry', icon: 'eye', onClick: () => setActiveId(e._id) },
    ...ENQUIRY_STATUSES.filter((s) => s !== e.status).map((s) => ({ label: `Mark ${s}`, icon: STATUS_ICON[s], onClick: () => setStatus(e, s) })),
    { divider: true },
    telHref(e.phone) && { label: 'Call', icon: 'phone', href: telHref(e.phone) },
    waHref(e.phone) && { label: 'WhatsApp', icon: 'whatsapp', href: waHref(e.phone, waText(e)), external: true },
    e.email && { label: 'Email', icon: 'mail', href: mailHref(e.email, mailSubject(e)) },
    { divider: true },
    { label: 'Delete', icon: 'trash', danger: true, onClick: () => remove(e) },
  ];

  return (
    <Page
      title="Enquiries"
      description="Custom and corporate cake requests sent from the website. Reply to the customer, record your quote and keep track of where each one stands."
    >
      <Loader loading={loading && !data} error={!data ? error : ''} onRetry={reload} rows={6}>
        {data && (
          <div className="u-stack">
            <div className="u-grid cols-4">
              <Stat
                label="Awaiting reply" icon="inbox" tone="blue" value={counts.New} onClick={() => setTab('New')}
                note={stats.oldestNew ? `Oldest from ${fmtRelative(stats.oldestNew.createdAt)}` : 'All caught up'}
              />
              <Stat
                label="Quoted" icon="rupee" tone="violet" value={counts.Quoted} onClick={() => setTab('Quoted')}
                note={stats.quotedCount ? `${money(stats.quotedValue)} quoted across ${plural(stats.quotedCount, 'request')}` : 'No quotes recorded yet'}
              />
              <Stat
                label="Closed" icon="check" tone="green" value={counts.Closed} onClick={() => setTab('Closed')}
                note={list.length ? `${Math.round((counts.Closed / list.length) * 100)}% of all enquiries` : 'None yet'}
              />
              <Stat label="Last 30 days" icon="cal" tone="amber" value={stats.recent} note={`${stats.corporate} corporate all-time`} />
            </div>

            <Card flush>
              <Tabs items={TABS.map((t) => ({ value: t, label: t === 'All' ? 'All enquiries' : t, count: counts[t] ?? 0 }))} value={tab} onChange={setTab} />
              <FilterBar f={f} filters={filters} placeholder="Search code, name, phone, email, brief…" onExport={exportCsv} exportDisabled={!f.rows.length} />
              <DataTable
                rows={f.rows}
                onRowClick={(e) => setActiveId(e._id)}
                highlight={(e) => e.status === 'New'}
                rowActions={rowActions}
                pageSize={15}
                initialSort={{ key: 'createdAt', dir: 'desc' }}
                empty={
                  <TableEmpty total={inTab.length} f={f} icon="msg" title={tab === 'All' ? 'No enquiries yet' : `No ${tab.toLowerCase()} enquiries`}>
                    {tab === 'All'
                      ? 'When someone fills in the custom cake or corporate order form on the website, their request lands here.'
                      : 'Enquiries move into this tab as you update their status.'}
                  </TableEmpty>
                }
                columns={[
                  {
                    key: 'createdAt', header: 'Enquiry', sortable: true, sortValue: (e) => new Date(e.createdAt).getTime(),
                    render: (e) => <Cell title={e.code} sub={fmtRelative(e.createdAt)} />,
                  },
                  { key: 'name', header: 'Customer', sortable: true, render: (e) => <Cell avatar={e.name} title={e.name} sub={e.phone} /> },
                  {
                    key: 'occasion', header: 'Occasion', sortable: true,
                    render: (e) => <Cell title={e.occasion} sub={splitCompany(e.note).company || (e.guests ? `${e.guests} guests` : undefined)} />,
                  },
                  { key: 'date', header: 'Needed by', render: (e) => e.date || <span className="u-muted">Not given</span> },
                  { key: 'budget', header: 'Budget', render: (e) => e.budget || <span className="u-muted">—</span> },
                  {
                    key: 'quote', header: 'Quote', align: 'right', sortable: true, sortValue: (e) => e.quote ?? -1,
                    render: (e) => (e.quote != null ? <span className="u-num u-strong">{money(e.quote)}</span> : <span className="u-muted">—</span>),
                  },
                  { key: 'status', header: 'Status', shrink: true, render: (e) => <Status>{e.status}</Status> },
                ]}
              />
            </Card>
          </div>
        )}
      </Loader>

      {active && <EnquiryDrawer key={active._id} enquiry={active} onClose={() => setActiveId(null)} onSaved={replace} onDelete={remove} />}
    </Page>
  );
}

const draftOf = (e) => ({ status: e.status, quote: e.quote == null ? '' : String(e.quote), adminNote: e.adminNote || '' });

function EnquiryDrawer({ enquiry: e, onClose, onSaved, onDelete }) {
  const confirm = useConfirm();
  const [form, setForm] = useState(() => draftOf(e));
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(draftOf(e));
  const { company, brief } = splitCompany(e.note);
  const set = (k) => (ev) => setForm((p) => ({ ...p, [k]: ev.target.value }));

  const quoteNum = form.quote.trim() === '' ? null : Number(form.quote);
  const quoteError = quoteNum != null && !(quoteNum >= 0) ? 'Enter an amount in rupees' : '';
  const noteError = form.adminNote.length > 2000 ? 'Keep it under 2000 characters' : '';

  const close = async () => {
    if (dirty && !(await confirm({ title: 'Discard changes?', message: 'Your edits to the status, quote or note have not been saved.', confirmLabel: 'Discard', danger: true }))) return;
    onClose();
  };

  const save = async () => {
    if (quoteError || noteError) return;
    setSaving(true);
    try {
      const updated = await enquiryService.update(e._id, { status: form.status, quote: quoteNum, adminNote: form.adminNote });
      onSaved(updated);
      setForm(draftOf(updated));
      toast.success('Enquiry saved', `${e.code} · ${updated.status}`);
    } catch (err) {
      toast.error('Could not save', err.message);
    } finally {
      setSaving(false);
    }
  };

  const history = [
    { title: 'Enquiry received', meta: fmtDateTime(e.createdAt), icon: 'inbox', tone: 'blue' },
    e.updatedAt && e.updatedAt !== e.createdAt && {
      title: `Last updated · now ${e.status}`, meta: fmtDateTime(e.updatedAt), icon: STATUS_ICON[e.status] || 'edit', tone: e.status === 'Closed' ? 'green' : 'violet',
    },
  ].filter(Boolean);

  return (
    <Drawer
      open
      onClose={close}
      title={e.code}
      description={`${e.occasion}${company ? ` · ${company}` : ''} · received ${fmtRelative(e.createdAt)}`}
      footer={
        <>
          <Button variant="ghost" icon="trash" onClick={() => onDelete(e)} disabled={saving}>Delete</Button>
          <span className="u-spacer" />
          {dirty && <span className="u-small u-muted">Unsaved changes</span>}
          <Button onClick={close} disabled={saving}>Close</Button>
          <Button variant="primary" icon="check" onClick={save} loading={saving} disabled={!dirty || !!quoteError || !!noteError}>Save</Button>
        </>
      }
    >
      <div className="u-stack">
        <Card title={e.name} subtitle={e.user ? 'Signed-in customer' : 'Sent as a guest'} icon="user" actions={<Status>{e.status}</Status>}>
          <div className="u-stack tight">
            <KeyValue items={[
              ['Phone', <CopyValue key="p" value={e.phone} label="Phone copied" />],
              ['Email', <CopyValue key="m" value={e.email} label="Email copied" />],
            ]} />
            <ContactButtons phone={e.phone} email={e.email} waText={waText(e)} subject={mailSubject(e)} />
          </div>
        </Card>

        <Card title="What they asked for" icon="cake">
          <div className="u-stack tight">
            <KeyValue items={[
              ['Occasion', e.occasion],
              company && ['Company', company],
              ['Date needed', e.date || 'Not given'],
              ['Guests', e.guests || 'Not given'],
              ['Budget', e.budget || 'Not given'],
              ['Reference images', e.files ? `${e.files} mentioned` : 'None'],
            ]} />
            {brief
              ? <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{brief}</p>
              : <p className="u-muted u-small" style={{ margin: 0 }}>No brief was written.</p>}
            {e.files > 0 && (
              <Alert tone="amber" icon="image" title="Reference images aren't attached">
                The customer said they have {plural(e.files, 'image')} to share. Ask them to send it on WhatsApp or email.
              </Alert>
            )}
          </div>
        </Card>

        <Card title="Your response" subtitle="Internal only — the customer never sees the quote or note recorded here." icon="edit">
          <div className="u-stack tight" style={{ gap: 16 }}>
            <Field label="Status">
              <Segmented items={ENQUIRY_STATUSES.map((s) => ({ value: s, label: s }))} value={form.status} onChange={(status) => setForm((p) => ({ ...p, status }))} />
            </Field>
            <Field
              label="Quoted price" error={quoteError}
              hint={quoteNum != null && form.status === 'New' ? 'Tip: switch the status to Quoted once you have sent this price.' : 'What you quoted the customer, in rupees. Leave empty if not quoted yet.'}
            >
              {(id) => <Input id={id} prefix="₹" type="number" min="0" inputMode="numeric" value={form.quote} error={quoteError} onChange={set('quote')} placeholder="e.g. 2500" />}
            </Field>
            <Field label="Internal note" error={noteError} hint={`Design ideas, follow-ups, what was agreed · ${form.adminNote.length}/2000`}>
              {(id) => <Textarea id={id} rows={4} value={form.adminNote} error={noteError} onChange={set('adminNote')} />}
            </Field>
          </div>
        </Card>

        <Card title="History" icon="clock">
          <Timeline items={history} />
        </Card>
      </div>
    </Drawer>
  );
}
