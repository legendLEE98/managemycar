package com.mycar.user;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.mycar.state.CarState;
import com.mycar.state.Garage;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 계정별 차고(여러 대의 차량 상태)를 버전(스냅샷)으로 저장한다. 저장할 때마다 (user_id, version)이 유니크한 새 행이 생기고,
 * 직전 버전과 내용이 같으면(수정 시각 제외) 새로 만들지 않는다. 값은 항상 서버에서 검증(sanitize)한 뒤 저장한다.
 * 예전에 저장된 형식(차량 1대의 상태)도 읽을 수 있고, 읽을 때 차량 1대짜리 차고로 바꿔 준다.
 */
@Service
public class UserStateService {
    /** 사용자당 보관하는 최대 버전 수. 넘으면 오래된 것부터 지운다. */
    static final int MAX_VERSIONS = 500;

    public record Snapshot(int version, Garage state, OffsetDateTime createdAt) {}

    public record VersionInfo(int version, String summary, OffsetDateTime createdAt) {}

    public record SaveResult(int version, boolean changed) {}

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public UserStateService(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    /** 요청 본문을 차고로 바꾼다. 차고 형식(vehicles 포함)이 아니면 예전 형식으로 보고 감싼다. */
    public Garage fromJson(JsonNode n) {
        try {
            if (n != null && n.has("vehicles")) return mapper.treeToValue(n, Garage.class).sanitize();
            return Garage.single(mapper.treeToValue(n == null ? mapper.createObjectNode() : n, CarState.class));
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("저장 형식이 올바르지 않습니다.", e);
        }
    }

    @Transactional(readOnly = true)
    public Optional<Snapshot> latest(long userId) {
        return jdbc.query("""
                SELECT version, state::text, created_at FROM user_state_version
                WHERE user_id = ? ORDER BY version DESC LIMIT 1
                """, (rs, i) -> toSnapshot(rs.getInt(1), rs.getString(2), rs.getObject(3, OffsetDateTime.class)), userId)
                .stream().findFirst();
    }

    @Transactional(readOnly = true)
    public Optional<Snapshot> get(long userId, int version) {
        return jdbc.query("""
                SELECT version, state::text, created_at FROM user_state_version
                WHERE user_id = ? AND version = ?
                """, (rs, i) -> toSnapshot(rs.getInt(1), rs.getString(2), rs.getObject(3, OffsetDateTime.class)), userId, version)
                .stream().findFirst();
    }

    @Transactional(readOnly = true)
    public List<VersionInfo> list(long userId, int limit) {
        return jdbc.query("""
                SELECT version, summary, created_at FROM user_state_version
                WHERE user_id = ? ORDER BY version DESC LIMIT ?
                """, (rs, i) -> new VersionInfo(rs.getInt(1), rs.getString(2), rs.getObject(3, OffsetDateTime.class)),
                userId, limit);
    }

    /** 내용이 바뀌었을 때만 새 버전을 만든다. */
    @Transactional
    public SaveResult save(long userId, Garage incoming, String summaryOverride) {
        Garage garage = incoming.sanitize();
        // 같은 사용자의 동시 저장이 version을 겹치지 않게 직렬화한다.
        jdbc.query("SELECT pg_advisory_xact_lock(?)", ps -> ps.setLong(1, userId), rs -> {});

        Optional<Snapshot> latest = latest(userId);
        if (latest.isPresent() && sameContent(latest.get().state(), garage)) {
            return new SaveResult(latest.get().version(), false);
        }
        int next = latest.map(s -> s.version() + 1).orElse(1);
        jdbc.update("""
                INSERT INTO user_state_version (user_id, version, state, summary)
                VALUES (?, ?, ?::jsonb, ?)
                """, userId, next, toJson(garage), summaryOverride != null ? summaryOverride : summaryOf(garage));
        jdbc.update("DELETE FROM user_state_version WHERE user_id = ? AND version <= ?", userId, next - MAX_VERSIONS);
        return new SaveResult(next, true);
    }

    /** 지난 버전의 내용으로 되돌린다. 기존 이력은 지우지 않고 새 버전으로 쌓는다. */
    @Transactional
    public Optional<Snapshot> restore(long userId, int version) {
        Optional<Snapshot> old = get(userId, version);
        if (old.isEmpty()) return Optional.empty();
        save(userId, old.get().state(), "버전 " + version + "(으)로 복원");
        return latest(userId);
    }

    // ---- 내부 ----

    private Snapshot toSnapshot(int version, String json, OffsetDateTime createdAt) {
        try {
            return new Snapshot(version, fromJson(mapper.readTree(json)), createdAt);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("저장된 상태를 읽지 못했습니다.", e);
        }
    }

    private String toJson(Garage garage) {
        try {
            return mapper.writeValueAsString(garage);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    /** 수정 시각(updatedAt)만 다른 경우는 같은 내용으로 본다. */
    private boolean sameContent(Garage a, Garage b) {
        return withoutTimestamps(a).equals(withoutTimestamps(b));
    }

    private JsonNode withoutTimestamps(Garage g) {
        ObjectNode n = mapper.valueToTree(g);
        n.findParents("updatedAt").forEach(p -> ((ObjectNode) p).remove("updatedAt"));
        return n;
    }

    /** 이력 목록에 보여 줄 요약: 선택된 차량의 가장 최근 변경 내용(차량이 여러 대면 이름을 앞에 붙인다) */
    private static String summaryOf(Garage g) {
        Garage.Entry active = g.active();
        CarState s = active.state;
        String text = "상태 저장";
        if (s.recent != null && !s.recent.isEmpty()) {
            String t = s.recent.get(s.recent.size() - 1).summary;
            if (t != null && !t.isBlank()) text = t;
        }
        if (g.vehicles.size() > 1) {
            String name = (nz(s.vehicle.make) + " " + nz(s.vehicle.model)).trim();
            text = "[" + (name.isEmpty() ? "새 차량" : name) + "] " + text;
        }
        return text.length() > 200 ? text.substring(0, 200) : text;
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }
}
