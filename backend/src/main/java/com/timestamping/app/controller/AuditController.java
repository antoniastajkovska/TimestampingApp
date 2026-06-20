package com.timestamping.app.controller;

import com.timestamping.app.model.AuditLogEntry;
import com.timestamping.app.model.AuditLogEntry.EventType;
import com.timestamping.app.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/audit")
@RequiredArgsConstructor
public class AuditController {

    private final AuditLogRepository auditLogRepository;

    /** Security events visible to JIT_AUDITOR: login failures, OTP failures, JIT grants, password changes, deletions. */
    private static final List<EventType> SECURITY_EVENTS = Arrays.asList(
        EventType.LOGIN_SUCCESS,
        EventType.LOGIN_FAIL,
        EventType.OTP_FAIL,
        EventType.OTP_LOCKED,
        EventType.PASSWORD_CHANGE,
        EventType.ACCOUNT_DELETE,
        EventType.JIT_GRANT,
        EventType.JIT_REVOKE
    );

    /** Returns paginated audit log — all events, newest first. Requires JIT_AUDITOR. */
    @GetMapping("/logs")
    @PreAuthorize("hasRole('JIT_AUDITOR')")
    public ResponseEntity<Map<String, Object>> getLogs(
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "50") int size) {

        PageRequest pr = PageRequest.of(page, Math.min(size, 200));
        Page<AuditLogEntry> result = auditLogRepository.findAllByOrderByCreatedAtDesc(pr);
        return ResponseEntity.ok(Map.of(
            "entries",     result.getContent().stream().map(AuditController::toDto).toList(),
            "totalPages",  result.getTotalPages(),
            "totalItems",  result.getTotalElements(),
            "page",        page
        ));
    }

    /** Returns only security-relevant events (subset for the security dashboard). Requires JIT_AUDITOR. */
    @GetMapping("/security-events")
    @PreAuthorize("hasRole('JIT_AUDITOR')")
    public ResponseEntity<List<Map<String, Object>>> getSecurityEvents(
            @RequestParam(defaultValue = "0")   int page,
            @RequestParam(defaultValue = "100") int size) {

        PageRequest pr = PageRequest.of(page, Math.min(size, 200));
        return ResponseEntity.ok(
            auditLogRepository.findByEventTypeInOrderByCreatedAtDesc(SECURITY_EVENTS, pr)
                .getContent().stream().map(AuditController::toDto).toList()
        );
    }

    private static Map<String, Object> toDto(AuditLogEntry e) {
        return Map.of(
            "id",        e.getId(),
            "username",  e.getUsername() != null ? e.getUsername() : "",
            "eventType", e.getEventType().name(),
            "ipAddress", e.getIpAddress() != null ? e.getIpAddress() : "",
            "detail",    e.getDetail() != null ? e.getDetail() : "",
            "createdAt", e.getCreatedAt().toEpochMilli()
        );
    }
}
