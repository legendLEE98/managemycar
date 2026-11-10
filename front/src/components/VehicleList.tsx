import type { Garage } from '../api'
import { MAX_VEHICLES, vehicleName } from '../storage'
import { bodyLabel } from '../vehicleOptions'

type Props = {
  garage: Garage
  onSwitch: (id: string) => void
  onAdd: () => void
  onRemove: (id: string) => void
}

/** 모바일 메뉴 안의 "내 차량" 목록: 드롭다운 없이 펼쳐서 보여 준다. */
export default function VehicleList({ garage, onSwitch, onAdd, onRemove }: Props) {
  const full = garage.vehicles.length >= MAX_VEHICLES
  return (
    <section className="vlist">
      <h4>내 차량 ({garage.vehicles.length}/{MAX_VEHICLES})</h4>
      <ul>
        {garage.vehicles.map((v, i) => {
          const on = v.id === garage.activeId
          const name = vehicleName(v.state, i)
          return (
            <li key={v.id} className={on ? 'on' : ''}>
              <button className="vl-item" onClick={() => onSwitch(v.id)} aria-pressed={on}>
                <span className="vl-check">{on ? '✓' : ''}</span>
                <span className="vl-text">
                  <b>{name}</b>
                  <small>
                    {bodyLabel(v.state.vehicle.bodyType)}
                    {v.state.odometer.km != null && ` · ${v.state.odometer.km.toLocaleString('ko-KR')}km`}
                  </small>
                </span>
              </button>
              {garage.vehicles.length > 1 && (
                <button
                  className="vl-del"
                  aria-label={`${name} 삭제`}
                  onClick={() => {
                    if (window.confirm(`"${name}" 차량과 그 기록을 삭제할까요?\n삭제하면 되돌릴 수 없어요.`)) onRemove(v.id)
                  }}
                >
                  ✕
                </button>
              )}
            </li>
          )
        })}
      </ul>
      <button className="btn primary vl-add" onClick={onAdd} disabled={full}>
        {full ? `차량은 최대 ${MAX_VEHICLES}대까지예요` : '＋ 차량 추가'}
      </button>
    </section>
  )
}
