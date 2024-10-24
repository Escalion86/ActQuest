import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'
import getGame from 'telegram/func/getGame'
import getGameTeam from 'telegram/func/getGameTeam'
import getSecondsBetween from '@helpers/getSecondsBetween'
import secondsToTime from 'telegram/func/secondsToTime'
import dateToDateTimeStr from '@helpers/dateToDateTimeStr'

// const sortFunc = (a, b, key = 'seconds', direction = 'ASC') => {
//   const isNumericA = typeof a[key] === 'number'
//   const isNumericB = typeof b[key] === 'number'

//   if (isNumericA && isNumericB) {
//     if (direction === 'ASC') return a[key] - b[key]
//     return b[key] - a[key]
//   }

//   if (isNumericA && !isNumericB) {
//     return direction === 'ASC' ? -1 : 1
//   }

//   if (!isNumericA && isNumericB) {
//     return direction === 'ASC' ? 1 : -1
//   }
//   return 0
// }

// const getAverage = (numbers) =>
//   Math.round(numbers.reduce((acc, number) => acc + number, 0) / numbers.length)

const durationCalc = ({ startTime, endTime, activeNum }, game) => {
  if (!startTime || !endTime) return null
  const tempArray = []
  const tasksCount = game.tasks.length
  const taskDuration = game.taskDuration ?? 3600

  for (let i = 0; i < tasksCount; i++) {
    if (activeNum > i) {
      if (!endTime[i]) tempArray.push(taskDuration)
      else tempArray.push(getSecondsBetween(startTime[i], endTime[i]))
    } else if (activeNum === i) {
      tempArray.push('[не завершено]')
    } else {
      tempArray.push('[не начато]')
    }
  }
  return tempArray
}

const gameTeamResult = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['gameTeamId'])
  if (checkData) return checkData

  const gameTeam = await getGameTeam(jsonCommand.gameTeamId)
  if (gameTeam.success === false) return gameTeam

  const game = await getGame(gameTeam.gameId)
  if (game.success === false) return game

  const team = game.result.teams.find(
    ({ _id }) => String(_id) === gameTeam.teamId
  )

  const tasksDuration = {
    duration: durationCalc(gameTeam, game),
    findedPenaltyCodes: gameTeam.findedPenaltyCodes,
    findedBonusCodes: gameTeam.findedBonusCodes,
    timeAddings: gameTeam.timeAddings,
    wrongCodes: gameTeam.wrongCodes,
  }
  // new Date(finish || undefined).getTime()
  const text = game.tasks
    .map((task, index) => {
      const seconds = tasksDuration?.duration[index] ?? '[не начато]'
      const startTime = gameTeam.startTime[index]
      const endTime = gameTeam.endTime[index]

      return `\n<b>\u{1F4CC} ${task.canceled ? '(\u{274C} ОТМЕНЕНО) ' : ''}"${
        task?.title
      }"</b>\n  Старт: ${
        startTime
          ? // ? secondsToTime(new Date(startTime || undefined).getTime())
            dateToDateTimeStr(startTime, false, false, false, false).join(' ')
          : '[не начато]'
      }\n
      Финиш: ${
        endTime
          ? // ? secondsToTime(new Date(endTime || undefined).getTime())
            dateToDateTimeStr(endTime, false, false, false, false).join(' ')
          : startTime
          ? '[не завершено]'
          : '[не начато]'
      }\n
      Итого: ${secondsToTime(seconds)}`
    })
    .join('\n')

  return {
    message: `<b>Результаты команды "${team?.name}" на игре ${formatGameName(
      game
    )}</b>\n${text}`,
    buttons: [
      // {
      //   c: {
      //     c: 'delGameTeam',
      //     gameTeamId: jsonCommand.gameTeamId,
      //   },
      //   text: '\u{1F4A3} Удалить команду из игры',
      //   hide: !(
      //     game.status === 'active' &&
      //     (isAdmin || capitanTelegramId === telegramId)
      //   ),
      // },
      {
        c: { c: 'gameTeamsResult', gameId: String(game._id) },
        text: '\u{2B05} Назад',
      },
    ],
  }
}

export default gameTeamResult
