import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    // 테스트 환경을 브라우저 환경과 유사하게 설정
    environment: 'jsdom',
    // describe, it, expect 등을 매번 import 없이 전역 사용
    globals: true,
  },
})
