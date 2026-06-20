package com.timestamping.app.controller;

import com.timestamping.app.dto.*;
import com.timestamping.app.model.AuditLogEntry.EventType;
import com.timestamping.app.service.AuditService;
import com.timestamping.app.service.AuthService;
import com.timestamping.app.service.SessionService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final SessionService sessionService;
    private final AuditService auditService;

    // ── Registration ──────────────────────────────────────────────────────

    /** Step 1 — validate fields, save disabled user, send OTP email. */
    @PostMapping("/register")
    public ResponseEntity<Map<String, String>> register(
            @Valid @RequestBody RegisterRequest req,
            HttpServletRequest httpReq) {

        String pendingUsername = authService.initiateRegistration(req);
        return ResponseEntity.ok(Map.of(
            "message",         "Verification code sent to your email.",
            "pendingUsername", pendingUsername
        ));
    }

    /** Step 2 — verify registration OTP, enable account. */
    @PostMapping("/register/verify")
    public ResponseEntity<Map<String, String>> confirmRegistration(
            @Valid @RequestBody TwoFactorRequest req,
            HttpServletRequest httpReq) {

        authService.confirmRegistration(req, httpReq);
        return ResponseEntity.ok(Map.of("message", "Account verified. You can now log in."));
    }

    // ── Login ─────────────────────────────────────────────────────────────

    /** Step 1 — password check, send OTP email. */
    @PostMapping("/login")
    public ResponseEntity<Map<String, String>> login(
            @Valid @RequestBody LoginRequest req,
            HttpServletRequest httpReq) {

        String pendingUsername = authService.initiateLogin(req, httpReq);
        return ResponseEntity.ok(Map.of(
            "message",         "Password accepted. Check your email for the verification code.",
            "pendingUsername", pendingUsername
        ));
    }

    /** Step 2 — OTP check, issue session cookie. */
    @PostMapping("/verify-2fa")
    public ResponseEntity<Map<String, String>> verify2fa(
            @Valid @RequestBody TwoFactorRequest req,
            HttpServletRequest httpReq,
            HttpServletResponse httpRes) {

        String sessionToken = authService.verifyTwoFactor(req, httpReq);
        httpRes.addCookie(buildSessionCookie(sessionToken, sessionService.getMaxAgeSeconds()));
        return ResponseEntity.ok(Map.of("message", "Authentication successful"));
    }

    // ── Logout ────────────────────────────────────────────────────────────

    @PostMapping("/logout")
    public ResponseEntity<Map<String, String>> logout(
            HttpServletRequest httpReq,
            HttpServletResponse httpRes,
            @AuthenticationPrincipal UserDetails principal) {

        String token = extractSessionCookie(httpReq);
        if (token != null) sessionService.invalidateSession(token);
        if (principal != null) {
            auditService.log(null, principal.getUsername(), EventType.LOGOUT, httpReq, null);
        }
        httpRes.addCookie(buildSessionCookie("", 0));
        return ResponseEntity.ok(Map.of("message", "Logged out"));
    }

    // ── helpers ───────────────────────────────────────────────────────────

    private Cookie buildSessionCookie(String value, int maxAge) {
        Cookie cookie = new Cookie("TSESSION", value);
        cookie.setHttpOnly(true);
        cookie.setSecure(true);
        cookie.setAttribute("SameSite", "Strict");
        cookie.setPath("/");
        cookie.setMaxAge(maxAge);
        return cookie;
    }

    private String extractSessionCookie(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return null;
        return Arrays.stream(cookies)
                .filter(c -> "TSESSION".equals(c.getName()))
                .map(Cookie::getValue)
                .findFirst().orElse(null);
    }
}
