# 내차일기

내 차의 주행·주유·정비 이력을 **대화로 기록**하고, 소모품 교체 시점을 한눈에 확인하는 차량 관리 웹앱입니다.
가운데 3D 차량과 Claude 같은 채팅창으로 "오늘 100키로 탔어", "어제 엔진오일 갈았어"처럼 말하면 차량 상태가 갱신됩니다.

- 숫자 계산(잔여 km·일수, 상태 판정)은 AI가 아니라 **코드**가 합니다. AI는 해석과 대화만 맡습니다.
- 차종·연료에 맞춰 소모품 항목과 교체 주기가 달라지고, 데이터가 부족하면 보강 신호를 보여줍니다.
- 여러 대(최대 5대) 관리, 캘린더, 엑셀 내보내기, 모바일 레이아웃을 지원합니다.

자세한 기획과 설계는 [md/PLAN.md](md/PLAN.md)를 참고하세요.

## 기술 스택

| 영역 | 사용 |
|---|---|
| Frontend | React 18, Vite 5, TypeScript, three.js(@react-three/fiber), exceljs |
| Backend | Java 21, Spring Boot 3.3, Spring Security, Flyway, Gradle |
| Database | PostgreSQL 16 |
| AI | OpenAI Chat Completions (function calling) |
| Infra | Docker Compose, nginx |

## 구조

```
back/          Spring Boot API (Docker로 빌드)
front/         React + Vite (nginx로 서빙, /api 는 back으로 프록시)
deploy/nginx/  호스트 nginx 설정 예시
md/PLAN.md     기획서
compose.yaml   db + back + front
```

## 실행

필요한 것: Docker, Docker Compose, OpenAI API 키

```bash
cp .env.example .env
```

`.env`에서 `OPENAI_API_KEY`, `JWT_SECRET`(32자 이상 무작위 문자열)을 채웁니다.

```bash
openssl rand -base64 48
```

```bash
docker compose up -d --build
```

접속: http://localhost:8088

| 서비스 | 주소 |
|---|---|
| 웹 | `localhost:8088` |
| PostgreSQL | `127.0.0.1:5434` (DB/계정 `mycar`) |

백엔드 빌드는 Docker 안에서 이루어지므로 호스트에 JDK나 Node가 없어도 됩니다.

## 환경변수

| 이름 | 설명 | 기본값 |
|---|---|---|
| `OPENAI_API_KEY` | OpenAI API 키 | (필수) |
| `OPENAI_MODEL` | 사용할 모델 | `gpt-4o-mini` |
| `OPENAI_REASONING_EFFORT` | reasoning 모델은 function calling 시 `none` 필요. 비우면 전송 안 함 | `none` |
| `JWT_SECRET` | 로그인 세션 토큰 서명 키 | (필수) |
| `DB_PASSWORD` | DB 비밀번호 | `mycar` |
| `CHAT_LIMIT_PER_MINUTE` | 분당 최대 메시지 수 | `6` |
| `CHAT_DAILY_USER` | 로그인 사용자 하루 한도(KST 0시 초기화) | `60` |
| `CHAT_DAILY_GUEST` | 비로그인 하루 한도(IP 기준) | `20` |

## 개발

프런트엔드 타입 검사:

```bash
cd front && npm install && npx tsc --noEmit
```

변경 반영(예: 프런트만):

```bash
docker compose up -d --build front
```

## 주요 기능

- 대화 기록: 차량 등록, 주행, 주유, 정비, 주행거리, 출퇴근, 교체주기 (GPT function calling, 서버 검증)
- 차종 카탈로그 검증 및 "미확인 차종" 등록
- 소모품 현황: 18개 항목, 연료별 항목, 구간별 주기, 수기 입력·수정
- 3D 차량: 드래그 회전, 파트(본네트·유리·바퀴·차체) 클릭 시 관련 소모품 안내
- 계정: 자체 회원가입/로그인(Argon2id), 버전 스냅샷 저장·되돌리기·변경 이력
- 비로그인 체험 후 로그인 시 데이터 병합
- 엑셀 내보내기, 캘린더, 사용량 제한, 모바일 레이아웃

## 예정

네이버 로그인, 네이버 지도 기반 근처 정비소, 교체 알림, PWA/앱화

## 라이선스 및 크레딧

- 3D 차량 모델: [Kenney](https://www.kenney.nl) Car Kit (CC0). 원본 파일은 저장소에 포함하지 않았고, 앱에서 쓰는 변환본은 `front/public/models/cute/`에 있습니다.
- 차종 카탈로그(`back/src/main/resources/catalog/`)는 초안이며 연식·연료·차급이 실제와 다를 수 있습니다.
- 이 저장소의 코드 라이선스는 아직 정하지 않았습니다.
