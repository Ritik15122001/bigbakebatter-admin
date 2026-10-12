import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Icon from '../components/common/Icon';
import Modal from '../components/common/Modal';
import ImageField from '../components/common/ImageField';
import IconPicker from '../components/common/IconPicker';
import { contentService } from '../services/contentService';
import { useUiStore } from '../store/uiStore';
import { PICKABLE_ICONS } from '../utils/icons';

// Page copy also uses tick / info marks (e.g. feature lists), so offer those here too.
const CONTENT_ICONS = [...PICKABLE_ICONS, 'check', 'info'];

/* ---------- schema helpers ---------- */

function emptyValue(field) {
  switch (field.type) {
    case 'list': return [];
    case 'bool': return false;
    case 'number': return 0;
    default: return '';
  }
}

/** Shape `data` exactly like the schema so dirty-checking is a stable JSON compare. */
function normalize(fields, data) {
  const src = data && typeof data === 'object' ? data : {};
  return Object.fromEntries(
    (fields || []).map((f) => {
      let v = src[f.name];
      if (f.type === 'list') {
        v = Array.isArray(v) ? v.map((item) => normalize(f.fields, item)) : [];
      } else if (v === undefined || v === null) {
        v = emptyValue(f);
      }
      return [f.name, v];
    })
  );
}

const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const isValidLink = (v) => !v || v.startsWith('/') || /^https?:\/\//i.test(v) || /^(mailto|tel):/i.test(v);

/** First invalid link in the data, as a readable path ("Items #2 → Link"). */
function findBadLink(fields, data, trail = []) {
  for (const f of fields || []) {
    const v = data?.[f.name];
    if (f.type === 'link' && typeof v === 'string' && !isValidLink(v.trim())) return [...trail, f.label || f.name].join(' → ');
    if (f.type === 'list' && Array.isArray(v)) {
      for (let i = 0; i < v.length; i += 1) {
        const hit = findBadLink(f.fields, v[i], [...trail, `${f.label || f.name} #${i + 1}`]);
        if (hit) return hit;
      }
    }
  }
  return null;
}

/* ---------- field editors ---------- */

function FieldInput({ field, value, onChange }) {
  switch (field.type) {
    case 'textarea':
      return <textarea className="textarea" rows={3} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
    case 'richtext':
      return <textarea className="textarea content-richtext" rows={12} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
    case 'number':
      return (
        <input
          className="input" type="number" inputMode="decimal" step="any"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        />
      );
    case 'bool':
      return (
        <label className="check" style={{ display: 'inline-flex', gap: 8 }}>
          <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
          <span>{value ? 'On' : 'Off'}</span>
        </label>
      );
    case 'image':
      return <ImageField value={value} onChange={onChange} previewWidth={160} previewHeight={100} />;
    case 'icon':
      return <IconPicker value={value} onChange={onChange} options={CONTENT_ICONS} allowVeg={/veg/i.test(field.hint || '') || value === 'veg'} variant="select" />;
    case 'link': {
      const bad = !isValidLink(String(value || '').trim());
      return (
        <>
          <input className="input" value={value ?? ''} placeholder="/shop or https://…" onChange={(e) => onChange(e.target.value)} aria-invalid={bad} />
          {bad && <span className="field-hint field-err">Links must start with / (a page on this site) or https://</span>}
        </>
      );
    }
    case 'list':
      return <ListEditor field={field} value={Array.isArray(value) ? value : []} onChange={onChange} />;
    default:
      return <input className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
  }
}

function defaultHint(field) {
  if (field.type === 'richtext') return 'Leave a blank line between paragraphs. Start a line with "## " to make it a heading.';
  if (field.type === 'link' && !field.hint) return 'A page on this site like /shop, or a full https://… address.';
  return null;
}

function FieldRow({ field, value, onChange }) {
  const wide = ['textarea', 'richtext', 'image', 'list'].includes(field.type);
  const extra = defaultHint(field);
  return (
    <div className={`field ${wide ? 'span2' : ''}`}>
      {field.type !== 'list' && <label>{field.label || field.name}</label>}
      {field.type === 'list' && <span className="lbl">{field.label || field.name}</span>}
      <FieldInput field={field} value={value} onChange={onChange} />
      {field.hint && <span className="field-hint">{field.hint}</span>}
      {extra && <span className="field-hint">{extra}</span>}
    </div>
  );
}

function FieldsForm({ fields, value, onChange }) {
  return (
    <div className="form-grid two">
      {(fields || []).map((f) => (
        <FieldRow key={f.name} field={f} value={value?.[f.name]} onChange={(v) => onChange({ ...value, [f.name]: v })} />
      ))}
    </div>
  );
}

function ListEditor({ field, value, onChange }) {
  const itemTitle = (item, i) => {
    const raw = field.itemLabel ? item?.[field.itemLabel] : '';
    const text = typeof raw === 'string' ? raw.trim() : raw != null ? String(raw) : '';
    return text || `Item ${i + 1}`;
  };
  const update = (i, item) => onChange(value.map((x, j) => (j === i ? item : x)));
  const remove = (i) => onChange(value.filter((_, j) => j !== i));
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const add = () => onChange([...value, normalize(field.fields, {})]);
  const noun = (field.label || 'item').replace(/s$/i, '').toLowerCase();

  return (
    <div className="list-editor">
      {value.length === 0 && <p className="tiny muted">Nothing here yet.</p>}
      {value.map((item, i) => (
        <div className="list-card" key={i}>
          <div className="list-card-head">
            <span className="list-card-n">{i + 1}</span>
            <b className="list-card-title">{itemTitle(item, i)}</b>
            <span className="row gap-1">
              <button type="button" className="iconbtn" aria-label="Move up" title="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                <Icon name="arrowup" className="icon icon-sm" />
              </button>
              <button type="button" className="iconbtn" aria-label="Move down" title="Move down" disabled={i === value.length - 1} onClick={() => move(i, 1)}>
                <Icon name="arrowdown" className="icon icon-sm" />
              </button>
              <button type="button" className="iconbtn danger" aria-label="Remove" title="Remove" onClick={() => remove(i)}>
                <Icon name="trash" className="icon icon-sm" />
              </button>
            </span>
          </div>
          <div className="list-card-body">
            <FieldsForm fields={field.fields} value={item} onChange={(v) => update(i, v)} />
          </div>
        </div>
      ))}
      <button type="button" className="btn btn-outline btn-sm list-add" onClick={add}>
        <Icon name="plus" className="icon icon-sm" />
        Add {noun}
      </button>
    </div>
  );
}

/* ---------- page ---------- */

export default function ContentPages() {
  const pushToast = useUiStore((s) => s.pushToast);
  const [params, setParams] = useSearchParams();
  const [sections, setSections] = useState(null);
  const [saved, setSaved] = useState({});
  const [loadError, setLoadError] = useState('');
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [pendingKey, setPendingKey] = useState(null);

  const selectedKey = params.get('section');
  const section = useMemo(() => sections?.find((s) => s.key === selectedKey) || null, [sections, selectedKey]);

  const load = useCallback(() => {
    setLoadError('');
    setSections(null);
    Promise.all([contentService.schema(), contentService.all()])
      .then(([schema, all]) => {
        const list = Array.isArray(schema) ? schema : [];
        setSaved(Object.fromEntries(list.map((s) => [s.key, normalize(s.fields, all?.[s.key] ?? s.defaults)])));
        setSections(list);
      })
      .catch((e) => setLoadError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Pick the first section by default (desktop), and (re)build the draft when the section changes.
  useEffect(() => {
    if (!sections || sections.length === 0) return;
    if (!selectedKey || !sections.some((s) => s.key === selectedKey)) {
      if (window.matchMedia?.('(min-width: 1000px)').matches) setParams({ section: sections[0].key }, { replace: true });
    }
  }, [sections, selectedKey, setParams]);

  useEffect(() => {
    setDraft(section ? saved[section.key] : null);
    // only when switching sections — `saved` updates after a save already sync the draft
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);

  const dirty = !!(section && draft && !sameJson(draft, saved[section.key]));

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const groups = useMemo(() => {
    const map = new Map();
    (sections || []).forEach((s) => {
      const g = s.group || 'Other';
      if (!map.has(g)) map.set(g, []);
      map.get(g).push(s);
    });
    return [...map.entries()];
  }, [sections]);

  const go = (key) => setParams(key ? { section: key } : {});
  const select = (key) => {
    if (key === selectedKey) return;
    if (dirty) setPendingKey(key ?? '');
    else go(key);
  };
  const discardAndGo = () => {
    const key = pendingKey;
    setPendingKey(null);
    if (section) setDraft(saved[section.key]);
    go(key || null);
  };

  const save = async () => {
    if (!section || saving) return;
    const bad = findBadLink(section.fields, draft);
    if (bad) {
      pushToast({ title: 'Fix the link before saving', subtitle: `${bad}: must start with / or https://`, kind: 'err' });
      return;
    }
    setSaving(true);
    try {
      const merged = await contentService.save(section.key, draft);
      const next = normalize(section.fields, merged);
      setSaved((s) => ({ ...s, [section.key]: next }));
      setDraft(next);
      pushToast({ title: `${section.label} saved`, subtitle: 'Live on the storefront after a refresh.', kind: 'ok' });
    } catch (err) {
      pushToast({ title: 'Could not save', subtitle: err.message, kind: 'err' });
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (!section) return;
    setResetting(true);
    try {
      const defaults = await contentService.reset(section.key);
      const next = normalize(section.fields, defaults ?? section.defaults);
      setSaved((s) => ({ ...s, [section.key]: next }));
      setDraft(next);
      setResetOpen(false);
      pushToast({ title: `${section.label} reset to default`, kind: 'info' });
    } catch (err) {
      pushToast({ title: 'Could not reset', subtitle: err.message, kind: 'err' });
    } finally {
      setResetting(false);
    }
  };

  if (loadError) {
    return (
      <div className="a-panel a-empty">
        <p className="muted">Could not load website content: {loadError}</p>
        <button className="btn btn-outline btn-sm" onClick={load}>Try again</button>
      </div>
    );
  }
  if (!sections) return <div className="a-panel a-empty"><p className="muted">Loading website content…</p></div>;
  if (sections.length === 0) {
    return <div className="a-panel a-empty"><p className="muted">No editable sections are set up on the server yet.</p></div>;
  }

  const isDefault = (s) => sameJson(saved[s.key], normalize(s.fields, s.defaults));

  return (
    <div className={`content-layout ${section ? 'has-section' : ''}`}>
      <aside className="a-panel content-nav">
        <div className="a-panel-head">
          <h3>Page sections</h3>
          <span className="a-count">{sections.length}</span>
        </div>
        <div className="content-nav-list">
          {groups.map(([group, list]) => (
            <div key={group} className="content-nav-group">
              <p className="content-nav-sep">{group}</p>
              {list.map((s) => (
                <button key={s.key} className={`content-nav-item ${s.key === selectedKey ? 'on' : ''}`} onClick={() => select(s.key)}>
                  <span className="grow">{s.label}</span>
                  {s.key === selectedKey && dirty ? (
                    <span className="badge warn">Unsaved</span>
                  ) : !isDefault(s) ? (
                    <span className="badge neutral" title="Changed from the original">Edited</span>
                  ) : null}
                  <Icon name="cright" className="icon icon-sm" />
                </button>
              ))}
            </div>
          ))}
        </div>
      </aside>

      {section && draft ? (
        <section className="a-panel content-editor">
          <div className="a-panel-head">
            <div className="stack gap-1" style={{ minWidth: 0 }}>
              <button className="a-back content-back" onClick={() => select(null)}>
                <Icon name="cleft" className="icon icon-sm" />
                All sections
              </button>
              <span className="kicker">{section.group}</span>
              <h3>{section.label}</h3>
            </div>
            <div className="row gap-2 center wrap">
              {dirty ? <span className="badge warn">Unsaved changes</span> : <span className="badge success">Saved</span>}
            </div>
          </div>
          <div className="content-editor-body">
            <FieldsForm fields={section.fields} value={draft} onChange={setDraft} />
          </div>
          <div className="content-editor-foot">
            <button className="btn btn-ghost btn-sm" onClick={() => setResetOpen(true)} disabled={saving}>
              <Icon name="refresh" className="icon icon-sm" />
              Reset to default
            </button>
            <span className="grow" />
            {dirty && (
              <button className="btn btn-outline btn-sm" onClick={() => setDraft(saved[section.key])} disabled={saving}>
                Undo changes
              </button>
            )}
            <button className="btn btn-primary btn-sm" onClick={save} disabled={saving || !dirty}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </section>
      ) : (
        <div className="a-panel a-empty content-placeholder">
          <span className="eico"><Icon name="edit" className="icon icon-md" /></span>
          <h4>Choose a section to edit</h4>
          <p>Pick any part of the website on the left to change its text, pictures and links.</p>
        </div>
      )}

      <Modal
        open={pendingKey !== null}
        onClose={() => setPendingKey(null)}
        kicker="Unsaved changes"
        title="Leave without saving?"
        foot={
          <>
            <button className="btn btn-ghost" onClick={() => setPendingKey(null)}>Keep editing</button>
            <button className="btn btn-primary" style={{ background: 'var(--c-error)' }} onClick={discardAndGo}>Discard changes</button>
          </>
        }
      >
        <p className="muted">Your edits to &ldquo;{section?.label}&rdquo; have not been saved and will be lost.</p>
      </Modal>

      <Modal
        open={resetOpen}
        onClose={() => !resetting && setResetOpen(false)}
        kicker="Confirm"
        title={`Reset "${section?.label}"?`}
        foot={
          <>
            <button className="btn btn-ghost" onClick={() => setResetOpen(false)} disabled={resetting}>Cancel</button>
            <button className="btn btn-primary" style={{ background: 'var(--c-error)' }} onClick={reset} disabled={resetting}>
              {resetting ? 'Resetting…' : 'Reset to default'}
            </button>
          </>
        }
      >
        <p className="muted">This throws away every change made to this section and puts back the original website text. It can&rsquo;t be undone.</p>
      </Modal>
    </div>
  );
}
