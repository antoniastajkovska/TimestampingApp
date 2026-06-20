package com.timestamping.app.dto;

import com.timestamping.app.security.ValidPassword;
import jakarta.validation.constraints.*;

public record RegisterRequest(
    @NotBlank @Size(min = 3, max = 50) String username,
    @NotBlank @Email                   String email,
    @NotBlank @ValidPassword           String password
) {}
