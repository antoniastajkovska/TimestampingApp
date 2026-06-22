import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';

function useCountdown(expiresAt) {
  const [secs, setSecs] = useState(null);
  useEffect(() => {
    if (!expiresAt) { setSecs(null); return; }
    const tick = () => {
      const rem = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setSecs(rem);
      if (rem === 0) clearInterval(id);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  if (secs === null || secs === 0) return null;
  return `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
}

function JitCircle({ expiresAt, totalMs = 15 * 60 * 1000, color = 'var(--cyan)' }) {
  const [rem, setRem] = useState(0);
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => setRem(Math.max(0, expiresAt - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  const pct = Math.max(0, Math.min(100, (rem / totalMs) * 100));
  const r = 28, circ = 2 * Math.PI * r;
  const m = String(Math.floor(rem / 60000)).padStart(2, '0');
  const s = String(Math.floor((rem % 60000) / 1000)).padStart(2, '0');
  return (
    <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
      <svg width="72" height="72" viewBox="0 0 72 72" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="36" cy="36" r={r} fill="none" stroke="var(--border)" strokeWidth="5" />
        <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct / 100)}
          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s linear' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 700, color }}>{m}:{s}</div>
        <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 1 }}>left</div>
      </div>
    </div>
  );
}

function useExpiryToast(expiresAt, label, toast) {
  const fired = useRef(false);
  useEffect(() => {
    if (!expiresAt) { fired.current = false; return; }
    fired.current = false;
    const id = setInterval(() => {
      if (!fired.current && Date.now() >= expiresAt) {
        fired.current = true;
        toast(`${label} access has expired`, 'warning');
        clearInterval(id);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt, label, toast]);
}

// Password confirmation modal for JIT elevation
function JitElevateModal({ title, description, color, onConfirm, onClose, loading }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  async function handle(e) {
    e.preventDefault();
    setErr('');
    try { await onConfirm(pw); onClose(); }
    catch (ex) { setErr(ex.message); }
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-title" style={{ color }}>{title}</div>
        <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>{description}</p>
        {err && <div className="result-box error" style={{ marginBottom: 12 }}>{err}</div>}
        <form onSubmit={handle}>
          <div className="field">
            <label>Confirm your password</label>
            <input type="password" placeholder="••••••••" value={pw}
              onChange={e => setPw(e.target.value)} required autoFocus />
          </div>
          <div className="modal-actions">
            <button type="submit" className="btn btn-primary" disabled={loading || !pw}>
              {loading ? 'Elevating…' : '⚡ Elevate Access'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { username, roles, setRoles, auditorExpiresAt, setAuditorExpiresAt,
          deleteExpiresAt, setDeleteExpiresAt, requestAuditor, requestDelete, hasRole } = useAuth();
  const toast = useToast();
  const [me, setMe]           = useState(null);
  const [users, setUsers]     = useState([]);
  const [error, setError]     = useState('');
  const [jitLoading, setJitLoading] = useState(false);
  const [chainStatus, setChainStatus] = useState(null);
  const [elevateModal, setElevateModal] = useState(null); // 'auditor' | 'delete'
  const [modal, setModal]             = useState(null);
  const [formValues, setFormValues]   = useState({ username: '', email: '', password: '' });
  const [formError, setFormError]     = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const isAdmin        = hasRole('ADMIN');
  const auditorTimer   = useCountdown(auditorExpiresAt);
  const deleteTimer    = useCountdown(deleteExpiresAt);
  const auditorActive  = auditorExpiresAt && Date.now() < auditorExpiresAt && auditorTimer;
  const deleteActive   = deleteExpiresAt  && Date.now() < deleteExpiresAt  && deleteTimer;

  useExpiryToast(auditorExpiresAt, 'JIT_AUDITOR', toast);
  useExpiryToast(deleteExpiresAt,  'JIT_DELETE',  toast);

  const loadMe    = useCallback(() => api.getMe().then(d => {
    setMe(d);
    if (d.auditorExpiresAt) setAuditorExpiresAt(new Date(d.auditorExpiresAt).getTime());
    if (d.deleteExpiresAt)  setDeleteExpiresAt(new Date(d.deleteExpiresAt).getTime());
    if (d.roles) setRoles(d.roles);
  }).catch(() => {}), []);
  const loadUsers = useCallback(() => {
    if (isAdmin) api.getAllUsers().then(setUsers).catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    loadMe();
    loadUsers();
    api.getChainStatus().then(setChainStatus).catch(() => setChainStatus({ intact: false, totalEntries: 0, message: 'Unavailable' }));
  }, [loadMe, loadUsers]);

  const fmt = (iso) => iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  async function handleElevate(type, password) {
    setJitLoading(true);
    try {
      if (type === 'auditor') {
        await requestAuditor(password);
        toast('JIT_AUDITOR granted — audit logs accessible for 15 minutes', 'success');
      } else {
        await requestDelete(password);
        toast('JIT_DELETE granted — destructive actions enabled for 15 minutes', 'success');
      }
      await loadMe();
    } catch (e) { throw e; }
    finally { setJitLoading(false); }
  }

  function openCreate() { setFormValues({ username: '', email: '', password: '' }); setFormError(''); setModal({ mode: 'create' }); }
  function openEdit(u)  { setFormValues({ username: u.username, email: u.email, password: '' }); setFormError(''); setModal({ mode: 'edit', user: u }); }

  async function handleFormSubmit(e) {
    e.preventDefault(); setFormError(''); setFormLoading(true);
    try {
      if (modal.mode === 'create') await api.adminCreateUser(formValues);
      else await api.adminUpdateUser(modal.user.id, { username: formValues.username, email: formValues.email });
      setModal(null); await loadUsers();
    } catch (e) { setFormError(e.message); }
    finally { setFormLoading(false); }
  }

  async function handleDelete(u) {
    if (!deleteActive) {
      toast('Elevate to JIT_DELETE first to perform deletions', 'warning');
      return;
    }
    if (!window.confirm(`Delete user "${u.username}"? This cannot be undone.`)) return;
    try { await api.adminDeleteUser(u.id); await loadUsers(); toast(`User "${u.username}" deleted`, 'success'); }
    catch (e) { setError(e.message); }
  }

  const roleBadge = (role) => {
    const map = {
      ADMIN:        'badge-blue',
      USER:         'badge-cyan',
      JIT_AUDITOR:  'badge-amber',
      JIT_DELETE:   'badge-red',
    };
    return <span key={role} className={`badge ${map[role] || 'badge-blue'}`} style={{ marginRight: 4 }}>{role}</span>;
  };

  return (
    <>
      {/* ── Welcome Banner ── */}
      <div style={{
        background: 'linear-gradient(135deg, #0F2444 0%, #1a3a6b 50%, #0c1e3d 100%)',
        border: '1px solid rgba(37,99,235,0.35)',
        borderRadius: 20,
        padding: '28px 32px',
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* background decoration */}
        <div style={{ position: 'absolute', right: -40, top: -40, width: 200, height: 200, background: 'radial-gradient(circle, rgba(37,99,235,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', right: 80, bottom: -60, width: 160, height: 160, background: 'radial-gradient(circle, rgba(6,182,212,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div>
          <div style={{ fontSize: 13, color: 'var(--cyan)', fontWeight: 600, marginBottom: 6, letterSpacing: '.04em', textTransform: 'uppercase' }}>
            Welcome back
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-.03em', marginBottom: 6 }}>
            {me?.firstName ? `${me.firstName} ${me.lastName || ''}`.trim() : username}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, flexShrink: 0 }}>
          <div style={{ textAlign: 'center', background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(37,99,235,0.25)', borderRadius: 14, padding: '14px 20px' }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--cyan)' }}>RFC</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>3161-inspired</div>
          </div>
          <div style={{ textAlign: 'center', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 14, padding: '14px 20px' }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--green)' }}>PS256</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>JWS Signing</div>
          </div>
          <div style={{ textAlign: 'center', background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 14, padding: '14px 20px' }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--purple)' }}>NTP</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Time Sync</div>
          </div>
        </div>
      </div>

      <div className="page-header" style={{ marginBottom: 20 }}>
        <div className="page-title">🛡️ Security Dashboard</div>
        <div className="page-desc">Central control panel — all security systems nominal</div>
      </div>

      {error && <div className="result-box error" style={{ marginBottom: 16 }}>{error}</div>}

      {/* ── Top 3-column cards ── */}
      <div className="grid-3">

        {/* Account Info */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <span className="card-icon">👤</span>
            <div><div className="card-title">Account Info</div><div className="card-subtitle">Identity &amp; roles</div></div>
          </div>
          {me ? (
            <>
              <div className="info-grid" style={{ marginBottom: 12 }}>
                <div className="info-item"><div className="info-label">Username</div><div className="info-value">{me.username}</div></div>
                <div className="info-item"><div className="info-label">Email</div><div className="info-value" style={{ fontSize: 12, wordBreak: 'break-all' }}>{me.email}</div></div>
                {me.firstName && <div className="info-item"><div className="info-label">Name</div><div className="info-value">{me.firstName} {me.lastName}</div></div>}
                <div className="info-item"><div className="info-label">Member Since</div><div className="info-value mono">{fmt(me.createdAt)}</div></div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                {(me.roles || roles).map(r => roleBadge(r))}
              </div>
              <Link to="/profile" className="btn btn-ghost btn-sm">✏️ Edit Profile</Link>
            </>
          ) : (
            <div style={{ color: 'var(--text3)', fontSize: 13 }}>Loading…</div>
          )}
        </div>

        {/* JIT Access (ADMIN only) or info card for regular users */}
        {isAdmin ? (
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-header">
              <span className="card-icon">⚡</span>
              <div><div className="card-title">JIT Elevation</div><div className="card-subtitle">Temporary privilege escalation</div></div>
            </div>

            {/* JIT_AUDITOR */}
            <div className="jit-row">
              <div>
                <div className="jit-name">JIT_AUDITOR</div>
                <div className="jit-desc">View audit &amp; security logs</div>
              </div>
              {auditorActive ? (
                <JitCircle expiresAt={auditorExpiresAt} color="var(--amber)" />
              ) : (
                <button className="btn btn-secondary btn-sm" onClick={() => setElevateModal('auditor')} disabled={jitLoading}>
                  Request
                </button>
              )}
            </div>

            {/* JIT_DELETE */}
            <div className="jit-row">
              <div>
                <div className="jit-name">JIT_DELETE</div>
                <div className="jit-desc">Delete users &amp; revoke sessions</div>
              </div>
              {deleteActive ? (
                <JitCircle expiresAt={deleteExpiresAt} color="var(--red)" />
              ) : (
                <button className="btn btn-danger-outline btn-sm" onClick={() => setElevateModal('delete')} disabled={jitLoading}>
                  Request
                </button>
              )}
            </div>

            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 12, padding: '8px 0', borderTop: '1px solid var(--border)' }}>
              🔐 Password re-entry required · 15 min auto-revoke
            </div>
          </div>
        ) : (
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-header">
              <span className="card-icon">🔏</span>
              <div><div className="card-title">Your Access</div><div className="card-subtitle">Active permissions</div></div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
              <div style={{ marginBottom: 8 }}>✅ Create &amp; verify timestamps</div>
              <div style={{ marginBottom: 8 }}>✅ Manage your profile</div>
              <div style={{ marginBottom: 8 }}>✅ Change password</div>
              <div style={{ color: 'var(--text3)' }}>🔒 Admin features require ADMIN role</div>
            </div>
          </div>
        )}

        {/* Security Status */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <span className="card-icon">🔒</span>
            <div><div className="card-title">Security Status</div><div className="card-subtitle">All systems active</div></div>
          </div>
          <div className="status-grid">
            <div className="status-item"><div className="status-dot green"/><div><div className="status-name">TLS 1.3</div><div className="status-val">Active</div></div></div>
            <div className="status-item"><div className="status-dot blue"/><div><div className="status-name">OTP 2FA</div><div className="status-val">Enabled</div></div></div>
            <div className="status-item"><div className="status-dot green"/><div><div className="status-name">PS256 JWS</div><div className="status-val">Signing</div></div></div>
            <div className="status-item"><div className="status-dot cyan"/><div><div className="status-name">NTP Sync</div><div className="status-val">Active</div></div></div>
            <div className="status-item"><div className="status-dot amber"/><div><div className="status-name">Audit Log</div><div className="status-val">Running</div></div></div>
            <div className="status-item">
              <div className={`status-dot ${chainStatus === null ? 'cyan' : chainStatus.intact ? 'green' : 'red'}`}/>
              <div>
                <div className="status-name">Log Chain</div>
                <div className="status-val" title={chainStatus?.message}>
                  {chainStatus === null ? 'Checking…' : chainStatus.intact ? `Intact (${chainStatus.totalEntries})` : 'TAMPERED'}
                </div>
              </div>
            </div>
          </div>
          {isAdmin && (
            <Link to="/audit" className="btn btn-ghost btn-sm" style={{ marginTop: 14 }}>
              📋 View Audit Logs →
            </Link>
          )}
        </div>
      </div>

      {/* ── User Directory (ADMIN only) ── */}
      {isAdmin && (
        <div className="card">
          <div className="card-title-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 20 }}>📋</span>
              <div>
                <div className="card-title">User Directory</div>
                <div className="card-subtitle">All registered accounts</div>
              </div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={openCreate}>➕ Create User</button>
          </div>

          {users.length === 0 ? (
            <div style={{ color: 'var(--text3)', fontSize: 13 }}>Loading users…</div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>ID</th><th>Username</th><th>Email</th><th>Roles</th><th>Registered</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td className="td-mono">#{u.id}</td>
                      <td>
                        <strong>{u.username}</strong>
                        {u.username === username && <span className="you-tag">you</span>}
                      </td>
                      <td className="td-mono">{u.email}</td>
                      <td>{(u.roles || []).map(r => roleBadge(r))}</td>
                      <td className="td-mono">{fmt(u.createdAt)}</td>
                      <td>
                        <div className="action-cell">
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(u)}>✏️ Edit</button>
                          {u.username !== username && (
                            <button
                              className={`btn btn-sm ${deleteActive ? 'btn-danger-outline' : 'btn-ghost'}`}
                              onClick={() => handleDelete(u)}
                              title={deleteActive ? 'Delete user' : 'Requires JIT_DELETE elevation'}
                            >
                              {deleteActive ? '🗑️' : '🔒'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* JIT Elevation Modal */}
      {elevateModal && (
        <JitElevateModal
          title={elevateModal === 'auditor' ? '⚡ Request JIT_AUDITOR' : '⚡ Request JIT_DELETE'}
          description={elevateModal === 'auditor'
            ? 'Grants temporary read access to audit logs and security events for 15 minutes.'
            : 'Grants temporary permission to delete users and revoke sessions for 15 minutes. Use with caution.'}
          color={elevateModal === 'auditor' ? 'var(--amber)' : 'var(--red)'}
          loading={jitLoading}
          onConfirm={(pw) => handleElevate(elevateModal, pw)}
          onClose={() => setElevateModal(null)}
        />
      )}

      {/* Create/Edit User Modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-title">{modal.mode === 'create' ? '➕ Create User' : '✏️ Edit User'}</div>
            {formError && <div className="result-box error" style={{ marginBottom: 16 }}>{formError}</div>}
            <form onSubmit={handleFormSubmit}>
              <div className="field">
                <label>Username</label>
                <input value={formValues.username} onChange={e => setFormValues(v => ({ ...v, username: e.target.value }))} required minLength={3} maxLength={50} />
              </div>
              <div className="field">
                <label>Email</label>
                <input type="email" value={formValues.email} onChange={e => setFormValues(v => ({ ...v, email: e.target.value }))} required />
              </div>
              {modal.mode === 'create' && (
                <div className="field">
                  <label>Password</label>
                  <input type="password" value={formValues.password} onChange={e => setFormValues(v => ({ ...v, password: e.target.value }))} required minLength={8} />
                </div>
              )}
              <div className="modal-actions">
                <button type="submit" className="btn btn-primary" disabled={formLoading}>
                  {formLoading ? 'Saving…' : modal.mode === 'create' ? 'Create' : 'Save Changes'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
