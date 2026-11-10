package com.mycar.auth;

import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import javax.crypto.SecretKey;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/** 로그인 세션 토큰(JWT, HS256)을 만들고 검증한다. */
@Service
public class JwtService {
    private static final Logger log = LoggerFactory.getLogger(JwtService.class);

    private final SecretKey key;
    private final Duration ttl;

    public JwtService(@Value("${mycar.auth.jwt-secret:}") String secret,
                      @Value("${mycar.auth.session-days:7}") int sessionDays) {
        byte[] bytes;
        if (secret == null || secret.isBlank()) {
            bytes = new byte[48];
            new SecureRandom().nextBytes(bytes);
            log.warn("JWT_SECRET이 비어 있어 임시 키를 사용합니다. 서버를 다시 시작하면 모든 로그인이 풀립니다.");
        } else {
            bytes = secret.getBytes(StandardCharsets.UTF_8);
            if (bytes.length < 32) throw new IllegalStateException("JWT_SECRET은 32자 이상이어야 합니다.");
        }
        this.key = Keys.hmacShaKeyFor(bytes);
        this.ttl = Duration.ofDays(sessionDays);
    }

    public Duration ttl() {
        return ttl;
    }

    public String issue(long userId) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(Long.toString(userId))
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(ttl)))
                .signWith(key)
                .compact();
    }

    public record Parsed(long userId, Instant issuedAt) {}

    /** 유효하면 사용자 id와 발급 시각, 아니면 null */
    public Parsed parse(String token) {
        try {
            var claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
            return new Parsed(Long.parseLong(claims.getSubject()), claims.getIssuedAt().toInstant());
        } catch (JwtException | IllegalArgumentException e) {
            return null;
        }
    }
}
