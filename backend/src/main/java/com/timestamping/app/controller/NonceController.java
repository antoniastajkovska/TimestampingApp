package com.timestamping.app.controller;

import com.timestamping.app.service.NonceService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/nonce")
@RequiredArgsConstructor
public class NonceController {

    private final NonceService nonceService;

    @PostMapping("/generate")
    @PreAuthorize("hasRole('USER') or hasRole('ADMIN')")
    public ResponseEntity<Map<String, String>> generate(
            @AuthenticationPrincipal UserDetails principal) {

        String nonce = nonceService.generate(principal.getUsername());
        return ResponseEntity.ok(Map.of("nonce", nonce));
    }
}
