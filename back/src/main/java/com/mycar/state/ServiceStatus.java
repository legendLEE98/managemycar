package com.mycar.state;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

/**
 * 소모품 상태를 서버가 계산해서 글로 만든다. AI가 "소모품 상태 알려줘" 같은 질문에 도구를 쓰지 않고 이 표를 읽어서 답하게 한다.
 * 계산 기준은 화면(front/src/derive.ts의 serviceViews)과 같다: 사용 비율 80% 이상 임박, 100% 이상 초과.
 */
public final class ServiceStatus {
    private ServiceStatus() {}

    public static String describe(CarState s, LocalDate today) {
        String fuel = s.vehicle.fuelType;
        Integer odo = s.odometer.km;
        List<String> lines = new ArrayList<>();
        List<String> over = new ArrayList<>();
        List<String> soon = new ArrayList<>();
        List<String> lack = new ArrayList<>();

        for (ServiceCatalog c : ServiceCatalog.values()) {
            if (!c.applicable(fuel)) continue;
            CarState.ServiceItem it = s.services.get(c.key);
            if (it == null) continue;
            String label = c.labelFor(fuel);
            String interval = interval(it);

            if (it.lastKm == null && it.lastDate == null) {
                lines.add("- " + label + " | 교체 이력 없음 | 주기 " + interval + " | 상태: 데이터 부족(마지막 교체 시기를 모름)");
                lack.add(label);
                continue;
            }

            List<Double> ratios = new ArrayList<>();
            List<String> remain = new ArrayList<>();
            List<String> missing = new ArrayList<>();
            if (it.intervalKm != null) {
                if (it.lastKm == null) missing.add("교체 당시 주행거리");
                else if (odo == null) missing.add("현재 주행거리");
                else {
                    int used = odo - it.lastKm;
                    ratios.add((double) used / it.intervalKm);
                    int rem = it.intervalKm - used;
                    remain.add(rem >= 0 ? "남은 거리 " + n(rem) + "km" : n(-rem) + "km 초과");
                }
            }
            if (it.intervalMonths != null) {
                if (it.lastDate == null) missing.add("교체 날짜");
                else {
                    long rem = ChronoUnit.DAYS.between(today, LocalDate.parse(it.lastDate).plusMonths(it.intervalMonths));
                    ratios.add(1 - (double) rem / (it.intervalMonths * 30.0));
                    remain.add(rem >= 0 ? "남은 일수 " + rem + "일" : (-rem) + "일 초과");
                }
            }

            String last = "마지막 교체 " + (it.lastDate != null ? it.lastDate : "날짜 미상")
                    + (it.lastKm != null ? " / " + n(it.lastKm) + "km" : "");
            String status;
            if (ratios.isEmpty()) {
                status = "데이터 부족(" + String.join(", ", missing) + " 필요)";
                lack.add(label);
            } else {
                double worst = ratios.stream().mapToDouble(Double::doubleValue).max().orElse(0);
                status = worst >= 1 ? "초과" : worst >= 0.8 ? "임박" : "정상";
                if (worst >= 1) over.add(label);
                else if (worst >= 0.8) soon.add(label);
            }
            lines.add("- " + label + " | " + last + " | 주기 " + interval
                    + (remain.isEmpty() ? "" : " | " + String.join(", ", remain)) + " | 상태: " + status);
        }

        StringBuilder sb = new StringBuilder();
        sb.append("현재 주행거리: ").append(odo == null ? "모름" : n(odo) + "km")
                .append(odo != null ? ("reported".equals(s.odometer.source) ? "(계기판)" : "(추정)") : "").append('\n');
        sb.append("요약 → 초과: ").append(over.isEmpty() ? "없음" : String.join(", ", over))
                .append(" / 임박: ").append(soon.isEmpty() ? "없음" : String.join(", ", soon))
                .append(" / 데이터 부족: ").append(lack.size()).append("개\n");
        lines.forEach(l -> sb.append(l).append('\n'));
        return sb.toString();
    }

    private static String interval(CarState.ServiceItem it) {
        List<String> p = new ArrayList<>();
        if (it.intervalKm != null) p.add(n(it.intervalKm) + "km");
        if (it.intervalMonths != null) p.add(it.intervalMonths + "개월");
        return p.isEmpty() ? "-" : String.join(" / ", p);
    }

    private static String n(long v) {
        return String.format("%,d", v);
    }
}
