import CRUD from '@server/CRUD'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import buildGameResultSnapshots from '@server/buildGameResultSnapshots'
import buildGameResultComputed from '@server/buildGameResultComputed'
import updateParticipantsClosedStats from '@server/updateParticipantsClosedStats'
import updateParticipantsRatings from '@server/updateParticipantsRatings'
import sanitize from '@helpers/sanitize'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '5mb',
    },
  },
}

const buildResetPayload = () => ({
  activeNum: 0,
  findedCodes: [],
  wrongCodes: [],
  findedPenaltyCodes: [],
  findedBonusCodes: [],
  startTime: [],
  endTime: [],
  photos: [],
  forcedClues: [],
  timeAddings: [],
  timerId: null,
})

const hasResultSnapshots = (result) =>
  Array.isArray(result?.teams) &&
  result.teams.length > 0 &&
  Array.isArray(result?.gameTeams) &&
  result.gameTeams.length > 0 &&
  Array.isArray(result?.teamsUsers) &&
  result.teamsUsers.length > 0

const sanitizeTaskMedia = (media = []) =>
  (Array.isArray(media) ? media : [])
    .map((item, index) => ({
      id:
        typeof item?.id === 'string' && item.id.trim().length > 0
          ? item.id.trim()
          : `task-media-${index}`,
      type: item?.type === 'audio' ? 'audio' : 'image',
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
    taskRich:
      typeof task?.taskRich === 'string' && task.taskRich.trim().length > 0
        ? sanitize(task.taskRich)
        : '',
    clues: (Array.isArray(task?.clues) ? task.clues : []).map((clue) => {
      const clueRichRaw =
        typeof clue?.clueRich === 'string' ? clue.clueRich.trim() : ''
      const clueRich = clueRichRaw ? sanitize(clueRichRaw) : ''
      const cluePlainRaw = typeof clue?.clue === 'string' ? clue.clue : ''
      const cluePlain = cluePlainRaw.trim() || stripHtmlToPlainText(clueRich)

      return {
        ...clue,
        clue: cluePlain,
        clueRich,
      }
    }),
    taskMedia: sanitizeTaskMedia(task?.taskMedia),
  }))

const sanitizeGameDescriptionContent = (gameData = {}) => {
  const descriptionRichRaw =
    typeof gameData?.descriptionRich === 'string'
      ? gameData.descriptionRich.trim()
      : ''
  const descriptionRich = descriptionRichRaw ? sanitize(descriptionRichRaw) : ''
  const descriptionPlainRaw =
    typeof gameData?.description === 'string' ? gameData.description : ''
  const descriptionPlain =
    descriptionPlainRaw.trim() || stripHtmlToPlainText(descriptionRich)

  return {
    description: descriptionPlain,
    descriptionRich,
    descriptionMedia: sanitizeTaskMedia(gameData?.descriptionMedia),
  }
}

export default async function handler(req, res) {
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
      nextStatusNormalized === 'closed' &&
      previousStatus !== 'closed'

    const updateData = { ...updatePayload, status: resolvedStatus }

    if (Array.isArray(updateData.tasks)) {
      updateData.tasks = sanitizeTasksRichContent(updateData.tasks)
    }

    const hasDescriptionContentKeys =
      Object.prototype.hasOwnProperty.call(updateData, 'description') ||
      Object.prototype.hasOwnProperty.call(updateData, 'descriptionRich') ||
      Object.prototype.hasOwnProperty.call(updateData, 'descriptionMedia')
    if (hasDescriptionContentKeys) {
      Object.assign(updateData, sanitizeGameDescriptionContent(updateData))
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
      new: true,
      runValidators: true,
    })

    if (!updatedGame) {
      return res
        .status(400)
        .json({ success: false, error: 'Не удалось обновить игру' })
    }

    if (shouldReset) {
      const GamesTeams = db.model('GamesTeams')
      await GamesTeams.updateMany({ gameId: id }, { $set: buildResetPayload() })
    }

    if (shouldUpdateParticipantsMetrics) {
      try {
        const gameForMetrics = updatedGame?.toObject
          ? updatedGame.toObject()
          : updatedGame
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
          { new: true, runValidators: true }
        )

        const finalGameForMetrics = updatedGame?.toObject
          ? updatedGame.toObject()
          : updatedGame

        await updateParticipantsClosedStats({
          db,
          game: finalGameForMetrics,
        })
        await updateParticipantsRatings({
          db,
          game: finalGameForMetrics,
        })
      } catch (metricsError) {
        console.error('Failed to update participants metrics on game close', metricsError)
      }
    }

    return res.status(200).json({ success: true, data: updatedGame })
  } catch (error) {
    console.error('Failed to update game', error)

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
    return res
      .status(500)
      .json({
        success: false,
        error: isDevEnv ? `Не удалось обновить игру: ${errorMessage}` : 'Не удалось обновить игру',
      })
  }
}
