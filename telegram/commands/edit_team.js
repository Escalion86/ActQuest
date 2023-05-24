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

  console.log('teamsUser :>> ', teamsUser)

  if (!teamsUser) {
    return {
      message: 'Ошибка вы не состоите в команде',
      nextCommand: `menu_teams`,
    }
  }

  const isCapitan = teamsUser.role === 'capitan'

  const team = await getTeam(jsonCommand.teamId)

  console.log('object :>> ', object)

  const buttons = isCapitan
    ? [
        {
          command: { command: 'set_team_name', teamId: jsonCommand.teamId },
          //`set_team_name/teamId=${jsonCommand.teamId}`,
          text: '\u{270F} Изменить название',
        },
        {
          command: {
            command: 'set_team_description',
            teamId: jsonCommand.teamId,
          },
          //`set_team_description/teamId=${jsonCommand.teamId}`,
          text: '\u{270F} Изменить описание',
        },
        {
          command: { command: 'team_users', teamId: jsonCommand.teamId },
          //`team_users/teamId=${jsonCommand.teamId}`,
          text: '\u{1F465} Посмотреть состав команды',
        },
        {
          command: { command: 'link_to_join_team', teamId: jsonCommand.teamId },
          //`link_to_join_team/teamId=${jsonCommand.teamId}`,
          text: '\u{1F517} Пригласить в команду',
        },
        {
          command: { command: 'delete_team', teamId: jsonCommand.teamId },
          //`delete_team/teamId=${jsonCommand.teamId}`,
          text: '\u{1F4A3} Удалить команду',
        },
        { command: 'joined_teams', text: '\u{2B05} Назад' },
      ]
    : [
        {
          command: { command: 'team_users', teamId: jsonCommand.teamId },
          //`team_users/teamId=${jsonCommand.teamId}`,
          text: '\u{1F465} Посмотреть состав команды',
        },
        { command: 'joined_teams', text: '\u{2B05} Назад' },
      ]

  console.log('buttons :>> ', buttons)

  return {
    message: `${isCapitan ? 'Редактирование команды' : 'Команда'} "${
      team?.name
    }".${team?.description ? `\nОписание: "${team?.description}"` : ''}`,
    upper_command: 'menu_teams',
    buttons,
  }
}

export default edit_team
