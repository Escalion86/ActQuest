import dbConnect from '@utils/dbConnect'
import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'

const gameTasksEdit = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand.gameId)
  if (game.success === false) return game

  // if (!jsonCommand?.gameId) {
  //   await dbConnect()
  //   const teamsUser = await TeamsUsers.find({
  //     userTelegramId: telegramId,
  //     // role: 'capitan',
  //   })
  //   if (!teamsUser || teamsUser.length === 0) {
  //     return {
  //       message: 'Ошибка не найдено записи в команде',
  //       nextCommand: `menuTeams`,
  //     }
  //   }
  //   const teamsIds = teamsUser.map(
  //     (teamUser) =>
  //       // mongoose.Types.ObjectId(teamUser.teamId)
  //       teamUser.teamId
  //   )

  //   const teams = await Teams.find({
  //     _id: { $in: teamsIds },
  //   })

  //   return {
  //     message: 'Выберите команду для редактирования',
  //     buttonText: '\u{270F}  Редактирование команд',
  //     buttons: [
  //       ...teams.map((team) => ({
  //         text: `"${team.name}"`,
  //         command: { command: 'editTeam', teamId: team._id },
  //         // `editTeam/teamId=${team._id}`,
  //       })),
  //       { command: 'menuTeams', text: '\u{2B05} Назад' },
  //     ],
  //   }
  // }

  // await dbConnect()
  // const teamsUser = await TeamsUsers.findOne({
  //   userTelegramId: telegramId,
  //   teamId: jsonCommand.teamId,
  // })

  // if (!teamsUser) {
  //   return {
  //     message: 'Ошибка вы не состоите в команде',
  //     nextCommand: `menuTeams`,
  //   }
  // }

  // const isCapitan = teamsUser.role === 'capitan'

  // const team = await getTeam(jsonCommand.teamId)
  // if (team.success === false) return team

  // const buttons = [
  //   {
  //     cmd: { cmd: 'setTeamName', teamId: jsonCommand.teamId },
  //     //`setTeamName/teamId=${jsonCommand.teamId}`,
  //     hide: !isCapitan,
  //     text: '\u{270F} Изменить название',
  //   },
  //   {
  //     cmd: {
  //       cmd: 'setTeamDesc',
  //       teamId: jsonCommand.teamId,
  //     },
  //     hide: !isCapitan,
  //     text: '\u{270F} Изменить описание',
  //   },
  //   {
  //     cmd: { cmd: 'teamUsers', teamId: jsonCommand.teamId },
  //     text: '\u{1F465} Состав команды',
  //   },
  //   {
  //     cmd: { cmd: 'linkToJoinTeam', teamId: jsonCommand.teamId },
  //     hide: !isCapitan,
  //     text: '\u{1F517} Пригласить в команду',
  //   },
  //   {
  //     cmd: { cmd: 'deleteTeam', teamId: jsonCommand.teamId },
  //     hide: !isCapitan,
  //     text: '\u{1F4A3} Удалить команду',
  //   },
  //   { cmd: 'joinedTeams', text: '\u{2B05} Назад' },
  // ]

  return {
    message: `Редактирование игры "${game?.name}".\nОписание: ${
      game?.description ? `"${game?.description}"` : '[без описания]'
    }\nКоличество заданий: ${game?.tasks?.length ?? '0'}`,
    buttons: [
      {
        cmd: { cmd: 'editGame', gameId: jsonCommand.gameId },
        text: '\u{2B05} Назад',
      },
    ],
  }
}

export default gameTasksEdit
