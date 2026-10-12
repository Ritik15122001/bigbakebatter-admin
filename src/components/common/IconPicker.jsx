import Icon from './Icon';
import { ICON_PATHS } from '../../utils/iconPaths';

/** The storefront's green "pure veg" square-and-dot mark, drawn in CSS. */
export function VegMark() {
  return <span className="veg-mark" aria-label="Pure veg mark"><i /></span>;
}

/** Live preview of an icon name: SVG when the admin knows it, veg mark for 'veg'. */
export function IconPreview({ name }) {
  if (name === 'veg') return <VegMark />;
  if (name && ICON_PATHS[name]) return <Icon name={name} className="icon icon-sm" />;
  return <span className="icon-preview-empty" aria-hidden="true">?</span>;
}

/**
 * Icon chooser. `variant="grid"` (default) shows a wrapped grid of icon
 * buttons; `variant="select"` is a compact dropdown with a live preview (used
 * inside repeatable list cards). Pass allowVeg to offer the pure-veg mark.
 * A current value that isn't in `options` is kept and shown.
 */
export default function IconPicker({ value, onChange, options, allowVeg = false, variant = 'grid' }) {
  const names = [...(allowVeg ? ['veg'] : []), ...options];
  if (value && !names.includes(value)) names.unshift(value);

  if (variant === 'select') {
    return (
      <div className="icon-picker">
        <span className="icon-picker-preview"><IconPreview name={value} /></span>
        <select className="select" value={value || ''} onChange={(e) => onChange(e.target.value)}>
          {!value && <option value="">Choose an icon…</option>}
          {names.map((n) => (
            <option key={n} value={n}>{n === 'veg' ? 'veg (pure-veg mark)' : n}</option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="icon-grid" role="radiogroup" aria-label="Icon">
      {names.map((n) => {
        const on = value === n;
        const label = n === 'veg' ? 'Pure-veg mark' : n;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={label}
            title={label}
            className={`icon-grid-btn ${on ? 'on' : ''}`}
            onClick={() => onChange(n)}
          >
            <IconPreview name={n} />
          </button>
        );
      })}
    </div>
  );
}
