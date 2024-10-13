import getNoun from '@helpers/getNoun'
import TeamsUsers from '@models/TeamsUsers'
import mongoose from 'mongoose'

import { MAX_TEAMS } from 'telegram/constants'
import getTeam from 'telegram/func/getTeam'

const joinTeam = async ({ telegramId, jsonCommand }) => {
  const teamsUser = await TeamsUsers.find({ userTelegramId: telegramId })

  if (teamsUser.length >= MAX_TEAMS) {
    return {
      message: `Нельзя состоять более чем в ${getNoun(
        MAX_TEAMS,
        'команде',
        'командах',
        'командах'
      )}. Для присоединения к команде сначала покиньте одну из команд`,
      nextCommand: `joinedTeams`,
    }
  }

  if (!jsonCommand.message) {
    return {
      message: 'Введите код команды',
      buttons: [{ c: 'menuTeams', text: '\u{2B05} Назад' }],
    }
  }

  if (!mongoose.Types.ObjectId.isValid(jsonCommand.message.trim())) {
    return {
      message:
        'Введен не верный код команды.\nПроверьте код и повторите попытку',
      buttons: [{ c: 'menuTeams', text: '\u{2B05} Назад' }],
    }
  }

  const team = await getTeam(jsonCommand.message.trim())
  if (team.success === false) return team

  const teamUser = await TeamsUsers.findOne({
    teamId: String(team._id),
    userTelegramId: telegramId,
  })
  if (teamUser)
    return {
      message: 'Вы уже состоите в этой команде',
      nextCommand: `menuTeams`,
    }

  await TeamsUsers.create({
    teamId: String(team._id),
    userTelegramId: telegramId,
  })
  return {
    message: `Вы присоединились к команде "${team?.name}".${
      team?.description ? ` Описание команды: "${team?.description}"` : ''
    }`,
    nextCommand: `menuTeams`,
  }
}

export default joinTeam
