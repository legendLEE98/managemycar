CREATE TABLE vehicle (
    id          BIGINT PRIMARY KEY,
    body_type   VARCHAR(20) NOT NULL DEFAULT 'SEDAN',
    make        VARCHAR(50),
    model       VARCHAR(80),
    model_year  INT,
    fuel_type   VARCHAR(20),
    odometer_km INT,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 인증 도입 전까지는 차량 1대(id=1)만 사용한다.
INSERT INTO vehicle (id, body_type) VALUES (1, 'SEDAN');
