import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// 오프라인·홈 화면 추가 지원. https(또는 localhost)로 배포됐을 때만 등록하고, 실패해도 앱은 그대로 동작한다.
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost') && !import.meta.env.DEV) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
