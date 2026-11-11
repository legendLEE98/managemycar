package com.mycar.chat;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 채팅 요청·응답 기록. 기록에 실패해도 대화는 정상으로 이어지도록 예외를 삼킨다.
 * 보관 일수(mycar.chat.log.days)가 0이면 기록하지 않고, 지나면 매일 새벽 자동 삭제한다.
 */
@Component
public class ChatLog {
    private static final Logger log = LoggerFactory.getLogger(ChatLog.class);
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final int days;

    public ChatLog(JdbcTemplate jdbc, ObjectMapper mapper, @Value("${mycar.chat.log.days:90}") int days) {
        this.jdbc = jdbc;
        this.mapper = mapper;
        this.days = Math.max(0, days);
    }

    public void ok(Long userId, String ip, String request, String response, List<String> changes, long ms) {
        save(userId, ip, request, response, changes, "ok", null, ms);
    }

    public void error(Long userId, String ip, String request, String error, long ms) {
        save(userId, ip, request, null, null, "error", error, ms);
    }

    private void save(Long userId, String ip, String request, String response, List<String> changes,
                      String status, String error, long ms) {
        if (days == 0) return;
        try {
            String changesJson = changes == null || changes.isEmpty() ? null : mapper.writeValueAsString(changes);
            jdbc.update("""
                    INSERT INTO chat_log (user_id, ip, request, response, changes, status, error, duration_ms)
                    VALUES (?, ?, ?, ?, ?::jsonb, ?, ?, ?)
                    """, userId, clip(ip, 45), request, response, changesJson, status, clip(error, 300), (int) Math.min(ms, Integer.MAX_VALUE));
        } catch (Exception e) {
            log.warn("채팅 기록 저장 실패(대화에는 영향 없음): {}", e.toString());
        }
    }

    private static String clip(String s, int max) {
        return s == null ? null : s.length() > max ? s.substring(0, max) : s;
    }

    @Scheduled(cron = "0 20 3 * * *", zone = "Asia/Seoul")
    public void cleanup() {
        if (days == 0) return;
        int n = jdbc.update("DELETE FROM chat_log WHERE created_at < now() - make_interval(days => ?)", days);
        if (n > 0) log.info("오래된 채팅 기록 {}건 삭제", n);
    }
}
