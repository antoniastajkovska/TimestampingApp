# Timestamping Server

A cryptographic timestamping service that proves a file existed at a specific point in time.  
Files are never uploaded — the browser computes SHA-256 locally; the server signs it with RSA-4096 JWS (RS256) and stores it in a tamper-evident log chain.

**Stack:** Spring Boot 3.3 · Java 21 · PostgreSQL 15 · React 18  
**Security details:** [docs/security.md](docs/security.md)

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Java JDK | 21+ | [Adoptium](https://adoptium.net) |
| Node.js | 20+ | [nodejs.org](https://nodejs.org) |
| Docker Desktop | latest | For PostgreSQL |
| OpenSSL 3.x | 3.x | Bundled with Git for Windows |
| Git for Windows | any | Needed to run `generate-certs.sh` |

---

## First-Time Setup

Do these steps once, in order.

### 1. Clone the repository

```
git clone <repo-url>
cd TimestampingApp
```

### 2. Create your `.env` file

```
copy .env.example .env
```

Open `.env` and adjust values if needed. The defaults work for local development.

### 3. Generate certificates

Open **Git Bash** and run from the repo root:

```bash
cd backend
bash ../generate-certs.sh
cd ..
```

This creates a `certs/` folder (gitignored — every team member must run this step).

### 4. Trust the Root CA in Chrome

1. Press `Win + R`, type `certmgr.msc`, press Enter
2. Go to **Trusted Root Certification Authorities → Certificates**
3. Right-click → **All Tasks → Import** → select `certs\rootCA.crt`
4. Restart Chrome

### 5. Install frontend dependencies (once)

```
cd frontend
npm install
cd ..
```

---

## Running the App

Use the PowerShell helper scripts — open three separate terminals from the repo root:

```powershell
# Terminal 1 — database
.\scripts\Start-DB.ps1

# Terminal 2 — backend  (https://localhost:8443)
.\scripts\Start-Backend.ps1

# Terminal 3 — frontend (https://localhost:3001)
.\scripts\Start-Frontend.ps1
```

> **First backend run:** Maven downloads all dependencies (~2 min). Subsequent starts are fast.

### Git Bash alternative

```bash
# Terminal 1
docker compose up -d

# Terminal 2
cd backend && set -a; source ../.env; set +a && ./mvnw spring-boot:run

# Terminal 3
cd frontend && npm start
```

---

## Default Admin Account

Seeded automatically by `schema.sql`:

| Field | Value |
|-------|-------|
| Username | `admin` |
| Password | `Password@123` |
| Email | `timestampingapp.dev@gmail.com` |

To promote another user to ADMIN:
```sql
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r
WHERE u.username = 'their-username' AND r.name = 'ADMIN';
```

---

## Project Structure

```
TimestampingApp/
├── backend/                    Spring Boot application
│   └── src/main/
│       ├── java/.../           controller/ service/ repository/ model/ dto/ config/ security/
│       └── resources/
│           ├── application.yml Spring Boot config (reads from .env)
│           └── schema.sql      Schema + seed data (roles + admin user)
├── frontend/                   React 18 application
│   └── src/
│       ├── pages/              Login, Dashboard, Timestamp, Verify, Profile, Audit
│       ├── api/client.js       All fetch calls
│       └── context/AuthContext.jsx  Session state
├── scripts/                    Windows PowerShell startup helpers
│   ├── Start-DB.ps1
│   ├── Start-Backend.ps1
│   └── Start-Frontend.ps1
├── docs/
│   └── security.md             Full security architecture reference
├── certs/                      Generated locally — gitignored
├── docker-compose.yml          PostgreSQL only
├── generate-certs.sh           PKI + JWS key generation (run in Git Bash)
├── .env                        Local secrets — gitignored
└── .env.example                Template — committed, safe to share
```

---

## Role Model

| Role | Assigned | Permissions |
|------|----------|-------------|
| `USER` | Auto at registration | Create timestamps, manage own profile, verify tokens |
| `ADMIN` | Manually in DB | Everything USER can + manage users + request JIT elevation |
| `JIT_AUDITOR` | ADMIN self-elevates, 15 min | View audit logs and security events |
| `JIT_DELETE` | ADMIN self-elevates, 15 min | Delete users and revoke sessions |

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | Public | Register (sends OTP) |
| POST | `/api/auth/register/verify` | Public | Confirm registration OTP |
| POST | `/api/auth/login` | Public | Step 1 login (sends OTP) |
| POST | `/api/auth/verify-2fa` | Public | Step 2 login (verify OTP) |
| POST | `/api/auth/logout` | Auth | Invalidate session |
| GET | `/api/users/me` | Auth | Own profile |
| PUT | `/api/users/me` | Auth | Update profile |
| PUT | `/api/users/me/password` | Auth | Change password |
| DELETE | `/api/users/me` | Auth | Delete own account |
| GET | `/api/users` | ADMIN | List all users |
| POST | `/api/users` | ADMIN | Create user |
| PUT | `/api/users/{id}` | ADMIN | Update user |
| DELETE | `/api/users/{id}` | JIT_DELETE | Delete user |
| POST | `/api/timestamp` | Auth | Create timestamp |
| POST | `/api/timestamp/verify` | Public | Verify `.tsr` token |
| POST | `/api/jit/request-auditor` | ADMIN | Elevate to JIT_AUDITOR |
| POST | `/api/jit/request-delete` | ADMIN | Elevate to JIT_DELETE |
| GET | `/api/audit/logs` | JIT_AUDITOR | Paginated audit log |
| GET | `/api/audit/security-events` | JIT_AUDITOR | Security events |

---

## Common Issues

**Certificate warning in browser**  
→ Import `certs\rootCA.crt` into Trusted Root Certification Authorities (step 4) and restart Chrome.

**`Could not load store from file:../certs/keystore.p12`**  
→ Run `generate-certs.sh` first (step 3).

**`ERR_SSL_TLSV13_ALERT_CERTIFICATE_REQUIRED` in proxy**  
→ mTLS is enabled but the dev proxy can't present a client cert. Comment out `SSL_CLIENT_AUTH=need` in `.env` and restart the backend. See [docs/security.md](docs/security.md) for mTLS details.

**Emails not sending**  
→ Check `MAIL_USER` and `MAIL_PASS` in `.env`. Requires a Gmail App Password, not your account password.

**`relation "users" does not exist`**  
→ Recreate the DB volume:
```
docker compose down -v
docker compose up -d
```

**Port 5432 already in use**  
→ A local PostgreSQL instance is running. Stop it or change the port in `docker-compose.yml`.
