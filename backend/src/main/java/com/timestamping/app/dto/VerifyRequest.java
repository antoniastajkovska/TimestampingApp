package com.timestamping.app.dto;

import jakarta.validation.constraints.NotBlank;

public record VerifyRequest(
    @NotBlank String fileHash,
    @NotBlank String token
) {}
