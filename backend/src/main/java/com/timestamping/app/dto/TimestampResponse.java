package com.timestamping.app.dto;

import java.time.Instant;

public record TimestampResponse(
    long sequenceNumber,
    String fileHash,
    Instant timestamp,
    String signature,
    String previousRowHash,
    String token          // Base64-encoded signed token for download as .tsr
) {}
