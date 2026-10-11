import { useEffect, useMemo, useState } from 'react';
import ResourceManager from '../components/common/ResourceManager';
import { flavourService, occasionService, addonService, faqService, reviewService, categoryService } from '../services/catalogService';
import { money } from '../utils/format';

const ADDON_CATS = [
  { value: 'popular', label: 'Popular' }, { value: 'toppers', label: 'Cake Toppers' }, { value: 'candles', label: 'Candles' },
  { value: 'party', label: 'Party Essentials' }, { value: 'chocolates', label: 'Chocolates' }, { value: 'more', label: 'More Addons' },
];

const swatch = (c) => <span style={{ display: 'inline-block', width: 16, height: 16, borderRadius: 4, background: c, verticalAlign: 'middle', marginRight: 8 }} />;
const thumb = (src) => (src ? <img src={src} alt="" style={{ width: 48, height: 36, objectFit: 'cover', borderRadius: 6 }} /> : '—');

function tabs(categoryNames) {
  return {
    flavours: {
      label: 'Flavours', noun: 'Flavour', service: flavourService, sortBy: (a, b) => a.name.localeCompare(b.name),
      newItem: { col: '#E4CBA1' },
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
      label: 'Occasions', noun: 'Occasion', service: occasionService, sortBy: (a, b) => a.name.localeCompare(b.name),
      newItem: { cat: categoryNames[0] || '' },
      fields: [
        { key: 'name', label: 'Name', required: true },
        { key: 'cat', label: 'Links to category', type: 'select', options: ['', ...categoryNames] },
        { key: 'blurb', label: 'Short blurb', type: 'textarea' },
        { key: 'img', label: 'Photo', type: 'image' },
      ],
      columns: [
        { label: 'Photo', render: (o) => thumb(o.img) },
        { label: 'Occasion', render: (o) => <span className="cell-main">{o.name}</span> },
        { label: 'Category', render: (o) => o.cat || '—' },
        { label: 'Blurb', render: (o) => o.blurb },
      ],
    },
    addons: {
      label: 'Add-ons', noun: 'Add-on', service: addonService, sortBy: (a, b) => a.name.localeCompare(b.name),
      newItem: { cat: 'more' },
      fields: [
        { key: 'name', label: 'Name', required: true },
        { key: 'price', label: 'Price (₹)', type: 'number', required: true },
        { key: 'unit', label: 'Unit (optional)', placeholder: 'e.g. per candle' },
        { key: 'cat', label: 'Group', type: 'select', options: ADDON_CATS },
        { key: 'popular', label: 'Featured', type: 'bool', checkLabel: 'Show under "Popular"' },
        { key: 'img', label: 'Photo', type: 'image' },
      ],
      columns: [
        { label: 'Photo', render: (a) => thumb(a.img) },
        { label: 'Add-on', render: (a) => <span className="cell-main">{a.name}</span> },
        { label: 'Price', render: (a) => `${money(a.price)}${a.unit ? ` · ${a.unit}` : ''}` },
        { label: 'Group', render: (a) => ADDON_CATS.find((c) => c.value === a.cat)?.label || a.cat },
        { label: 'Popular', render: (a) => (a.popular ? 'Yes' : '') },
      ],
    },
    faqs: {
      label: 'FAQs', noun: 'FAQ', service: faqService, sortBy: (a, b) => a.order - b.order,
      fields: [
        { key: 'q', label: 'Question', required: true, span2: true },
        { key: 'a', label: 'Answer', type: 'textarea', required: true },
        { key: 'order', label: 'Position', type: 'number', hint: 'Lower numbers show first.' },
      ],
      columns: [
        { label: '#', render: (f) => f.order },
        { label: 'Question', render: (f) => <span className="cell-main">{f.q}</span> },
        { label: 'Answer', render: (f) => (f.a.length > 90 ? `${f.a.slice(0, 90)}…` : f.a) },
      ],
    },
    reviews: {
      label: 'Reviews', noun: 'Review', service: reviewService, sortBy: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
      newItem: { rating: 5 },
      fields: [
        { key: 'name', label: 'Customer name', required: true },
        { key: 'occ', label: 'Occasion', placeholder: 'e.g. Birthday' },
        { key: 'rating', label: 'Rating (1–5)', type: 'select', options: [5, 4, 3, 2, 1].map(String) },
        { key: 'text', label: 'Review', type: 'textarea', required: true },
      ],
      columns: [
        { label: 'Customer', render: (r) => <><span className="cell-main">{r.name}</span><span className="cell-sub">{r.occ}</span></> },
        { label: 'Rating', render: (r) => `${r.rating} ★` },
        { label: 'Review', render: (r) => (r.text.length > 90 ? `${r.text.slice(0, 90)}…` : r.text) },
      ],
    },
  };
}

export default function SiteContent() {
  const [tab, setTab] = useState('flavours');
  const [categoryNames, setCategoryNames] = useState([]);

  useEffect(() => {
    categoryService.list().then((cats) => setCategoryNames(cats.map((c) => c.name))).catch(() => {});
  }, []);

  const config = useMemo(() => tabs(categoryNames), [categoryNames]);
  const current = config[tab];

  return (
    <div className="stack gap-5">
      <div className="row gap-2 center" style={{ flexWrap: 'wrap' }}>
        {Object.entries(config).map(([key, c]) => (
          <button key={key} className="mini-select" style={tab === key ? { background: 'var(--c-ink)', color: '#fff' } : undefined} onClick={() => setTab(key)}>
            {c.label}
          </button>
        ))}
      </div>
      <ResourceManager key={tab + categoryNames.length} {...current} />
    </div>
  );
}
