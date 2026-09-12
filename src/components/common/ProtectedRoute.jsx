import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

export default function ProtectedRoute({ children }) {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();

  if (status === 'checking') {
    return (
      <div className="a-empty" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <p className="muted">Loading admin console…</p>
      </div>
    );
  }

  if (status === 'signedOut') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
