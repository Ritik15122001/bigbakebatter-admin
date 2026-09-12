import { useEffect, useState } from 'react';
import Modal from '../components/common/Modal';
import { enquiryService } from '../services/enquiryService';
import { useUiStore } from '../store/uiStore';

const STATUS_OPTS = ['New', 'Quoted', 'Closed'];

export default function Enquiries() {
  const pushToast = useUiStore((s) => s.pushToast);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null);

  useEffect(() => {
    enquiryService
      .list()
      .then(setList)
      .catch((e) => pushToast({ title: 'Failed to load enquiries', subtitle: e.message, kind: 'err' }))
      .finally(() => setLoading(false));
  }, []);

  const setStatus = async (id, status) => {
    try {
      const updated = await enquiryService.updateStatus(id, status);
      setList((prev) => prev.map((e) => (e._id === id ? updated : e)));
      pushToast({ title: `Enquiry marked ${status}`, kind: 'ok' });
    } catch (e) {
      pushToast({ title: 'Could not update enquiry', subtitle: e.message, kind: 'err' });
    }
  };

  return (
    <div className="a-panel">
      <div className="a-panel-head">
        <h3>Custom cake enquiries</h3>
      </div>

      {loading ? (
        <div className="a-empty"><p className="muted">Loading…</p></div>
      ) : (
        <div className="a-table-wrap">
          <table className="tbl">
            <thead>
              <tr><th>Enquiry</th><th>Occasion</th><th>Date needed</th><th>Budget</th><th>Status</th></tr>
            </thead>
            <tbody>
              {list.map((e) => (
                <tr key={e._id}>
                  <td onClick={() => setActive(e)}>
                    <span className="cell-main">{e.name}</span>
                    <span className="cell-sub">{e.code}</span>
                  </td>
                  <td onClick={() => setActive(e)}>{e.occasion}</td>
                  <td onClick={() => setActive(e)}>{e.date}</td>
                  <td onClick={() => setActive(e)}>{e.budget}</td>
                  <td onClick={(ev) => ev.stopPropagation()}>
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
      )}

      <Modal open={!!active} onClose={() => setActive(null)} kicker="Enquiry" title={active?.code}>
        {active && (
          <div className="stack gap-4">
            <div className="sum-row"><span>Name</span><span>{active.name}</span></div>
            <div className="sum-row"><span>Contact</span><span>{active.phone}</span></div>
            <div className="sum-row"><span>Email</span><span>{active.email}</span></div>
            <div className="sum-row"><span>Occasion</span><span>{active.occasion}</span></div>
            <div className="sum-row"><span>Guests</span><span>{active.guests}</span></div>
            <div className="sum-row"><span>Budget</span><span>{active.budget}</span></div>
            <div className="sum-row"><span>Reference files</span><span>{active.files}</span></div>
            <div>
              <p className="small muted" style={{ marginBottom: 4 }}>Brief</p>
              <p className="small">{active.note}</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
