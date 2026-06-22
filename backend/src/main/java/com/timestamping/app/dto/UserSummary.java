package com.timestamping.app.dto;

import com.timestamping.app.model.User;

import java.time.Instant;
import java.util.List;

public record UserSummary(Long id, String username, String email, Instant createdAt, List<String> roles) {
    public static UserSummary from(User u) {
        Instant now = Instant.now();
        var roleNames = u.getRoles().stream()
                .filter(r -> isActiveRole(u, r.getName(), now))
                .map(r -> r.getName())
                .toList();
        return new UserSummary(u.getId(), u.getUsername(), u.getEmail(), u.getCreatedAt(), roleNames);
    }

    private static boolean isActiveRole(User u, String roleName, Instant now) {
        return switch (roleName) {
            case "JIT_AUDITOR" -> u.getAuditorExpiresAt() == null || now.isBefore(u.getAuditorExpiresAt());
            case "JIT_DELETE"  -> u.getDeleteExpiresAt() == null || now.isBefore(u.getDeleteExpiresAt());
            default -> true;
        };
    }
}
