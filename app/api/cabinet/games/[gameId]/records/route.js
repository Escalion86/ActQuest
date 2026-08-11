import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import buildStoryRecords from '@server/buildStoryRecords'
import { canManageGame } from '@server/gameHistory/gameManageAccess'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import { toStringId } from '@helpers/idAndDate'

const isObjectIdLike = (value) => /^[0-9a-fA-F]{24}$/.test(value)

const findGame = async (Games, rawGameId) => {
  const gameId = toStringId(rawGameId)
  if (!gameId) return null
  if (isObjectIdLike(gameId)) {
    const byId = await Games.findById(gameId).lean()
    if (byId?._id) return byId
  }
  return Games.findOne({ id: gameId }).lean()
}

const hasParticipantAccess = async ({ db, session, teamIds }) => {
  const user = session?.user || {}
  const userId = toStringId(
    user.globalUserId ?? user.userId ?? user._id ?? user.id,
  )
  const telegramId =
    user.telegramId === null || user.telegramId === undefined
      ? ''
      : String(user.telegramId).trim()
  const identityFilters = []
  if (userId) identityFilters.push({ userId })
  if (telegramId) identityFilters.push({ userTelegramId: telegramId })
  if (identityFilters.length === 0 || teamIds.length === 0) return false

  const membership = await db.model('TeamsUsers').findOne({
    teamId: { $in: teamIds },
    $or: identityFilters,
  })
    .select({ _id: 1 })
    .lean()
  return Boolean(membership?._id)
}

export async function GET(_request, { params }) {
  const session = await getServerSession(authOptions)
  const resolvedParams = await params
  const rawGameId = toStringId(resolvedParams?.gameId)
  if (!rawGameId) {
    return NextResponse.json(
      { success: false, error: 'Не передан идентификатор игры' },
      { status: 400 },
    )
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) throw new Error('Соединение с базой данных не установлено')

    const game = await findGame(db.model('Games'), rawGameId)
    if (!game?._id || game?.type !== 'story') {
      return NextResponse.json(
        { success: false, error: 'Story-квест не найден' },
        { status: 404 },
      )
    }

    const gameId = toStringId(game._id)
    const gameTeams = await db.model('GamesTeams').find({ gameId })
      .select({ teamId: 1, outOfCompetition: 1, storyProgress: 1 })
      .lean()
    const teamIds = Array.from(
      new Set(gameTeams.map((entry) => toStringId(entry?.teamId)).filter(Boolean)),
    )
    const canManage = Boolean(
      session?.user && canManageGame({ session, game }),
    )
    const visibility = ['participants', 'public'].includes(
      game?.recordsVisibility,
    )
      ? game.recordsVisibility
      : 'disabled'
    const isParticipant =
      visibility === 'participants'
        ? await hasParticipantAccess({ db, session, teamIds })
        : false

    if (
      !canManage &&
      visibility !== 'public' &&
      !(visibility === 'participants' && isParticipant)
    ) {
      return NextResponse.json(
        { success: false, error: 'Статистика рекордов недоступна' },
        { status: session?.user ? 403 : 401 },
      )
    }

    const teams = teamIds.length
      ? await db.model('Teams').find({ _id: { $in: teamIds } })
          .select({ _id: 1, name: 1 })
          .lean()
      : []
    const records = buildStoryRecords({
      game,
      gameTeams,
      teams,
      showNames: canManage || game?.recordsShowNames !== false,
    })

    return NextResponse.json({ success: true, data: records })
  } catch (error) {
    console.error('Failed to build story records', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось получить статистику рекордов' },
      { status: 500 },
    )
  }
}
