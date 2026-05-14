import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import { toStringId } from '@helpers/idAndDate'

const normalizeStringId = (value) => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value?.toString === 'function') {
    const nextValue = value.toString()
    return nextValue === '[object Object]' ? '' : nextValue.trim()
  }
  return ''
}

const resolveSessionUserId = (sessionUser) =>
  normalizeStringId(
    sessionUser?.globalUserId ??
      sessionUser?.userId ??
      sessionUser?._id ??
      sessionUser?.id,
  )

export async function GET() {
  const session = await getServerSession(authOptions)
  const userId = resolveSessionUserId(session?.user)
  const role =
    typeof session?.user?.role === 'string'
      ? session.user.role.trim().toLowerCase()
      : ''

  if (!session?.user || !userId) {
    return NextResponse.json(
      { success: false, error: 'Необходима авторизация' },
      { status: 401 },
    )
  }

  if (!['agent', 'moder', 'admin', 'dev'].includes(role)) {
    return NextResponse.json(
      { success: false, error: 'Недостаточно прав' },
      { status: 403 },
    )
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      throw new Error('Не удалось подключиться к базе данных')
    }

    const Games = db.model('Games')
    const GamesTeams = db.model('GamesTeams')
    const query =
      role === 'admin' || role === 'dev'
        ? { agents: { $exists: true, $ne: [] } }
        : { 'agents.userId': userId }

    const games = await Games.find(query)
      .sort({ dateStart: -1, createdAt: -1 })
      .limit(100)
      .select({
        _id: 1,
        name: 1,
        status: 1,
        location: 1,
        dateStart: 1,
        type: 1,
        tasks: 1,
        storyNodes: 1,
      })
      .lean()

    const gameIds = games.map((game) => toStringId(game?._id)).filter(Boolean)
    const teamsCounts = {}
    if (gameIds.length > 0) {
      const gameTeams = await GamesTeams.find({ gameId: { $in: gameIds } })
        .select({ gameId: 1 })
        .lean()
      gameTeams.forEach((entry) => {
        const gameId = toStringId(entry?.gameId)
        if (gameId) {
          teamsCounts[gameId] = (teamsCounts[gameId] || 0) + 1
        }
      })
    }

    const data = games.map((game) => {
      const tasks = Array.isArray(game?.tasks) ? game.tasks : []
      const isStoryGame =
        game?.type === 'story' ||
        (Array.isArray(game?.storyNodes) && game.storyNodes.length > 0)
      const assignedTasks = (isStoryGame
        ? Array.isArray(game?.storyNodes)
          ? game.storyNodes
          : []
        : tasks
      )
        .map((task, taskIndex) => {
          const agentIds = Array.isArray(task?.agentUserIds)
            ? task.agentUserIds.map(String)
            : []
          if (
            role !== 'admin' &&
            role !== 'dev' &&
            !agentIds.includes(userId)
          ) {
            return null
          }
          if (agentIds.length === 0) return null
          return isStoryGame
            ? { storyNodeId: task?.id || '', title: task?.title || '' }
            : { taskIndex, title: task?.title || '' }
        })
        .filter(Boolean)

      const gameId = toStringId(game?._id)
      return {
        id: gameId,
        name: game?.name || '',
        status: game?.status || 'active',
        location: game?.location || '',
        dateStart: game?.dateStart || null,
        type: isStoryGame ? 'story' : game?.type || '',
        assignedTasks,
        teamsCount: teamsCounts[gameId] || 0,
      }
    })

    return NextResponse.json({ success: true, data }, { status: 200 })
  } catch (error) {
    console.error('Failed to load agent games', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось загрузить игры агента' },
      { status: 500 },
    )
  }
}
