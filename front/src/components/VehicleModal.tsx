import { useEffect, useRef, useState, type FormEvent } from 'react'
import { searchVehicle, type CarState, type CatalogMatch } from '../api'
import type { VehiclePatch } from '../stateOps'
import { BODY_GROUPS, FUEL_TYPES, fuelLabel } from '../vehicleOptions'

type Props = { state: CarState; onClose: () => void; onSave: (patch: VehiclePatch) => void }

export default function VehicleModal({ state, onClose, onSave }: Props) {
  const v = state.vehicle
  const [bodyType, setBodyType] = useState(v.bodyType)
  const [fuelType, setFuelType] = useState<string | null>(v.fuelType)
  const [make, setMake] = useState(v.make ?? '')
  const [model, setModel] = useState(v.model ?? '')
  const [year, setYear] = useState(v.modelYear != null ? String(v.modelYear) : '')
  const [error, setError] = useState('')

  // 카탈로그 검색: 입력 중 후보 표시, 목록에서 고르면 확인된 차종
  const [picked, setPicked] = useState<CatalogMatch | null>(null)
  const [suggestions, setSuggestions] = useState<CatalogMatch[]>([])
  const [confirmUnverified, setConfirmUnverified] = useState(false)
  const [busy, setBusy] = useState(false)
  const typed = useRef(false) // 사용자가 직접 입력한 뒤에만 검색

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (!typed.current) return
    const q = model.trim()
    if (q.length < 1) {
      setSuggestions([])
      return
    }
    const t = setTimeout(() => {
      searchVehicle(`${make} ${q}`.trim())
        .then((r) => setSuggestions(r.matches.slice(0, 5)))
        .catch(() => setSuggestions([]))
    }, 250)
    return () => clearTimeout(t)
  }, [model, make])

  const onModelInput = (value: string) => {
    typed.current = true
    setModel(value)
    setPicked(null)
    setConfirmUnverified(false)
  }

  const pick = (m: CatalogMatch) => {
    typed.current = false
    setPicked(m)
    setMake(m.make)
    setModel(m.model)
    setBodyType(m.bodyType)
    if (m.fuels.length === 1) setFuelType(m.fuels[0])
    setSuggestions([])
    setConfirmUnverified(false)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const y = year.trim() === '' ? null : Number(year)
    if (y != null && (!Number.isInteger(y) || y < 1980 || y > 2100)) return setError('연식은 1980~2100 사이로 입력해 주세요.')
    setError('')

    const m = model.trim()
    let verified: boolean | null = null
    let finalMake = make.trim().slice(0, 50) || null
    let finalModel = m.slice(0, 80) || null
    let finalBody = bodyType

    if (m) {
      let hit = picked
      if (!hit) {
        setBusy(true)
        try {
          const r = await searchVehicle(`${make} ${m}`.trim())
          if (r.status === 'match') hit = r.matches[0]
        } catch {
          /* 조회 실패 시 미확인으로 처리 */
        } finally {
          setBusy(false)
        }
      }
      if (hit) {
        verified = true
        finalMake = hit.make
        finalModel = hit.model
        finalBody = hit.bodyType
      } else if (!confirmUnverified) {
        setConfirmUnverified(true) // 한 번 더 확인
        return
      } else {
        verified = false
      }
    }

    onSave({
      bodyType: finalBody,
      fuelType,
      make: finalMake,
      model: finalModel,
      modelYear: y,
      verified,
    })
    onClose()
  }

  const fuelChanged = fuelType !== v.fuelType
  const knownFuels = picked?.fuels

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal narrow" role="dialog" aria-modal="true" aria-label="내 차 정보" onSubmit={submit}>
        <header className="modal-head">
          <h2>내 차 정보</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </header>

        <div className="modal-body form">
          <div className="grid3">
            <label className="field">
              <span className="field-label">제조사</span>
              <input
                value={make}
                onChange={(e) => {
                  typed.current = true
                  setMake(e.target.value)
                  setPicked(null)
                  setConfirmUnverified(false)
                }}
                placeholder="예) 기아"
                maxLength={50}
              />
            </label>
            <div className="field suggest">
              <span className="field-label">차종</span>
              <input
                value={model}
                onChange={(e) => onModelInput(e.target.value)}
                placeholder="예) 쏘렌토"
                maxLength={80}
                autoComplete="off"
              />
              {suggestions.length > 0 && !picked && (
                <ul className="suggest-list">
                  {suggestions.map((s) => (
                    <li key={`${s.make}-${s.model}`}>
                      <button type="button" onClick={() => pick(s)}>
                        <span>
                          {s.make} {s.model}
                        </span>
                        <small>{s.bodyLabel}</small>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <label className="field">
              <span className="field-label">연식</span>
              <input type="number" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} placeholder="예) 2021" />
            </label>
          </div>
          {picked && (
            <p className="verify-note ok">
              확인된 차종이에요 · {picked.bodyLabel}
              {picked.fuels.length > 0 && ` · ${picked.fuels.map(fuelLabel).join(' / ')}`}
            </p>
          )}
          {confirmUnverified && (
            <p className="verify-note warn">
              차종 목록에서 찾지 못했어요. 이름을 다시 확인하거나, 그대로 <b>저장</b>을 한 번 더 누르면 "미확인 차종"으로 등록돼요.
            </p>
          )}

          <div className="field">
            <span className="field-label">차급</span>
            {BODY_GROUPS.map((g) => (
              <div key={g.label} className="opt-group">
                <span className="opt-group-label">{g.label}</span>
                <div className="opts">
                  {g.items.map((b) => (
                    <button
                      type="button"
                      key={b.id}
                      className={`opt ${bodyType === b.id ? 'on' : ''}`}
                      onClick={() => setBodyType(b.id)}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="field">
            <span className="field-label">연료</span>
            <div className="opts">
              {FUEL_TYPES.map((f) => (
                <button
                  type="button"
                  key={f.id}
                  className={`opt ${fuelType === f.id ? 'on' : ''}`}
                  disabled={knownFuels ? !knownFuels.includes(f.id) : false}
                  onClick={() => setFuelType(fuelType === f.id ? null : f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {knownFuels && <p className="field-note">이 차종에 있는 연료만 선택할 수 있어요.</p>}
            {fuelChanged && (
              <p className="field-note">
                연료를 바꾸면 해당 없는 소모품(예: 전기차의 엔진오일)은 목록에서 빠지고, 새로 필요한 항목이 추가돼요.
              </p>
            )}
          </div>
          {error && <div className="editor-error">{error}</div>}
        </div>

        <footer className="modal-foot actions">
          <button type="button" className="ghost" onClick={onClose}>
            취소
          </button>
          <button type="submit" className="primary" disabled={busy}>
            {confirmUnverified ? '미확인 차종으로 저장' : '저장'}
          </button>
        </footer>
      </form>
    </div>
  )
}
