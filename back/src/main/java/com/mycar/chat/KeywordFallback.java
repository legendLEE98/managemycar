package com.mycar.chat;

import com.mycar.vehicle.BodyType;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Pattern;

/** OpenAI 키가 없을 때 쓰는 단순 키워드 판별. */
final class KeywordFallback {
    private static final Map<BodyType, Pattern> RULES = new LinkedHashMap<>();
    static {
        RULES.put(BodyType.PICKUP, Pattern.compile("픽업|렉스턴\\s*스포츠|코란도\\s*스포츠|f-?150|사이버\\s*트럭", Pattern.CASE_INSENSITIVE));
        RULES.put(BodyType.TRUCK, Pattern.compile("트럭|포터|봉고|라보|마이티", Pattern.CASE_INSENSITIVE));
        RULES.put(BodyType.SPORTS, Pattern.compile("머슬카|스포츠카|쿠페|머스탱|카마로|콜벳|챌린저", Pattern.CASE_INSENSITIVE));
        RULES.put(BodyType.MINIVAN, Pattern.compile("미니밴|카니발|스타리아", Pattern.CASE_INSENSITIVE));
        RULES.put(BodyType.COMPACT, Pattern.compile("경차|경형|모닝|레이|스파크|캐스퍼", Pattern.CASE_INSENSITIVE));
        RULES.put(BodyType.SUV_SMALL, Pattern.compile("코나|셀토스|베뉴|트랙스|스토닉", Pattern.CASE_INSENSITIVE));
        RULES.put(BodyType.SUV_SEMIMID, Pattern.compile("투싼|스포티지|니로", Pattern.CASE_INSENSITIVE));
        RULES.put(BodyType.SUV_LARGE, Pattern.compile("팰리세이드|모하비", Pattern.CASE_INSENSITIVE));
        RULES.put(BodyType.SUV, Pattern.compile("suv|에스유브이|싼타페|쏘렌토|렉스턴|토레스", Pattern.CASE_INSENSITIVE));
        RULES.put(BodyType.SMALL, Pattern.compile("소형|엑센트", Pattern.CASE_INSENSITIVE));
        RULES.put(BodyType.SEMIMID, Pattern.compile("준중형|아반떼|k3|i30", Pattern.CASE_INSENSITIVE));
        RULES.put(BodyType.SEMILARGE, Pattern.compile("준대형|그랜저|k8", Pattern.CASE_INSENSITIVE));
        RULES.put(BodyType.LARGE, Pattern.compile("대형|k9|g90", Pattern.CASE_INSENSITIVE));
        RULES.put(BodyType.SEDAN, Pattern.compile("세단|중형|쏘나타|소나타|k5|g70|g80|sm6|말리부", Pattern.CASE_INSENSITIVE));
    }

    private KeywordFallback() {}

    static BodyType detect(String text) {
        return RULES.entrySet().stream()
                .filter(e -> e.getValue().matcher(text).find())
                .map(Map.Entry::getKey)
                .findFirst().orElse(null);
    }
}
