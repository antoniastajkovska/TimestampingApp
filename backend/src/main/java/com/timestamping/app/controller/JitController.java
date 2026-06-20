package com.timestamping.app.controller;

import com.timestamping.app.service.JitAccessService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.Map;

@RestController
@RequestMapping("/api/jit")
@RequiredArgsConstructor
public class JitController {

    private final JitAccessService jitAccessService;

    public record JitElevateRequest(@NotBlank String password) {}

    /** ADMIN requests temporary JIT_AUDITOR role (audit log access). Requires password re-entry. */
    @PostMapping("/request-auditor")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> requestAuditorAccess(
            @Valid @RequestBody JitElevateRequest req,
            @AuthenticationPrincipal UserDetails principal,
            HttpServletRequest httpReq) {

        Instant expiresAt = jitAccessService.grantAuditorAccess(
                principal.getUsername(), req.password(), httpReq);
        return ResponseEntity.ok(Map.of(
            "message",   "JIT_AUDITOR role granted for 15 minutes",
            "expiresAt", expiresAt.toEpochMilli()
        ));
    }

    /** ADMIN requests temporary JIT_DELETE role (destructive operations). Requires password re-entry. */
    @PostMapping("/request-delete")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> requestDeleteAccess(
            @Valid @RequestBody JitElevateRequest req,
            @AuthenticationPrincipal UserDetails principal,
            HttpServletRequest httpReq) {

        Instant expiresAt = jitAccessService.grantDeleteAccess(
                principal.getUsername(), req.password(), httpReq);
        return ResponseEntity.ok(Map.of(
            "message",   "JIT_DELETE role granted for 15 minutes",
            "expiresAt", expiresAt.toEpochMilli()
        ));
    }
}
