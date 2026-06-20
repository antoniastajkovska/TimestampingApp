package com.timestamping.app.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.concurrent.ConcurrentHashMap;

// In-memory session store — intentional for this lab. Sessions are lost on restart.
@Service
public class SessionService {

    private static final String KEY_PREFIX = "tsession:";

    @Value("${app.session.max-age-seconds:3600}")
    private int maxAgeSeconds;

    private record Entry(String username, long expiresAt) {}

    private final ConcurrentHashMap<String, Entry> store = new ConcurrentHashMap<>();
    private final SecureRandom secureRandom = new SecureRandom();

    public String createSession(String username) {
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        store.put(token, new Entry(username, System.currentTimeMillis() + (long) maxAgeSeconds * 1000));
        return token;
    }

    public String getUsernameForSession(String token) {
        Entry e = store.get(token);
        if (e == null) return null;
        if (System.currentTimeMillis() > e.expiresAt()) { store.remove(token); return null; }
        return e.username();
    }

    public void invalidateSession(String token) {
        store.remove(token);
    }

    public void invalidateAllSessionsForUser(String username) {
        store.entrySet().removeIf(e -> username.equals(e.getValue().username()));
    }

    public int getMaxAgeSeconds() { return maxAgeSeconds; }
}
