import buttonListConstructor from 'telegram/func/buttonsListConstructor'
import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'

const gamePhotos = async ({ telegramId, jsonCommand, location, db }) => {
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand?.gameId, db)
  if (game.success === false) return game

  const gameTeams = await db
    .model('GamesTeams')
    .find({
      gameId: jsonCommand?.gameId,
    })
    .lean()
  if (!gameTeams || gameTeams.length === 0) {
    return {
      message: 'Никто не записался на игру',
      nextCommand: `menuGames`,
    }
  }

  const teamsIds = gameTeams.map(({ teamId }) => teamId)

  const teams = await db
    .model('Teams')
    .find({
      _id: { $in: teamsIds },
    })
    .lean()

  const teamsUsers = await db
    .model('TeamsUsers')
    .find({ teamId: { $in: teamsIds } })
    .lean()

  const teamsWithSumPhotos = teams.map((team) => {
    const gameTeam = gameTeams.find(
      (gameTeam) => gameTeam.teamId === String(team._id)
    )
    const sumPhotos = gameTeam.photos.reduce(
      (sum, { photos }) => sum + (photos?.length || 0),
      0
    )
    return {
      ...team,
      sumPhotos,
      gameTeamId: gameTeam?._id,
    }
  })

  const page = jsonCommand?.page ?? 1
  const buttons = buttonListConstructor(
    teamsWithSumPhotos,
    page,
    ({ name, sumPhotos, gameTeamId }, number) => ({
      text: `${number}. "${name}" - ${sumPhotos} фото`,
      c: { c: 'gameTeamPhotos', gameTeamId },
    })
  )

  return {
    message: `Выберите команду, фотографии которой хотите посмотреть`,
    buttons: [
      ...buttons,
      { c: { c: 'game', gameId: jsonCommand?.gameId }, text: '\u{2B05} Назад' },
    ],
  }
}

export default gamePhotos
