import Teams from '@models/Teams'
import TeamsUsers from '@models/TeamsUsers'
import dbConnect from '@utils/dbConnect'
import getTeam from 'telegram/func/getTeam'

const editTeam = async ({ telegramId, jsonCommand }) => {
  if (!jsonCommand?.teamId) {
    await dbConnect()
    const teamsUser = await TeamsUsers.find({
      userTelegramId: telegramId,
      // role: 'capitan',
    })
    if (!teamsUser || teamsUser.length === 0) {
      return {
        message: 'Ошибка не найдено записи в команде',
        nextCommand: `menuTeams`,
      }
    }
    const teamsIds = teamsUser.map(
      (teamUser) =>
        // mongoose.Types.ObjectId(teamUser.teamId)
        teamUser.teamId
    )

    const teams = await Teams.find({
      _id: { $in: teamsIds },
    })

    return {
      message: 'Выберите команду для редактирования',
      buttonText: '\u{270F}  Редактирование команд',
      buttons: [
        ...teams.map((team) => ({
          text: `"${team.name}"`,
          cmd: { cmd: 'editTeam', teamId: team._id },
          // `editTeam/teamId=${team._id}`,
        })),
        { cmd: 'menuTeams', text: '\u{2B05} Назад' },
      ],
    }
  }

  await dbConnect()
  const teamsUser = await TeamsUsers.findOne({
    userTelegramId: telegramId,
    teamId: jsonCommand.teamId,
  })

  if (!teamsUser) {
    return {
      message: 'Ошибка вы не состоите в команде',
      nextCommand: `menuTeams`,
    }
  }

  const isCapitan = teamsUser.role === 'capitan'

  const team = await getTeam(jsonCommand.teamId)
  if (team.success === false) return team

  const buttons = [
    {
      cmd: { cmd: 'setTeamName', teamId: jsonCommand.teamId },
      //`setTeamName/teamId=${jsonCommand.teamId}`,
      hide: !isCapitan,
      text: '\u{270F} Изменить название',
    },
    {
      cmd: {
        cmd: 'setTeamDesc',
        teamId: jsonCommand.teamId,
      },
      hide: !isCapitan,
      text: '\u{270F} Изменить описание',
    },
    {
      cmd: { cmd: 'teamUsers', teamId: jsonCommand.teamId },
      text: '\u{1F465} Состав команды',
    },
    {
      cmd: { cmd: 'unjoinTeam', teamId: jsonCommand.teamId },
      text: '\u{1F465} Покинуть команду',
      hide: isCapitan,
    },
    {
      cmd: { cmd: 'linkToJoinTeam', teamId: jsonCommand.teamId },
      hide: !isCapitan,
      text: '\u{1F517} Пригласить в команду',
    },
    {
      cmd: { cmd: 'deleteTeam', teamId: jsonCommand.teamId },
      hide: !isCapitan,
      text: '\u{1F4A3} Удалить команду',
    },
    { cmd: 'joinedTeams', text: '\u{2B05} Назад' },
  ]

  return {
    message: `${isCapitan ? 'Редактирование команды' : 'Команда'} "${
      team?.name
    }".${team?.description ? `\nОписание: "${team?.description}"` : ''}`,
    buttons,
  }
}

export default editTeam
