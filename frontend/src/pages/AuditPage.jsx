import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

const EVENT_COLORS = {
  LOGIN_SUCCESS:   'badge-green',
  LOGIN_FAIL:      'badge-red',
  OTP_FAIL:        'badge-red',
  OTP_LOCKED:      'badge-red',
  PASSWORD_CHANGE: 'badge-amber',
  ACCOUNT_DELETE:  'badge-red',
  JIT_GRANT:       'badge-blue',
  JIT_REVOKE:      'badge-purple',
  TIMESTAMP_REQUEST: 'badge-cyan',
  VERIFY_REQUEST:  'badge-cyan',
  REGISTER:        'badge-green',
  LOGOUT:          'badge-blue',
};

function fmtTime(ms) {
  return new Date(ms).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

export default function AuditPage() {
  const { hasRole, auditorExpiresAt } = useAuth();
  const auditorActive = hasRole('JIT_AUDITOR') && auditorExpiresAt && Date.now() < auditorExpiresAt;

  const [tab, setTab] = useState(0); // 0=all, 1=security
  const [logs, setLogs]   = useState([]);
  const [page, setPage]   = useState(0);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter]   = useState('');

  const load = useCallback(async () => {
    if (!auditorActive) return;
    setLoading(true);
    try {
      if (tab === 0) {
        const d = await api.getAuditLogs(page, 50);
        setLogs(d.entries); setTotal(d.totalItems); setTotalPages(d.totalPages);
      } else {
        const d = await api.getSecurityEvents(0, 100);
        setLogs(d); setTotal(d.length); setTotalPages(1);
      }
    } catch (e) { /* access expired */ setLogs([]); }
    finally { setLoading(false); }
  }, [auditorActive, tab, page]);

  useEffect(() => { load(); }, [load]);

  const filtered = filter
    ? logs.filter(e => e.eventType.includes(filter.toUpperCase()) || e.username.toLowerCase().includes(filter.toLowerCase()))
    : logs;

  if (!hasRole('ADMIN')) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Admin access required</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 6 }}>This page is only accessible to ADMIN users.</div>
        </div>
      </div>
    );
  }

  if (!auditorActive) {
    return (
      <>
        <div className="page-header">
          <div className="page-title">📋 Audit Logs</div>
          <div className="page-desc">Security event history and activity monitoring</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '60px 24px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔐</div>
          <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>JIT_AUDITOR Elevation Required</div>
          <div style={{ fontSize: 13, color: 'var(--text2)', maxWidth: 400, margin: '0 auto 20px' }}>
            Audit logs contain sensitive security information. Request <strong>JIT_AUDITOR</strong> access from the Dashboard to view them.
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            Justification: Audit logs reveal login patterns, IP addresses, and account activity.<br />
            Access is time-limited to 15 minutes and fully logged.
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <div className="page-title">📋 Audit Logs</div>
        <div className="page-desc">Security event history — JIT_AUDITOR session active</div>
      </div>

      <div className="tabs" style={{ marginBottom: 16 }}>
        <button className={`tab${tab === 0 ? ' active' : ''}`} onClick={() => { setTab(0); setPage(0); }}>All Events</button>
        <button className={`tab${tab === 1 ? ' active' : ''}`} onClick={() => { setTab(1); setPage(0); }}>Security Events</button>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>
            {loading ? 'Loading…' : `${total} event${total !== 1 ? 's' : ''}`}
          </div>
          <input
            placeholder="Filter by user or event type…"
            value={filter} onChange={e => setFilter(e.target.value)}
            style={{ width: 260, padding: '6px 10px', fontSize: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)' }}
          />
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Time</th><th>User</th><th>Event</th><th>IP</th><th>Detail</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text3)', padding: 24 }}>No events found</td></tr>
              )}
              {filtered.map(e => (
                <tr key={e.id}>
                  <td className="td-mono" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{fmtTime(e.createdAt)}</td>
                  <td><strong>{e.username || '—'}</strong></td>
                  <td><span className={`badge ${EVENT_COLORS[e.eventType] || 'badge-blue'}`}>{e.eventType}</span></td>
                  <td className="td-mono" style={{ fontSize: 11 }}>{e.ipAddress || '—'}</td>
                  <td style={{ fontSize: 11, color: 'var(--text2)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.detail || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {tab === 0 && totalPages > 1 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'center' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>← Prev</button>
            <span style={{ fontSize: 13, color: 'var(--text2)', alignSelf: 'center' }}>Page {page + 1} / {totalPages}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>Next →</button>
          </div>
        )}
      </div>
    </>
  );
}
