# 사내 성과 대시보드 — 설계 스펙

**작성일**: 2026-05-08
**프로젝트**: 사내 IT 시스템별 주간 문의 현황 대시보드
**스택**: HTML5 · CSS3 · Vanilla JS (ES Modules) · Vite 5 · Supabase JS · Chart.js 4 · Vercel

---

## 1. 목적

사내 ERP, CRM, HR 등 IT 시스템별 주간 문의 건수를 자동 수집하여 실시간으로 모니터링한다.
수집은 내부 시스템 URL에 자동으로 폼 요청을 보내 HTML 응답을 파싱하는 방식으로 동작한다.

---

## 2. 전체 아키텍처

```
[내부 시스템 URL (외부 접근 가능)]
      ↓ HTTP POST (폼 필드값 + 조회 버튼 시뮬레이션)
[Supabase Edge Function: scraper]
      ↓ HTML 파싱 → 시스템별 문의 건수 추출
[Supabase PostgreSQL DB]
      ↓ Supabase JS SDK
[Vite 대시보드 (Vercel 배포)]
      ↓ Chart.js 렌더링
[브라우저]
```

**원칙**:
- 대시보드는 DB만 읽는다. 내부 시스템에 직접 접근하지 않는다.
- 스크래핑은 Edge Function이 전담한다. 수동 트리거 및 스케줄 모두 지원한다.
- 설정은 DB에 저장된다. 코드 수정 없이 환경설정 화면에서 변경 가능하다.

---

## 3. 화면 구성

### 3-1. 대시보드 (메인)

- 시스템별 주간 문의 건수 막대 차트 (Chart.js)
- 전체 합계 및 전주 대비 증감 표시
- 마지막 수집 시간 표시
- 상단 네비게이션: 대시보드 / 환경설정 / 수집 로그

### 3-2. 환경설정 (Settings)

사용자가 스크래핑 조건을 직접 설정하는 화면.

| 항목 | 설명 |
|------|------|
| 수집 대상 URL | 내부 시스템 조회 페이지 주소 |
| 조회 버튼 선택자 | 예: `#btnSearch`, `.search-btn` |
| 입력 필드 설정 | 필드 선택자 + 입력값 쌍 (행 추가/삭제 가능) |
| 수집 주기 | 매일 09:00 / 매주 월요일 / 수동만 |
| 시스템명 매핑 | HTML 추출값 → 화면 표시 이름 변환 |
| 저장 버튼 | 설정을 DB에 저장 |
| 지금 수집 버튼 | Edge Function 즉시 수동 트리거 |

### 3-3. 수집 로그

- Edge Function 실행 이력 목록
- 실행 시각, 성공/실패 상태, 수집 건수, 오류 메시지

---

## 4. 데이터 모델 (Supabase PostgreSQL)

```sql
-- 스크래핑 설정
CREATE TABLE scraper_configs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url         text NOT NULL,
  button_selector text NOT NULL,
  schedule    text NOT NULL DEFAULT 'manual', -- 'daily' | 'weekly' | 'manual'
  created_at  timestamptz DEFAULT now()
);

-- 입력 필드 목록 (설정당 여러 개)
CREATE TABLE scraper_fields (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id     uuid REFERENCES scraper_configs(id) ON DELETE CASCADE,
  field_selector text NOT NULL,
  field_value   text NOT NULL
);

-- 수집된 문의 데이터
CREATE TABLE inquiry_results (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id     uuid REFERENCES scraper_configs(id),
  system_name   text NOT NULL,
  count         integer NOT NULL,
  collected_at  timestamptz DEFAULT now()
);

-- 수집 실행 로그
CREATE TABLE collection_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id   uuid REFERENCES scraper_configs(id),
  status      text NOT NULL, -- 'success' | 'fail'
  message     text,
  executed_at timestamptz DEFAULT now()
);
```

---

## 5. 파일 구조

```
dashboard-project2/
├── index.html
├── styles/
│   └── main.css
├── scripts/
│   ├── app.js               ← 페이지 라우터 (hash 기반 SPA)
│   ├── supabase.js          ← Supabase 클라이언트 싱글턴
│   ├── db.js                ← 모든 DB 쿼리 함수
│   ├── dashboard-chart.js   ← Chart.js 렌더링 로직
│   ├── settings-form.js     ← 환경설정 화면 로직
│   └── collection-log.js    ← 수집 로그 화면 로직
├── supabase/
│   └── functions/
│       └── scraper/
│           └── index.ts     ← Edge Function (스크래핑 실행)
├── data/
│   └── sample.json          ← 개발용 목 데이터
├── docs/
│   └── superpowers/
│       └── specs/
│           └── 2026-05-08-dashboard-design.md
├── .env
└── vite.config.js
```

---

## 6. Edge Function 동작 흐름

```
1. DB에서 scraper_configs 읽기
2. scraper_fields 읽기 (필드 선택자 + 값)
3. 내부 시스템 URL에 HTTP POST 요청
   - Content-Type: application/x-www-form-urlencoded
   - Body: scraper_fields 기반으로 구성
4. 응답 HTML 파싱 (정규식 or DOMParser)
   → 시스템명, 문의 건수 추출
5. inquiry_results에 INSERT
6. collection_logs에 성공/실패 기록
```

---

## 7. 라우팅 (Hash 기반 SPA)

| URL | 화면 |
|-----|------|
| `/#/` | 대시보드 (메인) |
| `/#/settings` | 환경설정 |
| `/#/logs` | 수집 로그 |

---

## 8. 제외 범위

- 사용자 인증/로그인 기능 (Supabase 익명 접근 또는 단일 anon key로 운영)
- 내부 시스템이 JavaScript 이벤트 기반(SPA)인 경우의 headless 브라우저 처리
- 모바일 반응형 (PC 전용)
