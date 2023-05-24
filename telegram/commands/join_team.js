import TeamsUsers from '@models/TeamsUsers'
import dbConnect from '@utils/dbConnect'
import getTeam from 'telegram/func/getTeam'

const join_team = async ({ telegramId, jsonCommand }) => {
  if (!jsonCommand.message) {
    return {
      message: 'Введите код команды',
      upper_command: 'menu_teams',
      buttons: [{ cmd: 'menu_teams', text: '\u{2B05} Назад' }],
    }
  }
  await dbConnect()
  const team = await getTeam(jsonCommand.message)
  if (!team)
    return {
      message: 'Код не верен.',
      nextCommand: `menu_teams`,
    }

  const teamUser = await TeamsUsers.findOne({
    teamId: String(team._id),
    userTelegramId: telegramId,
  })
  if (teamUser)
    return {
      message: 'Вы уже состоите в этой команде',
      nextCommand: `menu_teams`,
    }

  await TeamsUsers.create({
    teamId: String(team._id),
    userTelegramId: telegramId,
  })
  return {
    message: `Вы присоединились к команде "${team?.name}".${
      team?.description ? ` Описание команды: "${team?.description}"` : ''
    }`,
    nextCommand: `menu_teams`,
  }
}

export default join_team
