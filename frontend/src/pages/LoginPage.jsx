import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';

function OtpTimer({ seconds }) {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  const pct = (seconds / 600) * 100;
  const color = seconds < 60 ? 'var(--red)' : seconds < 180 ? 'var(--amber)' : 'var(--cyan)';
  return (
    <div style={{ textAlign: 'center', margin: '16px 0' }}>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>Code expires in</div>
      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 28, fontWeight: 800, color }}>
        {m}:{s}
      </div>
      <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, margin: '10px 0', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 1s linear, background .5s' }} />
      </div>
    </div>
  );
}

const RESEND_COOLDOWN = 30;

export default function LoginPage() {
  const navigate = useNavigate();
  const { setUsername } = useAuth();
  const toast = useToast();

  const [step, setStep] = useState('password');
  const [form, setForm] = useState({ username: '', password: '' });
  const [otp, setOtp]   = useState(Array(8).fill(''));
  const [pendingUsername, setPendingUsername] = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [timer, setTimer]     = useState(600);
  const [resendCooldown, setResendCooldown] = useState(0);
  const timerRef   = useRef(null);
  const cooldownRef = useRef(null);
  const inputRefs  = useRef([]);

  useEffect(() => {
    if (step === '2fa') {
      setTimer(600);
      timerRef.current = setInterval(() => setTimer(t => Math.max(0, t - 1)), 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [step]);

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
    if (e.key === 'ArrowLeft'  && i > 0) inputRefs.current[i - 1]?.focus();
    if (e.key === 'ArrowRight' && i < 7) inputRefs.current[i + 1]?.focus();
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

  async function handlePassword(e) {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const data = await api.login({ username: form.username, password: form.password });
      setPendingUsername(data.pendingUsername);
      setStep('2fa');
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
      await api.login({ username: form.username, password: form.password });
      setTimer(600);
      toast('New OTP sent to your email', 'success');
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } catch (err) {
      toast('Failed to resend: ' + err.message, 'error');
    }
  }

  async function handle2fa(e) {
    e.preventDefault(); setError(''); setLoading(true);
    const code = otp.join('');
    try {
      await api.verify2fa({ username: pendingUsername, code });
      setUsername(pendingUsername);
      navigate('/dashboard');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  const otpCode = otp.join('');

  return (
    <div className="auth-wrap">
      <div style={{ width: '100%', maxWidth: 430 }}>
        <div className="auth-card">
          <div className="auth-logo">
            <div className="auth-logo-icon">🔐</div>
            <div className="auth-title">
              {step === 'password' ? 'Welcome Back' : 'Two-Factor Verification'}
            </div>
            <div className="auth-sub">
              {step === 'password' ? 'Sign in to TimeStamp Secure' : 'We sent an 8-digit code to your email'}
            </div>
          </div>

          {step === 'password' ? (
            <form onSubmit={handlePassword}>
              <div className="field">
                <label>Username or Email</label>
                <input placeholder="username or email@domain.com" value={form.username} onChange={set('username')} required />
              </div>
              <div className="field">
                <label>Password</label>
                <input type="password" placeholder="••••••••" value={form.password} onChange={set('password')} required />
              </div>
              {error && <div className="result-box error" style={{ marginBottom: 12 }}>{error}</div>}
              <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
                {loading ? 'Signing in…' : 'Continue →'}
              </button>
            </form>
          ) : (
            <form onSubmit={handle2fa}>
              <OtpTimer seconds={timer} />
              <div className="otp-row" onPaste={handleOtpPaste}>
                {otp.map((val, i) => (
                  <input key={i} ref={el => inputRefs.current[i] = el}
                    className={`otp-box${val ? ' filled' : ''}`}
                    value={val} maxLength={1} inputMode="numeric"
                    onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => handleOtpKey(i, e)} />
                ))}
              </div>
              <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>
                {8 - otpCode.length > 0
                  ? `Enter ${8 - otpCode.length} more digit${8 - otpCode.length > 1 ? 's' : ''}`
                  : 'Code complete — press Verify'}
              </div>
              {error && <div className="result-box error" style={{ marginBottom: 12 }}>{error}</div>}
              <button type="submit" className="btn btn-cyan btn-full btn-lg" disabled={loading || otpCode.length < 8}>
                {loading ? 'Verifying…' : '✓ Verify & Sign In'}
              </button>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button type="button" className="btn btn-ghost" style={{ flex: 1 }}
                  onClick={() => { setStep('password'); setError(''); setOtp(Array(8).fill('')); }}>
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
            <div className="sec-ind">🔒 TLS 1.3</div>
            <div className="sec-ind">🛡️ mTLS</div>
            <div className="sec-ind">🍪 HttpOnly</div>
            <div className="sec-ind">🔐 RS256</div>
          </div>
        </div>

        <div className="auth-footer">
          No account? <Link to="/register">Create one →</Link>
          &nbsp;·&nbsp;
          <Link to="/verify">Continue as Guest →</Link>
        </div>
      </div>
    </div>
  );
}
