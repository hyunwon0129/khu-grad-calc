import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// PREVIEW=1 이면 미리보기용 단일 파일을 만들기 위해 청크를 하나로 합친다.
const preview = process.env.PREVIEW === '1'

export default defineConfig({
  plugins: [react()],
  base: './',
  assetsInclude: ['**/*.bcmap'], // pdf.js 한국어 CMap 내장용
  build: {
    chunkSizeWarningLimit: 2500,
    rolldownOptions: preview ? { output: { codeSplitting: false } } : undefined,
  },
})
