import { getServerSession } from 'next-auth'
import { notFound, redirect } from 'next/navigation'

import GameMapPageClient from '@components/cabinet/app-router/GameMapPageClient'
import isUserAdmin from '@helpers/isUserAdmin'
import { authOptions } from '@server/auth/authOptions'
import dbConnectGlobal from '@utils/dbConnectGlobal'

export const metadata = { title: 'ActQuest — Карта заданий' }
export const dynamic = 'force-dynamic'

const LOCATION_CENTERS = {
  krsk: [56.012083, 92.871295],
  nrsk: [69.408366, 88.080232],
  ekb: [56.839425, 60.611462],
  dev: [56.012083, 92.871295],
}

const hasCoordinateValue = (value) =>
  value !== null && value !== undefined && value !== ''

const isValidLatitude = (value) =>
  hasCoordinateValue(value) &&
  Number.isFinite(Number(value)) &&
  Number(value) >= -90 &&
  Number(value) <= 90

const isValidLongitude = (value) =>
  hasCoordinateValue(value) &&
  Number.isFinite(Number(value)) &&
  Number(value) >= -180 &&
  Number(value) <= 180

export default async function AdminGameMapPage({ params }) {
  const { gameId } = await params
  const callbackUrl = `/cabinet/admin/game-map/${encodeURIComponent(gameId)}`
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect(`/cabinet/login?callbackUrl=${encodeURIComponent(callbackUrl)}`)
  }

  if (!isUserAdmin({ role: session.user.role })) {
    redirect('/cabinet')
  }

  const db = await dbConnectGlobal()
  if (!db) throw new Error('Не удалось подключиться к базе данных')

  let game = null
  try {
    game = await db
      .model('Games')
      .findById(gameId)
      .select({ name: 1, location: 1, tasks: 1, taskDistributionMode: 1 })
      .lean()
  } catch (error) {
    if (error?.name !== 'CastError') throw error
  }

  if (!game) notFound()

  const sourceTasks = Array.isArray(game.tasks) ? game.tasks : []
  const tasks = sourceTasks.flatMap(
    (task, index) => {
      const latitude = task?.coordinates?.latitude
      const longitude = task?.coordinates?.longitude
      if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) return []

      return [
        {
          number: index + 1,
          title:
            typeof task?.title === 'string' && task.title.trim()
              ? task.title.trim()
              : `Задание ${index + 1}`,
          latitude: Number(latitude),
          longitude: Number(longitude),
          radius: Math.max(0, Number(task?.coordinates?.radius) || 0),
        },
      ]
    },
  )

  if (tasks.length === 0) notFound()

  const fallbackCenter = LOCATION_CENTERS[game.location] || LOCATION_CENTERS.krsk
  const center = tasks.length
    ? [
        tasks.reduce((sum, task) => sum + task.latitude, 0) / tasks.length,
        tasks.reduce((sum, task) => sum + task.longitude, 0) / tasks.length,
      ]
    : fallbackCenter

  return (
    <GameMapPageClient
      game={{
        id: String(game._id),
        name: typeof game.name === 'string' ? game.name : 'Без названия',
        taskDistributionMode:
          game.taskDistributionMode === 'random' ? 'random' : 'linear',
        hasAllTaskCoordinates: tasks.length === sourceTasks.length,
        center,
        tasks,
      }}
    />
  )
}
