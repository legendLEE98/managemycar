# 앱(Flutter) 개발 계획

웹 클라이언트(`front/`)와 같은 서버 API를 쓰는 **Flutter 앱**(`app/`)을 만든다. Android 먼저, iOS는 Mac이 생기면.
서버(Java)는 그대로 쓰고 **클라이언트만 새로 만든다.** 다만 클라이언트에 있는 로직이 꽤 있어서 아래 표만큼은 Dart로 다시 구현해야 한다.

## 만드는 순서
1. **3D 차량 가능 여부 확인(가장 먼저)**: `.glb`를 띄우고 드래그 회전, 파트(본네트·유리·바퀴·차체) 탭을 구현할 수 있는지. 안 되면 계획을 다시 정한다.
2. 프로젝트 생성(`app/`), API 클라이언트, 토큰 로그인/가입
3. 차량 상태 화면(소모품 현황, 임박 항목) — `derive.ts` 이식
4. 채팅(`POST /chat`) + 변경 내용 표시 + 되돌리기
5. 직접 입력 폼(주행, 정비, 차량 정보) — `stateOps.ts` 이식
6. 캘린더·일정
7. 차고(여러 대), 비로그인 체험 → 로그인 병합, 버전 이력
8. 근처 정비소(지도), 엑셀 내보내기, 알림(푸시)은 후순위

## 서버 접속
- 주소: `https://diarymycar.site` (운영). 로컬 서버를 띄웠다면 `http://localhost:8088`, 에뮬레이터에서는 `http://10.0.2.2:8088`.
- 모든 API는 `/api/v1/...`, 요청·응답은 JSON, 오류는 `{status, message}` 형태(`message`는 사용자에게 그대로 보여 줘도 되는 한국어).
- 앱은 CORS와 무관하다(브라우저가 아님).

## 인증 (앱용 토큰 방식)
쿠키 대신 토큰을 쓴다. 토큰은 보안 저장소(`flutter_secure_storage`)에 두고 로그인이 필요한 요청마다 `Authorization: Bearer <token>`으로 보낸다.

| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/auth/app/signup` | `{email, password(8~128자), nickname(2~20자)}` → 201 `{token, expiresInSeconds, user}` |
| POST | `/auth/app/login` | `{email, password}` → 200 `{token, expiresInSeconds, user}` |
| GET | `/auth/me` | 로그인 확인. 토큰이 무효면 401 |
| POST | `/auth/password` | `{currentPassword, newPassword}` → 204. **비밀번호를 바꾸면 기존 토큰이 모두 무효**가 되는데, 이 엔드포인트는 쿠키만 새로 내려 주므로 **앱은 변경 후 다시 로그인**해야 한다(필요하면 앱용 응답을 서버에 추가) |
| (로그아웃) | — | 앱이 토큰을 지우면 끝. 서버 호출 불필요 |

- 토큰 유효기간은 `expiresInSeconds`(현재 7일). 401을 받으면 저장된 토큰을 지우고 로그인 화면으로 보낸다.
- 로그인 실패가 반복되면 IP 기준으로 잠시 막힌다(`LoginAttempts`).
- `user = {id, email, nickname, provider}`

## API
**로그인 불필요**

| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/chat` | 대화. 아래 참고 |
| GET | `/chat/usage` | `{used, limit, day, loggedIn}` 오늘 사용량 |
| GET | `/vehicles/search?q=` | 차종 검색 `{status: match\|candidates\|none, matches[{make, model, bodyType, bodyLabel, fuels[], from, to}]}` |
| GET | `/vehicles/stats` | 카탈로그 통계 |
| GET | `/config/maps` | `{enabled, key}` 구글 지도 키. **웹 도메인 제한 키라 앱에서는 그대로 못 쓴다**(앱용 키를 따로 만들어야 함) |

**로그인 필요(`/me/**`)**

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/me/state` | 최신 차고(Garage). 없으면 404. 응답 헤더 `X-State-Version` |
| PUT | `/me/state` | 차고 저장(전체 교체) → `{version, changed}`. 직전 버전과 같으면 `changed:false` |
| GET | `/me/state/versions?limit=50` | 버전 이력 `[{version, summary, createdAt}]` |
| GET | `/me/state/versions/{v}` | 특정 버전 `{version, state}` |
| POST | `/me/state/versions/{v}/restore` | 그 버전으로 복원(새 버전으로 쌓임) → `{version, state}` |
| GET | `/me/schedules` | 내 모든 일정 `[{id, vehicleId, date, title}]` |
| POST | `/me/schedules` | `{id?, vehicleId, date(YYYY-MM-DD), title(≤60)}` → 201. 같은 id면 그대로, 같은 차량·날짜·제목이면 기존 것을 돌려줌. 차량당 200개 한도 |
| DELETE | `/me/schedules/{id}` | 204 |
| POST | `/me/schedules/import` | 일정 배열을 한꺼번에 옮김(비로그인 → 로그인) → `{saved}` |

### 채팅 `POST /chat`
요청: `{messages:[{role:"user"|"assistant", content}], state: CarState, schedules:[{date,title}]}`
- `messages`는 최대 40개, 마지막은 반드시 `user`. 대화 내용은 앱이 들고 있다가 매번 보낸다(서버는 저장하지 않음).
- `state`는 **선택한 차량 1대**의 CarState. `schedules`는 그 차량의 기존 일정(중복·한도 확인용, 최대 300).

응답: `{reply, state, changes[], usage, actions[], schedules[]}`
- `state`: 서버가 갱신한 CarState → 앱이 선택 차량에 반영하고 저장한다.
- `changes`: 이번에 **코드가 실제로 적용한** 변경 문장들(대화창에 목록으로 표시). 비어 있으면 상태가 안 바뀐 것.
- `schedules`: 대화로 새로 추가된 일정 `[{id,date,title}]` → 앱이 **일정 API(또는 로컬)로 저장**해야 한다. 저장하지 않으면 사라진다.
- `actions`: `{type:"export_excel", scope:"all"|"current"}` → "엑셀 받기" 버튼 표시.
- 되돌리기: 요청 전의 state를 앱이 들고 있다가 복원한다(+ 그 응답으로 추가된 일정 삭제).
- 오류: 429(분당 제한·일일 한도, `message`에 안내), 502(AI 서버 실패 — 한도는 차감되지 않음).

## 데이터 모델 (JSON)
- `Garage`: `{activeId, vehicles:[{id, state: CarState}]}` — 차량 최대 5대
- `CarState`: `{version, vehicle{bodyType, make, model, modelYear, fuelType, verified}, odometer{km, source:"reported"|"estimated", updatedAt}, commute{kmPerDay}, fuel{totalLiters, totalCost, started, litersSinceStart, trackedKm}, services{<key>:{lastKm, lastDate, intervalKm, intervalMonths}}, recent[{at,type,summary}], updatedAt}`
- 정확한 필드와 검증 규칙은 `back/.../state/CarState.java`, 클라이언트 타입은 `front/src/api.ts`.
- `bodyType`: sedan, suv, suv-luxury, van, sedan-sports, truck, truck-flat 등(차급 → 3D 모델 매핑은 `CarViewer.tsx`).
- `fuelType`: gasoline, diesel, lpg, hybrid, electric

## 클라이언트 로직 (앱에서 다시 구현)
| 기능 | 웹 구현 위치 | 비고 |
|---|---|---|
| 소모품 현황 계산(잔여 km·일수, 상태, 임박 순) | `front/src/derive.ts` | 서버의 `ServiceStatus.java`와 같은 규칙. 항목 18개, 연료별로 해당 없는 항목은 제외 |
| 소모품 항목 정의·기본 주기·연료별 보정 | `front/src/services.ts` | `SERVICE_META`, `defaultServices`, `reconcileServices` |
| 직접 입력(주행, 정비, 차량 정보)의 상태 변경 | `front/src/stateOps.ts` | 서버를 거치지 않고 클라이언트가 CarState를 바꾼 뒤 저장 |
| 상태 정규화(빠진 필드 채우기) | `front/src/storage.ts` `normalizeState` | |
| 차고 관리, 비로그인 저장, **게스트→계정 병합**(`mergeGarages`) | `front/src/storage.ts`, `front/src/App.tsx` | 로그인 직후 서버 차고와 로컬 차고를 합치고 → 서버 저장 → 성공 후에만 로컬 삭제 |
| 서버 동기화(변경 500ms 뒤 저장, 로그아웃 전 저장) | `front/src/App.tsx` | |
| 일정 저장 위치 분기(로그인=서버, 아니면 로컬) | `front/src/schedules.ts`, `App.tsx` | |
| 캘린더 이벤트 만들기(교체일·예정일·기록·일정) | `front/src/calendar.ts` | |
| 엑셀 내보내기 | `front/src/exportXlsx.ts` | 앱에서는 `excel` 패키지 등으로 |
| 3D 차량 | `front/src/components/CarViewer.tsx` | 아래 참고 |

## 3D 차량
- 모델: `front/public/models/cute/*.glb` 7종(sedan, sedan-sports, suv, suv-luxury, truck, truck-flat, van). Kenney Car Kit(CC0) 변환본.
- 파트 구분: GLB 노드 이름으로 한다 — `hood`(본네트), `glass`(창문), `wheel*`(바퀴), 그 외는 차체(body). 파트를 누르면 관련 소모품을 보여 준다(`front/src/services.ts`의 `PART_INFO`).
- 동작: **자동 회전 없음, 드래그로 회전**. 마우스(터치) 올림 때만 파트 강조(본네트 색은 차체와 거의 같은 `#7d7370`).
- 후보 패키지: `flutter_3d_controller`, `model_viewer_plus`(WebView), `flutter_scene`, `three_dart` 등. **1단계에서 직접 검증**한다. 막히면 대안: 파트가 구분된 2D 일러스트/스프라이트로 대체.

## 디자인
브랜드 색 `#7B716F`, 귀엽고 로우폴리한 느낌. 모바일 우선. 웹의 `front/src/styles.css`가 색·간격 기준이다.

## 주의
- 개인정보 처리방침/이용약관 페이지: 웹 `#/privacy`, `#/terms`. 스토어 등록용 URL로 쓴다. 스토어 정책상 **앱 안에서 계정 삭제**를 제공해야 하는데, 서버 API가 아직 없다(만들어야 함).
- 지도 키: 웹 키는 도메인 제한이라 앱은 Android 앱 제한(패키지명+SHA-1)을 건 별도 키가 필요하다.
- 푸시 알림은 아직 서버 기능이 없다. `schedule.date` 인덱스가 있어 "내일 일정이 있는 사용자" 조회는 가능하다.
- 서버를 바꾸고 싶으면 이 저장소의 `back/`를 수정해 서버에 배포해야 하는데, 서버 배포는 서버 PC(홈 서버)에서만 된다. 앱 쪽 작업 중 서버 변경이 필요하면 `md/APP.md`에 요청을 적어 두고 서버 쪽 세션에서 처리한다.
