import React from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import LoginPage     from './pages/LoginPage';
import RegisterPage  from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import ProfilePage   from './pages/ProfilePage';
import TimestampPage from './pages/TimestampPage';
import VerifyPage    from './pages/VerifyPage';
import AuditPage     from './pages/AuditPage';

function ProtectedRoute({ children }) {
  const { username, loading } = useAuth();
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text3)', fontSize: 14 }}>
      Restoring session…
    </div>
  );
  return username ? children : <Navigate to="/login" replace />;
}

function Sidebar() {
  const { username, roles, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin   = roles.includes('ADMIN');
  const initials  = username ? username.slice(0, 2).toUpperCase() : '??';

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  if (!username) return null;

  return (
    <aside className="sidebar">
      <div className="sidebar-label">Navigation</div>
      <NavLink to="/dashboard" className={({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '')}>
        <span className="sico">🏠</span> Dashboard
      </NavLink>
      <NavLink to="/timestamp" className={({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '')}>
        <span className="sico">⏱️</span> Timestamp
      </NavLink>
      <NavLink to="/verify" className={({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '')}>
        <span className="sico">✅</span> Verify
      </NavLink>
      <NavLink to="/profile" className={({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '')}>
        <span className="sico">👤</span> Profile
      </NavLink>
      {isAdmin && (
        <NavLink to="/audit" className={({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '')}>
          <span className="sico">📋</span> Audit Logs
        </NavLink>
      )}
      <div className="sidebar-divider" />
      <div className="sidebar-link danger" onClick={handleLogout} style={{ cursor: 'pointer' }}>
        <span className="sico">🚪</span> Logout
      </div>
      <div style={{ flex: 1 }} />
      <div className="sidebar-user">
        <div className="nav-avatar" style={{ width: 30, height: 30, fontSize: 11 }}>{initials}</div>
        <div>
          <div className="sidebar-user-name">{username}</div>
          <div className="sidebar-user-role">{isAdmin ? 'ADMIN' : 'USER'}</div>
        </div>
      </div>
    </aside>
  );
}

function Navbar() {
  const { username } = useAuth();
  const initials = username ? username.slice(0, 2).toUpperCase() : '';
  return (
    <nav className="navbar">
      <div className="nav-brand">
        <img src="/logo.png" alt="Timestamping Server" style={{ height: 38, width: 'auto' }} />
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>TIMESTAMPING</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--cyan)', letterSpacing: '.12em', textTransform: 'uppercase' }}>Server</span>
        </div>
      </div>
      <div className="nav-spacer" />
      {username && (
        <>
          <div className="nav-pill cyan">🛡️ TLS 1.3</div>
          <div className="nav-pill green"><div className="nav-dot" /> Secure Session</div>
          <div className="nav-avatar">{initials}</div>
        </>
      )}
    </nav>
  );
}

function AppLayout() {
  const { username } = useAuth();
  return (
    <div className="app-shell">
      <Navbar />
      <div className="app-body">
        <Sidebar />
        <main className={username ? 'main-content' : ''} style={username ? {} : { flex: 1 }}>
          <Routes>
            <Route path="/login"     element={<LoginPage />} />
            <Route path="/register"  element={<RegisterPage />} />
            <Route path="/verify"    element={<VerifyPage />} />
            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/profile"   element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            <Route path="/timestamp" element={<ProtectedRoute><TimestampPage /></ProtectedRoute>} />
            <Route path="/audit"     element={<ProtectedRoute><AuditPage /></ProtectedRoute>} />
            <Route path="*"          element={<Navigate to="/login" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <AppLayout />
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
