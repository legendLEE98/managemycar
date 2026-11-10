import { useEffect, useState } from 'react'

/** CSS 미디어 쿼리가 맞는지 실시간으로 알려 준다. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setMatches(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return matches
}

/** 이 너비보다 좁으면 모바일 화면(하단 탭 + 메뉴 페이지)을 쓴다. styles.css의 @media와 같은 값이어야 한다. */
export const MOBILE_QUERY = '(max-width: 1179px)'
