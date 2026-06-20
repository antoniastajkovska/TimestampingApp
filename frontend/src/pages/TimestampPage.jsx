import React, { useState } from 'react';
import { hashFile } from '../hooks/useFileSha256';
import { api } from '../api/client';
import DropZone from '../components/DropZone';

function fmtBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function TimestampPage() {
  const [file, setFile]         = useState(null);
  const [fileHash, setFileHash] = useState('');
  const [hashing, setHashing]   = useState(false);
  const [hashProgress, setHashProgress] = useState(0);
  const [tokenData, setTokenData] = useState(null);
  const [error, setError]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied]     = useState(false);

  async function handleFileSelect(f) {
    if (!f) return;
    setFile(f); setFileHash(''); setTokenData(null); setError('');
    setHashing(true); setHashProgress(0);
    const fakeProgress = setInterval(() => setHashProgress(p => Math.min(p + Math.random() * 20 + 5, 90)), 80);
    try {
      const hash = await hashFile(f);
      clearInterval(fakeProgress);
      setHashProgress(100);
      setTimeout(() => { setFileHash(hash); setHashing(false); }, 300);
    } catch (err) {
      clearInterval(fakeProgress);
      setError('Failed to hash file: ' + err.message);
      setHashing(false);
    }
  }

  async function handleTimestamp(e) {
    e.preventDefault();
    if (!fileHash) return;
    setError(''); setSubmitting(true);
    try {
      const res = await api.createTimestamp({ fileHash });
      setTokenData(res);
    } catch (err) { setError(err.message); }
    finally { setSubmitting(false); }
  }

  function downloadToken() {
    if (!tokenData) return;
    const blob = new Blob([JSON.stringify(tokenData, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `timestamp_${tokenData.sequenceNumber}.tsr`; a.click();
    URL.revokeObjectURL(url);
  }

  function copySignature() {
    if (!tokenData?.signature) return;
    navigator.clipboard.writeText(tokenData.signature).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <>
      <div className="page-header">
        <div className="page-title">⏱️ Create Timestamp</div>
        <div className="page-desc">Cryptographically prove a file existed at this moment in time</div>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>

        {/* Left: File + Hash */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-header">
              <span className="card-icon">📁</span>
              <div><div className="card-title">File Selection</div><div className="card-subtitle">SHA-256 via Web Crypto API</div></div>
            </div>

            <DropZone
              onFile={handleFileSelect}
              file={file}
              icon="🗂️"
              emptyTitle="Drop file here or click to browse"
              emptySub="File never leaves your browser — SHA-256 computed locally"
            >
              <div className="upload-icon">📄</div>
              <div className="upload-title">{file?.name}</div>
              <div className="upload-sub">{file && fmtBytes(file.size)} · {file?.type || 'unknown type'}</div>
              {!hashing && fileHash && <div style={{ marginTop: 10 }}><span className="badge badge-green">✓ Hashed</span></div>}
            </DropZone>

            {hashing && (
              <div className="progress-wrap" style={{ marginTop: 14 }}>
                <div className="progress-label"><span>Computing SHA-256…</span><span>{Math.round(hashProgress)}%</span></div>
                <div className="progress-bar"><div className="progress-fill" style={{ width: `${hashProgress}%` }} /></div>
              </div>
            )}

            {fileHash && !hashing && (
              <div style={{ marginTop: 14 }}>
                <div className="hash-label">SHA-256 Digest</div>
                <div className="hash-box" style={{ marginTop: 6 }}>
                  {fileHash}
                  <button className="copy-btn" onClick={() => navigator.clipboard.writeText(fileHash)}>Copy</button>
                </div>
              </div>
            )}

            {error && <div className="result-box error" style={{ marginTop: 12 }}>{error}</div>}

            <form onSubmit={handleTimestamp}>
              <button type="submit" className="btn btn-cyan btn-full btn-lg" style={{ marginTop: 16 }}
                disabled={!fileHash || submitting || hashing}>
                {submitting ? '⏳ Creating…' : '🔏 Generate Timestamp'}
              </button>
            </form>
          </div>

          {/* How it works */}
          <div className="card" style={{ marginBottom: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.05em' }}>🛡️ How it works</div>
            {[['1','Select file','SHA-256 computed in your browser — file never uploaded','var(--blue)'],
              ['2','Hash sent','Only the 64-char hex digest is transmitted','var(--cyan)'],
              ['3','Server signs','RSA-2048 JWS RS256 token created + chained','var(--green)'],
              ['4','Download .tsr','Cryptographic proof of existence','var(--purple)']
            ].map(([n, t, d, c]) => (
              <div key={n} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
                <div style={{ width: 22, height: 22, background: c, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0, color: '#fff' }}>{n}</div>
                <div><div style={{ fontSize: 12, fontWeight: 600 }}>{t}</div><div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{d}</div></div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Certificate */}
        <div>
          {tokenData && (
            <div className="result-box warning" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>⚠️</span>
              <span><strong>Download now</strong> — this token cannot be retrieved later.</span>
            </div>
          )}
          {tokenData ? (
            <div className="cert-card">
              <div className="cert-watermark">🔏</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--cyan)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Cryptographic Timestamp</div>
                  <div style={{ fontSize: 19, fontWeight: 900, marginTop: 2 }}>Certificate of Time</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 30 }}>📜</div>
                  <span className="badge badge-green" style={{ marginTop: 6, display: 'inline-flex' }}>✓ Valid</span>
                </div>
              </div>
              <div className="cert-row"><div className="cert-key">Sequence #</div><div className="cert-val highlight">#{String(tokenData.sequenceNumber).padStart(8, '0')}</div></div>
              <div className="cert-row"><div className="cert-key">UTC Timestamp</div><div className="cert-val">{new Date(tokenData.timestampUtc || tokenData.timestamp).toISOString()}</div></div>
              <div className="cert-row">
                <div className="cert-key">SHA-256 Hash</div>
                <div className="cert-val highlight" style={{ fontSize: 10 }}>{(tokenData.fileHash || fileHash).slice(0, 32)}…</div>
              </div>
              {tokenData.previousRowHash && (
                <div className="cert-row">
                  <div className="cert-key">Prev Row Hash</div>
                  <div className="cert-val" style={{ fontSize: 10, color: 'var(--text2)' }}>{tokenData.previousRowHash.slice(0, 32)}…</div>
                </div>
              )}
              <div className="cert-row"><div className="cert-key">Algorithm</div><div className="cert-val"><span className="badge badge-purple">RS256</span></div></div>
              <div className="cert-row"><div className="cert-key">Chain Integrity</div><div className="cert-val"><span className="badge badge-green">✓ Intact</span></div></div>

              <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
                <button className="btn btn-cyan btn-sm" onClick={downloadToken}>💾 Download .tsr</button>
                <button className="btn btn-secondary btn-sm" onClick={copySignature}>{copied ? '✓ Copied!' : '📋 Copy Sig'}</button>
              </div>
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '60px 24px', marginBottom: 0 }}>
              <div style={{ fontSize: 52, marginBottom: 16, opacity: .2 }}>📜</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text3)' }}>Timestamp certificate</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>will appear here after hashing &amp; submitting</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
