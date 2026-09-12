import { useEffect, useState } from 'react';
import Icon from '../components/common/Icon';
import Modal from '../components/common/Modal';
import { blogService } from '../services/blogService';
import { uploadService } from '../services/uploadService';
import { useUiStore } from '../store/uiStore';

const EMPTY = { title: '', cat: 'Guides', excerpt: '', body: '', status: 'Draft', img: '' };

export default function BlogAdmin() {
  const pushToast = useUiStore((s) => s.pushToast);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const load = () => {
    setLoading(true);
    blogService.list().then(setList).catch((e) => pushToast({ title: 'Failed to load blog', subtitle: e.message, kind: 'err' })).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const togglePublish = async (post) => {
    const status = post.status === 'Published' ? 'Draft' : 'Published';
    try {
      const updated = await blogService.update(post._id, { status });
      setList((prev) => prev.map((p) => (p._id === post._id ? updated : p)));
    } catch (e) {
      pushToast({ title: 'Could not update status', subtitle: e.message, kind: 'err' });
    }
  };

  const openAdd = () => {
    setEditing('new');
    setForm(EMPTY);
  };
  const openEdit = (b) => {
    setEditing(b._id);
    setForm({ title: b.title, cat: b.cat, excerpt: b.excerpt, body: b.body || '', status: b.status, img: b.img || '' });
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadService.upload(file);
      setForm((f) => ({ ...f, img: url }));
    } catch (err) {
      pushToast({ title: 'Upload failed', subtitle: err.message, kind: 'err' });
    } finally {
      setUploading(false);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      pushToast({ title: 'Enter a title', kind: 'err' });
      return;
    }
    try {
      if (editing === 'new') {
        await blogService.create(form);
        pushToast({ title: 'Article created', kind: 'ok' });
      } else {
        await blogService.update(editing, form);
        pushToast({ title: 'Article updated', kind: 'ok' });
      }
      setEditing(null);
      load();
    } catch (err) {
      pushToast({ title: 'Save failed', subtitle: err.message, kind: 'err' });
    }
  };

  const confirmDelete = async () => {
    try {
      await blogService.remove(deleting._id);
      pushToast({ title: 'Article deleted', kind: 'info' });
      setDeleting(null);
      load();
    } catch (err) {
      pushToast({ title: 'Delete failed', subtitle: err.message, kind: 'err' });
    }
  };

  return (
    <div className="a-panel">
      <div className="a-panel-head">
        <h3>Blog articles</h3>
        <button className="btn btn-primary btn-sm" onClick={openAdd}>
          <Icon name="plus" className="icon icon-sm" />
          New article
        </button>
      </div>

      {loading ? (
        <div className="a-empty"><p className="muted">Loading…</p></div>
      ) : (
        <div className="a-table-wrap">
          <table className="tbl">
            <thead>
              <tr><th>Article</th><th>Category</th><th>Date</th><th>Views</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {list.map((b) => (
                <tr key={b._id}>
                  <td>
                    <span className="row gap-3 center">
                      <span style={{ width: 40, height: 40, borderRadius: 8, overflow: 'hidden', flex: 'none', background: 'var(--c-bg-warm)' }}>
                        {b.img && <img src={b.img} alt={b.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                      </span>
                      <span className="cell-main">{b.title}</span>
                    </span>
                  </td>
                  <td>{b.cat}</td>
                  <td>{new Date(b.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  <td>{(b.views || 0).toLocaleString('en-IN')}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button className={`badge ${b.status === 'Published' ? 'success' : 'neutral'}`} onClick={() => togglePublish(b)} style={{ cursor: 'pointer' }}>
                      {b.status}
                    </button>
                  </td>
                  <td className="rowact">
                    <button className="iconbtn" aria-label="Edit" onClick={() => openEdit(b)}>
                      <Icon name="edit" className="icon icon-sm" />
                    </button>
                    <button className="iconbtn danger" aria-label="Delete" onClick={() => setDeleting(b)}>
                      <Icon name="x" className="icon icon-sm" />
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
        kicker={editing === 'new' ? 'New article' : 'Edit article'}
        title={editing === 'new' ? 'Write a new article' : form.title}
        foot={<button className="btn btn-primary btn-block" onClick={save}>Save article</button>}
      >
        <form className="stack gap-4" onSubmit={save}>
          <div className="field">
            <label>Cover photo</label>
            <label className="dropzone" style={{ display: 'block', padding: 16 }}>
              {uploading ? 'Uploading…' : form.img ? 'Change photo' : 'Click to upload a cover photo'}
              <input type="file" accept="image/*" className="sr-only" onChange={handleFile} />
            </label>
            {form.img && (
              <span style={{ display: 'block', width: 120, height: 68, borderRadius: 8, overflow: 'hidden', marginTop: 8 }}>
                <img src={form.img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </span>
            )}
          </div>
          <div className="field">
            <label>Title</label>
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. How to keep a cake fresh for longer" />
          </div>
          <div className="form-grid two">
            <div className="field">
              <label>Category</label>
              <input className="input" value={form.cat} onChange={(e) => setForm({ ...form, cat: e.target.value })} placeholder="e.g. Guides" />
            </div>
            <div className="field">
              <label>Status</label>
              <select className="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option>Draft</option>
                <option>Published</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label>Excerpt</label>
            <textarea className="textarea" rows={2} value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} placeholder="A short one-line summary shown in blog listings" />
          </div>
          <div className="field">
            <label>Body</label>
            <textarea className="textarea" rows={6} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Write the full article here…" />
          </div>
        </form>
      </Modal>

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        kicker="Confirm"
        title={`Delete "${deleting?.title}"?`}
        foot={
          <>
            <button className="btn btn-ghost" onClick={() => setDeleting(null)}>Cancel</button>
            <button className="btn btn-primary" style={{ background: 'var(--c-error)' }} onClick={confirmDelete}>Delete</button>
          </>
        }
      >
        <p className="muted">This removes the article permanently.</p>
      </Modal>
    </div>
  );
}
