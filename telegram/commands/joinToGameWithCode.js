import mongoose from 'mongoose'
import getGame from 'telegram/func/getGame'

const joinToGameWithCode = async ({
  telegramId,
  jsonCommand,
  location,
  db,
}) => {
  // const teamsUser = await db.model('TeamsUsers').find({ userTelegramId: telegramId })

  // if (teamsUser.length >= MAX_TEAMS) {
  //   return {
  //     message: `Нельзя состоять более чем в ${getNoun(
  //       MAX_TEAMS,
  //       'команде',
  //       'командах',
  //       'командах'
  //     )}. Для присоединения к команде сначала покиньте одну из команд`,
  //     nextCommand: `joinedTeams`,
  //   }
  // }

  if (!jsonCommand.message) {
    return {
      message: 'Введите код игры',
      buttons: [{ c: 'menuGames', text: '\u{2B05} Назад' }],
    }
  }

  if (!mongoose.Types.ObjectId.isValid(jsonCommand.message.trim())) {
    return {
      message: 'Введен не верный код игры.\nПроверьте код и повторите попытку',
      buttons: [{ c: 'menuGames', text: '\u{2B05} Назад' }],
    }
  }

  const game = await getGame(jsonCommand.message.trim(), db)
  if (game.success === false)
    return {
      message: 'Игра не найдена.\nПроверьте код и повторите попытку',
      nextCommand: `menuGames`,
    }

  return {
    // message: 'Игра не найдена.\nПроверьте код и повторите попытку',
    nextCommand: { c: `joinGame`, gameId: jsonCommand.message },
  }

  // const teamUser = await db.model('TeamsUsers').findOne({
  //   teamId: String(team._id),
  //   userTelegramId: telegramId,
  // })
  // if (teamUser)
  //   return {
  //     message: 'Вы уже состоите в этой команде',
  //     nextCommand: `menuTeams`,
  //   }

  // await db.model('TeamsUsers').create({
  //   teamId: String(team._id),
  //   userTelegramId: telegramId,
  // })
  return {
    message: `Вы присоединились к команде "${team?.name}".${
      team?.description ? ` Описание команды: "${team?.description}"` : ''
    }`,
    nextCommand: `menuTeams`,
  }
}

export default joinToGameWithCode
