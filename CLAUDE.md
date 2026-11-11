# 내차일기 (mycar)

차량의 주행·주유·정비 이력을 **대화로 기록**하고 소모품 교체 시점을 보여 주는 서비스. 한국어 서비스이고 사용자와도 **한국어**로 대화한다.
기획은 `md/PLAN.md`, 실행 방법은 `README.md`, **앱(Flutter) 개발 계획은 `md/APP.md`** 를 본다.

## 구조
```
back/    Spring Boot 3.3 / Java 21 / Gradle — REST API, PostgreSQL 16 + Flyway
front/   React 18 + Vite + TypeScript + three.js — 현재의 웹 클라이언트
app/     (예정) Flutter 앱. 서버 API는 웹과 같은 것을 쓴다
deploy/  호스트 nginx 설정 예시
md/      PLAN.md(기획), APP.md(앱 개발 계획)
```
운영: 한 대의 홈 서버에서 Docker Compose(db + back + front[nginx])로 돌고, Cloudflare Tunnel로 `https://diarymycar.site`에 공개된다.

## 설계 원칙 (바꾸지 말 것)
- **숫자 계산과 검증은 AI가 아니라 코드가 한다.** AI(OpenAI function calling)는 해석과 대화만 맡는다. 잔여 km·일수, 상태 판정은 서버가 계산한다.
- 채팅은 **stateless**: 클라이언트가 선택한 차량 1대의 `CarState`를 보내면 서버가 도구를 실행해 갱신된 상태를 돌려준다. 서버는 클라이언트가 보낸 값을 신뢰하지 않고 항상 `sanitize()` 한다.
- 데이터 모델
  - **차고(Garage)**: 차량 최대 5대(`{activeId, vehicles:[{id, state}]}`). 로그인 사용자는 `user_state_version`에 **버전 스냅샷(JSONB)** 으로 저장(최대 500개, 내용이 같으면 새 버전을 만들지 않음). 비로그인은 클라이언트 로컬 저장소.
  - **일정(schedule)**: 차량 상태와 **별도 테이블**. 로그인=서버 API, 비로그인=로컬 저장소.
  - 채팅 기록은 `chat_log`(기본 90일 보관, `CHAT_LOG_DAYS`).
- 채팅 한도: 분당 6회(메모리), 일일 비로그인 20 / 로그인 60(KST 0시 초기화, DB). 비로그인 식별은 실제 방문자 IP.
- 인증: 자체 가입/로그인(Argon2id), JWT. 웹은 HttpOnly 쿠키, **앱은 `Authorization: Bearer`** (`/api/v1/auth/app/*`).

## 클라이언트에만 있는 로직 (앱에서 다시 구현해야 함)
`md/APP.md`의 "클라이언트 로직" 표를 본다. 핵심: 소모품 현황 계산(`derive.ts`), 직접 입력 폼의 상태 변경(`stateOps.ts`), 게스트↔계정 병합과 동기화(`App.tsx`, `storage.ts`), 엑셀 내보내기(`exportXlsx.ts`), 3D 차량(`CarViewer.tsx`).

## 디자인
- 브랜드 색 `#7B716F`. 귀엽고 로우폴리한 3D 차량, **자동 회전 없음, 드래그로 회전**.
- 3D 모델: Kenney Car Kit(CC0), 변환본이 `front/public/models/cute/*.glb`. 원본은 저장소에 올리지 않는다(`source/` 무시).

## 작업 규칙
- 사용자는 인프라(sudo, Cloudflare, nginx, certbot)를 직접 한다. 서버 설정 변경이 필요하면 **명령과 이유를 알려 주고** 직접 실행하게 한다.
- **비밀값(API 키, 토큰, 비밀번호)을 출력하거나 커밋하지 않는다.** `.env`는 커밋 금지, `.env.example`만 올린다. 필요하면 마스킹해서 보여 준다.
- `source/` 폴더와 swap 파일(`*.swp`)은 올리지 않는다. `git add .`/`-A` 하기 전에 `git status`로 확인한다.
- PLAN.md에 "확장성/포트폴리오" 절을 넣지 않는다.
- DB 스키마는 Flyway 마이그레이션(`back/src/main/resources/db/migration/V*.sql`)으로만 바꾸고, **기존 V 파일은 수정하지 않는다.**
- 커밋 메시지는 한국어. 사용자가 요청할 때만 커밋·푸시한다.

## 개발·검증
- 서버 전체 재빌드: `docker compose up -d --build` (백엔드만: `... --build back`). 기동에 10~20초 걸려 직후 502가 날 수 있다.
- 웹 타입 검사: `cd front && npx tsc --noEmit`
- 로컬 접속: `http://localhost:8088` (nginx가 `/api`를 back으로 프록시)
- 환경변수는 `.env.example` 참고. 키가 없으면 AI 대신 키워드 폴백으로 동작한다.
