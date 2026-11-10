import { useMemo, useState } from 'react'
import type { CarState } from '../api'
import { serviceViews } from '../derive'
import { buildEvents, groupByDate, toKey, todayKey, upcoming, urgentItems, type CalEvent, type CalKind } from '../calendar'

const WEEK = ['일', '월', '화', '수', '목', '금', '토']
const KIND_LABEL: Record<CalKind, string> = { done: '교체 완료', due: '교체 예정', overdue: '시기 지남', log: '기록' }

const dateLabel = (key: string) => {
  const [y, m, d] = key.split('-').map(Number)
  return `${y}년 ${m}월 ${d}일 (${WEEK[new Date(y, m - 1, d).getDay()]})`
}

export default function CalendarView({ state }: { state: CarState }) {
  const now = new Date()
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const [selected, setSelected] = useState(todayKey())

  const events = useMemo(() => buildEvents(state), [state])
  const byDate = useMemo(() => groupByDate(events), [events])
  const soon = useMemo(() => upcoming(events), [events])
  const urgent = useMemo(() => urgentItems(state), [state])
  // 계산할 항목이 없을 때 먼저 확인해 보라고 권할 소모품: 엔진오일(전기차는 없으므로 주기가 가장 짧은 항목)
  const firstCheck = useMemo(() => {
    const views = serviceViews(state)
    return (
      views.find((v) => v.key === 'engineOil') ??
      [...views].filter((v) => v.intervalKm != null).sort((a, b) => a.intervalKm! - b.intervalKm!)[0]
    )?.label
  }, [state])

  // 6주 × 7일 격자
  const first = new Date(ym.y, ym.m, 1)
  const start = new Date(ym.y, ym.m, 1 - first.getDay())
  const cells = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
  const today = todayKey()

  const move = (delta: number) => setYm((p) => {
    const d = new Date(p.y, p.m + delta, 1)
    return { y: d.getFullYear(), m: d.getMonth() }
  })
  const goToday = () => {
    setYm({ y: now.getFullYear(), m: now.getMonth() })
    setSelected(today)
  }

  const selEvents: CalEvent[] = byDate.get(selected) ?? []

  return (
    <div className="cal">
      <section className="cal-main">
        <header className="cal-head">
          <h2>
            {ym.y}년 {ym.m + 1}월
          </h2>
          <div className="cal-nav">
            <button className="btn ghost" onClick={() => move(-1)} aria-label="이전 달">
              ‹
            </button>
            <button className="btn ghost" onClick={goToday}>
              오늘
            </button>
            <button className="btn ghost" onClick={() => move(1)} aria-label="다음 달">
              ›
            </button>
          </div>
        </header>

        <div className="cal-grid cal-week">
          {WEEK.map((w, i) => (
            <span key={w} className={i === 0 ? 'sun' : i === 6 ? 'sat' : ''}>
              {w}
            </span>
          ))}
        </div>
        <div className="cal-grid cal-days">
          {cells.map((d) => {
            const key = toKey(d)
            const list = byDate.get(key) ?? []
            const other = d.getMonth() !== ym.m
            return (
              <button
                key={key}
                className={`cal-cell ${other ? 'other' : ''} ${key === today ? 'today' : ''} ${key === selected ? 'sel' : ''}`}
                onClick={() => setSelected(key)}
              >
                <span className="cal-num">{d.getDate()}</span>
                <span className="cal-chips">
                  {list.slice(0, 2).map((e, i) => (
                    <i key={i} className={`chip-ev ${e.kind}`} title={e.title}>
                      {e.title}
                    </i>
                  ))}
                  {list.length > 2 && <em>+{list.length - 2}</em>}
                </span>
              </button>
            )
          })}
        </div>

        <div className="cal-legend">
          <span><i className="dot done" /> 교체 완료</span>
          <span><i className="dot due" /> 교체 예정</span>
          <span><i className="dot overdue" /> 시기 지남</span>
          <span><i className="dot log" /> 기록</span>
        </div>
      </section>

      <aside className="cal-side">
        <section className="card">
          <h3>{dateLabel(selected)}</h3>
          {selEvents.length === 0 ? (
            <p className="muted">이 날의 일정이 없어요.</p>
          ) : (
            <ul className="cal-list">
              {selEvents.map((e, i) => (
                <li key={i}>
                  <i className={`dot ${e.kind}`} />
                  <div>
                    <b>{e.title}</b>
                    <small>
                      {KIND_LABEL[e.kind]}
                      {e.detail ? ` · ${e.detail}` : ''}
                    </small>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h3>다가오는 교체 예정</h3>
          {soon.length === 0 ? (
            <p className="muted">개월 기준으로 계산된 예정일이 아직 없어요. 소모품의 교체 날짜를 입력하면 여기에 표시돼요.</p>
          ) : (
            <ul className="cal-list">
              {soon.map((e, i) => (
                <li key={i}>
                  <i className={`dot ${e.kind}`} />
                  <button className="cal-jump" onClick={() => {
                    const [y, m] = e.date.split('-').map(Number)
                    setYm({ y, m: m - 1 })
                    setSelected(e.date)
                  }}>
                    <b>{e.title}</b>
                    <small>{dateLabel(e.date)}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h3>가장 임박한 소모품</h3>
          {urgent.length === 0 ? (
            <p className="nudge">우선 교체주기가 가장 짧은 {firstCheck ?? '엔진오일'}부터 확인해볼까요?</p>
          ) : (
            <ul className="cal-list">
              {urgent.map((v) => (
                <li key={v.key}>
                  <i className={`dot ${v.level === 'over' ? 'overdue' : v.level === 'soon' ? 'due' : 'done'}`} />
                  <div>
                    <b>{v.label}</b>
                    <small>{v.text}</small>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {urgent.length > 0 && (
            <p className="muted">주행거리 기준 항목은 날짜를 정할 수 없어서 달력 대신 여기에 보여드려요.</p>
          )}
        </section>
      </aside>
    </div>
  )
}
