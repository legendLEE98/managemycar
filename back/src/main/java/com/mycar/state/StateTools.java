package com.mycar.state;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mycar.vehicle.BodyType;
import com.mycar.vehicle.VehicleCatalog;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** AI가 호출하는 도구들. 숫자 계산과 검증은 전부 여기서 코드로 처리한다. */
public final class StateTools {
    private StateTools() {}

    /**
     * message: 화면에 보여 줄 변경 내용(show=true일 때만). hint: AI에게만 주는 보조 정보.
     */
    public record Result(boolean ok, String message, boolean show, String hint) {
        static Result success(String m) { return new Result(true, m, true, null); }
        static Result success(String m, String hint) { return new Result(true, m, true, hint); }
        static Result failure(String m) { return new Result(false, m, false, null); }
        static Result failure(String m, String hint) { return new Result(false, m, false, hint); }
        /** 조회 결과처럼 상태를 바꾸지 않고 AI에게 정보만 주는 경우 */
        static Result info(String data) { return new Result(true, "", false, data); }
    }


    private static final int MAX_TRIP_KM = 2000;

    public static Result execute(String name, JsonNode a, CarState s, LocalDate today, VehicleCatalog catalog,
                                 ObjectMapper mapper) {
        return switch (name) {
            case "lookup_vehicle" -> lookupVehicle(a, catalog, mapper);
            case "set_vehicle" -> setVehicle(a, s, today, catalog);
            case "log_trip" -> logTrip(a, s, today);
            case "log_fuel" -> logFuel(a, s, today);
            case "log_service" -> logService(a, s, today);
            case "set_odometer" -> setOdometer(a, s, today);
            case "set_commute" -> setCommute(a, s, today);
            case "set_service_interval" -> setInterval(a, s, today);
            case "add_schedule" -> addSchedule(a, s, today);
            default -> Result.failure("알 수 없는 도구입니다.");
        };
    }

    // ---- 도구 구현 ----

    private static Result lookupVehicle(JsonNode a, VehicleCatalog catalog, ObjectMapper mapper) {
        String q = text(a, "query");
        if (q == null) return Result.failure("조회할 차종 이름이 없습니다.");
        try {
            return Result.info(mapper.writeValueAsString(catalog.search(q)));
        } catch (Exception e) {
            return Result.failure("차종 조회에 실패했습니다.");
        }
    }

    private static Result setVehicle(JsonNode a, CarState s, LocalDate today, VehicleCatalog catalog) {
        List<String> parts = new ArrayList<>();
        List<String> hints = new ArrayList<>();

        String make = CarState.clip(text(a, "make"), 50);
        String model = CarState.clip(text(a, "model"), 80);
        BodyType bt = BodyType.fromWire(text(a, "body_type"));
        Integer fromYear = null;
        Integer toYear = null;
        Boolean verified = null;

        if (model != null) {
            VehicleCatalog.Result r = catalog.search((make != null ? make + " " : "") + model);
            if ("match".equals(r.status())) {
                VehicleCatalog.Match m = r.matches().get(0);
                make = m.make();
                model = m.model();
                bt = BodyType.fromWire(m.bodyType()); // 차급은 카탈로그 기준
                fromYear = m.from();
                toYear = m.to();
                verified = true;
            } else if (a.path("unverified").asBoolean(false)) {
                verified = false;
            } else {
                return Result.failure("'" + model + "'은(는) 차종 목록에서 확인되지 않아 저장하지 않았습니다.",
                        "lookup_vehicle로 후보를 확인해 사용자에게 어떤 차종인지 물어보세요. 사용자가 목록에 없는 차종으로 "
                                + "그대로 등록하겠다고 분명히 답한 경우에만 unverified=true로 다시 호출하세요. 후보: "
                                + r.matches().stream().map(m -> m.make() + " " + m.model()).toList());
            }
        }

        if (bt != null) { s.vehicle.bodyType = bt.wire(); parts.add("차급 " + bt.label); }
        if (make != null) { s.vehicle.make = make; parts.add("제조사 " + make); }
        if (model != null) {
            s.vehicle.model = model;
            s.vehicle.verified = verified;
            parts.add("차종 " + model + (Boolean.FALSE.equals(verified) ? "(미확인)" : ""));
        }
        Integer year = CarState.range(intOf(a, "model_year"), 1980, 2100);
        if (year != null) {
            boolean tooEarly = fromYear != null && year < fromYear;
            boolean tooLate = toYear != null && year > toYear + 1;
            if (tooEarly || tooLate) {
                hints.add("연식 " + year + "은(는) 이 차종의 생산 기간(" + fromYear + "~" + (toYear == null ? "현재" : toYear)
                        + ")과 맞지 않아 저장하지 않았습니다. 사용자에게 연식을 다시 확인하세요.");
            } else {
                s.vehicle.modelYear = year;
                parts.add(year + "년식");
            }
        }
        String prevFuel = s.vehicle.fuelType;
        String fuel = text(a, "fuel_type");
        if (fuel != null && CarState.FUEL_TYPES.contains(fuel.toLowerCase())) {
            s.vehicle.fuelType = fuel.toLowerCase();
            parts.add("연료 " + s.vehicle.fuelType);
        }
        if (parts.isEmpty()) {
            return Result.failure("바꿀 값이 없거나 유효하지 않습니다.", hints.isEmpty() ? null : String.join(" ", hints));
        }
        if (!java.util.Objects.equals(prevFuel, s.vehicle.fuelType)) s.reconcileServices(prevFuel);
        String msg = "차량 정보 저장: " + String.join(", ", parts);
        s.addEvent(today, "vehicle", msg);
        return Result.success(msg, hints.isEmpty() ? null : String.join(" ", hints));
    }

    private static Result logTrip(JsonNode a, CarState s, LocalDate today) {
        if (s.odometer.km == null) {
            return Result.failure("현재 주행거리를 모릅니다. 사용자에게 계기판 주행거리를 먼저 물어보고 set_odometer를 호출하세요.");
        }
        Double kmArg = num(a, "km");
        Integer days = intOf(a, "commute_days");
        double km;
        String how;
        if (kmArg != null) {
            km = kmArg;
            how = "";
        } else if (days != null) {
            if (s.commute.kmPerDay == null) {
                return Result.failure("출퇴근 하루 거리를 모릅니다. 사용자에게 물어보고 set_commute를 호출하세요.");
            }
            if (s.commute.kmPerDay == 0) {
                return Result.failure("이 차량은 출퇴근을 하지 않는 차량으로 설정되어 있어요.",
                        "출퇴근 일수로는 거리를 계산할 수 없습니다. 실제로 주행한 거리(km)를 사용자에게 물어보세요.");
            }
            km = (double) days * s.commute.kmPerDay;
            how = " (출퇴근 " + days + "일 × " + s.commute.kmPerDay + "km)";
        } else {
            return Result.failure("km 또는 commute_days 중 하나가 필요합니다.");
        }
        if (km <= 0 || km > MAX_TRIP_KM) {
            return Result.failure("주행거리가 비정상입니다(" + Math.round(km) + "km). 사용자에게 다시 확인하세요.");
        }
        int add = (int) Math.round(km);
        addDistance(s, add);
        s.odometer.updatedAt = today.toString();
        String msg = "주행거리 +" + fmt(add) + "km" + how + " → " + fmt(s.odometer.km) + "km(추정)";
        s.addEvent(today, "trip", msg);
        return Result.success(msg);
    }

    private static Result logFuel(JsonNode a, CarState s, LocalDate today) {
        Double liters = num(a, "liters");
        if (liters == null || liters <= 0 || liters > 200) {
            return Result.failure("주유량(L)이 없거나 비정상입니다. 사용자에게 다시 확인하세요.");
        }
        Double cost = num(a, "cost_won");
        if (cost != null && (cost < 0 || cost > 1_000_000)) {
            return Result.failure("주유 금액이 비정상입니다. 사용자에게 다시 확인하세요.");
        }
        s.fuel.totalLiters += liters;
        if (cost != null) s.fuel.totalCost += Math.round(cost);
        if (!s.fuel.started) {
            s.fuel.started = true; // 첫 주유는 연비 계산의 기준점으로만 사용
        } else {
            s.fuel.litersSinceStart += liters;
        }
        StringBuilder msg = new StringBuilder("주유 기록: ").append(trim(liters)).append("L");
        if (cost != null) msg.append(" / ").append(fmt(Math.round(cost))).append("원");
        Double eff = efficiency(s);
        if (eff != null) msg.append(" → 평균 연비 ").append(trim(eff)).append("km/L");
        s.addEvent(today, "fuel", msg.toString());
        return Result.success(msg.toString());
    }

    private static Result logService(JsonNode a, CarState s, LocalDate today) {
        ServiceCatalog cat = ServiceCatalog.byTool(text(a, "item"));
        if (cat == null) return Result.failure("지원하지 않는 항목입니다.");
        CarState.ServiceItem item = s.services.get(cat.key);
        if (item == null) return Result.failure("이 차량에는 해당 항목이 없습니다.");
        Integer kmArg = intOf(a, "km");
        String d = text(a, "date");
        // 교체한 시점(날짜 또는 교체 당시 주행거리)이 없고 "방금 교체했다"는 확인도 없으면 기록하지 않는다.
        // (예전에는 항목만 알려 줘도 "오늘, 현재 주행거리에 교체"로 기록되어, 상태를 묻는 질문이 교체 기록으로 바뀌는 문제가 있었다)
        if (d == null && kmArg == null && !a.path("just_now").asBoolean(false)) {
            return Result.failure("교체 시점을 알 수 없어서 기록하지 않았어요.",
                    "사용자가 방금·오늘 교체했다고 분명히 말한 경우에만 just_now=true로 호출하세요. 그렇지 않으면 교체 날짜(date)나 교체 당시 "
                            + "주행거리(km)를 받아서 호출하세요. 소모품 상태를 묻는 질문에는 이 도구를 호출하면 안 됩니다. 언제 교체했는지 사용자에게 물어보세요.");
        }
        // 날짜 없이 과거 주행거리만 말했다면 날짜는 모르는 것으로 둔다(오늘로 가정하지 않음).
        LocalDate date = (d == null && kmArg != null) ? null : today;
        if (d != null) {
            try {
                date = LocalDate.parse(d);
            } catch (DateTimeParseException e) {
                return Result.failure("날짜 형식이 올바르지 않습니다(YYYY-MM-DD).");
            }
            if (date.isAfter(today)) return Result.failure("미래 날짜는 기록할 수 없습니다.");
        }
        Integer km = kmArg;
        // 현재 주행거리를 기본값으로 쓰는 것은 최근(7일 이내) 교체뿐. 더 오래전이면 교체 당시 거리는 모르는 것으로 둔다.
        boolean recent = date != null && java.time.temporal.ChronoUnit.DAYS.between(date, today) <= 7;
        if (km == null) km = recent ? s.odometer.km : null;
        else if (CarState.range(km, 0, CarState.MAX_KM) == null) return Result.failure("주행거리가 비정상입니다.");
        item.lastKm = km;
        item.lastDate = date == null ? null : date.toString();
        String msg = cat.labelFor(s.vehicle.fuelType) + " 교체 기록:"
                + (date != null ? " " + date : " 날짜 미상")
                + (km != null ? " / " + fmt(km) + "km" : "");
        s.addEvent(today, "service", msg);
        return Result.success(msg);
    }

    private static Result setOdometer(JsonNode a, CarState s, LocalDate today) {
        Integer km = CarState.range(intOf(a, "km"), 0, CarState.MAX_KM);
        if (km == null) return Result.failure("주행거리 값이 없거나 비정상입니다.");
        Integer cur = s.odometer.km;
        if (cur != null && km < cur && "reported".equals(s.odometer.source)) {
            return Result.failure("실측했던 주행거리(" + fmt(cur) + "km)보다 작습니다. 사용자에게 확인하세요.");
        }
        if (cur != null && km > cur && s.fuel.started) s.fuel.trackedKm += km - cur;
        s.odometer.km = km;
        s.odometer.source = "reported";
        s.odometer.updatedAt = today.toString();
        String msg = "주행거리 설정: " + fmt(km) + "km(계기판)";
        s.addEvent(today, "odometer", msg);
        return Result.success(msg);
    }

    private static Result setCommute(JsonNode a, CarState s, LocalDate today) {
        Integer v = CarState.range(intOf(a, "km_per_day"), 0, 500);
        if (v == null) return Result.failure("하루 출퇴근 거리가 없거나 비정상입니다.");
        s.commute.kmPerDay = v;
        String msg = v == 0 ? "출퇴근 안 함으로 설정" : "출퇴근 하루 " + v + "km로 설정";
        s.addEvent(today, "commute", msg);
        return Result.success(msg);
    }

    private static Result addSchedule(JsonNode a, CarState s, LocalDate today) {
        String title = CarState.clip(text(a, "title"), 60);
        if (title == null) return Result.failure("일정 제목이 없습니다. 무슨 일정인지 사용자에게 물어보세요.");
        String d = CarState.date(text(a, "date"));
        if (d == null) return Result.failure("날짜를 알 수 없습니다. 사용자에게 날짜를 물어보세요.");
        LocalDate date = LocalDate.parse(d);
        if (date.isBefore(today)) return Result.failure("이미 지난 날짜입니다. 오늘 이후 날짜인지 사용자에게 확인하세요.");
        if (date.isAfter(today.plusYears(3))) return Result.failure("너무 먼 날짜입니다. 날짜를 다시 확인하세요.");
        if (s.schedules.size() >= CarState.MAX_SCHEDULES) return Result.failure("일정이 너무 많습니다. 캘린더에서 지난 일정을 삭제해 달라고 안내하세요.");
        boolean dup = s.schedules.stream().anyMatch(x -> d.equals(x.date) && title.equals(x.title));
        if (dup) return Result.success("이미 같은 일정이 있어요: " + d + " " + title);
        CarState.Schedule x = new CarState.Schedule();
        x.id = java.util.UUID.randomUUID().toString().substring(0, 8);
        x.date = d;
        x.title = title;
        s.schedules.add(x);
        String msg = "일정 추가: " + d + " " + title;
        s.addEvent(today, "schedule", msg);
        return Result.success(msg);
    }

    private static Result setInterval(JsonNode a, CarState s, LocalDate today) {
        ServiceCatalog cat = ServiceCatalog.byTool(text(a, "item"));
        CarState.ServiceItem item = cat == null ? null : s.services.get(cat.key);
        if (item == null) return Result.failure("지원하지 않거나 이 차량에 없는 항목입니다.");
        Integer km = CarState.range(intOf(a, "interval_km"), 100, 1_000_000);
        Integer months = CarState.range(intOf(a, "interval_months"), 1, 240);
        if (km == null && months == null) return Result.failure("바꿀 주기 값이 없거나 비정상입니다.");
        List<String> parts = new ArrayList<>();
        if (km != null) { item.intervalKm = km; parts.add(fmt(km) + "km"); }
        if (months != null) { item.intervalMonths = months; parts.add(months + "개월"); }
        String msg = cat.labelFor(s.vehicle.fuelType) + " 교체 주기: " + String.join(" / ", parts);
        s.addEvent(today, "interval", msg);
        return Result.success(msg);
    }

    // ---- 계산/유틸 ----

    private static void addDistance(CarState s, int km) {
        s.odometer.km += km;
        s.odometer.source = "estimated";
        if (s.fuel.started) s.fuel.trackedKm += km;
    }

    static Double efficiency(CarState s) {
        return s.fuel.litersSinceStart > 0 && s.fuel.trackedKm > 0
                ? s.fuel.trackedKm / s.fuel.litersSinceStart : null;
    }

    private static String text(JsonNode n, String f) {
        return n.hasNonNull(f) && n.get(f).isTextual() ? n.get(f).asText() : null;
    }

    private static Double num(JsonNode n, String f) {
        if (!n.hasNonNull(f)) return null;
        JsonNode v = n.get(f);
        if (v.isNumber()) return v.asDouble();
        try {
            return Double.parseDouble(v.asText().replace(",", "").trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static Integer intOf(JsonNode n, String f) {
        Double d = num(n, f);
        return d == null ? null : (int) Math.round(d);
    }

    private static String fmt(long v) {
        return String.format("%,d", v);
    }

    private static String trim(double v) {
        return v == Math.rint(v) ? String.valueOf((long) v) : String.format("%.1f", v);
    }
}
