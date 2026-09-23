export function dicebearAvatar(seed: string): string {
  const normalizedSeed = seed.trim() || 'kilax-user'
  return `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(normalizedSeed)}&backgroundColor=0d1117`
}

export function randomDicebearAvatar(): string {
  const randomPart = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return dicebearAvatar(`kilax-${randomPart}`)
}
