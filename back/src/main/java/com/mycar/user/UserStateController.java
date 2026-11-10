package com.mycar.user;

import com.fasterxml.jackson.databind.JsonNode;
import com.mycar.state.Garage;
import com.mycar.user.UserStateService.SaveResult;
import com.mycar.user.UserStateService.Snapshot;
import com.mycar.user.UserStateService.VersionInfo;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/me/state")
public class UserStateController {
    /** 복원 응답: 새로 만들어진(또는 그대로인) 최신 버전과 차고 */
    public record StateWithVersion(int version, Garage state) {}

    private final UserStateService service;

    public UserStateController(UserStateService service) {
        this.service = service;
    }

    private static long uid(Authentication auth) {
        return (Long) auth.getPrincipal();
    }

    /** 최신 차고. 없으면 404 */
    @GetMapping
    public ResponseEntity<Garage> latest(Authentication auth) {
        return service.latest(uid(auth))
                .map(s -> ResponseEntity.ok().header("X-State-Version", String.valueOf(s.version())).body(s.state()))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    /** 저장. 직전 버전과 내용이 같으면 changed=false로 새 버전을 만들지 않는다. 예전 형식(차량 1대)으로 보내도 받는다. */
    @PutMapping
    public SaveResult save(Authentication auth, @RequestBody JsonNode body) {
        return service.save(uid(auth), service.fromJson(body), null);
    }

    @GetMapping("/versions")
    public List<VersionInfo> versions(Authentication auth, @RequestParam(defaultValue = "50") int limit) {
        return service.list(uid(auth), Math.max(1, Math.min(limit, 200)));
    }

    @GetMapping("/versions/{version}")
    public ResponseEntity<StateWithVersion> version(Authentication auth, @PathVariable int version) {
        return service.get(uid(auth), version)
                .map(s -> ResponseEntity.ok(new StateWithVersion(s.version(), s.state())))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping("/versions/{version}/restore")
    public ResponseEntity<StateWithVersion> restore(Authentication auth, @PathVariable int version) {
        Snapshot s = service.restore(uid(auth), version).orElse(null);
        return s == null ? ResponseEntity.notFound().build() : ResponseEntity.ok(new StateWithVersion(s.version(), s.state()));
    }
}
