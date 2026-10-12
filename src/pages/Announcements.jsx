import ResourceManager from '../components/common/ResourceManager';
import { IconPreview } from '../components/common/IconPicker';
import { announcementService } from '../services/catalogService';
import { BAR_ICONS } from '../utils/icons';

const validLink = (v) => !v || v.startsWith('/') || /^https?:\/\//i.test(v);

const FIELDS = [
  { key: 'text', label: 'Message', required: true, span2: true, placeholder: 'e.g. FIRST20 — 20% off your first order', hint: 'Up to 160 characters.' },
  { key: 'icon', label: 'Icon', type: 'icon', options: BAR_ICONS, allowVeg: true },
  { key: 'link', label: 'Link (optional)', placeholder: '/shop or https://…', hint: 'Where the message goes when tapped.' },
  { key: 'order', label: 'Position', type: 'number', hint: 'Lower numbers show first.' },
  { key: 'active', label: 'Show on storefront', type: 'bool', checkLabel: 'Active' },
];

const COLUMNS = [
  { label: 'Message', render: (a) => (
    <span className="row gap-2 center">
      <IconPreview name={a.icon} />
      <span className="cell-main">{a.text}</span>
    </span>
  ) },
  { label: 'Link', render: (a) => a.link || '—' },
  { label: 'Position', render: (a) => a.order },
  { label: 'Status', render: (a) => <span className={`badge ${a.active ? 'success' : 'neutral'}`}>{a.active ? 'Active' : 'Hidden'}</span> },
];

const sortByOrder = (a, b) => a.order - b.order;

const validate = (p) => {
  if (p.text.length > 160) return 'Message must be 160 characters or fewer';
  if (!validLink(p.link)) return 'Link must start with / or https://';
  return null;
};

export default function Announcements() {
  return (
    <ResourceManager
      noun="Announcement"
      service={announcementService}
      fields={FIELDS}
      columns={COLUMNS}
      newItem={{ icon: 'sparkles', active: true, order: 0 }}
      sortBy={sortByOrder}
      validate={validate}
      intro="The thin rotating bar at the very top of every storefront page. Hidden entries stay saved but are not shown."
      empty="No announcements. The top bar on the storefront stays hidden until you add one."
    />
  );
}
