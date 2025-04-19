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

const gameTeamResult = async ({ telegramId, jsonCommand, location, db }) => {
  const checkData = check(jsonCommand, ['gameTeamId'])
  if (checkData) return checkData

  const gameTeam = await getGameTeam(jsonCommand.gameTeamId, db)
  if (gameTeam.success === false) return gameTeam

  const game = await getGame(gameTeam.gameId, db)
  if (game.success === false) return game

  const team = game.result.teams.find(
    ({ _id }) => String(_id) === gameTeam.teamId
  )

  const { findedPenaltyCodes, findedBonusCodes, timeAddings, wrongCodes } =
    gameTeam

  const tasksDuration = durationCalc(gameTeam, game)
  // new Date(finish || undefined).getTime()

  let sumTasksTime = 0
  let sumCodePenalty = 0
  let sumCodeBonus = 0
  let sumManyWrongCodePenalty = 0
  let sumPenalty = 0

  const text = game.tasks
    .map((task, index) => {
      let codePenalty = 0
      let codeBonus = 0
      let manyWrongCodePenalty = 0
      let penalty = 0

      const seconds = tasksDuration[index] ?? '[не начато]'
      const startTime = gameTeam.startTime[index]
      const endTime = gameTeam.endTime[index]
      let codePenaltyBonusText = ''

      if (
        !task.isBonusTask &&
        game.taskFailurePenalty &&
        (!startTime || !endTime)
      ) {
        codePenaltyBonusText += `\n\u{1F534} ${secondsToTime(
          game.taskFailurePenalty
        )} - Задание не выполнено`
        penalty += game.taskFailurePenalty
        sumPenalty += game.taskFailurePenalty
      }

      if (
        typeof game.manyCodesPenalty === 'object' &&
        game.manyCodesPenalty[0] > 0 &&
        typeof wrongCodes === 'object' &&
        wrongCodes !== null
      ) {
        const [maxCodes, penaltyForMaxCodes] = game.manyCodesPenalty
        if (
          typeof wrongCodes[index] === 'object' &&
          wrongCodes[index] !== null &&
          wrongCodes[index].length >= maxCodes
        ) {
          const manyWrongCodePenaltyForTask =
            Math.floor(wrongCodes[index].length / maxCodes) * penaltyForMaxCodes
          manyWrongCodePenalty += manyWrongCodePenaltyForTask
          sumManyWrongCodePenalty += manyWrongCodePenaltyForTask

          codePenaltyBonusText += `\n\u{1F534} ${secondsToTime(
            penaltyForMaxCodes
          )} - Введен неверный код ${wrongCodes[index].length} раз(а)`
        }
      }

      if (findedPenaltyCodes[index]?.length > 0) {
        const findedPenaltyCodesFull =
          task.penaltyCodes?.filter(({ code }) =>
            findedPenaltyCodes[index].includes(code)
          ) || []
        codePenaltyBonusText += findedPenaltyCodesFull.map(
          ({ penalty, description }) =>
            `\n\u{1F534} ${secondsToTime(penalty)} - ${description}`
        )
        const codePenaltyForTask = findedPenaltyCodesFull.reduce(
          (sum, { penalty }) => sum + penalty
        )
        codePenalty += codePenaltyForTask
        sumCodePenalty += codePenaltyForTask
      }

      if (findedBonusCodes[index]?.length > 0) {
        const findedBonusCodesFull =
          task.bonusCodes?.filter(({ code }) =>
            findedBonusCodes[index].includes(code)
          ) || []
        codePenaltyBonusText += findedBonusCodesFull.map(
          ({ bonus, description }) =>
            `\n\u{1F7E2} ${secondsToTime(bonus)} - ${description}`
        )
        const codeBonusForTask = findedBonusCodesFull.reduce(
          (sum, { bonus }) => sum + bonus,
          0
        )
        codeBonus += codeBonusForTask
        sumCodeBonus += codeBonusForTask
      }

      const totalPenalty = penalty + codePenalty + manyWrongCodePenalty
      const timeOnTask = task.isBonusTask
        ? 0
        : typeof seconds === 'number'
        ? seconds
        : game.taskDuration ?? 3600
      sumTasksTime += timeOnTask

      const result = timeOnTask + totalPenalty - codeBonus

      return `\n<b>\u{1F4CC} ${task.canceled ? '(\u{274C} ОТМЕНЕНО) ' : ''}${
        task.isBonusTask ? '(БОНУСНОЕ) ' : ''
      }"${task?.title}"</b>\nСтарт: ${
        startTime
          ? // ? secondsToTime(new Date(startTime || undefined).getTime())
            dateToDateTimeStr(startTime, false, false, false, false).join(' ')
          : '[не начато]'
      }\nФиниш: ${
        endTime
          ? // ? secondsToTime(new Date(endTime || undefined).getTime())
            dateToDateTimeStr(endTime, false, false, false, false).join(' ')
          : startTime
          ? '[не завершено]'
          : '[не начато]'
      }\n${
        codePenaltyBonusText
          ? `Время на задании: ${secondsToTime(
              timeOnTask
            )}\nБонусы и штрафы: ${codePenaltyBonusText}\n`
          : ''
      }Итоговый результат в задании: ${secondsToTime(result)}`
    })
    .join('\n')

  const addingsBonuses = timeAddings.reduce((acc, { time }) => {
    if (time < 0) {
      return acc - time
    }
    return acc
  }, 0)
  const addingsPenalty = timeAddings.reduce((acc, { time }) => {
    if (time > 0) {
      return acc + time
    }
    return acc
  }, 0)

  var addingsText = timeAddings
    .map(
      ({ name, time }) =>
        `${time < 0 ? '\u{1F7E2}' : '\u{1F534}'} ${secondsToTime(
          Math.abs(time),
          true
        )} - ${name}`
    )
    .join('\n')

  const sumTasksBonuses = sumCodeBonus + addingsBonuses
  const sumTasksPenalty =
    sumCodePenalty + sumManyWrongCodePenalty + sumPenalty + addingsPenalty

  const totalResult = sumTasksTime - sumTasksBonuses + sumTasksPenalty

  const place = game.result.teamsPlaces
    ? game.result.teamsPlaces[gameTeam.teamId]
    : null

  return {
    message: `<b>Результаты команды "${team?.name}" на игре ${formatGameName(
      game
    )}</b>\n${text}${
      addingsText ? `\n\nДополнительные бонусы/штрафы:\n${addingsText}` : ''
    }\n\n\u{1F3C6} <b>ИТОГИ</b>:\nСуммарное время на задания: ${secondsToTime(
      sumTasksTime
    )}\nСуммарно бонусов: \u{1F7E2}${secondsToTime(
      sumTasksBonuses
    )}\nСуммарно штрафов: \u{1F534}${secondsToTime(
      sumTasksPenalty
    )}\nИтоговый результат команды с учетом бонусов и штрафов: ${secondsToTime(
      totalResult
    )}${place ? ` (${place} место в рейтинге игры)` : ''}`,
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
