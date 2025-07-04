import dateToDateTimeStr from '@helpers/dateToDateTimeStr'
import getSecondsBetween from '@helpers/getSecondsBetween'
import { get } from 'mongoose'
import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'
import numberToEmojis from 'telegram/func/numberToEmojis'
import secondsToTime from 'telegram/func/secondsToTime'

const gameStatus = async ({ telegramId, jsonCommand, location, db }) => {
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand.gameId, db)
  if (game.success === false) return game

  if (game.status !== 'started') {
    return {
      message: 'Игра должна быть в процессе',
      nextCommand: { c: 'editGameGeneral', gameId: jsonCommand.gameId },
    }
  }

  // Получаем список команд участвующих в игре
  const gameTeams = await db.model('GamesTeams').find({
    gameId: jsonCommand.gameId,
  })

  const teamsIds = gameTeams.map((gameTeam) => gameTeam.teamId)

  const teams = await db.model('Teams').find({
    _id: { $in: teamsIds },
  })

  const taskDuration = game.taskDuration ?? 3600
  const cluesDuration = game.cluesDuration ?? 1200
  const breakDuration = game.breakDuration ?? 0

  const sortedTeams = [
    ...teams.map((team) => {
      const gameTeam = gameTeams.find(
        (gameTeam) => gameTeam.teamId === String(team._id)
      )
      const {
        activeNum,
        findedCodes,
        wrongCodes,
        startTime,
        endTime,
        findedBonusCodes,
        findedPenaltyCodes,
      } = gameTeam
      const activeTaskIndex = activeNum

      var startedTasks = 0
      startTime.forEach((time) => {
        if (time) ++startedTasks
      })
      const findedCodesCount =
        findedCodes?.length >= startedTasks
          ? findedCodes[activeTaskIndex]?.length ?? 0
          : 0
      const findedBonusCodesCount =
        findedBonusCodes?.length >= startedTasks
          ? findedBonusCodes[activeTaskIndex]?.length ?? 0
          : 0
      const findedPenaltyCodesCount =
        findedPenaltyCodes?.length >= startedTasks
          ? findedPenaltyCodes[activeTaskIndex]?.length ?? 0
          : 0
      const allFindedCodesCount =
        findedCodesCount + findedBonusCodesCount + findedPenaltyCodesCount
      const wrongCodesCount =
        wrongCodes?.length >= startedTasks
          ? wrongCodes[activeTaskIndex]?.length ?? 0
          : 0

      const isActiveTaskFinished =
        activeTaskIndex >= game.tasks.length ||
        endTime[activeTaskIndex] ||
        getSecondsBetween(startTime[activeTaskIndex]) > taskDuration
      const gameFinishTime = isActiveTaskFinished
        ? endTime[activeTaskIndex - 1] ||
          Date(getSecondsBetween(startTime[activeTaskIndex - 1]) + taskDuration)
        : null
      const isAllTasksStarted =
        startTime?.length === game.tasks.length &&
        startTime.filter((item) => item).length === game.tasks.length
      const isTeamFinished = isAllTasksStarted && isActiveTaskFinished
      const isTeamOnBreak = !!breakDuration && isActiveTaskFinished

      const isActiveTaskFailed = isActiveTaskFinished
        ? !endTime[activeTaskIndex]
        : false
      const activeTaskFinishTime = isActiveTaskFinished
        ? endTime[activeTaskIndex] || startTime[activeTaskIndex] + taskDuration
        : null

      const sumTimeByAllTasks = startTime.reduce((sum, timeStart, index) => {
        if (index > activeTaskIndex) return sum
        const timeEnd = endTime[index]
        if (index === activeTaskIndex) {
          if (isActiveTaskFinished)
            return sum + getSecondsBetween(timeStart, timeEnd)
          return sum + getSecondsBetween(timeStart)
        }

        // const sum = startTimes.reduce((sum, timeStart, i) => {
        // const timeEnd = endTimes[i]
        if (!timeStart || !timeEnd) return sum + taskDuration
        return sum + getSecondsBetween(timeStart, timeEnd)
        // },0)
      }, 0)

      const timeAfterEndTask = isTeamOnBreak
        ? getSecondsBetween(activeTaskFinishTime)
        : 0
      const breakTimeLeft = isTeamOnBreak ? breakDuration - timeAfterEndTask : 0

      return {
        team,
        startedTasks,
        activeTaskIndex,
        gameTeam,
        activeTaskStartTime: startTime[activeTaskIndex],
        allFindedCodesCount,
        wrongCodesCount,
        findedCodesCount,
        findedBonusCodesCount,
        findedPenaltyCodesCount,
        isTeamFinished,
        gameFinishTime,
        isTeamOnBreak,
        isActiveTaskFinished,
        isActiveTaskFailed,
        activeTaskFinishTime,
        timeAfterEndTask,
        breakTimeLeft,
        sumTimeByAllTasks,
      }
    }),
  ].sort((a, b) => {
    //TODO FIX SORTING
    // Если команды находятся на разных заданиях
    if (b.activeTaskIndex - a.activeTaskIndex !== 0)
      return b.activeTaskIndex - a.activeTaskIndex

    // Если хотябы одна из команд закончила игру
    if (a.isTeamFinished || b.isTeamFinished) {
      // Если только "a" команда закончила игру
      if (a.isTeamFinished && !b.isTeamFinished) return -1
      // Если только "b" команда закончила игру
      if (!a.isTeamFinished && b.isTeamFinished) return 1
      // Если обе команды закончили игру
      return a.sumTimeByAllTasks - b.sumTimeByAllTasks
    }

    // Если одна из команд на перерыве
    if (a.isTeamOnBreak || b.isTeamOnBreak) {
      // Если только "a" команда на перерыве
      if (a.isTeamOnBreak && !b.isTeamOnBreak) return -1
      // Если только "b" команда на перерыве
      if (!a.isTeamOnBreak && b.isTeamOnBreak) return 1
      // Если обе команды на перерыве
      return a.activeTaskFinishTime - b.activeTaskFinishTime
    }

    // Если одна из команд нашла больше кодов
    if (b.findedCodesCount - a.findedCodesCount !== 0)
      return b.findedCodesCount - a.findedCodesCount

    // Сравниваем время начала задания команд
    return a.activeTaskStartTime - b.activeTaskStartTime

    // return (
    //   b.activeTaskIndex - a.activeTaskIndex ||
    //   (a.isActiveTaskFinished && b.isActiveTaskFinished
    //     ? a.activeTaskFinishTime - b.activeTaskFinishTime
    //     : a.isActiveTaskFinished
    //     ? 1
    //     : b.isActiveTaskFinished
    //     ? -1
    //     : b.findedCodesCount - a.findedCodesCount ||
    //       a.activeTaskStartTime - b.activeTaskStartTime)
    // )
  })

  const textArray = sortedTeams.map(
    ({
      team,
      startedTasks,
      activeTaskIndex,
      gameTeam,
      findedCodesCount,
      wrongCodesCount,
      findedBonusCodesCount,
      findedPenaltyCodesCount,
      isTeamFinished,
      gameFinishTime,
      isTeamOnBreak,
      isActiveTaskFinished,
      isActiveTaskFailed,
      activeTaskFinishTime,
      timeAfterEndTask,
      breakTimeLeft,
      sumTimeByAllTasks,
    }) => {
      const timeSumText = `Суммарное время на задания ${secondsToTime(
        sumTimeByAllTasks
      )}`
      if (isTeamFinished)
        return `\u{1F3C1} <b>"${
          team.name
        }"</b> - завершили все задания ${dateToDateTimeStr(
          gameFinishTime,
          false,
          false,
          false,
          false
        ).join(' ')}. ${timeSumText}`

      // Проверяем, может задание выполнено или провалено и команда на перерыве
      if (isTeamOnBreak) {
        const nextTask = game.tasks[startedTasks]
        const taskNumber = numberToEmojis(startedTasks + 1)
        const isBreakExperied = breakTimeLeft <= 0
        return `${
          isBreakExperied ? '\u{231B}' : '\u{1F6AC}\u{1F51C}'
        }${taskNumber} <b>"${team.name}"</b> - ${
          isBreakExperied
            ? `Перерыв окончен\nОжидаем получение командой след. задания`
            : `Перерыв\nДо окончания перерыва ${secondsToTime(
                breakTimeLeft
              )}\nСлед. задание`
        } №${startedTasks + 1} "${nextTask.title}"${
          isActiveTaskFailed
            ? '\nПредыдущее задание провалено'
            : `\nПредыдущее задание выполнено за ${secondsToTime(
                getSecondsBetween(
                  gameTeam.startTime[activeTaskIndex],
                  gameTeam.endTime[activeTaskIndex]
                )
              )}. ${timeSumText}`
        }`
      }

      const taskNumber = numberToEmojis(startedTasks)
      const task = game.tasks[startedTasks - 1]
      const taskSecondsLeft = Math.floor(
        getSecondsBetween(gameTeam.startTime[startedTasks - 1])
      )
      const showCluesNum =
        cluesDuration > 0 ? Math.floor(taskSecondsLeft / cluesDuration) : 0

      const isTaskExperied = taskDuration - taskSecondsLeft < 0
      return `${isTaskExperied ? `\u{231B}` : `\u{1F3C3}`}${taskNumber} <b>"${
        team.name
      }"</b> - задание №${startedTasks} ${
        task.isBonustask ? '(БОНУСНОЕ) ' : ''
      }"${task.title}"${
        !isTaskExperied && showCluesNum > 0
          ? `, получена подсказка №${showCluesNum}`
          : ''
      } - ${
        isTaskExperied
          ? 'время вышло. Ожидаем получение след. задания'
          : `осталось ${secondsToTime(taskDuration - taskSecondsLeft)}`
      }. ${timeSumText}.${
        game.type === 'photo'
          ? `\nОтправленных фотографий - ${
              gameTeam.photos[startedTasks - 1]?.length || 0
            } шт.`
          : ''
      }${
        findedCodesCount > 0
          ? `\nНайденые коды (${findedCodesCount} шт.): "${gameTeam.findedCodes[
              startedTasks - 1
            ].join(`", "`)}"`
          : ''
      }${
        findedBonusCodesCount > 0
          ? `\nНайденые бонусные коды (${findedBonusCodesCount} шт.): "${gameTeam.findedBonusCodes[
              startedTasks - 1
            ].join(`", "`)}"`
          : ''
      }${
        findedPenaltyCodesCount > 0
          ? `\nНайденые штрафные коды (${findedPenaltyCodesCount} шт.): "${gameTeam.findedPenaltyCodes[
              startedTasks - 1
            ].join(`", "`)}"`
          : ''
      }${
        wrongCodesCount > 0
          ? `\nНеверно набраные коды (${wrongCodesCount} шт.): "${gameTeam.wrongCodes[
              startedTasks - 1
            ].join(`", "`)}"`
          : ''
      }`
    }
  )

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
        c: { c: 'editGameGeneral', gameId: jsonCommand.gameId },
      },
    ],
  }
}

export default gameStatus
