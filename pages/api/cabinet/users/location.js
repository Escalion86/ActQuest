import { getServerSession } from 'next-auth/next'
import { authOptions } from '@pages/api/auth/[...nextauth]'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import { LOCATIONS } from '@server/serverConstants'

const resolveAllowedLocations = () =>
  Object.entries(LOCATIONS)
    .filter(([, value]) => !value.hidden)
    .map(([key]) => key)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' })
  }

  const session = await getServerSession(req, res, authOptions)
  if (!session?.user) {
    return res.status(401).json({ success: false, error: 'Необходима авторизация' })
  }

  const rawLocation = req.body?.location
  const location = typeof rawLocation === 'string' ? rawLocation.trim() : ''
  const allowedLocations = resolveAllowedLocations()

  if (!location || !allowedLocations.includes(location)) {
    return res.status(400).json({
      success: false,
      error: 'Некорректный город',
      allowedLocations,
    })
  }

  try {
    const globalDb = await dbConnectGlobal()
    if (!globalDb) {
      return res.status(503).json({
        success: false,
        error: 'Глобальная база пользователей недоступна',
      })
    }

    const Users = globalDb.model('Users')
    const globalUserId = session.user.globalUserId || session.user._id || null

    const filter = globalUserId
      ? { _id: globalUserId }
      : session.user.telegramId
        ? { telegramId: Number(session.user.telegramId) }
        : session.user.vkId
          ? { vkId: Number(session.user.vkId) }
          : session.user.phone
            ? { phone: Number(session.user.phone) }
            : null

    if (!filter) {
      return res.status(400).json({
        success: false,
        error: 'Не удалось определить пользователя для обновления города',
      })
    }

    const updatedUser = await Users.findOneAndUpdate(
      filter,
      { $set: { currentLocation: location } },
      { new: true },
    ).lean()

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        error: 'Пользователь не найден в глобальной базе',
      })
    }

    return res.status(200).json({
      success: true,
      location,
      globalUserId: updatedUser?._id ? String(updatedUser._id) : null,
    })
  } catch (error) {
    console.error('Failed to update user location', error)
    return res.status(500).json({
      success: false,
      error: 'Не удалось обновить город пользователя',
    })
  }
}
