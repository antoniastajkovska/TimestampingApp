import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import { useToast } from '../components/Toast';

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
  const labels = ['', 'Weak', 'Weak', 'Fair', 'Good', 'Strong'];
  if (!password) return null;
  return (
    <div className="pw-strength">
      <div className="pw-bar">
        <div className="pw-fill" style={{ width: `${score * 20}%`, background: colors[score] }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>Password strength</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: colors[score] }}>{labels[score]}</span>
      </div>
      <div className="pw-checks">
        <div className={`pw-check ${checks.len ? 'ok' : ''}`}>8+ characters</div>
        <div className={`pw-check ${checks.upper ? 'ok' : ''}`}>Uppercase letter</div>
        <div className={`pw-check ${checks.lower ? 'ok' : ''}`}>Lowercase letter</div>
        <div className={`pw-check ${checks.num ? 'ok' : ''}`}>Number</div>
        <div className={`pw-check ${checks.special ? 'ok' : ''}`}>Special character</div>
      </div>
    </div>
  );
}

const RESEND_COOLDOWN = 30;

export default function RegisterPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [step, setStep] = useState('form');
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' });
  const [otp, setOtp]   = useState(Array(8).fill(''));
  const [pendingUsername, setPendingUsername] = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs  = useRef([]);
  const cooldownRef = useRef(null);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    cooldownRef.current = setInterval(() => setResendCooldown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(cooldownRef.current);
  }, [resendCooldown]);

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  function handleOtpChange(i, val) {
    const digit = val.replace(/\D/g, '').slice(-1);
    const next = [...otp]; next[i] = digit; setOtp(next);
    if (digit && i < 7) inputRefs.current[i + 1]?.focus();
  }
  function handleOtpKey(i, e) {
    if (e.key === 'Backspace' && !otp[i] && i > 0) inputRefs.current[i - 1]?.focus();
  }
  function handleOtpPaste(e) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 8);
    if (!text) return;
    e.preventDefault();
    const next = Array(8).fill('');
    text.split('').forEach((ch, i) => { next[i] = ch; });
    setOtp(next);
    inputRefs.current[Math.min(text.length, 7)]?.focus();
  }

  async function handleRegister(e) {
    e.preventDefault(); setError('');
    if (form.password !== form.confirm) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      const data = await api.register({ username: form.username, email: form.email, password: form.password });
      setPendingUsername(data.pendingUsername);
      setStep('verify');
      setResendCooldown(RESEND_COOLDOWN);
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function handleResend() {
    if (resendCooldown > 0) return;
    setError(''); setResendCooldown(RESEND_COOLDOWN);
    setOtp(Array(8).fill(''));
    try {
      await api.register({ username: form.username, email: form.email, password: form.password });
      toast('New OTP sent to ' + form.email, 'success');
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } catch (err) {
      toast('Failed to resend: ' + err.message, 'error');
    }
  }

  async function handleVerify(e) {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      await api.confirmRegister({ username: pendingUsername, code: otp.join('') });
      setStep('done');
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  if (step === 'done') {
    return (
      <div className="auth-wrap">
        <div className="auth-card" style={{ textAlign: 'center', maxWidth: 430 }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
          <div className="auth-title">Account Verified!</div>
          <div className="auth-sub" style={{ marginTop: 8 }}>Redirecting you to sign in…</div>
          <div style={{ marginTop: 20 }}>
            <div className="pw-bar"><div className="pw-fill" style={{ width: '100%', background: 'var(--green)' }} /></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wrap">
      <div style={{ width: '100%', maxWidth: 430 }}>
        <div className="auth-card">
          <div className="auth-logo">
            <div className="auth-logo-icon">📝</div>
            <div className="auth-title">
              {step === 'form' ? 'Create Account' : 'Verify your email'}
            </div>
            <div className="auth-sub">
              {step === 'form' ? 'Join TimeStamp Secure' : `We sent an 8-digit code to ${form.email}`}
            </div>
          </div>

          {step === 'form' ? (
            <form onSubmit={handleRegister}>
              <div className="field">
                <label>Username</label>
                <input placeholder="e.g. alice_k" value={form.username} onChange={set('username')} required minLength={3} />
              </div>
              <div className="field">
                <label>Email</label>
                <input type="email" placeholder="alice@example.com" value={form.email} onChange={set('email')} required />
              </div>
              <div className="field">
                <label>Password</label>
                <input type="password" placeholder="Min 8 characters" value={form.password} onChange={set('password')} required />
                <PwStrength password={form.password} />
              </div>
              <div className="field">
                <label>Confirm Password</label>
                <input type="password" placeholder="Repeat password" value={form.confirm} onChange={set('confirm')} required />
                {form.confirm && form.confirm !== form.password && (
                  <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>Passwords do not match</div>
                )}
              </div>
              {error && <div className="result-box error" style={{ marginBottom: 12 }}>{error}</div>}
              <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
                {loading ? 'Creating account…' : 'Create Account →'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerify}>
              <div style={{ textAlign: 'center', marginBottom: 16, fontSize: 13, color: 'var(--text2)' }}>
                Enter the 8-digit code sent to <strong>{form.email}</strong>
              </div>
              <div className="otp-row" onPaste={handleOtpPaste}>
                {otp.map((val, i) => (
                  <input key={i} ref={el => inputRefs.current[i] = el}
                    className={`otp-box${val ? ' filled' : ''}`}
                    value={val} maxLength={1} inputMode="numeric"
                    onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => handleOtpKey(i, e)} />
                ))}
              </div>
              {error && <div className="result-box error" style={{ marginBottom: 12 }}>{error}</div>}
              <button type="submit" className="btn btn-cyan btn-full btn-lg" disabled={loading || otp.join('').length < 8}>
                {loading ? 'Verifying…' : '✓ Verify & Activate'}
              </button>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button type="button" className="btn btn-ghost" style={{ flex: 1 }}
                  onClick={() => { setStep('form'); setError(''); setOtp(Array(8).fill('')); }}>
                  ← Back
                </button>
                <button type="button" className="btn btn-ghost" style={{ flex: 1 }}
                  onClick={handleResend} disabled={resendCooldown > 0}>
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : '↺ Resend OTP'}
                </button>
              </div>
            </form>
          )}

          <div className="sec-indicators">
            <div className="sec-ind">🔐 BCrypt-12</div>
            <div className="sec-ind">📧 OTP Verify</div>
            <div className="sec-ind">🛡️ Passay Rules</div>
          </div>
        </div>
        {step === 'form' && (
          <div className="auth-footer">
            Already have an account? <Link to="/login">Sign in →</Link>
          </div>
        )}
      </div>
    </div>
  );
}
