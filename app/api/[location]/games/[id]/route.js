import CRUD from '@server/CRUD'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import buildGameResultSnapshots from '@server/buildGameResultSnapshots'
import buildGameResultComputed from '@server/buildGameResultComputed'
import updateParticipantsClosedStats from '@server/updateParticipantsClosedStats'
import updateParticipantsRatings from '@server/updateParticipantsRatings'
import { deleteGameTeamMessagesForGame } from '@server/gameTeamMessages'
import fetchGameHistoryState from '@server/gameHistory/fetchGameHistoryState'
import recordGameHistoryEntry from '@server/gameHistory/recordGameHistoryEntry'
import buildGameHistorySnapshot from '@server/gameHistory/buildGameHistorySnapshot'
import sanitize from '@helpers/sanitize'
import {
  buildDefaultPrequel,
  hasPrequelAdjustments,
  normalizePrequelConfig,
  normalizePrequelStoryEffect,
} from '@helpers/normalizePrequel'
import {
  normalizeStoredTaskDistributionTemplate,
  normalizeTaskDistributionMode,
  validateTaskDistributionTemplate,
} from '@helpers/taskDistribution'
import { canAssignGameOrganizer } from '@helpers/gameOrganizer'
import { runLocationLegacyHandler } from '@app/api/_lib/runLocationLegacyHandler'

const buildResetPayload = ({
  clearTimeAddings = true,
  clearPrequelProgress = true,
} = {}) => ({
  activeNum: 0,
  findedCodes: [],
  wrongCodes: [],
  findedPenaltyCodes: [],
  findedBonusCodes: [],
  codeAttempts: [],
  startTime: [],
  endTime: [],
  photos: [],
  forcedClues: [],
  taskFailures: [],
  ...(clearTimeAddings ? { timeAddings: [] } : {}),
  storyProgress: null,
  ...(clearPrequelProgress ? { prequelProgress: null } : {}),
  timerId: null,
})

const hasResultSnapshots = (result) =>
  Array.isArray(result?.teams) &&
  result.teams.length > 0 &&
  Array.isArray(result?.gameTeams) &&
  result.gameTeams.length > 0 &&
  Array.isArray(result?.teamsUsers) &&
  result.teamsUsers.length > 0

const hasComputedResult = (result) =>
  result?.computed && typeof result.computed === 'object'

const isObjectIdLike = (value) =>
  typeof value === 'string' && /^[a-f\d]{24}$/i.test(value.trim())

const normalizeTelegramId = (value) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null
  }

  return Math.trunc(numeric)
}

const decodeHtmlEntities = (value) => {
  let result = typeof value === 'string' ? value : ''
  for (let index = 0; index < 3; index += 1) {
    const decoded = result
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&amp;/gi, '&')
    if (decoded === result) {
      break
    }
    result = decoded
  }
  return result
}

const sanitizeTaskMedia = (media = []) =>
  (Array.isArray(media) ? media : [])
    .map((item) => ({
      ...item,
      url: decodeHtmlEntities(item?.url),
      title: decodeHtmlEntities(item?.title),
    }))
    .map((item, index) => ({
      id:
        typeof item?.id === 'string' && item.id.trim().length > 0
          ? item.id.trim()
          : `task-media-${index}`,
      type:
        item?.type === 'audio' ? 'audio' : item?.type === 'video' ? 'video' : 'image',
      url: typeof item?.url === 'string' ? item.url.trim() : '',
      mime: typeof item?.mime === 'string' ? item.mime.trim() : '',
      size: Number(item?.size) || 0,
      duration: Number(item?.duration) || 0,
      path: typeof item?.path === 'string' ? item.path.trim() : '',
      title: typeof item?.title === 'string' ? item.title.trim() : '',
    }))
    .filter((item) => item.url !== '')

const stripHtmlToPlainText = (value) =>
  String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h1|h2|h3|h4|h5|h6|li|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\r?\n[ \t]+/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

const sanitizeTasksRichContent = (tasks = []) =>
  (Array.isArray(tasks) ? tasks : []).map((task) => ({
    ...task,
    howToSolve:
      typeof task?.howToSolve === 'string' ? task.howToSolve.trim() : '',
    taskRich:
      typeof task?.taskRich === 'string' && task.taskRich.trim().length > 0
        ? sanitize(task.taskRich)
        : '',
    clues: (Array.isArray(task?.clues) ? task.clues : []).map((clue) => {
      const clueRichRaw = typeof clue?.clueRich === 'string' ? clue.clueRich.trim() : ''
      const clueRich = clueRichRaw ? sanitize(clueRichRaw) : ''
      const cluePlainRaw = typeof clue?.clue === 'string' ? clue.clue : ''
      const cluePlain = cluePlainRaw.trim() || stripHtmlToPlainText(clueRich)

      return {
        ...clue,
        clue: cluePlain,
        clueRich,
      }
    }),
    postMessageRich:
      typeof task?.postMessageRich === 'string' &&
      task.postMessageRich.trim().length > 0
        ? sanitize(task.postMessageRich)
        : '',
    postMessage:
      typeof task?.postMessage === 'string' && task.postMessage.trim().length > 0
        ? task.postMessage.trim()
        : stripHtmlToPlainText(task?.postMessageRich),
    postMessageMedia: sanitizeTaskMedia(task?.postMessageMedia),
    taskMedia: sanitizeTaskMedia(task?.taskMedia),
  }))

const sanitizeGameDescriptionContent = (gameData = {}) => {
  const descriptionRichRaw =
    typeof gameData?.descriptionRich === 'string' ? gameData.descriptionRich.trim() : ''
  const descriptionRich = descriptionRichRaw ? sanitize(descriptionRichRaw) : ''
  const descriptionPlainRaw = typeof gameData?.description === 'string' ? gameData.description : ''
  const descriptionPlain = descriptionPlainRaw.trim() || stripHtmlToPlainText(descriptionRich)

  return {
    description: descriptionPlain,
    descriptionRich,
    descriptionMedia: sanitizeTaskMedia(gameData?.descriptionMedia),
  }
}

const normalizeCodeDuplicateKey = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()

const sanitizePrequelCodeItems = (items = [], kind = 'bonus') => {
  const seenCodes = new Set()

  return (Array.isArray(items) ? items : [])
    .map((item, index) => {
      const normalizedCode = String(item?.code || '').trim()
      if (!normalizedCode) {
        return null
      }

      const duplicateKey = normalizeCodeDuplicateKey(normalizedCode)
      if (seenCodes.has(duplicateKey)) {
        return null
      }
      seenCodes.add(duplicateKey)

      return {
        ...(typeof item?._id === 'string' && item._id.trim()
          ? { _id: item._id.trim() }
          : {}),
        id:
          typeof item?.id === 'string' && item.id.trim().length > 0
            ? item.id.trim()
            : `prequel-${kind}-${index}`,
        code: normalizedCode,
        value: Number(item?.value ?? item?.bonus ?? item?.penalty) || 0,
        description:
          typeof item?.description === 'string' ? item.description.trim() : '',
        image: typeof item?.image === 'string' ? item.image.trim() : '',
        storyEffects: (Array.isArray(item?.storyEffects) ? item.storyEffects : []).map(
          normalizePrequelStoryEffect,
        ),
      }
    })
    .filter(Boolean)
}

const sanitizePrequelContent = (prequel = {}) => {
  const normalized = normalizePrequelConfig(prequel)
  const descriptionRichRaw =
    typeof prequel?.descriptionRich === 'string' ? prequel.descriptionRich.trim() : ''
  const descriptionRich = descriptionRichRaw ? sanitize(descriptionRichRaw) : ''
  const descriptionPlainRaw =
    typeof prequel?.description === 'string' ? prequel.description : ''
  const descriptionPlain =
    descriptionPlainRaw.trim() || stripHtmlToPlainText(descriptionRich)

  const bonusCodes = sanitizePrequelCodeItems(normalized.bonusCodes, 'bonus')
  const penaltyCodes = sanitizePrequelCodeItems(
    normalized.penaltyCodes,
    'penalty',
  )

  const duplicateAcrossKinds = bonusCodes.find((bonusCode) =>
    penaltyCodes.some(
      (penaltyCode) =>
        normalizeCodeDuplicateKey(penaltyCode.code) ===
        normalizeCodeDuplicateKey(bonusCode.code),
    ),
  )

  if (duplicateAcrossKinds) {
    const error = new Error(
      `Код приквела "${duplicateAcrossKinds.code}" не может одновременно быть бонусным и штрафным`,
    )
    error.name = 'ValidationError'
    throw error
  }

  const wrongAttemptsLimit =
    normalized.wrongAttemptsLimit !== null
      ? Math.max(1, Math.trunc(Number(normalized.wrongAttemptsLimit) || 0))
      : null

  return {
    ...buildDefaultPrequel(),
    enabled: Boolean(normalized.enabled),
    openAt: normalized.openAt,
    description: descriptionPlain,
    descriptionRich,
    descriptionMedia: sanitizeTaskMedia(normalized.descriptionMedia),
    mode: normalized.mode,
    bonusCodes,
    penaltyCodes,
    wrongAttemptsLimit,
    wrongAttemptsPenalty: Number(normalized.wrongAttemptsPenalty) || 0,
    wrongAttemptsStoryEffects: (
      Array.isArray(normalized.wrongAttemptsStoryEffects)
        ? normalized.wrongAttemptsStoryEffects
        : []
    ).map(normalizePrequelStoryEffect),
  }
}

const resolvePrequelResetMode = ({ updatePayload, gameTeams }) => {
  const teamDocs = Array.isArray(gameTeams) ? gameTeams : []
  const hasResolvedPrequel = teamDocs.some((gameTeam) =>
    hasPrequelAdjustments(gameTeam?.prequelProgress),
  )

  const requestedMode =
    typeof updatePayload?.prequelResetMode === 'string'
      ? updatePayload.prequelResetMode.trim().toLowerCase()
      : ''

  if (!hasResolvedPrequel) {
    return {
      hasResolvedPrequel,
      prequelResetMode: 'clear',
      clearPrequelProgress: true,
    }
  }

  const shouldKeepPrequelProgress =
    requestedMode === 'keep' || updatePayload?.keepPrequelProgressOnReset === true

  return {
    hasResolvedPrequel,
    prequelResetMode: shouldKeepPrequelProgress ? 'keep' : 'clear',
    clearPrequelProgress: !shouldKeepPrequelProgress,
  }
}

const normalizeStringId = (value) => {
  if (value === null || value === undefined) {
    return ''
  }

  if (typeof value === 'string') {
    return value.trim()
  }

  if (typeof value?.toString === 'function') {
    const nextValue = value.toString()
    return nextValue === '[object Object]' ? '' : nextValue.trim()
  }

  return ''
}

const normalizeAgentsForWrite = (agents = []) => {
  const seen = new Set()
  return (Array.isArray(agents) ? agents : [])
    .map((agent) =>
      normalizeStringId(
        typeof agent === 'string'
          ? agent
          : agent?.userId ?? agent?.id ?? agent?._id,
      ),
    )
    .filter((userId) => {
      if (!userId || seen.has(userId)) {
        return false
      }
      seen.add(userId)
      return true
    })
    .map((userId) => ({ userId, active: true }))
}

const normalizeAgentNotificationsForWrite = (value = {}) => ({
  onPreviousTask: value?.onPreviousTask !== false,
  onCurrentTask: value?.onCurrentTask !== false,
  onTaskCompleted: value?.onTaskCompleted === true,
  onAllTeamsPassed: value?.onAllTeamsPassed !== false,
})

const buildHistoryActorFromSession = (session) => ({
  userId:
    session?.user?.globalUserId ??
    session?.user?.userId ??
    session?.user?._id ??
    session?.user?.id ??
    null,
  telegramId:
    session?.user?.telegramId !== null && session?.user?.telegramId !== undefined
      ? String(session.user.telegramId).trim()
      : null,
  role: typeof session?.user?.role === 'string' ? session.user.role : '',
  name: typeof session?.user?.name === 'string' ? session.user.name : '',
})

const normalizeTaskAgentsForWrite = (tasks = [], allowedAgentIds = new Set()) =>
  (Array.isArray(tasks) ? tasks : []).map((task) => {
    const baseTask =
      task && typeof task.toObject === 'function' ? task.toObject() : task

    return {
      ...baseTask,
      agentUserIds: (Array.isArray(baseTask?.agentUserIds)
        ? baseTask.agentUserIds
        : []
      )
        .map((userId) => normalizeStringId(userId))
        .filter((userId, index, list) => {
          if (!userId || !allowedAgentIds.has(userId)) {
            return false
          }
          return list.indexOf(userId) === index
        }),
    }
  })

const normalizeStoryNodeAgentsForWrite = (
  storyNodes = [],
  allowedAgentIds = new Set(),
) =>
  (Array.isArray(storyNodes) ? storyNodes : []).map((node) => {
    const baseNode =
      node && typeof node.toObject === 'function' ? node.toObject() : node

    return {
      ...baseNode,
      agentUserIds: (Array.isArray(baseNode?.agentUserIds)
        ? baseNode.agentUserIds
        : []
      )
        .map((userId) => normalizeStringId(userId))
        .filter((userId, index, list) => {
          if (!userId || !allowedAgentIds.has(userId)) {
            return false
          }
          return list.indexOf(userId) === index
        }),
    }
  })

const execute = (request, params) =>
  runLocationLegacyHandler({
    request,
    params,
    handler: async (req, res) => {
      if (req.method === 'GET') {
        const {
          query: { id, location },
        } = req

        if (location && id) {
          try {
            const db = await dbConnectGlobal()
            if (db) {
              const Games = db.model('Games')
              const existingGame = await Games.findById(id)

              if (existingGame) {
                const existingGameLocation =
                  typeof existingGame.location === 'string'
                    ? existingGame.location.trim().toLowerCase()
                    : null
                const requestedLocation = String(location).trim().toLowerCase()
                const normalizedStatus = String(existingGame.status || '').toLowerCase()

                if (
                  (!existingGameLocation || existingGameLocation === requestedLocation) &&
                  (normalizedStatus === 'finished' || normalizedStatus === 'closed') &&
                  hasResultSnapshots(existingGame?.result) &&
                  !hasComputedResult(existingGame?.result)
                ) {
                  const built = await buildGameResultComputed({
                    game: existingGame?.toObject ? existingGame.toObject() : existingGame,
                  })

                  await Games.findByIdAndUpdate(
                    id,
                    {
                      result: {
                        ...(existingGame.result && typeof existingGame.result === 'object'
                          ? existingGame.result
                          : {}),
                        teamsPlaces: built.teamsPlaces,
                        computed: built.computed,
                      },
                    },
                    { runValidators: true },
                  )
                }
              }
            }
          } catch (error) {
            console.error('Failed to auto-build game result on GET', {
              error,
              gameId: id,
              location,
            })
          }
        }

        return CRUD('Games', req, res)
      }

      if (req.method === 'DELETE') {
        const {
          query: { id, location },
        } = req

        if (!location || !id) {
          return res
            .status(400)
            .json({ success: false, error: 'Не указан идентификатор игры или площадки' })
        }

        try {
          const db = await dbConnectGlobal()
          if (!db) {
            return res
              .status(500)
              .json({ success: false, error: 'Нет подключения к базе данных' })
          }

          const Games = db.model('Games')
          const existingGame = await Games.findById(id)

          if (!existingGame) {
            return res.status(404).json({ success: false, error: 'Игра не найдена' })
          }

          const existingGameLocation =
            typeof existingGame.location === 'string'
              ? existingGame.location.trim().toLowerCase()
              : null
          if (
            existingGameLocation &&
            existingGameLocation !== String(location).trim().toLowerCase()
          ) {
            return res
              .status(403)
              .json({ success: false, error: 'Игра недоступна для выбранной площадки' })
          }

          const normalizedStatus = String(existingGame.status || '').toLowerCase()
          if (normalizedStatus === 'started' || normalizedStatus === 'closed') {
            return res.status(400).json({
              success: false,
              error: 'Удаление доступно только для игр, которые не запущены и не закрыты',
            })
          }
        } catch (error) {
          console.error('Failed to validate game delete', { error, gameId: id, location })
          return res
            .status(500)
            .json({ success: false, error: 'Не удалось проверить возможность удаления игры' })
        }

        return CRUD('Games', req, res)
      }

      if (req.method !== 'PUT') {
        return CRUD('Games', req, res)
      }

      const {
        query: { id, location },
        body,
      } = req

      if (!location || !id) {
        return res
          .status(400)
          .json({ success: false, error: 'Не указан идентификатор игры или площадки' })
      }

      const updatePayload = body?.data

      if (!updatePayload || typeof updatePayload !== 'object') {
        return res
          .status(400)
          .json({ success: false, error: 'Отсутствуют данные для обновления игры' })
      }

      try {
        const db = await dbConnectGlobal()

        if (!db) {
          return res
            .status(500)
            .json({ success: false, error: 'Нет подключения к базе данных' })
        }

        const Games = db.model('Games')
        const existingGame = await Games.findById(id)

        if (!existingGame) {
          return res.status(404).json({ success: false, error: 'Игра не найдена' })
        }

        const existingGameLocation =
          typeof existingGame.location === 'string'
            ? existingGame.location.trim().toLowerCase()
            : null
        if (existingGameLocation && existingGameLocation !== String(location).trim().toLowerCase()) {
          return res
            .status(403)
            .json({ success: false, error: 'Игра недоступна для выбранной площадки' })
        }

        const previousStatus = String(existingGame.status || '').toLowerCase()
        const beforeHistoryState = await fetchGameHistoryState({
          db,
          gameId: String(id),
          game: existingGame?.toObject ? existingGame.toObject() : existingGame,
        })
        const requestedStatus = updatePayload.status ?? existingGame.status
        const requestedStatusNormalized = String(requestedStatus || '').toLowerCase()
        const resolvedStatus =
          requestedStatusNormalized === 'reopen'
            ? hasResultSnapshots(existingGame?.result)
              ? 'finished'
              : 'active'
            : requestedStatus
        const nextStatusNormalized = String(resolvedStatus || '').toLowerCase()
        const shouldReset =
          (previousStatus === 'finished' || previousStatus === 'closed') &&
          nextStatusNormalized === 'active'
        const shouldCreateResultSnapshot =
          nextStatusNormalized === 'finished' &&
          previousStatus !== 'finished' &&
          previousStatus !== 'closed'
        const shouldUpdateParticipantsMetrics =
          nextStatusNormalized === 'closed' && previousStatus !== 'closed'

        const updateData = { ...updatePayload, status: resolvedStatus }

        const hasAgentsUpdate = Object.prototype.hasOwnProperty.call(
          updateData,
          'agents',
        )

        if (hasAgentsUpdate) {
          updateData.agents = normalizeAgentsForWrite(updateData.agents)
        }

        const allowedAgentIds = new Set(
          (Array.isArray(updateData.agents)
            ? updateData.agents
            : Array.isArray(existingGame?.agents)
              ? existingGame.agents
              : []
          )
            .map((agent) => normalizeStringId(agent?.userId ?? agent?.id))
            .filter(Boolean),
        )

        if (
          Object.prototype.hasOwnProperty.call(
            updateData,
            'agentNotifications',
          )
        ) {
          updateData.agentNotifications = normalizeAgentNotificationsForWrite(
            updateData.agentNotifications,
          )
        }

        if (Array.isArray(updateData.tasks)) {
          updateData.tasks = normalizeTaskAgentsForWrite(
            sanitizeTasksRichContent(updateData.tasks),
            allowedAgentIds,
          )
        } else if (hasAgentsUpdate) {
          updateData.tasks = normalizeTaskAgentsForWrite(
            existingGame?.tasks,
            allowedAgentIds,
          )
        }

        const hasTaskDistributionUpdate =
          Object.prototype.hasOwnProperty.call(
            updateData,
            'taskDistributionMode',
          ) ||
          Object.prototype.hasOwnProperty.call(
            updateData,
            'taskDistributionTemplate',
          ) ||
          Array.isArray(updateData.tasks)

        if (hasTaskDistributionUpdate) {
          const tasksCount = Array.isArray(updateData.tasks)
            ? updateData.tasks.length
            : Array.isArray(existingGame?.tasks)
              ? existingGame.tasks.length
              : 0
          const taskDistributionMode = normalizeTaskDistributionMode(
            Object.prototype.hasOwnProperty.call(
              updateData,
              'taskDistributionMode',
            )
              ? updateData.taskDistributionMode
              : existingGame?.taskDistributionMode,
          )
          const taskDistributionTemplate =
            taskDistributionMode === 'random'
              ? normalizeStoredTaskDistributionTemplate(
                  Object.prototype.hasOwnProperty.call(
                    updateData,
                    'taskDistributionTemplate',
                  )
                    ? updateData.taskDistributionTemplate
                    : existingGame?.taskDistributionTemplate,
                  tasksCount,
                )
              : []

          if (taskDistributionMode === 'random') {
            const validation = validateTaskDistributionTemplate(
              taskDistributionTemplate,
              tasksCount,
            )

            if (!validation.valid) {
              return res.status(400).json({
                success: false,
                error:
                  validation.messages[0] ||
                  'Некорректный шаблон распределения заданий',
              })
            }
          }

          updateData.taskDistributionMode = taskDistributionMode
          updateData.taskDistributionTemplate = taskDistributionTemplate
        }

        if (Array.isArray(updateData.storyNodes)) {
          updateData.storyNodes = normalizeStoryNodeAgentsForWrite(
            updateData.storyNodes,
            allowedAgentIds,
          )
        } else if (hasAgentsUpdate) {
          updateData.storyNodes = normalizeStoryNodeAgentsForWrite(
            existingGame?.storyNodes,
            allowedAgentIds,
          )
        }

        const hasDescriptionContentKeys =
          Object.prototype.hasOwnProperty.call(updateData, 'description') ||
          Object.prototype.hasOwnProperty.call(updateData, 'descriptionRich') ||
          Object.prototype.hasOwnProperty.call(updateData, 'descriptionMedia')
        if (hasDescriptionContentKeys) {
          Object.assign(updateData, sanitizeGameDescriptionContent(updateData))
        }

        const hasPrequelContentKeys =
          Object.prototype.hasOwnProperty.call(updateData, 'prequel') ||
          Object.prototype.hasOwnProperty.call(updateData, 'prequelEnabled')

        if (hasPrequelContentKeys) {
          updateData.prequel = sanitizePrequelContent(updateData.prequel)
        }

        if (Object.prototype.hasOwnProperty.call(updateData, 'creatorUserId')) {
          const creatorUserId =
            typeof updateData.creatorUserId === 'string'
              ? updateData.creatorUserId.trim()
              : ''

          if (!creatorUserId) {
            updateData.creatorUserId = null
            updateData.creatorTelegramId = null
          } else if (!isObjectIdLike(creatorUserId)) {
            return res.status(400).json({
              success: false,
              error: 'Некорректный идентификатор организатора',
            })
          } else {
            const creatorDoc = await db
              .model('Users')
              .findById(creatorUserId)
              .select({ _id: 1, role: 1, telegramId: 1 })
              .lean()

            if (!creatorDoc) {
              return res.status(400).json({
                success: false,
                error: 'Организатор игры не найден',
              })
            }

            if (!canAssignGameOrganizer(creatorDoc)) {
              return res.status(400).json({
                success: false,
                error:
                  'Организатором игры может быть только администратор или разработчик',
              })
            }

            updateData.creatorUserId = String(creatorDoc._id)
            updateData.creatorTelegramId = normalizeTelegramId(
              creatorDoc.telegramId,
            )
          }
        }

        if (shouldReset) {
          const GamesTeams = db.model('GamesTeams')
          const existingGameTeams = await GamesTeams.find({ gameId: id })
            .select({ _id: 1, prequelProgress: 1 })
            .lean()
          const {
            hasResolvedPrequel,
            prequelResetMode,
            clearPrequelProgress,
          } = resolvePrequelResetMode({
            updatePayload,
            gameTeams: existingGameTeams,
          })

          updateData.dateStartFact = null
          updateData.dateEndFact = null
          updateData.result = null
          updateData._prequelResetMeta = {
            hasResolvedPrequel,
            prequelResetMode,
            clearPrequelProgress,
          }
        }

        if (shouldCreateResultSnapshot) {
          const snapshots = await buildGameResultSnapshots({ db, gameId: id })
          updateData.result = {
            teams: snapshots.teams,
            gameTeams: snapshots.gameTeams,
            teamsUsers: snapshots.teamsUsers,
            teamsPlaces: {},
            computed: null,
            text: '',
          }
        }

        const prequelResetMeta = updateData._prequelResetMeta || null
        if (Object.prototype.hasOwnProperty.call(updateData, '_prequelResetMeta')) {
          delete updateData._prequelResetMeta
        }

        let updatedGame = await Games.findByIdAndUpdate(id, updateData, {
          returnDocument: 'after',
          runValidators: true,
        })

        if (!updatedGame) {
          return res.status(400).json({ success: false, error: 'Не удалось обновить игру' })
        }

        if (shouldReset) {
          const GamesTeams = db.model('GamesTeams')
          const clearTimeAddings =
            updatePayload.clearTimeAddingsOnReset !== false
          const clearPrequelProgress =
            prequelResetMeta?.clearPrequelProgress !== false
          const resetResult = await GamesTeams.updateMany(
            { gameId: id },
            {
              $set: buildResetPayload({
                clearTimeAddings,
                clearPrequelProgress,
              }),
            },
          )
          console.info('[game-restart] reset team progress', {
            gameId: String(id),
            matchedCount: resetResult?.matchedCount,
            modifiedCount: resetResult?.modifiedCount,
            clearTimeAddings,
            clearPrequelProgress,
          })
          const deletedMessagesCount = await deleteGameTeamMessagesForGame({
            db,
            gameId: id,
          })
          console.info('[game-restart] deleted team messages', {
            gameId: String(id),
            deletedCount: deletedMessagesCount,
          })
        }

        if (shouldCreateResultSnapshot || shouldUpdateParticipantsMetrics) {
          try {
            const gameForMetrics = updatedGame?.toObject ? updatedGame.toObject() : updatedGame
            const built = await buildGameResultComputed({ game: gameForMetrics })
            const nextResult = {
              ...(gameForMetrics.result && typeof gameForMetrics.result === 'object'
                ? gameForMetrics.result
                : {}),
              teamsPlaces: built.teamsPlaces,
              computed: built.computed,
            }

            updatedGame = await Games.findByIdAndUpdate(
              id,
              { result: nextResult },
              { returnDocument: 'after', runValidators: true },
            )

            if (shouldUpdateParticipantsMetrics) {
              const finalGameForMetrics = updatedGame?.toObject ? updatedGame.toObject() : updatedGame

              await updateParticipantsClosedStats({
                db,
                game: finalGameForMetrics,
              })
              await updateParticipantsRatings({
                db,
                game: finalGameForMetrics,
                updateAllEntities: true,
              })
            }
          } catch (metricsError) {
            console.error('Failed to update participants metrics on game close', metricsError)
          }
        }

        const finalUpdatedGame =
          updatedGame?.toObject ? updatedGame.toObject() : updatedGame
        const afterHistoryState = await fetchGameHistoryState({
          db,
          gameId: String(id),
          game: finalUpdatedGame,
        })
        const historyActionType =
          previousStatus !== nextStatusNormalized
            ? 'game_status_changed'
            : 'game_updated'

        await recordGameHistoryEntry({
          db,
          gameId: String(id),
          location,
          actionType: historyActionType,
          entityScope: 'game',
          actor: buildHistoryActorFromSession(req.session),
          beforeState: beforeHistoryState,
          afterState: afterHistoryState,
          snapshot: buildGameHistorySnapshot(afterHistoryState),
          context:
            previousStatus !== nextStatusNormalized
              ? {
                  summary: `Статус игры изменён: ${previousStatus || 'unknown'} -> ${nextStatusNormalized || 'unknown'}`,
                  ...(shouldReset
                    ? {
                        prequelResetMode:
                          prequelResetMeta?.prequelResetMode || 'clear',
                      }
                    : {}),
                }
              : {
                  summary: 'Параметры игры обновлены',
                },
        })

        return res.status(200).json({ success: true, data: updatedGame })
      } catch (error) {
        console.error('Failed to update game', {
          error,
          gameId: id,
          location,
          updateKeys: Object.keys(updatePayload || {}),
          hasTasks: Array.isArray(updatePayload?.tasks),
          tasksCount: Array.isArray(updatePayload?.tasks)
            ? updatePayload.tasks.length
            : 0,
          hasDescriptionRich:
            typeof updatePayload?.descriptionRich === 'string' &&
            updatePayload.descriptionRich.trim().length > 0,
        })

        const errorName = typeof error?.name === 'string' ? error.name : ''
        const errorMessage =
          typeof error?.message === 'string' && error.message.trim()
            ? error.message.trim()
            : 'Не удалось обновить игру'
        const isValidationError =
          errorName === 'ValidationError' ||
          errorName === 'CastError' ||
          errorName === 'StrictModeError'

        if (isValidationError) {
          return res.status(400).json({
            success: false,
            error: errorMessage,
          })
        }

        const isDevEnv = process.env.NODE_ENV !== 'production'
        return res.status(500).json({
          success: false,
          error: isDevEnv ? `Не удалось обновить игру: ${errorMessage}` : 'Не удалось обновить игру',
        })
      }
    },
  })

export async function GET(request, { params }) {
  return execute(request, params)
}
export async function POST(request, { params }) {
  return execute(request, params)
}
export async function PUT(request, { params }) {
  return execute(request, params)
}
export async function PATCH(request, { params }) {
  return execute(request, params)
}
export async function DELETE(request, { params }) {
  return execute(request, params)
}
