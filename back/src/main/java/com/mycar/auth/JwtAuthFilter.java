package com.mycar.auth;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import com.mycar.user.UserRepository;
import java.io.IOException;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** 쿠키(웹) 또는 Authorization: Bearer(앱) 토큰으로 로그인 사용자를 식별한다. */
@Component
public class JwtAuthFilter extends OncePerRequestFilter {
    public static final String COOKIE = "naeil_session";

    private final JwtService jwt;
    private final UserRepository users;

    public JwtAuthFilter(JwtService jwt, UserRepository users) {
        this.jwt = jwt;
        this.users = users;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        String token = extract(req);
        if (token != null) {
            JwtService.Parsed p = jwt.parse(token);
            if (p != null && stillValid(p)) {
                var auth = new UsernamePasswordAuthenticationToken(p.userId(), null, List.of(new SimpleGrantedAuthority("ROLE_USER")));
                SecurityContextHolder.getContext().setAuthentication(auth);
            }
        }
        chain.doFilter(req, res);
    }

    /** 삭제된 계정이거나, 비밀번호를 바꾸기 전에 발급된 토큰이면 무효. (초 단위로 비교해 같은 초는 허용) */
    private boolean stillValid(JwtService.Parsed p) {
        return users.findById(p.userId())
                .map(u -> u.getPasswordChangedAt() == null
                        || !p.issuedAt().truncatedTo(ChronoUnit.SECONDS)
                                .isBefore(u.getPasswordChangedAt().toInstant().truncatedTo(ChronoUnit.SECONDS)))
                .orElse(false);
    }

    private static String extract(HttpServletRequest req) {
        String h = req.getHeader("Authorization");
        if (h != null && h.startsWith("Bearer ")) return h.substring(7);
        if (req.getCookies() != null) {
            for (Cookie c : req.getCookies()) if (COOKIE.equals(c.getName())) return c.getValue();
        }
        return null;
    }
}
