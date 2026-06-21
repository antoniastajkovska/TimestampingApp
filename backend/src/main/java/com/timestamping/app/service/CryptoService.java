package com.timestamping.app.service;

import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.*;
import com.nimbusds.jose.util.Base64;
import com.nimbusds.jwt.*;
import com.timestamping.app.model.LogChainEntry;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.FileInputStream;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.security.cert.Certificate;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;

@Slf4j
@Service
public class CryptoService {

    @Value("${app.tsa.keystore-path}")
    private String tsaKeystorePath;

    @Value("${app.tsa.keystore-password}")
    private String tsaKeystorePassword;

    @Value("${app.tsa.key-alias:tsa-signer}")
    private String tsaKeyAlias;

    private RSAPrivateKey privateKey;
    private RSAPublicKey  publicKey;
    private RSASSASigner  signer;
    private RSASSAVerifier verifier;
    private List<Base64>  x5cChain;

    @PostConstruct
    public void loadKeys() throws Exception {
        KeyStore ks = KeyStore.getInstance("PKCS12");
        try (FileInputStream fis = new FileInputStream(tsaKeystorePath)) {
            ks.load(fis, tsaKeystorePassword.toCharArray());
        }

        privateKey = (RSAPrivateKey) ks.getKey(tsaKeyAlias, tsaKeystorePassword.toCharArray());
        if (privateKey == null) {
            throw new IllegalStateException(
                "TSA private key not found in keystore with alias '" + tsaKeyAlias + "'");
        }

        Certificate[] chain = ks.getCertificateChain(tsaKeyAlias);
        if (chain == null || chain.length == 0) {
            throw new IllegalStateException(
                "No certificate chain found for alias '" + tsaKeyAlias + "'");
        }

        publicKey = (RSAPublicKey) chain[0].getPublicKey();

        // x5c = Base64-encoded DER for each cert: tsa.crt → tsaCA.crt → rootCA.crt
        // Embedded in every JWS token so relying parties can verify offline
        x5cChain = new ArrayList<>();
        for (Certificate cert : chain) {
            x5cChain.add(Base64.encode(cert.getEncoded()));
        }

        // PS256 = RSA-PSS with SHA-256 (probabilistic, no deterministic padding pattern)
        // Replaces RS256 (PKCS#1 v1.5) which is vulnerable to Bleichenbacher attacks
        signer   = new RSASSASigner(privateKey);
        verifier = new RSASSAVerifier(publicKey);

        log.info("TSA key loaded from keystore (alias={}, chain={})", tsaKeyAlias, chain.length);
    }

    public String createJwsToken(String fileHash, Instant timestamp, long seq) throws Exception {
        JWTClaimsSet claims = new JWTClaimsSet.Builder()
                .issuer("timestamping-server")
                .claim("fileHash",  fileHash)
                .claim("timestamp", timestamp.toEpochMilli())
                .claim("seq",       seq)
                .build();

        SignedJWT jwt = new SignedJWT(
                new JWSHeader.Builder(JWSAlgorithm.PS256)
                        .keyID(tsaKeyAlias)
                        .x509CertChain(x5cChain)   // enables offline verification
                        .build(),
                claims);

        jwt.sign(signer);
        return jwt.serialize();
    }

    public boolean verifyJwsToken(String jwsToken, String expectedFileHash) {
        try {
            SignedJWT jwt = SignedJWT.parse(jwsToken);
            if (!jwt.verify(verifier)) return false;
            String tokenHash = jwt.getJWTClaimsSet().getStringClaim("fileHash");
            return expectedFileHash.equals(tokenHash);
        } catch (Exception e) {
            return false;
        }
    }

    public JWTClaimsSet parseToken(String jwsToken) throws Exception {
        return SignedJWT.parse(jwsToken).getJWTClaimsSet();
    }

    public String hashLogEntry(LogChainEntry entry) throws Exception {
        String canonical = String.format(
            "{\"seq\":%d,\"fileHash\":\"%s\",\"timestamp\":%d,\"signature\":\"%s\",\"prevHash\":\"%s\"}",
            entry.getSequenceNumber(),
            entry.getFileHash(),
            entry.getTimestampUtc().toEpochMilli(),
            entry.getSignature(),
            entry.getPreviousRowHash()
        );
        return sha256Hex(canonical.getBytes(StandardCharsets.UTF_8));
    }

    public String genesisHash() throws Exception {
        return sha256Hex("GENESIS".getBytes(StandardCharsets.UTF_8));
    }

    private String sha256Hex(byte[] data) throws NoSuchAlgorithmException {
        return HexFormat.of().formatHex(
            MessageDigest.getInstance("SHA-256").digest(data));
    }
}
