import ResourceManager from '../components/common/ResourceManager';
import { couponService } from '../services/catalogService';
import { money, fmtDate } from '../utils/format';

const FIELDS = [
  {
    key: 'code', label: 'Code', required: true, placeholder: 'e.g. FIRST20',
    hint: 'Letters, numbers, - and _ only. Customers type this at checkout (not case sensitive).',
    format: (v) => String(v || '').toUpperCase().replace(/\s+/g, ''),
  },
  { key: 'pct', label: '% off', type: 'number', required: true, min: 1, max: 100, step: 1, placeholder: 'e.g. 20' },
  { key: 'description', label: 'Description (optional)', span2: true, placeholder: 'e.g. 20% off your first order', hint: 'Internal note / shown with the code where relevant. Max 200 characters.' },
  { key: 'minSubtotal', label: 'Minimum order (₹)', type: 'number', step: 1, placeholder: '0', hint: '0 = no minimum.' },
  { key: 'expiresAt', label: 'Expires on (optional)', type: 'date', hint: 'Valid until the end of this day. Leave blank for no expiry.' },
  { key: 'firstOrderOnly', label: 'Who can use it', type: 'bool', checkLabel: 'First order only' },
  { key: 'active', label: 'Status', type: 'bool', checkLabel: 'Active (can be used)' },
];

/** A 1970 date is how the API stores a cleared expiry when sent null — treat it as no expiry. */
const hasExpiry = (c) => c.expiresAt && new Date(c.expiresAt).getFullYear() >= 2000;
const isExpired = (c) => hasExpiry(c) && new Date(c.expiresAt).getTime() < Date.now();

const COLUMNS = [
  { label: 'Code', render: (c) => <><span className="cell-main dv-mono" style={{ fontSize: '0.9em' }}>{c.code}</span>{c.description && <span className="cell-sub">{c.description}</span>}</> },
  { label: 'Discount', render: (c) => `${c.pct}% off` },
  { label: 'Rules', render: (c) => [c.minSubtotal > 0 ? `Min ${money(c.minSubtotal)}` : null, c.firstOrderOnly ? 'First order only' : null].filter(Boolean).join(' · ') || 'Anyone' },
  { label: 'Expires', render: (c) => (hasExpiry(c) ? fmtDate(c.expiresAt) : 'Never') },
  {
    label: 'Status',
    render: (c) => {
      if (!c.active) return <span className="badge neutral">Inactive</span>;
      if (isExpired(c)) return <span className="badge warn">Expired</span>;
      return <span className="badge success">Active</span>;
    },
  },
];

const byCode = (a, b) => a.code.localeCompare(b.code);

const validate = (p) => {
  if (!/^[A-Z0-9_-]{3,30}$/.test(p.code)) return 'Code must be 3–30 letters, numbers, - or _';
  if (!(p.pct >= 1 && p.pct <= 100)) return '% off must be between 1 and 100';
  if (p.minSubtotal < 0) return 'Minimum order cannot be negative';
  if (p.description.length > 200) return 'Description must be 200 characters or fewer';
  return null;
};

export default function Coupons() {
  return (
    <ResourceManager
      noun="Coupon"
      service={couponService}
      fields={FIELDS}
      columns={COLUMNS}
      newItem={{ pct: 10, minSubtotal: 0, active: true, firstOrderOnly: false, expiresAt: '' }}
      sortBy={byCode}
      validate={validate}
      intro="Promo codes customers can apply at checkout. The discount is checked and applied by the server, so a code only works while it is active and not expired."
      empty="No coupons yet. Add one to offer a promo code at checkout."
    />
  );
}
