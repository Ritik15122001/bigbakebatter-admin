/**
 * Kit extension used by the sales pages (owner: "sales" agent).
 * - FilterBar: the DataTable toolbar look, driven by useTableFilters() so pages own the filtered rows
 *   (needed for rich CSV exports and filter-aware stats).
 * - ContactButtons, CopyValue, OrderStepper.
 */
import Icon from '../components/common/Icon';
import { Button, Input, Select, EmptyState, IconButton } from './core';
import { telHref, waHref, mailHref, copyText } from './ext-sales-utils';
import './ext-sales.css';

export function FilterBar({ f, filters = [], placeholder = 'Search…', extra, actions, onExport, exportDisabled }) {
  return (
    <div className="u-dt-toolbar">
      <div className="u-dt-search">
        <Input icon="search" placeholder={placeholder} value={f.q} onChange={(e) => f.setQ(e.target.value)} aria-label="Search" />
      </div>
      {filters.length > 0 && (
        <div className="u-dt-filters">
          {filters.map((x) => (
            <Select key={x.key} value={f.values[x.key] || ''} onChange={(e) => f.setValue(x.key, e.target.value)} placeholder={x.label} options={x.options} aria-label={x.label} />
          ))}
        </div>
      )}
      {extra}
      {f.active > 0 && <Button variant="ghost" size="sm" onClick={f.clear}>Clear</Button>}
      <div className="u-dt-actions">
        {actions}
        {onExport && <Button size="sm" icon="download" onClick={onExport} disabled={exportDisabled}>Export</Button>}
      </div>
    </div>
  );
}

/** Empty state for a pre-filtered table: explains the section when there is no data at all, else "no results". */
export function TableEmpty({ total, f, icon, title, children, actions }) {
  if (total === 0) return <EmptyState icon={icon} title={title} actions={actions}>{children}</EmptyState>;
  return (
    <EmptyState icon="search" title="No results" actions={<Button size="sm" onClick={f.clear}>Clear filters</Button>}>
      Nothing matches your search or filters.
    </EmptyState>
  );
}

export function ContactButtons({ phone, email, waText, subject, size = 'sm', labels = true }) {
  const tel = telHref(phone);
  const wa = waHref(phone, waText);
  const mail = mailHref(email, subject);
  return (
    <div className="u-row sales-contact">
      {tel && <Button as="a" size={size} icon="phone" href={tel}>{labels && 'Call'}</Button>}
      {wa && <Button as="a" size={size} icon="whatsapp" href={wa} target="_blank" rel="noreferrer">{labels && 'WhatsApp'}</Button>}
      {mail && <Button as="a" size={size} icon="mail" href={mail}>{labels && 'Email'}</Button>}
    </div>
  );
}

/** Monospace value with a copy button. */
export function CopyValue({ value, label = 'Copied' }) {
  if (!value) return <span className="u-faint">—</span>;
  return (
    <span className="sales-copy">
      <span className="u-mono">{value}</span>
      <IconButton icon="copy" label={`Copy ${value}`} onClick={(e) => { e.stopPropagation(); copyText(value, label); }} />
    </span>
  );
}

const STEPS = ['New', 'Baking', 'Out for delivery', 'Delivered'];
const STEP_ICON = { New: 'bag', Baking: 'cake', 'Out for delivery': 'truck', Delivered: 'check' };

export function OrderStepper({ status }) {
  const cancelled = status === 'Cancelled';
  const at = STEPS.indexOf(status);
  return (
    <ol className={`sales-steps ${cancelled ? 'cancelled' : ''}`}>
      {STEPS.map((s, i) => (
        <li key={s} className={!cancelled && i < at ? 'done' : !cancelled && i === at ? 'on' : ''}>
          <span className="sales-step-dot"><Icon name={!cancelled && i < at ? 'check' : STEP_ICON[s]} /></span>
          <span className="sales-step-label">{s}</span>
        </li>
      ))}
    </ol>
  );
}
