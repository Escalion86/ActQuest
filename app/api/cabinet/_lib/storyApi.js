import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import {
  buildInitialStoryProgress,
  getActiveStoryInventory,
  getAvailableStoryNodes,
} from '@server/storyEngine'
import {
  buildInitialInvestigationProgress,
  getAvailableInvestigationInteractions,
  getInvestigationClock,
  getUnlockedInvestigationLocations,
  isInvestigationStory,
  upgradeInvestigationProgress,
} from '@server/storyInvestigationEngine'
import applyPrequelStoryEffects from '@server/applyPrequelStoryEffects'
import { toStringId } from '@helpers/idAndDate'
import {
  getGamePrequels,
  getGameTeamPrequelProgresses,
} from '@helpers/normalizePrequel'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import { canAccessGameAsModerator } from '@helpers/gameAssignmentAccess'
import {
  acquireGameProcessLock,
  releaseGameProcessLock,
} from '@server/gameProcessLock'
import {
  buildTestGameFromRun,
  buildTestTeamFromRun,
  loadOwnedTestRun,
  normalizeTestRunId,
} from '@server/gameTestRuns'

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
  return ['client', 'admin', 'dev', 'ban'].includes(normalized)
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

  return canAccessGameAsModerator({
    userRole: identity.role,
    currentUserId: identity.userId,
    game,
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
    const normalized = upgradeInvestigationProgress(
      game,
      gameTeam.storyProgress,
      { actor },
    )
    if (normalized.upgraded && save) {
      await GamesTeams.updateOne(
        { _id: gameTeam._id },
        { $set: { storyProgress: normalized.progress } },
      )
    }
    return normalized.progress
  }

  const baseProgress = isInvestigationStory(game)
    ? buildInitialInvestigationProgress(game, { actor })
    : buildInitialStoryProgress(game, { actor })
  const appliedPrequelEffects = getGameTeamPrequelProgresses(
    gameTeam,
    getGamePrequels(game),
  ).flatMap((item) => item.appliedStoryEffects)
  const { progress } = applyPrequelStoryEffects({
    game,
    progress: baseProgress,
    effects: appliedPrequelEffects,
    actor,
  })
  if (save) {
    await GamesTeams.updateOne(
      { _id: gameTeam._id },
      { $set: { storyProgress: progress } },
    )
  }

  return progress
}

export const runLockedStoryMutation = async ({ context, actor, action }) => {
  const lock = await acquireGameProcessLock({
    GamesTeams: context.GamesTeams,
    teamId: context.gameTeam._id,
  })

  if (!lock.acquired) {
    return {
      response: jsonError(
        'Другое действие команды ещё обрабатывается. Повторите через несколько секунд.',
        409,
        { retryable: true },
      ),
    }
  }

  try {
    const progress = await ensureStoryProgress({
      GamesTeams: context.GamesTeams,
      game: context.game,
      gameTeam: lock.gameTeam,
      actor,
      save: false,
    })
    const mutationResult = await action({
      ...context,
      gameTeam: lock.gameTeam,
      progress,
    })
    const nextProgress = mutationResult?.progress || progress

    const writeResult = await context.GamesTeams.updateOne(
      {
        _id: context.gameTeam._id,
        'gameProcessLock.token': lock.token,
      },
      { $set: { storyProgress: nextProgress } },
    )

    if (writeResult?.matchedCount !== 1) {
      throw new Error('Story progress lock expired before write')
    }

    return {
      mutationResult,
      progress: nextProgress,
      gameTeam: lock.gameTeam,
    }
  } finally {
    try {
      await releaseGameProcessLock({
        GamesTeams: context.GamesTeams,
        teamId: context.gameTeam._id,
        token: lock.token,
      })
    } catch (error) {
      console.error('Failed to release story progress lock', error)
    }
  }
}

export const buildTeamStoryStatePayload = ({ game, team, gameTeam, progress }) => {
  const availableNodes = getAvailableStoryNodes(game, progress).map((node) => ({
    id: normalizeText(node?.id),
    title: normalizeText(node?.title),
    descriptionRich: typeof node?.descriptionRich === 'string' ? node.descriptionRich : '',
    media: Array.isArray(node?.media) ? node.media : [],
    clues: Array.isArray(node?.clues)
      ? node.clues.map((clue) => {
          const clueId = normalizeText(clue?.id)
          const isUsed = Array.isArray(progress?.usedClueIds)
            ? progress.usedClueIds.includes(clueId)
            : false
          return {
            id: clueId,
            title: normalizeText(clue?.title),
            scorePenalty: Number(clue?.scorePenalty) || 0,
            isUsed,
            contentRich:
              isUsed && typeof clue?.contentRich === 'string'
                ? clue.contentRich
                : '',
            media: isUsed && Array.isArray(clue?.media) ? clue.media : [],
          }
        })
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
          repeatable: action?.repeatable === true,
          isUsed:
            action?.repeatable !== true &&
            Array.isArray(progress?.usedActionIds) &&
            progress.usedActionIds.includes(normalizeText(action?.id)),
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
  const investigationMode = isInvestigationStory(game)
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
      description: normalizeText(game?.description),
      descriptionRich:
        typeof game?.descriptionRich === 'string' ? game.descriptionRich : '',
      status: normalizeText(game?.status),
      type: normalizeText(game?.type) || 'story',
      storyConfig: {
        experienceMode: investigationMode ? 'investigation' : 'quest',
        nodeLabel: normalizeText(config?.nodeLabel) || 'Локация',
        startMode: config?.startMode === 'individual' ? 'individual' : 'common',
        hideTotalNodes: config?.hideTotalNodes !== false,
        hideTotalItems: config?.hideTotalItems !== false,
        showInventory: config?.showInventory !== false,
        showScoreToTeam: Boolean(config?.showScoreToTeam),
        showFinalHistoryToTeam: Boolean(config?.showFinalHistoryToTeam),
        investigation: investigationMode
          ? {
              showClockToTeam:
                config?.investigation?.showClockToTeam !== false,
              showEvidenceToTeam:
                config?.investigation?.showEvidenceToTeam !== false,
              allowFreeReplay:
                config?.investigation?.allowFreeReplay !== false,
              accusationTimeMinutes: Math.max(
                0,
                Number(config?.investigation?.accusationTimeMinutes) || 0,
              ),
            }
          : null,
      },
      totalNodes: config?.hideTotalNodes === false
        ? Array.isArray(game?.storyNodes)
          ? game.storyNodes.length
          : 0
        : null,
      totalItems: config?.hideTotalItems === false ? storyItems.length : null,
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
    mode: investigationMode ? 'investigation' : 'quest',
    investigation: investigationMode
      ? buildTeamInvestigationStatePayload({ game, progress })
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

const buildTeamInvestigationStatePayload = ({ game, progress }) => {
  const charactersById = new Map(
    (Array.isArray(game?.storyCharacters) ? game.storyCharacters : []).map(
      (character) => [normalizeText(character?.id), character],
    ),
  )
  const topicsById = new Map(
    (Array.isArray(game?.storyTopics) ? game.storyTopics : []).map((topic) => [
      normalizeText(topic?.id),
      topic,
    ]),
  )
  const unlockedCharacterIds = new Set(
    Array.isArray(progress?.unlockedCharacterIds)
      ? progress.unlockedCharacterIds.map(normalizeText)
      : [],
  )
  const unlockedTopicIds = new Set(
    Array.isArray(progress?.unlockedTopicIds)
      ? progress.unlockedTopicIds.map(normalizeText)
      : [],
  )
  const evidenceById = new Map(
    (Array.isArray(game?.storyEvidence) ? game.storyEvidence : []).map(
      (evidence) => [normalizeText(evidence?.id), evidence],
    ),
  )
  const unlockedLocations = getUnlockedInvestigationLocations(game, progress)
  const currentNodeId = normalizeText(progress?.currentNodeId)
  const currentLocation = unlockedLocations.find(
    (node) => normalizeText(node?.id) === currentNodeId,
  )
  const mapLocation = (node) => ({
    id: normalizeText(node?.id),
    title: normalizeText(node?.title),
    descriptionRich:
      typeof node?.descriptionRich === 'string' ? node.descriptionRich : '',
    media: Array.isArray(node?.media) ? node.media : [],
    travelTimeMinutes: Math.max(
      0,
      Number(
        node?.travelTimeMinutes ??
          game?.storyConfig?.investigation?.defaultTravelTimeMinutes ??
          0,
      ) || 0,
    ),
    isCurrent: normalizeText(node?.id) === currentNodeId,
  })
  const accusationConfig = game?.storyAccusation || {}
  const accusationTopicId = normalizeText(accusationConfig?.unlockTopicId)
  const accusationRequiredNodeId = normalizeText(
    accusationConfig?.requiredNodeId,
  )
  const accusationRequiredNode = (
    Array.isArray(game?.storyNodes) ? game.storyNodes : []
  ).find(
    (node) => normalizeText(node?.id) === accusationRequiredNodeId,
  )

  return {
    clock: getInvestigationClock(game, progress),
    currentLocation: currentLocation ? mapLocation(currentLocation) : null,
    availableLocations: unlockedLocations.map(mapLocation),
    characters: Array.from(unlockedCharacterIds)
      .map((id) => charactersById.get(id))
      .filter(Boolean)
      .map((character) => ({
        id: normalizeText(character?.id),
        title: normalizeText(character?.title),
        subtitle: normalizeText(character?.subtitle),
        descriptionRich:
          typeof character?.descriptionRich === 'string'
            ? character.descriptionRich
            : '',
        image: normalizeText(character?.image),
        media: Array.isArray(character?.media) ? character.media : [],
        defaultNodeId: normalizeText(character?.defaultNodeId),
      })),
    topics: Array.from(unlockedTopicIds)
      .map((id) => topicsById.get(id))
      .filter(Boolean)
      .map((topic) => ({
        id: normalizeText(topic?.id),
        title: normalizeText(topic?.title),
        descriptionRich:
          typeof topic?.descriptionRich === 'string'
            ? topic.descriptionRich
            : '',
        icon: normalizeText(topic?.icon),
      })),
    availableInteractions: getAvailableInvestigationInteractions(
      game,
      progress,
    ).map((interaction) => ({
      id: normalizeText(interaction?.id),
      kind: normalizeText(interaction?.kind) || 'question',
      locationId: normalizeText(interaction?.locationId),
      characterId: normalizeText(interaction?.characterId),
      topicId: normalizeText(interaction?.topicId),
      label: normalizeText(interaction?.label),
      promptRich:
        typeof interaction?.promptRich === 'string'
          ? interaction.promptRich
          : '',
      timeCostMinutes: Math.max(
        0,
        Number(
          interaction?.timeCostMinutes ??
            game?.storyConfig?.investigation?.defaultInteractionTimeMinutes ??
            0,
        ) || 0,
      ),
    })),
    discoveredEvidence:
      game?.storyConfig?.investigation?.showEvidenceToTeam === false
        ? []
        : (Array.isArray(progress?.discoveredEvidenceIds)
            ? progress.discoveredEvidenceIds
            : []
          )
            .map((id) => evidenceById.get(normalizeText(id)))
            .filter(Boolean)
            .map((evidence) => ({
              id: normalizeText(evidence?.id),
              title: normalizeText(evidence?.title),
              descriptionRich:
                typeof evidence?.descriptionRich === 'string'
                  ? evidence.descriptionRich
                  : '',
              media: Array.isArray(evidence?.media) ? evidence.media : [],
            })),
    journal: Array.isArray(progress?.journal) ? progress.journal : [],
    accusation: {
      available:
        accusationConfig?.enabled === true &&
        (!accusationTopicId || unlockedTopicIds.has(accusationTopicId)) &&
        !progress?.accusation?.submittedAt,
      requiredNodeId: accusationRequiredNodeId,
      requiredNodeTitle: normalizeText(accusationRequiredNode?.title),
      isAtRequiredNode:
        !accusationRequiredNodeId || currentNodeId === accusationRequiredNodeId,
      culpritOptions: (Array.isArray(accusationConfig?.culpritCharacterIds)
        ? accusationConfig.culpritCharacterIds
        : []
      )
        .map((id) => charactersById.get(normalizeText(id)))
        .filter(Boolean)
        .map((character) => ({
          id: normalizeText(character?.id),
          title: normalizeText(character?.title),
          subtitle: normalizeText(character?.subtitle),
        })),
      motiveOptions: (Array.isArray(accusationConfig?.motives)
        ? accusationConfig.motives
        : []
      ).map((motive) => ({
        id: normalizeText(motive?.id),
        title: normalizeText(motive?.title),
      })),
      minSelectableEvidence: Math.max(
        0,
        Number(accusationConfig?.minSelectableEvidence) || 0,
      ),
      maxSelectableEvidence: Math.max(
        0,
        Number(accusationConfig?.maxSelectableEvidence) || 0,
      ),
      submitted: progress?.accusation?.submittedAt
        ? {
            submittedAt: progress.accusation.submittedAt,
            submittedAtMinute: progress.accusation.submittedAtMinute,
            culpritId: normalizeText(progress.accusation.culpritId),
            motiveId: normalizeText(progress.accusation.motiveId),
            evidenceIds: Array.isArray(progress.accusation.evidenceIds)
              ? progress.accusation.evidenceIds
              : [],
            outcomeId: normalizeText(progress.accusation.outcomeId),
          }
        : null,
    },
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
  requireStarted = false,
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
  let GamesTeams = db.model('GamesTeams')
  const Teams = db.model('Teams')
  const TeamsUsers = db.model('TeamsUsers')

  const identity = resolveSessionIdentity(session)
  const testRunId = normalizeTestRunId(
    requestUrl.searchParams.get('testRunId'),
  )
  if (testRunId) {
    GamesTeams = db.model('GameTestRuns')
    const testRun = await loadOwnedTestRun({
      GameTestRuns: GamesTeams,
      testRunId,
      gameId,
      userId: identity.userId,
      telegramId: identity.userTelegramId,
    })
    if (!testRun?._id) {
      return { response: jsonError('Тестовый прогон не найден', 404) }
    }

    const game = buildTestGameFromRun(testRun)
    if (game.type !== 'story') {
      return { response: jsonError('Игра не является story-квестом', 400) }
    }

    const team = buildTestTeamFromRun(testRun)
    const progress = await ensureStoryProgress({
      GamesTeams,
      game,
      gameTeam: testRun,
      actor: 'team',
      save: true,
    })

    return {
      db,
      GamesTeams,
      game,
      gameTeam: testRun,
      team,
      progress,
      session,
      identity,
      isTestRun: true,
      testRunId,
    }
  }

  const game = await findGameByAnyId(Games, gameId)
  if (!game?._id) {
    return { response: jsonError('Игра не найдена', 404) }
  }
  if (game.type !== 'story') {
    return { response: jsonError('Игра не является story-квестом', 400) }
  }
  const gameStatus = normalizeText(game?.status).toLowerCase()
  const canReadStory =
    gameStatus === 'started' ||
    (!requireStarted && ['finished', 'closed'].includes(gameStatus))
  if (!canReadStory) {
    return {
      response: jsonError(
        gameStatus === 'active'
          ? 'Story-квест ещё не начался'
          : 'Story-квест уже недоступен для действий',
        409,
      ),
    }
  }

  const gameTeam = await GamesTeams.findOne({
    gameId: normalizeStringId(game._id),
    teamId,
  })
  if (!gameTeam?._id) {
    return { response: jsonError('Команда не зарегистрирована на игру', 404) }
  }

  const allowed = await userHasTeamAccess({ TeamsUsers, identity, teamId })
  if (!allowed) {
    return { response: jsonError('Нет доступа к этой команде', 403) }
  }

  const team = await Teams.findById(teamId).lean()
  const progress =
    gameStatus === 'started'
      ? await ensureStoryProgress({
          GamesTeams,
          game,
          gameTeam,
          actor: 'team',
          save: true,
        })
      : gameTeam?.storyProgress || { status: 'not_started' }

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
