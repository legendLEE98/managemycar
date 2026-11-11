import type { CarState } from './api'
import { SERVICE_META, reconcileServices } from './services'

export const todayStr = () => new Date().toLocaleDateString('sv-SE') // YYYY-MM-DD (로컬 날짜)

/** 사용자가 모달에서 직접 입력한 교체 이력을 상태에 반영한다. */
export function recordService(
  s: CarState,
  key: string,
  rec: { date: string | null; km: number | null },
): CarState {
  const meta = SERVICE_META.find((m) => m.key === key)
  const prev = s.services[key] ?? {
    lastKm: null,
    lastDate: null,
    intervalKm: meta?.intervalKm ?? null,
    intervalMonths: meta?.intervalMonths ?? null,
  }
  const parts = [rec.date, rec.km != null ? `${rec.km.toLocaleString('ko-KR')}km` : null].filter(Boolean)
  return {
    ...s,
    services: { ...s.services, [key]: { ...prev, lastDate: rec.date, lastKm: rec.km } },
    recent: [
      ...s.recent,
      { at: todayStr(), type: 'service', summary: `${meta?.label ?? key} 교체 기록(직접 입력): ${parts.join(' / ')}` },
    ].slice(-30),
    updatedAt: new Date().toISOString(),
  }
}

/**
 * 사용자가 직접 입력한 현재 주행거리를 반영한다(계기판 값으로 보고 '실측'으로 표시).
 * 첫 주유 이후 늘어난 거리는 연비 계산에 더한다. 서버의 set_odometer 도구와 같은 규칙이다.
 */
export function setOdometerManual(s: CarState, km: number): CarState {
  const cur = s.odometer.km
  const trackedKm = cur != null && km > cur && s.fuel.started ? s.fuel.trackedKm + (km - cur) : s.fuel.trackedKm
  return {
    ...s,
    odometer: { km, source: 'reported', updatedAt: todayStr() },
    fuel: { ...s.fuel, trackedKm },
    recent: [
      ...s.recent,
      { at: todayStr(), type: 'odometer', summary: `주행거리 설정(직접 입력): ${km.toLocaleString('ko-KR')}km(계기판)` },
    ].slice(-30),
    updatedAt: new Date().toISOString(),
  }
}

/**
 * "주행" 창에서 저장한 값을 반영한다.
 *  odometerKm: 현재 주행거리(null이면 바꾸지 않음)
 *  commute: 하루 출퇴근 거리(km). 0이면 출퇴근 안 함, null이면 바꾸지 않음
 */
export function applyDriving(s: CarState, edit: { odometerKm: number | null; commute: number | null }): CarState {
  let next = s
  if (edit.odometerKm != null && edit.odometerKm !== s.odometer.km) next = setOdometerManual(next, edit.odometerKm)
  if (edit.commute != null && edit.commute !== s.commute.kmPerDay) {
    next = {
      ...next,
      commute: { ...next.commute, kmPerDay: edit.commute },
      recent: [
        ...next.recent,
        {
          at: todayStr(),
          type: 'commute',
          summary: edit.commute === 0 ? '출퇴근 설정(직접 입력): 출퇴근 안 함' : `출퇴근 설정(직접 입력): 하루 ${edit.commute}km`,
        },
      ].slice(-30),
      updatedAt: new Date().toISOString(),
    }
  }
  return next
}

export type VehiclePatch = Partial<CarState['vehicle']>

/** 사용자가 직접 입력한 차량 정보를 반영한다. 연료가 바뀌면 해당 없는 소모품은 빼고 새로 필요한 항목은 기본 주기로 추가한다. */
export function updateVehicle(s: CarState, patch: VehiclePatch): CarState {
  const vehicle = { ...s.vehicle, ...patch }
  const services = reconcileServices(s.services, s.vehicle.fuelType, vehicle.fuelType)
  return {
    ...s,
    vehicle,
    services,
    recent: [...s.recent, { at: todayStr(), type: 'vehicle', summary: '차량 정보 수정(직접 입력)' }].slice(-30),
    updatedAt: new Date().toISOString(),
  }
}
