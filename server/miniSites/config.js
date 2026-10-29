import path from 'node:path'

const MiB = 1024 * 1024
export const LIMITS = Object.freeze({ archive: 20 * MiB, body: 20 * MiB + 64 * 1024, file: 20 * MiB, unpacked: 100 * MiB, entries: 1000, json: 4096, timeout: 30000 })
export class MiniSiteError extends Error {
  constructor(message, status = 400) { super(message); this.status = status }
}
export const fail = (message, status = 400) => { throw new MiniSiteError(message, status) }
export const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/
const RESERVED = 'www api admin cloud sites mail smtp pop imap ftp sftp ssh ns ns1 ns2 dns localhost static assets cdn auth login cabinet dev test staging beta status support help autodiscover autoconfig webmail mx kronosserver kronosfinal'.split(' ')
export const hasControl = value => [...value].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
export const inside = (parent, child) => child === parent || child.startsWith(parent + path.sep)

export function trustedOrigin() {
  try {
    const url = new URL(process.env.MINI_SITES_APP_ORIGIN || process.env.NEXTAUTH_URL)
    if (url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '/api/auth')) throw Error()
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw Error()
    return url.origin
  } catch { fail('Настройте доверенный NEXTAUTH_URL или MINI_SITES_APP_ORIGIN.', 503) }
}
function positiveSetting(key, fallback) {
  if (!process.env[key]) return fallback
  const number = Number(process.env[key])
  if (!Number.isSafeInteger(number) || number <= 0) fail('Некорректная настройка квоты мини-сайтов.', 503)
  return number
}
export function configuration() {
  const origin = trustedOrigin()
  const domain = process.env.MINI_SITES_BASE_DOMAIN || 'actquest.ru'
  if (domain.length > 189 || !domain.includes('.') || domain.split('.').some(part => !SLUG.test(part)) || /^\d+(\.\d+)+$/.test(domain)) fail('Некорректная публичная зона мини-сайтов.', 503)
  const root = process.env.MINI_SITES_ROOT
  const project = path.resolve(process.cwd())
  if (!root || !path.isAbsolute(root) || path.resolve(root) !== root || root === '/' || inside(project, root) || inside(root, project)) fail('MINI_SITES_ROOT должен указывать на отдельный абсолютный каталог вне проекта.', 503)
  const reserved = new Set([...RESERVED, ...(process.env.MINI_SITES_RESERVED_SLUGS || '').split(',').map(s => s.trim()).filter(Boolean)])
  const main = new URL(origin).hostname
  if (main.endsWith('.' + domain)) {
    const label = main.slice(0, -domain.length - 1)
    if (SLUG.test(label)) reserved.add(label)
  }
  return { root, domain, origin, reserved, quota: positiveSetting('MINI_SITES_QUOTA_BYTES', 500 * MiB), reserve: positiveSetting('MINI_SITES_DISK_RESERVE_BYTES', 200 * MiB) }
}
export function validSlug(slug, config) {
  if (typeof slug !== 'string' || !SLUG.test(slug) || config.reserved.has(slug) || `https://${slug}.${config.domain}` === config.origin) fail('Недопустимый или зарезервированный slug. Используйте строчные латинские буквы, цифры и дефис.')
  return slug
}
