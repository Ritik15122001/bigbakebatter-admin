import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../components/common/Icon';
import { Button, IconButton } from './core';

const cx = (...c) => c.filter(Boolean).join(' ');

function useEscape(open, onClose) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
}

function useBodyLock(open) {
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);
}

/* ---------------- Dropdown menu ---------------- */
/**
 * items: [{ label, icon, onClick, danger, href, divider, heading }]
 * trigger: render-prop ({ open, toggle }) or default "⋯" icon button.
 */
export function Menu({ items, trigger, align = 'right', up = false, label = 'More actions' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  useEscape(open, () => setOpen(false));
  const toggle = (e) => { e?.stopPropagation(); setOpen((o) => !o); };
  return (
    <div className="u-menu-wrap" ref={ref} onClick={(e) => e.stopPropagation()}>
      {trigger ? trigger({ open, toggle }) : <IconButton icon="dots" label={label} onClick={toggle} />}
      {open && (
        <div className={cx('u-menu', align === 'left' && 'left', up && 'up')} role="menu">
          {items.filter(Boolean).map((it, i) => {
            if (it.divider) return <div key={i} className="u-menu-sep" />;
            if (it.heading) return <div key={i} className="u-menu-head">{it.heading}</div>;
            const content = <>{it.icon && <Icon name={it.icon} />}{it.label}</>;
            return it.href ? (
              <a key={i} className={cx('u-menu-item', it.danger && 'danger')} href={it.href} target={it.external ? '_blank' : undefined} rel="noreferrer" onClick={() => setOpen(false)}>{content}</a>
            ) : (
              <button key={i} type="button" role="menuitem" className={cx('u-menu-item', it.danger && 'danger')} disabled={it.disabled} onClick={() => { setOpen(false); it.onClick?.(); }}>{content}</button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------- Drawer (slide-over) ---------------- */
export function Drawer({ open, onClose, title, description, icon, children, footer, width = 560 }) {
  useEscape(open, onClose);
  useBodyLock(open);
  if (!open) return null;
  return createPortal(
    <div className="u-app">
      <div className="u-overlay" onClick={onClose} />
      <aside className="u-drawer" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} style={{ '--w': `${width}px` }}>
        <header className="u-drawer-head">
          {icon}
          <div style={{ minWidth: 0 }}>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <IconButton icon="x" label="Close" onClick={onClose} />
        </header>
        <div className="u-drawer-body">{children}</div>
        {footer && <footer className="u-drawer-foot">{footer}</footer>}
      </aside>
    </div>,
    document.body
  );
}

/* ---------------- Dialog ---------------- */
export function Dialog({ open, onClose, tone = 'brand', icon = 'info', title, children, actions, width }) {
  useEscape(open, onClose);
  useBodyLock(open);
  if (!open) return null;
  return createPortal(
    <div className="u-app">
      <div className="u-overlay" onClick={onClose} />
      <div className="u-dialog" role="alertdialog" aria-modal="true" style={width ? { '--w': `${width}px` } : undefined}>
        <span className={cx('u-dialog-ico', `tone-${tone}`)} style={{ borderColor: 'var(--u-subtle)' }}><Icon name={icon} /></span>
        <h3>{title}</h3>
        {children && <div style={{ marginTop: 6, color: 'var(--u-muted)' }}>{children}</div>}
        {actions && <div className="u-dialog-actions">{actions}</div>}
      </div>
    </div>,
    document.body
  );
}

/* ---------------- confirm() ---------------- */
const ConfirmCtx = createContext(null);

/**
 * const confirm = useConfirm();
 * if (await confirm({ title, message, confirmLabel, danger: true })) …
 */
export function ConfirmProvider({ children }) {
  const [req, setReq] = useState(null);
  const confirm = useCallback((opts) => new Promise((resolve) => setReq({ ...opts, resolve })), []);
  const close = (v) => { req?.resolve(v); setReq(null); };
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Dialog
        open={!!req}
        onClose={() => close(false)}
        tone={req?.danger ? 'red' : 'brand'}
        icon={req?.icon || (req?.danger ? 'alert' : 'info')}
        title={req?.title}
        actions={
          <>
            <Button onClick={() => close(false)}>{req?.cancelLabel || 'Cancel'}</Button>
            <Button variant={req?.danger ? 'danger' : 'primary'} onClick={() => close(true)} autoFocus>{req?.confirmLabel || 'Confirm'}</Button>
          </>
        }
      >
        {req?.message}
      </Dialog>
    </ConfirmCtx.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmCtx);

/* ---------------- Command palette ---------------- */
/** items: [{ group, label, icon, onSelect, keywords }] */
export function CommandPalette({ open, onClose, items }) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  useEscape(open, onClose);
  useEffect(() => { if (open) { setQ(''); setActive(0); } }, [open]);
  if (!open) return null;
  const needle = q.trim().toLowerCase();
  const list = items.filter((i) => !needle || `${i.label} ${i.group} ${i.keywords || ''}`.toLowerCase().includes(needle));
  const pick = (i) => { onClose(); i?.onSelect(); };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, list.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    if (e.key === 'Enter') pick(list[active]);
  };
  let lastGroup = null;
  return createPortal(
    <div className="u-app">
      <div className="u-overlay" onClick={onClose} />
      <div className="u-cmd" role="dialog" aria-label="Search">
        <div className="u-cmd-input">
          <Icon name="search" />
          <input autoFocus placeholder="Search pages and actions…" value={q} onChange={(e) => { setQ(e.target.value); setActive(0); }} onKeyDown={onKey} />
          <kbd className="u-tag">esc</kbd>
        </div>
        <div className="u-cmd-list">
          {list.length === 0 && <div className="u-empty" style={{ padding: 28 }}><p>No matches for “{q}”.</p></div>}
          {list.map((i, idx) => {
            const head = i.group !== lastGroup ? <div className="u-cmd-group" key={`g${i.group}`}>{i.group}</div> : null;
            lastGroup = i.group;
            return [
              head,
              <button key={`${i.group}${i.label}`} className={cx('u-cmd-item', idx === active && 'on')} onMouseEnter={() => setActive(idx)} onClick={() => pick(i)}>
                <Icon name={i.icon || 'aright'} />{i.label}
              </button>,
            ];
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
