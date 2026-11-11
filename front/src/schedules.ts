/** 캘린더 일정. 차량 상태(CarState)와 따로 저장한다: 로그인하면 서버의 일정 API, 아니면 이 브라우저. */
export type Schedule = { id: string; vehicleId: string; date: string; title: string }

export const MAX_SCHEDULES = 200 // 차량당

export const newScheduleId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

// ---- 이 브라우저(게스트) ----
const GUEST_SCHEDULES_KEY = 'mycar.schedules.guest.v1'
const GUEST_KEY = 'mycar.guest.v2' // 차고 저장본(예전에는 일정도 차량 상태 안에 들어 있었다)

const clean = (x: unknown): Schedule | null => {
  const o = x as Partial<Schedule> | null
  if (!o || typeof o.id !== 'string' || typeof o.vehicleId !== 'string' || typeof o.date !== 'string' || typeof o.title !== 'string') return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(o.date) || !o.title.trim()) return null
  return { id: o.id, vehicleId: o.vehicleId, date: o.date, title: o.title.slice(0, 60) }
}

/**
 * 게스트 일정을 읽는다. 예전 형식(차량 상태 안의 schedules)이 남아 있으면 이쪽으로 옮기고 차고 저장본에서는 뺀다.
 * 차고 저장본이 다시 저장되기 전에(앱을 처음 그리기 전에) 한 번만 부른다.
 */
export function loadGuestSchedules(): Schedule[] {
  const out: Schedule[] = []
  try {
    const raw = localStorage.getItem(GUEST_SCHEDULES_KEY)
    if (raw) for (const x of JSON.parse(raw)) {
      const c = clean(x)
      if (c) out.push(c)
    }
  } catch {
    /* 손상된 값이면 비어 있는 것으로 */
  }
  try {
    const raw = localStorage.getItem(GUEST_KEY)
    if (raw) {
      const g = JSON.parse(raw)
      let moved = false
      for (const v of g?.vehicles ?? []) {
        const embedded = v?.state?.schedules
        if (Array.isArray(embedded)) {
          for (const x of embedded) {
            const c = clean({ ...x, vehicleId: v.id })
            if (c && !out.some((o) => o.id === c.id)) out.push(c)
          }
          delete v.state.schedules
          moved = true
        }
      }
      if (moved) {
        localStorage.setItem(GUEST_KEY, JSON.stringify(g))
        saveGuestSchedules(out)
      }
    }
  } catch {
    /* 무시 */
  }
  return out
}

export function saveGuestSchedules(list: Schedule[]): void {
  try {
    localStorage.setItem(GUEST_SCHEDULES_KEY, JSON.stringify(list))
  } catch {
    /* 저장 실패는 무시 */
  }
}

export function clearGuestSchedules(): void {
  try {
    localStorage.removeItem(GUEST_SCHEDULES_KEY)
  } catch {
    /* 무시 */
  }
}

// ---- 서버(로그인) ----
async function fail(res: Response, fallback: string): Promise<never> {
  let msg = fallback
  try {
    const j = await res.json()
    if (j?.message) msg = j.message
  } catch {
    /* 본문이 JSON이 아니면 기본 문구 */
  }
  throw new Error(msg)
}

export async function getServerSchedules(): Promise<Schedule[]> {
  const res = await fetch('/api/v1/me/schedules')
  if (!res.ok) return fail(res, '일정을 불러오지 못했어요.')
  return res.json()
}

/** 한 건 저장. 같은 날짜·제목이 이미 있으면 기존 일정이 돌아온다(id가 다를 수 있다). */
export async function addServerSchedule(s: Schedule): Promise<Schedule> {
  const res = await fetch('/api/v1/me/schedules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(s),
  })
  if (!res.ok) return fail(res, '일정을 저장하지 못했어요.')
  return res.json()
}

export async function importServerSchedules(list: Schedule[]): Promise<void> {
  const res = await fetch('/api/v1/me/schedules/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(list),
  })
  if (!res.ok) return fail(res, '일정을 옮기지 못했어요.')
}

export async function removeServerSchedule(id: string): Promise<void> {
  const res = await fetch(`/api/v1/me/schedules/${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!res.ok) return fail(res, '일정을 삭제하지 못했어요.')
}
