import { supabase } from './supabase.js'

// 설정 조회 - scraper_configs 테이블에서 가장 최근 1건을 가져옴
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

// 설정 저장 - id가 있으면 수정(upsert), 없으면 새로 삽입
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

// 필드 목록 조회 - 특정 설정(configId)에 속한 필드 전체를 가져옴
export async function getFields(configId) {
  const { data, error } = await supabase
    .from('scraper_fields')
    .select('*')
    .eq('config_id', configId)
  if (error) throw error
  return data
}

// 필드 저장 - 기존 필드를 모두 삭제한 뒤 새 필드를 일괄 삽입
export async function saveFields(configId, fields) {
  // 기존 데이터 삭제 - 실패 시 중복 삽입 방지를 위해 에러를 throw
  const { error: deleteError } = await supabase.from('scraper_fields').delete().eq('config_id', configId)
  if (deleteError) throw deleteError

  // 새로 추가할 필드가 없으면 종료
  if (fields.length === 0) return

  // DB에 저장할 형식으로 변환
  const rows = fields.map(f => ({
    config_id: configId,
    field_selector: f.selector,
    field_value: f.value,
  }))
  const { error } = await supabase.from('scraper_fields').insert(rows)
  if (error) throw error
}

// 문의 결과 조회 - 최근 7일간의 inquiry_results 데이터를 최신순으로 가져옴
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

// 수집 로그 조회 - collection_logs 테이블에서 최근 20건을 최신순으로 가져옴
export async function getLogs() {
  const { data, error } = await supabase
    .from('collection_logs')
    .select('*')
    .order('executed_at', { ascending: false })
    .limit(20)
  if (error) throw error
  return data
}

// 수집 로그 삽입 - 실행 결과(성공/실패)와 메시지를 collection_logs에 기록
export async function insertLog(configId, status, message) {
  const { error } = await supabase
    .from('collection_logs')
    .insert({ config_id: configId, status, message })
  if (error) throw error
}
