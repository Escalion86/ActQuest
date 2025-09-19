import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'
import getAdmins from 'telegram/func/getAdmins'
import getGame from 'telegram/func/getGame'
import getTeam from 'telegram/func/getTeam'
import keyboardFormer from 'telegram/func/keyboardFormer'
import sendMessage from 'telegram/sendMessage'

const joinGame = async ({ telegramId, jsonCommand, location, db }) => {
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand.gameId, db)
  if (game.success === false) return game

  if (game.status !== 'active') {
    if (game.status === 'finished') {
      return {
        message: `Запись на игру закрыта, так как игра завершена`,
        nextCommand: `menuGames`,
      }
    }
    return {
      message: `Запись на игру закрыта`,
      nextCommand: `menuGames`,
    }
  }

  const teamsUser = await db.model('TeamsUsers').find({
    userTelegramId: telegramId,
    role: 'capitan',
  })

  if (!teamsUser || teamsUser.length === 0) {
    return {
      message: 'Для регистрации на игру вы должны быть капитаном команды',
      // nextCommand: `menuGames`,
      buttons: [
        {
          c: 'joinTeam',
          text: '\u{1F517} Присоединиться к команде',
        },
        {
          c: 'createTeam',
          text: '\u{2795} Создать команду',
        },
        { c: 'menuGames', text: '\u{2B05} Назад' },
      ],
    }
  }

  // Проверяем выбрана ли команда которую пользователь хочет регистрировать
  if (jsonCommand.teamId) {
    const team = await getTeam(jsonCommand.teamId, db)
    if (team.success === false) return team

    // Проверяем не заригистрирована ли команда
    const gameTeams = await db.model('GamesTeams').find({
      teamId: jsonCommand.teamId,
      gameId: jsonCommand.gameId,
    })
    if (gameTeams.length > 0) {
      return {
        success: true,
        message: `Вы уже зарегистрировались на игру ${formatGameName(
          game
        )} от лица команды "${team.name}"`,
      }
    }

    // Создаем запись команды на игру
    await db.model('GamesTeams').create({
      teamId: jsonCommand.teamId,
      gameId: jsonCommand.gameId,
    })

    // Оповещаем администраторов
    const admins = await getAdmins(db)
    const adminTelegramIds = admins.map(({ telegramId }) => telegramId)

    const keyboard = keyboardFormer([
      {
        c: { c: 'editTeamAdmin', teamId: team._id },
        text: '\u{2699} Управление командой',
      },
    ])

    await Promise.all(
      adminTelegramIds.map(async (telegramId) => {
        await sendMessage({
          chat_id: telegramId,
          text: `На игру ${formatGameName(game)} зарегистрировалась команда "${
            team.name
          }"`,
          keyboard,
          location,
        })
      })
    )

    return {
      message: `Вы зарегистрировались на игру ${formatGameName(
        game
      )} от лица команды "${team.name}"`,
      buttons: [
        {
          text: `\u{2B05} Перейти к описанию игры`,
          c: { c: 'game', gameId: game._id },
        },
      ],
    }
  }

  const teamsIds = teamsUser.map((teamUser) => teamUser.teamId)
  const teams = await db.model('Teams').find({
    _id: { $in: teamsIds },
  })

  return {
    message: `Выберите команду которую вы хотите зарегистрировать на игру ${formatGameName(
      game
    )}`,
    buttons: [
      ...teams.map((team) => {
        return {
          text: `"${team.name}"`,
          c: { teamId: team._id },
        }
      }),
      { c: 'menuGames', text: '\u{2B05} Назад' },
    ],
  }
}

export default joinGame
