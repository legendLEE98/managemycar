import { useEffect, useState, type FormEvent } from 'react'
import { changePassword } from '../auth'

/** 비밀번호 변경: 현재 비밀번호 확인 후 새 비밀번호로 바꾼다. */
export default function PasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (next.length < 8) return setError('새 비밀번호는 8자 이상으로 입력해 주세요.')
    if (!/[A-Za-z]/.test(next) || !/\d/.test(next)) return setError('새 비밀번호에는 영문과 숫자를 모두 넣어 주세요.')
    if (next === current) return setError('현재 비밀번호와 다른 비밀번호를 입력해 주세요.')
    if (next !== confirm) return setError('새 비밀번호 확인이 일치하지 않아요.')
    setBusy(true)
    try {
      await changePassword(current, next)
      setDone(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const type = show ? 'text' : 'password'

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal narrow" role="dialog" aria-modal="true" aria-label="비밀번호 변경" onSubmit={submit}>
        <header className="modal-head">
          <h2>비밀번호 변경</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </header>

        {done ? (
          <>
            <div className="modal-body form">
              <p className="pw-done">비밀번호를 바꿨어요. 다른 기기에서는 새 비밀번호로 다시 로그인해야 해요.</p>
            </div>
            <footer className="modal-foot actions">
              <button type="button" className="primary" onClick={onClose}>
                확인
              </button>
            </footer>
          </>
        ) : (
          <>
            <div className="modal-body form">
              <label className="field">
                <span className="field-label">현재 비밀번호</span>
                <input type={type} value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required maxLength={128} />
              </label>
              <label className="field">
                <span className="field-label">새 비밀번호</span>
                <input type={type} value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required maxLength={128} />
                <span className="field-note neutral">8자 이상, 영문과 숫자를 모두 포함해 주세요.</span>
              </label>
              <label className="field">
                <span className="field-label">새 비밀번호 확인</span>
                <input type={type} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required maxLength={128} />
              </label>
              <label className="pw-show">
                <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> 비밀번호 보기
              </label>
              {error && (
                <div className="editor-error" role="alert">
                  {error}
                </div>
              )}
            </div>
            <footer className="modal-foot actions">
              <button type="button" className="ghost" onClick={onClose}>
                취소
              </button>
              <button type="submit" className="primary" disabled={busy}>
                {busy ? '처리 중…' : '바꾸기'}
              </button>
            </footer>
          </>
        )}
      </form>
    </div>
  )
}
