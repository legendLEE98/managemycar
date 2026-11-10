import type { CarState, Garage } from './api'
import { defaultServices, reconcileServices } from './services'

const KEY = 'mycar.state.v1'
const OLD_KEY = 'mycar.vehicle.v1' // 이전 버전(차량 정보만 저장)

// 서버 기본값과 같은 일반 기준 주기. 사용자가 대화로 바꿀 수 있다.
export const DEFAULT_STATE: CarState = {
  version: 1,
  vehicle: { bodyType: 'sedan', make: null, model: null, modelYear: null, fuelType: null, verified: null },
  odometer: { km: null, source: 'estimated', updatedAt: null },
  commute: { kmPerDay: null },
  fuel: { totalLiters: 0, totalCost: 0, started: false, litersSinceStart: 0, trackedKm: 0 },
  services: defaultServices(),
  recent: [],
  updatedAt: null,
}

function merge(parsed: Partial<CarState>): CarState {
  const vehicle = { ...DEFAULT_STATE.vehicle, ...parsed.vehicle }
  // 새로 추가된 항목은 기본 주기로 채우고, 이 연료 종류에 해당 없는 항목은 뺀다.
  // (연료 기준 이전 기본값 그대로인 주기는 현재 연료의 기본값으로 맞춘다)
  const services = reconcileServices({ ...defaultServices(), ...parsed.services }, null, vehicle.fuelType)
  return {
    ...DEFAULT_STATE,
    ...parsed,
    vehicle,
    odometer: { ...DEFAULT_STATE.odometer, ...parsed.odometer },
    commute: { ...DEFAULT_STATE.commute, ...parsed.commute },
    fuel: { ...DEFAULT_STATE.fuel, ...parsed.fuel },
    services,
    recent: parsed.recent ?? [],
  }
}

/** 서버나 저장소에서 읽은 상태를 현재 구조에 맞게 보정한다. */
export const normalizeState = merge

// 저장소 접근은 이 파일에서만 한다. 나중에 IndexedDB/계정 저장으로 교체할 때 여기만 바꾸면 된다.
export function loadState(): CarState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return merge(JSON.parse(raw))
    const old = localStorage.getItem(OLD_KEY)
    if (old) return merge({ vehicle: JSON.parse(old) })
  } catch {
    /* 비공개 모드·차단·손상된 값이면 기본값 */
  }
  return DEFAULT_STATE
}

export function saveState(s: CarState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* 저장 실패는 무시 (용량 초과, 차단 등) */
  }
}

// ---- 차고(여러 대) ----
const GARAGE_KEY = 'mycar.garage.v1'
export const MAX_VEHICLES = 5

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)

/** 아무것도 입력하지 않은 초기 상태의 새 차량 */
export const blankState = (): CarState => normalizeState({})

export function normalizeGarage(parsed: Partial<Garage> | null | undefined): Garage {
  const seen = new Set<string>()
  const vehicles = (parsed?.vehicles ?? [])
    .filter((v) => v && typeof v === 'object')
    .slice(0, MAX_VEHICLES)
    .map((v) => {
      let id = typeof v.id === 'string' && v.id && !seen.has(v.id) ? v.id : newId()
      seen.add(id)
      return { id, state: normalizeState(v.state ?? {}) }
    })
  if (vehicles.length === 0) vehicles.push({ id: newId(), state: blankState() })
  const activeId = vehicles.some((v) => v.id === parsed?.activeId) ? (parsed!.activeId as string) : vehicles[0].id
  return { activeId, vehicles }
}

// 이 브라우저(localStorage)에는 "게스트(로그인 전)" 데이터만 둔다.
// 로그인하면 계정(서버)으로 옮긴 뒤 이 브라우저의 저장본은 지우고, 로그인 중에는 계정 데이터를 여기에 따로 두지 않는다.
// (예전에는 계정 데이터도 이 브라우저에 사본으로 남겨서, 로그아웃 후 다른 계정으로 로그인하면 섞이거나 지운 차량이 되살아났다.)
const GUEST_KEY = 'mycar.guest.v2'
const LEGACY_KEYS = [GARAGE_KEY, 'mycar.state.v1', 'mycar.vehicle.v1'] // 예전 형식

export type GarageSource = 'v2' | 'legacy' | 'none'

/**
 * 게스트 차고를 읽는다.
 *  v2: 현재 형식 / legacy: 예전 형식(계정 데이터의 사본일 수도 있어서 로그인 상태에서는 합치지 않는다) / none: 저장본 없음
 */
export function loadGuestGarage(): { garage: Garage; source: GarageSource } {
  try {
    const raw = localStorage.getItem(GUEST_KEY)
    if (raw) return { garage: normalizeGarage(JSON.parse(raw)), source: 'v2' }
  } catch {
    /* 손상된 값이면 아래로 */
  }
  try {
    const raw = localStorage.getItem(GARAGE_KEY)
    if (raw) return { garage: normalizeGarage(JSON.parse(raw)), source: 'legacy' }
    const old = localStorage.getItem('mycar.state.v1') ?? localStorage.getItem('mycar.vehicle.v1')
    if (old) return { garage: normalizeGarage({ vehicles: [{ id: newId(), state: loadState() }] }), source: 'legacy' }
  } catch {
    /* 차단·손상 */
  }
  return { garage: normalizeGarage(null), source: 'none' }
}

export function saveGuestGarage(g: Garage): void {
  try {
    localStorage.setItem(GUEST_KEY, JSON.stringify(g))
  } catch {
    /* 저장 실패는 무시 */
  }
}

/** 예전 형식의 저장본만 지운다(현재 게스트 저장본은 유지) */
export function removeLegacyKeys(): void {
  try {
    LEGACY_KEYS.forEach((k) => localStorage.removeItem(k))
  } catch {
    /* 무시 */
  }
}

/** 차량 데이터 저장본을 모두 지운다(계정으로 옮긴 뒤, 로그아웃할 때) */
export function clearLocalGarage(): void {
  try {
    localStorage.removeItem(GUEST_KEY)
    LEGACY_KEYS.forEach((k) => localStorage.removeItem(k))
  } catch {
    /* 무시 */
  }
}

// 로그인 상태였다는 힌트: 새로고침 직후 계정 데이터를 불러오는 동안 빈 화면이 깜빡이지 않게 하는 용도(데이터는 담지 않는다)
const SESSION_HINT = 'mycar.session'
export const hasSessionHint = (): boolean => {
  try {
    return localStorage.getItem(SESSION_HINT) === '1'
  } catch {
    return false
  }
}
export function setSessionHint(on: boolean): void {
  try {
    if (on) localStorage.setItem(SESSION_HINT, '1')
    else localStorage.removeItem(SESSION_HINT)
  } catch {
    /* 무시 */
  }
}

export const activeOf = (g: Garage) => g.vehicles.find((v) => v.id === g.activeId) ?? g.vehicles[0]

export const withState = (g: Garage, id: string, state: CarState): Garage => ({
  ...g,
  vehicles: g.vehicles.map((v) => (v.id === id ? { ...v, state } : v)),
})

/** 빈 차량을 추가하고 그 차량을 선택한다. 최대 대수를 넘으면 그대로 돌려준다. */
export function addVehicle(g: Garage): Garage {
  if (g.vehicles.length >= MAX_VEHICLES) return g
  const id = newId()
  return { activeId: id, vehicles: [...g.vehicles, { id, state: blankState() }] }
}

export function removeVehicle(g: Garage, id: string): Garage {
  if (g.vehicles.length <= 1) return g
  const vehicles = g.vehicles.filter((v) => v.id !== id)
  return { activeId: g.activeId === id ? vehicles[0].id : g.activeId, vehicles }
}

export function vehicleName(state: CarState, index: number): string {
  const name = [state.vehicle.make, state.vehicle.model].filter(Boolean).join(' ')
  return name || `새 차량 ${index + 1}`
}

// ---- 게스트 → 로그인: 이 브라우저의 차고와 계정의 차고 합치기 ----

/** 사용자가 실제로 입력한 내용이 있는지(빈 차량은 합칠 필요가 없다) */
export function hasData(s: CarState): boolean {
  return Boolean(
    s.vehicle.make ||
      s.vehicle.model ||
      s.vehicle.fuelType ||
      s.odometer.km != null ||
      s.commute.kmPerDay != null ||
      s.fuel.started ||
      s.recent.length > 0 ||
      Object.values(s.services).some((it) => it.lastKm != null || it.lastDate != null),
  )
}

export type MergeResult = { garage: Garage; added: number; updated: number; skipped: number }

/**
 * 로그인했을 때 계정의 차고(server)에 이 브라우저의 차고(local)를 합친다. 덮어써서 지우지 않는다.
 *  - 같은 id의 차량: 수정 시각이 더 최근인 쪽을 쓴다(같으면 계정 쪽).
 *  - 계정에 없는 차량: 입력한 내용이 있을 때만 추가한다. 최대 대수를 넘으면 건너뛴다.
 *  - 선택된 차량은 가능하면 이 브라우저에서 쓰던 차량을 유지해서 대화가 이어지게 한다.
 * keepIds: 내용이 비어 있어도 반드시 남길 차량(예: 응답을 기다리는 대화가 있는 차량)
 */
export function mergeGarages(server: Garage, local: Garage, keepIds: string[] = []): MergeResult {
  const vehicles = server.vehicles.map((v) => ({ ...v }))
  let added = 0
  let updated = 0
  let skipped = 0
  for (const lv of local.vehicles) {
    const idx = vehicles.findIndex((v) => v.id === lv.id)
    if (idx >= 0) {
      if ((lv.state.updatedAt ?? '') > (vehicles[idx].state.updatedAt ?? '')) {
        vehicles[idx] = { ...vehicles[idx], state: lv.state }
        updated++
      }
    } else if (hasData(lv.state) || keepIds.includes(lv.id)) {
      if (vehicles.length < MAX_VEHICLES) {
        vehicles.push({ ...lv })
        added++
      } else skipped++
    }
  }
  const activeId = vehicles.some((v) => v.id === local.activeId) ? local.activeId : server.activeId
  return { garage: { activeId, vehicles }, added, updated, skipped }
}
