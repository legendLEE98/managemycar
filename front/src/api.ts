import type { CarType } from './vehicleOptions'

export type ServiceItem = {
  lastKm: number | null
  lastDate: string | null
  intervalKm: number | null
  intervalMonths: number | null
}

export type CarState = {
  version: number
  vehicle: {
    bodyType: CarType
    make: string | null
    model: string | null
    modelYear: number | null
    fuelType: string | null
    /** true: 차종 목록에서 확인됨 / false: 사용자가 확인하고 등록한 미확인 차종 / null: 차종 없음 */
    verified: boolean | null
  }
  odometer: { km: number | null; source: 'reported' | 'estimated'; updatedAt: string | null }
  commute: { kmPerDay: number | null }
  fuel: { totalLiters: number; totalCost: number; started: boolean; litersSinceStart: number; trackedKm: number }
  services: Record<string, ServiceItem>
  recent: { at: string | null; type: string | null; summary: string }[]
  updatedAt: string | null
}

export type CatalogMatch = {
  make: string
  model: string
  bodyType: CarType
  bodyLabel: string
  fuels: string[]
  from: number | null
  to: number | null
}

/** match: 하나로 확정 / candidates: 후보 / none: 없음 */
export type CatalogResult = { status: 'match' | 'candidates' | 'none'; matches: CatalogMatch[] }

export async function searchVehicle(q: string): Promise<CatalogResult> {
  const res = await fetch(`/api/v1/vehicles/search?q=${encodeURIComponent(q)}`)
  if (!res.ok) throw new Error('search failed')
  return res.json()
}

export type CatalogStats = { models: number; makes: { make: string; count: number }[] }

export async function getCatalogStats(): Promise<CatalogStats> {
  const res = await fetch('/api/v1/vehicles/stats')
  if (!res.ok) throw new Error('stats failed')
  return res.json()
}

/** 내 차고: 여러 대의 차량과 현재 선택된 차량 */
export type VehicleEntry = { id: string; state: CarState }
export type Garage = { activeId: string; vehicles: VehicleEntry[] }

export type ChatMessage = { role: 'user' | 'assistant'; content: string }

/** 오늘의 채팅 사용량. day는 한국 시간 기준 날짜(YYYY-MM-DD) */
export type ChatUsage = { used: number; limit: number; day: string; loggedIn: boolean }

/** 대화창에 보여 줄 동작. export_excel → 엑셀 받기 버튼(scope: all=전체 차량, current=선택한 차량) */
export type ChatAction = { type: string; scope?: 'all' | 'current' }

export type ChatResult = {
  reply: string
  state: CarState
  changes: string[]
  usage?: ChatUsage | null
  actions?: ChatAction[]
}

export async function getChatUsage(): Promise<ChatUsage> {
  const res = await fetch('/api/v1/chat/usage')
  if (!res.ok) throw new Error('usage failed')
  return res.json()
}

export async function sendChat(messages: ChatMessage[], state: CarState): Promise<ChatResult> {
  const res = await fetch('/api/v1/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, state }),
  })
  if (!res.ok) {
    let msg = '요청에 실패했어요. 잠시 후 다시 시도해 주세요.'
    try {
      const j = await res.json()
      if (j?.message) msg = j.message
    } catch {
      /* ignore */
    }
    throw new Error(msg)
  }
  return res.json()
}
