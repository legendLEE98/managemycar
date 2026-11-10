package com.mycar.state;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * 내 차고: 여러 대의 차량 상태와 현재 선택된 차량. 브라우저 localStorage와 계정 저장본이 같은 JSON을 쓴다.
 * 채팅은 선택된 차량 1대의 {@link CarState}만 주고받는다.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class Garage {
    public static final int MAX_VEHICLES = 5;

    public String activeId;
    public List<Entry> vehicles = new ArrayList<>();

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Entry {
        public String id;
        public CarState state = new CarState();
    }

    /** 예전 형식(차량 1대의 상태)을 차량 1대짜리 차고로 감싼다. */
    public static Garage single(CarState state) {
        Garage g = new Garage();
        Entry e = new Entry();
        e.id = UUID.randomUUID().toString();
        e.state = state;
        g.vehicles.add(e);
        g.activeId = e.id;
        return g.sanitize();
    }

    /** 클라이언트가 보낸 값은 신뢰하지 않으므로 항상 검증한다. */
    public Garage sanitize() {
        List<Entry> clean = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        if (vehicles != null) {
            for (Entry e : vehicles) {
                if (e == null || clean.size() >= MAX_VEHICLES) continue;
                String id = e.id == null ? "" : e.id.trim();
                if (id.isEmpty() || id.length() > 60 || !seen.add(id)) {
                    id = UUID.randomUUID().toString();
                    seen.add(id);
                }
                Entry n = new Entry();
                n.id = id;
                n.state = (e.state == null ? new CarState() : e.state).sanitize();
                clean.add(n);
            }
        }
        if (clean.isEmpty()) {
            Entry n = new Entry();
            n.id = UUID.randomUUID().toString();
            n.state = new CarState().sanitize();
            clean.add(n);
        }
        vehicles = clean;
        String active = activeId;
        activeId = clean.stream().anyMatch(v -> v.id.equals(active)) ? active : clean.get(0).id;
        return this;
    }

    public Entry active() {
        return vehicles.stream().filter(v -> v.id.equals(activeId)).findFirst().orElse(vehicles.get(0));
    }
}
