import type { CarState } from './api'
import { GROUPS, SERVICE_META, applicable, metaFor, type GroupId } from './services'

const DAY = 86_400_000
const STALE_ODOMETER_DAYS = 14

const fmt = (n: number) => n.toLocaleString('ko-KR')
export const fmtKm = (n: number) => `${fmt(n)}km`

/** 평균 연비(km/L). 첫 주유 이후 구간만 사용. */
export function efficiency(s: CarState): number | null {
  const { litersSinceStart, trackedKm } = s.fuel
  return litersSinceStart > 0 && trackedKm > 0 ? trackedKm / litersSinceStart : null
}

export function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null
  const d = new Date(dateStr + 'T00:00:00')
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / DAY))
}

function daysUntil(dateStr: string, months: number): number {
  const d = new Date(dateStr + 'T00:00:00')
  d.setMonth(d.getMonth() + months)
  return Math.round((d.getTime() - Date.now()) / DAY)
}

// ---- 소모품 ----
export type ServiceView = {
  key: string
  label: string
  group: GroupId
  note?: string
  lastKm: number | null
  lastDate: string | null
  intervalKm: number | null
  intervalMonths: number | null
  /** unknown: 이력 없음 / partial: 일부만 알아서 계산 불가 / ok: 계산됨 */
  state: 'unknown' | 'partial' | 'ok'
  /** 0~1(초과해도 1로 고정). 사용한 비율 */
  ratio: number
  level: 'ok' | 'soon' | 'over'
  text: string
  missing: string[]
}

export function serviceViews(s: CarState): ServiceView[] {
  const odo = s.odometer.km
  const out: ServiceView[] = []
  for (const entry of SERVICE_META) {
    if (!applicable(entry, s.vehicle.fuelType)) continue
    const m = metaFor(entry, s.vehicle.fuelType)
    const it = s.services[m.key] ?? { lastKm: null, lastDate: null, intervalKm: m.intervalKm, intervalMonths: m.intervalMonths }
    const base = {
      key: m.key,
      label: m.label,
      group: m.group,
      note: m.note,
      lastKm: it.lastKm,
      lastDate: it.lastDate,
      intervalKm: it.intervalKm,
      intervalMonths: it.intervalMonths,
    }
    if (it.lastKm == null && it.lastDate == null) {
      out.push({ ...base, state: 'unknown', ratio: 0, level: 'ok', text: '', missing: ['교체 이력'] })
      continue
    }
    const ratios: number[] = []
    const parts: string[] = []
    const missing: string[] = []
    if (it.intervalKm != null) {
      if (it.lastKm == null) missing.push('교체 당시 주행거리')
      else if (odo == null) missing.push('현재 주행거리')
      else {
        const used = odo - it.lastKm
        ratios.push(used / it.intervalKm)
        const rem = it.intervalKm - used
        parts.push(rem >= 0 ? `${fmt(rem)}km 남음` : `${fmt(-rem)}km 초과`)
      }
    }
    if (it.intervalMonths != null) {
      if (!it.lastDate) missing.push('교체 날짜')
      else {
        const rem = daysUntil(it.lastDate, it.intervalMonths)
        ratios.push(1 - rem / (it.intervalMonths * 30))
        parts.push(rem >= 0 ? `${rem}일 남음` : `${-rem}일 초과`)
      }
    }
    if (!ratios.length) {
      out.push({ ...base, state: 'partial', ratio: 0, level: 'ok', text: '', missing })
      continue
    }
    const worst = Math.max(...ratios)
    out.push({
      ...base,
      state: 'ok',
      ratio: Math.min(Math.max(worst, 0), 1),
      level: worst >= 1 ? 'over' : worst >= 0.8 ? 'soon' : 'ok',
      text: parts.join(' · '),
      missing,
    })
  }
  return out
}

export function serviceSummary(views: ServiceView[]) {
  return {
    over: views.filter((v) => v.state === 'ok' && v.level === 'over').length,
    soon: views.filter((v) => v.state === 'ok' && v.level === 'soon').length,
    ok: views.filter((v) => v.state === 'ok' && v.level === 'ok').length,
    lack: views.filter((v) => v.state !== 'ok').length,
  }
}

/** 사용 비율이 높은 순(초과 → 임박 → 정상). 계산 가능한 항목만. */
export function mostUrgent(views: ServiceView[], n: number): ServiceView[] {
  return views
    .filter((v) => v.state === 'ok')
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, n)
}

/** 현재 주행거리가 속한 교체 구간 */
export function currentGroup(s: CarState): GroupId | null {
  const odo = s.odometer.km
  if (odo == null) return null
  return GROUPS.find((g) => odo >= g.from && (g.to == null || odo < g.to))?.id ?? null
}

/** 마지막 한글 글자의 받침 유무로 은/는을 고른다. */
function topic(word: string): string {
  const syllables = [...word].filter((c) => c >= '가' && c <= '힣')
  const last = syllables[syllables.length - 1]
  if (!last) return '은'
  return (last.charCodeAt(0) - 0xac00) % 28 === 0 ? '는' : '은'
}

/** 남은 주행거리(km)와 남은 일수(음수면 초과). 계산할 수 없으면 null. 엑셀 내보내기 등 숫자가 필요한 곳에서 쓴다. */
export function serviceRemaining(s: CarState, v: ServiceView): { km: number | null; days: number | null } {
  const odo = s.odometer.km
  const km = v.intervalKm != null && v.lastKm != null && odo != null ? v.intervalKm - (odo - v.lastKm) : null
  const days = v.intervalMonths != null && v.lastDate ? daysUntil(v.lastDate, v.intervalMonths) : null
  return { km, days }
}

/** 부족한 데이터를 채우기 위해 입력창에 넣어 줄 예시 문장 */
export function exampleFor(v: ServiceView): string {
  if (v.state === 'unknown') {
    const when =
      v.intervalMonths != null && v.intervalKm != null ? '○○○○년 ○월, ○○,○○○km일 때'
      : v.intervalMonths != null ? '○○○○년 ○월에'
      : '○○,○○○km일 때'
    return `${v.label}${topic(v.label)} ${when} 마지막으로 교체했어`
  }
  const parts = v.missing.map((m) => (m === '교체 날짜' ? '날짜는 ○○○○-○○-○○' : '주행거리는 ○○,○○○km'))
  return `${v.label} 교체할 때 ${parts.join(', ')}였어`
}

// ---- 데이터 부족 신호 ----
export type Gap = {
  id: string
  label: string
  /** 클릭하면 채팅 입력창에 채워 줄 문장 */
  example: string
  /** need: 계산에 꼭 필요 / tip: 있으면 더 정확 */
  level: 'need' | 'tip'
  /** 있으면 입력 예시 대신 소모품 현황 모달을 연다 */
  action?: 'services' | 'vehicle' | 'odometer'
  /** 모달에서 바로 입력 폼을 펼칠 항목 */
  serviceKey?: string
}

export function gaps(s: CarState): Gap[] {
  const out: Gap[] = []
  const v = s.vehicle
  if (!v.make && !v.model) {
    out.push({ id: 'car', label: '차종', example: '2021년식 디젤 쏘렌토 타고 있어', level: 'need' })
  } else {
    if (!v.modelYear) out.push({ id: 'year', label: '연식', example: '연식은 ○○○○년이야', level: 'tip' })
    if (!v.fuelType) out.push({ id: 'fuel', label: '연료 종류', example: '연료는 (가솔린/디젤/하이브리드/전기)야', level: 'tip', action: 'vehicle' })
  }

  if (s.odometer.km == null) {
    out.push({ id: 'odo', label: '현재 주행거리', example: '계기판 ○○,○○○km야', level: 'need', action: 'odometer' })
  } else {
    const d = daysSince(s.odometer.updatedAt)
    if (d != null && d >= STALE_ODOMETER_DAYS) {
      out.push({ id: 'odo-stale', label: `주행거리 갱신 (${d}일 전 값)`, example: '지금 계기판 ○○,○○○km야', level: 'need', action: 'odometer' })
    }
  }

  if (s.commute.kmPerDay == null) {
    out.push({ id: 'commute', label: '출퇴근 거리', example: '출퇴근은 하루 왕복 ○○km야', level: 'tip' })
  }

  if (!s.fuel.started) {
    out.push({ id: 'fuel-log', label: '주유 기록 (연비)', example: '기름 ○○리터 ○○원 넣었어', level: 'tip' })
  } else if (s.fuel.litersSinceStart === 0) {
    out.push({ id: 'fuel-2', label: '연비: 주유 한 번 더 필요', example: '기름 ○○리터 넣었어', level: 'tip' })
  } else if (s.fuel.trackedKm === 0) {
    out.push({ id: 'fuel-km', label: '연비: 주행 기록 필요', example: '오늘 ○○km 탔어', level: 'tip' })
  }

  const views = serviceViews(s)
  const unknown = views.filter((v) => v.state === 'unknown')
  if (unknown.length) {
    out.push({
      id: 'svc-unknown',
      label: `소모품 교체 이력 ${unknown.length}개 부족`,
      example: '',
      level: 'need',
      action: 'services',
    })
  }
  for (const sv of views) {
    if (sv.state !== 'unknown' && sv.missing.length) {
      out.push({
        id: `svc-${sv.key}-m`,
        label: `${sv.label}: ${sv.missing.join(', ')}`,
        example: exampleFor(sv),
        level: sv.state === 'partial' ? 'need' : 'tip',
        action: 'services',
        serviceKey: sv.key,
      })
    }
  }
  return out.sort((a, b) => (a.level === b.level ? 0 : a.level === 'need' ? -1 : 1))
}
