package com.timestamping.app.service;

import com.timestamping.app.dto.*;
import com.timestamping.app.model.Role;
import com.timestamping.app.model.User;
import com.timestamping.app.repository.RoleRepository;
import com.timestamping.app.model.AuditLogEntry.EventType;
import com.timestamping.app.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final SessionService sessionService;
    private final AuditService auditService;

    public UserProfileResponse getProfile(String username) {
        User user = userRepository.findByUsername(username).orElseThrow();
        return UserProfileResponse.from(user);
    }

    public List<UserSummary> getAllUsers() {
        return userRepository.findAllOrderByCreatedAtDesc()
                .stream()
                .map(UserSummary::from)
                .toList();
    }

    @Transactional
    public UserProfileResponse updateProfile(String username, UpdateProfileRequest req) {
        User user = userRepository.findByUsername(username).orElseThrow();

        if (!user.getUsername().equals(req.username())
                && userRepository.existsByUsernameAndIdNot(req.username(), user.getId())) {
            throw new IllegalArgumentException("Username is already taken");
        }
        if (!user.getEmail().equals(req.email())
                && userRepository.existsByEmailAndIdNot(req.email(), user.getId())) {
            throw new IllegalArgumentException("Email is already registered");
        }

        user.setUsername(req.username());
        user.setEmail(req.email());
        user.setFirstName(req.firstName());
        user.setLastName(req.lastName());
        user.setUpdatedAt(Instant.now());
        userRepository.save(user);
        return UserProfileResponse.from(user);
    }

    @Transactional
    public void changePassword(String username, ChangePasswordRequest req) {
        if (!req.newPassword().equals(req.confirmPassword())) {
            throw new IllegalArgumentException("New passwords do not match");
        }

        User user = userRepository.findByUsername(username).orElseThrow();

        if (!passwordEncoder.matches(req.currentPassword(), user.getPasswordHash())) {
            throw new BadCredentialsException("Current password is incorrect");
        }
        if (passwordEncoder.matches(req.newPassword(), user.getPasswordHash())) {
            throw new IllegalArgumentException("New password must be different from the current password");
        }

        user.setPasswordHash(passwordEncoder.encode(req.newPassword()));
        user.setUpdatedAt(Instant.now());
        userRepository.save(user);

        sessionService.invalidateAllSessionsForUser(username);
        auditService.log(user, username, EventType.PASSWORD_CHANGE, null, "Password changed");
    }

    @Transactional
    public void deleteAccount(String username, DeleteAccountRequest req) {
        User user = userRepository.findByUsername(username).orElseThrow();

        if (!passwordEncoder.matches(req.password(), user.getPasswordHash())) {
            throw new BadCredentialsException("Incorrect password");
        }

        sessionService.invalidateAllSessionsForUser(username);
        auditService.log(user, username, EventType.ACCOUNT_DELETE, null, "Account deleted by user");
        userRepository.delete(user);
    }

    @Transactional
    public UserSummary adminCreateUser(AdminCreateUserRequest req, String adminUsername, HttpServletRequest httpReq) {
        User actor = userRepository.findByUsername(adminUsername).orElseThrow();
        if (userRepository.existsByUsername(req.username())) {
            throw new IllegalArgumentException("Username already taken");
        }
        if (userRepository.existsByEmail(req.email())) {
            throw new IllegalArgumentException("Email already registered");
        }

        User user = new User();
        user.setUsername(req.username());
        user.setEmail(req.email());
        user.setPasswordHash(passwordEncoder.encode(req.password()));
        user.setEnabled(true);

        Role orgUser = roleRepository.findByName(Role.Name.USER.name())
                .orElseThrow(() -> new IllegalStateException("Role USER not seeded"));
        user.getRoles().add(orgUser);

        userRepository.save(user);
        auditService.log(actor, adminUsername, EventType.ADMIN_CREATE_USER, httpReq,
                "created user=" + user.getUsername());
        return UserSummary.from(user);
    }

    @Transactional
    public UserSummary adminUpdateUser(Long targetId, AdminUpdateUserRequest req, String adminUsername, HttpServletRequest httpReq) {
        User actor = userRepository.findByUsername(adminUsername).orElseThrow();
        User target = userRepository.findById(targetId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (!target.getUsername().equals(req.username())
                && userRepository.existsByUsernameAndIdNot(req.username(), targetId)) {
            throw new IllegalArgumentException("Username already taken");
        }
        if (!target.getEmail().equals(req.email())
                && userRepository.existsByEmailAndIdNot(req.email(), targetId)) {
            throw new IllegalArgumentException("Email already registered");
        }

        target.setUsername(req.username());
        target.setEmail(req.email());
        target.setUpdatedAt(Instant.now());
        userRepository.save(target);
        auditService.log(actor, adminUsername, EventType.ADMIN_UPDATE_USER, httpReq,
                "updated userId=" + targetId + " username=" + target.getUsername());
        return UserSummary.from(target);
    }

    @Transactional
    public void adminDeleteUser(Long targetId, String adminUsername, HttpServletRequest httpReq) {
        User actor = userRepository.findByUsername(adminUsername).orElseThrow();
        User target = userRepository.findById(targetId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (target.getUsername().equals(adminUsername)) {
            throw new IllegalArgumentException("You cannot delete your own account via admin");
        }

        sessionService.invalidateAllSessionsForUser(target.getUsername());
        auditService.log(actor, adminUsername, EventType.ADMIN_DELETE_USER, httpReq,
                "deleted userId=" + targetId + " username=" + target.getUsername());
        userRepository.delete(target);
    }
}
