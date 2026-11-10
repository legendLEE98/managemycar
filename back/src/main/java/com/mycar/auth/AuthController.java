package com.mycar.auth;

import com.mycar.auth.AuthDtos.ChangePasswordRequest;
import com.mycar.auth.AuthDtos.LoginRequest;
import com.mycar.auth.AuthDtos.SignupRequest;
import com.mycar.auth.AuthDtos.UserDto;
import com.mycar.user.AppUser;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
    private final AuthService auth;
    private final JwtService jwt;

    public AuthController(AuthService auth, JwtService jwt) {
        this.auth = auth;
        this.jwt = jwt;
    }

    @PostMapping("/signup")
    @ResponseStatus(HttpStatus.CREATED)
    public UserDto signup(@Valid @RequestBody SignupRequest req, HttpServletRequest http, HttpServletResponse res) {
        AppUser u = auth.signup(req);
        setSession(res, http, u.getId());
        return AuthService.dto(u);
    }

    @PostMapping("/login")
    public UserDto login(@Valid @RequestBody LoginRequest req, HttpServletRequest http, HttpServletResponse res) {
        AppUser u = auth.login(req, http.getRemoteAddr());
        setSession(res, http, u.getId());
        return AuthService.dto(u);
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(HttpServletRequest http, HttpServletResponse res) {
        res.addHeader(HttpHeaders.SET_COOKIE, cookie("", http, 0).toString());
    }

    /** 비밀번호 변경. 이 기기는 새 토큰으로 로그인을 유지하고, 이전에 발급된 다른 기기의 로그인은 끊긴다. */
    @PostMapping("/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void changePassword(@Valid @RequestBody ChangePasswordRequest req, Authentication authentication,
                               HttpServletRequest http, HttpServletResponse res) {
        long userId = (Long) authentication.getPrincipal();
        auth.changePassword(userId, req);
        setSession(res, http, userId);
    }

    @GetMapping("/me")
    public UserDto me(Authentication authentication) {
        return AuthService.dto(auth.find((Long) authentication.getPrincipal()));
    }

    private void setSession(HttpServletResponse res, HttpServletRequest http, long userId) {
        res.addHeader(HttpHeaders.SET_COOKIE, cookie(jwt.issue(userId), http, jwt.ttl().toSeconds()).toString());
    }

    private static ResponseCookie cookie(String value, HttpServletRequest http, long maxAgeSeconds) {
        return ResponseCookie.from(JwtAuthFilter.COOKIE, value)
                .httpOnly(true)
                .secure(http.isSecure())
                .sameSite("Lax")
                .path("/")
                .maxAge(maxAgeSeconds)
                .build();
    }
}
