package com.timestamping.app.service;

import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.*;
import com.nimbusds.jwt.*;
import com.timestamping.app.model.LogChainEntry;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.security.*;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.*;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;

@Slf4j
@Service
public class CryptoService {

    @Value("${app.crypto.private-key-path}")
    private String privateKeyPath;

    @Value("${app.crypto.public-key-path}")
    private String publicKeyPath;

    private RSAPrivateKey privateKey;
    private RSAPublicKey  publicKey;
    private RSASSASigner  signer;
    private RSASSAVerifier verifier;

    @PostConstruct
    public void loadKeys() throws Exception {
        privateKey = (RSAPrivateKey) loadPrivateKey(privateKeyPath);
        publicKey  = (RSAPublicKey)  loadPublicKey(publicKeyPath);
        signer     = new RSASSASigner(privateKey);
        verifier   = new RSASSAVerifier(publicKey);
        log.info("RSA-4096 key pair loaded for JWS signing");
    }

    public String createJwsToken(String fileHash, Instant timestamp, long seq) throws Exception {
        JWTClaimsSet claims = new JWTClaimsSet.Builder()
                .issuer("timestamping-server")
                .claim("fileHash",  fileHash)
                .claim("timestamp", timestamp.toEpochMilli())
                .claim("seq",       seq)
                .build();

        SignedJWT jwt = new SignedJWT(
                new JWSHeader.Builder(JWSAlgorithm.RS256)
                        .keyID("timestamping-key-v1")
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

    // SHA-256("GENESIS") — sentinel value for the first log entry's previous_row_hash
    public String genesisHash() throws Exception {
        return sha256Hex("GENESIS".getBytes(StandardCharsets.UTF_8));
    }

    private String sha256Hex(byte[] data) throws NoSuchAlgorithmException {
        return HexFormat.of().formatHex(
            MessageDigest.getInstance("SHA-256").digest(data));
    }

    private PrivateKey loadPrivateKey(String path) throws Exception {
        String pem = Files.readString(Paths.get(path))
                .replace("-----BEGIN PRIVATE KEY-----", "")
                .replace("-----END PRIVATE KEY-----", "")
                .replaceAll("\\s", "");
        byte[] der = Base64.getDecoder().decode(pem);
        return KeyFactory.getInstance("RSA").generatePrivate(new PKCS8EncodedKeySpec(der));
    }

    private PublicKey loadPublicKey(String path) throws Exception {
        String pem = Files.readString(Paths.get(path))
                .replace("-----BEGIN PUBLIC KEY-----", "")
                .replace("-----END PUBLIC KEY-----", "")
                .replaceAll("\\s", "");
        byte[] der = Base64.getDecoder().decode(pem);
        return KeyFactory.getInstance("RSA").generatePublic(new X509EncodedKeySpec(der));
    }
}
