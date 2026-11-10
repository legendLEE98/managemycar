import { useEffect, useRef, useState } from 'react'
import AuthModal from './components/AuthModal'
import HistoryModal from './components/HistoryModal'
import MyPageModal from './components/MyPageModal'
import DrivingModal, { type DrivingEdit } from './components/DrivingModal'
import PasswordModal from './components/PasswordModal'
import { getMe, getServerState, logout, putServerState, type User } from './auth'
import CarViewer from './components/CarViewer'
import MobileMenu from './components/MobileMenu'
import MobileTabs from './components/MobileTabs'
import VehicleSwitcher from './components/VehicleSwitcher'
import { MOBILE_QUERY, useMediaQuery } from './useMediaQuery'
import CalendarView from './components/CalendarView'
import ChatBox, { type Draft } from './components/ChatBox'
import ShopsMap from './components/ShopsMap'
import StatePanel from './components/StatePanel'
import ServiceModal, { type ServiceRecord } from './components/ServiceModal'
import Sidebar from './components/Sidebar'
import VehicleModal from './components/VehicleModal'
import { applyDriving, recordService, updateVehicle, type VehiclePatch } from './stateOps'
import { getChatUsage, sendChat, type CarState, type ChatAction, type ChatMessage, type ChatUsage, type Garage } from './api'
import ExportButton from './components/ExportButton'
import {
  activeOf,
  addVehicle,
  clearLocalGarage,
  hasData,
  hasSessionHint,
  loadGuestGarage,
  mergeGarages,
  normalizeGarage,
  removeLegacyKeys,
  removeVehicle,
  saveGuestGarage,
  setSessionHint,
  withState,
  type GarageSource,
} from './storage'
import type { Gap } from './derive'

type Tab = 'chat' | 'state' | 'calendar' | 'shops'
/** PC 헤더 탭. 'state'(내 차량 상태)는 PC에서는 우측 패널이라 모바일에서만 탭으로 쓴다. */
const TABS: { id: Tab; label: string; hash: string }[] = [
  { id: 'chat', label: '대화', hash: '#/' },
  { id: 'calendar', label: '캘린더', hash: '#/calendar' },
  { id: 'shops', label: '근처 정비소', hash: '#/shops' },
]
const ALL_HASH: Record<Tab, string> = { chat: '#/', state: '#/state', calendar: '#/calendar', shops: '#/shops' }
const tabFromHash = (): Tab =>
  (Object.entries(ALL_HASH).find(([id, h]) => id !== 'chat' && h === window.location.hash)?.[0] as Tab | undefined) ?? 'chat'

type Msg = ChatMessage & { changes?: string[]; actions?: ChatAction[]; before?: { vehicleId: string; state: CarState } }

export default function App() {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const initial = useRef(loadGuestGarage()) // 이 브라우저에 있는 게스트 데이터
  const [garage, setGarage] = useState<Garage>(initial.current.garage)
  const sourceRef = useRef<GarageSource>(initial.current.source)
  const active = activeOf(garage)
  const state = active.state
  const convo = useRef(0) // 차량을 바꾸면 대화를 새로 시작한다
  const [pending, setPending] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [usage, setUsage] = useState<ChatUsage | null>(null)
  const [modal, setModal] = useState<{ editKey?: string } | null>(null)
  const [vehicleOpen, setVehicleOpen] = useState(false)
  const [drivingOpen, setDrivingOpen] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [syncReady, setSyncReady] = useState(false)
  const [syncFailed, setSyncFailed] = useState(false)
  const [authModal, setAuthModal] = useState<'login' | 'signup' | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [mypageOpen, setMypageOpen] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const garageRef = useRef(garage)
  garageRef.current = garage
  const pendingRef = useRef(false)
  pendingRef.current = pending

  const userRef = useRef<User | null>(null)
  userRef.current = user
  const syncedRef = useRef(false) // 계정(서버)과 맞춘 뒤에는 true. 이때부터 변경은 서버에만 저장한다.
  const dirtyRef = useRef(false) // 서버에 아직 못 보낸 변경이 있는지

  /**
   * 차고를 바꾼다. 로그인 전(게스트)이거나 계정과 아직 맞추기 전이면 이 브라우저에 저장하고,
   * 계정과 맞춘 뒤에는 서버에만 저장한다(이 브라우저에는 계정 데이터를 사본으로 남기지 않는다).
   */
  const updateGarage = (next: Garage) => {
    setGarage(next)
    garageRef.current = next
    if (!userRef.current || !syncedRef.current) {
      saveGuestGarage(next)
      sourceRef.current = 'v2'
    } else {
      dirtyRef.current = true
    }
  }
  /** 특정 차량의 상태를 바꾼다(비동기 응답이 와도 그 차량에 반영되도록 id로 지정) */
  const commit = (id: string, next: CarState) => updateGarage(withState(garageRef.current, id, next))
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      return localStorage.getItem('mycar.sidebar') !== 'closed'
    } catch {
      return true
    }
  })
  const endRef = useRef<HTMLDivElement>(null)

  // 탭은 주소의 #(해시)와 맞춰 둔다. 새로고침·뒤로가기에도 유지된다.
  const [tab, setTab] = useState<Tab>(tabFromHash)
  const isMobile = useMediaQuery(MOBILE_QUERY)
  const [menuOpen, setMenuOpen] = useState(false)
  // PC에는 '내 차량 상태' 탭이 없다(우측 패널이 항상 보인다). 모바일에서 열었던 주소로 PC에 오면 대화로 보여 준다.
  const tabNow: Tab = !isMobile && tab === 'state' ? 'chat' : tab
  useEffect(() => {
    const onHash = () => setTab(tabFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const goTab = (t: Tab) => {
    const hash = ALL_HASH[t]
    if (window.location.hash !== hash && !(hash === '#/' && window.location.hash === '')) window.location.hash = hash
    setTab(t)
  }
  const chatting = msgs.length > 0

  // 오늘 사용량(로그인 여부가 바뀌면 다시 불러온다: 로그인 사용자는 계정 기준이라 한도가 다르다)
  const refreshUsage = () =>
    getChatUsage()
      .then(setUsage)
      .catch(() => {
        /* 사용량 표시는 부가 기능이라 실패해도 대화에는 영향 없다 */
      })
  useEffect(() => {
    if (authReady) refreshUsage()
  }, [authReady, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // 로그인 상태 확인
  useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setAuthReady(true))
  }, [])

  // 로그인하지 않은 상태로 확정되면 게스트 저장본을 현재 형식으로 정리한다(예전 형식은 지운다).
  useEffect(() => {
    if (!authReady || user) return
    saveGuestGarage(garageRef.current)
    sourceRef.current = 'v2'
    removeLegacyKeys()
    setSessionHint(false)
  }, [authReady, user])

  /**
   * 로그인하면: 계정의 차고를 불러와 이 브라우저의 게스트 데이터를 합치고 → 서버에 저장하고 →
   * 저장이 확인된 뒤에만 이 브라우저의 저장본을 지운다. (서버 저장에 실패하면 지우지 않는다)
   */
  useEffect(() => {
    if (!user) {
      setSyncReady(false)
      setSyncFailed(false)
      syncedRef.current = false
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const server = await getServerState()
        if (cancelled) return
        const guest = garageRef.current
        let result: Garage
        let note = ''
        if (server) {
          const srv = normalizeGarage(server)
          // 예전 형식 저장본은 계정 데이터의 사본일 수 있어서 합치지 않는다(지운 차량이 되살아나는 것을 막는다).
          const guestHas = sourceRef.current !== 'legacy' && guest.vehicles.some((v) => hasData(v.state))
          if (guestHas) {
            const keep = pendingRef.current ? [guest.activeId] : []
            const m = mergeGarages(srv, guest, keep)
            result = m.garage
            const parts = [
              m.added ? `이 브라우저에서 입력한 차량 ${m.added}대를 내 계정에 합쳤어요.` : '',
              m.updated ? `${m.updated}대는 이 브라우저의 최신 내용으로 갱신했어요.` : '',
              m.skipped ? `차량은 최대 5대까지라 ${m.skipped}대는 합치지 못했어요.` : '',
            ].filter(Boolean)
            if (parts.length) note = `로그인했어요. ${parts.join(' ')}`
          } else {
            result = srv
          }
        } else {
          result = guest // 새 계정: 이 브라우저의 데이터를 그대로 올린다
        }
        await putServerState(result)
        if (cancelled) return

        // 맞추는 동안 바뀐 것(예: 응답을 기다리던 대화의 결과)이 있으면 한 번 더 합쳐서 저장한다.
        const latest = garageRef.current
        if (latest !== guest) {
          result = mergeGarages(result, latest, pendingRef.current ? [latest.activeId] : []).garage
          await putServerState(result)
          if (cancelled) return
        }

        syncedRef.current = true
        dirtyRef.current = false
        setGarage(result)
        garageRef.current = result
        clearLocalGarage() // 서버에 저장된 뒤에만 이 브라우저의 차량 데이터를 지운다
        setSessionHint(true)
        if (result.activeId !== guest.activeId) resetChat() // 선택된 차량이 바뀌면 대화를 새로 시작
        // 대화가 진행 중일 때만 알려 준다(대화가 없으면 조용히 합친다)
        if (note) setMsgs((m) => (m.length ? [...m, { role: 'assistant', content: note }] : m))
        setSyncReady(true)
      } catch {
        // 서버와 맞추지 못하면 지우지 않고 이 브라우저의 데이터로 계속 쓴다.
        if (!cancelled) setSyncFailed(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // 로그인 중에는 변경이 있을 때 계정(서버)에 저장
  useEffect(() => {
    if (!user || !syncReady || !dirtyRef.current) return
    const t = setTimeout(() => {
      putServerState(garage)
        .then(() => {
          if (garageRef.current === garage) dirtyRef.current = false
        })
        .catch(() => {
          /* 다음 변경 때 다시 시도 */
        })
    }, 500)
    return () => clearTimeout(t)
  }, [garage, user, syncReady])

  // 저장하기 전에 탭을 닫거나 이동해도 마지막 변경이 사라지지 않게 보낸다.
  useEffect(() => {
    const flush = () => {
      if (userRef.current && syncedRef.current && dirtyRef.current) {
        putServerState(garageRef.current, true).catch(() => {
          /* 최선을 다하되 실패해도 어쩔 수 없다 */
        })
      }
    }
    const onVisibility = () => document.visibilityState === 'hidden' && flush()
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  /** 로그아웃: 못 보낸 변경을 저장하고, 이 브라우저에 남은 계정 데이터를 지운 뒤 빈 게스트 상태로 돌아간다. */
  const doLogout = async () => {
    try {
      if (syncedRef.current && dirtyRef.current) await putServerState(garageRef.current).catch(() => {})
      await logout()
    } finally {
      syncedRef.current = false
      dirtyRef.current = false
      clearLocalGarage()
      setSessionHint(false)
      const fresh = normalizeGarage(null)
      setGarage(fresh)
      garageRef.current = fresh
      saveGuestGarage(fresh)
      sourceRef.current = 'v2'
      resetChat()
      setUser(null)
    }
  }

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, pending])

  const send = async (text: string) => {
    const next: Msg[] = [...msgs, { role: 'user', content: text }]
    setMsgs(next)
    setPending(true)
    const vid = active.id
    const turn = convo.current
    const before = state
    try {
      const res = await sendChat(
        next.map(({ role, content }) => ({ role, content })),
        before,
      )
      commit(vid, res.state)
      if (res.usage) setUsage(res.usage)
      if (turn !== convo.current) return // 응답을 기다리는 사이 차량을 바꿨으면 대화에는 붙이지 않는다
      setMsgs((m) => [
        ...m,
        {
          role: 'assistant',
          content: res.reply,
          changes: res.changes,
          actions: res.actions,
          before: res.changes.length ? { vehicleId: vid, state: before } : undefined,
        },
      ])
    } catch (e) {
      refreshUsage() // 한도 초과로 거절됐다면 화면의 횟수도 맞춰 둔다
      if (turn === convo.current) setMsgs((m) => [...m, { role: 'assistant', content: (e as Error).message }])
    } finally {
      if (turn === convo.current) setPending(false)
    }
  }

  const undo = (idx: number) => {
    const before = msgs[idx].before
    if (!before) return
    commit(before.vehicleId, before.state)
    setMsgs((m) => [
      ...m.map((x, i) => (i === idx ? { ...x, before: undefined } : x)),
      { role: 'assistant', content: '방금 변경을 되돌렸어요.' },
    ])
  }

  const fillDraft = (text: string) => setDraft({ text, n: Date.now() })

  const toggleSidebar = (open: boolean) => {
    setSidebarOpen(open)
    try {
      localStorage.setItem('mycar.sidebar', open ? 'open' : 'closed')
    } catch {
      /* 저장 실패는 무시 */
    }
  }
  const pickGap = (g: Gap) => {
    if (g.action === 'services') setModal({ editKey: g.serviceKey })
    else if (g.action === 'vehicle') setVehicleOpen(true)
    else if (g.action === 'odometer') setDrivingOpen(true)
    else fillDraft(g.example)
  }

  const saveVehicle = (patch: VehiclePatch) => commit(active.id, updateVehicle(state, patch))

  const saveDriving = (edit: DrivingEdit) => commit(active.id, applyDriving(state, edit))

  const saveService = (key: string, rec: ServiceRecord) => commit(active.id, recordService(state, key, rec))

  // ---- 여러 대 관리 ----
  const resetChat = () => {
    convo.current += 1
    setMsgs([])
    setPending(false)
  }
  const switchVehicle = (id: string) => {
    updateGarage({ ...garageRef.current, activeId: id })
    resetChat()
  }
  const addNewVehicle = () => {
    updateGarage(addVehicle(garageRef.current))
    resetChat()
  }
  const removeOneVehicle = (id: string) => {
    updateGarage(removeVehicle(garageRef.current, id))
    if (id === garageRef.current.activeId) resetChat()
  }

  const statePanel = (
    <StatePanel
      garage={garage}
      onSwitchVehicle={switchVehicle}
      onAddVehicle={addNewVehicle}
      onRemoveVehicle={removeOneVehicle}
      state={state}
      onPickGap={pickGap}
      onOpenServices={() => setModal({})}
      onEditVehicle={() => setVehicleOpen(true)}
      onEditOdometer={() => setDrivingOpen(true)}
    />
  )

  // 서버가 알려 준 날짜가 오늘(한국 시간)이 아니면 이미 초기화된 것으로 본다
  const kstToday = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
  const usedToday = usage && usage.day === kstToday ? usage.used : 0
  const locked = !!usage && usedToday >= usage.limit

  // 새로고침 직후 계정 데이터를 불러오는 동안에는 빈 차량이 깜빡이지 않도록 잠깐 로딩 화면을 보여 준다.
  const booting = hasSessionHint() && !(authReady && (!user || syncReady || syncFailed))
  if (booting) {
    return (
      <div className="boot">
        <img src="/favicon.svg" alt="" width={44} height={44} />
        <b>내차일기</b>
        <span>내 차 정보를 불러오는 중…</span>
      </div>
    )
  }

  const lastAssistant = msgs.map((m) => m.role).lastIndexOf('assistant')
  const hasInfo = state.vehicle.make || state.vehicle.model || state.odometer.km != null

  return (
    <div className="shell">
    {!isMobile && sidebarOpen && <Sidebar state={state} onPickExample={fillDraft} onClose={() => toggleSidebar(false)} />}
    <div className={`app ${tabNow !== 'chat' ? 'page' : chatting ? 'chatting' : ''}`}>
      <header className="top">
        {!isMobile && !sidebarOpen && (
          <button className="top-open" onClick={() => toggleSidebar(true)} aria-label="사이드바 열기" title="소개 열기">
            ?
          </button>
        )}
        <a
          className="logo"
          href="/"
          title="홈으로"
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return // 새 탭 열기 등은 기본 동작 유지
            e.preventDefault()
            goTab('chat')
          }}
        >
          내차일기
        </a>
        {!isMobile && (
        <nav className="tabs" aria-label="주요 메뉴">
          {TABS.map((t) => (
            <button key={t.id} className={`tab ${tab === t.id ? 'on' : ''}`} onClick={() => goTab(t.id)} aria-current={tab === t.id ? 'page' : undefined}>
              {t.label}
            </button>
          ))}
        </nav>
        )}
        {isMobile && tabNow !== 'state' && (
          <VehicleSwitcher compact garage={garage} onSwitch={switchVehicle} onAdd={addNewVehicle} onRemove={removeOneVehicle} />
        )}
        {isMobile && tabNow === 'state' && <span className="m-spacer" />}
        {isMobile && (
          <button className="hamb" onClick={() => setMenuOpen(true)} aria-label="메뉴 열기">
            ☰
          </button>
        )}
        {!isMobile && (
        <div className="top-right">
          {authReady &&
            (user ? (
              <>
                <span className="who" title={user.email}>
                  {user.nickname}님
                </span>
                <button className="btn ghost" onClick={() => setMypageOpen(true)}>
                  마이페이지
                </button>
                <button className="btn ghost" onClick={doLogout}>
                  로그아웃
                </button>
              </>
            ) : (
              <>
                <button className="btn ghost" onClick={() => setAuthModal('login')}>
                  로그인
                </button>
                <button className="btn primary" onClick={() => setAuthModal('signup')}>
                  회원가입
                </button>
              </>
            ))}
        </div>
        )}
      </header>

      {isMobile && tabNow === 'state' && <div className="page-body">{statePanel}</div>}
      {tabNow === 'calendar' && (
        <div className="page-body">
          <CalendarView state={state} />
        </div>
      )}
      {tabNow === 'shops' && (
        <div className="page-body">
          <ShopsMap />
        </div>
      )}

      {tabNow === 'chat' && (
      <>
      <div className="hero">
        <section className="stage">
          <CarViewer
            type={state.vehicle.bodyType}
            state={state}
            onOpenServices={(key) => setModal({ editKey: key })}
          />
        </section>
        {!hasInfo && (
          <p className="hint-line">어떤 차를 타고 계세요? 차종과 현재 주행거리를 말씀해 주세요. 예) 2021년식 쏘렌토, 4만 2천km</p>
        )}
      </div>

      {chatting && (
        <section className="messages">
          {msgs.map((m, i) => (
            <div key={i} className={`msg ${m.role}`}>
              {m.content}
              {m.changes && m.changes.length > 0 && (
                <ul className="changes">
                  {m.changes.map((c, k) => (
                    <li key={k}>{c}</li>
                  ))}
                </ul>
              )}
              {m.actions?.map(
                (a, k) =>
                  a.type === 'export_excel' && (
                    <div key={k} className="chat-action-row">
                      <ExportButton
                        garage={a.scope === 'current' ? { activeId: active.id, vehicles: [active] } : garage}
                        className="btn primary chat-action"
                        label={a.scope === 'current' ? '📊 엑셀 파일 받기 (이 차량)' : '📊 엑셀 파일 받기 (전체 차량)'}
                      />
                    </div>
                  ),
              )}
              {m.before && i === lastAssistant && !pending && (
                <button className="undo" onClick={() => undo(i)}>
                  되돌리기
                </button>
              )}
            </div>
          ))}
          {pending && <div className="msg assistant typing">···</div>}
          <div ref={endRef} />
        </section>
      )}

      <footer className="bottom">
        <ChatBox onSend={send} disabled={pending} draft={draft} locked={locked} />
        {usage && locked && (
          <p className="usage-line full">
            오늘 대화 한도를 모두 사용했어요
            {!usage.loggedIn && (
              <>
                {' · '}
                <button className="link" onClick={() => setAuthModal('login')}>
                  로그인하면 더 사용할 수 있어요
                </button>
              </>
            )}
          </p>
        )}
      </footer>
      </>
      )}
    </div>
    {!isMobile && statePanel}
    {isMobile && menuOpen && (
      <MobileMenu
        state={state}
        user={user}
        authReady={authReady}
        garage={garage}
        onSwitchVehicle={(id) => {
          switchVehicle(id)
          setMenuOpen(false)
          goTab('chat')
        }}
        onAddVehicle={() => {
          addNewVehicle()
          setMenuOpen(false)
          goTab('chat')
        }}
        onRemoveVehicle={removeOneVehicle}
        onPickExample={(t) => {
          fillDraft(t)
          setMenuOpen(false)
          goTab('chat')
        }}
        onClose={() => setMenuOpen(false)}
        onLogin={() => setAuthModal('login')}
        onSignup={() => setAuthModal('signup')}
        onLogout={doLogout}
        onHistory={() => setHistoryOpen(true)}
        onPassword={() => setPasswordOpen(true)}
      />
    )}
    {isMobile && <MobileTabs tab={tabNow} onChange={goTab} />}
    {mypageOpen && user && (
      <MyPageModal
        user={user}
        vehicleCount={garage.vehicles.length}
        onClose={() => setMypageOpen(false)}
        onPassword={() => setPasswordOpen(true)}
        onHistory={() => setHistoryOpen(true)}
        onLogout={() => {
          setMypageOpen(false)
          doLogout()
        }}
      />
    )}
    {historyOpen && (
      <HistoryModal
        onClose={() => setHistoryOpen(false)}
        onRestored={(restored) => {
          updateGarage(normalizeGarage(restored))
          resetChat()
        }}
      />
    )}
    {passwordOpen && <PasswordModal onClose={() => setPasswordOpen(false)} />}
    {authModal && (
      <AuthModal
        initialMode={authModal}
        onClose={() => setAuthModal(null)}
        onDone={(u) => {
          setUser(u)
          setAuthModal(null)
        }}
      />
    )}
    {drivingOpen && <DrivingModal state={state} onClose={() => setDrivingOpen(false)} onSave={saveDriving} />}
    {vehicleOpen && (
      <VehicleModal state={state} onClose={() => setVehicleOpen(false)} onSave={saveVehicle} />
    )}
    {modal && (
      <ServiceModal
        state={state}
        initialEditKey={modal.editKey}
        onClose={() => setModal(null)}
        onSave={saveService}
      />
    )}
    </div>
  )
}
