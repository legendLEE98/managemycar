package com.mycar.state;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.mycar.vehicle.BodyType;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * 차량의 현재 상태. 브라우저 localStorage에 JSON으로 저장되고, 요청마다 서버로 왔다가 갱신되어 돌아간다.
 * 클라이언트가 보낸 값은 신뢰하지 않으므로 {@link #sanitize()}로 항상 검증한다.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class CarState {
    public static final Set<String> FUEL_TYPES = Set.of("gasoline", "diesel", "lpg", "hybrid", "electric");
    static final int MAX_RECENT = 30;
    static final int MAX_KM = 3_000_000;

    public int version = 1;
    public Info vehicle = new Info();
    public Odometer odometer = new Odometer();
    public Commute commute = new Commute();
    public Fuel fuel = new Fuel();
    public Map<String, ServiceItem> services = new LinkedHashMap<>();
    public List<Event> recent = new ArrayList<>();
    public String updatedAt;

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Info {
        public String bodyType = "sedan";
        public String make;
        public String model;
        public Integer modelYear;
        public String fuelType;
        /** 차종 카탈로그 확인 여부: true=확인됨, false=사용자가 확인하고 등록한 미확인 차종, null=차종 없음 */
        public Boolean verified;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Odometer {
        public Integer km;
        public String source = "estimated"; // reported(계기판 실측) | estimated(추정)
        public String updatedAt;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Commute {
        /** 하루 출퇴근 총 거리(왕복, km). 0이면 출퇴근을 하지 않는 차량(소장용 등), null이면 아직 모름 */
        public Integer kmPerDay;
    }

    /** 평균 연비는 첫 주유 이후 구간만으로 계산한다: trackedKm / litersSinceStart */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Fuel {
        public double totalLiters;
        public long totalCost;
        public boolean started;
        public double litersSinceStart;
        public int trackedKm;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ServiceItem {
        public Integer lastKm;
        public String lastDate;
        public Integer intervalKm;
        public Integer intervalMonths;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Event {
        public String at;
        public String type;
        public String summary;
    }

    /**
     * 연료가 바뀌었을 때 항목을 맞춘다. 해당 없는 항목은 빼고, 빠진 항목은 기본 주기로 채우고,
     * 사용자가 바꾸지 않은 주기(이전 연료의 기본값 그대로)는 새 연료의 기본값으로 교체한다.
     */
    void reconcileServices(String prevFuel) {
        String fuel = vehicle.fuelType;
        for (ServiceCatalog c : ServiceCatalog.values()) {
            if (!c.applicable(fuel)) {
                services.remove(c.key);
                continue;
            }
            ServiceItem it = services.get(c.key);
            if (it == null) {
                services.put(c.key, c.newItem(fuel));
            } else if (java.util.Objects.equals(it.intervalKm, c.kmFor(prevFuel))
                    && java.util.Objects.equals(it.intervalMonths, c.monthsFor(prevFuel))) {
                it.intervalKm = c.kmFor(fuel);
                it.intervalMonths = c.monthsFor(fuel);
            }
        }
    }

    public CarState sanitize() {
        version = 1;
        if (vehicle == null) vehicle = new Info();
        BodyType bt = BodyType.fromWire(vehicle.bodyType);
        vehicle.bodyType = bt != null ? bt.wire() : "sedan";
        vehicle.make = clip(vehicle.make, 50);
        vehicle.model = clip(vehicle.model, 80);
        vehicle.modelYear = range(vehicle.modelYear, 1980, 2100);
        if (vehicle.make == null && vehicle.model == null) vehicle.verified = null;
        vehicle.fuelType = vehicle.fuelType != null && FUEL_TYPES.contains(vehicle.fuelType.toLowerCase())
                ? vehicle.fuelType.toLowerCase() : null;

        if (odometer == null) odometer = new Odometer();
        odometer.km = range(odometer.km, 0, MAX_KM);
        odometer.source = "reported".equals(odometer.source) ? "reported" : "estimated";
        odometer.updatedAt = date(odometer.updatedAt);

        if (commute == null) commute = new Commute();
        commute.kmPerDay = range(commute.kmPerDay, 0, 500); // 0 = 출퇴근 안 함

        if (fuel == null) fuel = new Fuel();
        fuel.totalLiters = Math.max(0, Math.min(fuel.totalLiters, 1_000_000));
        fuel.totalCost = Math.max(0, Math.min(fuel.totalCost, 1_000_000_000L));
        fuel.litersSinceStart = Math.max(0, Math.min(fuel.litersSinceStart, 1_000_000));
        fuel.trackedKm = Math.max(0, Math.min(fuel.trackedKm, MAX_KM));

        Map<String, ServiceItem> clean = new LinkedHashMap<>();
        for (ServiceCatalog c : ServiceCatalog.values()) {
            if (!c.applicable(vehicle.fuelType)) continue;
            ServiceItem s = services == null ? null : services.get(c.key);
            if (s == null) s = c.newItem(vehicle.fuelType);
            s.lastKm = range(s.lastKm, 0, MAX_KM);
            s.lastDate = date(s.lastDate);
            s.intervalKm = range(s.intervalKm, 100, 1_000_000);
            s.intervalMonths = range(s.intervalMonths, 1, 240);
            clean.put(c.key, s);
        }
        services = clean;

        List<Event> ev = new ArrayList<>();
        if (recent != null) {
            for (Event e : recent) {
                if (e == null) continue;
                e.at = date(e.at);
                e.type = clip(e.type, 20);
                e.summary = clip(e.summary, 120);
                if (e.summary != null) ev.add(e);
            }
        }
        recent = ev.size() > MAX_RECENT ? new ArrayList<>(ev.subList(ev.size() - MAX_RECENT, ev.size())) : ev;
        updatedAt = clip(updatedAt, 40);
        return this;
    }

    void addEvent(LocalDate today, String type, String summary) {
        Event e = new Event();
        e.at = today.toString();
        e.type = type;
        e.summary = summary;
        recent.add(e);
        while (recent.size() > MAX_RECENT) recent.remove(0);
    }

    static Integer range(Integer v, int lo, int hi) {
        return v != null && v >= lo && v <= hi ? v : null;
    }

    static String clip(String s, int max) {
        if (s == null || s.isBlank()) return null;
        String t = s.trim();
        return t.length() > max ? t.substring(0, max) : t;
    }

    static String date(String s) {
        if (s == null) return null;
        try {
            return LocalDate.parse(s.length() > 10 ? s.substring(0, 10) : s).toString();
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    @Override
    public boolean equals(Object o) {
        return o instanceof CarState c && Objects.equals(updatedAt, c.updatedAt);
    }

    @Override
    public int hashCode() {
        return Objects.hash(updatedAt);
    }
}
