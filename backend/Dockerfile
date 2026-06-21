# ── Stage 1: build ──────────────────────────────────────────────────────────
FROM maven:3.9-eclipse-temurin-21-alpine AS build
WORKDIR /build

# Cache dependency layer — only re-downloads if pom.xml changes
COPY pom.xml .
RUN mvn dependency:go-offline -q

COPY src ./src
RUN mvn package -DskipTests -q

# ── Stage 2: runtime ────────────────────────────────────────────────────────
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app/backend

COPY --from=build /build/target/*.jar app.jar

# 8443 = HTTPS API,  9090 = Actuator (internal, health only)
EXPOSE 8443 9090

ENTRYPOINT ["java", "-jar", "app.jar"]
