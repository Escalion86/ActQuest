import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'
import getGame from 'telegram/func/getGame'
import sendMessage from 'telegram/sendMessage'
import createTaskProgressArrays from '@helpers/createTaskProgressArrays'
import removeCluePenalties from '@helpers/removeCluePenalties'
import { getGameValidationErrors } from '@helpers/isGameHaveErrors'

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

  await db.model('Games').findByIdAndUpdate(jsonCommand.gameId, {
    status: 'started',
    dateStartFact: new Date(),
  })

  if (!game.individualStart) {
    // Получаем список команд
    const gameTeams = await db.model('GamesTeams').find({
      gameId: jsonCommand.gameId,
    })

    const teamsIds = gameTeams.map((gameTeam) => gameTeam.teamId)

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
    const gameTasksCount = game.tasks.length

    await Promise.all(
      gameTeams.map(async (team) => {
        const startTime = new Array(gameTasksCount).fill(null)
        startTime[0] = new Date()
        const endTime = new Array(gameTasksCount).fill(null)
        const {
          findedCodes,
          wrongCodes,
          findedPenaltyCodes,
          findedBonusCodes,
          photos,
        } = createTaskProgressArrays(gameTasksCount)

        const filteredAddings = removeCluePenalties(team.timeAddings)

        await db.model('GamesTeams').findByIdAndUpdate(team._id, {
          startTime,
          endTime,
          activeNum: 0,
          findedCodes,
          wrongCodes,
          findedPenaltyCodes,
          findedBonusCodes,
          photos,
          timeAddings: filteredAddings,
          forcedClues: new Array(gameTasksCount).fill(0),
        })
      })
    )

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
