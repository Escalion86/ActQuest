import dateToDateTimeStr from '@helpers/dateToDateTimeStr'
import getSecondsBetween from '@helpers/getSecondsBetween'
import GamesTeams from '@models/GamesTeams'
import Teams from '@models/Teams'
import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'

const numberToEmojis = (number) => {
  var digits = number.toString().split('')
  const emojis = digits.map((digit) => {
    switch (digit) {
      case '0':
        return `\u{0030}\u{20E3}`
      case '1':
        return `\u{0031}\u{20E3}`
      case '2':
        return `\u{0032}\u{20E3}`
      case '3':
        return `\u{0033}\u{20E3}`
      case '4':
        return `\u{0034}\u{20E3}`
      case '5':
        return `\u{0035}\u{20E3}`
      case '6':
        return `\u{0036}\u{20E3}`
      case '7':
        return `\u{0037}\u{20E3}`
      case '8':
        return `\u{0038}\u{20E3}`
      case '9':
        return `\u{0039}\u{20E3}`
      default:
        return `\u{002A}\u{20E3}`
    }
  })
  return emojis.join('')
}

const gameStatus = async ({ telegramId, jsonCommand }) => {
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

  const teamsIds = gameTeams.map((gameTeam) => gameTeam.teamId)

  const teams = await Teams.find({
    _id: { $in: teamsIds },
  })

  const textArray = teams.map((team) => {
    const gameTeam = gameTeams.find(
      (gameTeam) => gameTeam.teamId === String(team._id)
    )
    var startedTasks = 0
    gameTeam.startTime.forEach((time) => {
      if (time) ++startedTasks
    })
    const findedCodes =
      gameTeam.findedCodes?.length >= startedTasks
        ? gameTeam.findedCodes[startedTasks - 1].length
        : 0
    const findedBonusCodes =
      gameTeam.findedBonusCodes?.length >= startedTasks
        ? gameTeam.findedBonusCodes[startedTasks - 1].length
        : 0
    const findedPenaltyCodes =
      gameTeam.findedPenaltyCodes?.length >= startedTasks
        ? gameTeam.findedPenaltyCodes[startedTasks - 1].length
        : 0
    const taskDuration = game.taskDuration ?? 3600

    const isTeamFinished =
      gameTeam.endTime[game.tasks.length - 1] ||
      (gameTeam.startTime[game.tasks.length - 1] &&
        getSecondsBetween(gameTeam.startTime[game.tasks.length - 1]) >
          taskDuration)

    if (isTeamFinished) return `"${team.name}" - \u{2705} завершили все задания`

    // Проверяем, может задание выполнено и команда на перерыве
    if (gameTeam.endTime[startedTasks - 1]) {
      const nextTask = game.tasks[startedTasks]
      return `"${team.name}" - на перерыве след задание ${numberToEmojis(
        startedTasks + 1
      )} "${nextTask.title}"`
    }

    const task = game.tasks[startedTasks - 1]
    return `"${team.name}" - выполняют задание ${numberToEmojis(
      startedTasks
    )} "${task.title}".${
      findedCodes > 0
        ? `\nНайденые коды (${findedCodes} шт.): "${gameTeam.findedCodes[
            startedTasks - 1
          ].join(`", "`)}"`
        : ''
    }${
      findedBonusCodes > 0
        ? `\nНайденые бонусные коды (${findedBonusCodes} шт.): "${gameTeam.findedBonusCodes[
            startedTasks - 1
          ].join(`", "`)}"`
        : ''
    }${
      findedPenaltyCodes > 0
        ? `\nНайденые штрафные коды (${findedPenaltyCodes} шт.): "${gameTeam.findedPenaltyCodes[
            startedTasks - 1
          ].join(`", "`)}"`
        : ''
    }`
  })

  const text = textArray.join('\n\n')

  // const tasksDuration = gameTeams.map((gameTeam) => ({
  //   teamId: gameTeam.teamId,
  //   duration: durationCalc(gameTeam),
  // }))

  // const text = game.tasks.map((task, index) => {
  //   return `\n\n<b>Задание "${task.title}"</b>${teams.map((team) => {
  //     const dur = tasksDuration.find((item) => item.teamId === String(team._id))
  //     return `\n- ${team.name} - ${secondsToTime(dur?.duration[index])}`
  //   })}`
  // })

  return {
    message: `<b>Состояние игры "${game.name}"</b>\n${dateToDateTimeStr(
      new Date(),
      false,
      false,
      false,
      false
    ).join(' ')}\n\n${text}`,
    buttons: [
      {
        text: '\u{1F504} Обновить статус игры',
        c: { c: 'gameStatus', gameId: jsonCommand.gameId },
      },
      {
        text: '\u{2B05} Назад',
        c: { c: 'editGame', gameId: jsonCommand.gameId },
      },
    ],
  }
}

export default gameStatus
