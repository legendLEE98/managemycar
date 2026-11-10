import type { CarState, Garage } from '../api'
import ExportButton from './ExportButton'
import VehicleSwitcher from './VehicleSwitcher'
import { bodyLabel, fuelLabel } from '../vehicleOptions'
import { daysSince, efficiency, fmtKm, gaps, mostUrgent, serviceSummary, serviceViews, type Gap } from '../derive'

type Props = {
  garage: Garage
  onSwitchVehicle: (id: string) => void
  onAddVehicle: () => void
  onRemoveVehicle: (id: string) => void
  state: CarState
  onPickGap: (g: Gap) => void
  onOpenServices: () => void
  onEditVehicle: () => void
  onEditOdometer: () => void
}

export default function StatePanel({
  garage,
  onSwitchVehicle,
  onAddVehicle,
  onRemoveVehicle,
  state: s,
  onPickGap,
  onOpenServices,
  onEditVehicle,
  onEditOdometer,
}: Props) {
  const eff = efficiency(s)
  const services = serviceViews(s)
  const sum = serviceSummary(services)
  const urgent = mostUrgent(services, 4)
  const gapList = gaps(s)
  const v = s.vehicle
  const title = [v.make, v.model].filter(Boolean).join(' ')
  const age = daysSince(s.odometer.updatedAt)

  return (
    <aside className="panel">
      <VehicleSwitcher garage={garage} onSwitch={onSwitchVehicle} onAdd={onAddVehicle} onRemove={onRemoveVehicle} />
      <section className="card">
        <h3>
          내 차
          <button className="link" onClick={onEditVehicle}>
            수정
          </button>
        </h3>
        <div className="car-title">{title || '차종 미입력'}</div>
        <div className="chips">
          <span className="chip">{bodyLabel(v.bodyType)}</span>
          {v.verified === false && (
            <span className="chip unverified" title="차종 목록에서 확인되지 않은 차종이에요">
              미확인 차종
            </span>
          )}
          {v.modelYear && <span className="chip">{v.modelYear}년식</span>}
          {v.fuelType ? (
            <span className={`chip fuel-${v.fuelType}`}>{fuelLabel(v.fuelType)}</span>
          ) : (
            <button className="chip empty" onClick={onEditVehicle}>
              연료 종류 선택
            </button>
          )}
        </div>
      </section>

      <ExportButton garage={garage} className="btn ghost export-btn" />

      <section className="card">
        <h3>
          주행
          <button className="link" onClick={onEditOdometer}>
            {s.odometer.km != null ? '수정' : '입력'}
          </button>
        </h3>
        {s.odometer.km != null ? (
          <>
            <div className="big">
              {fmtKm(s.odometer.km)}
              <span className={`tag ${s.odometer.source}`}>{s.odometer.source === 'reported' ? '실측' : '추정'}</span>
            </div>
            {age != null && <div className="sub">{age === 0 ? '오늘' : `${age}일 전`} 갱신</div>}
          </>
        ) : (
          <div className="missing">주행거리를 모르고 있어요</div>
        )}
        <dl className="kv">
          <dt>평균 연비</dt>
          <dd>{eff != null ? `${eff.toFixed(1)} km/L` : <em>데이터 부족</em>}</dd>
          <dt>하루 출퇴근</dt>
          <dd>{s.commute.kmPerDay == null ? <em>미입력</em> : s.commute.kmPerDay === 0 ? '출퇴근 안 함' : `${s.commute.kmPerDay}km`}</dd>
          <dt>누적 주유</dt>
          <dd>
            {s.fuel.totalLiters > 0
              ? `${s.fuel.totalLiters.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}L · ${s.fuel.totalCost.toLocaleString('ko-KR')}원`
              : <em>기록 없음</em>}
          </dd>
        </dl>
      </section>

      <button className="card clickable" onClick={onOpenServices} aria-label="소모품 현황 자세히 보기">
        <h3>
          소모품 교체 <span className="more">자세히 ›</span>
        </h3>
        <div className="summary small">
          {sum.over > 0 && <span className="pill over">초과 {sum.over}</span>}
          {sum.soon > 0 && <span className="pill soon">임박 {sum.soon}</span>}
          <span className="pill ok">정상 {sum.ok}</span>
          <span className="pill lack">데이터 부족 {sum.lack}</span>
        </div>
        {urgent.length > 0 ? (
          <ul className="services">
            {urgent.map((sv) => (
              <li key={sv.key}>
                <div className="svc-head">
                  <span>{sv.label}</span>
                  <span className={`svc-text ${sv.level}`}>{sv.text}</span>
                </div>
                <div className={`gauge ${sv.level}`}>
                  <i style={{ width: `${Math.max(sv.ratio * 100, 3)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="svc-note">아직 계산할 수 있는 항목이 없어요. 눌러서 {services.length}개 항목을 확인해 보세요.</p>
        )}
        <p className="foot">교체 주기는 일반 기준이에요. 차종마다 다르니 사용설명서를 확인하세요.</p>
      </button>

      {gapList.length > 0 && (
        <section className="card gaps">
          <h3>
            데이터 보강 <span className="count">{gapList.length}</span>
          </h3>
          <p className="sub">누르면 입력창에 예시 문장이 채워져요.</p>
          <ul>
            {gapList.map((g) => (
              <li key={g.id}>
                <button className={g.level} onClick={() => onPickGap(g)}>
                  <span className="dot" />
                  {g.label}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  )
}
