package com.timestamping.app.controller;

import com.timestamping.app.dto.*;
import com.timestamping.app.service.UserService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/me")
    public ResponseEntity<UserProfileResponse> getMe(@AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(userService.getProfile(principal.getUsername()));
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<UserSummary>> getAllUsers() {
        return ResponseEntity.ok(userService.getAllUsers());
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UserSummary> adminCreateUser(
            @Valid @RequestBody AdminCreateUserRequest req,
            @AuthenticationPrincipal UserDetails principal,
            HttpServletRequest httpReq) {
        return ResponseEntity.ok(userService.adminCreateUser(req, principal.getUsername(), httpReq));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UserSummary> adminUpdateUser(
            @PathVariable Long id,
            @Valid @RequestBody AdminUpdateUserRequest req,
            @AuthenticationPrincipal UserDetails principal,
            HttpServletRequest httpReq) {
        return ResponseEntity.ok(userService.adminUpdateUser(id, req, principal.getUsername(), httpReq));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('JIT_DELETE')")
    public ResponseEntity<Map<String, String>> adminDeleteUser(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails principal,
            HttpServletRequest httpReq) {
        userService.adminDeleteUser(id, principal.getUsername(), httpReq);
        return ResponseEntity.ok(Map.of("message", "User deleted."));
    }

    @PutMapping("/me")
    public ResponseEntity<UserProfileResponse> updateProfile(
            @Valid @RequestBody UpdateProfileRequest req,
            @AuthenticationPrincipal UserDetails principal) {

        return ResponseEntity.ok(userService.updateProfile(principal.getUsername(), req));
    }

    @PutMapping("/me/password")
    public ResponseEntity<Map<String, String>> changePassword(
            @Valid @RequestBody ChangePasswordRequest req,
            @AuthenticationPrincipal UserDetails principal,
            HttpServletRequest httpReq,
            HttpServletResponse httpRes) {

        userService.changePassword(principal.getUsername(), req);
        expireSessionCookie(httpReq, httpRes);
        return ResponseEntity.ok(Map.of("message", "Password changed. Please log in again."));
    }

    @DeleteMapping("/me")
    public ResponseEntity<Map<String, String>> deleteAccount(
            @Valid @RequestBody DeleteAccountRequest req,
            @AuthenticationPrincipal UserDetails principal,
            HttpServletRequest httpReq,
            HttpServletResponse httpRes) {

        userService.deleteAccount(principal.getUsername(), req);
        expireSessionCookie(httpReq, httpRes);
        return ResponseEntity.ok(Map.of("message", "Account deleted."));
    }

    private void expireSessionCookie(HttpServletRequest req, HttpServletResponse res) {
        Cookie[] cookies = req.getCookies();
        if (cookies == null) return;
        Arrays.stream(cookies)
              .filter(c -> "TSESSION".equals(c.getName()))
              .findFirst()
              .ifPresent(c -> {
                  Cookie expire = new Cookie("TSESSION", "");
                  expire.setHttpOnly(true);
                  expire.setSecure(true);
                  expire.setAttribute("SameSite", "Strict");
                  expire.setPath("/");
                  expire.setMaxAge(0);
                  res.addCookie(expire);
              });
    }
}
