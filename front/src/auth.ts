import type { Garage } from './api'

export type User = { id: number; email: string; nickname: string; provider: string }

async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const j = await res.json()
    if (j?.message) return j.message
  } catch {
    /* 본문이 JSON이 아니면 기본 문구 */
  }
  return fallback
}

const json = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

/** 로그인 상태면 사용자, 아니면 null */
export async function getMe(): Promise<User | null> {
  const res = await fetch('/api/v1/auth/me')
  if (res.status === 401) return null
  if (!res.ok) throw new Error('me failed')
  return res.json()
}

export async function signup(email: string, password: string, nickname: string): Promise<User> {
  const res = await fetch('/api/v1/auth/signup', json({ email, password, nickname }))
  if (!res.ok) throw new Error(await errorMessage(res, '회원가입에 실패했어요.'))
  return res.json()
}

export async function login(email: string, password: string): Promise<User> {
  const res = await fetch('/api/v1/auth/login', json({ email, password }))
  if (!res.ok) throw new Error(await errorMessage(res, '로그인에 실패했어요.'))
  return res.json()
}

/** 비밀번호 변경. 이 기기는 로그인이 유지되고, 다른 기기의 로그인은 풀린다. */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const res = await fetch('/api/v1/auth/password', json({ currentPassword, newPassword }))
  if (!res.ok) throw new Error(await errorMessage(res, '비밀번호를 바꾸지 못했어요.'))
}

export async function logout(): Promise<void> {
  await fetch('/api/v1/auth/logout', { method: 'POST' })
}

/** 계정에 저장된 차고. 없으면 null */
export async function getServerState(): Promise<Garage | null> {
  const res = await fetch('/api/v1/me/state')
  if (res.status === 404) return null
  if (!res.ok) throw new Error('state load failed')
  return res.json()
}

export type SaveResult = { version: number; changed: boolean }
export type VersionInfo = { version: number; summary: string | null; createdAt: string }

/** 계정에 저장. 내용이 직전 버전과 같으면 새 버전이 만들어지지 않는다(changed=false). */
export async function putServerState(garage: Garage, keepalive = false): Promise<SaveResult> {
  const res = await fetch('/api/v1/me/state', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(garage),
    keepalive, // 탭을 닫거나 이동하는 중에도 요청이 끝까지 가도록
  })
  if (!res.ok) throw new Error('state save failed')
  return res.json()
}

/** 저장된 버전 이력(최신순) */
export async function listVersions(limit = 50): Promise<VersionInfo[]> {
  const res = await fetch(`/api/v1/me/state/versions?limit=${limit}`)
  if (!res.ok) throw new Error('versions failed')
  return res.json()
}

/** 지난 버전으로 되돌린다. 이력은 지워지지 않고 새 버전으로 쌓인다. */
export async function restoreVersion(version: number): Promise<{ version: number; state: Garage }> {
  const res = await fetch(`/api/v1/me/state/versions/${version}/restore`, { method: 'POST' })
  if (!res.ok) throw new Error(await errorMessage(res, '복원에 실패했어요.'))
  return res.json()
}
