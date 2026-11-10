package com.mycar.vehicle;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

/**
 * 차종 카탈로그(resources/catalog/vehicles.json)에서 차종이 실제로 있는지 확인한다.
 * 목록은 직접 편집할 수 있다. 수정 후에는 백엔드를 다시 빌드해야 반영된다.
 */
@Component
public class VehicleCatalog {
    public record Entry(String make, String model, List<String> aliases, String body, List<String> fuels,
                        Integer from, Integer to) {}

    /** 차급 라벨까지 포함한 응답용 */
    public record Match(String make, String model, String bodyType, String bodyLabel, List<String> fuels,
                        Integer from, Integer to) {}

    /** status: match(하나로 확정) | candidates(후보 있음) | none(없음) */
    public record Result(String status, List<Match> matches) {}

    public record MakeCount(String make, long count) {}

    public record Stats(int models, List<MakeCount> makes) {}

    private static final int MAX_MATCHES = 5;

    private final List<Entry> entries;
    /** 제조사의 영문명·옛 이름 등(resources/catalog/make-aliases.json). 예: 테슬라 → tesla */
    private final Map<String, List<String>> makeAliases;

    public VehicleCatalog(ObjectMapper mapper) throws IOException {
        try (InputStream in = new ClassPathResource("catalog/vehicles.json").getInputStream()) {
            this.entries = mapper.readValue(in, new TypeReference<List<Entry>>() {});
        }
        ClassPathResource aliasFile = new ClassPathResource("catalog/make-aliases.json");
        if (aliasFile.exists()) {
            try (InputStream in = aliasFile.getInputStream()) {
                this.makeAliases = mapper.readValue(in, new TypeReference<Map<String, List<String>>>() {});
            }
        } else {
            this.makeAliases = Map.of();
        }
        for (Entry e : entries) {
            if (BodyType.fromWire(e.body()) == null) {
                throw new IllegalStateException("차종 카탈로그의 차급이 올바르지 않습니다: " + e.make() + " " + e.model() + " / " + e.body());
            }
        }
    }

    /** 사이드바 소개용: 등록된 차종 수와 제조사별 개수(많은 순) */
    public Stats stats() {
        var byMake = new java.util.LinkedHashMap<String, Long>();
        for (Entry e : entries) byMake.merge(e.make(), 1L, Long::sum);
        List<MakeCount> makes = byMake.entrySet().stream()
                .map(e -> new MakeCount(e.getKey(), e.getValue()))
                .sorted(Comparator.comparingLong(MakeCount::count).reversed())
                .toList();
        return new Stats(entries.size(), makes);
    }

    private record Scored(Entry entry, double score, boolean strong) {}

    public Result search(String query) {
        String q = norm(query);
        if (q.length() < 2) return new Result("none", List.of());

        List<Scored> scored = new ArrayList<>();
        for (Entry e : entries) {
            double best = 0;
            boolean strong = false;
            for (String name : names(e)) {
                String n = norm(name);
                if (n.isEmpty()) continue;
                double s;
                boolean st = false;
                if (q.equals(n)) {
                    s = 1.0;
                    st = true;
                } else if (n.length() >= 2 && containsStandalone(q, n)) {
                    s = 0.9 + n.length() / 1000.0; // 더 긴 이름이 우선
                    st = true;
                } else if (q.length() >= 3 && n.contains(q)) {
                    s = 0.7;
                } else {
                    double sim = 1.0 - (double) levenshtein(q, n) / Math.max(q.length(), n.length());
                    s = sim >= 0.6 ? sim * 0.69 : 0;
                }
                if (s > best) {
                    best = s;
                    strong = st;
                }
            }
            if (best > 0) scored.add(new Scored(e, best, strong));
        }
        if (scored.isEmpty()) return new Result("none", List.of());

        scored.sort(Comparator.comparingDouble(Scored::score).reversed());
        Scored top = scored.get(0);
        double second = scored.size() > 1 ? scored.get(1).score() : 0;
        String status = top.strong() && top.score() > second ? "match" : "candidates";
        List<Match> matches = scored.stream().limit(MAX_MATCHES).map(s -> toMatch(s.entry())).toList();
        return new Result(status, matches);
    }

    private static Match toMatch(Entry e) {
        BodyType bt = BodyType.fromWire(e.body());
        return new Match(e.make(), e.model(), bt.wire(), bt.label, e.fuels(), e.from(), e.to());
    }

    /** 검색에 쓰는 모든 이름: (제조사·제조사 별칭) × (모델·모델 별칭)과 제조사 없이 쓰는 이름 */
    private List<String> names(Entry e) {
        List<String> models = new ArrayList<>();
        models.add(e.model());
        if (e.aliases() != null) models.addAll(e.aliases());
        List<String> makes = new ArrayList<>();
        makes.add(e.make());
        makes.addAll(makeAliases.getOrDefault(e.make(), List.of()));
        List<String> out = new ArrayList<>(models);
        for (String mk : makes) for (String md : models) out.add(mk + md);
        return out;
    }

    /** 소문자로 바꾸고 글자·숫자만 남긴다. (공백, 하이픈 등 제거) */
    static String norm(String s) {
        if (s == null) return "";
        StringBuilder sb = new StringBuilder();
        for (char c : s.toLowerCase(Locale.ROOT).toCharArray()) {
            if (Character.isLetterOrDigit(c)) sb.append(c);
        }
        return sb.toString();
    }

    /**
     * q 안에 이름 n이 들어 있는지. 단, n 바로 뒤에 숫자가 붙으면(예: 아이오닉14 ⊃ 아이오닉) 다른 모델 번호로 보고 제외하고,
     * 영문 이름 바로 앞에 영문이 붙어도(예: xk5 ⊃ k5) 제외한다.
     */
    static boolean containsStandalone(String q, String n) {
        int from = 0;
        while (true) {
            int i = q.indexOf(n, from);
            if (i < 0) return false;
            int end = i + n.length();
            boolean digitAfter = end < q.length() && Character.isDigit(q.charAt(end));
            boolean latinBefore = i > 0 && isLatin(q.charAt(i - 1)) && isLatin(n.charAt(0));
            if (!digitAfter && !latinBefore) return true;
            from = i + 1;
        }
    }

    private static boolean isLatin(char c) {
        return (c >= 'a' && c <= 'z');
    }

    private static int levenshtein(String a, String b) {
        int[] prev = new int[b.length() + 1];
        int[] cur = new int[b.length() + 1];
        for (int j = 0; j <= b.length(); j++) prev[j] = j;
        for (int i = 1; i <= a.length(); i++) {
            cur[0] = i;
            for (int j = 1; j <= b.length(); j++) {
                int cost = a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1;
                cur[j] = Math.min(Math.min(cur[j - 1] + 1, prev[j] + 1), prev[j - 1] + cost);
            }
            int[] t = prev;
            prev = cur;
            cur = t;
        }
        return prev[b.length()];
    }
}
