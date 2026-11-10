/** 근처 정비소: 네이버 지도 API 연동 전까지의 준비 중 화면 */
export default function ShopsPlaceholder() {
  return (
    <div className="shops-ph">
      <div className="ph-icon" aria-hidden>
        📍
      </div>
      <h2>근처 정비소</h2>
      <p>지도와 연결해서 내 주변 정비소를 찾아드릴 예정이에요.</p>
      <span className="ph-badge">준비 중</span>
    </div>
  )
}
