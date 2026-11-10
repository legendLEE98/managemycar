package com.mycar.chat;

import java.util.ArrayDeque;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * 채팅 요청이 너무 빠르게 반복되는 것을 막는다(최근 60초 안에 보낸 횟수 기준).
 * 대상은 로그인 사용자는 계정, 게스트는 접속 IP다. 서버 메모리 기준이라 재시작하면 초기화된다.
 * (하루 한도처럼 오래 가는 제한은 DB에 저장해야 하며 여기서는 다루지 않는다.)
 */
@Component
public class ChatRateLimiter {
    private static final long WINDOW_MS = 60_000;
    private static final int PRUNE_THRESHOLD = 5_000;

    private final int perMinute;
    private final ConcurrentHashMap<String, ArrayDeque<Long>> hits = new ConcurrentHashMap<>();

    public ChatRateLimiter(@Value("${mycar.chat.limit.per-minute:6}") int perMinute) {
        this.perMinute = perMinute;
    }

    /** 허용되면 0, 막히면 다시 보낼 수 있을 때까지 남은 초(최소 1) */
    public long acquire(String key) {
        long now = System.currentTimeMillis();
        if (hits.size() > PRUNE_THRESHOLD) prune(now);
        ArrayDeque<Long> times = hits.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (times) {
            while (!times.isEmpty() && times.peekFirst() <= now - WINDOW_MS) times.pollFirst();
            if (times.size() >= perMinute) {
                long waitMs = times.peekFirst() + WINDOW_MS - now;
                return Math.max(1, (waitMs + 999) / 1000);
            }
            times.addLast(now);
            return 0;
        }
    }

    public int perMinute() {
        return perMinute;
    }

    private void prune(long now) {
        hits.entrySet().removeIf(e -> {
            synchronized (e.getValue()) {
                return e.getValue().isEmpty() || e.getValue().peekLast() <= now - WINDOW_MS;
            }
        });
    }
}
