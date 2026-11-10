package com.mycar.vehicle;

import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 지도 탭이 쓰는 구글 지도 키를 내려준다. 브라우저용 키이므로 구글 콘솔에서 도메인·API 제한을 걸어야 한다. */
@RestController
@RequestMapping("/api/v1/config")
public class MapsConfigController {
    private final String key;

    public MapsConfigController(@Value("${mycar.maps.google-key:}") String key) {
        this.key = key == null ? "" : key.trim();
    }

    @GetMapping("/maps")
    public Map<String, Object> maps() {
        return Map.of("enabled", !key.isEmpty(), "key", key);
    }
}
