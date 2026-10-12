import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ResourceManager from '../components/common/ResourceManager';
import { IconPreview } from '../components/common/IconPicker';
import {
  flavourService, occasionService, addonService, addonCategoryService, faqService, reviewService, categoryService,
} from '../services/catalogService';
import { money } from '../utils/format';
import { resolveImg } from '../utils/media';
import { ADDON_GROUP_ICONS } from '../utils/icons';

const swatch = (c) => <span style={{ display: 'inline-block', width: 16, height: 16, borderRadius: 4, background: c, verticalAlign: 'middle', marginRight: 8 }} />;
const thumb = (src) => (src ? <img src={resolveImg(src)} alt="" style={{ width: 48, height: 36, objectFit: 'cover', borderRadius: 6 }} /> : '—');
const clip = (s, n = 90) => (s && s.length > n ? `${s.slice(0, n)}…` : s);

const byName = (a, b) => a.name.localeCompare(b.name);
const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0);
const byOrderThenLabel = (a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.label).localeCompare(String(b.label));
const newestFirst = (a, b) => new Date(b.createdAt) - new Date(a.createdAt);

function tabs(categoryNames, addonGroups) {
  const groupOptions = addonGroups.map((g) => ({ value: g.key, label: g.label }));
  const groupLabel = (key) => addonGroups.find((g) => g.key === key)?.label || key || '—';
  return {
    flavours: {
      label: 'Flavours', noun: 'Flavour', service: flavourService, sortBy: byName,
      newItem: { col: '#E4CBA1' },
      intro: 'Flavour tiles on the homepage. Cakes pick their flavour from this list (free text is still allowed).',
      fields: [
        { key: 'name', label: 'Name', required: true },
        { key: 'from', label: 'Starting price (₹)', type: 'number' },
        { key: 'col', label: 'Colour', type: 'color', hint: 'Used for the flavour tile on the homepage.' },
      ],
      columns: [
        { label: 'Flavour', render: (f) => <span className="cell-main">{swatch(f.col)}{f.name}</span> },
        { label: 'From', render: (f) => money(f.from) },
      ],
    },
    occasions: {
      label: 'Occasions', noun: 'Occasion', service: occasionService, sortBy: byName,
      newItem: { cat: categoryNames[0] || '' },
      intro: 'The "Shop by occasion" photo tiles on the homepage.',
      fields: [
        { key: 'name', label: 'Name', required: true },
        { key: 'cat', label: 'Links to category', type: 'select', options: [{ value: '', label: '— None —' }, ...categoryNames.map((n) => ({ value: n, label: n }))] },
        { key: 'blurb', label: 'Short blurb', type: 'textarea' },
        { key: 'img', label: 'Photo', type: 'image' },
      ],
      columns: [
        { label: 'Photo', render: (o) => thumb(o.img) },
        { label: 'Occasion', render: (o) => <span className="cell-main">{o.name}</span> },
        { label: 'Category', render: (o) => o.cat || '—' },
        { label: 'Blurb', render: (o) => clip(o.blurb) },
      ],
    },
    addons: {
      label: 'Add-ons', noun: 'Add-on', service: addonService, sortBy: byName,
      newItem: { cat: addonGroups[0]?.key || 'more' },
      intro: 'Extras offered with a cake (toppers, candles…). Each belongs to a group — manage groups in the "Add-on groups" tab.',
      fields: [
        { key: 'name', label: 'Name', required: true },
        { key: 'price', label: 'Price (₹)', type: 'number', required: true },
        { key: 'unit', label: 'Unit (optional)', placeholder: 'e.g. per candle' },
        { key: 'cat', label: 'Group', type: 'select', options: groupOptions, hint: 'The tab it appears under in the add-ons pop-up.' },
        { key: 'popular', label: 'Featured / popular', type: 'bool', checkLabel: 'Also show under "Popular"' },
        { key: 'img', label: 'Photo', type: 'image' },
      ],
      columns: [
        { label: 'Photo', render: (a) => thumb(a.img) },
        { label: 'Add-on', render: (a) => <span className="cell-main">{a.name}</span> },
        { label: 'Price', render: (a) => `${money(a.price)}${a.unit ? ` · ${a.unit}` : ''}` },
        { label: 'Group', render: (a) => groupLabel(a.cat) },
        { label: 'Popular', render: (a) => (a.popular ? 'Yes' : '') },
      ],
    },
    addonGroups: {
      label: 'Add-on groups', noun: 'Add-on group', service: addonCategoryService, sortBy: byOrderThenLabel,
      newItem: { icon: 'gift', order: addonGroups.length },
      intro: 'Tabs in the storefront\'s add-ons pop-up. "Popular" is automatic (add-ons ticked as featured), so it is not a group here.',
      fields: [
        { key: 'label', label: 'Label', required: true, placeholder: 'e.g. Cake Toppers' },
        {
          key: 'key', label: 'Key', required: true, placeholder: 'e.g. toppers',
          hint: 'Short id stored on each add-on: lowercase letters, numbers and dashes. Changing it on an existing group un-links its add-ons.',
          format: (v) => String(v || '').toLowerCase().trim().replace(/\s+/g, '-'),
        },
        { key: 'icon', label: 'Icon', type: 'icon', options: ADDON_GROUP_ICONS },
        { key: 'order', label: 'Position', type: 'number', hint: 'Lower numbers show first.' },
      ],
      validate: (p) => (!/^[a-z0-9-]+$/.test(p.key) ? 'Key may only use lowercase letters, numbers and dashes' : p.key === 'popular' ? '"popular" is reserved for featured add-ons' : null),
      columns: [
        { label: 'Group', render: (g) => <span className="row gap-2 center"><IconPreview name={g.icon} /><span className="cell-main">{g.label}</span></span> },
        { label: 'Key', render: (g) => <span className="dv-mono">{g.key}</span> },
        { label: 'Position', render: (g) => g.order },
      ],
    },
    faqs: {
      label: 'FAQs', noun: 'FAQ', service: faqService, sortBy: byOrder,
      intro: 'Questions shown in the FAQ section.',
      fields: [
        { key: 'q', label: 'Question', required: true, span2: true },
        { key: 'a', label: 'Answer', type: 'textarea', required: true },
        { key: 'order', label: 'Position', type: 'number', hint: 'Lower numbers show first.' },
      ],
      columns: [
        { label: '#', render: (f) => f.order },
        { label: 'Question', render: (f) => <span className="cell-main">{f.q}</span> },
        { label: 'Answer', render: (f) => clip(f.a) },
      ],
    },
    reviews: {
      label: 'Reviews', noun: 'Review', service: reviewService, sortBy: newestFirst,
      newItem: { rating: '5' },
      intro: 'Customer testimonials shown on the homepage.',
      fields: [
        { key: 'name', label: 'Customer name', required: true },
        { key: 'occ', label: 'Occasion', placeholder: 'e.g. Birthday' },
        { key: 'rating', label: 'Rating (1–5)', type: 'select', options: ['5', '4', '3', '2', '1'], format: (v) => Number(v) || 5 },
        { key: 'text', label: 'Review', type: 'textarea', required: true },
      ],
      columns: [
        { label: 'Customer', render: (r) => <><span className="cell-main">{r.name}</span><span className="cell-sub">{r.occ}</span></> },
        { label: 'Rating', render: (r) => `${r.rating} ★` },
        { label: 'Review', render: (r) => clip(r.text) },
      ],
    },
  };
}

export default function SiteContent() {
  const [params, setParams] = useSearchParams();
  const [categoryNames, setCategoryNames] = useState([]);
  const [addonGroups, setAddonGroups] = useState([]);
  const [addonGroupsLoaded, setAddonGroupsLoaded] = useState(false);

  const config = useMemo(() => tabs(categoryNames, addonGroups), [categoryNames, addonGroups]);
  const tab = config[params.get('tab')] ? params.get('tab') : 'flavours';
  const current = config[tab];

  useEffect(() => {
    categoryService.list().then((cats) => setCategoryNames(cats.map((c) => c.name))).catch(() => {});
  }, []);

  // Re-read groups whenever the owner switches tabs, so a group added in the
  // "Add-on groups" tab is immediately selectable in the "Add-ons" form.
  useEffect(() => {
    let alive = true;
    addonCategoryService
      .list()
      .then((list) => alive && setAddonGroups([...list].sort(byOrderThenLabel)))
      .catch(() => {})
      .finally(() => alive && setAddonGroupsLoaded(true));
    return () => { alive = false; };
  }, [tab]);

  const setTab = (key) => setParams(key === 'flavours' ? {} : { tab: key }, { replace: true });

  // Remount the manager when the option lists it depends on change.
  const rmKey = `${tab}:${tab === 'occasions' ? categoryNames.join('|') : ''}:${tab === 'addons' || tab === 'addonGroups' ? addonGroups.map((g) => g.key).join('|') : ''}`;

  return (
    <div className="stack gap-5">
      <div className="a-tabs">
        {Object.entries(config).map(([key, c]) => (
          <button key={key} className={`mini-select ${tab === key ? 'on' : ''}`} onClick={() => setTab(key)}>
            {c.label}
          </button>
        ))}
      </div>
      {tab === 'addons' && !addonGroupsLoaded ? (
        <div className="a-panel a-empty"><p className="muted">Loading…</p></div>
      ) : (
        <ResourceManager key={rmKey} {...current} />
      )}
    </div>
  );
}
