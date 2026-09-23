export const MIN_PASSWORD_LENGTH = 4

export function isValidEmail(value: string): boolean {
  const email = value.trim()
  if (!email || email.length > 254 || /\s/.test(email)) return false
  const parts = email.split('@')
  if (parts.length !== 2) return false
  const [local, domain] = parts
  if (!local || !domain || local.length > 64) return false
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false
  if (domain.startsWith('.') || domain.endsWith('.') || domain.includes('..')) return false
  if (!/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)) return false
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/.test(domain)) return false
  return true
}

export function isValidPassword(value: string): boolean {
  return value.length >= MIN_PASSWORD_LENGTH
}
