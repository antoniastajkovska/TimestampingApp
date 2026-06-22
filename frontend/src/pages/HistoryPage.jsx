import React, { useState, useEffect } from 'react';
import { api } from '../api/client';

export default function HistoryPage() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [copied, setCopied]   = useState(null);

  useEffect(() => {
    api.getHistory()
      .then(setEntries)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function copyToken(sig, idx) {
    navigator.clipboard.writeText(sig).then(() => {
      setCopied(idx);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  const fmt = (iso) => new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

  return (
    <>
      <div className="page-header">
        <div className="page-title">📜 Timestamp History</div>
        <div className="page-desc">Your last 50 timestamped documents</div>
      </div>

      {error && <div className="result-box error" style={{ marginBottom: 16 }}>{error}</div>}

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px', color: 'var(--text3)' }}>
          Loading…
        </div>
      ) : entries.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 24px' }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: .2 }}>📜</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text3)' }}>No timestamps yet</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>
            Go to the Timestamp page to create your first one
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Seq #</th>
                  <th>UTC Time</th>
                  <th>SHA-256 Hash</th>
                  <th>NTP Source</th>
                  <th>Signature</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr key={e.sequenceNumber}>
                    <td className="td-mono">
                      <span className="badge badge-blue">#{String(e.sequenceNumber).padStart(4, '0')}</span>
                    </td>
                    <td className="td-mono" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                      {fmt(e.timestampUtc)}
                    </td>
                    <td className="td-mono" style={{ fontSize: 11 }}>
                      <span title={e.fileHash}>
                        {e.fileHash.slice(0, 16)}…{e.fileHash.slice(-8)}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--cyan)' }}>
                      {e.ntpSource || '—'}
                    </td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => copyToken(e.signature, i)}
                        style={{ fontSize: 11 }}
                      >
                        {copied === i ? '✓ Copied' : '📋 Copy JWS'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text3)' }}>
            {entries.length} record{entries.length !== 1 ? 's' : ''} · sorted newest first
          </div>
        </div>
      )}
    </>
  );
}
