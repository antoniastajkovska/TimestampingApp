package com.timestamping.app.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "users")
@Getter @Setter
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 100)
    private String username;

    @Column(nullable = false, unique = true, length = 255)
    private String email;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Column(nullable = false)
    private boolean enabled = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    // 2FA fields
    @Column(name = "totp_secret", length = 64)
    private String totpSecret;

    @Column(name = "totp_expires_at")
    private Instant totpExpiresAt;

    @Column(name = "totp_attempts", nullable = false)
    private int totpAttempts = 0;

    @Column(name = "totp_locked_until")
    private Instant totpLockedUntil;

    // Profile fields
    @Column(name = "first_name", length = 100)
    private String firstName;

    @Column(name = "last_name", length = 100)
    private String lastName;

    @Column(name = "updated_at")
    private Instant updatedAt;

    // JIT_AUDITOR elevation (ADMIN only, 15 min)
    @Column(name = "auditor_granted_at")
    private Instant auditorGrantedAt;

    @Column(name = "auditor_expires_at")
    private Instant auditorExpiresAt;

    // JIT_DELETE elevation (ADMIN only, 15 min)
    @Column(name = "delete_granted_at")
    private Instant deleteGrantedAt;

    @Column(name = "delete_expires_at")
    private Instant deleteExpiresAt;

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
        name = "user_roles",
        joinColumns = @JoinColumn(name = "user_id"),
        inverseJoinColumns = @JoinColumn(name = "role_id")
    )
    private Set<Role> roles = new HashSet<>();

    public boolean hasRole(Role.Name roleName) {
        return roles.stream().anyMatch(r -> r.getName().equals(roleName.name()));
    }
}
