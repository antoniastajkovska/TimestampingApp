package com.timestamping.app;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class TimestampingApplication {
    public static void main(String[] args) {
        SpringApplication.run(TimestampingApplication.class, args);
    }
}
