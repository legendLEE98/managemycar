import { useEffect, useRef } from 'react'
import type { CarState, Garage } from '../api'
import type { User } from '../auth'
import type { Schedule } from '../schedules'
import ExportButton from './ExportButton'
import Sidebar from './Sidebar'
import VehicleList from './VehicleList'

type Props = {
  state: CarState
  user: User | null
  authReady: boolean
  garage: Garage
  schedules: Schedule[]
  onSwitchVehicle: (id: string) => void
  onAddVehicle: () => void
  onRemoveVehicle: (id: string) => void
  onPickExample: (text: string) => void
  onClose: () => void
  onLogin: () => void
  onSignup: () => void
  onLogout: () => void
  onHistory: () => void
  onPassword: () => void
}

/**
 * 모바일 메뉴 페이지: 아래에서 올라와 화면을 덮는다.
 * 내용은 PC의 좌측 사이드바와 같고, 아래로 당기면(위쪽 영역이 드러나면) 마이페이지가 나온다.
 */
export default function MobileMenu({
  state,
  user,
  authReady,
  garage,
  schedules,
  onSwitchVehicle,
  onAddVehicle,
  onRemoveVehicle,
  onPickExample,
  onClose,
  onLogin,
  onSignup,
  onLogout,
  onHistory,
  onPassword,
}: Props) {
  const scroller = useRef<HTMLDivElement>(null)
  const mypage = useRef<HTMLElement>(null)

  useEffect(() => {
    // 처음에는 메뉴 내용이 보이도록 마이페이지 영역만큼 내려 둔다. 아래로 당기면 마이페이지가 드러난다.
    const el = scroller.current
    const my = mypage.current
    if (el && my) el.scrollTop = my.offsetHeight
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const showMypage = () => scroller.current?.scrollTo({ top: 0, behavior: 'smooth' })

  return (
    <div className="mmenu" role="dialog" aria-modal="true" aria-label="메뉴">
      <button className="mmenu-close" onClick={onClose} aria-label="메뉴 닫기">
        ✕
      </button>

      <div className="mmenu-scroll" ref={scroller}>
        <section className="mypage" ref={mypage}>
          <h2>마이페이지</h2>
          {!authReady ? null : user ? (
            <>
              <div className="mp-profile">
                <span className="mp-avatar" aria-hidden>
                  {user.nickname.slice(0, 1)}
                </span>
                <div>
                  <b>{user.nickname}님</b>
                  <small>{user.email}</small>
                </div>
              </div>
              <dl className="mp-kv">
                <dt>등록한 차량</dt>
                <dd>{garage.vehicles.length}대</dd>
                <dt>가입 방식</dt>
                <dd>{user.provider === 'naver' ? '네이버' : '이메일'}</dd>
              </dl>
              <div className="mp-actions">
                {user.provider === 'local' && (
                  <button className="btn ghost" onClick={onPassword}>
                    비밀번호 변경
                  </button>
                )}
                <button className="btn ghost" onClick={onHistory}>
                  변경 이력
                </button>
                <button className="btn ghost" onClick={onLogout}>
                  로그아웃
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="mp-guest">로그인하면 내 차 정보가 계정에 저장되어 다른 기기에서도 이어서 볼 수 있어요.</p>
              <div className="mp-actions">
                <button className="btn ghost" onClick={onLogin}>
                  로그인
                </button>
                <button className="btn primary" onClick={onSignup}>
                  회원가입
                </button>
              </div>
            </>
          )}
          <ExportButton garage={garage} schedules={schedules} className="btn ghost mp-export" />
        </section>

        <section className="mmenu-body">
          <button className="pull-hint" onClick={showMypage}>
            <span aria-hidden>↓</span> 아래로 당기면 마이페이지
          </button>
          <VehicleList garage={garage} onSwitch={onSwitchVehicle} onAdd={onAddVehicle} onRemove={onRemoveVehicle} />
          <Sidebar state={state} embedded onPickExample={onPickExample} onClose={onClose} />
        </section>
      </div>
    </div>
  )
}
