package com.timestamping.app.repository;

import com.timestamping.app.model.AuditLogEntry;
import com.timestamping.app.model.AuditLogEntry.EventType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface AuditLogRepository extends JpaRepository<AuditLogEntry, Long> {

    Page<AuditLogEntry> findAllByOrderByCreatedAtDesc(Pageable pageable);

    Page<AuditLogEntry> findByEventTypeInOrderByCreatedAtDesc(List<EventType> types, Pageable pageable);
}
