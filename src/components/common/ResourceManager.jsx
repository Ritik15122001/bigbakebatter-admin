import { useCallback, useEffect, useState } from 'react';
import Icon from './Icon';
import Modal from './Modal';
import ImageField from './ImageField';
import IconPicker from './IconPicker';
import { useUiStore } from '../../store/uiStore';

/** ISO date/time → "YYYY-MM-DD" for <input type="date">. */
const toDateInput = (v) => {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 2000) return ''; // epoch = "no date" stored by older saves
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * Generic list + add/edit/delete screen for the simple catalog/content
 * resources (flavours, occasions, add-ons, FAQs, reviews, announcements,
 * coupons, add-on groups).
 *
 * fields:  [{ key, label, type: text|textarea|number|select|bool|color|image|icon|date,
 *             options?, required?, placeholder?, hint?, span2?, checkLabel?, allowVeg?,
 *             min?, max?, step?, format?(value) → value sent to the API }]
 * columns: [{ label, render(item) }]
 * validate(payload) → error string | null  (optional extra client-side check)
 */
export default function ResourceManager({ noun, service, fields, columns, empty, newItem = {}, sortBy, validate, intro }) {
  const pushToast = useUiStore((s) => s.pushToast);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState(null); // 'new' | id
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [removing, setRemoving] = useState(false);

  const defaults = () => ({
    ...Object.fromEntries(fields.map((f) => [f.key, f.type === 'bool' ? false : ''])),
    ...newItem,
  });

  const load = useCallback(() => {
    setLoading(true);
    setLoadError('');
    service
      .list()
      .then((list) => setItems(sortBy ? [...list].sort(sortBy) : list))
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoading(false));
    // sortBy is a fresh inline function on every render of the parent; the
    // service identity is what decides when to reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service]);

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setForm(defaults());
    setEditing('new');
  };
  const openEdit = (item) => {
    const base = defaults();
    setForm(
      Object.fromEntries(
        fields.map((f) => {
          const raw = item[f.key] ?? base[f.key];
          return [f.key, f.type === 'date' ? toDateInput(raw) : raw];
        })
      )
    );
    setEditing(item._id);
  };
  const closeEditor = () => {
    if (saving || uploading) return;
    setEditing(null);
  };
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const save = async (e) => {
    e?.preventDefault();
    if (saving || uploading) return;
    const missing = fields.find((f) => f.required && !String(form[f.key] ?? '').trim());
    if (missing) {
      pushToast({ title: `${missing.label} is required`, kind: 'err' });
      return;
    }
    const payload = Object.fromEntries(
      fields.map((f) => {
        let v = form[f.key];
        if (f.type === 'number') v = v === '' || v == null ? 0 : Number(v);
        // '' (not null) for "no date": the backend coerces null to 1970-01-01.
        else if (f.type === 'date') v = v ? new Date(`${v}T23:59:59`).toISOString() : '';
        else if (typeof v === 'string') v = v.trim();
        if (f.format) v = f.format(v);
        return [f.key, v];
      })
    );
    const problem = validate?.(payload);
    if (problem) {
      pushToast({ title: problem, kind: 'err' });
      return;
    }
    setSaving(true);
    try {
      if (editing === 'new') await service.create(payload);
      else await service.update(editing, payload);
      pushToast({ title: `${noun} ${editing === 'new' ? 'added' : 'updated'}`, kind: 'ok' });
      setEditing(null);
      load();
    } catch (err) {
      pushToast({ title: `Could not save ${noun.toLowerCase()}`, subtitle: err.message, kind: 'err' });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    setRemoving(true);
    try {
      await service.remove(deleting._id);
      pushToast({ title: `${noun} deleted`, kind: 'info' });
      setDeleting(null);
      load();
    } catch (err) {
      pushToast({ title: 'Delete failed', subtitle: err.message, kind: 'err' });
    } finally {
      setRemoving(false);
    }
  };

  const renderField = (f) => {
    const v = form[f.key];
    switch (f.type) {
      case 'textarea':
        return <textarea className="textarea" rows={3} value={v ?? ''} placeholder={f.placeholder} onChange={(e) => set(f.key, e.target.value)} />;
      case 'number':
        return (
          <input
            className="input" type="number" inputMode="decimal"
            min={f.min ?? 0} max={f.max} step={f.step ?? 'any'}
            value={v ?? ''} placeholder={f.placeholder}
            onChange={(e) => set(f.key, e.target.value)}
          />
        );
      case 'date':
        return <input className="input" type="date" value={v ?? ''} onChange={(e) => set(f.key, e.target.value)} />;
      case 'select': {
        const opts = (f.options || []).map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
        // Keep a value that is no longer offered (e.g. a deleted group) visible instead of silently changing it.
        if (v && !opts.some((o) => String(o.value) === String(v))) opts.unshift({ value: v, label: `${v} (not available)` });
        return (
          <select className="select" value={v ?? ''} onChange={(e) => set(f.key, e.target.value)}>
            {opts.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        );
      }
      case 'bool':
        return (
          <label className="check" style={{ display: 'inline-flex', gap: 8 }}>
            <input type="checkbox" checked={!!v} onChange={(e) => set(f.key, e.target.checked)} />
            <span>{f.checkLabel || 'Yes'}</span>
          </label>
        );
      case 'color':
        return (
          <div className="row gap-3 center">
            <input type="color" value={/^#[0-9a-f]{6}$/i.test(v) ? v : '#E4CBA1'} onChange={(e) => set(f.key, e.target.value)} style={{ width: 44, height: 36, padding: 0, border: 0, background: 'none' }} />
            <input className="input" value={v ?? ''} onChange={(e) => set(f.key, e.target.value)} placeholder="#E4CBA1" />
          </div>
        );
      case 'image':
        return <ImageField value={v} onChange={(url) => set(f.key, url)} onUploadingChange={setUploading} previewWidth={120} previewHeight={84} />;
      case 'icon':
        return <IconPicker value={v} onChange={(name) => set(f.key, name)} options={f.options || []} allowVeg={f.allowVeg} />;
      default:
        return <input className="input" value={v ?? ''} placeholder={f.placeholder} onChange={(e) => set(f.key, e.target.value)} />;
    }
  };

  return (
    <div className="a-panel">
      <div className="a-panel-head">
        <h3>{noun}s</h3>
        <div className="row gap-3 center">
          {!loading && !loadError && <span className="a-count">{items.length} total</span>}
          <button className="btn btn-primary btn-sm" onClick={openAdd}>
            <Icon name="plus" className="icon icon-sm" />
            Add {noun.toLowerCase()}
          </button>
        </div>
      </div>
      {intro && <p className="a-intro">{intro}</p>}

      {loading ? (
        <div className="a-empty"><p className="muted">Loading…</p></div>
      ) : loadError ? (
        <div className="a-empty">
          <p className="muted">Could not load {noun.toLowerCase()}s: {loadError}</p>
          <button className="btn btn-outline btn-sm" onClick={load}>Try again</button>
        </div>
      ) : items.length === 0 ? (
        <div className="a-empty"><p className="muted">{empty || `No ${noun.toLowerCase()}s yet.`}</p></div>
      ) : (
        <div className="a-table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                {columns.map((c) => <th key={c.label}>{c.label}</th>)}
                <th className="act" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item._id} onClick={() => openEdit(item)}>
                  {columns.map((c) => <td key={c.label}>{c.render(item)}</td>)}
                  <td className="act rowact" onClick={(e) => e.stopPropagation()}>
                    <button className="iconbtn" aria-label="Edit" onClick={() => openEdit(item)}>
                      <Icon name="edit" className="icon icon-sm" />
                    </button>
                    <button className="iconbtn danger" aria-label="Delete" onClick={() => setDeleting(item)}>
                      <Icon name="trash" className="icon icon-sm" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={!!editing}
        onClose={closeEditor}
        kicker={editing === 'new' ? `New ${noun.toLowerCase()}` : `Edit ${noun.toLowerCase()}`}
        title={editing === 'new' ? `Add a ${noun.toLowerCase()}` : noun}
        foot={
          <button className="btn btn-primary btn-block" onClick={save} disabled={saving || uploading}>
            {saving ? 'Saving…' : uploading ? 'Uploading photo…' : `Save ${noun.toLowerCase()}`}
          </button>
        }
      >
        <form className="form-grid two" onSubmit={save}>
          {fields.map((f) => (
            <div key={f.key} className={`field ${f.span2 || ['textarea', 'image', 'icon'].includes(f.type) ? 'span2' : ''}`}>
              <label>{f.label}{f.required && ' *'}</label>
              {renderField(f)}
              {f.hint && <span className="field-hint">{f.hint}</span>}
            </div>
          ))}
          <button type="submit" hidden />
        </form>
      </Modal>

      <Modal
        open={!!deleting}
        onClose={() => !removing && setDeleting(null)}
        kicker="Confirm"
        title={`Delete this ${noun.toLowerCase()}?`}
        foot={
          <>
            <button className="btn btn-ghost" onClick={() => setDeleting(null)} disabled={removing}>Cancel</button>
            <button className="btn btn-primary" style={{ background: 'var(--c-error)' }} onClick={confirmDelete} disabled={removing}>
              {removing ? 'Deleting…' : 'Delete'}
            </button>
          </>
        }
      >
        <p className="muted">This removes it from the storefront immediately.</p>
      </Modal>
    </div>
  );
}
