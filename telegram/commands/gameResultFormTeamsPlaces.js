// import formatGameDateTimeFact from '@helpers/formatGameDateTimeFact'
import getSecondsBetween from '@helpers/getSecondsBetween'
// import secondsToTimeStr from '@helpers/secondsToTimeStr'
import Games from '@models/Games'
// import GamesTeams from '@models/GamesTeams'
// import Teams from '@models/Teams'
// import TeamsUsers from '@models/TeamsUsers'

import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'
import getGame from 'telegram/func/getGame'
import secondsToTime from 'telegram/func/secondsToTime'

const sortFunc = (a, b, key = 'seconds', direction = 'ASC') => {
  const isNumericA = typeof a[key] === 'number'
  const isNumericB = typeof b[key] === 'number'

  if (isNumericA && isNumericB) {
    if (direction === 'ASC') return a[key] - b[key]
    return b[key] - a[key]
  }

  if (isNumericA && !isNumericB) {
    return direction === 'ASC' ? -1 : 1
  }

  if (!isNumericA && isNumericB) {
    return direction === 'ASC' ? 1 : -1
  }
  return 0
}

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

const gameResultFormTeamsPlaces = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand.gameId)
  if (game.success === false) return game

  if (game.status !== 'finished') {
    return {
      message: 'Игра еще не завершена',
      nextCommand: { c: 'editGameGeneral', gameId: jsonCommand.gameId },
    }
  }

  // if (game.result && !jsonCommand.confirm) {
  //   return {
  //     success: true,
  //     message: `Подтвердите обновление результатов игры ${formatGameName(
  //       game
  //     )}`,
  //     buttons: [
  //       {
  //         text: '\u{1F504} Обновить результаты',
  //         c: { confirm: true },
  //       },
  //       {
  //         text: '\u{1F6AB} Отмена',
  //         c: { c: 'editGameGeneral', gameId: jsonCommand.gameId },
  //       },
  //     ],
  //   }
  // }

  // Получаем список команд участвующих в игре
  const { teams, teamsUsers, gameTeams } = game.result

  // const teamsIds = gameTeams.map((gameTeam) => gameTeam.teamId)

  // const teams = await Teams.find({
  //   _id: { $in: teamsIds },
  // })

  // const teamsUsers = await TeamsUsers.find({
  //   teamId: { $in: teamsIds },
  // })

  const tasksDuration = gameTeams.map((gameTeam) => ({
    teamId: gameTeam.teamId,
    duration: durationCalc(gameTeam, game),
    findedPenaltyCodes: gameTeam.findedPenaltyCodes,
    findedBonusCodes: gameTeam.findedBonusCodes,
    timeAddings: gameTeam.timeAddings,
    wrongCodes: gameTeam.wrongCodes,
  }))

  // const taskAverageTimes = Array(game.tasks.length)
  // const fastestTask = {}

  // const text = game.tasks
  //   .map((task, index) => {
  //     const teamsSeconds = teams.map((team) => {
  //       const dur = tasksDuration.find(
  //         (item) => item.teamId === String(team._id)
  //       )
  //       const seconds = dur?.duration[index] ?? '[не начато]'
  //       if (!fastestTask.seconds || fastestTask.seconds > seconds) {
  //         fastestTask.seconds = seconds
  //         fastestTask.teamName = team.name
  //         fastestTask.taskTitle = task?.title
  //       }
  //       return { team, seconds }
  //     })

  //     taskAverageTimes[index] = getAverage(
  //       teamsSeconds
  //         .filter(({ seconds }) => typeof seconds === 'number')
  //         .map(({ seconds }) => seconds)
  //     )

  //     const sortedTeamsSeconds = [...teamsSeconds].sort(sortFunc)

  //     return `\n<b>\u{1F4CC} "${task?.title}"</b>\n${sortedTeamsSeconds
  //       .map(
  //         ({ team, seconds }) =>
  //           `${
  //             typeof seconds === 'number' ? secondsToTime(seconds) : seconds
  //           } - ${team.name}`
  //       )
  //       .join('\n')}`
  //   })
  //   .join('\n')

  const totalTeamsSeconds = teams.map((team, index) => {
    const {
      teamId,
      duration,
      findedPenaltyCodes,
      findedBonusCodes,
      timeAddings,
      wrongCodes,
    } = tasksDuration.find((item) => item.teamId === String(team._id))
    let penalty = 0
    let result = 0
    let manyWrongCodePenalty = 0
    let codePenalty = 0
    let codeBonus = 0
    let codePenaltyBonusText = ''
    const addings = timeAddings
      ? timeAddings.reduce((acc, { time }) => {
          return acc + time
        }, 0)
      : 0
    // var addingsText = timeAddings
    //   .map(
    //     ({ name, time }) =>
    //       `${time < 0 ? '\u{1F7E2}' : '\u{1F534}'} ${secondsToTime(
    //         Math.abs(time),
    //         true
    //       )} - ${name}`
    //   )
    //   .join('\n')

    // const seconds = duration.reduce((partialSum, a) => {
    //   const res =
    //     typeof a === 'number' && typeof partialSum === 'number'
    //       ? partialSum + a
    //       : '[стоп игра]'
    //   if (typeof res === 'string' || a >= (game.taskDuration ?? 3600)) {
    //     penalty += game.taskFailurePenalty ?? 0
    //     result += game.taskDuration ?? 3600
    //   } else result += a
    //   return res
    // }, 0)

    game.tasks.forEach(({ title, penaltyCodes, bonusCodes }, index) => {
      if (
        (findedPenaltyCodes && findedPenaltyCodes[index]?.length > 0) ||
        (findedBonusCodes && findedBonusCodes[index]?.length > 0)
      )
        codePenaltyBonusText += `\n\u{1F4CC} "${title}":`

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
          manyWrongCodePenalty +=
            Math.floor(wrongCodes[index].length / maxCodes) * penaltyForMaxCodes
        }
      }
      if (findedPenaltyCodes && findedPenaltyCodes[index]?.length > 0) {
        const findedPenaltyCodesFull = penaltyCodes.filter(({ code }) =>
          findedPenaltyCodes[index].includes(code)
        )
        codePenaltyBonusText += findedPenaltyCodesFull.map(
          ({ penalty, description }) =>
            `\n\u{1F534} ${secondsToTime(penalty)} - ${description}`
        )
        codePenalty += findedPenaltyCodesFull.reduce(
          (sum, { penalty }) => sum + penalty,
          0
        )
      }
      if (findedBonusCodes && findedBonusCodes[index]?.length > 0) {
        const findedBonusCodesFull = bonusCodes.filter(({ code }) =>
          findedBonusCodes[index].includes(code)
        )
        codePenaltyBonusText += findedBonusCodesFull.map(
          ({ bonus, description }) =>
            `\n\u{1F7E2} ${secondsToTime(bonus)} - ${description}`
        )
        codeBonus += findedBonusCodesFull.reduce(
          (sum, { bonus }) => sum + bonus,
          0
        )
      }
    })

    const totalPenalty = penalty + codePenalty + manyWrongCodePenalty

    // if (manyWrongCodePenalty > 0) {
    //   addingsText += `${addingsText ? '\n' : ''}\u{1F534} ${secondsToTime(
    //     manyWrongCodePenalty
    //   )} - подбор кода`
    // }

    result += totalPenalty - codeBonus + addings

    return {
      // team,
      // seconds,
      // totalPenalty,
      // penalty,
      // manyWrongCodePenalty,
      // codePenalty,
      // codeBonus,
      // codePenaltyBonusText,
      // addings,
      // addingsText,
      result,
    }
  })

  // const sortedTotalTeamsSeconds = [...totalTeamsSeconds].sort(sortFunc)
  // const sortedTotalTeamsPenalty = [...totalTeamsSeconds].sort((a, b) =>
  //   sortFunc(a, b, 'penalty', 'DESC')
  // )
  const sortedTotalTeamsResult = [...totalTeamsSeconds].sort((a, b) =>
    sortFunc(a, b, 'result')
  )
  // const sortedTotalTeamsAddings = [...totalTeamsSeconds].sort((a, b) =>
  //   sortFunc(a, b, 'addings')
  // )

  // const totalTeamsWithAddings = sortedTotalTeamsAddings.filter(
  //   ({ addings }) => addings !== 0
  // )
  // const totalAddings =
  // totalTeamsWithAddings.length > 0
  //   ? totalTeamsWithAddings
  //       .map(({ team, addings }) => {
  //         return `${secondsToTime(addings)} - ${team.name}`
  //       })
  //       .join('\n')
  //   : undefined

  // const totalAddingsText = sortedTotalTeamsAddings
  //   .filter(({ addingsText }) => addingsText)
  //   .map(({ team, addingsText }) => {
  //     return `Команда "${team.name}":\n${addingsText}`
  //   })
  //   .join('\n')

  // const totalTeamsWithPenalty = sortedTotalTeamsPenalty.filter(
  //   ({ penalty }) => penalty > 0
  // )
  // const totalCodePenaltyBonus = totalTeamsSeconds
  //   .filter(({ codePenaltyBonusText }) => codePenaltyBonusText)
  //   .map(({ team, codePenaltyBonusText }) => {
  //     return `Команда "${team.name}":${codePenaltyBonusText}`
  //   })
  //   .join('\n\n')

  // const totalPenalty =
  //   totalTeamsWithPenalty.length > 0
  //     ? totalTeamsWithPenalty
  //         .map(({ team, penalty }) => {
  //           return `${secondsToTime(penalty)} - ${team.name}`
  //         })
  //         .join('\n')
  //     : undefined

  // const totalSeconds = sortedTotalTeamsSeconds
  //   .map(({ team, seconds }) => {
  //     return `${
  //       typeof seconds === 'number' ? secondsToTime(seconds) : seconds
  //     } - ${team.name}`
  //   })
  //   .join('\n')

  // const totalResult = sortedTotalTeamsResult
  //   .map(({ team, result }) => {
  //     return `${secondsToTime(result)} - ${team.name}`
  //   })
  //   .join('\n')

  // const mostEasyTaskIndex = taskAverageTimes.indexOf(
  //   Math.min.apply(null, taskAverageTimes)
  // )
  // const mostHardTaskIndex = taskAverageTimes.indexOf(
  //   Math.max.apply(null, taskAverageTimes)
  // )

  // const gameDateTimeFact = formatGameDateTimeFact(game, {
  //   dontShowDayOfWeek: false,
  //   fullWeek: false,
  //   // showYear,
  //   // fullMonth,
  //   // weekInBrackets,
  //   showDuration: true,
  //   durationOnNextLine: true,
  //   showSeconds: true,
  // })

  // const game = await Games.findById(jsonCommand.gameId)

  // const messageText = [
  //   `<b>Результаты игры:\n${formatGameName(game)}</b>`,
  //   `<b>Фактический период игры</b>:\n${gameDateTimeFact}\n${text}\n`,
  //   `<b>\u{2B50}РЕЗУЛЬТАТЫ:</b>\n<b>\u{231A}Без учета бонусов и штрафов:</b>\n${totalSeconds}`,
  //   game.taskFailurePenalty &&
  //     `<b>\u{1F534} Штрафы за невыполненные задания:</b>\n${
  //       totalPenalty ?? 'отсутствуют'
  //     }`,
  //   totalCodePenaltyBonus
  //     ? `<b>\u{1F534} Штрафы и \u{1F7E2} бонусы за коды:</b>\n${totalCodePenaltyBonus}`
  //     : '',
  //   totalAddingsText
  //     ? `<b>Прочие \u{1F534} штрафы и \u{1F7E2} бонусы:</b>\n${totalAddingsText}`
  //     : '',
  //   `<b>\u{1F3C6} ИТОГО:</b>\n${totalResult}\n`,

  //   `<b>\u{1F607} Самое легкое задание:</b>\n"${
  //     game.tasks[mostEasyTaskIndex]?.title
  //   }" - среднее время ${secondsToTime(taskAverageTimes[mostEasyTaskIndex])}`,
  //   `<b>\u{1F608} Самое сложное задание:</b>\n"${
  //     game.tasks[mostHardTaskIndex]?.title
  //   }" - среднее время ${secondsToTime(taskAverageTimes[mostHardTaskIndex])}`,
  //   `<b>\u{1F680} Самое быстрое выполнение задания:</b>\n"${
  //     fastestTask.taskTitle
  //   }" команда "${fastestTask.teamName}" - ${secondsToTime(
  //     fastestTask.seconds
  //   )}`,
  // ]
  //   .filter((text) => text)
  //   .join('\n\n')

  console.log('sortedTotalTeamsResult :>> ', sortedTotalTeamsResult)

  const teamsPlaces = sortedTotalTeamsResult.reduce(
    (acc, { team }, index) => (acc[String(team._id)] = index + 1),
    {}
  )

  await Games.findByIdAndUpdate(jsonCommand.gameId, {
    result: {
      ...game.result,
      // text: messageText,
      // `<b>Результаты игры:\n${formatGameName(
      //   game
      // )}</b>\n\n<b>Фактический период игры</b>:\n${gameDateTimeFact}\n${text}\n\n\n<b>\u{2B50}РЕЗУЛЬТАТЫ:</b>\n<b>\u{231A}Без учета бонусов и штрафов:</b>\n${totalSeconds}${
      //   game.taskFailurePenalty
      //     ? `\n\n<b>\u{1F534} Штрафы за невыполненные задания:</b>\n${
      //         totalPenalty ? totalPenalty : 'штрафов нет!'
      //       }`
      //     : ''
      // }\n\n<b>\u{1F534} Штрафы и \u{1F7E2} бонусы за коды:</b>\n${totalCodePenaltyBonus}\n\n<b>\u{1F3C6} ИТОГО:</b>\n${totalResult}\n\n\n<b>\u{1F607} Самое легкое задание:</b>\n"${
      //   game.tasks[mostEasyTaskIndex]?.title
      // }" - среднее время ${secondsToTime(
      //   taskAverageTimes[mostEasyTaskIndex]
      // )}\n\n<b>\u{1F608} Самое сложное задание:</b>\n"${
      //   game.tasks[mostHardTaskIndex]?.title
      // }" - среднее время ${secondsToTime(
      //   taskAverageTimes[mostHardTaskIndex]
      // )}\n\n<b>\u{1F680} Самое быстрое выполнение задания:</b>\n"${
      //   fastestTask.taskTitle
      // }" команда "${fastestTask.teamName}" - ${secondsToTime(
      //   fastestTask.seconds
      // )}`,
      // teams,
      // gameTeams,
      // teamsUsers,
      teamsPlaces,
    },
    // hideResult: game.result ? game.hideResult : true,
  })

  return {
    message: `Сформированы места команд в результатах игры ${formatGameName(
      game
    )}!`,
    nextCommand: { c: 'editGameGeneral', gameId: jsonCommand.gameId },
    // buttons: [
    //   {
    //     url: 'https://actquest.ru/game/result/' + jsonCommand.gameId,
    //     text: '\u{1F30F} Посмотреть результаты игры на сайте',
    //     hide: game.status !== 'finished' || !game.result,
    //   },
    //   {
    //     c: { c: 'gameResult', gameId: jsonCommand.gameId },
    //     text: '\u{1F4CB} Посмотреть результаты игры',
    //     hide: game.status !== 'finished',
    //   },
    //   {
    //     text: '\u{2B05} Назад',
    //     c: { c: 'editGameGeneral', gameId: jsonCommand.gameId },
    //   },
    // ],
  }
}

export default gameResultFormTeamsPlaces
