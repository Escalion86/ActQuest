import { LOCATIONS } from '@server/serverConstants'
import { getSiteAccessControlsByLocation } from '@helpers/siteAccessControls'

const normalizeLocation = (value) => {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim().toLowerCase()
  if (!trimmed || !LOCATIONS[trimmed] || LOCATIONS[trimmed]?.hidden) {
    return null
  }

  return trimmed
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ success: false, error: 'Метод не поддерживается' })
  }

  try {
    const location = normalizeLocation(req.query?.location)
    const controls = await getSiteAccessControlsByLocation(location)

    return res.status(200).json({
      success: true,
      data: controls,
    })
  } catch (error) {
    console.error('Failed to load public site access controls', error)
    return res.status(500).json({
      success: false,
      error: 'Не удалось загрузить настройки доступа сайта.',
    })
  }
}
