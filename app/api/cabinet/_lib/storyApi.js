import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import {
  buildInitialStoryProgress,
  getActiveStoryInventory,
  getAvailableStoryNodes,
} from '@server/storyEngine'
import { toStringId } from '@helpers/idAndDate'
import dbConnectGlobal from '@utils/dbConnectGlobal'

export const normalizeStringId = (value) => {
  const id = toStringId(value)
  return typeof id === 'string' ? id.trim() : ''
}

const normalizeText = (value) =>
  typeof value === 'string'
    ? value.trim()
    : Number.isFinite(value)
      ? String(value).trim()
      : ''

const normalizeRole = (value) => {
  const normalized = normalizeText(value).toLowerCase()
  return ['client', 'moder', 'admin', 'dev'].includes(normalized)
    ? normalized
    : 'client'
}

const isElevatedRole = (role) => role === 'admin' || role === 'dev'

export const jsonError = (error, status = 400, extra = {}) =>
  NextResponse.json({ success: false, error, ...extra }, { status })

export const readJsonPayload = async (request) => {
  const rawBody = await request.json().catch(() => ({}))
  return rawBody && typeof rawBody === 'object' && rawBody.data
    ? rawBody.data
    : rawBody
}

export const resolveSessionIdentity = (session) => {
  const user = session?.user ?? {}
  const userId = normalizeStringId(
    user.globalUserId ?? user.userId ?? user._id ?? user.id,
  )
  const userTelegramId =
    user.telegramId !== null && user.telegramId !== undefined
      ? String(user.telegramId).trim()
      : ''

  return {
    userId,
    userTelegramId,
    role: normalizeRole(user.role),
  }
}

export const findGameByAnyId = async (Games, gameId, select = null) => {
  const normalizedGameId = normalizeStringId(gameId)
  if (!normalizedGameId) {
    return null
  }

  const query = /^[0-9a-fA-F]{24}$/.test(normalizedGameId)
    ? Games.findById(normalizedGameId)
    : Games.findOne({ id: normalizedGameId })

  return select ? query.select(select) : query
}

export const hasGameManageAccess = ({ identity, game }) => {
  if (!identity || !game) {
    return false
  }

  if (isElevatedRole(identity.role)) {
    return true
  }

  const creatorUserId = normalizeStringId(game?.creatorUserId)
  if (identity.userId && creatorUserId && identity.userId === creatorUserId) {
    return true
  }

  const creatorTelegramId =
    game?.creatorTelegramId !== null && game?.creatorTelegramId !== undefined
      ? String(game.creatorTelegramId).trim()
      : ''
  if (
    identity.userTelegramId &&
    creatorTelegramId &&
    identity.userTelegramId === creatorTelegramId
  ) {
    return true
  }

  if (identity.role !== 'moder' || !identity.userId) {
    return false
  }

  const moderators = Array.isArray(game?.moderators) ? game.moderators : []
  return moderators.some((moderator) => {
    if (!moderator) {
      return false
    }

    if (typeof moderator === 'string') {
      return normalizeStringId(moderator) === identity.userId
    }

    return normalizeStringId(moderator?._id ?? moderator?.id) === identity.userId
  })
}

const userHasTeamAccess = async ({ TeamsUsers, identity, teamId }) => {
  const normalizedTeamId = normalizeStringId(teamId)
  if (!normalizedTeamId) {
    return false
  }

  const filters = []
  if (identity.userId) {
    filters.push({ teamId: normalizedTeamId, userId: identity.userId })
  }
  if (identity.userTelegramId) {
    filters.push({
      teamId: normalizedTeamId,
      userTelegramId: identity.userTelegramId,
    })
  }

  if (filters.length === 0) {
    return false
  }

  const membership = await TeamsUsers.findOne({ $or: filters })
    .select({ _id: 1 })
    .lean()

  return Boolean(membership?._id)
}

export const ensureStoryProgress = async ({
  GamesTeams,
  game,
  gameTeam,
  actor = 'system',
  save = false,
}) => {
  if (gameTeam?.storyProgress) {
    return gameTeam.storyProgress
  }

  const progress = buildInitialStoryProgress(game, { actor })
  if (save) {
    await GamesTeams.updateOne(
      { _id: gameTeam._id },
      { $set: { storyProgress: progress } },
    )
  }

  return progress
}

export const buildTeamStoryStatePayload = ({ game, team, gameTeam, progress }) => {
  const availableNodes = getAvailableStoryNodes(game, progress).map((node) => ({
    id: normalizeText(node?.id),
    title: normalizeText(node?.title),
    descriptionRich: typeof node?.descriptionRich === 'string' ? node.descriptionRich : '',
    media: Array.isArray(node?.media) ? node.media : [],
    clues: Array.isArray(node?.clues)
      ? node.clues.map((clue) => ({
          id: normalizeText(clue?.id),
          title: normalizeText(clue?.title),
          scorePenalty: Number(clue?.scorePenalty) || 0,
          isUsed: Array.isArray(progress?.usedClueIds)
            ? progress.usedClueIds.includes(normalizeText(clue?.id))
            : false,
        }))
      : [],
    actions: Array.isArray(node?.actions)
      ? node.actions.map((action) => ({
          id: normalizeText(action?.id),
          label: normalizeText(action?.label),
          descriptionRich:
            typeof action?.descriptionRich === 'string'
              ? action.descriptionRich
              : '',
          requiredItemIds: Array.isArray(action?.requiredItemIds)
            ? action.requiredItemIds
            : [],
        }))
      : [],
  }))

  const storyItems = Array.isArray(game?.storyItems) ? game.storyItems : []
  const itemsById = new Map(
    storyItems
      .map((item) => [normalizeText(item?.id), item])
      .filter(([itemId]) => Boolean(itemId)),
  )
  const activeInventory = getActiveStoryInventory(progress).map((entry) => {
    const item = itemsById.get(normalizeText(entry?.itemId))
    return {
      itemId: normalizeText(entry?.itemId),
      obtainedAt: entry?.obtainedAt || null,
      sourceNodeId: normalizeText(entry?.sourceNodeId),
      title: normalizeText(item?.title),
      image: normalizeText(item?.image),
      descriptionRich:
        typeof item?.descriptionRich === 'string' ? item.descriptionRich : '',
      media: Array.isArray(item?.media) ? item.media : [],
    }
  })

  const config = game?.storyConfig || {}
  const currentEnding =
    progress?.currentEndingId && Array.isArray(game?.storyEndings)
      ? game.storyEndings.find(
          (ending) => normalizeText(ending?.id) === progress.currentEndingId,
        )
      : null

  return {
    game: {
      id: normalizeStringId(game?._id ?? game?.id),
      name: normalizeText(game?.name),
      status: normalizeText(game?.status),
      type: normalizeText(game?.type) || 'story',
      storyConfig: {
        nodeLabel: normalizeText(config?.nodeLabel) || 'Локация',
        startMode: config?.startMode === 'individual' ? 'individual' : 'common',
        hideTotalNodes: config?.hideTotalNodes !== false,
        hideTotalItems: config?.hideTotalItems !== false,
        showInventory: config?.showInventory !== false,
        showScoreToTeam: Boolean(config?.showScoreToTeam),
        showFinalHistoryToTeam: Boolean(config?.showFinalHistoryToTeam),
      },
    },
    team: {
      id: normalizeStringId(team?._id ?? gameTeam?.teamId),
      name: normalizeText(team?.name) || 'Команда без названия',
      gameTeamId: normalizeStringId(gameTeam?._id),
    },
    progress: {
      status: progress?.status || 'not_started',
      startedAt: progress?.startedAt || null,
      finishedAt: progress?.finishedAt || null,
      currentEndingId: normalizeText(progress?.currentEndingId),
      score: Boolean(config?.showScoreToTeam) ? Number(progress?.score) || 0 : null,
      usedClueIds: Array.isArray(progress?.usedClueIds)
        ? progress.usedClueIds
        : [],
    },
    availableNodes,
    inventory: config?.showInventory === false ? [] : activeInventory,
    currentEnding: currentEnding
      ? {
          id: normalizeText(currentEnding?.id),
          title: normalizeText(currentEnding?.title),
          type: normalizeText(currentEnding?.type),
          descriptionRich:
            typeof currentEnding?.descriptionRich === 'string'
              ? currentEnding.descriptionRich
              : '',
          media: Array.isArray(currentEnding?.media) ? currentEnding.media : [],
        }
      : null,
    history:
      progress?.status &&
      ['completed', 'failed'].includes(progress.status) &&
      config?.showFinalHistoryToTeam
        ? Array.isArray(progress?.history)
          ? progress.history
          : []
        : [],
  }
}

export const buildAdminStoryTeamPayload = ({ game, team, gameTeam, progress }) => ({
  team: {
    id: normalizeStringId(team?._id ?? gameTeam?.teamId),
    name: normalizeText(team?.name) || 'Команда без названия',
    gameTeamId: normalizeStringId(gameTeam?._id),
  },
  progress: progress || null,
  availableNodeIds: progress
    ? getAvailableStoryNodes(game, progress).map((node) => normalizeText(node?.id))
    : [],
})

export const loadPlayerStoryContext = async ({
  request,
  params,
  teamIdOverride = '',
}) => {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return { response: jsonError('Необходима авторизация', 401) }
  }

  const resolvedParams = await params
  const gameId = normalizeStringId(resolvedParams?.gameId)
  const requestUrl = new URL(request.url)
  const teamId =
    normalizeStringId(teamIdOverride) ||
    normalizeStringId(requestUrl.searchParams.get('teamId'))

  if (!gameId || !teamId) {
    return { response: jsonError('Не указан gameId или teamId', 400) }
  }

  const db = await dbConnectGlobal()
  if (!db) {
    throw new Error('Не удалось подключиться к базе данных')
  }

  const Games = db.model('Games')
  const GamesTeams = db.model('GamesTeams')
  const Teams = db.model('Teams')
  const TeamsUsers = db.model('TeamsUsers')

  const game = await findGameByAnyId(Games, gameId)
  if (!game?._id) {
    return { response: jsonError('Игра не найдена', 404) }
  }
  if (game.type !== 'story') {
    return { response: jsonError('Игра не является story-квестом', 400) }
  }

  const gameTeam = await GamesTeams.findOne({
    gameId: normalizeStringId(game._id),
    teamId,
  })
  if (!gameTeam?._id) {
    return { response: jsonError('Команда не зарегистрирована на игру', 404) }
  }

  const identity = resolveSessionIdentity(session)
  const allowed = await userHasTeamAccess({ TeamsUsers, identity, teamId })
  if (!allowed) {
    return { response: jsonError('Нет доступа к этой команде', 403) }
  }

  const team = await Teams.findById(teamId).lean()
  const progress = await ensureStoryProgress({
    GamesTeams,
    game,
    gameTeam,
    actor: 'team',
    save: true,
  })

  return { db, GamesTeams, game, gameTeam, team, progress, session, identity }
}

export const loadAdminStoryContext = async ({
  request,
  requireTeam = false,
  gameIdOverride = '',
  teamIdOverride = '',
}) => {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return { response: jsonError('Необходима авторизация', 401) }
  }

  const requestUrl = new URL(request.url)
  const gameId =
    normalizeStringId(gameIdOverride) ||
    normalizeStringId(requestUrl.searchParams.get('gameId'))
  const teamId =
    normalizeStringId(teamIdOverride) ||
    normalizeStringId(requestUrl.searchParams.get('teamId'))

  if (!gameId || (requireTeam && !teamId)) {
    return { response: jsonError('Не указан gameId или teamId', 400) }
  }

  const db = await dbConnectGlobal()
  if (!db) {
    throw new Error('Не удалось подключиться к базе данных')
  }

  const Games = db.model('Games')
  const GamesTeams = db.model('GamesTeams')
  const Teams = db.model('Teams')

  const game = await findGameByAnyId(Games, gameId)
  if (!game?._id) {
    return { response: jsonError('Игра не найдена', 404) }
  }
  if (game.type !== 'story') {
    return { response: jsonError('Игра не является story-квестом', 400) }
  }

  const identity = resolveSessionIdentity(session)
  if (!hasGameManageAccess({ identity, game })) {
    return { response: jsonError('Нет доступа к этой игре', 403) }
  }

  let gameTeam = null
  let team = null
  if (teamId) {
    gameTeam = await GamesTeams.findOne({
      gameId: normalizeStringId(game._id),
      $or: [{ teamId }, { _id: teamId }],
    })
    if (!gameTeam?._id) {
      return { response: jsonError('Команда не зарегистрирована на игру', 404) }
    }
    team = await Teams.findById(gameTeam.teamId).lean()
  }

  return { db, GamesTeams, Teams, game, gameTeam, team, session, identity }
}
