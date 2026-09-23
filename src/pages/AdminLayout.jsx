import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Icon from '../components/common/Icon';
import NotificationBell from '../components/common/NotificationBell';
import { orderService } from '../services/orderService';
import { enquiryService } from '../services/enquiryService';
import { useAuthStore } from '../store/authStore';

const NAV = [
  { to: '/', label: 'Dashboard', icon: 'home' },
  { to: '/orders', label: 'Orders', icon: 'bag' },
  { to: '/transactions', label: 'Transactions', icon: 'card' },
  { to: '/cakes', label: 'Cakes', icon: 'cake' },
  { to: '/stock', label: 'Categories & Stock', icon: 'pkg' },
  { to: '/blog', label: 'Blog', icon: 'news' },
  { to: '/customers', label: 'Customers', icon: 'user' },
  { to: '/enquiries', label: 'Enquiries', icon: 'msg' },
  { to: '/banners', label: 'Banners', icon: 'gift' },
];

const STOREFRONT_URL = 'http://localhost:5301';

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [newOrders, setNewOrders] = useState(0);
  const [newEnquiries, setNewEnquiries] = useState(0);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    orderService.list().then((orders) => setNewOrders(orders.filter((o) => o.status === 'New').length)).catch(() => {});
    enquiryService.list().then((list) => setNewEnquiries(list.filter((e) => e.status === 'New').length)).catch(() => {});
  }, [location.pathname]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  const badgeFor = (to) => {
    if (to === '/orders' && newOrders > 0) return newOrders;
    if (to === '/enquiries' && newEnquiries > 0) return newEnquiries;
    return null;
  };

  const isActive = (to) => (to === '/' ? location.pathname === '/' : location.pathname.startsWith(to));
  const current = NAV.find((n) => isActive(n.to));

  const handleSignOut = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const initial = (user?.name || 'A')[0].toUpperCase();

  return (
    <div className="admin">
      <aside className="a-side">
        <Link className="a-brand" to="/">
          <span className="brand-mark">
            <img src="/brand/logo-icon.png" alt="" />
          </span>
          <span className="brand-name">BigBakeBatter Admin</span>
        </Link>
        <nav className="a-nav">
          {NAV.map((n) => {
            const badge = badgeFor(n.to);
            return (
              <button key={n.to} className={isActive(n.to) ? 'on' : ''} onClick={() => navigate(n.to)}>
                <Icon name={n.icon} className="icon icon-sm" />
                {n.label}
                {badge && <span className="badge-n">{badge}</span>}
              </button>
            );
          })}
        </nav>
        <div className="a-side-foot">
          <a className="a-side-user" href={STOREFRONT_URL} target="_blank" rel="noreferrer" title="Open storefront">
            <span className="av">{initial}</span>
            <span className="who">
              <b>{user?.name || 'Admin'}</b>
              <span>{user?.role || 'admin'}</span>
            </span>
            <Icon name="external" className="icon icon-sm" style={{ marginLeft: 'auto', flex: 'none', color: '#8c7767' }} />
          </a>
          <button className="a-signout" onClick={handleSignOut}>
            <Icon name="logout" className="icon icon-sm" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="a-main">
        <div className="a-mobile-nav">
          {NAV.map((n) => (
            <button key={n.to} className={isActive(n.to) ? 'on' : ''} onClick={() => navigate(n.to)}>
              {n.label}
            </button>
          ))}
        </div>
        <header className="a-top">
          <h1>{current?.label || 'Admin'}</h1>
          <div className="a-top-meta">
            <span className="a-top-date">
              {now.toLocaleString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}
            </span>
            <a className="btn btn-outline btn-sm" href={STOREFRONT_URL} target="_blank" rel="noreferrer">
              <Icon name="external" className="icon icon-sm" />
              Storefront
            </a>
            <NotificationBell />
          </div>
        </header>
        <div className="a-body">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
