-- 비밀번호를 바꾼 시각. 이 시각 이전에 발급된 로그인 토큰은 무효로 본다(다른 기기의 로그인을 끊는다).
ALTER TABLE app_user ADD COLUMN password_changed_at TIMESTAMPTZ;
