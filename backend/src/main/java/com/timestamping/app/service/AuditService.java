package com.timestamping.app.service;

import com.timestamping.app.model.AuditLogEntry;
import com.timestamping.app.model.AuditLogEntry.EventType;
import com.timestamping.app.model.User;
import com.timestamping.app.repository.AuditLogRepository;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuditService {

    private final AuditLogRepository auditLogRepository;

    /**
     * Persists an audit event asynchronously so it never blocks the request thread.
     * Uses REQUIRES_NEW so audit writing never rolls back with the outer transaction.
     */
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void log(User user, String username, EventType eventType,
                    HttpServletRequest request, String detail) {
        try {
            String ip        = resolveClientIp(request);
            String userAgent = request != null ? request.getHeader("User-Agent") : null;
            auditLogRepository.save(
                new AuditLogEntry(user, username, eventType, ip, userAgent, detail));
        } catch (Exception e) {
            // Audit failure must never break the primary operation
            log.error("Audit log write failed: {}", e.getMessage());
        }
    }

    // Respect X-Forwarded-For when behind a reverse proxy
    private String resolveClientIp(HttpServletRequest request) {
        if (request == null) return null;
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return xff.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
