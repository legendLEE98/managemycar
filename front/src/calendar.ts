import type { CarState } from './api'
import { mostUrgent, serviceViews } from './derive'
import type { Schedule } from './schedules'

export type CalKind = 'done' | 'due' | 'overdue' | 'log' | 'plan'
export type CalEvent = { date: string; kind: CalKind; title: string; detail?: string; scheduleId?: string }

const pad = (n: number) => String(n).padStart(2, '0')
export const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const todayKey = () => toKey(new Date())

const fromKey = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function addMonths(dateKey: string, months: number): string {
  const d = fromKey(dateKey)
  d.setMonth(d.getMonth() + months)
  return toKey(d)
}

/**
 * 선택한 차량의 일정:
 *  - done: 소모품을 교체한 날(교체 이력)
 *  - due / overdue: 개월 기준으로 계산한 교체 예정일(지났으면 overdue)
 *  - log: 주행·주유·계기판 갱신 같은 기록
 *  - plan: 사용자가 직접 넣은 일정(schedules: 선택한 차량의 것만 넘긴다)
 * 주행거리 기준 항목은 날짜를 정할 수 없어서 일정에 넣지 않는다(임박한 소모품 목록에 표시).
 */
export function buildEvents(state: CarState, schedules: Schedule[] = []): CalEvent[] {
  const out: CalEvent[] = []
  const today = todayKey()
  for (const v of serviceViews(state)) {
    if (v.lastDate) {
      out.push({
        date: v.lastDate,
        kind: 'done',
        title: `${v.label} 교체`,
        detail: v.lastKm != null ? `${v.lastKm.toLocaleString('ko-KR')}km` : undefined,
      })
      if (v.intervalMonths != null) {
        const due = addMonths(v.lastDate, v.intervalMonths)
        out.push({
          date: due,
          kind: due < today ? 'overdue' : 'due',
          title: `${v.label} 교체 ${due < today ? '시기 지남' : '예정'}`,
          detail: `교체 주기 ${v.intervalMonths}개월`,
        })
      }
    }
  }
  for (const x of schedules) out.push({ date: x.date, kind: 'plan', title: x.title, scheduleId: x.id })
  for (const e of state.recent) {
    if (e.at && (e.type === 'fuel' || e.type === 'trip' || e.type === 'odometer')) {
      out.push({ date: e.at, kind: 'log', title: e.summary })
    }
  }
  return out
}

export function groupByDate(events: CalEvent[]): Map<string, CalEvent[]> {
  const m = new Map<string, CalEvent[]>()
  const order: Record<CalKind, number> = { plan: 0, overdue: 1, due: 2, done: 3, log: 4 }
  for (const e of events) {
    const list = m.get(e.date) ?? []
    list.push(e)
    m.set(e.date, list)
  }
  for (const list of m.values()) list.sort((a, b) => order[a.kind] - order[b.kind])
  return m
}

/** 앞으로 다가오는(또는 지난) 교체 예정일, 가까운 순 */
export function upcoming(events: CalEvent[], n = 5): CalEvent[] {
  return events
    .filter((e) => e.kind === 'due' || e.kind === 'overdue')
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(0, n)
}

/** 거리·기간 어느 쪽이든 가장 임박한 소모품 */
export function urgentItems(state: CarState, n = 5) {
  return mostUrgent(serviceViews(state), n)
}
