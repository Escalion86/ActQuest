import { registerGameTeam } from '../../server/registerGameTeam.js'
import buttonListConstructor from 'telegram/func/buttonsListConstructor'
import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'
import getGame from 'telegram/func/getGame'
import getTeam from 'telegram/func/getTeam'

const joinGameAdmin = async ({ telegramId, jsonCommand, location, db }) => {
  const checkData = check(jsonCommand, ['teamId'])
  if (checkData) return checkData

  const team = await getTeam(jsonCommand.teamId, db)
  if (team.success === false) return team

  // Проверяем выбрана ли игра
  if (jsonCommand.gameId) {
    const game = await getGame(jsonCommand.gameId, db)
    if (game.success === false) return team
    const user = await db.model('Users').findOne({ telegramId }).select({ role: 1 }).lean()
    if (!['admin', 'dev'].includes(user?.role)) return { message: 'Недостаточно прав' }
    try {
      await registerGameTeam({ db, teamId: jsonCommand.teamId, gameId: jsonCommand.gameId, role: user.role })
    } catch (error) {
      if (error.registrationStatus) return { message: error.message }
      throw error
    }
    return {
      message: `Вы зарегистрировали команду "${
        team?.name
      }" на игру ${formatGameName(game)}`,
      nextCommand: {
        c: `teamGamesAdmin`,
        teamId: jsonCommand.teamId,
        page: jsonCommand.page,
      },
    }
  }

  const games = await db.model('Games').find({})

  const page = jsonCommand?.page ?? 1
  const buttons = buttonListConstructor(games, page, (game, number) => {
    return {
      text: formatGameName(game),
      c: { gameId: game._id },
    }
  })

  return {
    message: `<b>АДМИНИСТРИРОВАНИЕ</b>\n\nВыберите игру на которую вы хотите зарегистрировать команду "${team.name}"`,
    buttons: [
      ...buttons,
      {
        c: {
          c: `teamGamesAdmin`,
          teamId: jsonCommand.teamId,
          page: jsonCommand.page,
        },
        text: '\u{2B05} Назад',
      },
    ],
  }
}

export default joinGameAdmin
