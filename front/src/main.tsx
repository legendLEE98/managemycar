import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import LegalPage, { type LegalKind } from './components/LegalPage'
import './styles.css'

/** #/privacy, #/terms 는 앱과 별개의 안내 페이지로 보여 준다. (링크는 새 탭으로 열어 대화 중인 화면을 유지한다) */
const legalKind = (): LegalKind | null => {
  const h = window.location.hash
  return h === '#/privacy' ? 'privacy' : h === '#/terms' ? 'terms' : null
}

function Root() {
  const [kind, setKind] = useState(legalKind)
  useEffect(() => {
    const on = () => setKind(legalKind())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return kind ? <LegalPage kind={kind} /> : <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
