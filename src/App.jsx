import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/common/ProtectedRoute';
import ToastStack from './components/common/ToastStack';
import Login from './pages/Login';
import AdminLayout from './pages/AdminLayout';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import Transactions from './pages/Transactions';
import Cakes from './pages/Cakes';
import CategoriesStock from './pages/CategoriesStock';
import BlogAdmin from './pages/BlogAdmin';
import Customers from './pages/Customers';
import Enquiries from './pages/Enquiries';
import Banners from './pages/Banners';
import Announcements from './pages/Announcements';
import SiteContent from './pages/SiteContent';
import Settings from './pages/Settings';
import ContentPages from './pages/ContentPages';
import Coupons from './pages/Coupons';
import FestivalTheme from './pages/FestivalTheme';
import { useAuthStore } from './store/authStore';

export default function App() {
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="orders" element={<Orders />} />
          <Route path="orders/:id" element={<OrderDetail />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="cakes" element={<Cakes />} />
          <Route path="stock" element={<CategoriesStock />} />
          <Route path="blog" element={<BlogAdmin />} />
          <Route path="customers" element={<Customers />} />
          <Route path="enquiries" element={<Enquiries />} />
          <Route path="banners" element={<Banners />} />
          <Route path="announcements" element={<Announcements />} />
          <Route path="content" element={<SiteContent />} />
          <Route path="website-content" element={<ContentPages />} />
          <Route path="content-pages" element={<Navigate to="/website-content" replace />} />
          <Route path="coupons" element={<Coupons />} />
          <Route path="festival" element={<FestivalTheme />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <ToastStack />
    </>
  );
}
