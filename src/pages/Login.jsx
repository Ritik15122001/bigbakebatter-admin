import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import Icon from '../components/common/Icon';
import { useAuthStore } from '../store/authStore';

const PERKS = [
  { icon: 'bag', text: 'Manage every order in real time' },
  { icon: 'cake', text: 'Update cakes, stock and pricing instantly' },
  { icon: 'news', text: 'Publish blog posts and homepage banners' },
  { icon: 'user', text: 'Keep track of every customer' },
];

export default function Login() {
  const status = useAuthStore((s) => s.status);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (status === 'signedIn') {
    return <Navigate to={location.state?.from?.pathname || '/'} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      navigate(location.state?.from?.pathname || '/', { replace: true });
    } catch (err) {
      setError(err.message || 'Sign in failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="admin-auth-shell">
      <aside className="admin-auth-side">
        <div className="admin-auth-side-top">
          <span className="brand-mark-wrap">
            <span className="brand-mark">
              <img src="/brand/logo-icon.png" alt="" />
            </span>
          </span>
          <span>
            <b className="brand-name" style={{ color: '#fff' }}>BIGBAKEBATTER</b>
            <span className="brand-tag" style={{ display: 'block' }}>Admin console</span>
          </span>
        </div>
        <div className="admin-auth-side-mid">
          <h1>Everything your bakery needs, in one place.</h1>
          <p>Sign in to manage cakes, orders, customers and content from a single dashboard.</p>
          <ul className="admin-auth-perks">
            {PERKS.map((p) => (
              <li key={p.text}>
                <span className="admin-auth-perk-ico">
                  <Icon name={p.icon} className="icon icon-sm" />
                </span>
                {p.text}
              </li>
            ))}
          </ul>
        </div>
        <p className="admin-auth-side-foot">© {new Date().getFullYear()} BigBakeBatter. Internal use only.</p>
      </aside>

      <main className="admin-auth-main">
        <div className="admin-auth-card">
          <div className="auth-head">
            <h1>Welcome back</h1>
            <p className="muted">Sign in with your admin account to continue.</p>
          </div>

          <form className="stack gap-4" onSubmit={handleSubmit}>
            <div className="field">
              <label>Email address</label>
              <input
                className="input"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@bigbakebatter.com"
              />
            </div>
            <div className="field">
              <label>Password</label>
              <div className="admin-auth-pw-wrap">
                <input
                  className="input"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  className="admin-auth-pw-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Icon name="eye" className="icon icon-sm" />
                </button>
              </div>
            </div>
            {error && (
              <p className="small admin-auth-error">
                <Icon name="alert" className="icon icon-sm" /> {error}
              </p>
            )}
            <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
              <Icon name="aright" className="icon icon-sm" />
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
