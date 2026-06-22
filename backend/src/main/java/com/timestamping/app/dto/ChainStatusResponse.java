package com.timestamping.app.dto;

public record ChainStatusResponse(
    boolean intact,
    long totalEntries,
    String message
) {}
