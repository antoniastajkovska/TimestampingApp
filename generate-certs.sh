#!/usr/bin/env bash
# Generate the full PKI hierarchy for the TimestampingApp.
# Run once from the repo root directory before first launch.
# Requires: OpenSSL 3.x + keytool (JDK) on PATH.
#
# PKI chain:
#   Root CA (TimestampingApp Root CA, 4096-bit, self-signed, 10 years)
#     ├── TLS CA  (TimestampingApp TLS CA, 4096-bit, signed by Root, 5 years)
#     │     ├── tls.crt    (2048-bit, serverAuth,  SAN=localhost, 1 year)
#     │     └── client.crt (2048-bit, clientAuth,  CN=TimestampingClient, 1 year)
#     └── TSA CA  (TimestampingApp TSA CA, 4096-bit, signed by Root, 5 years)
#           └── tsa.crt    (4096-bit, timeStamping + nonRepudiation, 3 years)
#
# RFC 3161 §3.3  — TSA cert MUST have extendedKeyUsage=critical,timeStamping
# RFC 5280 §4.2  — keyUsage bits must match cert purpose
# Separation of TLS and TSA keys limits blast radius if either is compromised.

set -euo pipefail

CERTS_DIR="$(dirname "$0")/certs"
mkdir -p "$CERTS_DIR"
EXT_DIR="$CERTS_DIR"

# ── Load .env ──────────────────────────────────────────────────────────────
ENV_FILE="$(dirname "$0")/.env"
if [ -f "$ENV_FILE" ]; then
    set -o allexport
    # shellcheck source=./.env
    source "$ENV_FILE"
    set +o allexport
    echo "==> Loaded secrets from .env"
else
    echo "WARNING: .env not found"
fi

# Passwords 
KS_PASS="${SSL_KEYSTORE_PASSWORD:-T1m3stamp#KS}"
TS_PASS="${SSL_TRUSTSTORE_PASSWORD:-T1m3stamp#TS}"
TSA_KS_PASS="${TSA_KEYSTORE_PASSWORD:-T1m3stamp#TSA}"
CLIENT_PASS="${CLIENT_CERT_PASSWORD:-T1m3stamp#Client}"

_using_defaults=0
[ -z "${SSL_KEYSTORE_PASSWORD:-}"  ] && _using_defaults=1
[ -z "${TSA_KEYSTORE_PASSWORD:-}"  ] && _using_defaults=1
[ -z "${SSL_TRUSTSTORE_PASSWORD:-}"] && _using_defaults=1
if [ "$_using_defaults" -eq 1 ]; then
    echo "WARNING: One or more keystore passwords not set in .env."
    echo "Default passwords are used"
    echo ""
fi

export MSYS_NO_PATHCONV=1

# ==========================================================================
echo "==> [1/7] Root CA (TimestampingApp Root CA) — self-signed, 4096-bit, 10 years"
# ==========================================================================
openssl genrsa -out "$CERTS_DIR/rootCA.key" 4096
chmod 600 "$CERTS_DIR/rootCA.key"

openssl req -x509 -new -nodes \
    -key    "$CERTS_DIR/rootCA.key" \
    -sha256 -days 3650 \
    -out    "$CERTS_DIR/rootCA.crt" \
    -subj   "/C=MK/ST=Skopje/L=Skopje/O=TimestampingApp/OU=PKI/CN=TimestampingApp Root CA" \
    -addext "basicConstraints=critical,CA:TRUE,pathlen:1" \
    -addext "keyUsage=critical,keyCertSign,cRLSign" \
    -addext "subjectKeyIdentifier=hash"

# ==========================================================================
echo "==> [2/7] TLS CA (TimestampingApp TLS CA) — signed by Root, 4096-bit, 5 years"
# Dedicated intermediate for TLS only 
# ==========================================================================
openssl genrsa -out "$CERTS_DIR/tlsCA.key" 4096
chmod 600 "$CERTS_DIR/tlsCA.key"

openssl req -new -nodes \
    -key  "$CERTS_DIR/tlsCA.key" \
    -out  "$CERTS_DIR/tlsCA.csr" \
    -subj "/C=MK/ST=Skopje/L=Skopje/O=TimestampingApp/OU=PKI/CN=TimestampingApp TLS CA"

cat > "$EXT_DIR/tlsca.ext" <<'EOF'
basicConstraints=critical,CA:TRUE,pathlen:0
keyUsage=critical,keyCertSign,cRLSign
subjectKeyIdentifier=hash
authorityKeyIdentifier=keyid,issuer
EOF

openssl x509 -req \
    -in      "$CERTS_DIR/tlsCA.csr" \
    -CA      "$CERTS_DIR/rootCA.crt" \
    -CAkey   "$CERTS_DIR/rootCA.key" \
    -CAcreateserial \
    -out     "$CERTS_DIR/tlsCA.crt" \
    -days    1825 -sha256 \
    -extfile "$EXT_DIR/tlsca.ext"

# ==========================================================================
echo "==> [3/7] TSA CA (TimestampingApp TSA CA) — signed by Root, 4096-bit, 5 years"
# Dedicated intermediate for timestamp signing 
# ==========================================================================
openssl genrsa -out "$CERTS_DIR/tsaCA.key" 4096
chmod 600 "$CERTS_DIR/tsaCA.key"

openssl req -new -nodes \
    -key  "$CERTS_DIR/tsaCA.key" \
    -out  "$CERTS_DIR/tsaCA.csr" \
    -subj "/C=MK/ST=Skopje/L=Skopje/O=TimestampingApp/OU=PKI/CN=TimestampingApp TSA CA"

cat > "$EXT_DIR/tsaca.ext" <<'EOF'
basicConstraints=critical,CA:TRUE,pathlen:0
keyUsage=critical,keyCertSign,cRLSign
subjectKeyIdentifier=hash
authorityKeyIdentifier=keyid,issuer
EOF

openssl x509 -req \
    -in      "$CERTS_DIR/tsaCA.csr" \
    -CA      "$CERTS_DIR/rootCA.crt" \
    -CAkey   "$CERTS_DIR/rootCA.key" \
    -CAcreateserial \
    -out     "$CERTS_DIR/tsaCA.crt" \
    -days    1825 -sha256 \
    -extfile "$EXT_DIR/tsaca.ext"

# ==========================================================================
echo "==> [4/7] TSA Signing Certificate — signed by TSA CA, 4096-bit, 3 years"
# RFC 3161: extendedKeyUsage MUST be critical and contain ONLY timeStamping
# RFC 5280: nonRepudiation (bit 1) proves the TSA cannot later deny issuing the token
# ==========================================================================
openssl genrsa -out "$CERTS_DIR/tsa.key" 4096
chmod 600 "$CERTS_DIR/tsa.key"

openssl req -new \
    -key  "$CERTS_DIR/tsa.key" \
    -out  "$CERTS_DIR/tsa.csr" \
    -subj "/C=MK/ST=Skopje/L=Skopje/O=TimestampingApp/OU=TSA/CN=TimestampingApp TSA"

cat > "$EXT_DIR/tsa.ext" <<'EOF'
extendedKeyUsage=critical,timeStamping
keyUsage=critical,digitalSignature,nonRepudiation
subjectKeyIdentifier=hash
authorityKeyIdentifier=keyid,issuer
EOF

openssl x509 -req \
    -in      "$CERTS_DIR/tsa.csr" \
    -CA      "$CERTS_DIR/tsaCA.crt" \
    -CAkey   "$CERTS_DIR/tsaCA.key" \
    -CAcreateserial \
    -out     "$CERTS_DIR/tsa.crt" \
    -days    1095 -sha256 \
    -extfile "$EXT_DIR/tsa.ext"

# PKCS#8 format required by Java 
openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt \
    -in  "$CERTS_DIR/tsa.key" \
    -out "$CERTS_DIR/tsa-private.pem"
chmod 600 "$CERTS_DIR/tsa-private.pem"

# Extract public key — served by GET /api/tsa/certificate for offline verification
openssl x509 -pubkey -noout -in "$CERTS_DIR/tsa.crt" > "$CERTS_DIR/tsa-public.pem"

# TSA cert chain: tsa → TSA CA → Root CA
cat "$CERTS_DIR/tsa.crt" \
    "$CERTS_DIR/tsaCA.crt" \
    "$CERTS_DIR/rootCA.crt" \
    > "$CERTS_DIR/tsa-chain.crt"

# ==========================================================================
echo "==> [5/7] Server TLS certificate (CN=localhost) — signed by TLS CA, 2048-bit, 1 year"
# ==========================================================================
openssl genrsa -out "$CERTS_DIR/tls.key" 2048
chmod 600 "$CERTS_DIR/tls.key"

openssl req -new \
    -key  "$CERTS_DIR/tls.key" \
    -out  "$CERTS_DIR/tls.csr" \
    -subj "/C=MK/ST=Skopje/L=Skopje/O=TimestampingApp/OU=PKI/CN=localhost"

cat > "$EXT_DIR/server.ext" <<'EOF'
subjectAltName=DNS:localhost,IP:127.0.0.1
extendedKeyUsage=serverAuth
keyUsage=critical,digitalSignature,keyEncipherment
subjectKeyIdentifier=hash
authorityKeyIdentifier=keyid,issuer
EOF

openssl x509 -req \
    -in      "$CERTS_DIR/tls.csr" \
    -CA      "$CERTS_DIR/tlsCA.crt" \
    -CAkey   "$CERTS_DIR/tlsCA.key" \
    -CAcreateserial \
    -out     "$CERTS_DIR/tls.crt" \
    -days    365 -sha256 \
    -extfile "$EXT_DIR/server.ext"

# TLS chain: server -> TLS CA -> Root CA
cat "$CERTS_DIR/tls.crt" \
    "$CERTS_DIR/tlsCA.crt" \
    "$CERTS_DIR/rootCA.crt" \
    > "$CERTS_DIR/chain.crt"

# ==========================================================================
echo "==> [6/7] Client certificate — signed by TLS CA (for optional mTLS)"
# ==========================================================================
openssl genrsa -out "$CERTS_DIR/client.key" 2048
chmod 600 "$CERTS_DIR/client.key"

openssl req -new \
    -key  "$CERTS_DIR/client.key" \
    -out  "$CERTS_DIR/client.csr" \
    -subj "/C=MK/ST=Skopje/L=Skopje/O=TimestampingApp/OU=PKI/CN=TimestampingClient"

cat > "$EXT_DIR/client.ext" <<'EOF'
extendedKeyUsage=clientAuth
keyUsage=critical,digitalSignature
subjectKeyIdentifier=hash
authorityKeyIdentifier=keyid,issuer
EOF

openssl x509 -req \
    -in      "$CERTS_DIR/client.csr" \
    -CA      "$CERTS_DIR/tlsCA.crt" \
    -CAkey   "$CERTS_DIR/tlsCA.key" \
    -CAcreateserial \
    -out     "$CERTS_DIR/client.crt" \
    -days    365 -sha256 \
    -extfile "$EXT_DIR/client.ext"

# Bundle as PKCS#12 for browser import
openssl pkcs12 -export \
    -inkey    "$CERTS_DIR/client.key" \
    -in       "$CERTS_DIR/client.crt" \
    -certfile "$CERTS_DIR/tlsCA.crt" \
    -out      "$CERTS_DIR/client.p12" \
    -name     "TimestampingClient" \
    -passout  "pass:${CLIENT_PASS}"

# ==========================================================================
echo "==> [7/7] Packaging keystores for Spring Boot"
# Two separate keystores — TLS and TSA keys never share a keystore
# ==========================================================================

# keystore.p12 — TLS only (alias: tls-server)
# Spring Boot SSL reads this for HTTPS
openssl pkcs12 -export \
    -in      "$CERTS_DIR/chain.crt" \
    -inkey   "$CERTS_DIR/tls.key" \
    -out     "$CERTS_DIR/keystore.p12" \
    -name    "tls-server" \
    -passout "pass:${KS_PASS}"
echo "    keystore.p12 created (alias: tls-server)"

# tsa-keystore.p12 — TSA signing only (alias: tsa-signer)
# CryptoService reads this to sign JWS timestamp tokens
openssl pkcs12 -export \
    -in      "$CERTS_DIR/tsa-chain.crt" \
    -inkey   "$CERTS_DIR/tsa.key" \
    -out     "$CERTS_DIR/tsa-keystore.p12" \
    -name    "tsa-signer" \
    -passout "pass:${TSA_KS_PASS}"
echo "    tsa-keystore.p12 created (alias: tsa-signer)"

# truststore.p12 — Root CA + TLS CA + TSA CA
# Spring Boot uses this to verify mTLS client certificates
rm -f "$CERTS_DIR/truststore.p12"

# Auto-detect keytool (lives next to java in the JDK bin directory)
KEYTOOL=""
if command -v keytool &>/dev/null; then
    KEYTOOL="keytool"
elif [ -n "${JAVA_HOME:-}" ] && [ -x "${JAVA_HOME}/bin/keytool" ]; then
    KEYTOOL="${JAVA_HOME}/bin/keytool"
else
    _java=$(command -v java 2>/dev/null || true)
    if [ -n "$_java" ]; then
        _jdir=$(dirname "$(readlink -f "$_java" 2>/dev/null || echo "$_java")")
        [ -x "$_jdir/keytool" ] && KEYTOOL="$_jdir/keytool"
    fi
fi

if [ -n "$KEYTOOL" ]; then
    "$KEYTOOL" -import -noprompt -trustcacerts \
        -alias    rootCA \
        -file     "$CERTS_DIR/rootCA.crt" \
        -keystore "$CERTS_DIR/truststore.p12" \
        -storetype PKCS12 \
        -storepass "$TS_PASS"
    "$KEYTOOL" -import -noprompt -trustcacerts \
        -alias    tlsCA \
        -file     "$CERTS_DIR/tlsCA.crt" \
        -keystore "$CERTS_DIR/truststore.p12" \
        -storetype PKCS12 \
        -storepass "$TS_PASS"
    "$KEYTOOL" -import -noprompt -trustcacerts \
        -alias    tsaCA \
        -file     "$CERTS_DIR/tsaCA.crt" \
        -keystore "$CERTS_DIR/truststore.p12" \
        -storetype PKCS12 \
        -storepass "$TS_PASS"
    echo "    truststore.p12 created (rootCA + tlsCA + tsaCA)"
else
    echo ""
    echo "WARNING: keytool not found — truststore.p12 was NOT created."
    echo "  mTLS stays disabled (app still works normally without it)."
    echo "  To create it manually once keytool is on PATH:"
    echo "    keytool -import -noprompt -trustcacerts -alias rootCA \\"
    echo "      -file $CERTS_DIR/rootCA.crt -keystore $CERTS_DIR/truststore.p12 \\"
    echo "      -storetype PKCS12 -storepass ${TS_PASS}"
    echo "    keytool -import -noprompt -trustcacerts -alias tlsCA \\"
    echo "      -file $CERTS_DIR/tlsCA.crt -keystore $CERTS_DIR/truststore.p12 \\"
    echo "      -storetype PKCS12 -storepass ${TS_PASS}"
    echo "    keytool -import -noprompt -trustcacerts -alias tsaCA \\"
    echo "      -file $CERTS_DIR/tsaCA.crt -keystore $CERTS_DIR/truststore.p12 \\"
    echo "      -storetype PKCS12 -storepass ${TS_PASS}"
fi

# Cleanup temporary CSR and extension files
rm -f "$EXT_DIR"/*.csr "$EXT_DIR"/*.ext
