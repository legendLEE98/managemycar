import { useEffect, useState, type FormEvent } from 'react'
import type { CarState } from '../api'
import { currentGroup, fmtKm, serviceSummary, serviceViews, type ServiceView } from '../derive'
import { GROUPS } from '../services'
import { todayStr } from '../stateOps'

export type ServiceRecord = { date: string | null; km: number | null }

type Props = {
  state: CarState
  /** 열자마자 입력 폼을 펼칠 항목 */
  initialEditKey?: string
  onClose: () => void
  onSave: (key: string, rec: ServiceRecord) => void
}

const fmt = (n: number) => n.toLocaleString('ko-KR')

function interval(v: ServiceView) {
  const p: string[] = []
  if (v.intervalKm != null) p.push(`${fmt(v.intervalKm)}km`)
  if (v.intervalMonths != null) p.push(`${v.intervalMonths}개월`)
  return p.join(' / ') || '—'
}

function Editor({
  view,
  odometer,
  onSave,
  onCancel,
}: {
  view: ServiceView
  odometer: number | null
  onSave: (rec: ServiceRecord) => void
  onCancel: () => void
}) {
  const [date, setDate] = useState(view.lastDate ?? '')
  const [km, setKm] = useState(view.lastKm != null ? String(view.lastKm) : '')
  const [error, setError] = useState('')
  const today = todayStr()

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const kmNum = km.trim() === '' ? null : Number(km)
    if (!date && kmNum == null) return setError('날짜나 주행거리 중 하나는 입력해 주세요.')
    if (date && date > today) return setError('미래 날짜는 입력할 수 없어요.')
    if (kmNum != null && (!Number.isFinite(kmNum) || kmNum < 0 || kmNum > 3_000_000)) {
      return setError('주행거리를 확인해 주세요.')
    }
    if (kmNum != null && odometer != null && kmNum > odometer) {
      return setError(`현재 주행거리(${fmtKm(odometer)})보다 클 수 없어요.`)
    }
    onSave({ date: date || null, km: kmNum == null ? null : Math.round(kmNum) })
  }

  const needsDate = view.intervalMonths != null
  const needsKm = view.intervalKm != null

  return (
    <form className="editor" onSubmit={submit}>
      <label>
        교체 날짜{needsDate && <b className="req">주기 계산에 사용</b>}
        <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
      </label>
      <label>
        교체 당시 주행거리(km){needsKm && <b className="req">주기 계산에 사용</b>}
        <input
          type="number"
          inputMode="numeric"
          min={0}
          placeholder={odometer != null ? `예) ${fmt(Math.max(odometer - 5000, 0))}` : '예) 30000'}
          value={km}
          onChange={(e) => setKm(e.target.value)}
        />
      </label>
      <div className="editor-actions">
        <button
          type="button"
          className="ghost"
          onClick={() => {
            setDate(today)
            if (odometer != null) setKm(String(odometer))
          }}
        >
          방금 교체했어요
        </button>
        <span className="spacer" />
        <button type="button" className="ghost" onClick={onCancel}>
          취소
        </button>
        <button type="submit" className="primary">
          저장
        </button>
      </div>
      {error && <div className="editor-error">{error}</div>}
    </form>
  )
}

export default function ServiceModal({ state, initialEditKey, onClose, onSave }: Props) {
  const [editing, setEditing] = useState<string | null>(initialEditKey ?? null)
  const views = serviceViews(state)
  const sum = serviceSummary(views)
  const cur = currentGroup(state)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (editing) setEditing(null)
      else onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, editing])

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="소모품 현황">
        <header className="modal-head">
          <div>
            <h2>소모품 현황</h2>
            <p className="sub">
              {state.odometer.km != null
                ? `현재 주행거리 ${fmtKm(state.odometer.km)}${state.odometer.source === 'estimated' ? ' (추정)' : ''} 기준`
                : '현재 주행거리를 모르면 남은 거리를 계산할 수 없어요'}
            </p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </header>

        <div className="summary">
          <span className="pill over">초과 {sum.over}</span>
          <span className="pill soon">임박 {sum.soon}</span>
          <span className="pill ok">정상 {sum.ok}</span>
          <span className="pill lack">데이터 부족 {sum.lack}</span>
        </div>

        <div className="modal-body">
          {GROUPS.map((g) => {
            const rows = views.filter((v) => v.group === g.id)
            if (!rows.length) return null
            return (
              <section key={g.id} className="group">
                <h3>
                  {g.label}
                  {cur === g.id && <span className="now">현재 주행거리 구간</span>}
                </h3>
                <div className="rows">
                  <div className="row head">
                    <span>항목</span>
                    <span>사용 비율</span>
                    <span>상태</span>
                    <span>마지막 교체</span>
                    <span>교체 주기</span>
                  </div>
                  {rows.map((v) => {
                    const hasHistory = v.lastDate || v.lastKm != null
                    return (
                      <div key={v.key} className={`row-wrap ${editing === v.key ? 'editing' : ''}`}>
                        <div className="row">
                          <span className="name">
                            {v.label}
                            {v.note && <small>{v.note}</small>}
                          </span>
                          <span className={`gauge ${v.state !== 'ok' ? 'empty' : v.level}`}>
                            <i style={{ width: `${v.state === 'ok' ? Math.max(v.ratio * 100, 3) : 0}%` }} />
                          </span>
                          <span className="status">
                            {v.state === 'ok' ? (
                              <em className={v.level}>{v.text}</em>
                            ) : (
                              <button className="fill" onClick={() => setEditing(v.key)}>
                                {v.state === 'unknown' ? '이력 입력' : `${v.missing.join(', ')} 입력`}
                              </button>
                            )}
                          </span>
                          <span className="last">
                            {hasHistory
                              ? [v.lastDate, v.lastKm != null ? fmtKm(v.lastKm) : null].filter(Boolean).join(' · ')
                              : '—'}
                            {hasHistory && editing !== v.key && (
                              <button className="edit" onClick={() => setEditing(v.key)}>
                                수정
                              </button>
                            )}
                          </span>
                          <span className="intv">{interval(v)}</span>
                        </div>
                        {editing === v.key && (
                          <Editor
                            view={v}
                            odometer={state.odometer.km}
                            onCancel={() => setEditing(null)}
                            onSave={(rec) => {
                              onSave(v.key, rec)
                              setEditing(null)
                            }}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>

        <footer className="modal-foot">
          교체 주기는 일반 기준이에요. 차종·운행 환경에 따라 다르니 사용설명서를 확인하고, 대화로 바꿀 수 있어요. (예: "엔진오일 주기 7000km로 바꿔줘")
        </footer>
      </div>
    </div>
  )
}
