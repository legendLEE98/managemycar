import { useEffect, useState, type FormEvent } from 'react'
import { login, signup, type User } from '../auth'

type Props = { initialMode: 'login' | 'signup'; onClose: () => void; onDone: (user: User) => void }

export default function AuthModal({ initialMode, onClose, onDone }: Props) {
  const [mode, setMode] = useState(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (mode === 'signup') {
      if (password.length < 8) return setError('비밀번호는 8자 이상으로 입력해 주세요.')
      if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return setError('비밀번호에는 영문과 숫자를 모두 넣어 주세요.')
    }
    setBusy(true)
    try {
      const user = mode === 'login' ? await login(email.trim(), password) : await signup(email.trim(), password, nickname.trim())
      onDone(user)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const switchMode = (m: 'login' | 'signup') => {
    setMode(m)
    setError('')
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal narrow auth" role="dialog" aria-modal="true" aria-label="로그인" onSubmit={submit}>
        <header className="modal-head">
          <div className="auth-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'on' : ''} onClick={() => switchMode('login')}>
              로그인
            </button>
            <button type="button" role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'on' : ''} onClick={() => switchMode('signup')}>
              회원가입
            </button>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </header>

        <div className="modal-body form">
          <button type="button" className="naver-btn" disabled title="네이버 로그인은 준비 중이에요">
            <span className="naver-n">N</span> 네이버로 계속하기 <em>준비 중</em>
          </button>

          <label className="field">
            <span className="field-label">이메일</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required maxLength={255} />
          </label>

          {mode === 'signup' && (
            <label className="field">
              <span className="field-label">닉네임</span>
              <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="2~20자" required minLength={2} maxLength={20} autoComplete="nickname" />
            </label>
          )}

          <label className="field">
            <span className="field-label">비밀번호</span>
            <span className="pw">
              <input
                type={show ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                maxLength={128}
              />
              <button type="button" className="pw-toggle" onClick={() => setShow((v) => !v)}>
                {show ? '숨기기' : '보기'}
              </button>
            </span>
            {mode === 'signup' && <span className="field-note neutral">8자 이상, 영문과 숫자를 모두 포함해 주세요.</span>}
          </label>

          {error && <div className="editor-error" role="alert">{error}</div>}
        </div>

        <footer className="modal-foot actions">
          <button type="button" className="ghost" onClick={onClose}>
            취소
          </button>
          <button type="submit" className="primary" disabled={busy}>
            {busy ? '처리 중…' : mode === 'login' ? '로그인' : '가입하기'}
          </button>
        </footer>
      </form>
    </div>
  )
}
