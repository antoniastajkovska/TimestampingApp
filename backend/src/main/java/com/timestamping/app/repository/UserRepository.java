package com.timestamping.app.repository;

import com.timestamping.app.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByUsername(String username);
    Optional<User> findByEmail(String email);
    boolean existsByUsername(String username);
    boolean existsByUsernameAndIdNot(String username, Long id);
    boolean existsByEmail(String email);
    boolean existsByEmailAndIdNot(String email, Long id);

    @Query("SELECT u FROM User u WHERE u.username = :usernameOrEmail OR u.email = :usernameOrEmail")
    Optional<User> findByUsernameOrEmail(String usernameOrEmail);

    @Query("SELECT u FROM User u ORDER BY u.createdAt DESC")
    List<User> findAllOrderByCreatedAtDesc();

    @Query("SELECT u FROM User u WHERE u.auditorExpiresAt IS NOT NULL AND u.auditorExpiresAt < :now")
    List<User> findUsersWithExpiredAuditorAccess(Instant now);

    @Query("SELECT u FROM User u WHERE u.deleteExpiresAt IS NOT NULL AND u.deleteExpiresAt < :now")
    List<User> findUsersWithExpiredDeleteAccess(Instant now);
}
