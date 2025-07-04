import getNoun from '@helpers/getNoun'
import { MAX_TEAMS } from 'telegram/constants'
import buttonListConstructor from 'telegram/func/buttonsListConstructor'
import check from 'telegram/func/check'

const userJoinToTeam = async ({ telegramId, jsonCommand, location, db }) => {
  const checkData = check(jsonCommand, ['userTId'])
  if (checkData) return checkData

  const teamsUser = await db.model('TeamsUsers').find({
    userTelegramId: jsonCommand.userTId,
  })

  if (teamsUser.length >= MAX_TEAMS) {
    return {
      message: `Пользователь ${user.name} состоит в ${getNoun(
        teamsUser.length,
        'команде',
        'командах',
        'командах'
      )}, нельзя состоять более чем в ${getNoun(
        MAX_TEAMS,
        'команде',
        'командах',
        'командах'
      )}.\n\nДля присоединения к команде, пользователю необходимо сначала покинуть хотябы одну команду`,
      nextCommand: { c: 'userAdmin', userTId: jsonCommand.userTId },
    }
  }

  const user = await db
    .model('Users')
    .findOne({ telegramId: jsonCommand.userTId })

  if (jsonCommand.teamId) {
    const team = await db.model('Teams').findById(jsonCommand.teamId)
    await db.model('TeamsUsers').create({
      teamId: String(jsonCommand.teamId),
      userTelegramId: jsonCommand.userTId,
    })
    return {
      message: `Пользователь ${user.name} записан в команду "${team?.name}"`,
      nextCommand: { c: 'userAdmin', userTId: jsonCommand.userTId },
    }
  }

  const teams = await db.model('Teams').find({})
  const teamsUsers = await db.model('TeamsUsers').find({})

  const teamsOfUser = teamsUsers.filter(
    (teamsUser) => teamsUser.userTelegramId === jsonCommand.userTId
  )
  const teamsOfUserIds = teamsOfUser.map((teamUser) => String(teamUser._id))
  const filteredTeams = teams.filter(
    (team) => !teamsOfUserIds.includes(toString(team._id))
  )

  const page = jsonCommand?.page ?? 1

  const buttons = buttonListConstructor(filteredTeams, page, (team, number) => {
    const participansCount = teamsUsers.reduce(
      (p, c) => p + (c.teamId === String(team._id) ? 1 : 0),
      0
    )
    return {
      text: `${number}. "${team.name}" (${participansCount} чел)`,
      c: {
        // c: 'editTeamAdmin',
        teamId: team._id,
        // p: 1,
      },
    }
  })

  return {
    message: `Выберите команду куда записать пользователя ${user.name}`,
    buttons: [
      // ...filteredTeams.map((team) => {
      //   const participansCount = teamsUsers.reduce(
      //     (p, c) => p + (c.teamId === String(team._id) ? 1 : 0),
      //     0
      //   )
      //   return {
      //     text: `"${team.name}" (${participansCount} чел)`,
      //     c: {
      //       teamId: team._id,
      //     },
      //   }
      // }),
      ...buttons,
      {
        c: { c: 'userAdmin', userTId: jsonCommand.userTId },
        text: '\u{2B05} Назад',
      },
    ],
  }
}

export default userJoinToTeam
