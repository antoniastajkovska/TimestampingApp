package com.timestamping.app.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "audit_log")
@Getter @Setter
@NoArgsConstructor
public class AuditLogEntry {

    public enum EventType {
        REGISTER,
        LOGIN_SUCCESS,
        LOGIN_FAIL,
        OTP_FAIL,
        OTP_LOCKED,
        LOGOUT,
        PASSWORD_CHANGE,
        ACCOUNT_DELETE,
        ADMIN_CREATE_USER,
        ADMIN_UPDATE_USER,
        ADMIN_DELETE_USER,
        JIT_GRANT,
        JIT_REVOKE,
        TIMESTAMP_REQUEST,
        VERIFY_REQUEST
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(length = 100)
    private String username;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false, length = 60)
    private EventType eventType;

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @Column(name = "user_agent", columnDefinition = "TEXT")
    private String userAgent;

    @Column(columnDefinition = "TEXT")
    private String detail;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public AuditLogEntry(User user, String username, EventType eventType,
                         String ipAddress, String userAgent, String detail) {
        this.user      = user;
        this.username  = username;
        this.eventType = eventType;
        this.ipAddress = ipAddress;
        this.userAgent = userAgent;
        this.detail    = detail;
    }
}
