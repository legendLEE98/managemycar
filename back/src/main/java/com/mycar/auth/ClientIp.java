package com.mycar.auth;

import jakarta.servlet.http.HttpServletRequest;

/**
 * 방문자 IP. 백엔드는 compose 내부에서 nginx를 거친 요청만 받으므로, nginx가 정리해 넣은 X-Real-IP를 쓴다.
 * (없으면 직전 연결 주소. 이 값만 쓰면 모든 방문자가 프록시 한 개의 IP로 보인다.)
 */
public final class ClientIp {
    private ClientIp() {}

    public static String of(HttpServletRequest req) {
        String ip = req.getHeader("X-Real-IP");
        if (ip != null) {
            ip = ip.trim();
            if (!ip.isEmpty() && ip.length() <= 45 && ip.matches("[0-9a-fA-F:.]+")) return ip;
        }
        return req.getRemoteAddr();
    }
}
