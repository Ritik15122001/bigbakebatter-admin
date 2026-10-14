import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/common/Icon';
import {
  Page, Card, Button, Field, Input, Textarea, Segmented, Status, KeyValue, Loader, ImageUpload, Alert, Cell,
  EmptyState, useConfirm, toast, useAsync,
} from '../ui';
import { RichPreview, SaveBar } from '../ui/ext-web';
import { STOREFRONT_URL, copyText, useUnloadGuard } from '../ui/ext-web-utils';
import { blogService } from '../services/blogService';
import { adminService } from '../services/adminService';
import { resolveImg } from '../utils/media';
import { fmtDate, fmtDateTime, fmtRelative } from '../utils/format';

const EMPTY = { title: '', cat: 'Guides', excerpt: '', body: '', img: '', status: 'Draft', read: '4 min' };
const FIELDS = Object.keys(EMPTY);
const pick = (p) => Object.fromEntries(FIELDS.map((k) => [k, p?.[k] ?? EMPTY[k]]));
const words = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;
const estimate = (body) => `${Math.max(1, Math.round(words(body) / 200))} min`;
const EXCERPT_MAX = 220;

export default function BlogEditor() {
  const { id } = useParams();
  const isNew = id === 'new';
  const load = useCallback(() => (isNew ? Promise.resolve(null) : Promise.all([blogService.get(id), blogService.list(), adminService.listComments().catch(() => [])])), [id, isNew]);
  const { data, loading, error, reload } = useAsync(load, [load]);
  const loadCats = useCallback(() => (isNew ? blogService.list() : Promise.resolve([])), [isNew]);
  const listForCats = useAsync(loadCats, [loadCats]);

  if (!isNew && (loading || error || !data)) {
    return (
      <Page title={error ? 'Post not found' : 'Loading post…'} back="/blog" eyebrow="Blog">
        <Loader loading={loading && !data} error={error} onRetry={reload} rows={8}>{null}</Loader>
      </Page>
    );
  }
  const post = isNew ? null : data[0];
  const all = isNew ? listForCats.data || [] : data[1];
  const comments = isNew ? [] : (data[2] || []).filter((c) => (c.post?._id || c.post) === id);
  return <Editor key={id} post={post} allPosts={all} comments={comments} />;
}

function Editor({ post, allPosts, comments }) {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const isNew = !post;
  const [current, setCurrent] = useState(post);
  const [form, setForm] = useState(() => pick(post || EMPTY));
  const [base, setBase] = useState(() => JSON.stringify(pick(post || EMPTY)));
  const [mode, setMode] = useState('write');
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);
  const dirty = JSON.stringify(form) !== base;
  useUnloadGuard(dirty);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const cats = useMemo(() => [...new Set(['Guides', ...allPosts.map((p) => p.cat).filter(Boolean)])].sort(), [allPosts]);
  const titleError = !form.title.trim() ? 'Give the post a title' : '';
  const wc = words(form.body);
  const url = current ? `${STOREFRONT_URL}/blog/${current._id}` : '';

  const save = useCallback(async (overrides = {}) => {
    const next = { ...form, ...overrides };
    setTried(true);
    if (!next.title.trim()) {
      toast.error('Give the post a title first');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...next, title: next.title.trim(), cat: next.cat.trim() || 'Guides', read: next.read.trim() || estimate(next.body) };
      const saved = isNew && !current ? await blogService.create(payload) : await blogService.update(current._id, payload);
      setCurrent(saved);
      const p = pick(saved);
      setForm(p);
      setBase(JSON.stringify(p));
      toast.success(
        isNew && !current ? 'Post created' : 'Post saved',
        saved.status === 'Published' ? 'Live on the blog.' : 'Saved as a draft — not visible on the website yet.'
      );
      if (isNew && !current) navigate(`/blog/${saved._id}`, { replace: true });
    } catch (e) {
      toast.error('Could not save the post', e.message);
    } finally {
      setSaving(false);
    }
  }, [form, isNew, current, navigate]);

  // ⌘S / Ctrl+S saves.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (!saving) save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save, saving]);

  const remove = async () => {
    if (!(await confirm({ title: 'Delete this post?', message: `“${current.title}” will be removed from the blog permanently.`, confirmLabel: 'Delete post', danger: true }))) return;
    try {
      await blogService.remove(current._id);
      setBase(JSON.stringify(form)); // nothing left to guard
      toast.success('Post deleted');
      navigate('/blog');
    } catch (e) {
      toast.error('Could not delete', e.message);
    }
  };

  const back = async () => {
    if (dirty && !(await confirm({ title: 'Leave without saving?', message: 'Your changes to this post will be lost.', confirmLabel: 'Discard changes', cancelLabel: 'Keep editing', danger: true }))) return;
    navigate('/blog');
  };

  const copyLink = async () => {
    if (await copyText(url)) toast.success('Link copied', url);
    else toast.error('Could not copy the link');
  };

  return (
    <Page
      title={form.title.trim() || (isNew ? 'New post' : 'Untitled post')}
      eyebrow={<span onClick={(e) => { e.stopPropagation(); back(); }}>Blog</span>}
      back="/blog"
      badge={<span style={{ marginLeft: 10, verticalAlign: 'middle', display: 'inline-flex' }}><Status>{form.status}</Status></span>}
      description={current ? `Created ${fmtDate(current.createdAt)} · last saved ${fmtRelative(current.updatedAt)}` : 'Write a new article for the blog. It stays a draft until you publish it.'}
      actions={
        <>
          {current?.status === 'Published' && <Button as="a" href={url} target="_blank" rel="noreferrer" icon="external">View on website</Button>}
          {form.status === 'Draft'
            ? <Button icon="eye" onClick={() => save({ status: 'Published' })} loading={saving}>Publish</Button>
            : current?.status === 'Published' && <Button icon="eyeoff" onClick={() => save({ status: 'Draft' })} loading={saving}>Unpublish</Button>}
          <Button variant="primary" icon="check" onClick={() => save()} loading={saving} disabled={!dirty && !isNew}>Save</Button>
        </>
      }
    >
      <div className="u-grid main-side">
        <div className="u-stack">
          <Card>
            <div className="u-stack tight" style={{ gap: 14 }}>
              <textarea
                className="w-title-input"
                rows={2}
                value={form.title}
                onChange={set('title')}
                placeholder="Post title"
                aria-label="Title"
                autoFocus={isNew}
              />
              {tried && titleError && <span className="u-error">{titleError}</span>}
              <Field label="Excerpt" hint={<span className={form.excerpt.length > EXCERPT_MAX ? 'u-error' : ''}>Shown on blog cards and in search results · {form.excerpt.length}/{EXCERPT_MAX}</span>}>
                {(fid) => <Textarea id={fid} rows={2} value={form.excerpt} onChange={set('excerpt')} placeholder="A one or two line summary that makes people want to read on" style={{ minHeight: 70 }} />}
              </Field>
            </div>
          </Card>

          <Card
            title="Article"
            subtitle={`${wc} word${wc === 1 ? '' : 's'} · about ${estimate(form.body)} to read`}
            actions={<Segmented value={mode} onChange={setMode} items={[{ value: 'write', label: 'Write' }, { value: 'preview', label: 'Preview' }]} />}
          >
            {mode === 'write' ? (
              <div className="u-stack tight">
                <Textarea className="w-body-input" value={form.body} onChange={set('body')} placeholder={'Write the full article here.\n\nLeave a blank line between paragraphs. Start a line with "## " for a sub-heading and "- " for a bullet point.'} />
                <span className="u-hint">Blank line = new paragraph · “## ” = sub-heading · “- ” = bullet point · ⌘S / Ctrl+S saves</span>
              </div>
            ) : (
              <article className="w-article">
                {form.img && <img className="w-article-cover" src={resolveImg(form.img)} alt="" />}
                <h1>{form.title || 'Untitled post'}</h1>
                <div className="w-article-meta">{form.cat} · {form.read || estimate(form.body)} read · {fmtDate(current?.createdAt || new Date())}</div>
                {form.excerpt && <p className="w-article-lede">{form.excerpt}</p>}
                <RichPreview text={form.body} />
              </article>
            )}
          </Card>

          <Card title="Cover image" subtitle="Shown at the top of the article and on blog cards. Landscape works best (about 1600 × 900).">
            <ImageUpload value={form.img} onChange={(img) => setForm((f) => ({ ...f, img }))} />
          </Card>
        </div>

        <div className="u-stack">
          <Card title="Publishing" icon="eye">
            <div className="u-stack tight" style={{ gap: 14 }}>
              <Segmented value={form.status} onChange={(status) => setForm((f) => ({ ...f, status }))} items={[{ value: 'Draft', label: 'Draft' }, { value: 'Published', label: 'Published' }]} />
              <span className="u-small u-muted">{form.status === 'Published' ? 'Visible to everyone on the blog once saved.' : 'Only admins can see drafts.'}</span>
              {current && (
                <KeyValue
                  items={[
                    ['Status', <Status key="s">{current.status}</Status>],
                    ['Views', Number(current.views || 0).toLocaleString('en-IN')],
                    ['Created', fmtDateTime(current.createdAt)],
                    ['Last saved', fmtDateTime(current.updatedAt)],
                  ]}
                />
              )}
            </div>
          </Card>

          <Card title="Details" icon="tag">
            <div className="u-stack tight" style={{ gap: 14 }}>
              <Field label="Category" hint="Pick an existing one or type a new one.">
                {(fid) => (
                  <>
                    <Input id={fid} list="blog-cats" value={form.cat} onChange={set('cat')} placeholder="e.g. Guides" />
                    <datalist id="blog-cats">{cats.map((c) => <option key={c} value={c} />)}</datalist>
                  </>
                )}
              </Field>
              <Field label="Read time" hint={`Estimate from the text: ${estimate(form.body)}`}>
                {(fid) => (
                  <div className="u-row" style={{ flexWrap: 'nowrap' }}>
                    <Input id={fid} value={form.read} onChange={set('read')} placeholder="4 min" />
                    <Button onClick={() => setForm((f) => ({ ...f, read: estimate(f.body) }))}>Use estimate</Button>
                  </div>
                )}
              </Field>
            </div>
          </Card>

          <Card title="Link" icon="link">
            {current ? (
              <div className="u-stack tight">
                <div className="w-slug"><Icon name="link" /><span className="u-mono">{url.replace(/^https?:\/\//, '')}</span></div>
                <div className="u-row">
                  <Button size="sm" icon="copy" onClick={copyLink}>Copy link</Button>
                  <Button size="sm" as="a" href={url} target="_blank" rel="noreferrer" icon="external">Open</Button>
                </div>
                {current.status !== 'Published' && <Alert tone="amber" icon="info">Drafts aren’t public yet — this link works once the post is published.</Alert>}
              </div>
            ) : (
              <p className="u-small u-muted">The post gets its web address when you save it for the first time.</p>
            )}
          </Card>

          {current && (
            <Card title="Comments" icon="msg" subtitle={`${comments.length} on this post`} flush actions={comments.length > 0 && <button className="u-link u-small" onClick={() => navigate('/blog?tab=comments')}>Moderate</button>}>
              {comments.length === 0 ? (
                <EmptyState icon="msg" title="No comments yet">Reader comments on this article will show here.</EmptyState>
              ) : (
                <div className="u-list">
                  {comments.slice(0, 5).map((c) => (
                    <div className="u-list-item" key={c._id}>
                      <Cell avatar={c.name} title={c.name} sub={`${c.text.slice(0, 60)}${c.text.length > 60 ? '…' : ''}`} />
                      <span className="u-spacer" />
                      {c.hidden && <Status size="sm" tone="gray">Hidden</Status>}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {current && (
            <Card title="Delete post" subtitle="Removes the article from the website permanently.">
              <Button variant="danger-soft" icon="trash" onClick={remove} block>Delete this post</Button>
            </Card>
          )}
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <SaveBar
          dirty={dirty || (isNew && !current)}
          saving={saving}
          onSave={() => save()}
          onDiscard={dirty && current ? () => setForm(JSON.parse(base)) : undefined}
          saveLabel={isNew && !current ? 'Create post' : 'Save changes'}
          note={form.status === 'Published' ? 'Saving publishes these changes immediately.' : 'Saved as a draft — not visible on the website.'}
        />
      </div>
    </Page>
  );
}
