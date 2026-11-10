import type { ServiceItem } from './api'

/** 교체 시기 구간. 항목의 일반적인 교체 시기를 기준으로 묶는다. */
export const GROUPS = [
  { id: 'g1', label: '0 ~ 2만km', from: 0, to: 20000 },
  { id: 'g2', label: '2만 ~ 5만km', from: 20000, to: 50000 },
  { id: 'g3', label: '5만 ~ 10만km', from: 50000, to: 100000 },
  { id: 'g4', label: '10만km 이상', from: 100000, to: null as number | null },
] as const

export type GroupId = (typeof GROUPS)[number]['id']

/** 전기차일 때 바뀌는 값 */
export type Variant = Partial<{
  label: string
  group: GroupId
  intervalKm: number | null
  intervalMonths: number | null
  note: string
}>

export type ServiceMeta = {
  key: string
  label: string
  group: GroupId
  intervalKm: number | null
  intervalMonths: number | null
  note?: string
  excludedFuels?: string[]
  electric?: Variant
}

// 서버(ServiceCatalog.java)의 key·기본 주기와 같아야 한다.
export const SERVICE_META: ServiceMeta[] = [
  { key: 'airFilter', label: '에어컨 필터', group: 'g1', intervalKm: 15000, intervalMonths: 12 },
  { key: 'wiper', label: '와이퍼', group: 'g1', intervalKm: null, intervalMonths: 12 },
  { key: 'tireRotation', label: '타이어 위치교정', group: 'g1', intervalKm: 10000, intervalMonths: null },
  { key: 'engineOil', label: '엔진오일·오일필터', group: 'g1', intervalKm: 10000, intervalMonths: 12, excludedFuels: ['electric'] },

  { key: 'airCleaner', label: '에어클리너 필터', group: 'g2', intervalKm: 30000, intervalMonths: null, excludedFuels: ['electric'] },
  { key: 'brakePad', label: '브레이크 패드(앞)', group: 'g2', intervalKm: 40000, intervalMonths: null,
    electric: { group: 'g3', intervalKm: 80000, note: '회생제동으로 마모가 적어요. 정기 점검 권장' } },
  { key: 'brakeFluid', label: '브레이크 오일', group: 'g2', intervalKm: 40000, intervalMonths: 24 },

  { key: 'battery', label: '배터리', group: 'g3', intervalKm: null, intervalMonths: 48 },
  { key: 'tire', label: '타이어', group: 'g3', intervalKm: 50000, intervalMonths: null },
  { key: 'brakePadRear', label: '브레이크 패드(뒤)', group: 'g3', intervalKm: 70000, intervalMonths: null,
    electric: { group: 'g4', intervalKm: 100000, note: '회생제동으로 마모가 적어요. 정기 점검 권장' } },

  { key: 'coolant', label: '엔진 부동액', group: 'g4', intervalKm: 100000, intervalMonths: null,
    electric: { label: '배터리 냉각수(부동액)', group: 'g3', intervalKm: 60000, intervalMonths: 36, note: '저전도 냉각수 차량 기준' } },
  { key: 'transmissionOil', label: '미션오일', group: 'g4', intervalKm: 100000, intervalMonths: null,
    electric: { label: '감속기 오일', intervalKm: 120000 } },
  { key: 'outerBelt', label: '외부벨트', group: 'g4', intervalKm: 100000, intervalMonths: null, excludedFuels: ['electric'] },
  { key: 'timingBelt', label: '타이밍벨트', group: 'g4', intervalKm: 100000, intervalMonths: null, excludedFuels: ['electric'], note: '체인 방식 엔진은 해당 없음' },
  { key: 'brakeDiscFront', label: '브레이크 디스크(앞)', group: 'g4', intervalKm: 100000, intervalMonths: null },
  { key: 'brakeDiscRear', label: '브레이크 디스크(뒤)', group: 'g4', intervalKm: 100000, intervalMonths: null },
  { key: 'sparkPlug', label: '점화 플러그', group: 'g4', intervalKm: 100000, intervalMonths: null, excludedFuels: ['electric', 'diesel'] },

  // 전기차 전용
  { key: 'generalCoolant', label: '일반 냉각수', group: 'g4', intervalKm: 200000, intervalMonths: 60, excludedFuels: ['gasoline', 'diesel', 'lpg', 'hybrid'], note: '구동·충전 계통 냉각수' },
]

export const applicable = (m: ServiceMeta, fuelType: string | null) =>
  fuelType ? !m.excludedFuels?.includes(fuelType) : m.key !== 'generalCoolant'

/** 연료에 맞는 이름·구간·주기·메모를 합친 항목 정보 */
export function metaFor(m: ServiceMeta, fuelType: string | null): ServiceMeta {
  return fuelType === 'electric' && m.electric ? { ...m, ...m.electric, electric: undefined } : m
}

export function defaultServices(fuelType: string | null = null): Record<string, ServiceItem> {
  return Object.fromEntries(
    SERVICE_META.map((base) => {
      const m = metaFor(base, fuelType)
      return [m.key, { lastKm: null, lastDate: null, intervalKm: m.intervalKm, intervalMonths: m.intervalMonths }]
    }),
  )
}

/**
 * 연료가 바뀌었을 때 항목을 맞춘다: 해당 없는 항목은 빼고, 빠진 항목은 기본 주기로 채우고,
 * 사용자가 바꾸지 않은 주기(이전 연료의 기본값 그대로)는 새 연료의 기본값으로 바꾼다.
 */
export function reconcileServices(
  services: Record<string, ServiceItem>,
  prevFuel: string | null,
  fuel: string | null,
): Record<string, ServiceItem> {
  const out = { ...services }
  for (const base of SERVICE_META) {
    if (!applicable(base, fuel)) {
      delete out[base.key]
      continue
    }
    const next = metaFor(base, fuel)
    const prev = metaFor(base, prevFuel)
    const cur = out[base.key]
    if (!cur) {
      out[base.key] = { lastKm: null, lastDate: null, intervalKm: next.intervalKm, intervalMonths: next.intervalMonths }
    } else if (cur.intervalKm === prev.intervalKm && cur.intervalMonths === prev.intervalMonths) {
      out[base.key] = { ...cur, intervalKm: next.intervalKm, intervalMonths: next.intervalMonths }
    }
  }
  return out
}

// ---- 차량 파트(3D에서 누르는 부분) → 관련 소모품 ----
export type Part = 'hood' | 'glass' | 'wheel' | 'body'

export const PART_INFO: Record<Part, { label: string; sub: string; keys: string[] }> = {
  hood: {
    label: '본네트',
    sub: '엔진룸 안의 소모품',
    keys: ['engineOil', 'airCleaner', 'coolant', 'generalCoolant', 'battery', 'outerBelt', 'timingBelt', 'sparkPlug', 'brakeFluid'],
  },
  glass: { label: '창문', sub: '유리 · 와이퍼', keys: ['wiper'] },
  wheel: {
    label: '바퀴',
    sub: '타이어 · 브레이크',
    keys: ['tire', 'tireRotation', 'brakePad', 'brakePadRear', 'brakeDiscFront', 'brakeDiscRear'],
  },
  body: { label: '차체', sub: '실내 · 하부', keys: ['airFilter', 'transmissionOil'] },
}
