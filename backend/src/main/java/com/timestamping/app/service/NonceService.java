package com.timestamping.app.service;

import com.timestamping.app.model.Nonce;
import com.timestamping.app.model.User;
import com.timestamping.app.repository.NonceRepository;
import com.timestamping.app.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;

@Slf4j
@Service
@RequiredArgsConstructor
public class NonceService {

    private static final int TTL_MINUTES = 5;

    private final NonceRepository nonceRepository;
    private final UserRepository  userRepository;
    private final SecureRandom    secureRandom = new SecureRandom();

    @Transactional
    public String generate(String username) {
        User user = userRepository.findByUsername(username).orElseThrow();

        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        String hex = HexFormat.of().formatHex(bytes);

        Nonce nonce = new Nonce();
        nonce.setNonceHex(hex);
        nonce.setCreatedBy(user);
        nonce.setExpiresAt(Instant.now().plus(TTL_MINUTES, ChronoUnit.MINUTES));
        nonceRepository.save(nonce);

        return hex;
    }

   
    @Transactional
    public void consume(String nonceHex) {
        Nonce nonce = nonceRepository.findByNonceHexForUpdate(nonceHex)
            .orElseThrow(() -> new IllegalArgumentException("Invalid nonce"));

        if (nonce.isUsed()) {
            throw new IllegalArgumentException("Nonce already used");
        }
        if (Instant.now().isAfter(nonce.getExpiresAt())) {
            throw new IllegalArgumentException("Nonce expired");
        }

        nonce.setUsed(true);
        nonceRepository.save(nonce);
    }

    @Scheduled(fixedDelay = 60_000)
    @Transactional
    public void cleanupExpired() {
        nonceRepository.deleteExpired(Instant.now());
    }
}
