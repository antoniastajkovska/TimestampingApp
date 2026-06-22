package com.timestamping.app.security;

import com.timestamping.app.model.User;
import com.timestamping.app.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserDetailsServiceImpl implements UserDetailsService {

    private final UserRepository userRepository;

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        User user = userRepository.findByUsernameOrEmail(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + username));

        Instant now = Instant.now();
        var authorities = user.getRoles().stream()
                .filter(role -> isActiveRole(user, role.getName(), now))
                .map(role -> new SimpleGrantedAuthority("ROLE_" + role.getName()))
                .collect(Collectors.toSet());

        return new org.springframework.security.core.userdetails.User(
                user.getUsername(),
                user.getPasswordHash(),
                user.isEnabled(),
                true, true, true,
                authorities
        );
    }

    private boolean isActiveRole(User user, String roleName, Instant now) {
        return switch (roleName) {
            case "JIT_AUDITOR" -> user.getAuditorExpiresAt() == null || now.isBefore(user.getAuditorExpiresAt());
            case "JIT_DELETE"  -> user.getDeleteExpiresAt() == null || now.isBefore(user.getDeleteExpiresAt());
            default -> true;
        };
    }
}
