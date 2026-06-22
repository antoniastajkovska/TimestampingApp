package com.timestamping.app.service;

import com.timestamping.app.dto.*;
import com.timestamping.app.model.AuditLogEntry.EventType;
import com.timestamping.app.model.Role;
import com.timestamping.app.model.User;
import com.timestamping.app.repository.RoleRepository;
import com.timestamping.app.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final SessionService sessionService;
    private final AuditService auditService;
    private final EmailService emailService;

    @Value("${app.totp.max-attempts:5}")
    private int maxOtpAttempts;

    @Value("${app.totp.lockout-minutes:15}")
    private int otpLockoutMinutes;

    @Value("${app.totp.hmac-secret}")
    private String otpHmacSecret;

    private final SecureRandom secureRandom = new SecureRandom();

    // â”€â”€ Registration â€” Step 1 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    /**
     * Validates uniqueness, saves the user as disabled (enabled=false),
     * generates an OTP and emails it. The account is only enabled after
     * the OTP is verified via confirmRegistration().
     */
    @Transactional
    public String initiateRegistration(RegisterRequest req) {
        // If the username exists but is still unverified, allow retry with a fresh OTP
        userRepository.findByUsername(req.username()).ifPresent(existing -> {
            if (existing.isEnabled()) throw new IllegalArgumentException("Username already taken");
        });
        userRepository.findByEmail(req.email()).ifPresent(existing -> {
            if (existing.isEnabled()) throw new IllegalArgumentException("Email already registered");
        });

        User user = userRepository.findByUsername(req.username()).orElseGet(User::new);
        user.setUsername(req.username());
        user.setEmail(req.email());
        user.setPasswordHash(passwordEncoder.encode(req.password()));
        user.setEnabled(false);

        if (user.getRoles().isEmpty()) {
            Role orgUser = roleRepository.findByName(Role.Name.USER.name())
                    .orElseThrow(() -> new IllegalStateException("Role USER not seeded"));
            user.getRoles().add(orgUser);
        }

        String otp = issueOtp(user, 15);
        userRepository.save(user);

        emailService.sendOtp(user.getEmail(), user.getUsername(), otp);
        return req.username();
    }

    /**
     * Step 2 â€” confirm registration OTP. Enables the account on success.
     */
    @Transactional
    public void confirmRegistration(TwoFactorRequest req, HttpServletRequest httpReq) {
        User user = userRepository.findByUsername(req.username())
                .orElseThrow(() -> new BadCredentialsException("Unknown user"));

        validateOtp(user, req.code(), httpReq);

        user.setEnabled(true);
        userRepository.save(user);
        auditService.log(user, user.getUsername(), EventType.REGISTER, httpReq, "email verified");
    }

    // â”€â”€ Login â€” Step 1 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    /**
     * Validates the password, generates an OTP, and emails it.
     * Returns the username as a "pending" marker for the frontend.
     */
    @Transactional
    public String initiateLogin(LoginRequest req, HttpServletRequest httpReq) {
        try {
            authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(req.username(), req.password()));
        } catch (BadCredentialsException | DisabledException e) {
            auditService.log(null, req.username(), EventType.LOGIN_FAIL, httpReq,
                             "Password check failed");
            throw new BadCredentialsException("Invalid credentials");
        }

        User user = userRepository.findByUsernameOrEmail(req.username()).orElseThrow();
        String otp = issueOtp(user);
        userRepository.save(user);

        emailService.sendOtp(user.getEmail(), user.getUsername(), otp);
        return req.username();
    }

    // â”€â”€ Login â€” Step 2 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    @Transactional
    public String verifyTwoFactor(TwoFactorRequest req, HttpServletRequest httpReq) {
        User user = userRepository.findByUsername(req.username())
                .orElseThrow(() -> new BadCredentialsException("Invalid session"));

        validateOtp(user, req.code(), httpReq);

        auditService.log(user, user.getUsername(), EventType.LOGIN_SUCCESS, httpReq, null);
        return sessionService.createSession(user.getUsername());
    }

    // â”€â”€ Shared helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    private String issueOtp(User user) {
        return issueOtp(user, 10);
    }

    private String issueOtp(User user, int expiryMinutes) {
        String otp = String.format("%08d", secureRandom.nextInt(100_000_000));
        user.setTotpSecret(hashOtp(otp));
        user.setTotpExpiresAt(Instant.now().plus(expiryMinutes, ChronoUnit.MINUTES));
        user.setTotpAttempts(0);
        user.setTotpLockedUntil(null);
        return otp;
    }

    private void validateOtp(User user, String code, HttpServletRequest httpReq) {
        if (user.getTotpLockedUntil() != null && Instant.now().isBefore(user.getTotpLockedUntil())) {
            auditService.log(user, user.getUsername(), EventType.OTP_LOCKED, httpReq,
                             "Attempted while locked out");
            throw new LockedException("Account temporarily locked due to too many failed attempts");
        }

        if (user.getTotpSecret() == null || user.getTotpExpiresAt() == null) {
            throw new BadCredentialsException("No pending verification â€” please start again");
        }

        if (Instant.now().isAfter(user.getTotpExpiresAt())) {
            clearOtpState(user);
            userRepository.save(user);
            throw new BadCredentialsException("Verification code expired â€” please start again");
        }

        if (!MessageDigest.isEqual(hexToBytes(user.getTotpSecret()), hashOtpBytes(code))) {
            int attempts = user.getTotpAttempts() + 1;
            user.setTotpAttempts(attempts);

            if (attempts >= maxOtpAttempts) {
                user.setTotpLockedUntil(Instant.now().plus(otpLockoutMinutes, ChronoUnit.MINUTES));
                clearOtpState(user);
                userRepository.save(user);
                auditService.log(user, user.getUsername(), EventType.OTP_LOCKED, httpReq,
                                 "Locked after " + attempts + " failed attempts");
                throw new LockedException("Too many failed attempts â€” account locked for "
                                          + otpLockoutMinutes + " minutes");
            }

            userRepository.save(user);
            auditService.log(user, user.getUsername(), EventType.OTP_FAIL, httpReq,
                             "Attempt " + attempts + "/" + maxOtpAttempts);
            throw new BadCredentialsException("Invalid code ("
                    + (maxOtpAttempts - attempts) + " attempts remaining)");
        }

        clearOtpState(user);
    }

    private void clearOtpState(User user) {
        user.setTotpSecret(null);
        user.setTotpExpiresAt(null);
        user.setTotpAttempts(0);
    }

    private byte[] hashOtpBytes(String otp) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(otpHmacSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return mac.doFinal(otp.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new IllegalStateException("Unable to hash verification code", e);
        }
    }

    private String hashOtp(String otp) {
        return HexFormat.of().formatHex(hashOtpBytes(otp));
    }

    private byte[] hexToBytes(String hex) {
        try {
            return HexFormat.of().parseHex(hex);
        } catch (IllegalArgumentException e) {
            throw new BadCredentialsException("Invalid verification state");
        }
    }
}
