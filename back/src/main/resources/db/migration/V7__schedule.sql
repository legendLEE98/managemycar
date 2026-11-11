-- 캘린더 일정을 차량 상태 JSON에서 분리해 별도 테이블로 둔다. 사용하지 않는 vehicle 테이블은 삭제한다.
CREATE TABLE schedule (
    id         VARCHAR(40)  NOT NULL,
    user_id    BIGINT       NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    vehicle_id VARCHAR(60)  NOT NULL,  -- 차고(JSON)의 차량 id
    date       DATE         NOT NULL,
    title      VARCHAR(60)  NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, id)
);
CREATE INDEX ix_schedule_user_vehicle ON schedule (user_id, vehicle_id, date);
CREATE INDEX ix_schedule_date ON schedule (date);

-- 기존 데이터 이전: 사용자별 최신 저장본에 들어 있는 일정을 옮긴다.
INSERT INTO schedule (id, user_id, vehicle_id, date, title)
SELECT DISTINCT ON (v.user_id, s->>'id')
       left(s->>'id', 40), v.user_id, left(veh->>'id', 60), (s->>'date')::date, left(s->>'title', 60)
FROM user_state_version v
JOIN (SELECT user_id, max(version) AS mv FROM user_state_version GROUP BY user_id) m
  ON m.user_id = v.user_id AND m.mv = v.version
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(v.state->'vehicles', '[]'::jsonb)) AS veh
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(veh->'state'->'schedules', '[]'::jsonb)) AS s
WHERE s->>'id' IS NOT NULL AND s->>'date' ~ '^\d{4}-\d{2}-\d{2}$' AND coalesce(s->>'title', '') <> ''
ON CONFLICT DO NOTHING;

DROP TABLE vehicle;
