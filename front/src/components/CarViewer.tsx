import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls, useCursor, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import type { CarState } from '../api'
import type { Part } from '../services'
import { bodyMeta, type CarType, type ModelFile } from '../vehicleOptions'
import PartPopover from './PartPopover'

// 귀여운 로우폴리 모델(public/models/cute). 자동 회전은 없고, 드래그하면 위아래·좌우로 돌려 볼 수 있다(확대·이동·기울기 없음).
// 파트(본네트·창문·바퀴·차체)를 누르면 관련 소모품이 팝오버로 나온다.
// 차량의 가운데가 회전 중심(원점)이고, 어느 방향으로 돌려도 잘리지 않도록 차 전체를 담는 구(球)가 화면에 들어오게 카메라 거리를 잡는다.
// 모델은 파트(body, hood, glass, wheel-*)가 분리되어 있고 색 이미지는 쓰지 않는다. 파트별로 단색을 칠한다.
const COLORS = {
  body: '#7b716f', // 퍼스널 컬러
  hood: '#7d7370', // 본네트: 차체와 거의 같은 색(구분은 마우스 올릴 때만)
  glass: '#cfe3ea', // 유리: 연한 하늘빛
  wheel: '#4a4240', // 바퀴: 퍼스널 컬러를 어둡게
}
const FOV = 28
const SPHERE_R = 3.0 // 가장 긴 차(전장 5.2m)를 어느 방향으로 돌려도 들어오는 반지름
const VIEW_H = SPHERE_R * 2 * 1.06 // 화면 세로에 보여야 하는 월드 높이(여유 6%)
const CAM_DIST = VIEW_H / (2 * Math.tan((FOV / 2) * (Math.PI / 180)))
const CAM_DIR = new THREE.Vector3(5.4, 2.3, 5.4).normalize() // 처음 보는 방향
const CAM = CAM_DIR.clone().multiplyScalar(CAM_DIST).toArray() as [number, number, number]
const TARGET: [number, number, number] = [0, 0, 0] // 차량 가운데

function useShadowTexture() {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const g = c.getContext('2d')!
    const grad = g.createRadialGradient(64, 64, 6, 64, 64, 62)
    grad.addColorStop(0, 'rgba(60,50,48,0.38)')
    grad.addColorStop(1, 'rgba(60,50,48,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 128, 128)
    return new THREE.CanvasTexture(c)
  }, [])
}

/** 자신이나 부모 노드 이름으로 파트를 구분한다. */
function partOf(obj: THREE.Object3D): Part {
  let n: THREE.Object3D | null = obj
  while (n) {
    if (n.name.startsWith('wheel')) return 'wheel'
    if (n.name === 'glass') return 'glass'
    if (n.name === 'hood') return 'hood'
    n = n.parent
  }
  return 'body'
}

function Car({
  type,
  onGround,
  onPick,
}: {
  type: CarType
  onGround: (y: number) => void
  onPick: (part: Part, clientX: number, clientY: number) => void
}) {
  const [hover, setHover] = useState<Part | null>(null)
  useCursor(hover !== null)
  const { model: file, length } = bodyMeta(type)
  const { scene } = useGLTF(`/models/cute/${file}.glb`)

  const model = useMemo(() => {
    const root = scene.clone(true)
    const mats = {
      body: new THREE.MeshLambertMaterial({ color: COLORS.body, flatShading: true }),
      hood: new THREE.MeshLambertMaterial({ color: COLORS.hood, flatShading: true }),
      glass: new THREE.MeshPhongMaterial({ color: COLORS.glass, flatShading: true, shininess: 90, specular: '#ffffff' }),
      wheel: new THREE.MeshLambertMaterial({ color: COLORS.wheel, flatShading: true }),
    }
    root.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      m.material = mats[partOf(m)]
    })
    const box = new THREE.Box3().setFromObject(root)
    const size = box.getSize(new THREE.Vector3())
    const s = length / Math.max(size.x, size.z) // 긴 쪽을 전장으로 본다
    const center = box.getCenter(new THREE.Vector3())
    root.scale.setScalar(s)
    root.position.set(-center.x * s, -center.y * s, -center.z * s) // 상자 중심이 원점(회전 중심)에 오게
    const wrap = new THREE.Group()
    wrap.add(root)
    return { wrap, groundY: -((box.max.y - box.min.y) * s) / 2, mats }
  }, [scene, length])

  useEffect(() => onGround(model.groundY), [model, onGround])

  // 마우스를 올린 파트를 살짝 밝게
  useEffect(() => {
    for (const [name, mat] of Object.entries(model.mats)) {
      const on = name === hover
      mat.emissive.set(on ? '#ffffff' : '#000000')
      mat.emissiveIntensity = on ? 0.3 : 0
    }
  }, [hover, model])

  return (
    <primitive
      object={model.wrap}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation()
        setHover(partOf(e.object))
      }}
      onPointerOut={() => setHover(null)}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation()
        if (e.delta > 5) return // 드래그로 돌린 뒤 손을 뗀 것은 클릭이 아니다
        onPick(partOf(e.object), e.nativeEvent.clientX, e.nativeEvent.clientY)
      }}
    />
  )
}

/** 차 아래의 은은한 그림자만 남기고 바닥판은 두지 않는다. */
function Shadow({ y }: { y: number }) {
  const shadow = useShadowTexture()
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, y + 0.003, 0]}>
      <circleGeometry args={[2.6, 48]} />
      <meshBasicMaterial map={shadow} transparent depthWrite={false} />
    </mesh>
  )
}

type Props = {
  type: CarType
  state: CarState
  /** 팝오버에서 소모품을 눌렀을 때(key가 있으면 그 항목의 입력 폼을 연다) */
  onOpenServices: (key?: string) => void
}

export default function CarViewer({ type, state, onOpenServices }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const [groundY, setGroundY] = useState(-0.7)
  const [pop, setPop] = useState<{ part: Part; x: number; y: number } | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPop(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const pick = (part: Part, clientX: number, clientY: number) => {
    const r = box.current?.getBoundingClientRect()
    if (!r) return
    setPop({ part, x: clientX - r.left, y: clientY - r.top })
  }

  return (
    <div ref={box} className="viewer">
      <Canvas camera={{ position: CAM, fov: FOV }} dpr={[1, 2]} flat onPointerMissed={() => setPop(null)}>
        <ambientLight intensity={1.1} />
        <hemisphereLight args={['#ffffff', '#d9d3d1', 0.7]} />
        <directionalLight position={[4, 6, 3]} intensity={1.6} />
        <Shadow y={groundY} />
        <Suspense fallback={null}>
          <Car key={type} type={type} onGround={setGroundY} onPick={pick} />
        </Suspense>
        {/* 위아래·좌우 자유 회전. 확대·이동은 막고, 극점에서 멈춰 기울기(roll)가 생기지 않는다. 자동 회전 없음. */}
        <OrbitControls
          target={TARGET}
          enablePan={false}
          enableZoom={false}
          rotateSpeed={0.9}
          enableDamping
          dampingFactor={0.12}
          onStart={() => setPop(null)}
        />
      </Canvas>
      {pop && (
        <PartPopover
          part={pop.part}
          x={pop.x}
          y={pop.y}
          state={state}
          boxWidth={box.current?.clientWidth ?? 600}
          onClose={() => setPop(null)}
          onOpenServices={(key) => {
            setPop(null)
            onOpenServices(key)
          }}
        />
      )}
    </div>
  )
}

;(['sedan', 'suv', 'suv-luxury', 'van', 'sedan-sports', 'truck', 'truck-flat'] as ModelFile[]).forEach((f) => useGLTF.preload(`/models/cute/${f}.glb`))
