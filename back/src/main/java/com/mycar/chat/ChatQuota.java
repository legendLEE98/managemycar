package com.mycar.chat;

import java.sql.Date;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * 채팅 일일 사용량 한도. 로그인 사용자는 계정, 게스트는 접속 IP 기준이고, 한국 시간 0시에 새로 시작한다.
 * DB에 저장하므로 서버를 재시작해도 유지된다. 증가는 DB에서 한 번에(원자적으로) 처리해 동시에 보내도 한도를 넘지 않는다.
 */
@Service
public class ChatQuota {
    public static final ZoneId KST = ZoneId.of("Asia/Seoul");

    private final JdbcTemplate jdbc;
    private final int userLimit;
    private final int guestLimit;

    public ChatQuota(JdbcTemplate jdbc,
                     @Value("${mycar.chat.limit.daily-user:60}") int userLimit,
                     @Value("${mycar.chat.limit.daily-guest:20}") int guestLimit) {
        this.jdbc = jdbc;
        this.userLimit = userLimit;
        this.guestLimit = guestLimit;
    }

    public static LocalDate today() {
        return LocalDate.now(KST);
    }

    public int limitFor(boolean loggedIn) {
        return loggedIn ? userLimit : guestLimit;
    }

    /** 한도 안이면 사용 횟수를 1 늘리고 늘어난 값을, 이미 한도에 도달했으면 -1을 돌려준다. */
    public int consume(String subject, int limit) {
        List<Integer> r = jdbc.query("""
                INSERT INTO chat_usage (subject, day, used) VALUES (?, ?, 1)
                ON CONFLICT (subject, day) DO UPDATE SET used = chat_usage.used + 1 WHERE chat_usage.used < ?
                RETURNING used
                """, (rs, i) -> rs.getInt(1), subject, Date.valueOf(today()), limit);
        return r.isEmpty() ? -1 : r.get(0);
    }

    /** 오늘 사용한 횟수 */
    public int used(String subject) {
        List<Integer> r = jdbc.query("SELECT used FROM chat_usage WHERE subject = ? AND day = ?",
                (rs, i) -> rs.getInt(1), subject, Date.valueOf(today()));
        return r.isEmpty() ? 0 : r.get(0);
    }

    /** AI 호출이 실패했을 때 한 번 되돌려 준다(사용자 잘못이 아니므로). */
    public void refund(String subject) {
        jdbc.update("UPDATE chat_usage SET used = GREATEST(used - 1, 0) WHERE subject = ? AND day = ?",
                subject, Date.valueOf(today()));
    }

    /** 지난 기록은 일주일만 남긴다. */
    @Scheduled(cron = "0 10 3 * * *", zone = "Asia/Seoul")
    public void cleanup() {
        jdbc.update("DELETE FROM chat_usage WHERE day < ?", Date.valueOf(today().minusDays(7)));
    }
}
