package com.timestamping.app.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "log_chain")
@Getter @Setter
public class LogChainEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "sequence_number", nullable = false, unique = true)
    private Long sequenceNumber;

    @Column(name = "file_hash", nullable = false, length = 64)
    private String fileHash;

    @Column(name = "timestamp_utc", nullable = false)
    private Instant timestampUtc;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "requested_by", nullable = false)
    private User requestedBy;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String signature;

    // SHA-256 of the previous row's canonical representation
    @Column(name = "previous_row_hash", nullable = false, length = 64)
    private String previousRowHash;

    @Column(name = "nonce", length = 64)
    private String nonce;

    @Column(name = "ntp_source", length = 100)
    private String ntpSource;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
}
