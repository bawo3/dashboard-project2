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
        <p id="error-msg" style="margin-top:12px;font-size:13px;color:#d63031;display:none"></p>
      </div>
    </div>
  `

  let configId = null

  // 기존 설정 불러오기 (설정이 없으면 초기 상태 유지)
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
    // 설정 없음 — 신규 입력 상태로 유지
  }

  // 필드 행 추가
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

  // 저장 버튼 처리
  document.getElementById('btn-save').addEventListener('click', async () => {
    const url = document.getElementById('cfg-url').value.trim()
    const buttonSelector = document.getElementById('cfg-btn').value.trim()
    const schedule = document.getElementById('cfg-schedule').value

    if (!url || !buttonSelector) {
      alert('URL과 조회 버튼 선택자를 입력해주세요.')
      return
    }

    try {
      const saved = await saveConfig({ id: configId, url, buttonSelector, schedule })
      configId = saved.id

      const rows = [...document.querySelectorAll('.field-row')]
      const fields = rows
        .map(row => ({
          selector: row.querySelector('[data-type="selector"]').value.trim(),
          value: row.querySelector('[data-type="value"]').value.trim(),
        }))
        .filter(f => f.selector)

      await saveFields(configId, fields)

      const msg = document.getElementById('save-msg')
      msg.style.display = 'block'
      setTimeout(() => { msg.style.display = 'none' }, 3000)
    } catch (e) {
      showError(`저장 실패: ${e.message}`)
    }
  })

  // 지금 수집 버튼 — Edge Function 수동 트리거
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
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      )
      if (!res.ok) throw new Error(await res.text())
      alert('수집이 완료되었습니다. 대시보드를 확인해주세요.')
    } catch (e) {
      showError(`수집 실패: ${e.message}`)
    } finally {
      btn.disabled = false
      btn.textContent = '지금 수집'
    }
  })

  // 에러 메시지 표시 헬퍼
  function showError(msg) {
    const el = document.getElementById('error-msg')
    el.textContent = msg
    el.style.display = 'block'
    setTimeout(() => { el.style.display = 'none' }, 5000)
  }
}
