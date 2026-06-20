#!/usr/bin/env bash
# Run once from the TimestampingApp/backend directory before first launch.
# Requires: OpenSSL 3.x + keytool on PATH.
#
# PKI chain:
#   Root CA (FINKI CA, 4096-bit, self-signed, 10 years)
#     └── Lab CA (4096-bit, signed by Root, 5 years)
#           ├── Server cert (2048-bit, CN=localhost, SAN, signed by Lab CA, 1 year)
#           └── Client cert (2048-bit, CN=TimestampingClient, signed by Lab CA, 1 year)

set -euo pipefail

CERTS_DIR="$(dirname "$0")/certs"
mkdir -p "$CERTS_DIR"

# Load .env from the repo root (one level up when running from backend/)
ENV_FILE="$(dirname "$0")/.env"
if [ -f "$ENV_FILE" ]; then
    # Export only the vars we need; skip comments and blank lines
    set -o allexport
    # shellcheck source=../.env
    source "$ENV_FILE"
    set +o allexport
    echo "==> Loaded secrets from .env"
fi

# Passwords — fall back to defaults if .env not present
KS_PASS="${SSL_KEYSTORE_PASSWORD:-T1m3stamp#KS}"
TS_PASS="${SSL_TRUSTSTORE_PASSWORD:-T1m3stamp#TS}"
CLIENT_PASS="${CLIENT_CERT_PASSWORD:-T1m3stamp#Client}"

# Extension files go inside CERTS_DIR (a relative path OpenSSL can always open on Windows)
# They are deleted at the end of the script.
EXT_DIR="$CERTS_DIR"

# MSYS_NO_PATHCONV stops Git Bash mangling /C=MK into a Windows path
export MSYS_NO_PATHCONV=1

# ==========================================================================
echo "==> [1/6] RSA-4096 signing key pair (for JWS timestamp signatures)"
# ==========================================================================
openssl genrsa -out "$CERTS_DIR/private_raw.pem" 4096
openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt \
    -in  "$CERTS_DIR/private_raw.pem" \
    -out "$CERTS_DIR/private.pem"
rm   "$CERTS_DIR/private_raw.pem"
openssl rsa -in "$CERTS_DIR/private.pem" -pubout -out "$CERTS_DIR/public.pem"
chmod 600 "$CERTS_DIR/private.pem"

# ==========================================================================
echo "==> [2/6] Root CA (FINKI CA) — self-signed, 4096-bit, 10 years"
# ==========================================================================
openssl genrsa -out "$CERTS_DIR/rootCA.key" 4096
chmod 600 "$CERTS_DIR/rootCA.key"

# basicConstraints=critical,CA:TRUE,pathlen:1  — Root may only sign one level of intermediates
# keyUsage=critical,keyCertSign,cRLSign        — RFC 5280 §4.2.1.3 required for CA certs
openssl req -x509 -new -nodes \
    -key    "$CERTS_DIR/rootCA.key" \
    -sha256 -days 3650 \
    -out    "$CERTS_DIR/rootCA.crt" \
    -subj   "/C=MK/ST=Skopje/L=Skopje/O=FINKI/OU=PKI Lab/CN=FINKI CA" \
    -addext "basicConstraints=critical,CA:TRUE,pathlen:1" \
    -addext "keyUsage=critical,keyCertSign,cRLSign" \
    -addext "subjectKeyIdentifier=hash"

# ==========================================================================
echo "==> [3/6] Lab CA — signed by Root CA, 4096-bit, 5 years"
# ==========================================================================
openssl genrsa -out "$CERTS_DIR/labCA.key" 4096
chmod 600 "$CERTS_DIR/labCA.key"

openssl req -new -nodes \
    -key  "$CERTS_DIR/labCA.key" \
    -out  "$CERTS_DIR/labCA.csr" \
    -subj "/C=MK/ST=Skopje/L=Skopje/O=FINKI/OU=PKI Lab/CN=Lab CA"

# pathlen:0 — Lab CA cannot issue further intermediate CAs
cat > "$EXT_DIR/labca.ext" <<'EOF'
basicConstraints=critical,CA:TRUE,pathlen:0
keyUsage=critical,keyCertSign,cRLSign
subjectKeyIdentifier=hash
authorityKeyIdentifier=keyid,issuer
EOF

openssl x509 -req \
    -in      "$CERTS_DIR/labCA.csr" \
    -CA      "$CERTS_DIR/rootCA.crt" \
    -CAkey   "$CERTS_DIR/rootCA.key" \
    -CAcreateserial \
    -out     "$CERTS_DIR/labCA.crt" \
    -days    1825 -sha256 \
    -extfile "$EXT_DIR/labca.ext"

rm "$CERTS_DIR/labCA.csr"

# ==========================================================================
echo "==> [4/6] Server certificate (CN=localhost) — signed by Lab CA"
# ==========================================================================
openssl genrsa -out "$CERTS_DIR/tls.key" 2048
chmod 600 "$CERTS_DIR/tls.key"

openssl req -new \
    -key  "$CERTS_DIR/tls.key" \
    -out  "$CERTS_DIR/tls.csr" \
    -subj "/C=MK/ST=Skopje/L=Skopje/O=FINKI/OU=PKI Lab/CN=localhost"

cat > "$EXT_DIR/server.ext" <<'EOF'
subjectAltName=DNS:localhost,IP:127.0.0.1
extendedKeyUsage=serverAuth
keyUsage=critical,digitalSignature,keyEncipherment
EOF

openssl x509 -req \
    -in      "$CERTS_DIR/tls.csr" \
    -CA      "$CERTS_DIR/labCA.crt" \
    -CAkey   "$CERTS_DIR/labCA.key" \
    -CAcreateserial \
    -out     "$CERTS_DIR/tls.crt" \
    -days    365 -sha256 \
    -extfile "$EXT_DIR/server.ext"

rm "$CERTS_DIR/tls.csr"

# Build cert chain: server → Lab CA → Root CA
cat "$CERTS_DIR/tls.crt" \
    "$CERTS_DIR/labCA.crt" \
    "$CERTS_DIR/rootCA.crt" \
    > "$CERTS_DIR/chain.crt"

# ==========================================================================
echo "==> [5/6] Client certificate — signed by Lab CA (for mTLS)"
# ==========================================================================
openssl genrsa -out "$CERTS_DIR/client.key" 2048
chmod 600 "$CERTS_DIR/client.key"

openssl req -new \
    -key  "$CERTS_DIR/client.key" \
    -out  "$CERTS_DIR/client.csr" \
    -subj "/C=MK/ST=Skopje/L=Skopje/O=FINKI/OU=PKI Lab/CN=TimestampingClient"

cat > "$EXT_DIR/client.ext" <<'EOF'
extendedKeyUsage=clientAuth
keyUsage=critical,digitalSignature
EOF

openssl x509 -req \
    -in      "$CERTS_DIR/client.csr" \
    -CA      "$CERTS_DIR/labCA.crt" \
    -CAkey   "$CERTS_DIR/labCA.key" \
    -CAcreateserial \
    -out     "$CERTS_DIR/client.crt" \
    -days    365 -sha256 \
    -extfile "$EXT_DIR/client.ext"

rm "$CERTS_DIR/client.csr"

# Bundle client cert as PKCS#12 for browser import
openssl pkcs12 -export \
    -inkey    "$CERTS_DIR/client.key" \
    -in       "$CERTS_DIR/client.crt" \
    -certfile "$CERTS_DIR/labCA.crt" \
    -out      "$CERTS_DIR/client.p12" \
    -name     "TimestampingClient" \
    -passout  "pass:${CLIENT_PASS}"

# ==========================================================================
echo "==> [6/6] Packaging keystores for Spring Boot"
# ==========================================================================

# Server keystore (chain + private key)
openssl pkcs12 -export \
    -in      "$CERTS_DIR/chain.crt" \
    -inkey   "$CERTS_DIR/tls.key" \
    -out     "$CERTS_DIR/keystore.p12" \
    -name    "timestamping-server" \
    -passout "pass:${KS_PASS}"

# Trust store (Root CA + Lab CA) — used by Spring to verify client certs
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
        -alias    labCA \
        -file     "$CERTS_DIR/labCA.crt" \
        -keystore "$CERTS_DIR/truststore.p12" \
        -storetype PKCS12 \
        -storepass "$TS_PASS"
    echo "    truststore.p12 created."
else
    echo ""
    echo "WARNING: keytool not found — truststore.p12 was NOT created."
    echo "  mTLS stays disabled (app still works normally)."
    echo "  To create it manually once keytool is on PATH:"
    echo "    keytool -import -noprompt -trustcacerts -alias rootCA \\"
    echo "      -file $CERTS_DIR/rootCA.crt -keystore $CERTS_DIR/truststore.p12 \\"
    echo "      -storetype PKCS12 -storepass ${TS_PASS}"
    echo "    keytool -import -noprompt -trustcacerts -alias labCA \\"
    echo "      -file $CERTS_DIR/labCA.crt  -keystore $CERTS_DIR/truststore.p12 \\"
    echo "      -storetype PKCS12 -storepass ${TS_PASS}"
fi

# Clean up temp extension files
rm -f "$EXT_DIR/labca.ext" "$EXT_DIR/server.ext" "$EXT_DIR/client.ext"

echo ""
echo "==> Done! Files in $CERTS_DIR:"
echo "    rootCA.crt / rootCA.key   Root CA (FINKI CA)"
echo "    labCA.crt  / labCA.key    Lab CA (intermediate)"
echo "    chain.crt  / tls.key      Server cert chain"
echo "    client.crt / client.key   Client certificate"
echo "    client.p12                Browser import (password: ${CLIENT_PASS})"
echo "    keystore.p12              Spring Boot TLS keystore   (password: ${KS_PASS})"
echo "    truststore.p12            Spring Boot mTLS truststore (password: ${TS_PASS})"
echo "    private.pem / public.pem  RSA-4096 keys for JWS signing"
echo ""
echo "==> Exports for Spring Boot:"
echo "    export SSL_KEYSTORE_PASSWORD='${KS_PASS}'"
echo "    export SSL_TRUSTSTORE_PASSWORD='${TS_PASS}'"
echo "    export PRIVATE_KEY_PATH=\$(pwd)/$CERTS_DIR/private.pem"
echo "    export PUBLIC_KEY_PATH=\$(pwd)/$CERTS_DIR/public.pem"
echo ""
echo "==> Windows: install Root CA so Chrome trusts the server:"
echo "    certmgr.msc -> Trusted Root Certification Authorities -> Import -> rootCA.crt"
echo ""
echo "==> Install client cert in Chrome (for mTLS):"
echo "    Settings -> Privacy -> Security -> Manage certificates -> Import -> client.p12"
echo "    Password: ${CLIENT_PASS}"
