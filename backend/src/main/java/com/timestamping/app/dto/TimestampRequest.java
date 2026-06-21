package com.timestamping.app.dto;

import jakarta.validation.constraints.*;

public record TimestampRequest(
    @NotBlank @Pattern(regexp = "[0-9a-fA-F]{64}", message = "Must be a valid SHA-256 hex string")
    String fileHash,
    @NotBlank
    String nonce
) {}
