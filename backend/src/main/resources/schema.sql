-- ============================================================
-- DDL — Timestamping Server Database Schema
-- ============================================================

-- Roles lookup table
CREATE TABLE IF NOT EXISTS roles (
    id          BIGSERIAL    PRIMARY KEY,
    name        VARCHAR(50)  NOT NULL UNIQUE
);

-- Users
CREATE TABLE IF NOT EXISTS users (
    id                  BIGSERIAL       PRIMARY KEY,
    username            VARCHAR(100)    NOT NULL UNIQUE,
    email               VARCHAR(255)    NOT NULL UNIQUE,
    password_hash       VARCHAR(255)    NOT NULL,           -- BCrypt(12)
    enabled             BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),

    -- 2FA state
    totp_secret         VARCHAR(64),
    totp_expires_at     TIMESTAMPTZ,
    totp_attempts       INT             NOT NULL DEFAULT 0,  -- brute-force counter
    totp_locked_until   TIMESTAMPTZ,                        -- set after max failures

    -- Profile fields
    first_name          VARCHAR(100),
    last_name           VARCHAR(100),
    updated_at          TIMESTAMPTZ,

    -- JIT_AUDITOR state (ADMIN only, 15 min)
    auditor_granted_at  TIMESTAMPTZ,
    auditor_expires_at  TIMESTAMPTZ,

    -- JIT_DELETE state (ADMIN only, 15 min)
    delete_granted_at   TIMESTAMPTZ,
    delete_expires_at   TIMESTAMPTZ
);

-- Many-to-many: users <-> roles
CREATE TABLE IF NOT EXISTS user_roles (
    user_id     BIGINT  NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    role_id     BIGINT  NOT NULL REFERENCES roles(id)  ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

-- Single-use nonces (anti-replay)
CREATE TABLE IF NOT EXISTS nonces (
    id          BIGSERIAL       PRIMARY KEY,
    nonce_hex   VARCHAR(64)     NOT NULL UNIQUE,
    created_by  BIGINT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at  TIMESTAMPTZ     NOT NULL,
    used        BOOLEAN         NOT NULL DEFAULT FALSE
);

-- Tamper-evident log chain
-- sequence_number is allocated from a dedicated sequence so there are
-- no gaps and no race conditions when two requests arrive simultaneously.
CREATE SEQUENCE IF NOT EXISTS log_chain_seq START 1 INCREMENT 1;

CREATE TABLE IF NOT EXISTS log_chain (
    id                  BIGSERIAL       PRIMARY KEY,
    sequence_number     BIGINT          NOT NULL UNIQUE DEFAULT nextval('log_chain_seq'),
    file_hash           VARCHAR(64)     NOT NULL,           -- SHA-256 hex (client-computed)
    timestamp_utc       TIMESTAMPTZ     NOT NULL DEFAULT now(),
    requested_by        BIGINT          NOT NULL REFERENCES users(id),
    signature           TEXT            NOT NULL,           -- JWS compact token
    previous_row_hash   VARCHAR(64)     NOT NULL,           -- SHA-256(canonical JSON of prev row)
    nonce               VARCHAR(64),                        -- consumed single-use nonce
    ntp_source          VARCHAR(100),                       -- NTP server that provided the time
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now()
);

-- Prevent any UPDATE or DELETE on log_chain rows (tamper-evident guarantee).
-- Triggers fire even for superusers; RULES do not protect against TRUNCATE.
CREATE OR REPLACE FUNCTION prevent_log_chain_modification()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'log_chain is append-only: % is not permitted', TG_OP
        USING ERRCODE = '55000';  -- object_not_in_prerequisite_state
END;
$$;

DROP TRIGGER IF EXISTS log_chain_immutable_update ON log_chain;
CREATE TRIGGER log_chain_immutable_update
    BEFORE UPDATE ON log_chain
    FOR EACH ROW EXECUTE FUNCTION prevent_log_chain_modification();

DROP TRIGGER IF EXISTS log_chain_immutable_delete ON log_chain;
CREATE TRIGGER log_chain_immutable_delete
    BEFORE DELETE ON log_chain
    FOR EACH ROW EXECUTE FUNCTION prevent_log_chain_modification();

-- Revoke destructive privileges from PUBLIC (defence-in-depth on top of triggers).
-- In production: create a dedicated app role and GRANT only SELECT, INSERT to it.
REVOKE UPDATE, DELETE, TRUNCATE ON log_chain FROM PUBLIC;

-- Audit log — append-only record of security-relevant events
CREATE TABLE IF NOT EXISTS audit_log (
    id          BIGSERIAL       PRIMARY KEY,
    user_id     BIGINT          REFERENCES users(id) ON DELETE SET NULL,
    username    VARCHAR(100),                               -- kept even if user deleted
    event_type  VARCHAR(60)     NOT NULL,
    ip_address  VARCHAR(45),                               -- supports IPv6
    user_agent  TEXT,
    detail      TEXT,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_id    ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_event_type ON audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_username   ON audit_log(username);

-- Seed roles: USER (default), ADMIN (manually assigned),
--             JIT_AUDITOR and JIT_DELETE (temporary elevation for ADMIN)
INSERT INTO roles (name) VALUES ('USER')         ON CONFLICT DO NOTHING;
INSERT INTO roles (name) VALUES ('ADMIN')        ON CONFLICT DO NOTHING;
INSERT INTO roles (name) VALUES ('JIT_AUDITOR')  ON CONFLICT DO NOTHING;
INSERT INTO roles (name) VALUES ('JIT_DELETE')   ON CONFLICT DO NOTHING;

-- Seed admin user (password: Password@123, BCrypt cost 12)
INSERT INTO users (username, email, password_hash, enabled)
VALUES (
    'admin',
    'timestampingapp.dev@gmail.com',
    '$2a$12$vaG3I.9F1jt7HRm6lvU2juvoQojcVUNZN8ZnYtdpXIDS/kdgfRG46',
    TRUE
)
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u, roles r
WHERE u.username = 'admin' AND r.name = 'ADMIN'
ON CONFLICT DO NOTHING;
