import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Icon from '../components/common/Icon';
import {
  Page, Card, Button, IconButton, Field, Input, Textarea, Switch, Status, Tag, Segmented, EmptyState, Loader,
  ImageUpload, Thumb, useConfirm, toast, useAsync,
} from '../ui';
import { IconPicker, RichPreview, StoreIcon } from '../ui/ext-web';
import { STOREFRONT_URL, isValidLink, moveItem, useUnloadGuard } from '../ui/ext-web-utils';
import { contentService } from '../services/contentService';
import { PICKABLE_ICONS } from '../utils/icons';

// Page copy also uses tick / info marks (e.g. feature lists), so offer those too.
const CONTENT_ICONS = [...PICKABLE_ICONS, 'check', 'info'];

/* ---------------- schema helpers ---------------- */

function emptyValue(field) {
  if (field.type === 'list') return [];
  if (field.type === 'bool') return false;
  if (field.type === 'number') return 0;
  return '';
}

/** Shape `data` exactly like the schema so dirty-checking is a stable JSON compare. */
function normalize(fields, data) {
  const src = data && typeof data === 'object' ? data : {};
  return Object.fromEntries(
    (fields || []).map((f) => {
      let v = src[f.name];
      if (f.type === 'list') v = Array.isArray(v) ? v.map((item) => normalize(f.fields, item)) : [];
      else if (v === undefined || v === null) v = emptyValue(f);
      return [f.name, v];
    })
  );
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const linkOk = (v) => isValidLink(v, { allowMailTel: true });

/** First invalid link in the data, as a readable path ("Items #2 → Link"). */
function findBadLink(fields, data, trail = []) {
  for (const f of fields || []) {
    const v = data?.[f.name];
    if (f.type === 'link' && typeof v === 'string' && !linkOk(v)) return [...trail, f.label || f.name].join(' → ');
    if (f.type === 'list' && Array.isArray(v)) {
      for (let i = 0; i < v.length; i += 1) {
        const hit = findBadLink(f.fields, v[i], [...trail, `${f.label || f.name} #${i + 1}`]);
        if (hit) return hit;
      }
    }
  }
  return null;
}

/** Where each section shows up on the storefront. */
const PATH_BY_KEY = {
  'shop.head': '/shop', 'product.page': '/shop', 'about.page': '/about', 'corporate.page': '/corporate-cakes',
  'custom.page': '/custom', 'contact.page': '/contact', 'login.page': '/login', 'faq.page': '/faq',
  'blog.page': '/blog', 'blog.article': '/blog', 'track.page': '/track', 'legal.privacy': '/privacy',
  'legal.terms': '/terms', 'notFound.page': '/this-page-does-not-exist',
};
const sitePath = (s) => PATH_BY_KEY[s.key] || (/^(home|layout)\./.test(s.key) ? '/' : null);
const pathNote = { 'product.page': 'Open any cake from the shop to see this text.', 'blog.article': 'Open any article to see this text.' };

const countFields = (fields) => (fields || []).reduce((n, f) => n + (f.type === 'list' ? 1 + countFields(f.fields) : 1), 0);

/* ---------------- field editors ---------------- */

function RichTextField({ field, value, onChange }) {
  const [mode, setMode] = useState('write');
  const words = String(value || '').trim().split(/\s+/).filter(Boolean).length;
  return (
    <div className="u-field">
      <div className="w-rt-tabs">
        <span className="u-label">{field.label || field.name}</span>
        <Segmented value={mode} onChange={setMode} items={[{ value: 'write', label: 'Write' }, { value: 'preview', label: 'Preview' }]} />
      </div>
      {mode === 'write' ? (
        <Textarea rows={14} value={value ?? ''} onChange={(e) => onChange(e.target.value)} style={{ fontSize: 14.5 }} />
      ) : (
        <div className="w-rt-preview"><RichPreview text={value} /></div>
      )}
      <span className="u-hint">
        {field.hint || 'Leave a blank line between paragraphs. Start a line with "## " for a heading and "- " for a bullet point.'}
        {' · '}{words} word{words === 1 ? '' : 's'}
      </span>
    </div>
  );
}

function FieldEditor({ field, value, onChange }) {
  const label = field.label || field.name;
  switch (field.type) {
    case 'richtext':
      return <div className="wide"><RichTextField field={field} value={value} onChange={onChange} /></div>;
    case 'list':
      return <div className="wide"><ListEditor field={field} value={Array.isArray(value) ? value : []} onChange={onChange} /></div>;
    case 'textarea':
      return (
        <Field className="wide" label={label} hint={field.hint}>
          {(id) => <Textarea id={id} rows={3} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />}
        </Field>
      );
    case 'image':
      return (
        <Field className="wide" label={label} hint={field.hint}>
          <ImageUpload value={value || ''} onChange={onChange} />
        </Field>
      );
    case 'number':
      return (
        <Field label={label} hint={field.hint}>
          {(id) => <Input id={id} type="number" inputMode="decimal" step="any" value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} />}
        </Field>
      );
    case 'bool':
      return (
        <Field label={label}>
          <Switch checked={!!value} onChange={onChange} label={value ? 'On' : 'Off'} description={field.hint} />
        </Field>
      );
    case 'icon':
      return (
        <Field label={label} hint={field.hint}>
          <IconPicker value={value} onChange={onChange} options={CONTENT_ICONS} allowVeg />
        </Field>
      );
    case 'link': {
      const bad = !linkOk(value);
      return (
        <Field label={label} error={bad ? 'Links must start with / (a page on this site), https://, mailto: or tel:' : ''} hint={field.hint || 'A page on this site like /shop, or a full https://… address.'}>
          {(id) => <Input id={id} icon="link" value={value ?? ''} placeholder="/shop or https://…" onChange={(e) => onChange(e.target.value)} error={bad} />}
        </Field>
      );
    }
    default:
      return (
        <Field label={label} hint={field.hint}>
          {(id) => <Input id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />}
        </Field>
      );
  }
}

function FieldsForm({ fields, value, onChange }) {
  const simple = (fields || []).filter((f) => !['list', 'richtext', 'textarea', 'image'].includes(f.type)).length;
  return (
    <div className={`w-fields ${simple > 1 ? 'two' : ''}`}>
      {(fields || []).map((f) => (
        <FieldEditor key={f.name} field={f} value={value?.[f.name]} onChange={(v) => onChange({ ...value, [f.name]: v })} />
      ))}
    </div>
  );
}

function ListEditor({ field, value, onChange }) {
  const [open, setOpen] = useState(() => value.map(() => value.length <= 2));
  const isOpen = (i) => !!open[i];
  const label = field.label || field.name;
  const noun = label.replace(/s$/i, '').toLowerCase();

  const itemTitle = (item, i) => {
    const raw = field.itemLabel ? item?.[field.itemLabel] : '';
    const text = typeof raw === 'string' ? raw.trim() : raw != null ? String(raw) : '';
    return text || `${noun.charAt(0).toUpperCase()}${noun.slice(1)} ${i + 1}`;
  };
  const iconField = (field.fields || []).find((f) => f.type === 'icon');
  const imageField = (field.fields || []).find((f) => f.type === 'image');

  const update = (i, item) => onChange(value.map((x, j) => (j === i ? item : x)));
  const remove = (i) => { onChange(value.filter((_, j) => j !== i)); setOpen((o) => o.filter((_, j) => j !== i)); };
  const move = (i, dir) => { onChange(moveItem(value, i, dir)); setOpen((o) => moveItem(value.map((_, j) => !!o[j]), i, dir)); };
  const duplicate = (i) => {
    const next = [...value];
    next.splice(i + 1, 0, JSON.parse(JSON.stringify(value[i])));
    onChange(next);
    setOpen((o) => { const n = value.map((_, j) => !!o[j]); n.splice(i + 1, 0, true); return n; });
  };
  const add = () => { onChange([...value, normalize(field.fields, {})]); setOpen((o) => [...value.map((_, j) => !!o[j]), true]); };
  const toggle = (i) => setOpen((o) => { const n = value.map((_, j) => !!o[j]); n[i] = !n[i]; return n; });
  const allOpen = value.length > 0 && value.every((_, i) => isOpen(i));

  return (
    <div className="w-listed">
      <div className="w-listed-head">
        <span className="u-label">{label}</span>
        <Tag>{value.length}</Tag>
        <span className="u-spacer" />
        {value.length > 1 && (
          <button type="button" className="u-link u-small" onClick={() => setOpen(value.map(() => !allOpen))}>
            {allOpen ? 'Collapse all' : 'Expand all'}
          </button>
        )}
      </div>
      {field.hint && <span className="u-hint" style={{ marginTop: -4 }}>{field.hint}</span>}
      {value.length === 0 && (
        <div className="u-card" style={{ boxShadow: 'none', borderStyle: 'dashed' }}>
          <EmptyState icon="layout" title={`No ${label.toLowerCase()} yet`}>Add the first {noun} — it shows on the website as soon as you save.</EmptyState>
        </div>
      )}
      {value.map((item, i) => (
        <div className="w-item" key={i}>
          <div className="w-item-head" onClick={() => toggle(i)} role="button" aria-expanded={isOpen(i)}>
            <span className="w-item-n">{i + 1}</span>
            {iconField && item?.[iconField.name] && <span className="w-iconpick-prev" style={{ width: 24, height: 24 }}><StoreIcon name={item[iconField.name]} size={13} /></span>}
            {imageField && item?.[imageField.name] && <Thumb src={item[imageField.name]} size="xs" />}
            <span className="w-item-title">{itemTitle(item, i)}</span>
            <span className="w-item-tools" onClick={(e) => e.stopPropagation()}>
              <IconButton icon="arrowup" label="Move up" disabled={i === 0} onClick={() => move(i, -1)} />
              <IconButton icon="arrowdown" label="Move down" disabled={i === value.length - 1} onClick={() => move(i, 1)} />
              <IconButton icon="copy" label="Duplicate" onClick={() => duplicate(i)} />
              <IconButton icon="trash" label="Remove" className="danger" onClick={() => remove(i)} />
            </span>
            <Icon name={isOpen(i) ? 'chevup' : 'cdown'} />
          </div>
          {isOpen(i) && (
            <div className="w-item-body">
              <FieldsForm fields={field.fields} value={item} onChange={(v) => update(i, v)} />
            </div>
          )}
        </div>
      ))}
      <div>
        <Button size="sm" icon="plus" onClick={add}>Add {noun}</Button>
      </div>
    </div>
  );
}

/* ---------------- page ---------------- */

const loadAll = () => Promise.all([contentService.schema(), contentService.all()]);

export default function ContentPages() {
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();
  const { data, loading, error, reload } = useAsync(loadAll);
  const [saved, setSaved] = useState({});
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [q, setQ] = useState('');

  const sections = useMemo(() => (Array.isArray(data?.[0]) ? data[0] : null), [data]);
  useEffect(() => {
    if (!sections) return;
    setSaved(Object.fromEntries(sections.map((s) => [s.key, normalize(s.fields, data[1]?.[s.key] ?? s.defaults)])));
  }, [sections, data]);

  const selectedKey = params.get('section');
  const section = useMemo(() => sections?.find((s) => s.key === selectedKey) || null, [sections, selectedKey]);

  // Desktop: open the first section automatically.
  useEffect(() => {
    if (!sections?.length) return;
    if (!selectedKey || !sections.some((s) => s.key === selectedKey)) {
      if (window.matchMedia?.('(min-width: 1000px)').matches) setParams({ section: sections[0].key }, { replace: true });
    }
  }, [sections, selectedKey, setParams]);

  // Rebuild the draft when the section (or its saved copy on first load) changes.
  const savedForSection = section ? saved[section.key] : undefined;
  useEffect(() => {
    setDraft(savedForSection ?? null);
    // only when switching sections or once the saved copy arrives
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section?.key, savedForSection === undefined]);

  const dirty = !!(section && draft && savedForSection && !same(draft, savedForSection));
  useUnloadGuard(dirty);

  const isDefault = useCallback((s) => !saved[s.key] || same(saved[s.key], normalize(s.fields, s.defaults)), [saved]);

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const map = new Map();
    (sections || []).forEach((s) => {
      if (needle && !`${s.label} ${s.group} ${s.key} ${(s.fields || []).map((f) => f.label).join(' ')}`.toLowerCase().includes(needle)) return;
      const g = s.group || 'Other';
      if (!map.has(g)) map.set(g, []);
      map.get(g).push(s);
    });
    return [...map.entries()];
  }, [sections, q]);

  const editedCount = (sections || []).filter((s) => !isDefault(s)).length;

  const go = (key) => setParams(key ? { section: key } : {});
  const select = async (key) => {
    if (key === selectedKey) return;
    if (dirty) {
      const ok = await confirm({
        title: 'Discard unsaved changes?',
        message: `Your edits to “${section.label}” haven't been saved and will be lost.`,
        confirmLabel: 'Discard changes', cancelLabel: 'Keep editing', danger: true,
      });
      if (!ok) return;
      setDraft(savedForSection);
    }
    go(key);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = async () => {
    if (!section || saving) return;
    const bad = findBadLink(section.fields, draft);
    if (bad) {
      toast.error('Fix the link before saving', `${bad}: must start with / or https://`);
      return;
    }
    setSaving(true);
    try {
      const merged = await contentService.save(section.key, draft);
      const next = normalize(section.fields, merged);
      setSaved((s) => ({ ...s, [section.key]: next }));
      setDraft(next);
      toast.success(`${section.label} saved`, 'Live on the website after a refresh.');
    } catch (err) {
      toast.error('Could not save', err.message);
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (!section) return;
    const ok = await confirm({
      title: `Reset “${section.label}”?`,
      message: 'This throws away every change made to this section and puts back the original website text. It can’t be undone.',
      confirmLabel: 'Reset to default', danger: true,
    });
    if (!ok) return;
    setResetting(true);
    try {
      const defaults = await contentService.reset(section.key);
      const next = normalize(section.fields, defaults ?? section.defaults);
      setSaved((s) => ({ ...s, [section.key]: next }));
      setDraft(next);
      toast.success(`${section.label} reset`, 'The original website text is back.');
    } catch (err) {
      toast.error('Could not reset', err.message);
    } finally {
      setResetting(false);
    }
  };

  const path = section ? sitePath(section) : null;

  return (
    <Page
      title="Page content"
      description="Edit the words, pictures and links on every page of the website. Changes go live as soon as you save."
    >
      <Loader loading={loading && !data} error={!data ? error : ''} onRetry={reload} rows={8}>
        {sections && sections.length === 0 && (
          <Card><EmptyState icon="layout" title="No editable sections">The server has no website sections registered yet.</EmptyState></Card>
        )}
        {sections && sections.length > 0 && (
          <div className={`w-split ${section ? 'has-section' : ''}`}>
            <Card className="w-secnav" title="Sections" subtitle={`${sections.length} sections · ${editedCount} edited`}>
              <div className="w-secnav-search">
                <Input icon="search" placeholder="Find a section or field…" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <div className="w-secnav-list">
                {groups.length === 0 && <p className="u-small u-muted" style={{ padding: 12 }}>No section matches “{q}”.</p>}
                {groups.map(([group, list]) => {
                  const edited = list.filter((s) => !isDefault(s)).length;
                  return (
                    <div key={group} className="w-secnav-group">
                      <div className="w-secnav-ghead">
                        {group}
                        <span className="u-tag" title={`${edited} of ${list.length} edited`}>{edited ? `${edited}/` : ''}{list.length}</span>
                      </div>
                      {list.map((s) => {
                        const unsaved = s.key === selectedKey && dirty;
                        const edited1 = !isDefault(s);
                        return (
                          <button key={s.key} type="button" className={`w-secnav-item ${s.key === selectedKey ? 'on' : ''}`} onClick={() => select(s.key)}>
                            <span>{s.label}</span>
                            {unsaved ? <span className="w-edited unsaved" title="Unsaved changes" /> : edited1 ? <span className="w-edited" title="Edited — differs from the original" /> : null}
                            <Icon name="cright" />
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
              <div className="u-row u-xs u-muted" style={{ padding: '10px 16px', borderTop: '1px solid var(--u-line)', gap: 14 }}>
                <span className="u-row" style={{ gap: 6 }}><span className="w-edited" /> Edited</span>
                <span className="u-row" style={{ gap: 6 }}><span className="w-edited unsaved" /> Unsaved</span>
              </div>
            </Card>

            <section className="u-card w-editor">
              {section && draft ? (
                <>
                  <div className="w-editor-head">
                    <div className="u-stack tight" style={{ gap: 4, minWidth: 0, flex: '1 1 240px' }}>
                      <button type="button" className="u-page-eyebrow w-back" onClick={() => select(null)}><Icon name="cleft" />All sections</button>
                      <span className="u-xs">{section.group}</span>
                      <div className="u-row" style={{ gap: 8 }}>
                        <h2>{section.label}</h2>
                        {dirty ? <Status tone="amber">Unsaved</Status> : isDefault(section) ? <Status tone="gray">Original text</Status> : <Status tone="brand">Edited</Status>}
                      </div>
                      <span className="u-small u-muted">{countFields(section.fields)} fields{path && pathNote[section.key] ? ` · ${pathNote[section.key]}` : ''}</span>
                    </div>
                    {path && (
                      <Button as="a" size="sm" href={`${STOREFRONT_URL}${path}`} target="_blank" rel="noreferrer" icon="external">View on website</Button>
                    )}
                  </div>
                  <div className="w-editor-body">
                    <FieldsForm key={section.key} fields={section.fields} value={draft} onChange={setDraft} />
                  </div>
                  <div className="w-editor-foot">
                    <Button variant="ghost" size="sm" icon="refresh" onClick={reset} loading={resetting} disabled={saving || isDefault(section)}>Reset to default</Button>
                    <span className="u-spacer" />
                    {dirty && <Button size="sm" onClick={() => setDraft(savedForSection)} disabled={saving}>Undo changes</Button>}
                    <Button variant="primary" size="sm" icon="check" onClick={save} loading={saving} disabled={!dirty}>Save changes</Button>
                  </div>
                </>
              ) : (
                <EmptyState icon="edit" title="Choose a section to edit">Pick any part of the website on the left to change its text, pictures and links.</EmptyState>
              )}
            </section>
          </div>
        )}
      </Loader>
    </Page>
  );
}
