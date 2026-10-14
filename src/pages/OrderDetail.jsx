import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/common/Icon';
import {
  Page, Card, Button, Status, Avatar, Thumb, Tag, KeyValue, Timeline, Alert, Drawer, Field, Input, Select, Textarea,
  Loader, useAsync, useConfirm, toast, statusTone,
} from '../ui';
import { ContactButtons, CopyValue, OrderStepper } from '../ui/ext-sales';
import { mapsHref, parseDeliver, deliveryBucket, plural } from '../ui/ext-sales-utils';
import { orderService, ORDER_STATUSES } from '../services/orderService';
import { productService } from '../services/productService';
import { settingsService } from '../services/settingsService';
import { money, fmtDate, fmtDateTime } from '../utils/format';

const NEXT = { New: 'Baking', Baking: 'Out for delivery', 'Out for delivery': 'Delivered' };
const NEXT_LABEL = { Baking: 'Start baking', 'Out for delivery': 'Send out for delivery', Delivered: 'Mark as delivered' };
const STATUS_ICON = { New: 'bag', Baking: 'cake', 'Out for delivery': 'truck', Delivered: 'check', Cancelled: 'ban' };

const firstImg = (p) => (Array.isArray(p?.img) ? p.img[0] : p?.img) || '';

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { data, setData, loading, error, reload } = useAsync(() => orderService.get(id), [id]);
  const [products, setProducts] = useState([]);
  const [busy, setBusy] = useState('');
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(null); // null = untouched

  useEffect(() => {
    productService.list().then(setProducts).catch(() => {});
  }, []);

  const order = data?.order;
  const txn = data?.transaction;

  const thumbFor = useMemo(() => {
    const byId = new Map(products.map((p) => [p._id, p]));
    const byName = new Map(products.map((p) => [p.name.toLowerCase(), p]));
    return (item) => firstImg(byId.get(item.pid) || byName.get(item.name.toLowerCase()));
  }, [products]);

  const setOrder = (o) => setData((d) => ({ ...d, order: o }));

  const changeStatus = async (status) => {
    if (!order || status === order.status) return;
    if (status === 'Cancelled') {
      const ok = await confirm({
        title: `Cancel order ${order.code}?`,
        message: `The order leaves the kitchen queue and the customer's tracking page will show Cancelled. This does not refund the ${money(order.amount)} they paid — mark the payment refunded in Payments and issue the refund from the Razorpay dashboard.`,
        confirmLabel: 'Cancel order', cancelLabel: 'Keep order', danger: true,
      });
      if (!ok) return;
    }
    setBusy(status);
    try {
      setOrder(await orderService.updateStatus(order._id, status));
      toast.success(`Order marked ${status}`, order.code);
    } catch (err) {
      toast.error('Could not update the status', err.message);
    } finally {
      setBusy('');
    }
  };

  const saveNote = async () => {
    setBusy('note');
    try {
      const updated = await orderService.update(order._id, { adminNote: note.trim() });
      setOrder(updated);
      setNote(null);
      toast.success('Internal note saved', order.code);
    } catch (err) {
      toast.error('Could not save the note', err.message);
    } finally {
      setBusy('');
    }
  };

  if (!order) {
    return (
      <Page title="Order" eyebrow="Orders" back="/orders">
        <Loader loading={loading} error={error} onRetry={reload} rows={8} />
      </Page>
    );
  }

  const items = order.items || [];
  const subtotal = order.subtotal ?? items.reduce((s, i) => s + (i.line || 0), 0);
  const qty = items.reduce((s, i) => s + i.qty, 0);
  // Older orders have no stored subtotal/delivery breakdown — derive the fee from the total.
  const deliveryFee = order.subtotal == null ? Math.max(0, order.amount - subtotal + (order.discount || 0)) : order.delivery || 0;
  const next = NEXT[order.status];
  const noteValue = note ?? order.adminNote ?? '';
  const noteDirty = note !== null && note.trim() !== (order.adminNote || '');
  const bucket = deliveryBucket(order.deliver);
  const deliverDate = parseDeliver(order.deliver);
  const live = !['Delivered', 'Cancelled'].includes(order.status);

  const history = order.statusHistory || [];
  const timeline = [
    { title: 'Order placed', meta: `${fmtDateTime(order.createdAt)} · ${order.user ? 'Signed-in customer' : 'Guest checkout'} · paid by ${order.pay}`, icon: 'bag', tone: 'blue' },
    ...history
      .filter((h, i) => !(i === 0 && h.status === 'New' && Math.abs(new Date(h.at) - new Date(order.createdAt)) < 120000))
      .map((h) => ({ title: `Marked ${h.status}`, meta: `${fmtDateTime(h.at)}${h.by ? ` · by ${h.by}` : ''}`, icon: STATUS_ICON[h.status] || 'check', tone: statusTone(h.status) })),
  ].reverse();
  if (txn?.status === 'Refunded' && txn.refundedAt) {
    timeline.unshift({ title: 'Payment refunded', meta: `${fmtDateTime(txn.refundedAt)} · ${money(txn.amount)}`, icon: 'rupee', tone: 'amber' });
  }

  return (
    <>
      <div className="sales-screen">
        <Page
          eyebrow="Orders"
          back="/orders"
          title={`Order ${order.code}`}
          badge={<Status>{order.status}</Status>}
          description={`Placed ${fmtDateTime(order.createdAt)} · ${plural(qty, 'item')} · ${money(order.amount)}`}
          actions={
            <>
              <Button icon="printer" onClick={() => window.print()}>Print slip</Button>
              <Button icon="edit" onClick={() => setEditing(true)}>Edit delivery</Button>
            </>
          }
        >
          <div className="u-grid main-side">
            <div className="u-stack">
              <Card title="Items" subtitle={`${plural(qty, 'item')} in this order`} flush>
                <div>
                  {items.map((it, i) => (
                    <div className="sales-item" key={`${it.name}${i}`}>
                      <Thumb src={thumbFor(it)} size="lg" icon="cake" />
                      <div className="sales-item-body">
                        <b>{it.name}</b>
                        <div className="sales-item-meta">
                          {it.weight && <Tag>{it.weight}</Tag>}
                          {it.eggless ? <Status tone="green" size="sm">Eggless</Status> : <Status tone="gray" size="sm">With egg</Status>}
                          <span className="u-small u-muted">Qty {it.qty}{it.unit ? ` × ${money(it.unit)}` : ''}</span>
                        </div>
                        {it.note && <div className="sales-item-note"><Icon name="quote" /><span>Message on cake: <b>{it.note}</b></span></div>}
                      </div>
                      <div className="sales-item-price">
                        <b className="u-num">{money(it.line)}</b>
                        {it.qty > 1 && <span className="u-xs u-muted">{money(it.unit ?? it.line / it.qty)} each</span>}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="sales-summary">
                  <KeyValue
                    items={[
                      ['Subtotal', money(subtotal)],
                      order.discount > 0 && [`Discount${order.promoCode ? ` · ${order.promoCode}` : ''}`, <span key="d" style={{ color: 'var(--u-green)' }}>−{money(order.discount)}</span>],
                      !order.discount && order.promoCode && ['Promo code', order.promoCode],
                      ['Delivery', deliveryFee > 0 ? money(deliveryFee) : 'Free'],
                      [<span key="t" className="sales-total">Total paid</span>, <span key="v" className="sales-total u-num">{money(order.amount)}</span>],
                    ]}
                  />
                </div>
              </Card>

              <div className="u-grid cols-2">
                <Card title="Delivery" icon="truck" actions={<Button size="sm" variant="ghost" icon="edit" onClick={() => setEditing(true)}>Edit</Button>}>
                  <div className="u-stack tight">
                    <KeyValue
                      items={[
                        ['Date', <span key="d">{deliverDate ? fmtDate(deliverDate) : order.deliver || '—'}{live && (bucket === 'today' || bucket === 'tomorrow') && <> <Status size="sm" tone="brand">{bucket === 'today' ? 'Today' : 'Tomorrow'}</Status></>}</span>],
                        ['Slot', order.slot || 'Any time'],
                      ]}
                    />
                    <div>
                      <div className="u-small u-muted">Address</div>
                      <div className="u-strong" style={{ overflowWrap: 'anywhere' }}>{order.addr}</div>
                      <a className="u-link u-small" href={mapsHref(order.addr)} target="_blank" rel="noreferrer">Open in Maps <Icon name="external" /></a>
                    </div>
                    <div>
                      <div className="u-small u-muted" style={{ marginBottom: 4 }}>Cake message</div>
                      {order.msg ? <div className="sales-quote">{order.msg}</div> : <span className="u-small u-faint">No message on the order</span>}
                    </div>
                    {order.notes && (
                      <div>
                        <div className="u-small u-muted" style={{ marginBottom: 4 }}>Customer's note</div>
                        <div className="sales-quote">{order.notes}</div>
                      </div>
                    )}
                  </div>
                </Card>

                <Card title="Customer" icon="user">
                  <div className="u-stack tight">
                    <div className="sales-person">
                      <Avatar name={order.customer} size="lg" />
                      <div className="sales-person-text">
                        <b>{order.customer}</b>
                        <span>{order.phone}</span>
                        <span>{order.email}</span>
                      </div>
                    </div>
                    <ContactButtons phone={order.phone} email={order.email} subject={`Your BigBakeBatter order ${order.code}`} waText={`Hi ${order.customer.split(' ')[0]}, this is BigBakeBatter about your order ${order.code}.`} />
                    {order.user ? (
                      <Button iconRight="aright" onClick={() => navigate(`/customers/${order.user}`)}>View customer profile</Button>
                    ) : (
                      <span className="u-small u-muted"><Tag icon="user">Guest checkout</Tag> No account is linked to this order.</span>
                    )}
                  </div>
                </Card>
              </div>

              <Card
                title="Payment"
                icon="rupee"
                actions={txn && <Button size="sm" iconRight="aright" onClick={() => navigate(`/transactions?q=${encodeURIComponent(txn.txnId)}&open=${txn._id}`)}>Open in Payments</Button>}
              >
                {txn ? (
                  <div className="u-stack tight">
                    {txn.status === 'Refunded' && <Alert tone="amber" icon="info" title="Refund recorded">This payment was marked refunded on {fmtDateTime(txn.refundedAt)}.</Alert>}
                    {order.status === 'Cancelled' && txn.status === 'Paid' && (
                      <Alert tone="red" icon="alert" title="Cancelled but still paid">Refund the customer from the Razorpay dashboard, then mark this payment refunded in Payments.</Alert>
                    )}
                    <KeyValue
                      items={[
                        ['Method', order.pay],
                        ['Status', <Status key="s">{txn.status}</Status>],
                        ['Amount', <b key="a" className="u-num">{money(txn.amount)}</b>],
                        ['Paid at', fmtDateTime(txn.paidAt)],
                        ['Transaction ID', <CopyValue key="t" value={txn.txnId} label="Transaction ID copied" />],
                        ['Razorpay order ID', <CopyValue key="o" value={txn.razorpayOrderId || order.razorpayOrderId} label="Razorpay order ID copied" />],
                        ['Razorpay payment ID', <CopyValue key="p" value={txn.razorpayPaymentId || order.razorpayPaymentId} label="Razorpay payment ID copied" />],
                      ]}
                    />
                  </div>
                ) : (
                  <div className="u-stack tight">
                    <Alert tone="amber" icon="alert" title="No payment record">There's no transaction linked to this order. The Razorpay references stored on the order are below.</Alert>
                    <KeyValue
                      items={[
                        ['Method', order.pay],
                        ['Razorpay order ID', <CopyValue key="o" value={order.razorpayOrderId} />],
                        ['Razorpay payment ID', <CopyValue key="p" value={order.razorpayPaymentId} />],
                      ]}
                    />
                  </div>
                )}
              </Card>
            </div>

            <div className="u-stack">
              <Card title="Status" subtitle={order.status === 'Cancelled' ? 'This order was cancelled' : next ? `Next step: ${next}` : 'This order is complete'}>
                <div className="u-stack tight" style={{ gap: 16 }}>
                  <OrderStepper status={order.status} />
                  {order.status === 'Cancelled' && <Alert tone="red" icon="ban" title="Cancelled">It no longer appears in the kitchen queue. Pick a status below to reopen it.</Alert>}
                  {next && (
                    <Button variant="primary" block icon={STATUS_ICON[next]} loading={busy === next} onClick={() => changeStatus(next)}>{NEXT_LABEL[next]}</Button>
                  )}
                  <Field label="Set status" hint="Every change is recorded in the timeline below.">
                    {(fid) => <Select id={fid} value={order.status} onChange={(e) => changeStatus(e.target.value)} options={ORDER_STATUSES} disabled={!!busy} />}
                  </Field>
                </div>
              </Card>

              <Card title="Timeline" subtitle="Status changes, newest first">
                <Timeline items={timeline} />
              </Card>

              <Card title="Internal note" subtitle="Only the team sees this — never the customer.">
                <div className="u-stack tight">
                  <Textarea rows={4} maxLength={2000} value={noteValue} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Call before delivery, gate code 4421" aria-label="Internal note" />
                  <div className="u-row between">
                    <span className="u-xs u-muted">{noteDirty ? 'Unsaved changes' : order.adminNote ? 'Saved' : 'No note yet'}</span>
                    <div className="u-row">
                      {noteDirty && <Button size="sm" variant="ghost" onClick={() => setNote(null)}>Discard</Button>}
                      <Button size="sm" variant="primary" disabled={!noteDirty} loading={busy === 'note'} onClick={saveNote}>Save note</Button>
                    </div>
                  </div>
                </div>
              </Card>

              <Card title="Actions">
                <div className="u-stack tight">
                  <Button block icon="edit" onClick={() => setEditing(true)}>Edit delivery details</Button>
                  <Button block icon="printer" onClick={() => window.print()}>Print packing slip</Button>
                  {order.status !== 'Cancelled' && (
                    <Button block variant="danger-soft" icon="ban" loading={busy === 'Cancelled'} onClick={() => changeStatus('Cancelled')}>Cancel order</Button>
                  )}
                </div>
              </Card>
            </div>
          </div>
        </Page>
        {editing && <EditDelivery open order={order} onClose={() => setEditing(false)} onSaved={(o) => { setOrder(o); setEditing(false); }} />}
      </div>
      <PackingSlip order={order} />
    </>
  );
}

const editable = (o) => ({ customer: o.customer || '', phone: o.phone || '', deliver: o.deliver || '', slot: o.slot || '', addr: o.addr || '', msg: o.msg || '' });

function EditDelivery({ open, order, onClose, onSaved }) {
  const [form, setForm] = useState(() => editable(order));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [slots, setSlots] = useState([]);

  // Mounted only while open, so the form starts from the current order each time.
  useEffect(() => {
    settingsService.get().then((s) => setSlots(s?.slots || [])).catch(() => setSlots([]));
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const original = editable(order);
  const changed = Object.keys(form).filter((k) => form[k].trim() !== original[k].trim());
  const slotOptions = [...new Set([...slots, ...(order.slot ? [order.slot] : [])])];

  const save = async () => {
    const e = {};
    if (!form.customer.trim()) e.customer = 'Enter the customer name';
    if (form.phone.replace(/\D/g, '').length < 6) e.phone = 'Enter a valid phone number';
    if (!form.deliver.trim()) e.deliver = 'Enter the delivery date';
    else if (!parseDeliver(form.deliver)) e.deliver = 'Use a date like "14 Oct 2026"';
    if (!form.addr.trim()) e.addr = 'Enter the delivery address';
    if (!form.slot.trim()) e.slot = 'Pick a delivery slot';
    if (form.msg.length > 200) e.msg = 'Keep the message under 200 characters';
    setErrors(e);
    if (Object.keys(e).length) return;
    const payload = Object.fromEntries(changed.map((k) => [k, form[k].trim()]));
    if (!Object.keys(payload).length) return onClose();
    setSaving(true);
    try {
      const updated = await orderService.update(order._id, payload);
      toast.success('Delivery details updated', order.code);
      onSaved(updated);
    } catch (err) {
      toast.error('Could not save the changes', err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Edit delivery details"
      description={`Order ${order.code} · prices and items can't be changed`}
      footer={
        <>
          {changed.length > 0 && <span className="u-xs u-muted" style={{ marginRight: 'auto' }}>{plural(changed.length, 'unsaved change')}</span>}
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saving} disabled={!changed.length} onClick={save}>Save changes</Button>
        </>
      }
    >
      <div className="u-stack">
        <div className="u-form-grid two">
          <Field label="Delivery date" required error={errors.deliver} hint="e.g. 14 Oct 2026">
            {(fid) => <Input id={fid} value={form.deliver} onChange={set('deliver')} error={errors.deliver} />}
          </Field>
          <Field label="Slot" required error={errors.slot}>
            {(fid) => <Select id={fid} value={form.slot} onChange={set('slot')} options={slotOptions} placeholder="Choose a slot" error={errors.slot} />}
          </Field>
        </div>
        <Field label="Delivery address" required error={errors.addr}>
          {(fid) => <Textarea id={fid} rows={3} value={form.addr} onChange={set('addr')} error={errors.addr} />}
        </Field>
        <div className="u-form-grid two">
          <Field label="Customer name" required error={errors.customer}>
            {(fid) => <Input id={fid} value={form.customer} onChange={set('customer')} error={errors.customer} />}
          </Field>
          <Field label="Phone" required error={errors.phone}>
            {(fid) => <Input id={fid} type="tel" value={form.phone} onChange={set('phone')} error={errors.phone} />}
          </Field>
        </div>
        <Field label="Cake message" error={errors.msg} hint={`${form.msg.length}/200 · piped on the cake`}>
          {(fid) => <Input id={fid} value={form.msg} maxLength={200} onChange={set('msg')} placeholder="Happy Birthday Aanya!" error={errors.msg} />}
        </Field>
      </div>
    </Drawer>
  );
}

function PackingSlip({ order }) {
  const items = order.items || [];
  const d = parseDeliver(order.deliver);
  return (
    <div className="sales-slip" aria-hidden="true">
      <div className="slip-head">
        <div>
          <h1>Kitchen slip · {order.code}</h1>
          <div>Placed {fmtDateTime(order.createdAt)} · Status: {order.status}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '14pt', fontWeight: 700 }}>{d ? fmtDate(d) : order.deliver}</div>
          <div>{order.slot || 'Any time'}</div>
        </div>
      </div>

      <h2>Items</h2>
      <table>
        <thead><tr><th>Qty</th><th>Item</th><th>Weight</th><th>Message on cake</th></tr></thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i}>
              <td className="slip-qty">{it.qty}×</td>
              <td>{it.name}{it.eggless && <span className="slip-tag">EGGLESS</span>}</td>
              <td>{it.weight || '—'}</td>
              <td>{it.note || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {order.msg && (
        <>
          <h2>Cake message</h2>
          <div className="slip-msg">{order.msg}</div>
        </>
      )}

      <h2>Deliver to</h2>
      <div><b>{order.customer}</b> · {order.phone}</div>
      <div>{order.addr}</div>

      {(order.notes || order.adminNote) && (
        <>
          <h2>Notes</h2>
          {order.notes && <div>Customer: {order.notes}</div>}
          {order.adminNote && <div>Team: {order.adminNote}</div>}
        </>
      )}
      <p style={{ marginTop: '18pt', fontSize: '9pt' }}>Printed {fmtDateTime(new Date())} · BigBakeBatter</p>
    </div>
  );
}

