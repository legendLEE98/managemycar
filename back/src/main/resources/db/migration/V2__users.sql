-- 회원. provider는 가입 경로(현재 local, 이후 naver). 네이버 연동 시 provider_id에 네이버 고유 id를 저장한다.
CREATE TABLE app_user (
    id            BIGSERIAL PRIMARY KEY,
    provider      VARCHAR(20)  NOT NULL DEFAULT 'local',
    provider_id   VARCHAR(100),
    email         VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255),
    nickname      VARCHAR(50)  NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    last_login_at TIMESTAMPTZ
);

-- 이메일은 소문자로 저장한다.
CREATE UNIQUE INDEX ux_app_user_provider_email ON app_user (provider, email);
CREATE UNIQUE INDEX ux_app_user_provider_id ON app_user (provider, provider_id) WHERE provider_id IS NOT NULL;

-- 계정별 차량 상태(프론트 localStorage와 같은 JSON)
CREATE TABLE user_state (
    user_id    BIGINT PRIMARY KEY REFERENCES app_user (id) ON DELETE CASCADE,
    state      JSONB       NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
