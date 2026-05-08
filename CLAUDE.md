# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## 프로젝트 개요

팀 주간 성과를 실시간으로 모니터링하는 사내 대시보드. Vercel에 배포한다.

**기술 스택**: HTML5 · CSS3 · Vanilla JS (ES Modules) · Vite 5 · Supabase JS · Chart.js 4

---

## 개발 명령어

```bash
npm install       # 의존성 설치
npm run dev       # 로컬 개발 서버 실행
npm run build     # Vercel 배포용 빌드 (출력: dist/)
npm run preview   # 빌드 결과 미리보기
```

---

## 아키텍처

```
scripts/
├── app.js        # 진입점 — 초기화 및 각 모듈 오케스트레이션
├── supabase.js   # Supabase 클라이언트 싱글턴 생성
├── db.js         # 모든 DB 쿼리 함수 (이 파일에만 Supabase 쿼리 작성)
└── chart.js      # Chart.js 인스턴스 생성 및 업데이트
```

데이터 흐름: `app.js` → `db.js` (Supabase 쿼리) → `chart.js` (렌더링)

`data/sample.json`은 Supabase 미연결 시 개발용 목(mock) 데이터로 활용한다.

---

## 환경변수

Supabase 환경변수는 반드시 `VITE_` 접두사를 붙여야 Vite가 클라이언트에 노출한다.

```env
VITE_SUPABASE_URL=https://...
VITE_SUPABASE_ANON_KEY=...
```

코드에서 접근: `import.meta.env.VITE_SUPABASE_URL`

`.env` 파일은 읽기 전용으로 취급한다. 수정하거나 Git에 추가하지 않는다.

---

## 코딩 컨벤션

- **함수명**: camelCase (`loadDashboardData`, `renderWeeklyChart`)
- **파일명**: kebab-case (`dashboard-chart.js`)
- **들여쓰기**: 스페이스 2칸
- **주석**: 한국어
- 외부 라이브러리를 추가할 때는 사용자에게 먼저 확인한다

---

## 커밋 컨벤션

Conventional Commits 형식을 따른다.

```
feat: 주간 성과 차트 추가
fix: Supabase 연결 오류 수정
style: 대시보드 레이아웃 반응형 개선
refactor: loadDashboardData 함수 분리
chore: Vite 설정 업데이트
```

---

## 배포 (Vercel)

`main` 브랜치 푸시 시 자동 빌드·배포. Vercel 프로젝트 환경변수에 `VITE_SUPABASE_URL`과 `VITE_SUPABASE_ANON_KEY`가 설정되어 있어야 한다.
