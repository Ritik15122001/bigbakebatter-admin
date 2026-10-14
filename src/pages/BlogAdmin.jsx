import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Page, Card, Stat, Button, Tabs, DataTable, Cell, Status, Avatar, Drawer, KeyValue, EmptyState, Loader,
  useConfirm, toast, useAsync,
} from '../ui';
import { STOREFRONT_URL } from '../ui/ext-web-utils';
import { blogService } from '../services/blogService';
import { adminService } from '../services/adminService';
import { fmtDate, fmtDateTime, fmtRelative } from '../utils/format';

const num = (n) => Number(n || 0).toLocaleString('en-IN');
const loadAll = () => Promise.all([blogService.list(), adminService.listComments().catch(() => null)]);

export default function BlogAdmin() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'comments' ? 'comments' : 'posts';
  const { data, setData, loading, error, reload } = useAsync(loadAll);
  const posts = useMemo(() => data?.[0] || [], [data]);
  const comments = useMemo(() => data?.[1] || [], [data]);
  const setPosts = (fn) => setData((d) => [fn(d[0]), d[1]]);
  const setComments = (fn) => setData((d) => [d[0], fn(d[1] || [])]);
  const hiddenCount = comments.filter((c) => c.hidden).length;

  return (
    <Page
      title="Blog"
      description="Write articles for the website’s journal and moderate what readers say about them."
      actions={
        <>
          <Button as="a" href={`${STOREFRONT_URL}/blog`} target="_blank" rel="noreferrer" icon="external">View blog</Button>
          <Button variant="primary" icon="plus" onClick={() => navigate('/blog/new')}>New post</Button>
        </>
      }
      tabs={
        <Tabs
          value={tab}
          onChange={(v) => setParams(v === 'posts' ? {} : { tab: v }, { replace: true })}
          items={[
            { value: 'posts', label: 'Posts', icon: 'news', count: data ? posts.length : null },
            { value: 'comments', label: 'Comments', icon: 'msg', count: data ? comments.length : null },
          ]}
        />
      }
    >
      <Loader loading={loading && !data} error={!data ? error : ''} onRetry={reload} rows={6}>
        {data && (tab === 'posts'
          ? <PostsTab posts={posts} comments={comments} setPosts={setPosts} />
          : <CommentsTab comments={comments} commentsFailed={data[1] === null} setComments={setComments} hiddenCount={hiddenCount} onRetry={reload} />)}
      </Loader>
    </Page>
  );
}

/* ---------------- Posts ---------------- */

function PostsTab({ posts, comments, setPosts }) {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const published = posts.filter((p) => p.status === 'Published');
  const views = posts.reduce((s, p) => s + (p.views || 0), 0);
  const top = [...published].sort((a, b) => (b.views || 0) - (a.views || 0))[0];
  const cats = [...new Set(posts.map((p) => p.cat).filter(Boolean))].sort();
  const commentCount = useMemo(() => {
    const m = {};
    comments.forEach((c) => { const id = c.post?._id || c.post; m[id] = (m[id] || 0) + 1; });
    return m;
  }, [comments]);

  const setStatus = async (p, status) => {
    try {
      const updated = await blogService.update(p._id, { status });
      setPosts((list) => list.map((x) => (x._id === p._id ? updated : x)));
      toast.success(status === 'Published' ? 'Post published' : 'Moved to drafts', status === 'Published' ? 'It’s now live on the blog.' : 'It’s hidden from the website.');
    } catch (e) {
      toast.error('Could not update the post', e.message);
    }
  };

  const remove = async (p) => {
    if (!(await confirm({ title: 'Delete this post?', message: `“${p.title}” and its place on the blog will be removed permanently.`, confirmLabel: 'Delete post', danger: true }))) return;
    try {
      await blogService.remove(p._id);
      setPosts((list) => list.filter((x) => x._id !== p._id));
      toast.success('Post deleted');
    } catch (e) {
      toast.error('Could not delete', e.message);
    }
  };

  return (
    <div className="u-stack">
      <div className="u-grid cols-4">
        <Stat label="Published" icon="eye" tone="green" value={published.length} note="live on the website" />
        <Stat label="Drafts" icon="file" tone="amber" value={posts.length - published.length} note="not visible yet" />
        <Stat label="Total views" icon="trend" tone="brand" value={num(views)} note={top ? `Top: ${top.title.slice(0, 32)}${top.title.length > 32 ? '…' : ''}` : 'across all posts'} />
        <Stat label="Comments" icon="msg" tone="violet" value={comments.length} note={`${comments.filter((c) => c.hidden).length} hidden`} />
      </div>

      <Card flush>
        <DataTable
          rows={posts}
          onRowClick={(p) => navigate(`/blog/${p._id}`)}
          highlight={(p) => p.status === 'Draft'}
          exportName="blog-posts"
          initialSort={{ key: 'createdAt', dir: 'desc' }}
          search={{ placeholder: 'Search title, category or excerpt…', fields: ['title', 'cat', 'excerpt'] }}
          filters={[
            { key: 'status', label: 'All statuses', options: ['Published', 'Draft'] },
            { key: 'cat', label: 'All categories', options: cats },
          ]}
          empty={
            <EmptyState icon="news" title="No posts yet" actions={<Button variant="primary" icon="plus" onClick={() => navigate('/blog/new')}>Write the first post</Button>}>
              Blog posts help customers with cake care, ordering tips and behind-the-scenes stories — and bring visitors from search.
            </EmptyState>
          }
          columns={[
            {
              key: 'title', header: 'Post', sortable: true,
              render: (p) => <Cell thumb={p.img || null} title={p.title} sub={p.excerpt ? `${p.excerpt.slice(0, 70)}${p.excerpt.length > 70 ? '…' : ''}` : 'No excerpt'} />,
            },
            { key: 'cat', header: 'Category', sortable: true, render: (p) => <span className="u-tag">{p.cat || '—'}</span> },
            { key: 'status', header: 'Status', sortable: true, render: (p) => <Status>{p.status}</Status> },
            { key: 'views', header: 'Views', align: 'right', sortable: true, sortValue: (p) => p.views || 0, render: (p) => <span className="u-num u-strong">{num(p.views)}</span> },
            { key: 'comments', header: 'Comments', align: 'right', sortable: true, sortValue: (p) => commentCount[p._id] || 0, render: (p) => <span className="u-num">{commentCount[p._id] || 0}</span> },
            { key: 'read', header: 'Read time', render: (p) => <span className="u-small u-muted">{p.read || '—'}</span> },
            {
              key: 'createdAt', header: 'Date', sortable: true, sortValue: (p) => new Date(p.createdAt).getTime(), csv: (p) => fmtDate(p.createdAt),
              render: (p) => <Cell title={fmtDate(p.createdAt)} sub={`Edited ${fmtRelative(p.updatedAt)}`} />,
            },
          ]}
          rowActions={(p) => [
            { label: 'Edit post', icon: 'edit', onClick: () => navigate(`/blog/${p._id}`) },
            p.status === 'Published'
              ? { label: 'Move to drafts', icon: 'eyeoff', onClick: () => setStatus(p, 'Draft') }
              : { label: 'Publish now', icon: 'eye', onClick: () => setStatus(p, 'Published') },
            p.status === 'Published' && { label: 'View on website', icon: 'external', href: `${STOREFRONT_URL}/blog/${p._id}`, external: true },
            { divider: true },
            { label: 'Delete', icon: 'trash', danger: true, onClick: () => remove(p) },
          ]}
        />
      </Card>
    </div>
  );
}

/* ---------------- Comments ---------------- */

function CommentsTab({ comments, commentsFailed, setComments, hiddenCount, onRetry }) {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [open, setOpen] = useState(null);
  const postTitles = [...new Set(comments.map((c) => c.post?.title).filter(Boolean))].sort();

  if (commentsFailed) {
    return <Card><EmptyState icon="alert" title="Couldn't load comments" actions={<Button icon="refresh" onClick={onRetry}>Try again</Button>}>The comments list didn’t load. Posts are unaffected.</EmptyState></Card>;
  }

  const setHidden = async (c, hidden) => {
    try {
      const updated = await adminService.setCommentHidden(c._id, hidden);
      setComments((list) => list.map((x) => (x._id === c._id ? updated : x)));
      setOpen((o) => (o && o._id === c._id ? updated : o));
      toast.success(hidden ? 'Comment hidden' : 'Comment visible again', hidden ? 'Readers no longer see it on the article.' : 'It shows on the article again.');
    } catch (e) {
      toast.error('Could not update the comment', e.message);
    }
  };

  const remove = async (c) => {
    if (!(await confirm({ title: 'Delete this comment?', message: `${c.name}’s comment will be removed permanently. To keep it but hide it from readers, use Hide instead.`, confirmLabel: 'Delete comment', danger: true }))) return;
    try {
      await adminService.removeComment(c._id);
      setComments((list) => list.filter((x) => x._id !== c._id));
      setOpen(null);
      toast.success('Comment deleted');
    } catch (e) {
      toast.error('Could not delete', e.message);
    }
  };

  const postId = (c) => c.post?._id || c.post;

  return (
    <div className="u-stack">
      <div className="u-grid cols-3">
        <Stat label="All comments" icon="msg" tone="violet" value={comments.length} />
        <Stat label="Visible" icon="eye" tone="green" value={comments.length - hiddenCount} note="shown under articles" />
        <Stat label="Hidden" icon="eyeoff" tone="gray" value={hiddenCount} note="kept but not shown" />
      </div>
      <Card flush>
        <DataTable
          rows={comments}
          onRowClick={setOpen}
          highlight={(c) => c.hidden}
          exportName="blog-comments"
          search={{ placeholder: 'Search author, comment or post…', fields: (c) => `${c.name} ${c.text} ${c.post?.title || ''}` }}
          filters={[
            { key: 'status', label: 'All statuses', options: ['Visible', 'Hidden'], test: (c, v) => (v === 'Hidden') === !!c.hidden },
            { key: 'post', label: 'All posts', options: postTitles, test: (c, v) => c.post?.title === v },
          ]}
          empty={<EmptyState icon="msg" title="No comments yet">When readers comment on an article, their comments appear here so you can hide or remove anything inappropriate.</EmptyState>}
          columns={[
            { key: 'name', header: 'Author', sortable: true, render: (c) => <Cell avatar={c.name} title={c.name} sub={c.user ? 'Signed-in customer' : 'Guest'} /> },
            { key: 'text', header: 'Comment', render: (c) => <span className="u-small" style={{ display: 'block', maxWidth: 420, whiteSpace: 'normal' }}>{c.text.length > 140 ? `${c.text.slice(0, 140)}…` : c.text}</span> },
            { key: 'post', header: 'Post', sortable: true, sortValue: (c) => c.post?.title || '', csv: (c) => c.post?.title || 'Deleted post', render: (c) => <span className="u-small">{c.post?.title || <span className="u-muted">Deleted post</span>}</span> },
            { key: 'createdAt', header: 'Date', sortable: true, sortValue: (c) => new Date(c.createdAt).getTime(), csv: (c) => fmtDateTime(c.createdAt), render: (c) => <Cell title={fmtDate(c.createdAt)} sub={fmtRelative(c.createdAt)} /> },
            { key: 'hidden', header: 'Status', shrink: true, csv: (c) => (c.hidden ? 'Hidden' : 'Visible'), render: (c) => <Status tone={c.hidden ? 'gray' : 'green'}>{c.hidden ? 'Hidden' : 'Visible'}</Status> },
          ]}
          rowActions={(c) => [
            { label: 'View comment', icon: 'eye', onClick: () => setOpen(c) },
            c.hidden ? { label: 'Show on website', icon: 'eye', onClick: () => setHidden(c, false) } : { label: 'Hide from website', icon: 'eyeoff', onClick: () => setHidden(c, true) },
            c.post?._id && { label: 'Open post', icon: 'news', onClick: () => navigate(`/blog/${postId(c)}`) },
            { divider: true },
            { label: 'Delete', icon: 'trash', danger: true, onClick: () => remove(c) },
          ]}
        />
      </Card>

      <Drawer
        open={!!open}
        onClose={() => setOpen(null)}
        title="Comment"
        description={open ? `On “${open.post?.title || 'a deleted post'}”` : ''}
        footer={open && (
          <>
            <Button variant="danger-soft" icon="trash" onClick={() => remove(open)}>Delete</Button>
            <span className="u-spacer" />
            {open.post?._id && <Button icon="news" onClick={() => navigate(`/blog/${postId(open)}`)}>Open post</Button>}
            <Button variant="primary" icon={open.hidden ? 'eye' : 'eyeoff'} onClick={() => setHidden(open, !open.hidden)}>{open.hidden ? 'Show on website' : 'Hide from website'}</Button>
          </>
        )}
      >
        {open && (
          <div className="u-stack">
            <div className="u-row" style={{ gap: 12 }}>
              <Avatar name={open.name} size="lg" />
              <div className="u-cell-text" style={{ display: 'flex', flexDirection: 'column' }}>
                <b className="u-strong">{open.name}</b>
                <span className="u-small u-muted">{fmtDateTime(open.createdAt)}</span>
              </div>
              <span className="u-spacer" />
              <Status tone={open.hidden ? 'gray' : 'green'}>{open.hidden ? 'Hidden' : 'Visible'}</Status>
            </div>
            <Card><p style={{ whiteSpace: 'pre-wrap', fontSize: 15, lineHeight: 1.65 }}>{open.text}</p></Card>
            <KeyValue
              items={[
                ['Post', open.post?.title || 'Deleted post'],
                ['Author', open.user ? 'Signed-in customer' : 'Guest'],
                ['Posted', fmtDateTime(open.createdAt)],
                ['Visibility', open.hidden ? 'Hidden from readers' : 'Shown under the article'],
              ]}
            />
          </div>
        )}
      </Drawer>
    </div>
  );
}
