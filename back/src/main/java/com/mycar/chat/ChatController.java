package com.mycar.chat;

import com.mycar.chat.ChatDtos.ChatRequest;
import com.mycar.chat.ChatDtos.ChatResponse;
import com.mycar.chat.ChatDtos.Usage;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClientException;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1/chat")
public class ChatController {
    private static final Logger log = LoggerFactory.getLogger(ChatController.class);
    private final ChatService service;
    private final ChatRateLimiter limiter;
    private final ChatQuota quota;

    public ChatController(ChatService service, ChatRateLimiter limiter, ChatQuota quota) {
        this.service = service;
        this.limiter = limiter;
        this.quota = quota;
    }

    private static boolean loggedIn(Authentication auth) {
        return auth != null && auth.getPrincipal() instanceof Long;
    }

    private static String subject(Authentication auth, HttpServletRequest http) {
        return loggedIn(auth) ? "u:" + auth.getPrincipal() : "ip:" + http.getRemoteAddr();
    }

    /** 오늘 사용한 횟수와 한도 */
    @GetMapping("/usage")
    public Usage usage(Authentication auth, HttpServletRequest http) {
        boolean li = loggedIn(auth);
        return new Usage(quota.used(subject(auth, http)), quota.limitFor(li), ChatQuota.today().toString(), li);
    }

    @PostMapping
    public ChatResponse chat(@Valid @RequestBody ChatRequest req, Authentication auth, HttpServletRequest http) {
        if (!"user".equals(req.messages().get(req.messages().size() - 1).role())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "마지막 메시지는 user여야 합니다.");
        }
        boolean li = loggedIn(auth);
        String subject = subject(auth, http);

        // 1) 분당 제한(메모리) 2) 일일 한도(DB). 둘 다 GPT를 부르기 전에 검사해서 막힌 요청은 비용이 들지 않는다.
        long wait = limiter.acquire(subject);
        if (wait > 0) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "메시지를 너무 빠르게 보내고 있어요. 약 " + wait + "초 뒤에 다시 시도해 주세요.");
        }
        int limit = quota.limitFor(li);
        int used = quota.consume(subject, limit);
        if (used < 0) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, li
                    ? "오늘 대화 횟수(" + limit + "회)를 모두 사용했어요. 내일 0시에 초기화돼요."
                    : "오늘 대화 횟수(" + limit + "회)를 모두 사용했어요. 로그인하면 하루 " + quota.limitFor(true)
                            + "회까지 사용할 수 있어요. (내일 0시에 초기화)");
        }
        try {
            ChatResponse r = service.chat(req.messages(), req.state());
            return new ChatResponse(r.reply(), r.state(), r.changes(), new Usage(used, limit, ChatQuota.today().toString(), li), r.actions());
        } catch (RestClientException e) {
            quota.refund(subject); // AI 서버 문제로 실패한 요청은 횟수에서 빼 준다
            log.error("OpenAI 호출 실패", e);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "AI 서버 응답에 실패했어요.");
        }
    }
}
