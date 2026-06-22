package com.timestamping.app.repository;

import com.timestamping.app.model.LogChainEntry;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface LogChainRepository extends JpaRepository<LogChainEntry, Long> {

    /**
     * Fetches the latest entry with a PESSIMISTIC_WRITE lock.
     * This serialises concurrent timestamp requests at the DB level:
     * the second request blocks until the first transaction commits,
     * preventing two entries from claiming the same sequence number
     * or computing previous_row_hash against a stale state.
     */
    @Query("SELECT e FROM LogChainEntry e ORDER BY e.sequenceNumber DESC LIMIT 1")
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<LogChainEntry> findLatestEntryForUpdate();

    /** Read-only variant used for verification and display (no lock needed). */
    @Query("SELECT e FROM LogChainEntry e ORDER BY e.sequenceNumber DESC LIMIT 1")
    Optional<LogChainEntry> findLatestEntry();

    @Query("SELECT COALESCE(MAX(e.sequenceNumber), 0) FROM LogChainEntry e")
    long findMaxSequenceNumber();

    @Query("SELECT e FROM LogChainEntry e WHERE e.requestedBy.username = :username ORDER BY e.sequenceNumber DESC")
    List<LogChainEntry> findByUsername(@Param("username") String username, org.springframework.data.domain.Pageable pageable);

    @Query("SELECT e FROM LogChainEntry e ORDER BY e.sequenceNumber ASC")
    List<LogChainEntry> findAllOrdered();

    @Query("SELECT COUNT(e) FROM LogChainEntry e")
    long countAll();
}
