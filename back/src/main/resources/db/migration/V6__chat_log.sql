-- 채팅 요청/응답 기록. 오류 확인·품질 개선·남용 방지용이며 보관 기간이 지나면 자동 삭제한다.
CREATE TABLE chat_log (
    id          BIGSERIAL PRIMARY KEY,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    user_id     BIGINT       REFERENCES app_user (id) ON DELETE CASCADE, -- 비로그인이면 NULL
    ip          VARCHAR(45),
    request     TEXT         NOT NULL,   -- 이번에 사용자가 보낸 메시지(마지막 user 메시지)
    response    TEXT,                    -- AI 답변(실패하면 NULL)
    changes     JSONB,                   -- 이번 요청에서 코드가 실제로 적용한 변경 내용
    status      VARCHAR(10)  NOT NULL,   -- ok | error
    error       VARCHAR(300),
    duration_ms INT
);
CREATE INDEX ix_chat_log_created_at ON chat_log (created_at);
CREATE INDEX ix_chat_log_user ON chat_log (user_id, created_at DESC);
