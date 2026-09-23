import { useEffect, useMemo, useState } from 'react';
import Modal from '../components/common/Modal';
import EmptyState from '../components/common/EmptyState';
import Pagination from '../components/common/Pagination';
import { enquiryService } from '../services/enquiryService';
import { useUiStore } from '../store/uiStore';
import { fmtDateTime } from '../utils/format';

const STATUS_TABS = ['All', 'New', 'Quoted', 'Closed'];
const STATUS_OPTS = ['New', 'Quoted', 'Closed'];
const PAGE_SIZE = 10;

export default function Enquiries() {
  const pushToast = useUiStore((s) => s.pushToast);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('All');
  const [page, setPage] = useState(1);
  const [active, setActive] = useState(null);

  useEffect(() => {
    enquiryService
      .list()
      .then(setList)
      .catch((e) => pushToast({ title: 'Failed to load enquiries', subtitle: e.message, kind: 'err' }))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => (tab === 'All' ? list : list.filter((e) => e.status === tab)), [list, tab]);
  useEffect(() => setPage(1), [tab]);
  const paged = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);

  const setStatus = async (id, status) => {
    try {
      const updated = await enquiryService.updateStatus(id, status);
      setList((prev) => prev.map((e) => (e._id === id ? updated : e)));
      setActive((a) => (a && a._id === id ? updated : a));
      pushToast({ title: `Enquiry marked ${status}`, kind: 'ok' });
    } catch (e) {
      pushToast({ title: 'Could not update enquiry', subtitle: e.message, kind: 'err' });
    }
  };

  return (
    <div className="a-panel">
      <div className="a-panel-head">
        <div className="row gap-2 center" style={{ flexWrap: 'wrap' }}>
          {STATUS_TABS.map((t) => (
            <button key={t} className="mini-select" style={tab === t ? { background: 'var(--c-ink)', color: '#fff' } : undefined} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
          {!loading && <span className="a-count">{filtered.length} enquir{filtered.length === 1 ? 'y' : 'ies'}</span>}
        </div>
      </div>

      {loading ? (
        <div className="a-empty"><p className="muted">Loading enquiries…</p></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="msg" title="No enquiries match this filter" message="Try a different status tab." />
      ) : (
        <>
          <div className="a-table-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Enquiry</th><th>Occasion</th><th>Date needed</th><th>Budget</th><th className="tight">Status</th></tr>
              </thead>
              <tbody>
                {paged.map((e) => (
                  <tr key={e._id} className={e.status === 'New' ? 'row-new' : ''}>
                    <td onClick={() => setActive(e)}>
                      <span className="cell-main">{e.name}</span>
                      <span className="cell-sub">{e.code}</span>
                    </td>
                    <td onClick={() => setActive(e)}>{e.occasion}</td>
                    <td onClick={() => setActive(e)}>{e.date}</td>
                    <td onClick={() => setActive(e)}>{e.budget}</td>
                    <td className="tight" onClick={(ev) => ev.stopPropagation()}>
                      <select className="mini-select" value={e.status} onChange={(ev) => setStatus(e._id, ev.target.value)}>
                        {STATUS_OPTS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} />
        </>
      )}

      <Modal open={!!active} onClose={() => setActive(null)} kicker="Custom cake enquiry" title={active?.code} width={520}>
        {active && (
          <div className="stack gap-5">
            <div className="dv-top">
              <span className="stack gap-1">
                <b style={{ fontSize: '1.05rem' }}>{active.name}</b>
                <span className="tiny muted">{fmtDateTime(active.createdAt)}</span>
              </span>
              <select className="mini-select" value={active.status} onChange={(e) => setStatus(active._id, e.target.value)}>
                {STATUS_OPTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="dv-grid">
              <div className="dv-field"><label>Phone</label><div className="v">{active.phone}</div></div>
              <div className="dv-field"><label>Email</label><div className="v">{active.email}</div></div>
              <div className="dv-field"><label>Occasion</label><div className="v">{active.occasion}</div></div>
              <div className="dv-field"><label>Guests</label><div className="v">{active.guests || '—'}</div></div>
              <div className="dv-field"><label>Budget</label><div className="v">{active.budget || '—'}</div></div>
              <div className="dv-field"><label>Reference files</label><div className="v">{active.files || 0}</div></div>
              {active.note && <div className="dv-field full"><label>Brief</label><div className="v">{active.note}</div></div>}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
