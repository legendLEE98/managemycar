package com.mycar.schedule;

import com.mycar.schedule.ScheduleService.Input;
import com.mycar.schedule.ScheduleService.Item;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/** 로그인 사용자의 캘린더 일정 API */
@RestController
@RequestMapping("/api/v1/me/schedules")
public class ScheduleController {
    private final ScheduleService service;

    public ScheduleController(ScheduleService service) {
        this.service = service;
    }

    private static long uid(Authentication auth) {
        return (Long) auth.getPrincipal();
    }

    @GetMapping
    public List<Item> list(Authentication auth) {
        return service.list(uid(auth));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Item add(Authentication auth, @RequestBody Input in) {
        try {
            return service.add(uid(auth), in);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }

    /** 게스트로 쓰던 일정을 로그인한 계정으로 옮긴다. */
    @PostMapping("/import")
    public Map<String, Integer> importAll(Authentication auth, @RequestBody List<Input> items) {
        if (items == null || items.size() > 1000) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "일정이 너무 많아요.");
        return Map.of("saved", service.addAll(uid(auth), items));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(Authentication auth, @PathVariable String id) {
        service.remove(uid(auth), id);
    }
}
