import { LOCATIONS } from '@server/serverConstants'
import { getSiteAccessControlsByLocation } from '@helpers/siteAccessControls'

const normalizeLocation = (value) => {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (!normalized || !LOCATIONS[normalized] || LOCATIONS[normalized]?.hidden) {
    return null
  }
  return normalized
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      data: {
        error: {
          type: 'METHOD_NOT_ALLOWED',
          message: 'Method not allowed',
        },
      },
    })
  }

  const location = normalizeLocation(req.query?.location)
  if (!location) {
    return res.status(400).json({
      success: false,
      data: {
        error: {
          type: 'VALIDATION_ERROR',
          message: 'Location is invalid',
        },
      },
    })
  }

  try {
    const controls = await getSiteAccessControlsByLocation(location)
    return res.status(200).json({
      success: true,
      data: {
        location,
        allowVkAuth: Boolean(controls.allowSiteAuth && controls.enableVkOneTap),
      },
    })
  } catch (error) {
    console.error('Failed to load vk status', error)
    return res.status(200).json({
      success: true,
      data: {
        location,
        allowVkAuth: false,
        source: 'fallback',
      },
    })
  }
}
