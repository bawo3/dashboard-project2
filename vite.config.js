import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    // 테스트 환경을 브라우저 환경과 유사하게 설정
    environment: 'jsdom',
  },
})
