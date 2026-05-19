import CRUD from '@server/CRUD'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import buildGameResultSnapshots from '@server/buildGameResultSnapshots'
import buildGameResultComputed from '@server/buildGameResultComputed'
import updateParticipantsClosedStats from '@server/updateParticipantsClosedStats'
import updateParticipantsRatings from '@server/updateParticipantsRatings'
import sanitize from '@helpers/sanitize'
import { runLocationLegacyHandler } from '@app/api/_lib/runLocationLegacyHandler'

const buildResetPayload = ({ clearTimeAddings = true } = {}) => ({
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
  timerId: null,
})

const hasResultSnapshots = (result) =>
  Array.isArray(result?.teams) &&
  result.teams.length > 0 &&
  Array.isArray(result?.gameTeams) &&
  result.gameTeams.length > 0 &&
  Array.isArray(result?.teamsUsers) &&
  result.teamsUsers.length > 0

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
              .select({ _id: 1, telegramId: 1 })
              .lean()

            if (!creatorDoc) {
              return res.status(400).json({
                success: false,
                error: 'Организатор игры не найден',
              })
            }

            updateData.creatorUserId = String(creatorDoc._id)
            updateData.creatorTelegramId = normalizeTelegramId(
              creatorDoc.telegramId,
            )
          }
        }

        if (shouldReset) {
          updateData.dateStartFact = null
          updateData.dateEndFact = null
          updateData.result = null
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
          const resetResult = await GamesTeams.updateMany(
            { gameId: id },
            { $set: buildResetPayload({ clearTimeAddings }) },
          )
          console.info('[game-restart] reset team progress', {
            gameId: String(id),
            matchedCount: resetResult?.matchedCount,
            modifiedCount: resetResult?.modifiedCount,
            clearTimeAddings,
          })
        }

        if (shouldUpdateParticipantsMetrics) {
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
          } catch (metricsError) {
            console.error('Failed to update participants metrics on game close', metricsError)
          }
        }

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
