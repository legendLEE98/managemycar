package com.mycar.chat;

import com.mycar.state.CarState;
import com.mycar.state.StateTools.NewSchedule;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;

public final class ChatDtos {
    private ChatDtos() {}

    public record Message(
            @Pattern(regexp = "user|assistant") String role,
            @NotBlank @Size(max = 2000) String content) {}

    public record ChatRequest(
            @NotEmpty @Size(max = 40) List<@Valid Message> messages,
            CarState state,
            /** 선택한 차량의 기존 일정(중복·한도 확인용). 저장된 일정은 차량 상태와 따로 있다. */
            @Size(max = 300) List<NewSchedule> schedules) {}

    /** changes: 이번 요청에서 코드가 실제로 적용한 변경 내용(화면에 그대로 표시) */
    /** day: 한국 시간 기준 날짜(YYYY-MM-DD). 화면이 날짜가 바뀌었는지 알 수 있게 한다. */
    public record Usage(int used, int limit, String day, boolean loggedIn) {}

    /** 화면이 대화창에 보여 줄 동작. 예: {type: "export_excel", scope: "all"} → 엑셀 받기 버튼 */
    public record Action(String type, String scope) {}

    /** schedules: 이번 대화로 새로 추가된 일정(화면이 계정 또는 이 브라우저에 저장한다) */
    public record ChatResponse(String reply, CarState state, List<String> changes, Usage usage, List<Action> actions,
                               List<NewSchedule> schedules) {}
}
