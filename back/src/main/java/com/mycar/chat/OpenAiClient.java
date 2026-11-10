package com.mycar.chat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/** OpenAI Chat Completions 호출. API 키는 서버에서만 사용한다. */
@Component
public class OpenAiClient {
    private final RestClient http;
    private final String model;
    private final String reasoningEffort;
    private final boolean enabled;

    public OpenAiClient(
            @Value("${mycar.openai.api-key}") String apiKey,
            @Value("${mycar.openai.model}") String model,
            @Value("${mycar.openai.base-url}") String baseUrl,
            @Value("${mycar.openai.reasoning-effort:}") String reasoningEffort) {
        this.model = model;
        this.reasoningEffort = reasoningEffort;
        this.enabled = apiKey != null && !apiKey.isBlank();
        var factory = new JdkClientHttpRequestFactory(
                HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build());
        factory.setReadTimeout(Duration.ofSeconds(60));
        this.http = RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(factory)
                .defaultHeader("Authorization", "Bearer " + apiKey)
                .build();
    }

    public boolean enabled() {
        return enabled;
    }

    public JsonNode complete(List<Map<String, Object>> messages, List<Map<String, Object>> tools) {
        Map<String, Object> body = new HashMap<>();
        body.put("model", model);
        body.put("messages", messages);
        body.put("tools", tools);
        body.put("tool_choice", "auto");
        // 일부 모델은 function tool 사용 시 reasoning_effort를 명시해야 한다(예: none).
        if (reasoningEffort != null && !reasoningEffort.isBlank()) body.put("reasoning_effort", reasoningEffort);
        return http.post().uri("/chat/completions").body(body).retrieve().body(JsonNode.class);
    }

    /** 응답에서 첫 번째 assistant 메시지 노드를 꺼낸다. */
    public static ObjectNode firstMessage(JsonNode response) {
        return (ObjectNode) response.path("choices").path(0).path("message");
    }
}
