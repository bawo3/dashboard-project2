import { createClient } from '@supabase/supabase-js'

// 환경변수에서 Supabase URL과 익명 키를 읽어 클라이언트 생성
// 실제 값은 .env 파일에 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY로 설정
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
