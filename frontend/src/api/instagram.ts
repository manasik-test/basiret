import api from './client'

export async function fetchInstagramAuthUrl(): Promise<string> {
  const res = await api.get<unknown, { url: string }>('/instagram/auth-url')
  return res.url
}

export async function disconnectInstagramAccount(accountId: string): Promise<void> {
  await api.delete(`/instagram/accounts/${accountId}`)
}
