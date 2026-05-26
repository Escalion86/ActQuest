import { USER_ROLE_VALUES } from './userRoles'

const ensureRole = (value, fallback = 'client') => {
  const normalized =
    typeof value === 'string' ? value.trim().toLowerCase() : ''

  if (USER_ROLE_VALUES.includes(normalized)) {
    return normalized
  }

  return USER_ROLE_VALUES.includes(fallback) ? fallback : 'client'
}

export default ensureRole
