package com.timestamping.app.service;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@Slf4j
@Service
public class NtpService {

    // NTP epoch is 1900-01-01; Unix epoch is 1970-01-01 -> 70 years in seconds
    private static final long NTP_EPOCH_OFFSET = 2208988800L;
    private static final int NTP_PORT = 123;
    private static final int TIMEOUT_MS = 3_000;
    private static final long MAX_DRIFT_MS = 5_000;

    private static final String[] NTP_SERVERS = {
        "time.cloudflare.com",
        "time.google.com",
        "pool.ntp.org"
    };

    private volatile Instant lastGoodTime;
    private volatile String lastGoodSource;
    private volatile long lastOffsetMs;

    @PostConstruct
    public void init() {
        sync();
    }

    @Scheduled(fixedDelay = 5 * 60 * 1_000)
    public void sync() {
        List<Long> offsets = new ArrayList<>();
        String successSource = null;

        for (String server : NTP_SERVERS) {
            try {
                long offset = queryOffsetMs(server);
                offsets.add(offset);
                if (successSource == null) successSource = server;
            } catch (Exception e) {
                log.warn("NTP query failed for {}: {}", server, e.getMessage());
            }
        }

        if (offsets.isEmpty()) {
            log.error("All NTP servers unreachable - keeping last known time");
            return;
        }

        Collections.sort(offsets);
        long medianOffset = offsets.get(offsets.size() / 2);

        if (Math.abs(medianOffset) > MAX_DRIFT_MS) {
            log.error(
                "System clock drift {}ms exceeds limit of {}ms - timestamps may be inaccurate",
                medianOffset,
                MAX_DRIFT_MS
            );
            // Do not crash - Docker Desktop on dev machines can have large drift.
            // In production this should alert/page oncall instead.
        }

        lastOffsetMs = medianOffset;
        lastGoodTime = Instant.now().plusMillis(medianOffset);
        lastGoodSource = successSource;
        log.info("NTP sync OK - offset {}ms via {}", medianOffset, lastGoodSource);
    }

    public Instant now() {
        if (lastGoodTime == null) {
            throw new IllegalStateException("NTP not yet synced");
        }
        return Instant.now().plusMillis(lastOffsetMs);
    }

    public String lastSource() {
        return lastGoodSource;
    }

    // -----------------------------------------------------------------------

    private long queryOffsetMs(String host) throws Exception {
        byte[] buf = new byte[48];
        buf[0] = 0x1B; // LI=0, VN=3, Mode=3 (client)

        try (DatagramSocket socket = new DatagramSocket()) {
            socket.setSoTimeout(TIMEOUT_MS);
            InetAddress address = InetAddress.getByName(host);

            long t1 = System.currentTimeMillis();
            DatagramPacket request = new DatagramPacket(buf, buf.length, address, NTP_PORT);
            socket.send(request);

            DatagramPacket response = new DatagramPacket(new byte[48], 48);
            socket.receive(response);
            long t4 = System.currentTimeMillis();

            byte[] data = response.getData();
            long ntpSeconds = extractUnsigned32(data, 40); // Transmit Timestamp (seconds)
            long unixMs = (ntpSeconds - NTP_EPOCH_OFFSET) * 1_000L;

            // Simple offset: (server_time - midpoint_of_roundtrip)
            long midpoint = t1 + (t4 - t1) / 2;
            return unixMs - midpoint;
        }
    }

    private long extractUnsigned32(byte[] data, int offset) {
        long result = 0;
        for (int i = 0; i < 4; i++) {
            result = (result << 8) | (data[offset + i] & 0xFF);
        }
        return result;
    }

    public static class ClockDriftException extends RuntimeException {
        public ClockDriftException(String msg) {
            super(msg);
        }
    }
}
