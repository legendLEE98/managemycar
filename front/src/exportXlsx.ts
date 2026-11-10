import type { CarState, Garage } from './api'
import { buildEvents } from './calendar'
import { efficiency, serviceRemaining, serviceViews, type ServiceView } from './derive'
import { PART_INFO } from './services'
import { hasData, vehicleName } from './storage'
import { bodyLabel, fuelLabel } from './vehicleOptions'

type Col = { header: string; key: string; width?: number; fmt?: string }
type Row = Record<string, string | number | Date | null>

const BRAND = 'FF7B716F' // 퍼스널 컬러 #7B716F
const KIND: Record<string, string> = { fuel: '주유', trip: '주행', service: '교체', odometer: '주행거리', vehicle: '차량 정보', commute: '출퇴근', interval: '교체 주기' }
const EVENT_KIND: Record<string, string> = { done: '교체 완료', due: '교체 예정', overdue: '시기 지남', log: '기록' }

const PART_OF: Record<string, string> = Object.fromEntries(
  Object.values(PART_INFO).flatMap((p) => p.keys.map((k) => [k, p.label])),
)

/**
 * 'YYYY-MM-DD'를 엑셀 날짜로 쓸 수 있는 Date로. 엑셀은 날짜를 UTC 기준 숫자로 저장하므로 UTC 자정으로 만든다.
 * (현지 자정으로 만들면 한국 시간에서 하루 전 날짜로 보인다.) 값이 없거나 형식이 다르면 null
 */
function toDate(s: string | null | undefined): Date | null {
  if (!s) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : null
}

function statusOf(v: ServiceView): string {
  if (v.state === 'unknown') return '데이터 부족(이력 없음)'
  if (v.state === 'partial') return '데이터 부족(일부)'
  return v.level === 'over' ? '초과' : v.level === 'soon' ? '임박' : '정상'
}

/** 화면과 같은 기준으로 4개 시트의 행을 만든다. 차량이 여러 대여도 시트는 4개이고 "차량" 열로 구분한다. */
export function buildSheets(garage: Garage) {
  const info: Row[] = []
  const services: Row[] = []
  const logs: Row[] = []
  const schedule: Row[] = []

  garage.vehicles.forEach((entry, i) => {
    const s: CarState = entry.state
    const name = vehicleName(s, i)
    const eff = efficiency(s)
    info.push({
      vehicle: name,
      make: s.vehicle.make,
      model: s.vehicle.model,
      body: bodyLabel(s.vehicle.bodyType),
      year: s.vehicle.modelYear,
      fuel: s.vehicle.fuelType ? fuelLabel(s.vehicle.fuelType) : null,
      verified: s.vehicle.model ? (s.vehicle.verified === false ? '미확인 차종' : '확인됨') : null,
      odo: s.odometer.km,
      odoKind: s.odometer.km != null ? (s.odometer.source === 'reported' ? '실측(계기판)' : '추정') : null,
      odoDate: toDate(s.odometer.updatedAt),
      commute: s.commute.kmPerDay === 0 ? '출퇴근 안 함' : s.commute.kmPerDay,
      liters: s.fuel.totalLiters > 0 ? Math.round(s.fuel.totalLiters * 10) / 10 : null,
      cost: s.fuel.totalCost > 0 ? s.fuel.totalCost : null,
      eff: eff != null ? Math.round(eff * 10) / 10 : null,
    })

    // 아직 아무것도 입력하지 않은 빈 차량은 차량 정보 한 줄만 남기고, 소모품·기록·일정 행은 만들지 않는다.
    if (!hasData(s)) return

    for (const v of serviceViews(s)) {
      const r = serviceRemaining(s, v)
      services.push({
        vehicle: name,
        part: PART_OF[v.key] ?? '',
        item: v.label,
        lastDate: toDate(v.lastDate),
        lastKm: v.lastKm,
        intervalKm: v.intervalKm,
        intervalMonths: v.intervalMonths,
        remKm: r.km,
        remDays: r.days,
        status: statusOf(v),
      })
    }

    // 최근 기록은 최신이 위로
    ;[...s.recent].reverse().forEach((e) =>
      logs.push({ vehicle: name, date: toDate(e.at), kind: KIND[e.type ?? ''] ?? e.type ?? '', text: e.summary }),
    )

    buildEvents(s)
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .forEach((e) =>
        schedule.push({ vehicle: name, date: toDate(e.date), kind: EVENT_KIND[e.kind], text: e.title, detail: e.detail ?? null }),
      )
  })

  const DATE = 'yyyy-mm-dd'
  const NUM = '#,##0'
  return [
    {
      name: '차량 정보',
      cols: [
        { header: '차량', key: 'vehicle', width: 18 },
        { header: '제조사', key: 'make' },
        { header: '차종', key: 'model', width: 16 },
        { header: '차급', key: 'body' },
        { header: '연식', key: 'year', fmt: '0' },
        { header: '연료', key: 'fuel' },
        { header: '차종 확인', key: 'verified' },
        { header: '주행거리(km)', key: 'odo', fmt: NUM },
        { header: '주행거리 구분', key: 'odoKind' },
        { header: '주행거리 갱신일', key: 'odoDate', fmt: DATE },
        { header: '하루 출퇴근(km)', key: 'commute', fmt: NUM },
        { header: '누적 주유량(L)', key: 'liters', fmt: '#,##0.0' },
        { header: '누적 주유 금액(원)', key: 'cost', fmt: NUM },
        { header: '평균 연비(km/L)', key: 'eff', fmt: '0.0' },
      ] as Col[],
      rows: info,
    },
    {
      name: '소모품 현황',
      cols: [
        { header: '차량', key: 'vehicle', width: 18 },
        { header: '구분', key: 'part' },
        { header: '항목', key: 'item', width: 20 },
        { header: '마지막 교체일', key: 'lastDate', fmt: DATE },
        { header: '교체 당시 주행거리(km)', key: 'lastKm', fmt: NUM },
        { header: '교체 주기(km)', key: 'intervalKm', fmt: NUM },
        { header: '교체 주기(개월)', key: 'intervalMonths', fmt: '0' },
        { header: '남은 거리(km)', key: 'remKm', fmt: '#,##0;[Red]-#,##0' },
        { header: '남은 일수', key: 'remDays', fmt: '#,##0;[Red]-#,##0' },
        { header: '상태', key: 'status', width: 22 },
      ] as Col[],
      rows: services,
    },
    {
      name: '최근 기록',
      cols: [
        { header: '차량', key: 'vehicle', width: 18 },
        { header: '날짜', key: 'date', fmt: DATE },
        { header: '종류', key: 'kind' },
        { header: '내용', key: 'text', width: 48 },
      ] as Col[],
      rows: logs,
    },
    {
      name: '일정',
      cols: [
        { header: '차량', key: 'vehicle', width: 18 },
        { header: '날짜', key: 'date', fmt: DATE },
        { header: '구분', key: 'kind' },
        { header: '내용', key: 'text', width: 30 },
        { header: '비고', key: 'detail', width: 20 },
      ] as Col[],
      rows: schedule,
    },
  ]
}

/** 글자 수 기준 열 너비. 한글처럼 넓은 글자는 2로 센다. */
function visualLength(v: unknown): number {
  if (v == null) return 0
  if (v instanceof Date) return 10
  return [...String(v)].reduce((n, ch) => n + (ch.charCodeAt(0) > 255 ? 2 : 1), 0)
}

export async function buildWorkbook(garage: Garage) {
  const mod = await import('exceljs') // 버튼을 눌렀을 때만 불러온다(처음 화면은 가볍게)
  const ExcelJS = (mod as { default?: typeof import('exceljs') }).default ?? mod
  const wb = new ExcelJS.Workbook()
  wb.creator = '내차일기'
  wb.created = new Date()

  for (const sheet of buildSheets(garage)) {
    const ws = wb.addWorksheet(sheet.name, { views: [{ state: 'frozen', ySplit: 1 }] })
    ws.columns = sheet.cols.map((c) => ({
      header: c.header,
      key: c.key,
      width: Math.min(
        50,
        Math.max(c.width ?? 8, visualLength(c.header) + 3, ...sheet.rows.map((r) => visualLength(r[c.key]) + 2)),
      ),
      style: c.fmt ? { numFmt: c.fmt } : undefined,
    }))
    sheet.rows.forEach((r) => ws.addRow(r))

    const head = ws.getRow(1)
    head.height = 22
    head.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } }
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
    })
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.cols.length } }

    // 상태 칸 색: 초과 빨강, 임박 주황, 데이터 부족 회색
    const statusCol = sheet.cols.findIndex((c) => c.key === 'status') + 1
    if (statusCol > 0) {
      ws.eachRow((row, n) => {
        if (n === 1) return
        const cell = row.getCell(statusCol)
        const v = String(cell.value ?? '')
        if (v === '초과') cell.font = { bold: true, color: { argb: 'FFC0392B' } }
        else if (v === '임박') cell.font = { bold: true, color: { argb: 'FF9A6400' } }
        else if (v.startsWith('데이터 부족')) cell.font = { color: { argb: 'FF8F8684' } }
      })
    }
  }
  return wb
}

/** KST 기준 오늘 날짜(YYYY-MM-DD) */
const kstToday = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })

/** 내 차고(등록한 전체 차량)를 엑셀(.xlsx)로 만들어 내려받는다. 서버를 거치지 않고 브라우저에서 만든다. */
export async function downloadGarageXlsx(garage: Garage): Promise<void> {
  const wb = await buildWorkbook(garage)
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `내차일기_${kstToday()}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
