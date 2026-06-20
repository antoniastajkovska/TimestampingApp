package com.timestamping.app.dto;

import jakarta.validation.constraints.*;

public record UpdateProfileRequest(
    @NotBlank @Size(min = 3, max = 50) String username,
    @NotBlank @Email                   String email,
    String firstName,
    String lastName
) {}
