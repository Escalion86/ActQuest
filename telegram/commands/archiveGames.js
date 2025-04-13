import formatGameName from 'telegram/func/formatGameName'
import buttonListConstructor from 'telegram/func/buttonsListConstructor'
import isUserAdmin from '@helpers/isUserAdmin'
import isArchiveGame from '@helpers/isArchiveGame'

const archiveGames = async ({ telegramId, jsonCommand, user, db }) => {
  // Получаем список игр
  const games = (await db.model('Games').find({}).lean()).filter((game) =>
    isArchiveGame(game)
  )
  if (games.length === 0) {
    return {
      message: '<b>Прошедших игр небыло</b>',
      buttons: [{ c: 'menuGames', text: '\u{2B05} Назад' }],
    }
  }

  const isAdmin = isUserAdmin(user)

  // Получаем список команд в которых присутствует пользователь
  const userTeams = await db
    .model('TeamsUsers')
    .find({ userTelegramId: telegramId })
    .lean()
  // Получаем IDs команд
  const userTeamsIds = userTeams.map(({ teamId }) => teamId)
  // Получаем список игр в которых присутствует пользователь
  const gamesTeamsWithUser = await db
    .model('GamesTeams')
    .find({
      teamId: { $in: userTeamsIds },
    })
    .lean()
  // Получаем IDs игр
  const gamesWithUserIds = gamesTeamsWithUser.map(({ gameId }) => gameId)
  // Фильтруем список игр
  const filteredGames = games
    ? games.filter(
        (game) =>
          gamesWithUserIds.includes(String(game._id)) || !game.hidden || isAdmin
      )
    : undefined

  if (!filteredGames || filteredGames.length === 0) {
    return {
      message: '<b>Прошедших игр небыло</b>',
      buttons: [...buttons, { c: 'menuGames', text: '\u{2B05} Назад' }],
    }
  }

  const sortedGames = filteredGames.sort((a, b) => {
    return b.dateStart - a.dateStart
  })

  const page = jsonCommand?.page ?? 1
  const buttons = buttonListConstructor(sortedGames, page, (game, number) => {
    // TODO поправить вывод зарегистрированных команд пользователя на игру
    // const gameTeam = gamesTeams.find((gameTeam) => {
    //   return gameTeam.gameId === String(game._id)
    // })
    // const isTeamRegistred = !!gameTeam
    const isTeamRegistred = gamesWithUserIds.includes(String(game._id))
    // const team = isTeamRegistred
    //   ? teams.find((team) => String(team._id) === gameTeam.teamId)
    //   : null
    // const role = teamUser.role === 'capitan' ? 'Капитан' : 'Участник'
    return {
      text: `${formatGameName(game)}${isTeamRegistred ? ` (записан)` : ''}${
        game.hidden ? ` (СКРЫТА)` : ''
      }${game.status === 'canceled' ? ` (ОТМЕНЕНА)` : ''}`,
      c: { c: 'game', gameId: game._id },
    }
  })

  return {
    message: '<b>Прошедшие игры</b>',
    buttons: [...buttons, { c: 'menuGames', text: '\u{2B05} Назад' }],
  }
}

export default archiveGames
