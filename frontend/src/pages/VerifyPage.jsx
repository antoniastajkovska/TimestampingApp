import React, { useState } from 'react';
import { hashFile } from '../hooks/useFileSha256';
import { api } from '../api/client';
import DropZone from '../components/DropZone';

export default function VerifyPage() {
  const [origFile, setOrigFile] = useState(null);
  const [tokenFile, setTokenFile] = useState(null);
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  async function handleVerify(e) {
    e.preventDefault();
    if (!origFile || !tokenFile) return;
    setResult(null);
    setLoading(true);
    setProgress(10);

    try {
      setStatus('Computing SHA-256 locally...');
      setProgress(30);
      const fileHash = await hashFile(origFile);
      setProgress(60);
      const tokenJson = await tokenFile.text();
      const tokenObj = JSON.parse(tokenJson);
      setStatus('Verifying signature with server...');
      setProgress(85);
      const response = await api.verifyTimestamp({ fileHash, token: tokenObj.token || tokenObj.signature });
      setProgress(100);
      setResult({ ...response, fileHash });
      setStatus('');
    } catch (err) {
      setResult({ valid: false, message: err.message });
      setStatus('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="verify-page">
      <div className="page-header">
        <div className="page-title">Verify Timestamp</div>
        <div className="page-desc">Public verification - confirm a file has not been altered since timestamping</div>
      </div>

      <div className="grid-2" style={{ marginBottom: 20, alignItems: 'start' }}>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <div>
              <div className="card-title">Original File</div>
              <div className="card-subtitle">SHA-256 computed locally</div>
            </div>
          </div>
          <DropZone
            onFile={f => { setOrigFile(f); setResult(null); }}
            file={origFile}
            emptyTitle="Drop original file here"
            emptySub="Hash computed in browser - never uploaded"
          />
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <div>
              <div className="card-title">.tsr Token</div>
              <div className="card-subtitle">JWS RS256 signed receipt</div>
            </div>
          </div>
          <DropZone
            onFile={f => { setTokenFile(f); setResult(null); }}
            file={tokenFile}
            accept=".tsr,.json"
            emptyTitle="Drop .tsr file here"
            emptySub="The signed timestamp receipt"
          />
        </div>
      </div>

      <form onSubmit={handleVerify}>
        {loading && (
          <div className="progress-wrap" style={{ marginBottom: 16 }}>
            <div className="progress-label"><span>{status}</span><span>{progress}%</span></div>
            <div className="progress-bar"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
          </div>
        )}
        <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={loading || !origFile || !tokenFile}>
          {loading ? 'Verifying...' : 'Verify Authenticity'}
        </button>
        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text3)', marginTop: 10 }}>
          RSA-2048 signature verification + SHA-256 hash comparison - no file ever uploaded
        </div>
      </form>

      {result && (
        <div className={`verify-result ${result.valid ? 'valid' : 'invalid'}`}>
          <div className="verify-title">{result.valid ? 'Valid token' : 'Invalid token'}</div>
          <div className="verify-sub">{result.valid ? 'Cryptographic authenticity confirmed' : result.message || 'Verification failed'}</div>

          {result.valid && (
            <>
              <div className="grid-2" style={{ textAlign: 'left', marginBottom: 20 }}>
                {result.timestamp && (
                  <div className="card" style={{ background: 'rgba(15,23,42,.5)', marginBottom: 0, padding: 14 }}>
                    <div className="hash-label">UTC Timestamp</div>
                    <div style={{ fontSize: 13, marginTop: 4 }}>{new Date(result.timestamp).toISOString()}</div>
                  </div>
                )}
                {result.sequenceNumber != null && (
                  <div className="card" style={{ background: 'rgba(15,23,42,.5)', marginBottom: 0, padding: 14 }}>
                    <div className="hash-label">Sequence #</div>
                    <div style={{ fontSize: 13, marginTop: 4, fontFamily: "'JetBrains Mono',monospace" }}>#{result.sequenceNumber}</div>
                  </div>
                )}
                {result.requestedBy && (
                  <div className="card" style={{ background: 'rgba(15,23,42,.5)', marginBottom: 0, padding: 14 }}>
                    <div className="hash-label">Requested By</div>
                    <div style={{ fontSize: 13, marginTop: 4 }}>{result.requestedBy}</div>
                  </div>
                )}
                <div className="card" style={{ background: 'rgba(15,23,42,.5)', marginBottom: 0, padding: 14 }}>
                  <div className="hash-label">Chain Integrity</div>
                  <div style={{ fontSize: 13, marginTop: 4, color: 'var(--green)' }}>Intact</div>
                </div>
              </div>

              {result.fileHash && (
                <div style={{ marginBottom: 16, textAlign: 'left' }}>
                  <div className="hash-label">Verified SHA-256</div>
                  <div className="hash-box" style={{ marginTop: 6 }}>{result.fileHash}</div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span className="badge badge-green">Signature Valid</span>
                <span className="badge badge-cyan">Hash Match</span>
                <span className="badge badge-blue">Chain Intact</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
