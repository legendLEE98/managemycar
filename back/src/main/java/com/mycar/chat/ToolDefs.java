package com.mycar.chat;

import com.mycar.state.ServiceCatalog;
import com.mycar.vehicle.BodyType;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;
import java.util.Map;

/** OpenAI function calling에 넘기는 도구 스키마. 실행은 StateTools가 한다. */
final class ToolDefs {
    private ToolDefs() {}

    private static final List<String> BODY_TYPES = Arrays.stream(BodyType.values()).map(BodyType::wire).toList();
    private static final String BODY_DESC = "차급(차체 유형). 차종을 보고 가장 가까운 차급을 고른다. "
            + Arrays.stream(BodyType.values()).map(BodyType::describe).collect(Collectors.joining(", "));
    private static final List<String> ITEMS = Arrays.stream(ServiceCatalog.values()).map(c -> c.tool).toList();
    private static final String ITEM_DESC = "소모품 항목. " + Arrays.stream(ServiceCatalog.values())
            .map(ServiceCatalog::describe).collect(Collectors.joining(", "));

    private static Map<String, Object> num(String d) { return Map.of("type", "number", "description", d); }
    private static Map<String, Object> integer(String d) { return Map.of("type", "integer", "description", d); }
    private static Map<String, Object> str(String d) { return Map.of("type", "string", "description", d); }
    private static Map<String, Object> pick(List<String> v, String d) {
        return Map.of("type", "string", "enum", v, "description", d);
    }

    private static Map<String, Object> fn(String name, String desc, Map<String, Object> props, List<String> required) {
        return Map.of("type", "function", "function", Map.of(
                "name", name,
                "description", desc,
                "parameters", Map.of("type", "object", "properties", props, "required", required)));
    }

    static final List<Map<String, Object>> ALL = List.of(
            fn("lookup_vehicle", "차종 이름이 실제로 있는 차종인지 카탈로그에서 확인한다. 사용자가 차종을 말하면 저장 전에 먼저 호출한다. "
                            + "결과의 status는 match(확정), candidates(후보), none(없음)이고, 후보와 확정 차종의 연료 목록(fuels)·생산 기간(from~to)을 돌려준다.",
                    Map.of("query", str("사용자가 말한 차종 이름. 제조사·연식이 붙어 있어도 된다(예: 현대 아이오닉 5)")),
                    List.of("query")),
            fn("set_vehicle", "사용자가 말한 내 차량 정보를 저장한다. 말한 항목만 채운다. 차종(model)은 카탈로그에서 확인된 경우에만 저장된다.",
                    Map.of(
                            "body_type", pick(BODY_TYPES, BODY_DESC),
                            "make", str("제조사"),
                            "model", str("차종 이름"),
                            "model_year", integer("연식"),
                            "fuel_type", pick(List.of("gasoline", "diesel", "lpg", "hybrid", "electric"), "연료"),
                            "unverified", Map.of("type", "boolean", "description",
                                    "카탈로그에 없는 차종이라고 안내했고, 사용자가 그대로 등록하겠다고 분명히 확인한 경우에만 true")),
                    List.of()),
            fn("log_trip", "운행한 거리를 현재 주행거리에 더한다. 덧셈은 도구가 하므로 직접 합산하지 않는다. "
                            + "km(총 주행거리)와 commute_days(출퇴근한 일수) 중 하나만 채운다.",
                    Map.of(
                            "km", num("이번에 주행한 거리(km). 여러 구간이면 사용자가 말한 총합"),
                            "commute_days", integer("저장된 출퇴근 하루 거리로 계산할 일수")),
                    List.of()),
            fn("log_fuel", "주유 사실을 기록한다. 평균 연비는 도구가 계산한다.",
                    Map.of(
                            "liters", num("주유량(L)"),
                            "cost_won", num("주유 금액(원)")),
                    List.of("liters")),
            fn("log_service", "사용자가 소모품·정비 항목을 **실제로 교체했다고 말했을 때만** 기록한다. 상태 조회·질문·점검 문의에는 절대 호출하지 않는다. "
                            + "교체 시점이 필요하다: 날짜(date)나 교체 당시 주행거리(km)를 말했거나, 방금·오늘 교체했다고 분명히 말해서 just_now=true일 때만 기록된다. "
                            + "과거 주행거리만 말하고 날짜를 모르면 date는 비워 둔다(오늘로 가정하지 말 것).",
                    Map.of(
                            "item", pick(ITEMS, ITEM_DESC),
                            "date", str("교체한 날짜 YYYY-MM-DD. 오늘 날짜는 시스템 메시지를 참고"),
                            "km", integer("교체 당시 주행거리(km)"),
                            "just_now", Map.of("type", "boolean", "description",
                                    "사용자가 '방금/오늘 교체했다'고 분명히 말했을 때만 true. 날짜·주행거리를 말했다면 쓰지 않는다")),
                    List.of("item")),
            fn("export_excel", "사용자가 엑셀(xlsx)·파일로 내보내기/다운로드를 요청했을 때 호출한다. 파일은 사용자의 브라우저에서 만들어지며, 호출하면 화면에 '엑셀 파일 받기' 버튼이 나타난다. 상태 조회나 기록에는 호출하지 않는다.",
                    Map.of("scope", pick(List.of("all", "current"), "all=등록한 모든 차량(기본값, 특별한 말이 없으면 이것). current=사용자가 '이 차'처럼 지금 선택한 한 대만 가리켰을 때만")),
                    List.of()),
            fn("set_odometer", "사용자가 말한 계기판 주행거리로 현재 주행거리를 설정한다.",
                    Map.of("km", integer("계기판에 표시된 주행거리(km)")),
                    List.of("km")),
            fn("set_commute", "하루 출퇴근 총 주행거리(왕복)를 저장한다. 사용자가 이 차로 출퇴근하지 않는다고 하면(소장용·주말용 등) 0으로 저장한다.",
                    Map.of("km_per_day", integer("하루 출퇴근 총 거리(km, 왕복 합계). 출퇴근을 하지 않으면 0")),
                    List.of("km_per_day")),
            fn("set_service_interval", "소모품 교체 주기를 사용자가 원하는 값으로 바꾼다.",
                    Map.of(
                            "item", pick(ITEMS, ITEM_DESC),
                            "interval_km", integer("교체 주기(km)"),
                            "interval_months", integer("교체 주기(개월)")),
                    List.of("item")));
}
