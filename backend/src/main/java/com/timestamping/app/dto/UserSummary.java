package com.timestamping.app.dto;

import com.timestamping.app.model.User;

import java.time.Instant;
import java.util.List;

public record UserSummary(Long id, String username, String email, Instant createdAt, List<String> roles) {
    public static UserSummary from(User u) {
        var roleNames = u.getRoles().stream().map(r -> r.getName()).toList();
        return new UserSummary(u.getId(), u.getUsername(), u.getEmail(), u.getCreatedAt(), roleNames);
    }
}
