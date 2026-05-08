import { renderDashboard } from './dashboard-chart.js'
import { renderSettings } from './settings-form.js'
import { renderLogs } from './collection-log.js'

// 해시 경로별 렌더링 함수 매핑
const routes = {
  '/': renderDashboard,
  '/settings': renderSettings,
  '/logs': renderLogs,
}

// 현재 해시에 맞는 화면을 렌더링
function router() {
  const hash = location.hash.slice(1) || '/'
  const render = routes[hash] ?? routes['/']
  render()
}

window.addEventListener('hashchange', router)
window.addEventListener('DOMContentLoaded', router)
