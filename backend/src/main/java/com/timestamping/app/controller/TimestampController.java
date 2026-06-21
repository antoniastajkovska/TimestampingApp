package com.timestamping.app.controller;

import com.timestamping.app.dto.*;
import com.timestamping.app.service.TimestampService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/timestamp")
@RequiredArgsConstructor
public class TimestampController {

    private final TimestampService timestampService;

    @PostMapping
    @PreAuthorize("hasRole('USER') or hasRole('ADMIN')")
    public ResponseEntity<TimestampResponse> createTimestamp(
            @Valid @RequestBody TimestampRequest req,
            @AuthenticationPrincipal UserDetails principal,
            HttpServletRequest httpReq) throws Exception {

        return ResponseEntity.ok(
            timestampService.createTimestamp(req.fileHash(), req.nonce(), principal.getUsername(), httpReq));
    }

    @PostMapping("/verify")
    public ResponseEntity<VerifyResponse> verify(
            @Valid @RequestBody VerifyRequest req,
            HttpServletRequest httpReq) {

        return ResponseEntity.ok(timestampService.verifyTimestamp(req, httpReq));
    }
}
