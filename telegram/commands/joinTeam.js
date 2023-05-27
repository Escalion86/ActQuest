import TeamsUsers from '@models/TeamsUsers'
import dbConnect from '@utils/dbConnect'
import getTeam from 'telegram/func/getTeam'

const joinTeam = async ({ telegramId, jsonCommand }) => {
  if (!jsonCommand.message) {
    return {
      message: 'Введите код команды',
      buttons: [{ cmd: 'menuTeams', text: '\u{2B05} Назад' }],
    }
  }
  await dbConnect()
  const team = await getTeam(jsonCommand.message)
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
