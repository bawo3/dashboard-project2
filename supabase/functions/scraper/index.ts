import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// HTML 응답에서 시스템별 문의 건수를 추출한다.
// ⚠️ 실제 내부 시스템 HTML 구조를 확인한 후 정규식 패턴을 수정해야 한다.
// 예상 HTML 패턴: <td class="sys-name">ERP</td><td class="count">42</td>
function parseInquiryResults(html: string): Array<{ systemName: string; count: number }> {
  const results: Array<{ systemName: string; count: number }> = []

  const rowPattern =
    /<tr[^>]*>[\s\S]*?<td[^>]*class="sys-name"[^>]*>([\s\S]*?)<\/td>[\s\S]*?<td[^>]*class="count"[^>]*>([\s\S]*?)<\/td>[\s\S]*?<\/tr>/g

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
    // 1. 최신 스크래핑 설정 조회
    const { data: config, error: configErr } = await supabase
      .from('scraper_configs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (configErr || !config) throw new Error('저장된 설정이 없습니다. 환경설정 화면에서 먼저 설정을 저장해주세요.')
    configId = config.id

    // 2. 입력 필드 목록 조회
    const { data: fields } = await supabase
      .from('scraper_fields')
      .select('*')
      .eq('config_id', config.id)

    // 3. 내부 시스템에 폼 POST 요청 (필드값 포함)
    const body = new URLSearchParams()
    for (const f of (fields ?? [])) {
      // 선택자에서 # 또는 . 접두사를 제거해 필드명으로 사용
      const fieldName = f.field_selector.replace(/^[#.]/, '')
      body.append(fieldName, f.field_value)
    }

    const res = await fetch(config.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    if (!res.ok) throw new Error(`내부 시스템 응답 오류: HTTP ${res.status}`)
    const html = await res.text()

    // 4. HTML 파싱으로 시스템별 건수 추출
    const parsed = parseInquiryResults(html)
    if (parsed.length === 0) {
      throw new Error('파싱 결과가 없습니다. parseInquiryResults 함수의 정규식 패턴을 실제 HTML 구조에 맞게 수정해주세요.')
    }

    // 5. inquiry_results에 저장
    const rows = parsed.map(r => ({
      config_id: config.id,
      system_name: r.systemName,
      count: r.count,
    }))
    const { error: insertErr } = await supabase.from('inquiry_results').insert(rows)
    if (insertErr) throw insertErr

    // 6. 성공 로그 기록
    const total = parsed.reduce((s, r) => s + r.count, 0)
    await supabase.from('collection_logs').insert({
      config_id: config.id,
      status: 'success',
      message: `${parsed.length}개 시스템, 총 ${total}건 수집`,
    })

    return new Response(
      JSON.stringify({ success: true, systems: parsed.length, total }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    // 실패 로그 기록
    if (configId) {
      await supabase.from('collection_logs').insert({
        config_id: configId,
        status: 'fail',
        message: e instanceof Error ? e.message : '알 수 없는 오류',
      })
    }

    return new Response(
      JSON.stringify({ success: false, error: String(e) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
