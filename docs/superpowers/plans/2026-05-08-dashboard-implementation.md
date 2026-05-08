# 사내 성과 대시보드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사내 IT 시스템별 주간 문의 건수를 Supabase Edge Function으로 자동 수집하고, Vanilla JS + Chart.js 대시보드로 시각화한다.

**Architecture:** Edge Function이 내부 시스템 URL에 폼 POST → HTML 파싱 → DB 저장. 프론트엔드는 Hash SPA 라우팅으로 대시보드/환경설정/수집로그 3개 화면을 전환하며, Supabase JS SDK로 DB를 읽어 Chart.js로 렌더링한다.

**Tech Stack:** Vite 5, Vanilla JS (ES Modules), @supabase/supabase-js v2, Chart.js 4, Supabase Edge Functions (Deno), Vitest, Vercel

---

## 파일 구조

| 파일 | 역할 |
|------|------|
| `index.html` | 앱 진입점, 네비게이션 포함 |
| `vite.config.js` | Vite 설정 |
| `styles/main.css` | 전체 스타일 |
| `scripts/supabase.js` | Supabase 클라이언트 싱글턴 |
| `scripts/db.js` | 모든 DB 쿼리 함수 |
| `scripts/app.js` | Hash 기반 SPA 라우터 |
| `scripts/dashboard-chart.js` | 대시보드 화면 + Chart.js |
| `scripts/settings-form.js` | 환경설정 화면 |
| `scripts/collection-log.js` | 수집 로그 화면 |
| `supabase/functions/scraper/index.ts` | Edge Function |
| `tests/db.test.js` | db.js 단위 테스트 |
| `tests/parse.test.js` | HTML 파싱 유틸 테스트 |

---

## Task 1: 프로젝트 의존성 설치 및 기본 설정

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `.env.example`

- [ ] **Step 1: 의존성 설치**

```bash
npm init -y
npm install @supabase/supabase-js chart.js
npm install -D vite vitest
```

- [ ] **Step 2: `vite.config.js` 작성**

```javascript
import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    environment: 'jsdom',
  },
})
```

- [ ] **Step 3: `package.json` scripts 수정**

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 4: `.env.example` 작성**

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

- [ ] **Step 5: 개발 서버 기동 확인**

```bash
npm run dev
```

Expected: `http://localhost:5173` 에서 서버 실행됨

- [ ] **Step 6: 커밋**

```bash
git add package.json package-lock.json vite.config.js .env.example
git commit -m "chore: 프로젝트 의존성 설치 및 Vite 설정"
```

---

## Task 2: Supabase DB 스키마 생성

**Files:**
- Create: `supabase/schema.sql` (참조용)

- [ ] **Step 1: `supabase/schema.sql` 작성**

```sql
-- 스크래핑 설정
CREATE TABLE scraper_configs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url             text NOT NULL,
  button_selector text NOT NULL,
  schedule        text NOT NULL DEFAULT 'manual',
  created_at      timestamptz DEFAULT now()
);

-- 입력 필드 목록
CREATE TABLE scraper_fields (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id       uuid REFERENCES scraper_configs(id) ON DELETE CASCADE,
  field_selector  text NOT NULL,
  field_value     text NOT NULL
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
  status      text NOT NULL,
  message     text,
  executed_at timestamptz DEFAULT now()
);
```

- [ ] **Step 2: Supabase 대시보드에서 SQL 실행**

Supabase 프로젝트 → SQL Editor → `supabase/schema.sql` 내용 붙여넣기 → Run

Expected: 4개 테이블이 Table Editor에 생성됨

- [ ] **Step 3: `.env` 파일 작성 (Git 제외 확인)**

```env
VITE_SUPABASE_URL=https://실제프로젝트주소.supabase.co
VITE_SUPABASE_ANON_KEY=실제anon키
```

- [ ] **Step 4: 커밋**

```bash
git add supabase/schema.sql
git commit -m "chore: Supabase DB 스키마 정의"
```

---

## Task 3: Supabase 클라이언트 + DB 쿼리 레이어

**Files:**
- Create: `scripts/supabase.js`
- Create: `scripts/db.js`
- Create: `tests/db.test.js`

- [ ] **Step 1: `tests/db.test.js` 실패 테스트 먼저 작성**

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Supabase 클라이언트 모킹
vi.mock('../scripts/supabase.js', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

import { supabase } from '../scripts/supabase.js'
import {
  getConfig,
  saveConfig,
  getFields,
  saveFields,
  getInquiryResults,
  getLogs,
  insertLog,
} from '../scripts/db.js'

describe('getConfig', () => {
  it('scraper_configs 테이블에서 첫 번째 설정을 반환한다', async () => {
    const mockData = { id: 'abc', url: 'http://example.com', button_selector: '#btn', schedule: 'daily' }
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockData, error: null }),
          }),
        }),
      }),
    })

    const result = await getConfig()
    expect(result).toEqual(mockData)
  })
})

describe('insertLog', () => {
  it('collection_logs에 성공 로그를 삽입한다', async () => {
    supabase.from.mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    })

    await expect(insertLog('config-id', 'success', '10건 수집')).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
npm test
```

Expected: FAIL — `Cannot find module '../scripts/db.js'`

- [ ] **Step 3: `scripts/supabase.js` 작성**

```javascript
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

- [ ] **Step 4: `scripts/db.js` 작성**

```javascript
import { supabase } from './supabase.js'

// 설정 조회 (최신 1건)
export async function getConfig() {
  const { data, error } = await supabase
    .from('scraper_configs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  if (error) throw error
  return data
}

// 설정 저장 (upsert)
export async function saveConfig({ id, url, buttonSelector, schedule }) {
  const row = { url, button_selector: buttonSelector, schedule }
  if (id) row.id = id

  const { data, error } = await supabase
    .from('scraper_configs')
    .upsert(row)
    .select()
    .single()
  if (error) throw error
  return data
}

// 필드 목록 조회
export async function getFields(configId) {
  const { data, error } = await supabase
    .from('scraper_fields')
    .select('*')
    .eq('config_id', configId)
  if (error) throw error
  return data
}

// 필드 저장 (기존 삭제 후 재삽입)
export async function saveFields(configId, fields) {
  await supabase.from('scraper_fields').delete().eq('config_id', configId)

  if (fields.length === 0) return

  const rows = fields.map(f => ({
    config_id: configId,
    field_selector: f.selector,
    field_value: f.value,
  }))
  const { error } = await supabase.from('scraper_fields').insert(rows)
  if (error) throw error
}

// 문의 결과 조회 (최근 7일)
export async function getInquiryResults() {
  const since = new Date()
  since.setDate(since.getDate() - 7)

  const { data, error } = await supabase
    .from('inquiry_results')
    .select('*')
    .gte('collected_at', since.toISOString())
    .order('collected_at', { ascending: false })
  if (error) throw error
  return data
}

// 수집 로그 조회 (최근 20건)
export async function getLogs() {
  const { data, error } = await supabase
    .from('collection_logs')
    .select('*')
    .order('executed_at', { ascending: false })
    .limit(20)
  if (error) throw error
  return data
}

// 수집 로그 삽입
export async function insertLog(configId, status, message) {
  const { error } = await supabase
    .from('collection_logs')
    .insert({ config_id: configId, status, message })
  if (error) throw error
}
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
npm test
```

Expected: PASS (2 tests)

- [ ] **Step 6: 커밋**

```bash
git add scripts/supabase.js scripts/db.js tests/db.test.js
git commit -m "feat: Supabase 클라이언트 및 DB 쿼리 레이어 구현"
```

---

## Task 4: index.html + Hash SPA 라우터

**Files:**
- Create: `index.html`
- Create: `scripts/app.js`

- [ ] **Step 1: `index.html` 작성**

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>사내 성과 대시보드</title>
  <link rel="stylesheet" href="/styles/main.css" />
</head>
<body>
  <nav class="nav">
    <span class="nav-brand">📊 성과 대시보드</span>
    <div class="nav-links">
      <a href="#/">대시보드</a>
      <a href="#/settings">환경설정</a>
      <a href="#/logs">수집 로그</a>
    </div>
  </nav>
  <main id="app"></main>
  <script type="module" src="/scripts/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: `scripts/app.js` 작성**

```javascript
import { renderDashboard } from './dashboard-chart.js'
import { renderSettings } from './settings-form.js'
import { renderLogs } from './collection-log.js'

const routes = {
  '/': renderDashboard,
  '/settings': renderSettings,
  '/logs': renderLogs,
}

// 현재 hash에 맞는 화면을 렌더링
function router() {
  const hash = location.hash.slice(1) || '/'
  const render = routes[hash] ?? routes['/']
  render()
}

window.addEventListener('hashchange', router)
window.addEventListener('DOMContentLoaded', router)
```

- [ ] **Step 3: 브라우저에서 라우팅 확인**

```bash
npm run dev
```

브라우저에서 `http://localhost:5173` 접속 → 네비게이션 링크 클릭 시 hash가 바뀌는지 확인

Expected: 각 링크 클릭 시 URL이 `#/`, `#/settings`, `#/logs`로 변경됨 (콘텐츠는 다음 Task에서 구현)

- [ ] **Step 4: 커밋**

```bash
git add index.html scripts/app.js
git commit -m "feat: index.html 및 Hash SPA 라우터 구현"
```

---

## Task 5: 전체 CSS 스타일

**Files:**
- Create: `styles/main.css`

- [ ] **Step 1: `styles/main.css` 작성**

```css
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'Segoe UI', sans-serif;
  background: #f5f6fa;
  color: #2d3436;
  min-height: 100vh;
}

/* 네비게이션 */
.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  height: 56px;
  background: #2d3436;
  color: #fff;
}

.nav-brand {
  font-size: 18px;
  font-weight: 700;
}

.nav-links a {
  color: #dfe6e9;
  text-decoration: none;
  margin-left: 24px;
  font-size: 14px;
  transition: color 0.2s;
}

.nav-links a:hover {
  color: #fff;
}

/* 페이지 공통 */
.page {
  max-width: 960px;
  margin: 32px auto;
  padding: 0 24px;
}

.page-title {
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 24px;
}

/* 카드 */
.card {
  background: #fff;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  margin-bottom: 24px;
}

/* 요약 수치 */
.summary-row {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
}

.summary-card {
  flex: 1;
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  text-align: center;
}

.summary-card .label {
  font-size: 13px;
  color: #636e72;
  margin-bottom: 8px;
}

.summary-card .value {
  font-size: 28px;
  font-weight: 700;
  color: #2d3436;
}

.summary-card .diff {
  font-size: 13px;
  margin-top: 4px;
}

.diff.up { color: #e17055; }
.diff.down { color: #00b894; }

/* 폼 */
.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
}

.form-group label {
  font-size: 13px;
  font-weight: 600;
  color: #636e72;
}

.form-group input,
.form-group select {
  padding: 10px 12px;
  border: 1px solid #dfe6e9;
  border-radius: 6px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.form-group input:focus,
.form-group select:focus {
  border-color: #74b9ff;
}

/* 필드 행 */
.field-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}

.field-row input {
  flex: 1;
  padding: 8px 10px;
  border: 1px solid #dfe6e9;
  border-radius: 6px;
  font-size: 14px;
}

/* 버튼 */
.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn:hover { opacity: 0.85; }
.btn-primary { background: #0984e3; color: #fff; }
.btn-secondary { background: #dfe6e9; color: #2d3436; }
.btn-danger { background: #d63031; color: #fff; }
.btn-sm { padding: 6px 12px; font-size: 13px; }

.btn-row {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

/* 테이블 */
.log-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.log-table th,
.log-table td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid #f0f0f0;
}

.log-table th {
  font-weight: 600;
  color: #636e72;
  background: #f8f9fa;
}

.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.badge-success { background: #d4efdf; color: #1e8449; }
.badge-fail { background: #fadbd8; color: #c0392b; }

/* 마지막 수집 시각 */
.last-collected {
  font-size: 13px;
  color: #636e72;
  margin-bottom: 16px;
}
```

- [ ] **Step 2: 브라우저에서 스타일 확인**

```bash
npm run dev
```

Expected: 네비게이션 바가 어두운 배경으로 표시됨

- [ ] **Step 3: 커밋**

```bash
git add styles/main.css
git commit -m "style: 전체 CSS 레이아웃 및 컴포넌트 스타일 작성"
```

---

## Task 6: 대시보드 화면 (Chart.js)

**Files:**
- Create: `scripts/dashboard-chart.js`

- [ ] **Step 1: `scripts/dashboard-chart.js` 작성**

```javascript
import Chart from 'chart.js/auto'
import { getInquiryResults } from './db.js'

let chartInstance = null

// 시스템별 최신 문의 건수를 집계
function aggregateBySystem(results) {
  const map = {}
  for (const row of results) {
    if (!map[row.system_name] || row.collected_at > map[row.system_name].collected_at) {
      map[row.system_name] = row
    }
  }
  return Object.values(map)
}

// 전체 합계 계산
function calcTotal(rows) {
  return rows.reduce((sum, r) => sum + r.count, 0)
}

// 마지막 수집 시각 포맷
function formatDate(isoStr) {
  if (!isoStr) return '-'
  return new Date(isoStr).toLocaleString('ko-KR')
}

export async function renderDashboard() {
  const app = document.getElementById('app')
  app.innerHTML = `
    <div class="page">
      <h1 class="page-title">주간 문의 현황</h1>
      <div class="summary-row" id="summary-row">
        <div class="summary-card">
          <div class="label">전체 문의 건수</div>
          <div class="value" id="total-count">-</div>
        </div>
        <div class="summary-card">
          <div class="label">마지막 수집</div>
          <div class="value" style="font-size:16px" id="last-time">-</div>
        </div>
      </div>
      <div class="card">
        <canvas id="inquiry-chart" height="300"></canvas>
      </div>
      <p id="empty-msg" style="display:none;color:#636e72;text-align:center">
        수집된 데이터가 없습니다. 환경설정 후 수집을 실행해주세요.
      </p>
    </div>
  `

  const results = await getInquiryResults()
  const aggregated = aggregateBySystem(results)

  if (aggregated.length === 0) {
    document.getElementById('empty-msg').style.display = 'block'
    document.querySelector('.card').style.display = 'none'
    return
  }

  document.getElementById('total-count').textContent = calcTotal(aggregated).toLocaleString()
  document.getElementById('last-time').textContent = formatDate(
    results[0]?.collected_at
  )

  const labels = aggregated.map(r => r.system_name)
  const counts = aggregated.map(r => r.count)

  // 기존 차트 인스턴스가 있으면 제거
  if (chartInstance) chartInstance.destroy()

  const ctx = document.getElementById('inquiry-chart').getContext('2d')
  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: '문의 건수',
        data: counts,
        backgroundColor: '#74b9ff',
        borderRadius: 6,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.parsed.y.toLocaleString()}건`,
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: v => v.toLocaleString(),
          },
        },
      },
    },
  })
}
```

- [ ] **Step 2: 브라우저에서 대시보드 확인**

```bash
npm run dev
```

`http://localhost:5173/#/` 접속 → "수집된 데이터가 없습니다" 메시지 표시 확인

Expected: 빈 상태 메시지가 표시되며 오류 없음

- [ ] **Step 3: `data/sample.json`으로 차트 렌더링 수동 확인**

`renderDashboard()` 내 `getInquiryResults()` 호출 부분을 임시로 아래로 교체:

```javascript
// 임시 샘플 데이터
const results = [
  { system_name: 'ERP', count: 42, collected_at: new Date().toISOString() },
  { system_name: 'CRM', count: 28, collected_at: new Date().toISOString() },
  { system_name: 'HR', count: 15, collected_at: new Date().toISOString() },
]
```

브라우저에서 막대 차트 표시 확인 후 원래 코드로 되돌리기

- [ ] **Step 4: 커밋**

```bash
git add scripts/dashboard-chart.js
git commit -m "feat: 대시보드 화면 및 Chart.js 막대 차트 구현"
```

---

## Task 7: 환경설정 화면

**Files:**
- Create: `scripts/settings-form.js`

- [ ] **Step 1: `scripts/settings-form.js` 작성**

```javascript
import { getConfig, saveConfig, getFields, saveFields } from './db.js'

export async function renderSettings() {
  const app = document.getElementById('app')
  app.innerHTML = `
    <div class="page">
      <h1 class="page-title">환경설정</h1>
      <div class="card">
        <div class="form-group">
          <label>수집 대상 URL</label>
          <input id="cfg-url" type="url" placeholder="https://internal-system.example.com/inquiry" />
        </div>
        <div class="form-group">
          <label>조회 버튼 선택자</label>
          <input id="cfg-btn" type="text" placeholder="#btnSearch 또는 .search-btn" />
        </div>
        <div class="form-group">
          <label>수집 주기</label>
          <select id="cfg-schedule">
            <option value="manual">수동만</option>
            <option value="daily">매일 09:00</option>
            <option value="weekly">매주 월요일 09:00</option>
          </select>
        </div>

        <div class="form-group">
          <label>입력 필드 설정</label>
          <div id="fields-container"></div>
          <button class="btn btn-secondary btn-sm" id="btn-add-field">+ 필드 추가</button>
        </div>

        <div class="btn-row">
          <button class="btn btn-primary" id="btn-save">저장</button>
          <button class="btn btn-secondary" id="btn-trigger">지금 수집</button>
        </div>
        <p id="save-msg" style="margin-top:12px;font-size:13px;color:#00b894;display:none">저장되었습니다.</p>
      </div>
    </div>
  `

  let configId = null

  // 기존 설정 불러오기
  try {
    const config = await getConfig()
    if (config) {
      configId = config.id
      document.getElementById('cfg-url').value = config.url
      document.getElementById('cfg-btn').value = config.button_selector
      document.getElementById('cfg-schedule').value = config.schedule

      const fields = await getFields(config.id)
      fields.forEach(f => addFieldRow(f.field_selector, f.field_value))
    }
  } catch {
    // 설정 없음 — 초기 상태
  }

  // 필드 행 추가 함수
  function addFieldRow(selector = '', value = '') {
    const container = document.getElementById('fields-container')
    const row = document.createElement('div')
    row.className = 'field-row'
    row.innerHTML = `
      <input type="text" placeholder="필드 선택자 (예: #startDate)" value="${selector}" data-type="selector" />
      <input type="text" placeholder="입력값 (예: 2026-01-01)" value="${value}" data-type="value" />
      <button class="btn btn-danger btn-sm">삭제</button>
    `
    row.querySelector('.btn-danger').addEventListener('click', () => row.remove())
    container.appendChild(row)
  }

  document.getElementById('btn-add-field').addEventListener('click', () => addFieldRow())

  // 저장 버튼
  document.getElementById('btn-save').addEventListener('click', async () => {
    const url = document.getElementById('cfg-url').value.trim()
    const buttonSelector = document.getElementById('cfg-btn').value.trim()
    const schedule = document.getElementById('cfg-schedule').value

    if (!url || !buttonSelector) {
      alert('URL과 조회 버튼 선택자를 입력해주세요.')
      return
    }

    const saved = await saveConfig({ id: configId, url, buttonSelector, schedule })
    configId = saved.id

    // 필드 저장
    const rows = [...document.querySelectorAll('.field-row')]
    const fields = rows.map(row => ({
      selector: row.querySelector('[data-type="selector"]').value.trim(),
      value: row.querySelector('[data-type="value"]').value.trim(),
    })).filter(f => f.selector)

    await saveFields(configId, fields)

    const msg = document.getElementById('save-msg')
    msg.style.display = 'block'
    setTimeout(() => { msg.style.display = 'none' }, 3000)
  })

  // 지금 수집 버튼 → Edge Function 수동 트리거
  document.getElementById('btn-trigger').addEventListener('click', async () => {
    const btn = document.getElementById('btn-trigger')
    btn.disabled = true
    btn.textContent = '수집 중...'

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scraper`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      )
      if (!res.ok) throw new Error(await res.text())
      alert('수집이 완료되었습니다. 대시보드를 확인해주세요.')
    } catch (e) {
      alert(`수집 실패: ${e.message}`)
    } finally {
      btn.disabled = false
      btn.textContent = '지금 수집'
    }
  })
}
```

- [ ] **Step 2: 브라우저에서 환경설정 확인**

`http://localhost:5173/#/settings` 접속

Expected:
- URL, 버튼 선택자, 수집 주기 입력 폼 표시
- "필드 추가" 클릭 시 행 추가됨
- "저장" 클릭 시 "저장되었습니다" 메시지 표시 (Supabase 연결 필요)

- [ ] **Step 3: 커밋**

```bash
git add scripts/settings-form.js
git commit -m "feat: 환경설정 화면 구현 (설정 저장 및 수동 수집 트리거)"
```

---

## Task 8: 수집 로그 화면

**Files:**
- Create: `scripts/collection-log.js`

- [ ] **Step 1: `scripts/collection-log.js` 작성**

```javascript
import { getLogs } from './db.js'

function formatDate(isoStr) {
  return new Date(isoStr).toLocaleString('ko-KR')
}

export async function renderLogs() {
  const app = document.getElementById('app')
  app.innerHTML = `
    <div class="page">
      <h1 class="page-title">수집 로그</h1>
      <div class="card">
        <table class="log-table">
          <thead>
            <tr>
              <th>실행 시각</th>
              <th>상태</th>
              <th>메시지</th>
            </tr>
          </thead>
          <tbody id="log-body">
            <tr><td colspan="3" style="text-align:center;color:#636e72">불러오는 중...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `

  const logs = await getLogs()
  const tbody = document.getElementById('log-body')

  if (logs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#636e72">수집 이력이 없습니다.</td></tr>'
    return
  }

  tbody.innerHTML = logs.map(log => `
    <tr>
      <td>${formatDate(log.executed_at)}</td>
      <td>
        <span class="badge ${log.status === 'success' ? 'badge-success' : 'badge-fail'}">
          ${log.status === 'success' ? '성공' : '실패'}
        </span>
      </td>
      <td>${log.message ?? '-'}</td>
    </tr>
  `).join('')
}
```

- [ ] **Step 2: 브라우저에서 로그 화면 확인**

`http://localhost:5173/#/logs` 접속

Expected: "수집 이력이 없습니다." 메시지 표시 (Supabase 연결 시 실제 데이터 표시)

- [ ] **Step 3: 커밋**

```bash
git add scripts/collection-log.js
git commit -m "feat: 수집 로그 화면 구현"
```

---

## Task 9: Supabase Edge Function (스크래퍼)

**Files:**
- Create: `supabase/functions/scraper/index.ts`

> ⚠️ HTML 파싱 로직(`parseInquiryResults`)은 실제 내부 시스템의 HTML 구조를 확인한 뒤 정규식 패턴을 수정해야 한다.

- [ ] **Step 1: `supabase/functions/scraper/index.ts` 작성**

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// HTML에서 시스템별 문의 건수를 추출한다.
// ⚠️ 실제 내부 시스템 HTML 구조에 맞게 정규식을 수정해야 한다.
function parseInquiryResults(html: string): Array<{ systemName: string; count: number }> {
  const results: Array<{ systemName: string; count: number }> = []

  // 예시 패턴: <td class="sys-name">ERP</td><td class="count">42</td>
  // 실제 HTML 구조를 확인하고 아래 정규식을 수정할 것
  const rowPattern = /<tr[^>]*>[\s\S]*?<td[^>]*class="sys-name"[^>]*>([\s\S]*?)<\/td>[\s\S]*?<td[^>]*class="count"[^>]*>([\s\S]*?)<\/td>[\s\S]*?<\/tr>/g

  let match
  while ((match = rowPattern.exec(html)) !== null) {
    const systemName = match[1].trim()
    const count = parseInt(match[2].replace(/,/g, '').trim(), 10)
    if (systemName && !isNaN(count)) {
      results.push({ systemName, count })
    }
  }

  return results
}

Deno.serve(async () => {
  let configId: string | null = null

  try {
    // 1. 설정 읽기
    const { data: config, error: configErr } = await supabase
      .from('scraper_configs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (configErr || !config) throw new Error('설정이 없습니다.')
    configId = config.id

    // 2. 입력 필드 읽기
    const { data: fields } = await supabase
      .from('scraper_fields')
      .select('*')
      .eq('config_id', config.id)

    // 3. 내부 시스템에 POST 요청
    const body = new URLSearchParams()
    for (const f of (fields ?? [])) {
      body.append(f.field_selector.replace(/^#/, ''), f.field_value)
    }

    const res = await fetch(config.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const html = await res.text()

    // 4. HTML 파싱
    const parsed = parseInquiryResults(html)
    if (parsed.length === 0) throw new Error('파싱 결과가 없습니다. parseInquiryResults 정규식을 확인하세요.')

    // 5. 결과 저장
    const rows = parsed.map(r => ({
      config_id: config.id,
      system_name: r.systemName,
      count: r.count,
    }))
    await supabase.from('inquiry_results').insert(rows)

    // 6. 성공 로그
    await supabase.from('collection_logs').insert({
      config_id: config.id,
      status: 'success',
      message: `${parsed.length}개 시스템, 총 ${parsed.reduce((s, r) => s + r.count, 0)}건 수집`,
    })

    return new Response(JSON.stringify({ success: true, count: parsed.length }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    // 실패 로그
    if (configId) {
      await supabase.from('collection_logs').insert({
        config_id: configId,
        status: 'fail',
        message: e instanceof Error ? e.message : '알 수 없는 오류',
      })
    }

    return new Response(JSON.stringify({ success: false, error: String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
```

- [ ] **Step 2: Supabase CLI로 Edge Function 로컬 테스트**

```bash
npx supabase functions serve scraper --env-file .env
```

다른 터미널에서:

```bash
curl -X POST http://localhost:54321/functions/v1/scraper \
  -H "Authorization: Bearer $(cat .env | grep VITE_SUPABASE_ANON_KEY | cut -d= -f2)"
```

Expected: `{"success":true}` 또는 설정 없는 경우 `{"success":false,"error":"설정이 없습니다."}`

- [ ] **Step 3: Edge Function 배포**

```bash
npx supabase functions deploy scraper
```

- [ ] **Step 4: 커밋**

```bash
git add supabase/functions/scraper/index.ts
git commit -m "feat: Supabase Edge Function 스크래퍼 구현"
```

---

## Task 10: Vercel 배포 설정 및 최종 확인

**Files:**
- Create: `vercel.json`

- [ ] **Step 1: `vercel.json` 작성**

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": null
}
```

- [ ] **Step 2: Vercel 환경변수 설정**

Vercel 프로젝트 Settings → Environment Variables:

```
VITE_SUPABASE_URL      = https://실제프로젝트.supabase.co
VITE_SUPABASE_ANON_KEY = 실제anon키
```

- [ ] **Step 3: 빌드 확인**

```bash
npm run build
```

Expected: `dist/` 폴더 생성, 오류 없음

- [ ] **Step 4: Vercel 배포 및 동작 확인**

```bash
git push origin main
```

Vercel 대시보드에서 배포 완료 후:
- `https://your-app.vercel.app/#/` — 대시보드 확인
- `https://your-app.vercel.app/#/settings` — 환경설정에서 URL 입력 후 저장
- "지금 수집" 버튼 클릭 → 수집 로그 확인
- 대시보드로 돌아와 차트 표시 확인

- [ ] **Step 5: 최종 커밋**

```bash
git add vercel.json
git commit -m "chore: Vercel 배포 설정 추가"
git push origin main
```

---

## 완료 기준

- [ ] 환경설정에서 URL, 버튼 선택자, 필드를 저장할 수 있다
- [ ] "지금 수집" 버튼 클릭 시 Edge Function이 실행되어 DB에 결과가 저장된다
- [ ] 대시보드에 시스템별 문의 건수가 막대 차트로 표시된다
- [ ] 수집 로그 화면에서 성공/실패 이력을 확인할 수 있다
- [ ] Vercel에 배포 후 정상 동작한다

---

## 참고: HTML 파싱 수정 방법

내부 시스템의 실제 HTML 구조를 확인하려면:

1. 내부 시스템 접속 → 조회 버튼 클릭
2. `F12` → Elements 탭에서 결과 테이블 HTML 구조 확인
3. `supabase/functions/scraper/index.ts`의 `parseInquiryResults` 함수 내 `rowPattern` 정규식 수정
