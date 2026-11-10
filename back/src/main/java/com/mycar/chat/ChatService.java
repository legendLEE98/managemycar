package com.mycar.chat;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.mycar.chat.ChatDtos.Action;
import com.mycar.chat.ChatDtos.ChatResponse;
import com.mycar.chat.ChatDtos.Message;
import com.mycar.state.CarState;
import com.mycar.state.ServiceStatus;
import com.mycar.state.StateTools;
import com.mycar.vehicle.BodyType;
import com.mycar.vehicle.VehicleCatalog;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class ChatService {
    private static final Logger log = LoggerFactory.getLogger(ChatService.class);
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final int MAX_HISTORY = 20;
    private static final int MAX_TOOL_ROUNDS = 4;

    private final OpenAiClient openAi;
    private final ObjectMapper mapper;
    private final VehicleCatalog catalog;

    public ChatService(OpenAiClient openAi, ObjectMapper mapper, VehicleCatalog catalog) {
        this.openAi = openAi;
        this.catalog = catalog;
        this.mapper = mapper;
    }

    /** 한 요청 동안의 상태. 저장은 클라이언트(localStorage)가 한다. */
    private static final class Ctx {
        final CarState state;
        final LocalDate today = LocalDate.now(KST);
        final List<String> changes = new ArrayList<>();
        final List<Action> actions = new ArrayList<>();

        Ctx(CarState state) {
            this.state = state;
        }
    }

    public ChatResponse chat(List<Message> history, CarState clientState) {
        Ctx ctx = new Ctx((clientState == null ? new CarState() : clientState).sanitize());
        List<Message> recent = history.size() > MAX_HISTORY
                ? history.subList(history.size() - MAX_HISTORY, history.size()) : history;
        String reply = openAi.enabled() ? withGpt(recent, ctx) : withKeywords(recent, ctx);
        if (!ctx.changes.isEmpty()) ctx.state.updatedAt = OffsetDateTime.now(KST).toString();
        return new ChatResponse(reply, ctx.state, ctx.changes, null, ctx.actions);
    }

    // ---- GPT (function calling) ----
    private String withGpt(List<Message> history, Ctx ctx) {
        List<Map<String, Object>> msgs = new ArrayList<>();
        msgs.add(Map.of("role", "system", "content", systemPrompt(ctx)));
        for (Message m : history) msgs.add(Map.of("role", m.role(), "content", m.content()));

        for (int round = 0; round < MAX_TOOL_ROUNDS; round++) {
            JsonNode msg = OpenAiClient.firstMessage(openAi.complete(msgs, ToolDefs.ALL));
            JsonNode calls = msg.path("tool_calls");
            if (!calls.isArray() || calls.isEmpty()) {
                String text = msg.path("content").asText("").trim();
                if (!text.isEmpty()) return text;
                return ctx.changes.isEmpty() ? "잘 이해하지 못했어요. 다시 말씀해 주세요." : String.join("\n", ctx.changes);
            }
            msgs.add(mapper.convertValue(msg, new TypeReference<Map<String, Object>>() {}));
            for (JsonNode call : calls) {
                msgs.add(Map.of(
                        "role", "tool",
                        "tool_call_id", call.path("id").asText(),
                        "content", runTool(call.path("function"), ctx)));
            }
        }
        return "처리가 길어지고 있어요. 다시 한 번 말씀해 주세요.";
    }

    private String runTool(JsonNode fn, Ctx ctx) {
        try {
            JsonNode args = mapper.readTree(fn.path("arguments").asText("{}"));
            // 엑셀 내보내기: 파일은 사용자의 브라우저에서 만들어지므로 서버는 "받기 버튼을 보여 달라"는 동작만 돌려준다.
            if ("export_excel".equals(fn.path("name").asText())) {
                String scope = "current".equals(args.path("scope").asText("all")) ? "current" : "all";
                ctx.actions.add(new Action("export_excel", scope));
                return mapper.writeValueAsString(Map.of("ok", true, "hint",
                        "화면에 '엑셀 파일 받기' 버튼이 표시된다. 파일을 직접 줄 수는 없고, 버튼을 누르면 내려받아진다고 한두 문장으로 안내한다."));
            }
            StateTools.Result r = StateTools.execute(fn.path("name").asText(), args, ctx.state, ctx.today, catalog, mapper);
            if (r.ok() && r.show()) ctx.changes.add(r.message());
            Map<String, Object> out = new java.util.LinkedHashMap<>();
            out.put("ok", r.ok());
            if (!r.message().isEmpty()) out.put("message", r.message());
            if (r.hint() != null) out.put("hint", r.hint());
            return mapper.writeValueAsString(out);
        } catch (Exception e) {
            log.warn("tool 실행 실패: {}", e.toString());
            return "{\"ok\":false,\"message\":\"인자를 해석하지 못했습니다.\"}";
        }
    }

    private String systemPrompt(Ctx ctx) {
        ObjectNode snapshot = mapper.valueToTree(ctx.state);
        snapshot.remove("recent");
        snapshot.remove("services"); // 아래 '소모품 상태' 표(서버가 계산)로 대신한다
        return """
                너는 차량 관리 앱 내차일기의 어시스턴트다. 항상 짧고 친근한 한국어로 답한다.
                오늘 날짜: %s

                규칙:
                - 사용자가 말한 사실만 도구로 반영한다. 말하지 않은 값은 추측하지 않는다.
                - 숫자 계산(주행거리 합산, 연비, 남은 거리)은 직접 하지 않는다. 도구와 아래 상태 값을 근거로 한다.
                - 도구가 ok=false를 돌려주면 이유를 쉽게 풀어 사용자에게 필요한 정보를 되묻는다.
                - 도구가 성공하면 결과를 한두 문장으로 간단히 알린다. (변경 내용은 화면에도 따로 표시된다)
                - 주행거리를 모르면 주행·정비 기록 전에 계기판 주행거리를 먼저 물어본다.
                - 차종(제조사·모델)을 알게 됐는데 상태 JSON의 fuelType이 null이면, 연식·주행거리보다 먼저 연료를 주도적으로 물어본다.
                  · 차종 이름만 보고 연료를 단정해서 저장하지 않는다. 사용자가 답하면 set_vehicle로 저장한다.
                  · 그 차종에 실제로 있는 연료를 선택지로 보여 준다. (예: 쏘렌토 → 디젤/가솔린/하이브리드, 아반떼 → 가솔린/하이브리드/LPG)
                  · 전기차 전용 모델(예: 아이오닉 5)은 "전기차 맞으시죠?"처럼 확인만 한다.
                  · 선택지에 자신이 없으면 가솔린/디젤/LPG/하이브리드/전기 중에서 고르게 한다.
                  · 사용자가 이미 연료를 말했거나 fuelType이 채워져 있으면 다시 묻지 않는다.
                - 연료가 저장되면, 연료에 맞게 소모품 목록이 바뀐다고 한 줄로 알린다. (예: 전기차는 엔진오일 대신 배터리 냉각수·감속기 오일을 관리한다)
                - 부족한 정보는 한 번에 하나씩만 자연스럽게 되묻고, 순서는 차종 → 연료 → 연식 → 주행거리 → 출퇴근 거리 순으로 한다.
                - 교체 주기 기본값은 일반 기준이라 차종·사용 환경에 따라 다를 수 있다. 근거 없이 단정하지 말고, 사용설명서를 확인하라고 안내한다.
                - 차종을 말하면 저장하기 전에 먼저 lookup_vehicle로 실제 있는 차종인지 확인한다. 이름을 추측하거나 지어내지 않는다.
                  · status=match: 반드시 같은 턴에서 곧바로 set_vehicle을 호출해 저장한 뒤에 다음 질문(연료 등)을 한다. 저장하지 않고 "설정할게요"라고만 말하거나, 저장 없이 질문만 하는 것은 금지한다.  make·model은 조회 결과의 이름을 쓴다. 차급(body_type)은 서버가 정하므로 신경 쓰지 않아도 된다.
                  · status=candidates: 후보를 보여 주며 어떤 차종인지 묻는다. (예: "아이오닉 5나 6 중에 어떤 건가요?") 사용자가 후보 중 하나를 고르면 그 이름으로 저장한다.
                  · status=none 또는 후보에 맞는 것이 없음: 찾지 못했다고 알리고 이름을 다시 확인해 달라고 한다. 그래도 그 차종이 맞다고 하거나 "목록에 없는 차종으로 등록"을 원하면, 그때만 set_vehicle에 unverified=true를 넣어 저장한다. 이때 body_type은 사용자가 말한 차급이나 크기를 보고 직접 고른다.
                  · 사용자가 확인해 주지 않았는데 unverified=true로 저장하지 않는다. 미확인 차종은 사용자가 말한 제조사·이름만 그대로 저장하고, 제조사를 추측해서 채우지 않는다.
                - 연식이 그 차종의 생산 기간과 맞지 않는다는 안내(hint)를 받으면 저장하지 말고 사용자에게 다시 확인한다.
                - 차종이 확인되고 fuelType이 null이면, 연식·주행거리보다 먼저 연료를 주도적으로 물어본다.
                  · 선택지는 조회 결과의 fuels를 쓴다. 한 가지뿐이면 "전기차 맞으시죠?"처럼 확인만 한다. (미확인 차종이면 가솔린/디젤/LPG/하이브리드/전기 중에서 묻는다)
                  · 차종 이름만 보고 연료를 단정해서 저장하지 않는다. 사용자가 답하면 set_vehicle로 저장한다.
                  · 사용자가 이미 연료를 말했거나 fuelType이 채워져 있으면 다시 묻지 않는다.
                - 연료가 저장되면, 연료에 맞게 소모품 목록이 바뀐다고 한 줄로 알린다. (예: 전기차는 엔진오일 대신 배터리 냉각수·감속기 오일을 관리한다)
                - 부족한 정보는 한 번에 하나씩만 자연스럽게 되묻고, 순서는 차종 → 연료 → 연식 → 주행거리 → 출퇴근 거리 순으로 한다.
                - 교체 주기 기본값은 일반 기준이라 차종·사용 환경에 따라 다를 수 있다. 근거 없이 단정하지 말고, 사용설명서를 확인하라고 안내한다.
                - 차종(제조사·모델)을 저장할 때는 항상 body_type(도구 설명의 차급 목록 중 하나)도 함께 지정한다. 화면의 3D 차량이 차급에 맞게 바뀐다. 차급이 애매하면 가장 가까운 차급을 고르고, 사용자에게 맞는지 짧게 확인한다.
                - 소모품 상태를 묻는 질문(상태 조회, 얼마 남았어, 언제 갈아야 해, 점검할 거 있어 등)에는 도구를 호출하지 말고, 아래 '소모품 상태' 표를 읽어서 답한다.
                  · 초과·임박 항목을 먼저, 이어서 정상 항목은 짧게 알린다. 표에 없는 값을 지어내거나 직접 계산하지 않는다.
                  · '데이터 부족' 항목은 마지막 교체 시기를 알려 주면 계산해 드린다고 안내한다. 이력이 없다고 교체한 것으로 가정하지 않는다.
                - 사용자가 엑셀·파일로 내보내기/다운로드를 요청하면 export_excel 도구를 호출한다. scope는 기본이 all(등록한 모든 차량)이다. 사용자가 '이 차', '지금 차량', '선택한 차량'처럼 한 대만 가리킬 때만 current로 한다. 특별한 말이 없으면 반드시 all이다.
                  · 파일은 내가 직접 줄 수 없고, 대화창에 나타나는 '엑셀 파일 받기' 버튼을 누르면 내려받아진다고 안내한다.
                - 사용자가 이 차로 출퇴근하지 않는다고 하면(소장용·주말용 등) set_commute를 km_per_day=0으로 호출해 "출퇴근 안 함"으로 저장한다. 거절하지 않는다.
                - 기록 도구(log_trip, log_fuel, log_service, set_odometer, set_commute, set_service_interval)는 사용자가 실제로 한 일이나 바꾸려는 값을 말했을 때만 호출한다. 질문·조회에는 절대 호출하지 않는다.
                  · 교체했다고 했는데 시점이 불분명하면(예: "엔진오일 갈았어") 기록하지 말고 언제, 몇 km에서 교체했는지 먼저 묻는다. 방금·오늘이라고 분명히 말했을 때만 just_now를 쓴다.
                - 차량과 무관한 요청은 정중히 사양한다.

                현재 저장된 차량 상태(JSON): %s

                소모품 상태(서버가 계산한 값. 이 표를 그대로 읽어서 답한다):
                %s
                """.formatted(ctx.today, snapshot.toString(), ServiceStatus.describe(ctx.state, ctx.today).stripTrailing().replace("\n", "\n                "));
    }

    // ---- 키 없을 때 ----
    private String withKeywords(List<Message> history, Ctx ctx) {
        BodyType bt = KeywordFallback.detect(history.get(history.size() - 1).content());
        if (bt == null) {
            return "차종을 말씀해 주세요. 예) 경차, 준중형, 중형, 대형, SUV, RV, 스포츠카, 전기차";
        }
        ctx.state.vehicle.bodyType = bt.wire();
        ctx.changes.add("차급 " + bt.label + "로 변경");
        return "차체를 바꿨어요.";
    }
}
