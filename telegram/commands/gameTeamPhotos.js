import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'
import getGame from 'telegram/func/getGame'
import getGameTeam from 'telegram/func/getGameTeam'
import getTeam from 'telegram/func/getTeam'

const gameTeamPhotos = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['gameTeamId'])
  if (checkData) return checkData

  const gameTeam = await getGameTeam(jsonCommand.gameTeamId)
  if (gameTeam.success === false) return gameTeam

  const game = await getGame(gameTeam.gameId)
  if (game.success === false) return game

  const team = await getTeam(gameTeam.teamId)
  if (team.success === false) return team

  const allPhotos = gameTeam.photos.reduce(
    (sum, { photos }) => (photos?.length > 0 ? [...sum, ...photos] : sum),
    []
  )

  return {
    message: `<b>Фотографии команды "${team?.name}" на игре ${formatGameName(
      game
    )}</b>`,
    images: allPhotos,
    buttons: [
      {
        c: { c: 'gamePhotos', gameId: String(game._id) },
        text: '\u{2B05} Назад',
      },
    ],
  }
}

export default gameTeamPhotos
