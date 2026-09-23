import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from './Icon';
import { notificationService } from '../../services/notificationService';
import { fmtRelative } from '../../utils/format';

const POLL_MS = 12000;
const TYPE_ICON = { order: 'bag', payment: 'card', payment_failed: 'alert', refund: 'refresh', enquiry: 'msg', lowstock: 'alert' };
const TYPE_TONE = { order: 'success', payment: 'success', payment_failed: 'err', refund: 'warn', enquiry: 'neutral', lowstock: 'warn' };

/** Two-tone chime via the Web Audio API — no audio asset to ship or load. */
function playChime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const tones = [880, 1175];
    tones.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = ctx.currentTime + i * 0.11;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.32);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.34);
    });
    setTimeout(() => ctx.close(), 700);
  } catch {
    // Web Audio unsupported/blocked — silently skip the chime.
  }
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const lastSeenId = useRef(null);
  const firstLoad = useRef(true);
  const boxRef = useRef(null);

  const poll = () => {
    notificationService
      .list()
      .then(({ items: list, unreadCount: unread }) => {
        setItems(list);
        setUnreadCount(unread);
        const newestId = list[0]?._id || null;
        if (!firstLoad.current && newestId && newestId !== lastSeenId.current && !list[0].read) {
          playChime();
          if (document.hidden && Notification?.permission === 'granted') {
            const n = new Notification(list[0].title, { body: list[0].message, tag: newestId });
            n.onclick = () => window.focus();
          }
        }
        lastSeenId.current = newestId;
        firstLoad.current = false;
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (window.Notification && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
    poll();
    const id = setInterval(poll, POLL_MS);
    const onVisible = () => { if (!document.hidden) poll(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const openItem = (n) => {
    setOpen(false);
    if (!n.read) {
      notificationService.markRead(n._id).catch(() => {});
      setItems((prev) => prev.map((x) => (x._id === n._id ? { ...x, read: true } : x)));
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    if (n.link) navigate(n.link);
  };

  const markAllRead = () => {
    notificationService.markAllRead().catch(() => {});
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
    setUnreadCount(0);
  };

  return (
    <div className="notif-box" ref={boxRef}>
      <button className="notif-bell" aria-label="Notifications" onClick={() => setOpen((v) => !v)}>
        <Icon name="bell" className="icon icon-sm" />
        {unreadCount > 0 && <span className="notif-dot">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>
      {open && (
        <div className="notif-panel">
          <div className="notif-panel-head">
            <b>Notifications</b>
            {unreadCount > 0 && (
              <button className="link-underline tiny" onClick={markAllRead}>Mark all read</button>
            )}
          </div>
          <div className="notif-list">
            {items.length === 0 ? (
              <div className="notif-empty">
                <Icon name="bell" className="icon icon-lg" />
                <p className="muted small">You&rsquo;re all caught up.</p>
              </div>
            ) : (
              items.map((n) => (
                <button className={`notif-item ${n.read ? '' : 'unread'}`} key={n._id} onClick={() => openItem(n)}>
                  <span className={`notif-ico ${TYPE_TONE[n.type] || 'neutral'}`}>
                    <Icon name={TYPE_ICON[n.type] || 'bell'} className="icon icon-sm" />
                  </span>
                  <span className="notif-text">
                    <b>{n.title}</b>
                    {n.message && <span className="notif-msg">{n.message}</span>}
                    <span className="notif-time">{fmtRelative(n.createdAt)}</span>
                  </span>
                  {!n.read && <span className="notif-unread-dot" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
