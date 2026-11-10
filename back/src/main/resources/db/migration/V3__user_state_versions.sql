-- 계정별 차량 상태를 버전(스냅샷)으로 쌓는다. (user_id, version)이 유니크이고, 최신 상태 = 가장 큰 version.
CREATE TABLE user_state_version (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT      NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    version    INT         NOT NULL,
    state      JSONB       NOT NULL,
    summary    VARCHAR(200),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_user_state_version UNIQUE (user_id, version)
);

CREATE INDEX ix_user_state_version_latest ON user_state_version (user_id, version DESC);

-- 기존 단일 저장본(user_state)은 version 1로 옮기고, 이전 테이블은 없앤다.
INSERT INTO user_state_version (user_id, version, state, summary, created_at)
SELECT user_id, 1, state, '이전 저장본', updated_at FROM user_state;

DROP TABLE user_state;
