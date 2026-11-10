import { useEffect } from 'react'
import type { User } from '../auth'

type Props = {
  user: User
  vehicleCount: number
  onClose: () => void
  onPassword: () => void
  onHistory: () => void
  onLogout: () => void
}

/** 웹 마이페이지: 계정 정보와 계정 관련 기능 모음 */
export default function MyPageModal({ user, vehicleCount, onClose, onPassword, onHistory, onLogout }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const local = user.provider === 'local'

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal narrow" role="dialog" aria-modal="true" aria-label="마이페이지">
        <header className="modal-head">
          <h2>마이페이지</h2>
          <button className="modal-close" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </header>

        <div className="modal-body form">
          <div className="mp-profile">
            <span className="mp-avatar" aria-hidden>
              {user.nickname.slice(0, 1)}
            </span>
            <div>
              <b>{user.nickname}님</b>
              <small>{user.email}</small>
            </div>
          </div>

          <dl className="mp-kv plain">
            <dt>등록한 차량</dt>
            <dd>{vehicleCount}대</dd>
            <dt>가입 방식</dt>
            <dd>{user.provider === 'naver' ? '네이버' : '이메일'}</dd>
          </dl>

          <div className="mp-list">
            {local && (
              <button className="mp-row" onClick={onPassword}>
                <span>
                  <b>비밀번호 변경</b>
                  <small>현재 비밀번호를 확인하고 새 비밀번호로 바꿔요</small>
                </span>
                <i aria-hidden>›</i>
              </button>
            )}
            <button className="mp-row" onClick={onHistory}>
              <span>
                <b>변경 이력</b>
                <small>내 차 정보가 저장된 버전을 보고 되돌려요</small>
              </span>
              <i aria-hidden>›</i>
            </button>
          </div>
        </div>

        <footer className="modal-foot actions">
          <button type="button" className="ghost" onClick={onLogout}>
            로그아웃
          </button>
          <button type="button" className="primary" onClick={onClose}>
            닫기
          </button>
        </footer>
      </div>
    </div>
  )
}
