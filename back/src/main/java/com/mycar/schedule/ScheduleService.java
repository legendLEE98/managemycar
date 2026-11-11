package com.mycar.schedule;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 로그인 사용자의 캘린더 일정. 차량 상태(JSON)와 분리해서 schedule 테이블에 한 건씩 저장한다. */
@Service
public class ScheduleService {
    public static final int MAX_PER_VEHICLE = 200;
    static final int MAX_PER_USER = 1000;
    static final int MAX_TITLE = 60;
    private static final Pattern ID = Pattern.compile("[A-Za-z0-9_-]{1,40}");

    public record Item(String id, String vehicleId, String date, String title) {}

    /** 입력: id는 비워 두면 서버가 만든다(채팅·게스트 병합처럼 이미 id가 있는 경우만 채운다). */
    public record Input(String id, String vehicleId, String date, String title) {}

    private final JdbcTemplate jdbc;

    public ScheduleService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public List<Item> list(long userId) {
        return jdbc.query("""
                SELECT id, vehicle_id, to_char(date, 'YYYY-MM-DD'), title FROM schedule
                WHERE user_id = ? ORDER BY date, created_at, id
                """, (rs, i) -> new Item(rs.getString(1), rs.getString(2), rs.getString(3), rs.getString(4)), userId);
    }

    /**
     * 일정을 한 건 추가한다. 같은 id가 이미 있으면(재시도) 그대로 두고, 같은 차량·날짜·제목이 이미 있으면 새로 만들지 않는다.
     * 입력이 올바르지 않거나 한도를 넘으면 IllegalArgumentException.
     */
    @Transactional
    public Item add(long userId, Input in) {
        Item clean = clean(in);
        // 같은 사용자의 동시 요청이 한도를 넘기지 않게 직렬화한다.
        jdbc.query("SELECT pg_advisory_xact_lock(?)", ps -> ps.setLong(1, userId), rs -> {});

        List<Item> same = jdbc.query("""
                SELECT id, vehicle_id, to_char(date, 'YYYY-MM-DD'), title FROM schedule
                WHERE user_id = ? AND (id = ? OR (vehicle_id = ? AND date = ?::date AND title = ?))
                """, (rs, i) -> new Item(rs.getString(1), rs.getString(2), rs.getString(3), rs.getString(4)),
                userId, clean.id(), clean.vehicleId(), clean.date(), clean.title());
        if (!same.isEmpty()) return same.get(0);

        int vehicleCount = count("SELECT count(*) FROM schedule WHERE user_id = ? AND vehicle_id = ?", userId, clean.vehicleId());
        if (vehicleCount >= MAX_PER_VEHICLE) throw new IllegalArgumentException("일정이 너무 많아요. 지난 일정을 삭제해 주세요.");
        if (count("SELECT count(*) FROM schedule WHERE user_id = ?", userId) >= MAX_PER_USER) {
            throw new IllegalArgumentException("일정이 너무 많아요. 지난 일정을 삭제해 주세요.");
        }
        jdbc.update("INSERT INTO schedule (id, user_id, vehicle_id, date, title) VALUES (?, ?, ?, ?::date, ?)",
                clean.id(), userId, clean.vehicleId(), clean.date(), clean.title());
        return clean;
    }

    /** 이 브라우저(게스트)에 있던 일정을 계정으로 옮긴다. 올바르지 않거나 한도를 넘는 건은 건너뛰고, 저장된 건수를 돌려준다. */
    @Transactional
    public int addAll(long userId, List<Input> inputs) {
        int saved = 0;
        for (Input in : inputs) {
            try {
                add(userId, in);
                saved++;
            } catch (IllegalArgumentException skip) {
                // 건너뜀
            }
        }
        return saved;
    }

    @Transactional
    public boolean remove(long userId, String id) {
        return jdbc.update("DELETE FROM schedule WHERE user_id = ? AND id = ?", userId, id) > 0;
    }

    /**
     * 차고에서 지워진 차량의 일정을 정리한다. 방금 만든 일정은 차량 저장보다 먼저 도착할 수 있어서 남겨 둔다.
     */
    @Transactional
    public void removeOrphans(long userId, Collection<String> vehicleIds) {
        jdbc.update("""
                DELETE FROM schedule WHERE user_id = ? AND vehicle_id <> ALL(?::text[])
                AND created_at < now() - interval '2 minutes'
                """, ps -> {
            ps.setLong(1, userId);
            ps.setArray(2, ps.getConnection().createArrayOf("text", vehicleIds.toArray()));
        });
    }

    private int count(String sql, Object... args) {
        Integer n = jdbc.queryForObject(sql, Integer.class, args);
        return n == null ? 0 : n;
    }

    private static Item clean(Input in) {
        if (in == null) throw new IllegalArgumentException("일정 내용이 없어요.");
        String vehicleId = in.vehicleId() == null ? "" : in.vehicleId().trim();
        if (vehicleId.isEmpty() || vehicleId.length() > 60) throw new IllegalArgumentException("차량을 알 수 없어요.");
        String title = in.title() == null ? "" : in.title().trim();
        if (title.isEmpty()) throw new IllegalArgumentException("일정 제목을 입력해 주세요.");
        if (title.length() > MAX_TITLE) title = title.substring(0, MAX_TITLE);
        String date;
        try {
            date = LocalDate.parse(in.date() == null ? "" : in.date().trim()).toString();
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("날짜 형식이 올바르지 않아요.");
        }
        String id = in.id() == null ? "" : in.id().trim();
        if (id.isEmpty()) id = UUID.randomUUID().toString().substring(0, 8);
        else if (!ID.matcher(id).matches()) throw new IllegalArgumentException("일정 id가 올바르지 않아요.");
        return new Item(id, vehicleId, date, title);
    }
}
