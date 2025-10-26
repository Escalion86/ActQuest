import fetchTeamsForCabinet from '@helpers/fetchTeamsForCabinet'
import dbConnect from '@utils/dbConnect'

const collectTeamIds = (query) => {
  const rawIds = []
  const appendValue = (value) => {
    if (!value) {
      return
    }

    if (Array.isArray(value)) {
      value.forEach((item) => appendValue(item))
      return
    }

    if (typeof value === 'string') {
      value
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0 && item !== 'undefined' && item !== 'null')
        .forEach((item) => rawIds.push(item))
    }
  }

  appendValue(query.teamIds)
  appendValue(query.teamId)

  return Array.from(new Set(rawIds))
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res
      .status(405)
      .json({ success: false, error: 'Метод не поддерживается' })
  }

  const { location } = req.query

  if (!location || typeof location !== 'string') {
    return res
      .status(400)
      .json({ success: false, error: 'Не передана площадка' })
  }

  const teamIds = collectTeamIds(req.query)

  if (teamIds.length === 0) {
    return res
      .status(400)
      .json({ success: false, error: 'Не переданы идентификаторы команд' })
  }

  try {
    const db = await dbConnect(location)

    if (!db) {
      throw new Error('Соединение с базой данных не установлено')
    }

    const teams = await fetchTeamsForCabinet({ db, teamIds })

    return res.status(200).json({ success: true, data: teams })
  } catch (error) {
    console.error('Failed to load cabinet teams via API', error)
    return res
      .status(500)
      .json({ success: false, error: 'Не удалось загрузить команды' })
  }
}
