import getTeam from 'telegram/func/getTeam'

const editTeam = async ({ telegramId, jsonCommand, location, db }) => {
  const { b } = jsonCommand
  if (!jsonCommand?.teamId) {
    const teamsUser = await db.model('TeamsUsers').find({
      userTelegramId: telegramId,
      // role: 'capitan',
    })
    if (!teamsUser || teamsUser.length === 0) {
      return {
        message: 'Ошибка не найдено записи в команде',
        nextCommand: b ?? `menuTeams`,
      }
    }
    const teamsIds = teamsUser.map(
      (teamUser) =>
        // mongoose.Types.ObjectId(teamUser.teamId)
        teamUser.teamId
    )

    const teams = await db.model('Teams').find({
      _id: { $in: teamsIds },
    })

    return {
      message: 'Выберите команду для редактирования',
      buttonText: '\u{270F}  Редактирование команд',
      buttons: [
        ...teams.map((team) => ({
          text: `"${team.name}"`,
          c: { c: 'editTeam', teamId: team._id },
          // `editTeam/teamId=${team._id}`,
        })),
        { c: b ?? 'menuTeams', text: '\u{2B05} Назад' },
      ],
    }
  }

  const teamsUser = await db.model('TeamsUsers').findOne({
    userTelegramId: telegramId,
    teamId: jsonCommand.teamId,
  })

  if (!teamsUser) {
    return {
      message: 'Ошибка. Вы не состоите в команде',
      nextCommand: b ?? `menuTeams`,
    }
  }

  const isCapitan = teamsUser.role === 'capitan'

  const team = await getTeam(jsonCommand.teamId, db)
  if (team.success === false) return team

  const buttons = [
    {
      c: { c: 'setTeamName', teamId: jsonCommand.teamId },
      //`setTeamName/teamId=${jsonCommand.teamId}`,
      hide: !isCapitan,
      text: '\u{270F} Изменить название',
    },
    // {
    //   c: {
    //     c: 'setTeamDesc',
    //     teamId: jsonCommand.teamId,
    //   },
    //   hide: !isCapitan,
    //   text: '\u{270F} Изменить описание',
    // },
    {
      c: { c: 'transferCaptainRights', teamId: jsonCommand.teamId },
      text: '\u{1F91D} Передать права капитана',
      hide: !isCapitan,
    },
    {
      c: { c: 'teamUsers', teamId: jsonCommand.teamId },
      text: '\u{1F465} Состав команды',
    },
    {
      c: { c: 'unjoinTeam', teamId: jsonCommand.teamId },
      text: '\u{1F4A3} Покинуть команду',
      hide: isCapitan,
    },
    {
      c: { c: 'linkToJoinTeam', teamId: jsonCommand.teamId },
      hide: !isCapitan,
      text: '\u{1F517} Пригласить в команду',
    },
    {
      c: { c: 'delTeam', teamId: jsonCommand.teamId },
      hide: !isCapitan,
      text: '\u{1F4A3} Удалить команду',
    },
    { c: b ?? 'joinedTeams', text: '\u{2B05} Назад' },
  ]

  return {
    message: `<b>${isCapitan ? 'Редактирование команды' : 'Команда'} "${
      team?.name
    }"</b>.${
      team?.description ? `\n\n<b>Описание</b>: "${team?.description}"` : ''
    }`,
    buttons,
  }
}

export default editTeam
