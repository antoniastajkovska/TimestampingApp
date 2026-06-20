package com.timestamping.app.service;

import com.timestamping.app.model.AuditLogEntry.EventType;
import com.timestamping.app.model.Role;
import com.timestamping.app.model.User;
import com.timestamping.app.repository.RoleRepository;
import com.timestamping.app.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class JitAccessService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditService auditService;

    @Value("${app.jit.duration-minutes:15}")
    private int durationMinutes;

    @Transactional
    public Instant grantAuditorAccess(String username, String password, HttpServletRequest req) {
        User user = userRepository.findByUsername(username).orElseThrow();
        verifyPassword(user, password);

        Role role = roleRepository.findByName(Role.Name.JIT_AUDITOR.name()).orElseThrow();
        user.getRoles().add(role);
        Instant expiresAt = Instant.now().plus(durationMinutes, ChronoUnit.MINUTES);
        user.setAuditorGrantedAt(Instant.now());
        user.setAuditorExpiresAt(expiresAt);
        userRepository.save(user);

        auditService.log(user, username, EventType.JIT_GRANT, req, "JIT_AUDITOR expires=" + expiresAt);
        log.info("JIT: JIT_AUDITOR granted to {} until {}", username, expiresAt);
        return expiresAt;
    }

    @Transactional
    public Instant grantDeleteAccess(String username, String password, HttpServletRequest req) {
        User user = userRepository.findByUsername(username).orElseThrow();
        verifyPassword(user, password);

        Role role = roleRepository.findByName(Role.Name.JIT_DELETE.name()).orElseThrow();
        user.getRoles().add(role);
        Instant expiresAt = Instant.now().plus(durationMinutes, ChronoUnit.MINUTES);
        user.setDeleteGrantedAt(Instant.now());
        user.setDeleteExpiresAt(expiresAt);
        userRepository.save(user);

        auditService.log(user, username, EventType.JIT_GRANT, req, "JIT_DELETE expires=" + expiresAt);
        log.info("JIT: JIT_DELETE granted to {} until {}", username, expiresAt);
        return expiresAt;
    }

    private void verifyPassword(User user, String password) {
        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new BadCredentialsException("Password confirmation failed");
        }
    }

    @Scheduled(fixedDelay = 60_000)
    @Transactional
    public void revokeExpiredAuditorAccess() {
        List<User> expired = userRepository.findUsersWithExpiredAuditorAccess(Instant.now());
        if (expired.isEmpty()) return;
        Role role = roleRepository.findByName(Role.Name.JIT_AUDITOR.name()).orElseThrow();
        for (User user : expired) {
            user.getRoles().remove(role);
            user.setAuditorGrantedAt(null);
            user.setAuditorExpiresAt(null);
            userRepository.save(user);
            auditService.log(user, user.getUsername(), EventType.JIT_REVOKE, null, "JIT_AUDITOR expired");
            log.info("JIT: JIT_AUDITOR revoked from {}", user.getUsername());
        }
    }

    @Scheduled(fixedDelay = 60_000)
    @Transactional
    public void revokeExpiredDeleteAccess() {
        List<User> expired = userRepository.findUsersWithExpiredDeleteAccess(Instant.now());
        if (expired.isEmpty()) return;
        Role role = roleRepository.findByName(Role.Name.JIT_DELETE.name()).orElseThrow();
        for (User user : expired) {
            user.getRoles().remove(role);
            user.setDeleteGrantedAt(null);
            user.setDeleteExpiresAt(null);
            userRepository.save(user);
            auditService.log(user, user.getUsername(), EventType.JIT_REVOKE, null, "JIT_DELETE expired");
            log.info("JIT: JIT_DELETE revoked from {}", user.getUsername());
        }
    }
}
