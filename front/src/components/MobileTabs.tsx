export type MobileTab = 'chat' | 'state' | 'calendar' | 'shops'

const ITEMS: { id: MobileTab; label: string; icon: string }[] = [
  { id: 'chat', label: '대화', icon: '💬' },
  { id: 'state', label: '내 차량 상태', icon: '🚗' },
  { id: 'calendar', label: '캘린더', icon: '📅' },
  { id: 'shops', label: '지도', icon: '📍' },
]

/** 모바일 하단 4단 탭 */
export default function MobileTabs({ tab, onChange }: { tab: MobileTab; onChange: (t: MobileTab) => void }) {
  return (
    <nav className="mtabs" aria-label="주요 메뉴">
      {ITEMS.map((t) => (
        <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => onChange(t.id)} aria-current={tab === t.id ? 'page' : undefined}>
          <span className="mt-icon" aria-hidden>
            {t.icon}
          </span>
          <span className="mt-label">{t.label}</span>
        </button>
      ))}
    </nav>
  )
}
