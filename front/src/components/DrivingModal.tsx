import { useEffect, useState, type FormEvent } from 'react'
import type { CarState } from '../api'
import { daysSince, fmtKm } from '../derive'

export type DrivingEdit = { odometerKm: number | null; commute: number | null }
type Props = { state: CarState; onClose: () => void; onSave: (edit: DrivingEdit) => void }

/** 주행: 현재 주행거리와 출퇴근 여부(출퇴근 거리)를 직접 입력한다. */
export default function DrivingModal({ state, onClose, onSave }: Props) {
  const cur = state.odometer.km
  const curCommute = state.commute.kmPerDay // null=아직 모름, 0=출퇴근 안 함, 1 이상=하루 거리
  const [odo, setOdo] = useState(cur != null ? String(cur) : '')
  const [commuting, setCommuting] = useState(curCommute != null && curCommute > 0)
  const [touched, setTouched] = useState(false) // 출퇴근 여부를 직접 바꿨는지(모름 상태에서 저장만 눌러도 "안 함"으로 바뀌지 않게)
  const [commuteKm, setCommuteKm] = useState(curCommute != null && curCommute > 0 ? String(curCommute) : '')
  const [error, setError] = useState('')
  const [confirmLower, setConfirmLower] = useState(false)
  const age = daysSince(state.odometer.updatedAt)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = (e: FormEvent) => {
    e.preventDefault()

    // 현재 주행거리: 이미 값이 있으면 필수, 아직 모르면 비워 둘 수 있다(출퇴근만 설정하는 경우)
    let odometerKm: number | null = null
    if (odo.trim() !== '' || cur != null) {
      const km = Number(odo.replace(/,/g, ''))
      if (odo.trim() === '' || !Number.isFinite(km) || !Number.isInteger(km)) return setError('주행거리를 숫자로 입력해 주세요.')
      if (km < 0 || km > 3_000_000) return setError('주행거리는 0 ~ 3,000,000km 사이로 입력해 주세요.')
      // 현재 값보다 작으면 입력 실수일 수 있어 한 번 더 확인한다(계기판 교체·잘못 입력한 값을 고칠 때는 그대로 저장하면 된다).
      if (cur != null && km < cur && !confirmLower) {
        setConfirmLower(true)
        return setError(`현재 값(${fmtKm(cur)})보다 작아요. 맞다면 저장을 한 번 더 눌러 주세요.`)
      }
      odometerKm = km
    }

    // 출퇴근: 직접 바꾸지 않았고 아직 모르는 상태면 그대로 둔다
    let commute: number | null = null
    if (touched || curCommute != null) {
      if (commuting) {
        const c = Number(commuteKm.replace(/,/g, ''))
        if (commuteKm.trim() === '' || !Number.isFinite(c) || !Number.isInteger(c) || c < 1 || c > 500) {
          return setError('하루 출퇴근 거리를 1 ~ 500km 사이 숫자로 입력해 주세요.')
        }
        commute = c
      } else {
        commute = 0
      }
    }

    onSave({ odometerKm, commute })
    onClose()
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal narrow" role="dialog" aria-modal="true" aria-label="주행" onSubmit={submit}>
        <header className="modal-head">
          <div>
            <h2>주행</h2>
            <p className="sub">
              {cur != null
                ? `지금은 ${fmtKm(cur)} (${state.odometer.source === 'reported' ? '계기판 입력' : '추정'}${age != null ? `, ${age === 0 ? '오늘' : `${age}일 전`} 갱신` : ''})`
                : '아직 주행거리를 모르고 있어요'}
            </p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </header>

        <div className="modal-body form">
          <label className="field">
            <span className="field-label">계기판의 현재 주행거리 (km)</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={odo}
              onChange={(e) => {
                setOdo(e.target.value)
                setConfirmLower(false)
                setError('')
              }}
              placeholder="예) 52300"
              autoFocus
            />
            <span className="field-note neutral">직접 입력한 값은 "실측"으로 표시되고, 소모품 교체 시기 계산의 기준이 돼요.</span>
          </label>

          <div className={`commute-card${commuting ? ' on' : ''}`}>
            <label className="check-row">
              <input
                type="checkbox"
                checked={commuting}
                onChange={(e) => {
                  setCommuting(e.target.checked)
                  setTouched(true)
                  setError('')
                }}
              />
              <span className="switch" aria-hidden="true" />
              <span className="check-text">
                <b>이 차로 출퇴근해요</b>
                <small>
                  {commuting
                    ? '하루 출퇴근 거리로 주행거리를 계산해 드려요.'
                    : curCommute == null && !touched
                      ? '아직 설정하지 않았어요. 소장용·주말용이면 꺼 둔 채 저장하세요.'
                      : '출퇴근하지 않는 차로 저장돼요.'}
                </small>
              </span>
            </label>
            {commuting && (
              <label className="field sub-field">
                <span className="field-label">하루 출퇴근 거리 (왕복)</span>
                <span className="input-unit">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={500}
                    step={1}
                    value={commuteKm}
                    onChange={(e) => {
                      setCommuteKm(e.target.value)
                      setError('')
                    }}
                    placeholder="예) 30"
                  />
                  <em>km</em>
                </span>
                <span className="field-note neutral">"출퇴근 5일 했어"라고 말하면 이 거리 × 5일로 계산해요.</span>
              </label>
            )}
          </div>

          {error && (
            <div className={confirmLower ? 'field-note' : 'editor-error'} role="alert">
              {error}
            </div>
          )}
        </div>

        <footer className="modal-foot actions">
          <button type="button" className="ghost" onClick={onClose}>
            취소
          </button>
          <button type="submit" className="primary">
            {confirmLower ? '그대로 저장' : '저장'}
          </button>
        </footer>
      </form>
    </div>
  )
}
