package com.timestamping.app.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nimbusds.jwt.JWTClaimsSet;
import com.timestamping.app.dto.ChainStatusResponse;
import com.timestamping.app.dto.HistoryEntryResponse;
import com.timestamping.app.dto.TimestampResponse;
import com.timestamping.app.dto.VerifyRequest;
import com.timestamping.app.dto.VerifyResponse;
import com.timestamping.app.model.AuditLogEntry.EventType;
import com.timestamping.app.model.LogChainEntry;
import com.timestamping.app.model.User;
import com.timestamping.app.repository.LogChainRepository;
import com.timestamping.app.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.timestamping.app.service.NonceService;
import com.timestamping.app.service.NtpService;

import java.time.Instant;
import java.util.Base64;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class TimestampService {

    private final LogChainRepository logChainRepository;
    private final UserRepository userRepository;
    private final CryptoService cryptoService;
    private final AuditService auditService;
    private final ObjectMapper objectMapper;
    private final NonceService nonceService;
    private final NtpService ntpService;

    @Transactional
    public TimestampResponse createTimestamp(String fileHash, String nonce, String username,
                                             HttpServletRequest httpReq) throws Exception {
        nonceService.consume(nonce);

        User user = userRepository.findByUsername(username).orElseThrow();
        Instant now = ntpService.now();
        String ntpSource = ntpService.lastSource();

        String prevHash = logChainRepository.findLatestEntryForUpdate()
                .map(prev -> {
                    try { return cryptoService.hashLogEntry(prev); }
                    catch (Exception e) { throw new RuntimeException(e); }
                })
                .orElseGet(() -> {
                    try { return cryptoService.genesisHash(); }
                    catch (Exception e) { throw new RuntimeException(e); }
                });

        long nextSeq = logChainRepository.findMaxSequenceNumber() + 1;

        String jwsToken = cryptoService.createJwsToken(fileHash, now, nextSeq);

        LogChainEntry entry = new LogChainEntry();
        entry.setSequenceNumber(nextSeq);
        entry.setFileHash(fileHash);
        entry.setTimestampUtc(now);
        entry.setRequestedBy(user);
        entry.setSignature(jwsToken);
        entry.setPreviousRowHash(prevHash);
        entry.setNonce(nonce);
        entry.setNtpSource(ntpSource);
        logChainRepository.save(entry);

        log.info("Log chain entry #{} created by {}", nextSeq, username);
        auditService.log(user, username, EventType.TIMESTAMP_REQUEST, httpReq,
                         "seq=" + nextSeq + " hash=" + fileHash.substring(0, 8) + "...");

        String downloadEnvelope = objectMapper.writeValueAsString(new java.util.LinkedHashMap<>() {{
            put("seq",      nextSeq);
            put("fileHash", fileHash);
            put("timestamp",now.toEpochMilli());
            put("prevHash", prevHash);
            put("token",    jwsToken);
        }});
        String encodedToken = Base64.getEncoder().encodeToString(downloadEnvelope.getBytes());

        return new TimestampResponse(nextSeq, fileHash, now, jwsToken, prevHash, encodedToken);
    }

    public List<HistoryEntryResponse> getHistory(String username) {
        return logChainRepository.findByUsername(username, PageRequest.of(0, 50))
            .stream()
            .map(e -> new HistoryEntryResponse(
                e.getSequenceNumber(),
                e.getFileHash(),
                e.getTimestampUtc(),
                e.getNtpSource(),
                e.getSignature()
            ))
            .toList();
    }

    public ChainStatusResponse getChainStatus() {
        List<LogChainEntry> all = logChainRepository.findAllOrdered();
        long total = all.size();
        if (total == 0) return new ChainStatusResponse(true, 0, "Chain is empty");

        try {
            String expectedPrev = cryptoService.genesisHash();
            for (LogChainEntry entry : all) {
                if (!entry.getPreviousRowHash().equals(expectedPrev)) {
                    return new ChainStatusResponse(false, total,
                        "Tamper detected at sequence #" + entry.getSequenceNumber());
                }
                expectedPrev = cryptoService.hashLogEntry(entry);
            }
            return new ChainStatusResponse(true, total, "All " + total + " entries verified");
        } catch (Exception e) {
            return new ChainStatusResponse(false, total, "Verification error: " + e.getMessage());
        }
    }

    public VerifyResponse verifyTimestamp(VerifyRequest req, HttpServletRequest httpReq) {
        auditService.log(null, null, EventType.VERIFY_REQUEST, httpReq, null);
        try {
            String envelopeJson = new String(Base64.getDecoder().decode(req.token()));

            @SuppressWarnings("unchecked")
            java.util.Map<String, Object> envelope =
                objectMapper.readValue(envelopeJson, java.util.Map.class);

            String jwsToken = (String) envelope.get("token");
            if (jwsToken == null) {
                return new VerifyResponse(false, "Invalid token format - missing JWS field.");
            }

            boolean valid = cryptoService.verifyJwsToken(jwsToken, req.fileHash());
            if (!valid) {
                return new VerifyResponse(false,
                    "Verification failed - signature invalid or file hash does not match.");
            }

            JWTClaimsSet claims = cryptoService.parseToken(jwsToken);
            return new VerifyResponse(true, String.format(
                "Valid. Sequence #%d, timestamped at %s.",
                claims.getLongClaim("seq"),
                Instant.ofEpochMilli(claims.getLongClaim("timestamp")).toString()
            ));
        } catch (Exception e) {
            log.warn("Verification error: {}", e.getMessage());
            return new VerifyResponse(false, "Verification error: " + e.getMessage());
        }
    }
}
