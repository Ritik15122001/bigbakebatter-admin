import { useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/common/Icon';
import { Sparkline } from './charts';
import { uploadService } from '../services/uploadService';
import { resolveImg } from '../utils/media';
import { useUiStore } from '../store/uiStore';

const cx = (...c) => c.filter(Boolean).join(' ');

/* ---------------- Buttons ---------------- */
export function Button({ variant, size, icon, iconRight, loading, block, className, children, as: As = 'button', ...rest }) {
  const iconOnly = icon && !children;
  return (
    <As
      type={As === 'button' ? rest.type || 'button' : undefined}
      className={cx('u-btn', variant, size, iconOnly && 'icon-only', block && 'block', className)}
      disabled={As === 'button' ? rest.disabled || loading : undefined}
      {...rest}
    >
      {loading ? <span className="u-spin" aria-hidden="true" /> : icon && <Icon name={icon} />}
      {children}
      {iconRight && !loading && <Icon name={iconRight} />}
    </As>
  );
}

export function IconButton({ icon, label, bordered, badge, className, ...rest }) {
  return (
    <button type="button" className={cx('u-iconbtn', bordered && 'bordered', className)} aria-label={label} title={label} {...rest}>
      <Icon name={icon} />
      {badge ? <span className="u-dot-badge">{badge > 99 ? '99+' : badge}</span> : null}
    </button>
  );
}

/* ---------------- Status / tags / avatar ---------------- */
const TONE_BY_STATUS = {
  New: 'blue', Baking: 'amber', 'Out for delivery': 'violet', Delivered: 'green', Cancelled: 'red',
  Paid: 'green', Refunded: 'amber', Failed: 'red',
  Quoted: 'violet', Closed: 'gray',
  'In stock': 'green', 'Low stock': 'amber', 'Out of stock': 'red',
  Published: 'green', Draft: 'gray', Inactive: 'gray',
  Active: 'green', Hidden: 'gray', Blocked: 'red', Expired: 'gray', Scheduled: 'blue', Live: 'green', Off: 'gray',
};
export const statusTone = (s) => TONE_BY_STATUS[s] || 'gray';

export function Status({ children, tone, size, plain }) {
  const t = tone || statusTone(children);
  return <span className={cx('u-status', `tone-${t}`, size, plain && 'plain')}>{children}</span>;
}

export function Tag({ children, icon }) {
  return <span className="u-tag">{icon && <Icon name={icon} />}{children}</span>;
}

const AVATAR_COLORS = ['#5b5bd6', '#0e9384', '#dd2590', '#e04f16', '#1570ef', '#7a5af8', '#16b364', '#ca8504'];
export function Avatar({ name = '', size, src }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';
  const color = AVATAR_COLORS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];
  if (src) return <img className={cx('u-avatar', size)} src={resolveImg(src)} alt="" style={{ objectFit: 'cover' }} />;
  return <span className={cx('u-avatar', size)} style={{ background: color }} aria-hidden="true">{initials}</span>;
}

export function Thumb({ src, size, icon = 'image' }) {
  return <span className={cx('u-thumb', size)}>{src ? <img src={resolveImg(src)} alt="" loading="lazy" /> : <Icon name={icon} />}</span>;
}

/** Two-line table/list cell: optional avatar/thumb + title + subtitle. */
export function Cell({ title, sub, avatar, thumb, children }) {
  return (
    <span className="u-cell">
      {avatar !== undefined && <Avatar name={avatar} size="sm" />}
      {thumb !== undefined && <Thumb src={thumb} />}
      <span className="u-cell-text">
        <b>{title}</b>
        {sub && <span>{sub}</span>}
      </span>
      {children}
    </span>
  );
}

/* ---------------- Page ---------------- */
export function Page({ title, description, eyebrow, back, actions, tabs, badge, children }) {
  const navigate = useNavigate();
  return (
    <div className="u-page">
      <header className="u-page-head">
        <div className="u-page-titles">
          {(back || eyebrow) && (
            <button type="button" className="u-page-eyebrow" onClick={back ? () => navigate(back) : undefined} disabled={!back}>
              {back && <Icon name="cleft" />}
              {eyebrow}
            </button>
          )}
          <h1 className="u-page-title">{title}{badge}</h1>
          {description && <p className="u-page-desc">{description}</p>}
        </div>
        {actions && <div className="u-page-actions">{actions}</div>}
      </header>
      {tabs}
      {children}
    </div>
  );
}

export function Tabs({ items, value, onChange }) {
  return (
    <div className="u-tabs" role="tablist">
      {items.map((t) => (
        <button key={t.value} role="tab" aria-selected={value === t.value} className={cx('u-tab', value === t.value && 'on')} onClick={() => onChange(t.value)}>
          {t.icon && <Icon name={t.icon} />}
          {t.label}
          {t.count !== undefined && t.count !== null && <span className="u-tab-count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Segmented({ items, value, onChange }) {
  return (
    <div className="u-seg" role="tablist">
      {items.map((t) => (
        <button key={t.value} type="button" className={value === t.value ? 'on' : ''} onClick={() => onChange(t.value)}>
          {t.label}
          {t.count !== undefined && <span>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* ---------------- Card ---------------- */
export function Card({ title, subtitle, icon, actions, children, footer, flush, bordered, onClick, className, style }) {
  return (
    <section className={cx('u-card', onClick && 'interactive', className)} onClick={onClick} style={style}>
      {(title || actions) && (
        <div className={cx('u-card-head', bordered && 'bordered')}>
          <div style={{ minWidth: 0 }}>
            {title && <h3 className="u-card-title">{icon && <Icon name={icon} />}{title}</h3>}
            {subtitle && <p className="u-card-sub">{subtitle}</p>}
          </div>
          {actions && <div className="u-row">{actions}</div>}
        </div>
      )}
      <div className={cx('u-card-body', flush && 'flush')}>{children}</div>
      {footer && <div className="u-card-foot">{footer}</div>}
    </section>
  );
}

/* ---------------- Stat ---------------- */
export function Delta({ value, suffix = '%' }) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const dir = value > 0.5 ? 'up' : value < -0.5 ? 'down' : 'flat';
  return (
    <span className={cx('u-delta', dir)}>
      <Icon name={dir === 'down' ? 'trenddown' : 'trend'} />
      {Math.abs(Math.round(value))}{suffix}
    </span>
  );
}

export function Stat({ label, value, icon, tone = 'brand', delta, note, trend, onClick }) {
  return (
    <Card onClick={onClick} className="u-stat-card">
      <div className="u-stat" style={{ padding: 0 }}>
        <div className="u-stat-top">
          {icon && <span className={cx('u-stat-ico', `tone-${tone}`)}><Icon name={icon} /></span>}
          <span className="u-stat-label">{label}</span>
        </div>
        <div className="u-stat-row">
          <span className="u-stat-value">{value}</span>
          {trend && trend.length > 1 && <Sparkline values={trend} tone={tone} />}
        </div>
        {(delta !== undefined || note) && (
          <div className="u-stat-meta">
            <Delta value={delta} />
            {note && <span>{note}</span>}
          </div>
        )}
      </div>
    </Card>
  );
}

/* ---------------- Feedback ---------------- */
export function EmptyState({ icon = 'inbox', title, children, actions }) {
  return (
    <div className="u-empty">
      <span className="u-empty-ico"><Icon name={icon} /></span>
      {title && <h3>{title}</h3>}
      {children && <p>{children}</p>}
      {actions && <div className="u-row">{actions}</div>}
    </div>
  );
}

export function Skeleton({ width = '100%', height = 14, style }) {
  return <span className="u-skel" style={{ width, height, ...style }} />;
}

export function Spinner() {
  return <span className="u-spin" aria-label="Loading" />;
}

export function Alert({ tone = 'blue', icon = 'info', title, children }) {
  return (
    <div className={cx('u-alert', `tone-${tone}`)}>
      <Icon name={icon} />
      <div>{title && <b>{title}</b>}{children}</div>
    </div>
  );
}

/** Full-card loading / error wrapper for page data. */
export function Loader({ loading, error, onRetry, children, rows = 4 }) {
  if (error) {
    return (
      <Card>
        <EmptyState icon="alert" title="Couldn't load this" actions={onRetry && <Button icon="refresh" onClick={onRetry}>Try again</Button>}>{error}</EmptyState>
      </Card>
    );
  }
  if (loading) {
    return (
      <Card>
        <div className="u-stack tight">
          {Array.from({ length: rows }, (_, i) => <Skeleton key={i} height={18} width={`${90 - i * 12}%`} />)}
        </div>
      </Card>
    );
  }
  return children;
}

/* ---------------- Data display ---------------- */
export function KeyValue({ items, stacked }) {
  return (
    <dl className={cx('u-kv', stacked && 'stacked')}>
      {items.filter(Boolean).map(([k, v]) => [<dt key={`k${k}`}>{k}</dt>, <dd key={`v${k}`}>{v ?? '—'}</dd>])}
    </dl>
  );
}

export function Timeline({ items }) {
  return (
    <ol className="u-timeline">
      {items.map((it, i) => (
        <li className="u-tl-item" key={i}>
          <span className={cx('u-tl-dot', `tone-${it.tone || 'gray'}`)}><Icon name={it.icon || 'check'} /></span>
          <div className="u-tl-body">
            <b>{it.title}</b>
            {it.meta && <span>{it.meta}</span>}
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ---------------- Forms ---------------- */
export function Field({ label, hint, error, required, children, className }) {
  const id = useId();
  const child = typeof children === 'function' ? children(id) : children;
  return (
    <div className={cx('u-field', className)}>
      {label && <label className="u-label" htmlFor={id}>{label}{required && <span className="req">*</span>}</label>}
      {child}
      {error ? <span className="u-error">{error}</span> : hint ? <span className="u-hint">{hint}</span> : null}
    </div>
  );
}

export function Input({ icon, suffix, prefix, error, className, ...rest }) {
  const input = <input className={cx('u-input', error && 'bad', className)} {...rest} />;
  if (prefix) return <div className="u-prefix"><span>{prefix}</span>{input}</div>;
  if (!icon && !suffix) return input;
  return (
    <div className="u-input-wrap">
      {icon && <Icon name={icon} />}
      {input}
      {suffix && <span className="u-affix">{suffix}</span>}
    </div>
  );
}

export function Textarea({ error, className, ...rest }) {
  return <textarea className={cx('u-textarea', error && 'bad', className)} {...rest} />;
}

export function Select({ options = [], error, className, placeholder, ...rest }) {
  return (
    <select className={cx('u-select', error && 'bad', className)} {...rest}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => {
        const opt = typeof o === 'object' ? o : { value: o, label: o };
        return <option key={opt.value} value={opt.value} disabled={opt.disabled}>{opt.label}</option>;
      })}
    </select>
  );
}

export function Switch({ checked, onChange, label, description, disabled }) {
  return (
    <label className="u-switch" style={disabled ? { opacity: 0.5, pointerEvents: 'none' } : undefined}>
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} />
      <span className="u-switch-track" />
      {(label || description) && (
        <span className="u-switch-text">
          {label && <b>{label}</b>}
          {description && <span>{description}</span>}
        </span>
      )}
    </label>
  );
}

export function Checkbox({ checked, onChange, label }) {
  return (
    <label className="u-check">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

/** Settings-style section: title + description on the left, fields on the right. */
export function FormSection({ title, description, children }) {
  return (
    <div className="u-form-section">
      <div className="u-form-section-head">
        <h3>{title}</h3>
        {description && <p>{description}</p>}
      </div>
      <div className="u-stack tight" style={{ gap: 16 }}>{children}</div>
    </div>
  );
}

/** Single image: preview, upload (stores relative /uploads path), paste URL, remove. */
export function ImageUpload({ value, onChange, hint = 'JPG, PNG, WebP or GIF · up to 5 MB' }) {
  const pushToast = useUiStore((s) => s.pushToast);
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const [paste, setPaste] = useState(false);
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      onChange(await uploadService.upload(file));
    } catch (err) {
      pushToast({ title: 'Upload failed', subtitle: err.message, kind: 'err' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="u-stack tight">
      <div className="u-upload">
        {value && (
          <span className="u-upload-preview">
            <img src={resolveImg(value)} alt="" />
            <button type="button" aria-label="Remove image" onClick={() => onChange('')}><Icon name="x" /></button>
          </span>
        )}
        <button type="button" className="u-upload-drop" onClick={() => ref.current?.click()} disabled={busy}>
          {busy ? <span className="u-spin" /> : <Icon name="upload" />}
          <span><b>{busy ? 'Uploading…' : value ? 'Replace image' : 'Click to upload'}</b></span>
          <span className="u-xs">{hint}</span>
        </button>
        <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={onFile} />
      </div>
      {paste ? (
        <Input placeholder="https://…" defaultValue={/^https?:/.test(value || '') ? value : ''} onBlur={(e) => e.target.value && onChange(e.target.value.trim())} autoFocus />
      ) : (
        <button type="button" className="u-link u-small" onClick={() => setPaste(true)}>or paste an image URL</button>
      )}
    </div>
  );
}
