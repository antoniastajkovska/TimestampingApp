# Timestamping Server

A cryptographic timestamping service that proves a file existed at a specific point in time.  
Files are never uploaded — the browser computes SHA-256 locally; the server signs it with RSA-4096 PS256 JWS and stores it in a tamper-evident log chain.

**Stack:** Spring Boot 3.3 · Java 21 · PostgreSQL 15 · React 18  
**Security details:** [docs/security.md](docs/security.md)

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Docker Desktop | latest | [docker.com](https://www.docker.com/products/docker-desktop) — runs everything |
| OpenSSL 3.x | 3.x | Bundled with Git for Windows |
| Git for Windows | any | Needed to run `generate-certs.sh` in Git Bash |

> Java and Node.js are **not required** — they run inside Docker containers.

---

## First-Time Setup

Do these steps once, in order.

### 1. Clone the repository

```bash
git clone <repo-url>
cd TimestampingApp
```

### 2. Create your `.env` file

```bash
copy .env.example .env
```

Open `.env` and adjust values if needed. The defaults work for local development.

### 3. Generate certificates

Open **Git Bash** and run from the repo root:

```bash
bash generate-certs.sh
```

This creates a `certs/` folder next to the script (gitignored — every developer must run this step).  
The script generates the full PKI hierarchy:

```
TimestampingApp Root CA  (self-signed, 4096-bit, 10 years)
    ├── TLS CA  →  tls.crt       (serverAuth, SAN=localhost, 1 year)
    │           →  client.crt    (clientAuth, optional mTLS)
    └── TSA CA  →  tsa.crt       (timeStamping + nonRepudiation ONLY, 4096-bit, 3 years)
```

### 4. Trust the Root CA in Chrome

1. Press `Win + R`, type `certmgr.msc`, press Enter
2. Go to **Trusted Root Certification Authorities → Certificates**
3. Right-click → **All Tasks → Import** → select `certs\rootCA.crt`
4. Restart Chrome

---

## Running the App

### Docker (recommended — single command)

```bash
# First run or after any code change:
docker compose up --build

# Subsequent runs (no code changes):
docker compose up

# Stop:
docker compose down

# Stop and wipe the database:
docker compose down -v
```

Wait for all three services to be healthy, then open **https://localhost:3001** in Chrome.

| Service | URL |
|---------|-----|
| Frontend | https://localhost:3001 |
| Backend API | https://localhost:8443 |
| Actuator (health) | http://localhost:9090/actuator/health |

> **First build:** Docker pulls base images and compiles the backend (~3–5 min). Subsequent builds are fast thanks to layer caching.

### Local (without Docker — for active development / hot reload)

Requires Java 21 and Node 20 installed locally. Open three terminals from the repo root:

```powershell
# Terminal 1 — database
.\scripts\Start-DB.ps1

# Terminal 2 — backend  (https://localhost:8443)
.\scripts\Start-Backend.ps1

# Terminal 3 — frontend (https://localhost:3001)
.\scripts\Start-Frontend.ps1
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
│   ├── Dockerfile              Multi-stage Maven build → JRE runtime
│   └── src/main/
│       ├── java/.../           controller/ service/ repository/ model/ dto/ config/ security/
│       └── resources/
│           ├── application.yml Spring Boot config (reads from .env)
│           └── schema.sql      Schema + seed data (roles + admin user)
├── frontend/                   React 18 application (Create React App)
│   ├── Dockerfile              Node 20 dev server
│   └── src/
│       ├── pages/              Login, Register, Dashboard, Timestamp, Verify, Profile, Audit
│       ├── api/client.js       All fetch calls (proxied via setupProxy.js)
│       ├── setupProxy.js       Configurable proxy — localhost:8443 or Docker service
│       └── context/AuthContext.jsx  Session state
├── scripts/                    Windows PowerShell helpers (local dev without Docker)
│   ├── Start-DB.ps1
│   ├── Start-Backend.ps1
│   └── Start-Frontend.ps1
├── docs/
│   └── security.md             Full security architecture reference
├── certs/                      Generated locally — gitignored (run generate-certs.sh)
├── docker-compose.yml          Full stack: db + backend + frontend
├── generate-certs.sh           PKI hierarchy generation (run in Git Bash)
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
| POST | `/api/auth/register` | Public | Register (sends OTP to email) |
| POST | `/api/auth/register/verify` | Public | Confirm registration OTP |
| POST | `/api/auth/login` | Public | Step 1 login (sends 2FA OTP) |
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
| POST | `/api/nonce/generate` | Auth | Get single-use nonce for timestamping |
| POST | `/api/timestamp/request` | Auth | Create timestamp (requires nonce) |
| POST | `/api/timestamp/verify` | Public | Verify `.tsr` token |
| GET | `/api/timestamp/history` | Auth | Own timestamp history (paginated) |
| GET | `/api/timestamp/{serialNumber}` | Auth | Single timestamp details |
| GET | `/api/tsa/certificate` | Public | TSA certificate PEM (for offline verification) |
| POST | `/api/jit/request-auditor` | ADMIN | Elevate to JIT_AUDITOR (15 min) |
| POST | `/api/jit/request-delete` | ADMIN | Elevate to JIT_DELETE (15 min) |
| GET | `/api/audit/logs` | JIT_AUDITOR | Paginated audit log |
| GET | `/api/audit/security-events` | JIT_AUDITOR | Security events only |
| GET | `/api/admin/validate-chain` | ADMIN | Full log chain integrity check |

---

## Common Issues

**Certificate warning in browser**  
→ Import `certs\rootCA.crt` into Trusted Root Certification Authorities (step 4) and restart Chrome.

**`Could not load store from file:../certs/keystore.p12`**  
→ Run `bash generate-certs.sh` first (step 3). The `certs/` folder must exist before starting.

**`ERR_SSL_TLSV13_ALERT_CERTIFICATE_REQUIRED` in proxy**  
→ mTLS is enabled but the dev proxy can't present a client cert. Comment out `SSL_CLIENT_AUTH=need` in `.env` and restart. See [docs/security.md](docs/security.md) for mTLS setup.

**Emails not sending**  
→ Check `MAIL_USER` and `MAIL_PASS` in `.env`. Requires a Gmail App Password, not your account password.

**`relation "users" does not exist`**  
→ The database volume is empty or schema didn't run. Recreate it:
```bash
docker compose down -v
docker compose up --build
```

**Port 5432 already in use**  
→ A local PostgreSQL instance is running. Stop it or change the port in `docker-compose.yml`.

**`WDS` WebSocket error in browser console (frontend Docker)**  
→ Normal on first load — the dev server reconnects automatically after the container is fully up.
