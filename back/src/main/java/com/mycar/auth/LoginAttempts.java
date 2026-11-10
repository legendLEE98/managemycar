package com.mycar.auth;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

/** 로그인 실패가 반복되면 잠시 막는다. (서버 메모리 기준이라 재시작하면 초기화된다) */
@Component
public class LoginAttempts {
    private static final int MAX_FAILS = 5;
    private static final Duration WINDOW = Duration.ofMinutes(10);

    private record Entry(int fails, Instant first) {}

    private final ConcurrentHashMap<String, Entry> map = new ConcurrentHashMap<>();

    public boolean blocked(String key) {
        Entry e = map.get(key);
        if (e == null) return false;
        if (e.first().plus(WINDOW).isBefore(Instant.now())) {
            map.remove(key);
            return false;
        }
        return e.fails() >= MAX_FAILS;
    }

    public void fail(String key) {
        map.merge(key, new Entry(1, Instant.now()), (old, n) ->
                old.first().plus(WINDOW).isBefore(Instant.now()) ? n : new Entry(old.fails() + 1, old.first()));
        if (map.size() > 10_000) map.entrySet().removeIf(en -> en.getValue().first().plus(WINDOW).isBefore(Instant.now()));
    }

    public void reset(String key) {
        map.remove(key);
    }
}
