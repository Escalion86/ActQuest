import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'
import getGame from 'telegram/func/getGame'
import sendMessage from 'telegram/sendMessage'
import { getGameValidationErrors } from '@helpers/isGameHaveErrors'
import buildGameStartProgressUpdate from '@server/buildGameStartProgressUpdate'
import { getTaskDistributionStartErrors } from '@helpers/taskDistribution'
import { buildInitialStoryProgress } from '@server/storyEngine'
import applyPrequelStoryEffects from '@server/applyPrequelStoryEffects'
import {
  getGamePrequels,
  getGameTeamPrequelProgresses,
} from '@helpers/normalizePrequel'
import { isIndividualGameStart } from '@helpers/gameRegistration'

const runInBackground = (label, job) => {
  Promise.resolve()
    .then(job)
    .catch((error) => {
      console.error(`[background] ${label} failed`, error)
    })
}

const gameStart = async ({ telegramId: _telegramId, jsonCommand, location, db }) => {
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand.gameId, db)
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

  // Получаем список команд
  const gameTeams = await db.model('GamesTeams').find({
    gameId: jsonCommand.gameId,
  })

  const taskDistributionErrors =
    game.type === 'story' ? [] : getTaskDistributionStartErrors(game, gameTeams)
  if (taskDistributionErrors.length > 0) {
    return {
      success: false,
      error: 'Задания не распределены',
      errors: taskDistributionErrors,
      message: `Запуск игры невозможен. Обнаружены ошибки:\n- ${taskDistributionErrors.join('\n- ')}`,
    }
  }

  const startedAt = new Date()
  await db.model('Games').findByIdAndUpdate(jsonCommand.gameId, {
    status: 'started',
    dateStartFact: startedAt,
  })

  const teamsIds = gameTeams.map((gameTeam) => gameTeam.teamId)
  const gameTasksCount = Array.isArray(game.tasks) ? game.tasks.length : 0
  const isIndividualStart = isIndividualGameStart(game)

  const resetResults = await Promise.all(
    gameTeams.map((team) => {
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

      return db.model('GamesTeams').findByIdAndUpdate(
        team._id,
        buildGameStartProgressUpdate({
          gameTasksCount,
          startImmediately: !isIndividualStart,
          timeAddings: team.timeAddings,
          storyProgress,
        }),
      )
    }),
  )
  console.info('[game-start] reset team progress', {
    gameId: String(jsonCommand.gameId),
    teamsCount: gameTeams.length,
    resetCount: resetResults.filter(Boolean).length,
    individualStart: isIndividualStart,
  })

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
