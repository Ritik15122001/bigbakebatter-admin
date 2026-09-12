import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Icon from '../components/common/Icon';
import { orderService } from '../services/orderService';
import { enquiryService } from '../services/enquiryService';
import { useAuthStore } from '../store/authStore';

const NAV = [
  { to: '/', label: 'Dashboard', icon: 'home' },
  { to: '/orders', label: 'Orders', icon: 'bag' },
  { to: '/cakes', label: 'Cakes', icon: 'cake' },
  { to: '/stock', label: 'Categories & Stock', icon: 'pkg' },
  { to: '/blog', label: 'Blog', icon: 'news' },
  { to: '/customers', label: 'Customers', icon: 'user' },
  { to: '/enquiries', label: 'Enquiries', icon: 'msg' },
  { to: '/banners', label: 'Banners', icon: 'gift' },
];

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [newOrders, setNewOrders] = useState(0);
  const [newEnquiries, setNewEnquiries] = useState(0);

  useEffect(() => {
    orderService.list().then((orders) => setNewOrders(orders.filter((o) => o.status === 'New').length)).catch(() => {});
    enquiryService.list().then((list) => setNewEnquiries(list.filter((e) => e.status === 'New').length)).catch(() => {});
  }, [location.pathname]);

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
          <p className="tiny" style={{ color: '#c8b7a8', marginBottom: 10 }}>Signed in as {user?.name}</p>
          <button onClick={handleSignOut}>
            <Icon name="x" className="icon icon-sm" />
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
          <button className="btn btn-outline btn-sm" style={{ marginLeft: 'auto' }} onClick={handleSignOut}>
            Sign out
          </button>
        </header>
        <div className="a-body">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
