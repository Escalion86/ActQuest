import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'

const checkGameTeamsDoubles = async ({
  telegramId,
  jsonCommand,
  location,
  db,
}) => {
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand.gameId, db)
  if (game.success === false) return game

  // Получаем список команд участвующих в игре
  const gameTeams = await db
    .model('GamesTeams')
    .find({
      gameId: jsonCommand.gameId,
    })
    .lean()

  const teamsIds = gameTeams.map((gameTeam) => gameTeam.teamId)
  const teams = await db
    .model('Teams')
    .find({
      _id: { $in: teamsIds },
    })
    .lean()
  const teamsUsers = await db
    .model('TeamsUsers')
    .find({
      teamId: { $in: teamsIds },
    })
    .lean()
  const usersIds = teamsUsers.map(({ userTelegramId }) => userTelegramId)

  const duplicatesUsersIds = usersIds.filter((number, index, numbers) => {
    // console.log(number); // number - элемент массива
    // console.log(index); // index - индекс элемента массива
    // console.log(numbers); // numbers - представление массива values
    return numbers.indexOf(number) !== index
  })

  console.log('duplicatesUsersIds :>> ', duplicatesUsersIds)

  const duplicateUsers = await db
    .model('Users')
    .find({
      telegramId: { $in: duplicatesUsersIds },
    })
    .lean()

  return {
    message: `<b>Проверка игры "${game.name}" на задвоение</b>\n\n${
      duplicatesUsersIds.length > 0
        ? `Есть задвоения:\n${duplicateUsers
            .map(({ name, telegramId }) => {
              const userTeams = teamsUsers.filter(
                (teamUser) => teamUser.userTelegramId === telegramId
              )
              const userTeamsFull = userTeams.map((teamUser) =>
                teams.find(({ _id }) => String(_id) === teamUser.teamId)
              )
              return `"${name}" в командах:\n - ${userTeamsFull
                .map(({ name }) => name)
                .join('\n - ')}`
            })
            .join('\n')}`
        : 'Задвоений не обнаружено'
    }`,
    buttons: [
      // {
      //   text: '\u{1F504} Обновить статус игры',
      //   c: { c: 'gameStatus', gameId: jsonCommand.gameId },
      // },
      {
        text: '\u{2B05} Назад',
        c: { c: 'editGameGeneral', gameId: jsonCommand.gameId },
      },
    ],
  }
}

export default checkGameTeamsDoubles
