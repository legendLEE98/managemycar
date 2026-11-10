import { useEffect, useState } from 'react'
import type { Garage } from '../api'
import { listVersions, restoreVersion, type VersionInfo } from '../auth'

type Props = { onClose: () => void; onRestored: (garage: Garage) => void }

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })

export default function HistoryModal({ onClose, onRestored }: Props) {
  const [items, setItems] = useState<VersionInfo[] | null>(null)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    listVersions()
      .then(setItems)
      .catch(() => setError('이력을 불러오지 못했어요.'))
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const restore = async (version: number) => {
    setBusy(true)
    setError('')
    try {
      const r = await restoreVersion(version)
      onRestored(r.state)
      onClose()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  const latest = items?.[0]?.version

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal narrow" role="dialog" aria-modal="true" aria-label="변경 이력">
        <header className="modal-head">
          <div>
            <h2>변경 이력</h2>
            <p className="sub">계정에 저장된 내 차 정보의 버전이에요. 되돌려도 기존 이력은 지워지지 않아요.</p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </header>

        <div className="modal-body history">
          {error && <div className="editor-error">{error}</div>}
          {!items && !error && <p className="sub">불러오는 중…</p>}
          {items && items.length === 0 && <p className="sub">아직 저장된 이력이 없어요.</p>}
          <ul className="versions">
            {items?.map((v) => (
              <li key={v.version} className={v.version === latest ? 'current' : ''}>
                <div className="v-main">
                  <span className="v-no">v{v.version}</span>
                  <span className="v-sum">{v.summary || '상태 저장'}</span>
                </div>
                <div className="v-meta">
                  <span>{fmtDate(v.createdAt)}</span>
                  {v.version === latest ? (
                    <em>현재</em>
                  ) : confirm === v.version ? (
                    <span className="v-confirm">
                      이 시점으로 되돌릴까요?
                      <button className="btn primary" disabled={busy} onClick={() => restore(v.version)}>
                        되돌리기
                      </button>
                      <button className="btn ghost" onClick={() => setConfirm(null)}>
                        취소
                      </button>
                    </span>
                  ) : (
                    <button className="btn ghost" onClick={() => setConfirm(v.version)}>
                      이 시점으로
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
