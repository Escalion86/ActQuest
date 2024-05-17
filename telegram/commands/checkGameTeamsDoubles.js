import dateToDateTimeStr from '@helpers/dateToDateTimeStr'
import getSecondsBetween from '@helpers/getSecondsBetween'
import GamesTeams from '@models/GamesTeams'
import Teams from '@models/Teams'
import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'
import numberToEmojis from 'telegram/func/numberToEmojis'
import secondsToTime from 'telegram/func/secondsToTime'

const checkGameTeamsDoubles = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand.gameId)
  if (game.success === false) return game

  if (game.status !== 'started') {
    return {
      message: 'Игра должна быть в процессе',
      nextCommand: { c: 'editGame', gameId: jsonCommand.gameId },
    }
  }

  // Получаем список команд участвующих в игре
  const gameTeams = await GamesTeams.find({
    gameId: jsonCommand.gameId,
  })

  const usersIds = gameTeams.map((gameTeam) => gameTeam.userId)

  const duplicatesUsersIds = usersIds.filter((number, index, numbers) => {
    // console.log(number); // number - элемент массива
    // console.log(index); // index - индекс элемента массива
    // console.log(numbers); // numbers - представление массива values
    return numbers.indexOf(number) !== index
  })

  return {
    message: `<b>Проверка игры "${game.name}" на задвоение</b>\n\n${
      duplicatesUsersIds.length > 0
        ? ` - ${duplicatesUsersIds.join('\n - ')}`
        : 'Задвоений не обнаружено'
    }`,
    buttons: [
      // {
      //   text: '\u{1F504} Обновить статус игры',
      //   c: { c: 'gameStatus', gameId: jsonCommand.gameId },
      // },
      {
        text: '\u{2B05} Назад',
        c: { c: 'editGame', gameId: jsonCommand.gameId },
      },
    ],
  }
}

export default checkGameTeamsDoubles
