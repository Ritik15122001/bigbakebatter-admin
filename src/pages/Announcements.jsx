import ResourceManager from '../components/common/ResourceManager';
import Icon from '../components/common/Icon';
import { announcementService } from '../services/catalogService';

export const BAR_ICONS = ['sparkles', 'percent', 'truck', 'gift', 'star', 'heart', 'clock', 'phone', 'cake', 'party', 'leaf'];

const FIELDS = [
  { key: 'text', label: 'Message', required: true, span2: true, placeholder: 'e.g. FIRST20 — 20% off your first order' },
  {
    key: 'icon', label: 'Icon', type: 'select',
    options: [{ value: 'veg', label: 'Pure-veg mark' }, ...BAR_ICONS.map((i) => ({ value: i, label: i }))],
  },
  { key: 'link', label: 'Link (optional)', placeholder: '/shop' },
  { key: 'order', label: 'Position', type: 'number', hint: 'Lower numbers show first.' },
  { key: 'active', label: 'Show on storefront', type: 'bool', checkLabel: 'Active' },
];

const COLUMNS = [
  { label: 'Message', render: (a) => (
    <span className="row gap-2 center">
      {a.icon !== 'veg' && <Icon name={a.icon} className="icon icon-sm" />}
      <span className="cell-main">{a.text}</span>
    </span>
  ) },
  { label: 'Link', render: (a) => a.link || '—' },
  { label: 'Position', render: (a) => a.order },
  { label: 'Status', render: (a) => <span className={`badge ${a.active ? 'success' : 'neutral'}`}>{a.active ? 'Active' : 'Hidden'}</span> },
];

export default function Announcements() {
  return (
    <ResourceManager
      noun="Announcement"
      service={announcementService}
      fields={FIELDS}
      columns={COLUMNS}
      newItem={{ icon: 'sparkles', active: true }}
      sortBy={(a, b) => a.order - b.order}
      empty="No announcements. The top bar on the storefront stays hidden until you add one."
    />
  );
}
