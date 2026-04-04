import fetchGameTeamByGameIdAndTeamId from '@server/fetchGameTeamByGameIdAndTeamId'
import fetchTeam from '@server/fetchTeam'

export default async function GameMapPiecesPage({ params }) {
  const location = params?.location
  const id = params?.id
  const teamId = params?.teamId

  const team = await fetchTeam(location, teamId)
  const gameTeam = await fetchGameTeamByGameIdAndTeamId(location, id, teamId)

  let findedBonusCodes = 0
  if (team && gameTeam && gameTeam[0]?.findedBonusCodes?.length > 0) {
    for (const bonusCodes of gameTeam[0].findedBonusCodes) {
      if (bonusCodes !== null && typeof bonusCodes === 'object') {
        if (
          bonusCodes.find((code) =>
            ['101', '177', '814', '001', '318', '228', '078'].includes(code),
          )
        ) {
          findedBonusCodes++
        }
      }
    }
  }

  const imageFileName =
    findedBonusCodes === 0 || !findedBonusCodes
      ? null
      : findedBonusCodes === 1
        ? '1rshjgfjs'
        : findedBonusCodes === 2
          ? '2voiejfn'
          : findedBonusCodes === 3
            ? '3rkvopise'
            : findedBonusCodes === 4
              ? '4qlciepsd'
              : findedBonusCodes === 5
                ? '5alcutpd'
                : findedBonusCodes === 6
                  ? '6bkdlrw'
                  : findedBonusCodes === 7
                    ? '7lltislw'
                    : '8bkblhep'

  const imageUrl = imageFileName ? `https://actquest.ru/img/map/${imageFileName}.png` : ''
  const teamName = team?.name || ''
  const hasError = !team || !gameTeam || !gameTeam[0]

  return (
    <>
      {teamName && <div className="flex justify-center w-full">{teamName}</div>}
      {imageUrl ? (
        <img src={imageUrl} alt="map" />
      ) : hasError ? (
        'Ошибка!!!'
      ) : (
        'Вы не нашли ни одного кусочка карты'
      )}
    </>
  )
}
