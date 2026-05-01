import { LOCATIONS } from '@server/serverConstants'

export const DEFAULT_LOCATION_TIME_ZONE = 'Asia/Krasnoyarsk'

export const getLocationTimeZone = (locationKey) => {
  const normalized =
    typeof locationKey === 'string' ? locationKey.trim().toLowerCase() : ''

  const timeZone = normalized ? LOCATIONS?.[normalized]?.timeZone : null
  return typeof timeZone === 'string' && timeZone.trim()
    ? timeZone.trim()
    : DEFAULT_LOCATION_TIME_ZONE
}

export default getLocationTimeZone
