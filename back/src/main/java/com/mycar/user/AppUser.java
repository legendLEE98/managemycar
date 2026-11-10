package com.mycar.user;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

@Entity
@Table(name = "app_user")
public class AppUser {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String provider = "local";

    @Column(name = "provider_id")
    private String providerId;

    @Column(nullable = false)
    private String email;

    @Column(name = "password_hash")
    private String passwordHash;

    @Column(nullable = false)
    private String nickname;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "last_login_at")
    private OffsetDateTime lastLoginAt;

    @Column(name = "password_changed_at")
    private OffsetDateTime passwordChangedAt;

    protected AppUser() {}

    public static AppUser local(String email, String passwordHash, String nickname) {
        AppUser u = new AppUser();
        u.email = email;
        u.passwordHash = passwordHash;
        u.nickname = nickname;
        return u;
    }

    public Long getId() { return id; }
    public String getProvider() { return provider; }
    public String getProviderId() { return providerId; }
    public String getEmail() { return email; }
    public String getPasswordHash() { return passwordHash; }
    public String getNickname() { return nickname; }
    public OffsetDateTime getPasswordChangedAt() { return passwordChangedAt; }
    public void markLogin() { this.lastLoginAt = OffsetDateTime.now(); }

    /** 비밀번호를 바꾸고, 그 시각을 기록한다(이전에 발급된 로그인 토큰을 무효로 만드는 기준). */
    public void changePassword(String newHash) {
        this.passwordHash = newHash;
        this.passwordChangedAt = OffsetDateTime.now();
    }
}
