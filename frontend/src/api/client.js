const BASE = '/api';

function getCsrfToken() {
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function request(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const csrfHeaders = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)
    ? { 'X-XSRF-TOKEN': getCsrfToken() || '' }
    : {};

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...csrfHeaders, ...options.headers },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

export const api = {
  // Auth
  register:        (body) => request('/auth/register',         { method: 'POST', body: JSON.stringify(body) }),
  confirmRegister: (body) => request('/auth/register/verify',  { method: 'POST', body: JSON.stringify(body) }),
  login:           (body) => request('/auth/login',            { method: 'POST', body: JSON.stringify(body) }),
  verify2fa:       (body) => request('/auth/verify-2fa',       { method: 'POST', body: JSON.stringify(body) }),
  logout:          ()     => request('/auth/logout',           { method: 'POST' }),

  // Users
  getMe:           ()     => request('/users/me'),
  getAllUsers:      ()     => request('/users'),
  updateProfile:   (body) => request('/users/me',              { method: 'PUT',    body: JSON.stringify(body) }),
  changePassword:  (body) => request('/users/me/password',     { method: 'PUT',    body: JSON.stringify(body) }),
  deleteAccount:   (body) => request('/users/me',              { method: 'DELETE', body: JSON.stringify(body) }),

  // JIT elevation (ADMIN only — password required)
  requestAuditor:  (password) => request('/jit/request-auditor', { method: 'POST', body: JSON.stringify({ password }) }),
  requestDelete:   (password) => request('/jit/request-delete',  { method: 'POST', body: JSON.stringify({ password }) }),

  // Timestamps
  generateNonce:   ()     => request('/nonce/generate',        { method: 'POST' }),
  createTimestamp: (body) => request('/timestamp',             { method: 'POST', body: JSON.stringify(body) }),
  verifyTimestamp: (body) => request('/timestamp/verify',      { method: 'POST', body: JSON.stringify(body) }),

  // Admin user management
  adminCreateUser: (body) => request('/users',                 { method: 'POST',   body: JSON.stringify(body) }),
  adminUpdateUser: (id, body) => request(`/users/${id}`,       { method: 'PUT',    body: JSON.stringify(body) }),
  adminDeleteUser: (id)   => request(`/users/${id}`,           { method: 'DELETE' }),

  // Audit logs (JIT_AUDITOR only)
  getAuditLogs:         (page = 0, size = 50) => request(`/audit/logs?page=${page}&size=${size}`),
  getSecurityEvents:    (page = 0, size = 100) => request(`/audit/security-events?page=${page}&size=${size}`),
};
