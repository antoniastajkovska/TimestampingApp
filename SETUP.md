# Timestamping Server — Setup Guide

## Prerequisites
- Java 21, Maven 3.9+
- Node.js 20+, npm
- PostgreSQL 15+
- OpenSSL (for cert generation)

## 1. Database

```sql
CREATE DATABASE timestampingdb;
```

Then run `backend/src/main/resources/schema.sql` to create tables and seed roles.

## 2. Cryptographic Material

```bash
bash generate-certs.sh
```

This creates:
- `private.pem` / `public.pem` — RSA-2048 signing key pair
- `keystore.p12` — TLS keystore for HTTPS

## 3. Backend

```bash
cd backend
export SSL_KEYSTORE_PASSWORD=changeit
export DB_USER=postgres
export DB_PASSWORD=yourpassword
export PRIVATE_KEY_PATH=$(pwd)/src/main/resources/certs/private.pem
export PUBLIC_KEY_PATH=$(pwd)/src/main/resources/certs/public.pem
mvn spring-boot:run
```

Server starts on **https://localhost:8443**

The 2FA code is printed to the console in test mode:
```
=== 2FA CODE for alice : 483921 ===
```

## 4. Frontend

```bash
cd frontend
npm install
HTTPS=true npm start
```

Frontend runs on **https://localhost:3000** (self-signed cert warning is expected).

## API Summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | Public | Create account |
| POST | `/api/auth/login` | Public | Step 1: password → OTP |
| POST | `/api/auth/verify-2fa` | Public | Step 2: OTP → session cookie |
| POST | `/api/auth/logout` | Session | Invalidate session |
| POST | `/api/jit/request-writer` | Session | Grant JIT USER_WRITER (15 min) |
| POST | `/api/timestamp` | USER_WRITER | Submit file hash, receive .tsr token |
| POST | `/api/timestamp/verify` | Public | Verify a .tsr token |

## Security Architecture

```
Browser
  ├── Web Crypto API: SHA-256(file) computed locally
  ├── Only the hex digest is sent over HTTPS
  └── Session managed via HttpOnly + Secure + SameSite=Strict cookie

Spring Boot
  ├── BCrypt(12) password hashing
  ├── 2FA: 6-digit OTP with 5-minute expiry
  ├── SessionFilter: validates opaque token in cookie → SecurityContext
  ├── @PreAuthorize("hasRole('USER_WRITER')") on timestamp endpoint
  ├── JIT: @Scheduled every 60s revokes expired USER_WRITER grants
  └── Log Chain: SHA-256(prev_row_canonical_json) links each entry

PostgreSQL
  └── log_chain.previous_row_hash makes the table tamper-evident
```
