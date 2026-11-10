import { useEffect, useRef, useState } from 'react'
import type { Garage } from '../api'
import { MAX_VEHICLES, vehicleName } from '../storage'
import { bodyLabel } from '../vehicleOptions'

type Props = {
  garage: Garage
  onSwitch: (id: string) => void
  onAdd: () => void
  onRemove: (id: string) => void
  /** 모바일 헤더용: 선택 드롭다운만 보이고, 차량 추가는 드롭다운 맨 아래 항목으로 둔다 */
  compact?: boolean
}

/** 내 차 카드 위: 차량 선택 드롭다운과 차량 추가 버튼 */
export default function VehicleSwitcher({ garage, onSwitch, onAdd, onRemove, compact }: Props) {
  const [open, setOpen] = useState(false)
  const [menuTop, setMenuTop] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const idx = Math.max(0, garage.vehicles.findIndex((v) => v.id === garage.activeId))
  const active = garage.vehicles[idx]
  const full = garage.vehicles.length >= MAX_VEHICLES

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className={`vswitch ${compact ? 'compact' : ''}`} ref={ref}>
      {!compact && (
      <button
        className="btn primary vs-add"
        onClick={() => {
          setOpen(false)
          onAdd()
        }}
        disabled={full}
        title={full ? `차량은 최대 ${MAX_VEHICLES}대까지 등록할 수 있어요` : '빈 상태의 새 차량을 추가해요'}
      >
        ＋ 차량 추가
      </button>
      )}

      <button
        className="vs-trigger"
        onClick={() => {
          // 헤더용(compact)은 화면 기준으로 띄운다: 오른쪽으로 화면 밖에 나가지 않게 트리거 바로 아래에 맞춘다.
          if (compact && ref.current) setMenuTop(ref.current.getBoundingClientRect().bottom + 6)
          setOpen((o) => !o)
        }} aria-haspopup="listbox" aria-expanded={open}>
        <span className="vs-cur">
          <b>{vehicleName(active.state, idx)}</b>
          <small>
            {bodyLabel(active.state.vehicle.bodyType)} · 내 차 {idx + 1}/{garage.vehicles.length}
          </small>
        </span>
        <span className="vs-caret">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <ul className="vs-menu" role="listbox" style={compact ? { top: menuTop } : undefined}>
          {garage.vehicles.map((v, i) => (
            <li key={v.id} className={v.id === garage.activeId ? 'on' : ''}>
              <button
                className="vs-item"
                role="option"
                aria-selected={v.id === garage.activeId}
                onClick={() => {
                  setOpen(false)
                  if (v.id !== garage.activeId) onSwitch(v.id)
                }}
              >
                <span className="vs-check">{v.id === garage.activeId ? '✓' : ''}</span>
                <span className="vs-text">
                  <b>{vehicleName(v.state, i)}</b>
                  <small>
                    {bodyLabel(v.state.vehicle.bodyType)}
                    {v.state.odometer.km != null && ` · ${v.state.odometer.km.toLocaleString('ko-KR')}km`}
                  </small>
                </span>
              </button>
              {garage.vehicles.length > 1 && (
                <button
                  className="vs-del"
                  aria-label={`${vehicleName(v.state, i)} 삭제`}
                  title="이 차량 삭제"
                  onClick={() => {
                    if (window.confirm(`"${vehicleName(v.state, i)}" 차량과 그 기록을 삭제할까요?\n삭제하면 되돌릴 수 없어요.`)) {
                      setOpen(false)
                      onRemove(v.id)
                    }
                  }}
                >
                  ✕
                </button>
              )}
            </li>
          ))}
          {compact && (
            <li className="vs-add-row">
              <button
                className="vs-add-item"
                disabled={full}
                onClick={() => {
                  setOpen(false)
                  onAdd()
                }}
              >
                {full ? `차량은 최대 ${MAX_VEHICLES}대까지예요` : '＋ 차량 추가'}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
