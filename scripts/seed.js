// Supabase에 개발용 가짜 데이터를 삽입하는 시드 스크립트
// 실행: npm run seed
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// .env 파일에서 환경변수 로드 (node --env-file=.env 로 실행)
const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ .env 파일에 VITE_SUPABASE_URL 과 VITE_SUPABASE_ANON_KEY 를 설정해주세요.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// 샘플 데이터 로드
const sample = JSON.parse(
  readFileSync(join(__dirname, '../data/sample.json'), 'utf-8')
)

async function seed() {
  console.log('🌱 시드 데이터 삽입 시작...\n')

  // 1. 기존 데이터 초기화 (외래키 순서대로 삭제)
  console.log('🗑️  기존 데이터 초기화 중...')
  await supabase.from('collection_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('inquiry_results').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('scraper_fields').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('scraper_configs').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  console.log('   완료\n')

  // 2. scraper_configs 삽입
  console.log('⚙️  스크래핑 설정 삽입 중...')
  const { data: config, error: configErr } = await supabase
    .from('scraper_configs')
    .insert({
      url: sample.config.url,
      button_selector: sample.config.button_selector,
      schedule: sample.config.schedule,
    })
    .select()
    .single()

  if (configErr) {
    console.error('❌ 설정 삽입 실패:', configErr.message)
    process.exit(1)
  }
  console.log(`   config id: ${config.id}\n`)

  // 3. scraper_fields 삽입
  console.log('📋 입력 필드 삽입 중...')
  const fieldRows = sample.fields.map(f => ({
    config_id: config.id,
    field_selector: f.selector,
    field_value: f.value,
  }))
  const { error: fieldsErr } = await supabase.from('scraper_fields').insert(fieldRows)
  if (fieldsErr) {
    console.error('❌ 필드 삽입 실패:', fieldsErr.message)
    process.exit(1)
  }
  console.log(`   ${fieldRows.length}개 필드 삽입 완료\n`)

  // 4. inquiry_results 삽입 (날짜별로 약간씩 다른 데이터 생성)
  console.log('📊 문의 결과 데이터 삽입 중...')
  const resultRows = []
  const today = new Date()

  for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
    const date = new Date(today)
    date.setDate(date.getDate() - dayOffset)
    date.setHours(9, 0, 0, 0)

    for (const item of sample.inquiry_results) {
      // 날짜별로 ±20% 범위에서 랜덤 변동 적용
      const variation = 0.8 + Math.random() * 0.4
      resultRows.push({
        config_id: config.id,
        system_name: item.system_name,
        count: Math.round(item.count * variation),
        collected_at: date.toISOString(),
      })
    }
  }

  const { error: resultsErr } = await supabase.from('inquiry_results').insert(resultRows)
  if (resultsErr) {
    console.error('❌ 문의 결과 삽입 실패:', resultsErr.message)
    process.exit(1)
  }
  console.log(`   ${resultRows.length}건 삽입 완료 (7일치 × ${sample.inquiry_results.length}개 시스템)\n`)

  // 5. collection_logs 삽입
  console.log('📝 수집 로그 삽입 중...')
  const logRows = sample.logs.map((log, i) => {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    date.setHours(9, 0, 0, 0)
    return {
      config_id: config.id,
      status: log.status,
      message: log.message,
      executed_at: date.toISOString(),
    }
  })

  const { error: logsErr } = await supabase.from('collection_logs').insert(logRows)
  if (logsErr) {
    console.error('❌ 로그 삽입 실패:', logsErr.message)
    process.exit(1)
  }
  console.log(`   ${logRows.length}건 삽입 완료\n`)

  console.log('✅ 시드 완료! 대시보드에서 데이터를 확인하세요.')
}

seed().catch(e => {
  console.error('❌ 예상치 못한 오류:', e)
  process.exit(1)
})
