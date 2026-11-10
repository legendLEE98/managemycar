-- 채팅 일일 사용량. subject는 로그인 사용자 'u:<id>' 또는 게스트 'ip:<주소>', day는 한국 시간 기준 날짜.
CREATE TABLE chat_usage (
    subject VARCHAR(80) NOT NULL,
    day     DATE        NOT NULL,
    used    INT         NOT NULL DEFAULT 0,
    PRIMARY KEY (subject, day)
);
