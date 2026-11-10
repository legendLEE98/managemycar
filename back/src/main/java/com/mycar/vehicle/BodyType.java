package com.mycar.vehicle;

import java.util.Locale;

/**
 * 차급(차체 유형). 프론트(front/src/vehicleOptions.ts)의 id와 같아야 한다.
 * 기존 값(sedan, suv, compact, minivan)은 중형·중형 SUV·경형·승합차로 이어진다.
 * 스포츠카(머슬카 포함)·픽업·트럭은 3D 모델 형태가 따로 있다.
 */
public enum BodyType {
    COMPACT("경형", "모닝·레이·캐스퍼"),
    SMALL("소형", "엑센트"),
    SEMIMID("준중형", "아반떼·K3·i30"),
    SEDAN("중형", "쏘나타·K5"),
    SEMILARGE("준대형", "그랜저·K8"),
    LARGE("대형", "제네시스 G90·K9"),
    SUV_SMALL("소형 SUV", "코나·셀토스·니로"),
    SUV_SEMIMID("준중형 SUV", "투싼·스포티지"),
    SUV("중형 SUV", "싼타페·쏘렌토"),
    SUV_LARGE("대형 SUV", "팰리세이드·모하비"),
    MINIVAN("승합차", "카니발·스타리아"),
    SPORTS("스포츠카", "머스탱·카마로·콜벳·챌린저·911"),
    PICKUP("픽업", "렉스턴 스포츠·F-150·사이버트럭·글래디에이터"),
    TRUCK("트럭", "포터·봉고·라보");

    public final String label;
    public final String examples;

    BodyType(String label, String examples) {
        this.label = label;
        this.examples = examples;
    }

    /** API/프론트에서 쓰는 소문자 값 */
    public String wire() {
        return name().toLowerCase(Locale.ROOT);
    }

    /** 도구 설명용: 예) 준중형(아반떼·K3·i30)=semimid */
    public String describe() {
        return label + "(" + examples + ")=" + wire();
    }

    public static BodyType fromWire(String v) {
        if (v == null) return null;
        try {
            return valueOf(v.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
