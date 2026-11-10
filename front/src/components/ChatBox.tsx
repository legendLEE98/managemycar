import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'

export type Draft = { text: string; n: number }
type Props = { onSend: (text: string) => void; disabled?: boolean; draft?: Draft | null; locked?: boolean }

export default function ChatBox({ onSend, disabled, draft, locked }: Props) {
  const [text, setText] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)

  // 외부(데이터 보강 칩)에서 예시 문장을 채워 줄 때
  useEffect(() => {
    if (!draft) return
    setText(draft.text)
    ref.current?.focus()
  }, [draft])

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    const v = text.trim()
    if (!v || disabled || locked) return
    onSend(v)
    setText('')
  }

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <form className="chatbox" onSubmit={submit}>
      <textarea
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKey}
        placeholder={locked ? '오늘 대화 횟수를 모두 사용했어요' : '오늘의 주행은 어땠나요?'}
        disabled={locked}
        rows={1}
      />
      <button type="submit" disabled={!text.trim() || disabled || locked} aria-label="보내기">
        ↑
      </button>
    </form>
  )
}
