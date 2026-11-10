import { useCallback, useEffect, useRef, useState } from 'react'

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    google?: any
    gm_authFailure?: () => void
  }
}

type Shop = {
  id: string
  name: string
  address: string
  rating: number | null
  ratings: number
  lat: number
  lng: number
  url: string | null
  distance: number
}

const DEFAULT_CENTER = { lat: 37.5665, lng: 126.978 } // 서울시청
const RADIUS_M = 3000

let loader: Promise<void> | null = null
function loadMaps(key: string): Promise<void> {
  if (window.google?.maps?.importLibrary) return Promise.resolve()
  if (loader) return loader
  loader = new Promise<void>((resolve, reject) => {
    const cb = '__gmapsReady'
    ;(window as any)[cb] = () => resolve()
    const s = document.createElement('script')
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&language=ko&region=KR&loading=async&callback=${cb}`
    s.async = true
    s.onerror = () => {
      loader = null
      reject(new Error('load'))
    }
    document.head.appendChild(s)
  })
  return loader
}

function meters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
const fmtDist = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10}m` : `${(m / 1000).toFixed(1)}km`)

/** 근처 정비소: 구글 지도 + 장소 검색 */
export default function ShopsMap() {
  const mapEl = useRef<HTMLDivElement>(null)
  const map = useRef<any>(null)
  const libs = useRef<any>(null)
  const markers = useRef<Map<string, any>>(new Map())
  const meMarker = useRef<any>(null)
  const info = useRef<any>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'disabled' | 'error'>('loading')
  const [errMsg, setErrMsg] = useState('')
  const [shops, setShops] = useState<Shop[]>([])
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [moved, setMoved] = useState(false)
  const searchedAt = useRef(false)

  const clearMarkers = () => {
    markers.current.forEach((m) => (m.map = null))
    markers.current.clear()
  }

  const select = useCallback((s: Shop, pan: boolean) => {
    setSelected(s.id)
    const m = markers.current.get(s.id)
    if (pan && map.current) map.current.panTo({ lat: s.lat, lng: s.lng })
    if (m && info.current && map.current) {
      const box = document.createElement('div')
      box.style.cssText = 'font:13px/1.5 sans-serif;color:#2b2625;max-width:220px'
      const b = document.createElement('b')
      b.textContent = s.name
      const p = document.createElement('div')
      p.textContent = s.address
      box.append(b, p)
      info.current.setContent(box)
      info.current.open({ map: map.current, anchor: m })
    }
  }, [])

  const search = useCallback(
    async (center: { lat: number; lng: number }) => {
      if (!libs.current || !map.current) return
      setBusy(true)
      setNote('')
      setMoved(false)
      try {
        const { Place } = libs.current.places
        const { places } = await Place.searchNearby({
          fields: ['id', 'displayName', 'formattedAddress', 'location', 'rating', 'userRatingCount', 'googleMapsURI'],
          locationRestriction: { center, radius: RADIUS_M },
          includedPrimaryTypes: ['car_repair'],
          maxResultCount: 20,
          rankPreference: 'DISTANCE',
          language: 'ko',
          region: 'kr',
        })
        const list: Shop[] = (places || [])
          .filter((p: any) => p.location)
          .map((p: any) => {
            const lat = p.location.lat()
            const lng = p.location.lng()
            return {
              id: p.id,
              name: p.displayName || '이름 없음',
              address: p.formattedAddress || '',
              rating: typeof p.rating === 'number' ? p.rating : null,
              ratings: p.userRatingCount || 0,
              lat,
              lng,
              url: p.googleMapsURI || null,
              distance: meters(center, { lat, lng }),
            }
          })
          .sort((a: Shop, b: Shop) => a.distance - b.distance)
        clearMarkers()
        const { AdvancedMarkerElement, PinElement } = libs.current.marker
        for (const s of list) {
          const pin = new PinElement({ background: '#7B716F', borderColor: '#4a4240', glyphColor: '#ffffff', scale: 0.85 })
          const m = new AdvancedMarkerElement({ map: map.current, position: { lat: s.lat, lng: s.lng }, title: s.name, content: pin.element })
          m.addListener('click', () => select(s, false))
          markers.current.set(s.id, m)
        }
        setShops(list)
        setSelected(null)
        if (list.length === 0) setNote(`반경 ${RADIUS_M / 1000}km 안에서 정비소를 찾지 못했어요. 지도를 옮겨 다시 검색해 보세요.`)
      } catch (e) {
        setNote('정비소를 불러오지 못했어요. 잠시 후 다시 시도해 주세요. (Places API (New)가 켜져 있는지 확인이 필요할 수 있어요)')
        console.warn('places search failed', e)
      } finally {
        setBusy(false)
      }
    },
    [select],
  )

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setNote('이 브라우저는 위치 기능을 지원하지 않아요. 지도를 옮겨 검색해 보세요.')
      return
    }
    setBusy(true)
    setNote('')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        if (map.current) {
          map.current.setCenter(c)
          map.current.setZoom(14)
          if (!meMarker.current && libs.current) {
            const dot = document.createElement('div')
            dot.style.cssText = 'width:16px;height:16px;border-radius:50%;background:#2f7de1;border:3px solid #fff;box-shadow:0 0 0 2px rgba(47,125,225,.35)'
            meMarker.current = new libs.current.marker.AdvancedMarkerElement({ map: map.current, position: c, content: dot, title: '내 위치' })
          } else if (meMarker.current) meMarker.current.position = c
        }
        search(c)
      },
      () => {
        setBusy(false)
        setNote('위치 권한이 없어 서울 시청 주변을 보여드려요. 브라우저 주소창에서 위치를 허용하면 내 주변을 찾을 수 있어요.')
        search(map.current?.getCenter()?.toJSON() ?? DEFAULT_CENTER)
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    )
  }, [search])

  // 지도 초기화
  useEffect(() => {
    let dead = false
    ;(async () => {
      try {
        const r = await fetch('/api/v1/config/maps')
        const cfg = r.ok ? await r.json() : null
        if (!cfg?.enabled) return !dead && setStatus('disabled')
        window.gm_authFailure = () => {
          setErrMsg('구글 지도 키가 이 주소에서 허용되지 않았거나 지도 API가 꺼져 있어요. 키의 도메인 제한과 API 설정을 확인해 주세요.')
          setStatus('error')
        }
        await loadMaps(cfg.key)
        if (dead || !mapEl.current) return
        const g = window.google.maps
        const [mapsLib, places, marker] = await Promise.all([g.importLibrary('maps'), g.importLibrary('places'), g.importLibrary('marker')])
        if (dead || !mapEl.current) return
        libs.current = { maps: mapsLib, places, marker }
        map.current = new mapsLib.Map(mapEl.current, {
          center: DEFAULT_CENTER,
          zoom: 14,
          mapId: 'DEMO_MAP_ID',
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: 'greedy',
          clickableIcons: false,
        })
        info.current = new mapsLib.InfoWindow()
        map.current.addListener('dragend', () => setMoved(true))
        map.current.addListener('zoom_changed', () => searchedAt.current && setMoved(true))
        setStatus('ready')
        searchedAt.current = true
        locate()
      } catch {
        if (!dead) {
          setErrMsg('지도를 불러오지 못했어요. 네트워크를 확인하고 다시 시도해 주세요.')
          setStatus('error')
        }
      }
    })()
    return () => {
      dead = true
      clearMarkers()
      window.gm_authFailure = undefined
    }
  }, [locate])

  if (status === 'disabled') {
    return (
      <div className="shops-ph">
        <div className="ph-icon" aria-hidden>
          📍
        </div>
        <h2>근처 정비소</h2>
        <p>지도 설정이 아직 연결되지 않았어요.</p>
      </div>
    )
  }

  return (
    <div className="shops">
      <div className="shops-map-wrap">
        <div ref={mapEl} className="shops-map" />
        {status === 'loading' && <div className="shops-overlay">지도를 불러오는 중…</div>}
        {status === 'error' && <div className="shops-overlay err">{errMsg}</div>}
        {status === 'ready' && (
          <div className="shops-ctrl">
            <button className="map-btn" onClick={locate} disabled={busy}>
              📍 내 위치에서 찾기
            </button>
            {moved && (
              <button className="map-btn on" onClick={() => search(map.current.getCenter().toJSON())} disabled={busy}>
                이 지역에서 다시 검색
              </button>
            )}
          </div>
        )}
      </div>

      <aside className="shops-list" aria-label="근처 정비소 목록">
        <h2>근처 정비소{shops.length > 0 && <small> {shops.length}곳</small>}</h2>
        {busy && <p className="shops-note">찾는 중…</p>}
        {note && <p className="shops-note">{note}</p>}
        <ul>
          {shops.map((s) => (
            <li key={s.id} className={s.id === selected ? 'on' : ''}>
              <button className="shop-row" onClick={() => select(s, true)}>
                <span className="shop-name">{s.name}</span>
                <span className="shop-meta">
                  {fmtDist(s.distance)}
                  {s.rating != null && ` · ★ ${s.rating.toFixed(1)} (${s.ratings.toLocaleString()})`}
                </span>
                <span className="shop-addr">{s.address}</span>
              </button>
              {s.url && (
                <a className="shop-link" href={s.url} target="_blank" rel="noreferrer">
                  구글 지도에서 보기
                </a>
              )}
            </li>
          ))}
        </ul>
        <p className="shops-foot">검색 결과는 Google 지도 정보예요. 방문 전 영업 여부를 확인해 주세요.</p>
      </aside>
    </div>
  )
}
