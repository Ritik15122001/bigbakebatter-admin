import { useEffect, useState } from 'react';
import Icon from './Icon';
import Modal from './Modal';
import { uploadService } from '../../services/uploadService';
import { useUiStore } from '../../store/uiStore';

/**
 * Generic list + add/edit/delete screen for the simple catalog/content
 * resources (flavours, occasions, add-ons, FAQs, reviews, announcements).
 *
 * fields:  [{ key, label, type: text|textarea|number|select|bool|color|image, options?, required?, placeholder?, hint?, span2? }]
 * columns: [{ label, render(item) }]
 */
export default function ResourceManager({ noun, service, fields, columns, empty, newItem = {}, sortBy }) {
  const pushToast = useUiStore((s) => s.pushToast);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // 'new' | id
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const defaults = () => ({
    ...Object.fromEntries(fields.map((f) => [f.key, f.type === 'bool' ? false : ''])),
    ...newItem,
  });

  const load = () => {
    setLoading(true);
    service
      .list()
      .then((list) => setItems(sortBy ? [...list].sort(sortBy) : list))
      .catch((e) => pushToast({ title: `Failed to load ${noun}s`, subtitle: e.message, kind: 'err' }))
      .finally(() => setLoading(false));
  };
  useEffect(load, [service]); // eslint-disable-line react-hooks/exhaustive-deps

  const openAdd = () => {
    setForm(defaults());
    setEditing('new');
  };
  const openEdit = (item) => {
    setForm({ ...defaults(), ...Object.fromEntries(fields.map((f) => [f.key, item[f.key] ?? defaults()[f.key]])) });
    setEditing(item._id);
  };
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const save = async (e) => {
    e?.preventDefault();
    const missing = fields.find((f) => f.required && !String(form[f.key] ?? '').trim());
    if (missing) {
      pushToast({ title: `${missing.label} is required`, kind: 'err' });
      return;
    }
    const payload = Object.fromEntries(
      fields.map((f) => [f.key, f.type === 'number' ? Number(form[f.key] || 0) : typeof form[f.key] === 'string' ? form[f.key].trim() : form[f.key]])
    );
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
    try {
      await service.remove(deleting._id);
      pushToast({ title: `${noun} deleted`, kind: 'info' });
      setDeleting(null);
      load();
    } catch (err) {
      pushToast({ title: 'Delete failed', subtitle: err.message, kind: 'err' });
    }
  };

  const handleFile = async (key, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      set(key, await uploadService.upload(file));
    } catch (err) {
      pushToast({ title: 'Upload failed', subtitle: err.message, kind: 'err' });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const renderField = (f) => {
    const v = form[f.key];
    switch (f.type) {
      case 'textarea':
        return <textarea className="textarea" rows={3} value={v} placeholder={f.placeholder} onChange={(e) => set(f.key, e.target.value)} />;
      case 'number':
        return <input className="input" type="number" min="0" value={v} placeholder={f.placeholder} onChange={(e) => set(f.key, e.target.value)} />;
      case 'select':
        return (
          <select className="select" value={v} onChange={(e) => set(f.key, e.target.value)}>
            {f.options.map((o) => {
              const opt = typeof o === 'string' ? { value: o, label: o } : o;
              return <option key={opt.value} value={opt.value}>{opt.label}</option>;
            })}
          </select>
        );
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
            <input className="input" value={v} onChange={(e) => set(f.key, e.target.value)} placeholder="#E4CBA1" />
          </div>
        );
      case 'image':
        return (
          <>
            {v && <img src={v} alt="" style={{ width: 96, height: 72, objectFit: 'cover', borderRadius: 8, marginBottom: 8 }} />}
            <label className="dropzone" style={{ display: 'block', padding: 14 }}>
              {uploading ? 'Uploading…' : v ? 'Change photo' : 'Click to upload a photo'}
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => handleFile(f.key, e)} disabled={uploading} />
            </label>
          </>
        );
      default:
        return <input className="input" value={v} placeholder={f.placeholder} onChange={(e) => set(f.key, e.target.value)} />;
    }
  };

  return (
    <div className="a-panel">
      <div className="a-panel-head">
        <h3>{noun}s</h3>
        <div className="row gap-3 center">
          {!loading && <span className="a-count">{items.length} total</span>}
          <button className="btn btn-primary btn-sm" onClick={openAdd}>
            <Icon name="plus" className="icon icon-sm" />
            Add {noun.toLowerCase()}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="a-empty"><p className="muted">Loading…</p></div>
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
        onClose={() => setEditing(null)}
        kicker={editing === 'new' ? `New ${noun.toLowerCase()}` : `Edit ${noun.toLowerCase()}`}
        title={editing === 'new' ? `Add a ${noun.toLowerCase()}` : noun}
        foot={<button className="btn btn-primary btn-block" onClick={save} disabled={saving}>{saving ? 'Saving…' : `Save ${noun.toLowerCase()}`}</button>}
      >
        <form className="form-grid two" onSubmit={save}>
          {fields.map((f) => (
            <div key={f.key} className={`field ${f.span2 || ['textarea', 'image'].includes(f.type) ? 'span2' : ''}`}>
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
        onClose={() => setDeleting(null)}
        kicker="Confirm"
        title={`Delete this ${noun.toLowerCase()}?`}
        foot={
          <>
            <button className="btn btn-ghost" onClick={() => setDeleting(null)}>Cancel</button>
            <button className="btn btn-primary" style={{ background: 'var(--c-error)' }} onClick={confirmDelete}>Delete</button>
          </>
        }
      >
        <p className="muted">This removes it from the storefront immediately.</p>
      </Modal>
    </div>
  );
}
