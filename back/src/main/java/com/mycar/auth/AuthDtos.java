package com.mycar.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class AuthDtos {
    private AuthDtos() {}

    public record SignupRequest(
            @NotBlank(message = "이메일을 입력해 주세요.")
            @Email(message = "이메일 형식이 올바르지 않아요.")
            @Size(max = 255, message = "이메일이 너무 길어요.") String email,
            @NotBlank(message = "비밀번호를 입력해 주세요.")
            @Size(min = 8, max = 128, message = "비밀번호는 8자 이상 128자 이하로 입력해 주세요.") String password,
            @NotBlank(message = "닉네임을 입력해 주세요.")
            @Size(min = 2, max = 20, message = "닉네임은 2~20자로 입력해 주세요.") String nickname) {}

    public record LoginRequest(
            @NotBlank(message = "이메일을 입력해 주세요.") @Size(max = 255) String email,
            @NotBlank(message = "비밀번호를 입력해 주세요.") @Size(max = 128) String password) {}

    public record ChangePasswordRequest(
            @NotBlank(message = "현재 비밀번호를 입력해 주세요.") @Size(max = 128) String currentPassword,
            @NotBlank(message = "새 비밀번호를 입력해 주세요.")
            @Size(min = 8, max = 128, message = "새 비밀번호는 8자 이상 128자 이하로 입력해 주세요.") String newPassword) {}

    public record UserDto(long id, String email, String nickname, String provider) {}

    /** 앱용 로그인 응답. token은 이후 요청의 Authorization: Bearer 헤더에 담아 보낸다. */
    public record AppAuthResponse(String token, long expiresInSeconds, UserDto user) {}
}
