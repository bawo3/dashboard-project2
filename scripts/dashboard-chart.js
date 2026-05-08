import Chart from 'chart.js/auto'
import { getInquiryResults } from './db.js'

// 이전에 생성된 차트 인스턴스 (중복 생성 방지)
let chartInstance = null

// 시스템별 가장 최근 수집 결과만 추출 (같은 시스템이 여러 번 수집된 경우 최신 것만 사용)
function aggregateBySystem(results) {
  const map = {}
  for (const row of results) {
    if (!map[row.system_name] || row.collected_at > map[row.system_name].collected_at) {
      map[row.system_name] = row
    }
  }
  return Object.values(map)
}

// 전체 문의 건수 합계 계산
function calcTotal(rows) {
  return rows.reduce((sum, r) => sum + r.count, 0)
}

// ISO 날짜 문자열을 한국어 형식으로 변환
function formatDate(isoStr) {
  if (!isoStr) return '-'
  return new Date(isoStr).toLocaleString('ko-KR')
}

export async function renderDashboard() {
  const app = document.getElementById('app')
  app.innerHTML = `
    <div class="page">
      <h1 class="page-title">주간 문의 현황</h1>
      <div class="summary-row">
        <div class="summary-card">
          <div class="label">전체 문의 건수</div>
          <div class="value" id="total-count">-</div>
        </div>
        <div class="summary-card">
          <div class="label">마지막 수집</div>
          <div class="value" style="font-size:16px" id="last-time">-</div>
        </div>
      </div>
      <div class="card" id="chart-card">
        <canvas id="inquiry-chart" height="300"></canvas>
      </div>
      <p class="empty-msg" id="empty-msg" style="display:none">
        수집된 데이터가 없습니다. 환경설정 후 수집을 실행해주세요.
      </p>
    </div>
  `

  const results = await getInquiryResults()
  const aggregated = aggregateBySystem(results)

  if (aggregated.length === 0) {
    document.getElementById('empty-msg').style.display = 'block'
    document.getElementById('chart-card').style.display = 'none'
    return
  }

  document.getElementById('total-count').textContent = calcTotal(aggregated).toLocaleString()
  document.getElementById('last-time').textContent = formatDate(results[0]?.collected_at)

  const labels = aggregated.map(r => r.system_name)
  const counts = aggregated.map(r => r.count)

  // 기존 차트 인스턴스가 있으면 제거 후 재생성
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
          ticks: { callback: v => v.toLocaleString() },
        },
      },
    },
  })
}
