import { describe, it, expect, vi, beforeEach } from 'vitest'

// Supabase 클라이언트 모킹 - 실제 DB 연결 없이 테스트 가능하게 함
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

// 각 테스트 전에 mock 상태를 초기화해 테스트 간 상태 누출 방지
beforeEach(() => {
  supabase.from.mockReset()
})

describe('getConfig', () => {
  it('scraper_configs 테이블에서 첫 번째 설정을 반환한다', async () => {
    // 모의(mock) 데이터 준비
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
    // insert 체인 모킹
    supabase.from.mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    })

    await expect(insertLog('config-id', 'success', '10건 수집')).resolves.toBeUndefined()
  })
})
