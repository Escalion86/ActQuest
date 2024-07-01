import getNoun from '@helpers/getNoun'
import TeamsUsers from '@models/TeamsUsers'
import dbConnect from '@utils/dbConnect'
import mongoose from 'mongoose'
import { MAX_TEAMS } from 'telegram/constants'
import getGame from 'telegram/func/getGame'
import getTeam from 'telegram/func/getTeam'

const joinToGameWithCode = async ({ telegramId, jsonCommand }) => {
  await dbConnect()
  // const teamsUser = await TeamsUsers.find({ userTelegramId: telegramId })

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

  if (!mongoose.Types.ObjectId.isValid(jsonCommand.message)) {
    return {
      message: 'Введен не верный код игры.\nПроверьте код и повторите попытку',
      buttons: [{ c: 'menuGames', text: '\u{2B05} Назад' }],
    }
  }

  const game = await getGame(jsonCommand.message)
  if (game.success === false)
    return {
      message: 'Игра не найдена.\nПроверьте код и повторите попытку',
      nextCommand: `menuGames`,
    }

  return {
    // message: 'Игра не найдена.\nПроверьте код и повторите попытку',
    nextCommand: { c: `joinGame`, gameId: jsonCommand.message },
  }

  // const teamUser = await TeamsUsers.findOne({
  //   teamId: String(team._id),
  //   userTelegramId: telegramId,
  // })
  // if (teamUser)
  //   return {
  //     message: 'Вы уже состоите в этой команде',
  //     nextCommand: `menuTeams`,
  //   }

  // await TeamsUsers.create({
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
