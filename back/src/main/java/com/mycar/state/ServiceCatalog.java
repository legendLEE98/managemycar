package com.mycar.state;

import java.util.Arrays;
import java.util.Map;
import java.util.Set;

/**
 * 관리하는 소모품 목록과 일반 기준 기본 주기. 차종·사용 환경에 따라 다르므로 사용자가 바꿀 수 있다.
 * 프론트(front/src/services.ts)의 항목 키·주기와 같아야 한다.
 */
public enum ServiceCatalog {
    // 0 ~ 2만km
    AIR_FILTER("airFilter", "air_filter", "에어컨 필터", 15_000, 12),
    WIPER("wiper", "wiper", "와이퍼", null, 12),
    TIRE_ROTATION("tireRotation", "tire_rotation", "타이어 위치교정", 10_000, null),
    ENGINE_OIL("engineOil", "engine_oil", "엔진오일·오일필터", 10_000, 12, "electric"),
    // 2 ~ 5만km
    AIR_CLEANER("airCleaner", "air_cleaner", "에어클리너 필터", 30_000, null, "electric"),
    BRAKE_PAD("brakePad", "brake_pad", "브레이크 패드(앞)", 40_000, null),
    BRAKE_FLUID("brakeFluid", "brake_fluid", "브레이크 오일", 40_000, 24),
    // 5 ~ 10만km
    BATTERY("battery", "battery", "배터리", null, 48),
    TIRE("tire", "tire", "타이어", 50_000, null),
    BRAKE_PAD_REAR("brakePadRear", "brake_pad_rear", "브레이크 패드(뒤)", 70_000, null),
    // 10만km 이상
    COOLANT("coolant", "coolant", "엔진 부동액", 100_000, null),
    TRANSMISSION_OIL("transmissionOil", "transmission_oil", "미션오일", 100_000, null),
    OUTER_BELT("outerBelt", "outer_belt", "외부벨트", 100_000, null, "electric"),
    TIMING_BELT("timingBelt", "timing_belt", "타이밍벨트", 100_000, null, "electric"),
    BRAKE_DISC_FRONT("brakeDiscFront", "brake_disc_front", "브레이크 디스크(앞)", 100_000, null),
    BRAKE_DISC_REAR("brakeDiscRear", "brake_disc_rear", "브레이크 디스크(뒤)", 100_000, null),
    SPARK_PLUG("sparkPlug", "spark_plug", "점화 플러그", 100_000, null, "electric", "diesel"),
    // 전기차 전용
    GENERAL_COOLANT("generalCoolant", "general_coolant", "일반 냉각수", 200_000, 60,
            "gasoline", "diesel", "lpg", "hybrid");

    /** 전기차일 때 바뀌는 이름·주기. null이면 기본값을 쓴다. */
    public record Variant(String label, Integer intervalKm, Integer intervalMonths) {}

    // 전기차는 회생제동으로 패드 마모가 적고, 엔진 부동액·미션오일 대신 배터리 냉각수·감속기 오일을 관리한다.
    private static final Map<ServiceCatalog, Variant> ELECTRIC = Map.of(
            COOLANT, new Variant("배터리 냉각수(부동액)", 60_000, 36),
            TRANSMISSION_OIL, new Variant("감속기 오일", 120_000, null),
            BRAKE_PAD, new Variant(null, 80_000, null),
            BRAKE_PAD_REAR, new Variant(null, 100_000, null));

    public final String key;
    public final String tool;
    public final String label;
    public final Integer intervalKm;
    public final Integer intervalMonths;
    private final Set<String> excludedFuels;

    ServiceCatalog(String key, String tool, String label, Integer intervalKm, Integer intervalMonths,
                   String... excludedFuels) {
        this.key = key;
        this.tool = tool;
        this.label = label;
        this.intervalKm = intervalKm;
        this.intervalMonths = intervalMonths;
        this.excludedFuels = Set.of(excludedFuels);
    }

    /** 연료를 모르면 전기차 전용 항목을 뺀 나머지를 모두 포함한다. */
    public boolean applicable(String fuelType) {
        if (fuelType == null) return this != GENERAL_COOLANT;
        return !excludedFuels.contains(fuelType);
    }

    private Variant variant(String fuelType) {
        return "electric".equals(fuelType) ? ELECTRIC.get(this) : null;
    }

    public String labelFor(String fuelType) {
        Variant v = variant(fuelType);
        return v != null && v.label() != null ? v.label() : label;
    }

    public Integer kmFor(String fuelType) {
        Variant v = variant(fuelType);
        return v != null && v.intervalKm() != null ? v.intervalKm() : intervalKm;
    }

    public Integer monthsFor(String fuelType) {
        Variant v = variant(fuelType);
        return v != null && (v.intervalKm() != null || v.intervalMonths() != null) ? v.intervalMonths() : intervalMonths;
    }

    /** 도구 설명용: 전기차에서 이름이 다르면 함께 표기 */
    public String describe() {
        Variant v = ELECTRIC.get(this);
        String ev = v != null && v.label() != null ? "(전기차는 " + v.label() + ")" : "";
        return label + ev + "=" + tool;
    }

    public CarState.ServiceItem newItem(String fuelType) {
        CarState.ServiceItem s = new CarState.ServiceItem();
        s.intervalKm = kmFor(fuelType);
        s.intervalMonths = monthsFor(fuelType);
        return s;
    }

    public static ServiceCatalog byTool(String tool) {
        return Arrays.stream(values()).filter(c -> c.tool.equals(tool)).findFirst().orElse(null);
    }
}
