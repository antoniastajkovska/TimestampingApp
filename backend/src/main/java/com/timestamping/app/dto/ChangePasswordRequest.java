package com.timestamping.app.dto;

import com.timestamping.app.security.ValidPassword;
import jakarta.validation.constraints.NotBlank;

public record ChangePasswordRequest(
    @NotBlank String currentPassword,
    @NotBlank @ValidPassword String newPassword,
    @NotBlank String confirmPassword
) {}
