import type { CarState } from '../api'
import { serviceViews } from '../derive'
import { PART_INFO, type Part } from '../services'

type Props = {
  part: Part
  /** 캔버스 영역 안에서의 클릭 위치(px) */
  x: number
  y: number
  boxWidth: number
  state: CarState
  onClose: () => void
  onOpenServices: (key?: string) => void
}

const W = 290

export default function PartPopover({ part, x, y, boxWidth, state, onClose, onOpenServices }: Props) {
  const info = PART_INFO[part]
  const rows = serviceViews(state)
    .filter((v) => info.keys.includes(v.key))
    // 급한 것부터, 계산 불가한 항목은 뒤로
    .sort((a, b) => (a.state === 'ok' ? 1 - a.ratio : 2) - (b.state === 'ok' ? 1 - b.ratio : 2))

  const left = Math.max(8, Math.min(x + 14, boxWidth - W - 8))

  return (
    <div className="popover" style={{ left, top: y + 14, width: W }} role="dialog" aria-label={`${info.label} 소모품`}>
      <div className="pop-head">
        <div>
          <strong>{info.label}</strong>
          <span>{info.sub}</span>
        </div>
        <button onClick={onClose} aria-label="닫기">
          ×
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="pop-empty">이 차량에는 관리할 소모품이 없어요.</p>
      ) : (
        <ul className="pop-list">
          {rows.map((v) => (
            <li key={v.key}>
              <button onClick={() => onOpenServices(v.key)} title="눌러서 교체 이력 입력·수정">
                <span className="pop-name">{v.label}</span>
                {v.state === 'ok' ? (
                  <span className={`pop-status ${v.level}`}>{v.text}</span>
                ) : (
                  <span className="pop-status lack">{v.state === 'unknown' ? '이력 없음' : '일부 부족'}</span>
                )}
                <span className={`gauge ${v.state !== 'ok' ? 'empty' : v.level}`}>
                  <i style={{ width: `${v.state === 'ok' ? Math.max(v.ratio * 100, 3) : 0}%` }} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <button className="pop-more" onClick={() => onOpenServices()}>
        소모품 현황 전체 보기
      </button>
    </div>
  )
}
