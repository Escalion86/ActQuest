import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'
import getGame from 'telegram/func/getGame'
import sendMessage from 'telegram/sendMessage'
import mainMenu from './mainMenu'
import keyboardFormer from 'telegram/func/keyboardFormer'
import mainMenuButton from './menuItems/mainMenuButton'

const gameStop = async ({ telegramId, jsonCommand, location, db }) => {
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand.gameId, db)
  if (game.success === false) return game

  if (!jsonCommand.confirm) {
    return {
      success: true,
      message: `Подтвердите остановку игры ${formatGameName(game)}`,
      buttons: [
        {
          text: '\u{26D4} СТОП ИГРА',
          c: { confirm: true },
        },
        {
          text: '\u{1F6AB} Отмена',
          c: { c: 'editGameGeneral', gameId: jsonCommand.gameId },
        },
      ],
    }
  }

  await db.model('Games').findByIdAndUpdate(jsonCommand.gameId, {
    status: 'finished',
    dateEndFact: new Date(),
  })
  // Получаем список команд участвующих в игре
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
  // Получаем telegramId всчех участников игры
  const allUsersTelegramIds = teamsUsers.map(
    (teamUser) => teamUser.userTelegramId
  )

  await db.model('LastCommands').updateMany(
    {
      userTelegramId: { $in: allUsersTelegramIds },
    },
    {
      command: { c: 'mainMenu' },
      // prevCommand: prevCommand?.command,
      // messageId,
    },
    { upsert: true }
  )

  const keyboard = keyboardFormer([mainMenuButton])

  await Promise.all(
    allUsersTelegramIds.map(async (telegramId) => {
      const mainMenuButtons = await mainMenu({ telegramId }).buttons
      await sendMessage({
        chat_id: telegramId,
        text: `\u{26D4}\u{26D4}\u{26D4} СТОП ИГРА \u{26D4}\u{26D4}\u{26D4}\n\n\nКоды больше не принимаются. ${
          game.finishingPlace
            ? `Просим все команды прибыть на точку сбора: ${game.finishingPlace}`
            : ''
        }`,
        keyboard,
        location,
      })
    })
  )
  // })
  // )

  return {
    message: `СТОП ИГРА!!\n\nИгра ${formatGameName(
      game
    )} ОСТАНОВЛЕНА.\n\n\u{26A0} Все игроки оповещены!`,
    nextCommand: { c: 'editGameGeneral', gameId: jsonCommand.gameId },
  }
}

export default gameStop
