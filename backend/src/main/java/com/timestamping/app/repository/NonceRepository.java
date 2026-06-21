package com.timestamping.app.repository;

import com.timestamping.app.model.Nonce;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;

public interface NonceRepository extends JpaRepository<Nonce, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT n FROM Nonce n WHERE n.nonceHex = :hex")
    Optional<Nonce> findByNonceHexForUpdate(@Param("hex") String hex);

    @Modifying
    @Query("DELETE FROM Nonce n WHERE n.expiresAt < :now")
    void deleteExpired(@Param("now") Instant now);
}
