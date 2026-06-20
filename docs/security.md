# Security Architecture

## Transport Security — TLS

All traffic runs over TLS 1.2/1.3. The PKI chain is generated locally by `generate-certs.sh`:

```
Root CA (FINKI CA, RSA-4096, 10 years, self-signed)
  └── Lab CA (RSA-4096, 5 years, pathlen:0)
        ├── Server cert (RSA-2048, CN=localhost, SAN: DNS:localhost / IP:127.0.0.1, 1 year)
        └── Client cert (RSA-2048, CN=TimestampingClient, 1 year)
```

All CA certificates carry `basicConstraints=critical,CA:TRUE` and `keyUsage=critical,keyCertSign,cRLSign` per RFC 5280.

### mTLS (optional)

mTLS is **disabled by default** (`client-auth: none` in `application.yml`). The infrastructure to enable it is in place:

- `certs/truststore.p12` — contains Root CA + Lab CA (created by `generate-certs.sh` if `keytool` is on PATH)
- `certs/client.p12` — client certificate for browser import (password in `.env` as `CLIENT_CERT_PASSWORD`)

To enable mTLS, set in `.env`:
```
SSL_CLIENT_AUTH=need
SSL_TRUSTSTORE_PATH=../certs/truststore.p12
```
Then import `certs/client.p12` into your browser before restarting the backend.

---

## Authentication — 2FA

Login is a two-step process:

1. **Credentials** — username/password verified with BCrypt(12)
2. **OTP** — 8-digit code sent by email; valid for 10 minutes; 5 failed attempts trigger a 15-minute lockout

Registration uses the same OTP flow with a 15-minute window.

---

## Sessions

Sessions are managed server-side with a custom `SessionService` backed by a `ConcurrentHashMap`. The session token is stored in an **HttpOnly + Secure + SameSite=Strict** cookie named `TSESSION` and expires after 1 hour.

> **Note:** The in-memory store means sessions are lost on server restart. This is acceptable for a lab environment. A Redis-backed store would be required for production or multi-instance deployment.

---

## Authorization — RBAC + JIT Elevation

| Role | Assignment | Scope |
|------|-----------|-------|
| `USER` | Auto at registration | Create timestamps, manage own profile |
| `ADMIN` | Manually assigned in DB | Manage users, request JIT elevation |
| `JIT_AUDITOR` | ADMIN self-elevates (15 min) | View audit logs and security events |
| `JIT_DELETE` | ADMIN self-elevates (15 min) | Delete users, revoke sessions |

JIT elevation requires **password re-entry** and is auto-revoked after 15 minutes by a scheduled background task. All grants and revocations are written to the audit log.

---

## Timestamp Tokens

1. Browser computes SHA-256 of the file using the Web Crypto API — the file itself is never transmitted
2. The server signs `{ fileHash, timestamp, seq }` with RSA-4096 RS256 (JWS compact format)
3. The signed token is stored in the log chain and returned to the client as a `.tsr` file
4. Verification requires only the public key — no database lookup

### Log Chain Integrity

Each row in `log_chain` stores the SHA-256 of the previous row's canonical JSON:

```json
{"seq":N,"fileHash":"...","timestamp":...,"signature":"...","prevHash":"..."}
```

Any modification to a past entry breaks all subsequent hashes, making tampering detectable.

---

## Security Headers

Set on every response by Spring Security:

| Header | Value |
|--------|-------|
| `Content-Security-Policy` | `default-src 'none'; connect-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `no-referrer` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |

---

## Audit Log

All security-relevant events are written to the `audit_log` table with timestamp, username, IP address, and detail:

| Event | Trigger |
|-------|---------|
| `REGISTER` | New account created |
| `LOGIN_SUCCESS` | Successful 2FA |
| `LOGIN_FAIL` | Wrong password |
| `OTP_FAIL` | Wrong OTP code |
| `OTP_LOCKED` | OTP lockout triggered |
| `LOGOUT` | Session invalidated |
| `PASSWORD_CHANGE` | Password updated |
| `ACCOUNT_DELETE` | Account deleted |
| `TIMESTAMP_REQUEST` | Timestamp created |
| `VERIFY_REQUEST` | Token verified |
| `JIT_GRANT` | JIT role elevated |
| `JIT_REVOKE` | JIT role auto-expired |
