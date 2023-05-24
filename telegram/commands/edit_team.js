import Teams from '@models/Teams'
import TeamsUsers from '@models/TeamsUsers'
import dbConnect from '@utils/dbConnect'
import getTeam from 'telegram/func/getTeam'

const edit_team = async ({ telegramId, jsonCommand }) => {
  console.log('jsonCommand :>> ', jsonCommand)
  console.log('!!edit_team')
  if (!jsonCommand?.teamId) {
    await dbConnect()
    const teamsUser = await TeamsUsers.find({
      userTelegramId: telegramId,
      // role: 'capitan',
    })
    if (!teamsUser || teamsUser.length === 0) {
      return {
        message: 'Ошибка не найдено записи в команде',
        nextCommand: `menu_teams`,
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
      upper_command: 'menu_teams',
      buttons: [
        ...teams.map((team) => ({
          text: `"${team.name}"`,
          command: { command: 'edit_team', teamId: team._id },
          // `edit_team/teamId=${team._id}`,
        })),
        { command: 'menu_teams', text: '\u{2B05} Назад' },
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
      nextCommand: `menu_teams`,
    }
  }

  const isCapitan = teamsUser.role === 'capitan'

  const team = await getTeam(jsonCommand.teamId)

  const buttons = isCapitan
    ? [
        {
          cmd: { cmd: 'set_team_name', teamId: jsonCommand.teamId },
          //`set_team_name/teamId=${jsonCommand.teamId}`,
          text: '\u{270F} Изменить название',
        },
        {
          cmd: {
            cmd: 'set_team_desc',
            teamId: jsonCommand.teamId,
          },
          //`set_team_desc/teamId=${jsonCommand.teamId}`,
          text: '\u{270F} Изменить описание',
        },
        {
          cmd: { cmd: 'team_users', teamId: jsonCommand.teamId },
          //`team_users/teamId=${jsonCommand.teamId}`,
          text: '\u{1F465} Посмотреть состав команды',
        },
        {
          cmd: { cmd: 'link_to_join_team', teamId: jsonCommand.teamId },
          //`link_to_join_team/teamId=${jsonCommand.teamId}`,
          text: '\u{1F517} Пригласить в команду',
        },
        {
          cmd: { cmd: 'delete_team', teamId: jsonCommand.teamId },
          //`delete_team/teamId=${jsonCommand.teamId}`,
          text: '\u{1F4A3} Удалить команду',
        },
        { cmd: 'joined_teams', text: '\u{2B05} Назад' },
      ]
    : [
        {
          cmd: { cmd: 'team_users', teamId: jsonCommand.teamId },
          //`team_users/teamId=${jsonCommand.teamId}`,
          text: '\u{1F465} Посмотреть состав команды',
        },
        { cmd: 'joined_teams', text: '\u{2B05} Назад' },
      ]

  return {
    message: `${isCapitan ? 'Редактирование команды' : 'Команда'} "${
      team?.name
    }".${team?.description ? `\nОписание: "${team?.description}"` : ''}`,
    upper_command: 'menu_teams',
    buttons,
  }
}

export default edit_team
