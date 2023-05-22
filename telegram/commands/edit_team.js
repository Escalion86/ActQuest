import Teams from '@models/Teams'
import TeamsUsers from '@models/TeamsUsers'
import dbConnect from '@utils/dbConnect'
import getTeam from 'telegram/func/getTeam'

const edit_team = async ({ telegramId, message, props }) => {
  if (!props?.teamId) {
    await dbConnect()
    const teamsUser = await TeamsUsers.find({
      userTelegramId: telegramId,
      // role: 'capitan',
    })
    if (!teamsUser || teamsUser.length === 0) {
      return {
        message: 'Ошибка не найдено записи в команде',
        nextCommand: `/menu_teams`,
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
          command: `edit_team/teamId=${team._id}`,
        })),
        { command: 'menu_teams', text: '\u{2B05} Назад' },
      ],
    }
  }

  await dbConnect()
  const teamsUser = await TeamsUsers.findOne({
    userTelegramId: telegramId,
    teamId: props.teamId,
  })

  if (!teamsUser) {
    return {
      message: 'Ошибка вы не состоите в команде',
      nextCommand: `/menu_teams`,
    }
  }

  const isCapitan = teamsUser.role === 'capitan'

  const team = await getTeam(props.teamId)

  const buttons = isCapitan
    ? [
        {
          command: `set_team_name/teamId=${props.teamId}`,
          text: '\u{270F} Изменить название',
        },
        {
          command: `set_team_description/teamId=${props.teamId}`,
          text: '\u{270F} Изменить описание',
        },
        {
          command: `team_users/teamId=${props.teamId}`,
          text: '\u{1F465} Посмотреть состав команды',
        },
        {
          command: `link_to_join_team/teamId=${props.teamId}`,
          text: '\u{1F517} Пригласить в команду',
        },
        {
          command: `delete_team/teamId=${props.teamId}`,
          text: '\u{1F4A3} Удалить команду',
        },
        { command: 'joined_teams', text: '\u{2B05} Назад' },
      ]
    : [
        {
          command: `team_users/teamId=${props.teamId}`,
          text: '\u{1F465} Посмотреть состав команды',
        },
        { command: 'joined_teams', text: '\u{2B05} Назад' },
      ]

  return {
    message: `${isCapitan ? 'Редактирование команды' : 'Команда'} "${
      team?.name
    }".${team?.description ? ` Описание: "${team?.description}"` : ''}`,
    upper_command: 'menu_teams',
    buttons,
  }
}

export default edit_team
