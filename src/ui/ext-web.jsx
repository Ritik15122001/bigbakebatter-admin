/**
 * Kit extensions used by the Website / Settings / Team pages (agent "web").
 * Same conventions as the core kit: plain components, `w-*` classes in ext-web.css.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../components/common/Icon';
import { ICON_PATHS } from '../utils/iconPaths';
import { PICKABLE_ICONS } from '../utils/icons';
import { Button, Input } from './core';
import './ext-web.css';
import { iconLabel, passwordStrength } from './ext-web-utils';

const cx = (...c) => c.filter(Boolean).join(' ');

/* ---------------- Icons ---------------- */

/** The storefront's green "pure veg" square-and-dot mark. */
export function VegMark({ size = 16 }) {
  return <span className="w-veg" style={{ width: size, height: size }} aria-label="Pure-veg mark"><i /></span>;
}

/** Renders a storefront icon name (incl. 'veg'); unknown names show a "?" chip. */
export function StoreIcon({ name, size }) {
  if (name === 'veg') return <VegMark size={size || 16} />;
  if (name && ICON_PATHS[name]) return <Icon name={name} style={size ? { width: size, height: size } : undefined} />;
  return <span className="w-icon-unknown" aria-hidden="true">?</span>;
}

/**
 * Icon chooser with live previews of the storefront icon set. Opens an inline panel (works inside drawers and
 * list cards) with search. `options` defaults to every pickable storefront icon; `allowVeg` adds the veg mark.
 */
export function IconPicker({ value, onChange, options = PICKABLE_ICONS, allowVeg = true, error }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef(null);
  const names = useMemo(() => {
    const list = [...(allowVeg ? ['veg'] : []), ...options];
    if (value && !list.includes(value)) list.unshift(value);
    return list;
  }, [options, allowVeg, value]);
  const needle = q.trim().toLowerCase();
  const shown = names.filter((n) => !needle || `${n} ${iconLabel(n)}`.toLowerCase().includes(needle));

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && (e.stopPropagation(), setOpen(false));
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  return (
    <div className="w-iconpick" ref={ref}>
      <button type="button" className={cx('w-iconpick-trigger', error && 'bad', open && 'on')} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="w-iconpick-prev"><StoreIcon name={value} /></span>
        <span className="w-iconpick-name">{value ? iconLabel(value) : 'Choose an icon…'}</span>
        {value && <span className="u-xs u-faint u-mono hide-xs">{value}</span>}
        <Icon name={open ? 'chevup' : 'cdown'} />
      </button>
      {open && (
        <div className="w-iconpick-panel">
          <Input icon="search" placeholder="Search icons…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          <div className="w-iconpick-grid" role="radiogroup" aria-label="Icon">
            {shown.map((n) => (
              <button
                key={n} type="button" role="radio" aria-checked={value === n} title={iconLabel(n)}
                className={cx('w-iconpick-opt', value === n && 'on')}
                onClick={() => { onChange(n); setOpen(false); setQ(''); }}
              >
                <StoreIcon name={n} size={20} />
                <span>{iconLabel(n)}</span>
              </button>
            ))}
            {!shown.length && <p className="u-small u-muted" style={{ gridColumn: '1 / -1', padding: 8 }}>No icon matches “{q}”.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Tag-style multi value input ---------------- */

/** value: string[]; validate(text) → error string | ''. Enter / comma / blur adds; Backspace on empty removes last. */
export function TagInput({ value = [], onChange, placeholder = 'Type and press Enter', validate, error, inputMode }) {
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const add = () => {
    const v = text.trim().replace(/,$/, '').trim();
    if (!v) return;
    const problem = validate?.(v);
    if (problem) { setErr(problem); return; }
    if (value.includes(v)) { setErr('Already added'); return; }
    onChange([...value, v]);
    setText('');
    setErr('');
  };
  return (
    <div className="u-stack tight" style={{ gap: 6 }}>
      <div className={cx('w-tags', (error || err) && 'bad')} onClick={(e) => e.currentTarget.querySelector('input')?.focus()}>
        {value.map((t, i) => (
          <span key={t} className="w-tag">
            {i === 0 && value.length > 1 && <b className="w-tag-first" title="Shown first on the website">1st</b>}
            {t}
            <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(value.filter((x) => x !== t))}><Icon name="x" /></button>
          </span>
        ))}
        <input
          value={text}
          inputMode={inputMode}
          placeholder={value.length ? '' : placeholder}
          onChange={(e) => { setText(e.target.value); setErr(''); if (e.target.value.endsWith(',')) setTimeout(add, 0); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); add(); }
            if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={add}
        />
      </div>
      {err && <span className="u-error">{err}</span>}
    </div>
  );
}

/* ---------------- Rich text preview ---------------- */

/** Renders the storefront's long-text format: blank line = new paragraph, "## " = heading, "- " lines = bullet list. */
export function RichPreview({ text }) {
  const blocks = String(text || '').split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  if (!blocks.length) return <p className="u-muted u-small">Nothing to preview yet.</p>;
  return (
    <div className="w-rich">
      {blocks.flatMap((b, i) => {
        const lines = b.split('\n');
        const out = [];
        let rest = lines;
        if (lines[0].startsWith('## ')) {
          out.push(<h3 key={`h${i}`}>{lines[0].slice(3)}</h3>);
          rest = lines.slice(1);
        }
        if (!rest.length) return out;
        if (rest.every((l) => /^\s*[-•]\s+/.test(l))) {
          out.push(<ul key={`u${i}`}>{rest.map((l, j) => <li key={j}>{l.replace(/^\s*[-•]\s+/, '')}</li>)}</ul>);
        } else {
          out.push(<p key={`p${i}`}>{rest.map((l, j) => (j ? [<br key={j} />, l] : l))}</p>);
        }
        return out;
      })}
    </div>
  );
}

/* ---------------- Sticky save bar ---------------- */

export function SaveBar({ dirty, saving, onSave, onDiscard, saveLabel = 'Save changes', note, disabled }) {
  return (
    <div className={cx('w-savebar', dirty && 'dirty')}>
      <span className={cx('w-savebar-dot', dirty && 'on')} />
      <span className="w-savebar-text">
        <b>{dirty ? 'Unsaved changes' : 'All changes saved'}</b>
        {note && <span>{note}</span>}
      </span>
      <span className="u-spacer" />
      {dirty && onDiscard && <Button variant="ghost" onClick={onDiscard} disabled={saving}>Discard</Button>}
      <Button variant="primary" icon="check" onClick={onSave} loading={saving} disabled={!dirty || disabled}>{saveLabel}</Button>
    </div>
  );
}

/* ---------------- Password ---------------- */

export function PasswordInput({ value, onChange, error, ...rest }) {
  const [show, setShow] = useState(false);
  return (
    <div className="w-pw">
      <input className={cx('u-input', error && 'bad')} type={show ? 'text' : 'password'} value={value} onChange={onChange} {...rest} />
      <button type="button" className="w-pw-toggle" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} title={show ? 'Hide password' : 'Show password'}>
        <Icon name={show ? 'eyeoff' : 'eye'} />
      </button>
    </div>
  );
}

export function StrengthMeter({ password }) {
  const st = passwordStrength(password);
  if (!password) return null;
  return (
    <div className="w-strength">
      <div className="w-strength-bars">
        {[0, 1, 2, 3].map((i) => <i key={i} className={i < Math.max(1, st.score) ? `on tone-${st.tone}` : ''} />)}
      </div>
      <span className={`u-xs tone-text-${st.tone}`}>{st.label}{st.score < 3 ? ' · use 12+ characters with upper & lower case, numbers and a symbol' : ''}</span>
    </div>
  );
}

/* ---------------- Misc ---------------- */

/** Up / down reorder buttons. */
export function MoveButtons({ index, count, onMove, disabled }) {
  return (
    <span className="w-move">
      <button type="button" className="u-iconbtn" aria-label="Move up" title="Move up" disabled={disabled || index === 0} onClick={(e) => { e.stopPropagation(); onMove(index, -1); }}><Icon name="arrowup" /></button>
      <button type="button" className="u-iconbtn" aria-label="Move down" title="Move down" disabled={disabled || index === count - 1} onClick={(e) => { e.stopPropagation(); onMove(index, 1); }}><Icon name="arrowdown" /></button>
    </span>
  );
}

