import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'
import getGame from 'telegram/func/getGame'
import sendMessage from 'telegram/sendMessage'
import { getGameValidationErrors } from '@helpers/isGameHaveErrors'
import buildGameStartProgressUpdate from '@server/buildGameStartProgressUpdate'
import {
  isValidTaskSequence,
  prepareTaskDistributionForStart,
} from '@helpers/taskDistribution'
import { buildInitialStoryProgress } from '@server/storyEngine'
import applyPrequelStoryEffects from '@server/applyPrequelStoryEffects'
import {
  getGamePrequels,
  getGameTeamPrequelProgresses,
} from '@helpers/normalizePrequel'
import { isIndividualGameStart } from '@helpers/gameRegistration'
import withGameTeamsLocked from './withGameTeamsLocked.js'

const runInBackground = (label, job) => {
  Promise.resolve()
    .then(job)
    .catch((error) => {
      console.error(`[background] ${label} failed`, error)
    })
}

// Ошибки распределения называют команду по имени, поэтому в документы GamesTeams
// подмешивается название команды из Teams (в самой регистрации его нет).
const withDistributionTeamNames = async (db, gameTeams) => {
  const teams = Array.isArray(gameTeams) ? gameTeams : []
  const teamIds = teams.map((team) => team.teamId).filter(Boolean)
  if (teams.length === 0 || teamIds.length === 0) return teams

  const teamDocs = await db
    .model('Teams')
    .find({ _id: { $in: teamIds } })
    .select({ name: 1 })
    .lean()
  const names = new Map(teamDocs.map((doc) => [String(doc._id), doc.name]))

  return teams.map((team) => ({
    ...(typeof team.toObject === 'function' ? team.toObject() : team),
    name: names.get(String(team.teamId)) || team.name,
  }))
}

const gameStart = async ({ telegramId: _telegramId, jsonCommand, location, db }) => {
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  let game = await getGame(jsonCommand.gameId, db)
  if (game.success === false) return game

  if (!jsonCommand.confirm) {
    return {
      success: true,
      message: `Подтвердите запуск игры ${formatGameName(game)}`,
      buttons: [
        {
          text: '\u{2705} ЗАПУСТИТЬ ИГРУ',
          c: { confirm: true },
        },
        {
          text: '\u{1F6AB} Отмена',
          c: { c: 'editGameGeneral', gameId: jsonCommand.gameId },
        },
      ],
    }
  }

  const validationErrors = getGameValidationErrors(game)
  if (validationErrors.length > 0) {
    return {
      success: false,
      error: 'Игра не прошла проверку',
      errors: validationErrors,
      message: `Запуск игры невозможен. Обнаружены ошибки:\n- ${validationErrors.join('\n- ')}`,
    }
  }

  const prepared = await withGameTeamsLocked({ db, gameId: jsonCommand.gameId }, async ({
    game: currentGame, teams, Games, teamModel, assertHeld,
  }) => {
    game = currentGame
    if (game.status === 'started') return { alreadyStarted: true, message: 'Игра уже запущена.' }
    if (game.status !== 'active') return { success: false, message: 'Запустить можно только ожидающую игру.' }
    const errors = getGameValidationErrors(game, teams)
    if (errors.length) return { success: false, errors, message: errors.join('\n') }
    const startedAt = new Date()
    const gameTasksCount = Array.isArray(game.tasks) ? game.tasks.length : 0
    const isIndividualStart = isIndividualGameStart(game)
    // Пустые маршруты случайного распределения создаются здесь, до статуса started.
    // Повреждённые и несовместимые с шаблоном блокируют запуск без каких-либо записей.
    const {
      updates: taskDistributionUpdates,
      errors: taskDistributionErrors,
    } = prepareTaskDistributionForStart(
      game,
      await withDistributionTeamNames(db, teams),
    )
    if (taskDistributionErrors.length > 0) {
      return {
        success: false,
        errors: taskDistributionErrors,
        message: taskDistributionErrors.join('\n'),
      }
    }
    const routesGeneratedAt = new Date()
    for (const update of taskDistributionUpdates) {
      const savedTeam = await teamModel(update.id).findByIdAndUpdate(
        update.id,
        {
          $set: {
            taskSequence: update.taskSequence,
            taskSequenceSource: update.taskSequenceSource,
            taskSequenceGeneratedAt: routesGeneratedAt,
          },
        },
        { new: true },
      )
      if (!savedTeam || !isValidTaskSequence(savedTeam.taskSequence, gameTasksCount)) {
        throw new Error('Не удалось сохранить маршрут команды перед стартом')
      }
      const savedTeamIndex = teams.findIndex(
        (team) => String(team._id) === String(update.id),
      )
      if (savedTeamIndex >= 0) teams[savedTeamIndex] = savedTeam
    }
    await assertHeld()
    // До окончания подготовки игра остаётся active: частичный сбой не запускает
    // часть команд. Повторная попытка безопасно повторит подготовку.
    for (const team of teams) {
      let storyProgress = null
      if (game.type === 'story' && !isIndividualStart) {
        const baseProgress = buildInitialStoryProgress(game, {
          actor: 'system',
          now: startedAt,
        })
        const prequels = getGamePrequels(game)
        const prequelEffects = getGameTeamPrequelProgresses(team, prequels)
          .flatMap((item) => item.appliedStoryEffects)
        storyProgress = applyPrequelStoryEffects({
          game,
          progress: baseProgress,
          effects: prequelEffects,
          actor: 'system',
        }).progress
      }

      await teamModel(team._id).findByIdAndUpdate(
        team._id,
        buildGameStartProgressUpdate({
          gameTasksCount,
          taskSequence: game.type === 'story' ? [] : team.taskSequence,
          startedAt,
          startImmediately: !isIndividualStart,
          timeAddings: team.timeAddings,
          storyProgress,
        }),
      )
    }
    await assertHeld()
    await Games.findByIdAndUpdate(game._id, { status: 'started', dateStartFact: startedAt })
    return { teams, isIndividualStart }
  })
  if (prepared.success === false || prepared.alreadyStarted) return prepared
  const gameTeams = prepared.teams
  const teamsIds = gameTeams.map((team) => team.teamId)
  const isIndividualStart = prepared.isIndividualStart

  if (!isIndividualStart) {
    // const teams = await db.model('Teams').find({
    //   _id: { $in: teamsIds },
    // })

    const teamsUsers = await db.model('TeamsUsers').find({
      teamId: { $in: teamsIds },
    })

    // // Получаем telegramId всчех участников игры
    // const allUsersTelegramIds = teamsUsers.map(
    //   (teamUser) => teamUser.userTelegramId
    // )

    // let timerId = setTimeout(() => console.log('!'), 1000)
    // console.log('timerId :>> ', timerId)

    const gameName =
      typeof game?.name === 'string' && game.name.trim()
        ? game.name.trim()
        : 'Без названия'
    const gameStartedMessage = [
      'Игра началась!',
      `Название игры: ${gameName}`,
      '',
      'Перейдите на сайт и зайдите в игру:',
      'https://actquest.ru/cabinet/games-upcoming',
    ].join('\n')

    const telegramRecipients = new Set()

    await Promise.all(
      teamsIds.map(async (teamId) => {
        const gameTeam = gameTeams.find(
          (gameTeam) => gameTeam.teamId === teamId
        )
        const usersTelegramIdsOfTeam = teamsUsers
          .filter((teamUser) => teamUser.teamId === teamId)
          .map((teamUser) => Number(teamUser?.userTelegramId))
          .filter((telegramId) => Number.isFinite(telegramId))

        await db.model('LastCommands').updateMany(
          {
            userTelegramId: { $in: usersTelegramIdsOfTeam },
          },
          {
            command: { c: 'gameProcess', gameTeamId: String(gameTeam._id) },
            // prevCommand: prevCommand?.command,
            // messageId,
          },
          { upsert: true }
        )

        usersTelegramIdsOfTeam.forEach((telegramId) => {
          telegramRecipients.add(telegramId)
        })
      })
    )

    if (telegramRecipients.size > 0) {
      const recipients = Array.from(telegramRecipients)
      runInBackground('game start telegram notifications', async () => {
        await Promise.allSettled(
          recipients.map((telegramId) =>
            sendMessage({
              chat_id: telegramId,
              text: gameStartedMessage,
              location,
            }),
          ),
        )
      })
    }

    return {
      message: `Игра ${formatGameName(
        game
      )} ЗАПУЩЕНА.\n\n\u{26A0} Все игроки оповещены!`,
      nextCommand: { c: 'editGameGeneral', gameId: jsonCommand.gameId },
    }
  } else {
    return {
      message: `Игра ${formatGameName(
        game
      )} ЗАПУЩЕНА.\n\n\u{26A0} Для начала игры игрокам нужно в списке игр выбрать игру и нажать ЗАЙТИ В ИГРУ!`,
      nextCommand: { c: 'editGameGeneral', gameId: jsonCommand.gameId },
    }
  }
}

export default gameStart
