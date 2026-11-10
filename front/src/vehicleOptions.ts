// 차급(차체 유형). 서버(BodyType.java)의 값과 같아야 한다.
// 3D 모델은 4종(세단, SUV, 고급 SUV, 밴)이라 차급마다 가까운 모델을 고르고, 실제 차량 길이에 맞춰 크기를 조절한다.
export type CarType =
  | 'compact'
  | 'small'
  | 'semimid'
  | 'sedan'
  | 'semilarge'
  | 'large'
  | 'suv_small'
  | 'suv_semimid'
  | 'suv'
  | 'suv_large'
  | 'minivan'
  | 'sports'
  | 'pickup'
  | 'truck'

export type ModelFile = 'sedan' | 'suv' | 'suv-luxury' | 'van' | 'sedan-sports' | 'truck' | 'truck-flat'

export type BodyMeta = {
  id: CarType
  label: string
  /** 사용할 3D 모델 파일 */
  model: ModelFile
  /** 화면에 그릴 전장(m) */
  length: number
}

export const BODY_GROUPS: { label: string; items: BodyMeta[] }[] = [
  {
    label: '승용',
    items: [
      { id: 'compact', label: '경형', model: 'sedan', length: 3.6 },
      { id: 'small', label: '소형', model: 'sedan', length: 4.1 },
      { id: 'semimid', label: '준중형', model: 'sedan', length: 4.6 },
      { id: 'sedan', label: '중형', model: 'sedan', length: 4.9 },
      { id: 'semilarge', label: '준대형', model: 'sedan', length: 5.0 },
      { id: 'large', label: '대형', model: 'sedan', length: 5.2 },
    ],
  },
  {
    label: 'SUV',
    items: [
      { id: 'suv_small', label: '소형 SUV', model: 'suv', length: 4.2 },
      { id: 'suv_semimid', label: '준중형 SUV', model: 'suv', length: 4.55 },
      { id: 'suv', label: '중형 SUV', model: 'suv', length: 4.8 },
      { id: 'suv_large', label: '대형 SUV', model: 'suv-luxury', length: 5.0 },
    ],
  },
  { label: '승합', items: [{ id: 'minivan', label: '승합차', model: 'van', length: 5.1 }] },
  {
    label: '스포츠·화물',
    items: [
      { id: 'sports', label: '스포츠카', model: 'sedan-sports', length: 4.7 },
      { id: 'pickup', label: '픽업', model: 'truck', length: 5.3 },
      { id: 'truck', label: '트럭', model: 'truck-flat', length: 5.2 },
    ],
  },
]

export const BODY_TYPES: BodyMeta[] = BODY_GROUPS.flatMap((g) => g.items)

/** 알 수 없는 값은 중형(기본)으로 취급 */
export const bodyMeta = (id: string): BodyMeta => BODY_TYPES.find((b) => b.id === id) ?? BODY_TYPES.find((b) => b.id === 'sedan')!
export const bodyLabel = (id: string) => BODY_TYPES.find((b) => b.id === id)?.label ?? id

// 가솔린 = 휘발유, 디젤 = 경유. 같은 연료라 하나로 묶어 표기한다.
export const FUEL_TYPES: { id: string; label: string }[] = [
  { id: 'gasoline', label: '가솔린(휘발유)' },
  { id: 'diesel', label: '디젤(경유)' },
  { id: 'lpg', label: 'LPG' },
  { id: 'hybrid', label: '하이브리드' },
  { id: 'electric', label: '전기' },
]

export const fuelLabel = (id: string) => FUEL_TYPES.find((f) => f.id === id)?.label ?? id
