import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

function PwStrength({ password }) {
  const checks = {
    len:     password.length >= 8,
    upper:   /[A-Z]/.test(password),
    lower:   /[a-z]/.test(password),
    num:     /\d/.test(password),
    special: /[^a-zA-Z0-9]/.test(password),
  };
  const score = Object.values(checks).filter(Boolean).length;
  const colors = ['', 'var(--red)', 'var(--red)', 'var(--amber)', 'var(--blue)', 'var(--green)'];
  if (!password) return null;
  return (
    <div className="pw-strength">
      <div className="pw-bar"><div className="pw-fill" style={{ width: `${score * 20}%`, background: colors[score] }} /></div>
      <div className="pw-checks">
        <div className={`pw-check ${checks.len ? 'ok' : ''}`}>8+ characters</div>
        <div className={`pw-check ${checks.upper ? 'ok' : ''}`}>Uppercase</div>
        <div className={`pw-check ${checks.lower ? 'ok' : ''}`}>Lowercase</div>
        <div className={`pw-check ${checks.num ? 'ok' : ''}`}>Number</div>
        <div className={`pw-check ${checks.special ? 'ok' : ''}`}>Special char</div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const navigate   = useNavigate();
  const { logout } = useAuth();
  const [tab, setTab] = useState(0);

  const [profile, setProfile] = useState(null);
  const [infoMsg, setInfoMsg] = useState('');
  const [infoErr, setInfoErr] = useState('');
  const [pwMsg, setPwMsg]     = useState('');
  const [pwErr, setPwErr]     = useState('');
  const [delErr, setDelErr]   = useState('');

  const [info, setInfo] = useState({ username: '', email: '', firstName: '', lastName: '' });
  const [pw, setPw]     = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [delPw, setDelPw] = useState('');

  useEffect(() => {
    api.getMe().then(me => {
      setProfile(me);
      setInfo({ username: me.username, email: me.email, firstName: me.firstName || '', lastName: me.lastName || '' });
    }).catch(err => setInfoErr(err.message));
  }, []);

  const setI = k => e => setInfo(p => ({ ...p, [k]: e.target.value }));
  const setP = k => e => setPw(p => ({ ...p, [k]: e.target.value }));

  async function handleUpdateInfo(e) {
    e.preventDefault(); setInfoMsg(''); setInfoErr('');
    try {
      const updated = await api.updateProfile(info);
      setProfile(updated); setInfoMsg('Profile updated successfully!');
    } catch (err) { setInfoErr(err.message); }
  }

  async function handleChangePassword(e) {
    e.preventDefault(); setPwMsg(''); setPwErr('');
    try {
      const data = await api.changePassword(pw);
      setPwMsg(data.message);
      await logout();
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) { setPwErr(err.message); }
  }

  async function handleDeleteAccount(e) {
    e.preventDefault(); setDelErr('');
    if (!window.confirm('Are you sure you want to delete your account? This cannot be undone.')) return;
    try {
      await api.deleteAccount({ password: delPw });
      await logout(); navigate('/login');
    } catch (err) { setDelErr(err.message); }
  }

  if (!profile) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text3)' }}>
      Loading profile…
    </div>
  );

  const tabs = ['✏️ Personal Info', '🔑 Change Password', '⚠️ Danger Zone'];

  return (
    <>
      <div className="page-header">
        <div className="page-title">👤 Profile</div>
        <div className="page-desc">Manage your account settings and security</div>
      </div>

      <div className="tabs">
        {tabs.map((t, i) => (
          <button key={i} className={`tab${tab === i ? ' active' : ''}`} onClick={() => setTab(i)}>{t}</button>
        ))}
      </div>

      {tab === 0 && (
        <div className="card" style={{ maxWidth: 520 }}>
          <div className="card-header">
            <span className="card-icon">✏️</span>
            <div><div className="card-title">Personal Information</div><div className="card-subtitle">Update your account details</div></div>
          </div>
          <form onSubmit={handleUpdateInfo}>
            <div className="form-row">
              <div className="field">
                <label>First Name</label>
                <input placeholder="First name" value={info.firstName} onChange={setI('firstName')} />
              </div>
              <div className="field">
                <label>Last Name</label>
                <input placeholder="Last name" value={info.lastName} onChange={setI('lastName')} />
              </div>
            </div>
            <div className="field">
              <label>Username</label>
              <input value={info.username} onChange={setI('username')} required minLength={3} maxLength={50} />
            </div>
            <div className="field">
              <label>Email</label>
              <input type="email" value={info.email} onChange={setI('email')} required />
            </div>
            {infoMsg && <div className="result-box success" style={{ marginBottom: 12 }}>{infoMsg}</div>}
            {infoErr && <div className="result-box error"   style={{ marginBottom: 12 }}>{infoErr}</div>}
            <button type="submit" className="btn btn-primary">💾 Save Changes</button>
          </form>
        </div>
      )}

      {tab === 1 && (
        <div className="card" style={{ maxWidth: 520 }}>
          <div className="card-header">
            <span className="card-icon">🔑</span>
            <div><div className="card-title">Change Password</div><div className="card-subtitle">You'll be signed out after changing</div></div>
          </div>
          <div className="result-box warning" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>⚠️</span>
            <span>You will be <strong>signed out on all devices</strong> immediately after changing your password.</span>
          </div>
          <form onSubmit={handleChangePassword}>
            <div className="field">
              <label>Current Password</label>
              <input type="password" placeholder="••••••••" value={pw.currentPassword} onChange={setP('currentPassword')} required />
            </div>
            <div className="field">
              <label>New Password</label>
              <input type="password" placeholder="Min 8 chars, uppercase, number, symbol" value={pw.newPassword} onChange={setP('newPassword')} required />
              <PwStrength password={pw.newPassword} />
            </div>
            <div className="field">
              <label>Confirm New Password</label>
              <input type="password" placeholder="Repeat new password" value={pw.confirmPassword} onChange={setP('confirmPassword')} required />
              {pw.confirmPassword && pw.confirmPassword !== pw.newPassword && (
                <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>Passwords do not match</div>
              )}
            </div>
            {pwMsg && <div className="result-box success" style={{ marginBottom: 12 }}>{pwMsg}</div>}
            {pwErr && <div className="result-box error"   style={{ marginBottom: 12 }}>{pwErr}</div>}
            <button type="submit" className="btn btn-primary"
              disabled={pw.newPassword !== pw.confirmPassword && pw.confirmPassword.length > 0}>
              🔑 Update Password
            </button>
          </form>
        </div>
      )}

      {tab === 2 && (
        <div style={{ maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-header">
              <span className="card-icon">🚪</span>
              <div><div className="card-title">Logout All Sessions</div><div className="card-subtitle">Invalidate all active sessions</div></div>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 14 }}>
              This will immediately sign you out of all devices and browsers.
            </p>
            <button className="btn btn-ghost" onClick={async () => { await logout(); navigate('/login'); }}>
              🚪 Logout All Sessions
            </button>
          </div>

          <div className="danger-zone">
            <div className="danger-zone-title">⚠️ Delete Account</div>
            <p style={{ fontSize: 13, color: '#FCA5A5', marginBottom: 14 }}>
              <strong>This action is permanent and cannot be undone.</strong> All your timestamps, profile data, and access history will be permanently deleted.
            </p>
            <form onSubmit={handleDeleteAccount}>
              <div className="field">
                <label>Enter your password to confirm</label>
                <input type="password" placeholder="Your current password" value={delPw} onChange={e => setDelPw(e.target.value)} required />
              </div>
              {delErr && <div className="result-box error" style={{ marginBottom: 12 }}>{delErr}</div>}
              <button type="submit" className="btn btn-danger">🗑️ Permanently Delete Account</button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
