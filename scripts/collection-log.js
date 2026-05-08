import { getLogs } from './db.js'

// ISO 날짜 문자열을 한국어 형식으로 변환
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
    tbody.innerHTML = '<tr><td colspan="3" class="empty-msg">수집 이력이 없습니다.</td></tr>'
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
