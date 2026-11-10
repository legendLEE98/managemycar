package com.mycar.auth;

import com.mycar.auth.AuthDtos.ChangePasswordRequest;
import com.mycar.auth.AuthDtos.LoginRequest;
import com.mycar.auth.AuthDtos.SignupRequest;
import com.mycar.auth.AuthDtos.UserDto;
import com.mycar.user.AppUser;
import com.mycar.user.UserRepository;
import java.util.Locale;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {
    static final String LOCAL = "local";

    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final LoginAttempts attempts;
    /** 없는 계정으로 로그인할 때도 같은 시간이 걸리도록(계정 존재 여부 노출 방지) 쓰는 더미 해시 */
    private volatile String dummyHash;

    public AuthService(UserRepository users, PasswordEncoder encoder, LoginAttempts attempts) {
        this.users = users;
        this.encoder = encoder;
        this.attempts = attempts;
    }

    @Transactional
    public AppUser signup(SignupRequest req) {
        String email = normalize(req.email());
        String pw = req.password();
        if (!pw.matches(".*[A-Za-z].*") || !pw.matches(".*\\d.*")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "비밀번호에는 영문과 숫자를 모두 넣어 주세요.");
        }
        if (users.existsByProviderAndEmail(LOCAL, email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "이미 가입된 이메일이에요.");
        }
        try {
            return users.saveAndFlush(AppUser.local(email, encoder.encode(pw), req.nickname().trim()));
        } catch (DataIntegrityViolationException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "이미 가입된 이메일이에요.");
        }
    }

    @Transactional
    public AppUser login(LoginRequest req, String clientIp) {
        String email = normalize(req.email());
        String key = clientIp + "|" + email;
        if (attempts.blocked(key)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "로그인 시도가 너무 많아요. 잠시 후 다시 시도해 주세요.");
        }
        AppUser user = users.findByProviderAndEmail(LOCAL, email).orElse(null);
        boolean ok;
        if (user == null || user.getPasswordHash() == null) {
            encoder.matches(req.password(), dummy());
            ok = false;
        } else {
            ok = encoder.matches(req.password(), user.getPasswordHash());
        }
        if (!ok) {
            attempts.fail(key);
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "이메일 또는 비밀번호가 올바르지 않아요.");
        }
        attempts.reset(key);
        user.markLogin();
        return user;
    }

    /** 현재 비밀번호를 확인한 뒤 새 비밀번호로 바꾼다. 연속으로 틀리면 잠시 막는다. */
    @Transactional
    public void changePassword(long userId, ChangePasswordRequest req) {
        AppUser user = find(userId);
        if (user.getPasswordHash() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "이 계정은 비밀번호로 로그인하지 않아요.");
        }
        String key = "pw:" + userId;
        if (attempts.blocked(key)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "비밀번호 확인에 너무 많이 실패했어요. 잠시 후 다시 시도해 주세요.");
        }
        if (!encoder.matches(req.currentPassword(), user.getPasswordHash())) {
            attempts.fail(key);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "현재 비밀번호가 올바르지 않아요.");
        }
        attempts.reset(key);
        String next = req.newPassword();
        if (!next.matches(".*[A-Za-z].*") || !next.matches(".*\\d.*")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "새 비밀번호에는 영문과 숫자를 모두 넣어 주세요.");
        }
        if (next.equals(req.currentPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "현재 비밀번호와 다른 비밀번호를 입력해 주세요.");
        }
        user.changePassword(encoder.encode(next));
    }

    @Transactional(readOnly = true)
    public AppUser find(long id) {
        return users.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
    }

    public static UserDto dto(AppUser u) {
        return new UserDto(u.getId(), u.getEmail(), u.getNickname(), u.getProvider());
    }

    private String dummy() {
        String h = dummyHash;
        if (h == null) {
            h = encoder.encode("dummy-password-for-timing");
            dummyHash = h;
        }
        return h;
    }

    private static String normalize(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
