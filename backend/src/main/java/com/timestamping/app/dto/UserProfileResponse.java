package com.timestamping.app.dto;

import com.timestamping.app.model.User;

import java.time.Instant;
import java.util.List;

public record UserProfileResponse(
    Long id,
    String username,
    String email,
    String firstName,
    String lastName,
    Instant createdAt,
    Instant updatedAt,
    Instant auditorExpiresAt,
    Instant deleteExpiresAt,
    List<String> roles
) {
    public static UserProfileResponse from(User u) {
        var roleNames = u.getRoles().stream()
                .map(r -> r.getName())
                .toList();
        return new UserProfileResponse(
            u.getId(), u.getUsername(), u.getEmail(),
            u.getFirstName(), u.getLastName(),
            u.getCreatedAt(), u.getUpdatedAt(),
            u.getAuditorExpiresAt(), u.getDeleteExpiresAt(),
            roleNames
        );
    }
}
