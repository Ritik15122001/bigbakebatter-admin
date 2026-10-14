import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Icon from '../components/common/Icon';
import NotificationBell from '../components/common/NotificationBell';
import { Avatar, CommandPalette, IconButton, Menu } from '../ui';
import { NAV, NAV_GROUPS, isActivePath } from '../nav';
import { orderService } from '../services/orderService';
import { enquiryService } from '../services/enquiryService';
import { useAuthStore } from '../store/authStore';

const STOREFRONT_URL = import.meta.env.VITE_STOREFRONT_URL || 'http://localhost:5301';
const BADGE_POLL_MS = 60000;
const COLLAPSE_KEY = 'bbb_admin_sidebar_collapsed';

function readCollapsed() {
  try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
}

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [counts, setCounts] = useState({ orders: 0, enquiries: 0 });
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Sidebar counts: on mount, every minute, and when the tab becomes visible.
  useEffect(() => {
    const refresh = () => {
      orderService.list('New').then((o) => setCounts((c) => ({ ...c, orders: o.filter((x) => x.status === 'New').length }))).catch(() => {});
      enquiryService.list().then((l) => setCounts((c) => ({ ...c, enquiries: l.filter((e) => e.status === 'New').length }))).catch(() => {});
    };
    refresh();
    const id = setInterval(() => !document.hidden && refresh(), BADGE_POLL_MS);
    const onVisible = () => !document.hidden && refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCmdOpen((o) => !o); }
    };
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('scroll', onScroll); };
  }, []);

  useEffect(() => { setMobileOpen(false); window.scrollTo(0, 0); }, [location.pathname]);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try { localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1'); } catch { /* storage unavailable */ }
      return !c;
    });
  };

  const current = NAV.find((n) => isActivePath(location.pathname, n.to));
  const signOut = () => { logout(); navigate('/login', { replace: true }); };

  const commands = [
    ...NAV.map((n) => ({ group: 'Go to', label: n.label, icon: n.icon, keywords: n.keywords, onSelect: () => navigate(n.to) })),
    { group: 'Create', label: 'New cake', icon: 'plus', keywords: 'add product', onSelect: () => navigate('/cakes/new') },
    { group: 'Create', label: 'New blog post', icon: 'plus', keywords: 'article', onSelect: () => navigate('/blog/new') },
    { group: 'Create', label: 'New coupon', icon: 'plus', keywords: 'discount', onSelect: () => navigate('/coupons?new=1') },
    { group: 'Other', label: 'Open storefront', icon: 'external', onSelect: () => window.open(STOREFRONT_URL, '_blank', 'noopener') },
    { group: 'Other', label: 'Sign out', icon: 'logout', onSelect: signOut },
  ];

  const profileMenu = [
    { heading: user?.email },
    { label: 'Team & account', icon: 'shield', onClick: () => navigate('/team') },
    { label: 'Store settings', icon: 'settings', onClick: () => navigate('/settings') },
    { label: 'Open storefront', icon: 'external', href: STOREFRONT_URL, external: true },
    { divider: true },
    { label: 'Sign out', icon: 'logout', danger: true, onClick: signOut },
  ];

  return (
    <div className={`u-app u-shell ${collapsed ? 'collapsed' : ''}`}>
      {mobileOpen && <div className="u-scrim" onClick={() => setMobileOpen(false)} />}
      <aside className={`u-sidebar ${mobileOpen ? 'open' : ''}`} aria-label="Main navigation">
        <div className="u-side-top">
          <span className="u-logo"><img src="/brand/logo-icon.png" alt="" /></span>
          <span className="u-side-name"><b>BigBakeBatter</b><span>Admin console</span></span>
          <IconButton className="u-side-collapse" icon="sidebar" label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={toggleCollapsed} />
        </div>
        <button className="u-side-search" onClick={() => setCmdOpen(true)} title="Search (⌘K)">
          <Icon name="search" />
          <span>Search…</span>
          <kbd>⌘K</kbd>
        </button>
        <nav className="u-nav">
          {NAV_GROUPS.map((g) => (
            <div className="u-nav-group" key={g.label}>
              <div className="u-nav-label">{g.label}</div>
              {g.items.map((n) => {
                const on = isActivePath(location.pathname, n.to);
                const count = n.badge ? counts[n.badge] : 0;
                return (
                  <button key={n.to} className={`u-nav-item ${on ? 'on' : ''}`} onClick={() => navigate(n.to)} title={collapsed ? n.label : undefined} aria-current={on ? 'page' : undefined}>
                    <Icon name={n.icon} />
                    <span className="u-nav-text">{n.label}</span>
                    {count > 0 && <span className="u-nav-count">{count}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="u-side-foot">
          <Menu
            up
            align="left"
            items={profileMenu}
            trigger={({ toggle }) => (
              <button className="u-profile" onClick={toggle}>
                <Avatar name={user?.name || 'Admin'} />
                <span className="u-profile-text"><b>{user?.name || 'Admin'}</b><span>{user?.email}</span></span>
                <Icon name="dotsv" className="icon u-profile-text" />
              </button>
            )}
          />
        </div>
      </aside>

      <div className="u-main">
        <header className={`u-topbar ${scrolled ? 'scrolled' : ''}`}>
          <IconButton className="u-burger" icon="menu" label="Open menu" onClick={() => setMobileOpen(true)} />
          <div className="u-crumbs">
            {current && <span className="hide-xs">{current.group}</span>}
            {current && <Icon name="cright" />}
            <b>{current?.label || 'Admin'}</b>
          </div>
          <div className="u-topbar-right">
            <IconButton icon="search" label="Search (⌘K)" onClick={() => setCmdOpen(true)} />
            <a className="u-btn sm" href={STOREFRONT_URL} target="_blank" rel="noreferrer"><Icon name="external" /><span className="hide-xs">View store</span></a>
            <NotificationBell />
          </div>
        </header>
        <main className="u-content">
          <Outlet />
        </main>
      </div>

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} items={commands} />
    </div>
  );
}
