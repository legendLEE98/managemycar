import { useEffect, useState } from 'react'
import { getCatalogStats, type CarState, type CatalogStats } from '../api'
import { GROUPS, SERVICE_META, applicable, metaFor } from '../services'
import { BODY_GROUPS, fuelLabel } from '../vehicleOptions'

type Props = {
  state: CarState
  onPickExample: (text: string) => void
  onClose: () => void
  /** 모바일 메뉴 페이지 안에 넣을 때: 접기 버튼을 숨기고 폭을 꽉 채운다 */
  embedded?: boolean
}

const EXAMPLES = [
  '2021년식 디젤 쏘렌토 타고 있어',
  '오늘 계기판 42,591km야',
  '오늘 출퇴근 30km 탔어',
  '1800원에 5만원 주유했어',
  '엔진오일 어제 갈았어',
  '내 차 소모품 상태 알려줘',
  '내 차 정보 엑셀로 내보내줘',
]

const fmt = (n: number) => n.toLocaleString('ko-KR')

function intervalText(km: number | null, months: number | null) {
  const p: string[] = []
  if (km != null) p.push(`${fmt(km)}km`)
  if (months != null) p.push(`${months}개월`)
  return p.join(' / ') || '—'
}

export default function Sidebar({ state, onPickExample, onClose, embedded }: Props) {
  const [stats, setStats] = useState<CatalogStats | null>(null)
  const fuel = state.vehicle.fuelType

  useEffect(() => {
    getCatalogStats()
      .then(setStats)
      .catch(() => setStats(null))
  }, [])

  return (
    <aside className={`sidebar ${embedded ? 'embedded' : ''}`}>
      <div className="sb-head">
        <div className="brand">
          <img src="/favicon.svg" alt="" width={28} height={28} />
          <span>내차일기</span>
        </div>
        {!embedded && (
          <button className="sb-toggle" onClick={onClose} aria-label="사이드바 접기" title="접기">
            ‹
          </button>
        )}
      </div>
      <p className="tagline">말로 적는 내 차 관리 일기</p>

      <section className="sb-sec">
        <h4>내차일기는</h4>
        <p>
          주행, 주유, 정비를 <b>말하듯이</b> 적으면 AI가 정리해서 내 차의 상태를 갱신해요. 마지막 교체 시기와 주행거리를 바탕으로 소모품 교체 시기를 계산해서 알려드려요.
        </p>
        <ul className="sb-list">
          <li>내 차 정보는 이 브라우저에 저장되고, 로그인하면 계정에도 저장돼요.</li>
          <li>모르는 차종은 지어내지 않고 되물어봐요.</li>
        </ul>
      </section>

      <section className="sb-sec">
        <h4>이렇게 말해 보세요</h4>
        <ul className="examples">
          {EXAMPLES.map((e) => (
            <li key={e}>
              <button onClick={() => onPickExample(e)}>{e}</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="sb-sec">
        <h4>차량 데이터</h4>

        <details>
          <summary>
            지원 차종 <span className="num">{stats ? `${stats.models}개` : '…'}</span>
          </summary>
          <div className="det-body">
            {stats ? (
              <div className="tags">
                {stats.makes.map((m) => (
                  <span key={m.make} className="tag-chip">
                    {m.make} <i>{m.count}</i>
                  </span>
                ))}
              </div>
            ) : (
              <p className="muted">불러오지 못했어요.</p>
            )}
            <p className="muted">목록에 없는 차종은 확인 후 "미확인 차종"으로 등록할 수 있어요.</p>
          </div>
        </details>

        <details>
          <summary>
            소모품 교체 기준 <span className="num">{SERVICE_META.filter((m) => applicable(m, fuel)).length}종</span>
          </summary>
          <div className="det-body">
            {fuel && <p className="muted">{fuelLabel(fuel)} 차량 기준으로 보여드려요.</p>}
            {GROUPS.map((g) => {
              const items = SERVICE_META.filter((m) => applicable(m, fuel))
                .map((m) => metaFor(m, fuel))
                .filter((m) => m.group === g.id)
              if (!items.length) return null
              return (
                <div key={g.id} className="sb-group">
                  <div className="sb-group-title">{g.label}</div>
                  <table>
                    <tbody>
                      {items.map((m) => (
                        <tr key={m.key}>
                          <td>{m.label}</td>
                          <td>{intervalText(m.intervalKm, m.intervalMonths)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })}
          </div>
        </details>

        <details>
          <summary>
            차급 분류 <span className="num">{BODY_GROUPS.reduce((n, g) => n + g.items.length, 0)}종</span>
          </summary>
          <div className="det-body">
            {BODY_GROUPS.map((g) => (
              <div key={g.label} className="sb-group">
                <div className="sb-group-title">{g.label}</div>
                <table>
                  <tbody>
                    {g.items.map((b) => (
                      <tr key={b.id}>
                        <td>{b.label}</td>
                        <td>약 {b.length}m</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </details>
      </section>

      <footer className="sb-foot">
        <p>AI 답변은 틀릴 수 있어요. 중요한 정비 판단은 설명서와 정비소 안내를 따르세요.</p>
        <p>
          <a href="#/terms" target="_blank" rel="noreferrer">이용약관</a> · <a href="#/privacy" target="_blank" rel="noreferrer">개인정보 처리방침</a>
        </p>
        <p>
          3D 차량 모델: <a href="https://www.kenney.nl" target="_blank" rel="noreferrer">Kenney</a> Car Kit (CC0)
        </p>
      </footer>
    </aside>
  )
}
