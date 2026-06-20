package com.timestamping.app.dto;

import jakarta.validation.constraints.*;

public record TwoFactorRequest(
    @NotBlank String username,
    @NotBlank @Size(min = 8, max = 8) String code
) {}
