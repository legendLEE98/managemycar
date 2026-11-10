import { useState } from 'react'
import type { Garage } from '../api'

/** 등록한 전체 차량을 엑셀(.xlsx)로 내려받는다. 엑셀 만드는 코드는 누를 때 불러온다. */
export default function ExportButton({ garage, className, label }: { garage: Garage; className?: string; label?: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const run = async () => {
    setBusy(true)
    setError('')
    try {
      const { downloadGarageXlsx } = await import('../exportXlsx')
      await downloadGarageXlsx(garage)
    } catch {
      setError('엑셀 파일을 만들지 못했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button className={className ?? 'btn ghost'} onClick={run} disabled={busy} title="등록한 모든 차량을 엑셀 파일로 저장해요">
        {busy ? '만드는 중…' : (label ?? '📊 엑셀로 내보내기')}
      </button>
      {error && <p className="export-error">{error}</p>}
    </>
  )
}
