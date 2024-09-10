import Games from '@models/Games'
import GamesTeams from '@models/GamesTeams'
import LastCommands from '@models/LastCommands'
// import Teams from '@models/Teams'
import TeamsUsers from '@models/TeamsUsers'
import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'
import getGame from 'telegram/func/getGame'
import keyboardFormer from 'telegram/func/keyboardFormer'
import taskText from 'telegram/func/taskText'
import sendMessage from 'telegram/sendMessage'

const gameStart = async ({ telegramId, jsonCommand, domen }) => {
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand.gameId)
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

  await Games.findByIdAndUpdate(jsonCommand.gameId, {
    status: 'started',
    dateStartFact: new Date(),
  })

  if (!game.individualStart) {
    // Получаем список команд
    const gameTeams = await GamesTeams.find({
      gameId: jsonCommand.gameId,
    })

    const teamsIds = gameTeams.map((gameTeam) => gameTeam.teamId)

    // const teams = await Teams.find({
    //   _id: { $in: teamsIds },
    // })

    const teamsUsers = await TeamsUsers.find({
      teamId: { $in: teamsIds },
    })

    // // Получаем telegramId всчех участников игры
    // const allUsersTelegramIds = teamsUsers.map(
    //   (teamUser) => teamUser.userTelegramId
    // )

    // let timerId = setTimeout(() => console.log('!'), 1000)
    // console.log('timerId :>> ', timerId)
    const gameTasksCount = game.tasks.length
    const startTime = new Array(gameTasksCount).fill(null)
    startTime[0] = new Date()
    const endTime = new Array(gameTasksCount).fill(null)
    const findedCodes = new Array(gameTasksCount).fill([])
    const wrongCodes = new Array(gameTasksCount).fill([])
    const findedPenaltyCodes = new Array(gameTasksCount).fill([])
    const findedBonusCodes = new Array(gameTasksCount).fill([])
    const photos = new Array(gameTasksCount).fill([])
    await GamesTeams.updateMany(
      {
        gameId: jsonCommand.gameId,
      },
      {
        startTime,
        endTime,
        activeNum: 0,
        findedCodes,
        wrongCodes,
        findedPenaltyCodes,
        findedBonusCodes,
        photos,
      }
    )

    const cluesDuration = game.cluesDuration ?? 1200

    await Promise.all(
      teamsIds.map(async (teamId) => {
        const gameTeam = gameTeams.find(
          (gameTeam) => gameTeam.teamId === teamId
        )
        const usersTelegramIdsOfTeam = teamsUsers
          .filter((teamUser) => teamUser.teamId === teamId)
          .map((teamUser) => teamUser.userTelegramId)

        const taskNum = gameTeam?.activeNum ?? 0

        await LastCommands.updateMany(
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

        const findedCodes = gameTeam?.findedCodes ?? []
        // const { task, codes, numCodesToCompliteTask } = game.tasks[taskNum]

        const keyboard = keyboardFormer([
          {
            c: { c: 'gameProcess', gameTeamId: String(gameTeam._id) },
            text: '\u{1F504} Обновить',
          },
        ])

        await Promise.all(
          usersTelegramIdsOfTeam.map(async (telegramId) => {
            await sendMessage({
              chat_id: telegramId,
              text: `\u{26A0}\u{26A0}\u{26A0} ИГРА НАЧАЛАСЬ \u{26A0}\u{26A0}\u{26A0}\n\n\n${taskText(
                { tasks: game.tasks, taskNum, findedCodes, cluesDuration }
              )}`,
              keyboard,
              images: game.tasks[taskNum].images,
              domen,
            })
          })
        )
      })
    )

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
