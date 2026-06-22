package com.timestamping.app.dto;

import java.time.Instant;

public record HistoryEntryResponse(
    long sequenceNumber,
    String fileHash,
    Instant timestampUtc,
    String ntpSource,
    String signature
) {}
