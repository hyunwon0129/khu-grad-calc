import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// 로그인 서버(Supabase)를 설정한 경우에만 그 주소 하나를 connect-src에 추가한다.
// 설정하지 않으면 connect-src 'self' 그대로 → 앱이 외부로 아무것도 보낼 수 없다.
function cspPlugin(mode: string): Plugin {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  let origin = ''
  try { origin = env.VITE_SUPABASE_URL ? new URL(env.VITE_SUPABASE_URL).origin : '' } catch { origin = '' }
  if (origin && !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(origin) && !origin.startsWith('http://localhost')) {
    throw new Error(`VITE_SUPABASE_URL이 Supabase 주소 형식이 아닙니다: ${origin}`)
  }
  return {
    name: 'csp-connect-src',
    transformIndexHtml(html) {
      if (!origin) return html
      const out = html.replace(/(http-equiv="Content-Security-Policy" content="[^"]*connect-src 'self')/, `$1 ${origin}`)
      if (out === html) throw new Error('CSP connect-src를 찾지 못했습니다')
      return out
    },
  }
}

// PREVIEW=1 이면 미리보기용 단일 파일을 만들기 위해 청크를 하나로 합친다.
const preview = process.env.PREVIEW === '1'

export default defineConfig(({ mode }) => ({
  plugins: [react(), cspPlugin(mode)],
  base: './',
  assetsInclude: ['**/*.bcmap'], // pdf.js 한국어 CMap 내장용
  build: {
    chunkSizeWarningLimit: 2500,
    rolldownOptions: preview ? { output: { codeSplitting: false } } : undefined,
  },
}))
