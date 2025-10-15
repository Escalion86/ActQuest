import getSecondsBetween from '@helpers/getSecondsBetween'
import secondsToTime from './secondsToTime'
import { getNounCodes, getNounPoints } from '@helpers/getNoun'
import secondsToTimeStr from '@helpers/secondsToTimeStr'

const taskText = ({
  game,
  taskNum,
  findedCodes,
  findedBonusCodes,
  findedPenaltyCodes,
  startTaskTime,
  cluesDuration = 1200,
  taskDuration = 3600,
  photos,
  timeAddings,
  visibleCluesCount,
  includeActionPrompt = true,
  format = 'telegram',
}) => {
  const { tasks } = game
  const {
    task,
    codes,
    bonusCodes,
    penaltyCodes,
    clues,
    numCodesToCompliteTask,
    taskBonusForComplite,
    subTasks,
  } = tasks[taskNum]
  const currentTaskId = tasks[taskNum]?._id ? String(tasks[taskNum]._id) : null
  const startTaskDate =
    startTaskTime instanceof Date && !Number.isNaN(startTaskTime.getTime())
      ? startTaskTime
      : null

  const taskSecondsLeft = startTaskDate
    ? Math.floor(getSecondsBetween(startTaskDate))
    : 0

  const haveBonusCodes = bonusCodes?.length > 0
  const havePenaltyCodes = penaltyCodes?.length > 0

  const findedCodesInTask =
    typeof findedCodes === 'object' && findedCodes[taskNum]
      ? findedCodes[taskNum]
      : []
  const numOfCodesToFind = numCodesToCompliteTask ?? codes.length
  const numOfCodesToFindLeft = numOfCodesToFind - findedCodesInTask.length

  const showCluesNum =
    cluesDuration > 0 ? Math.floor(taskSecondsLeft / cluesDuration) : 0
  const totalCluesCount = Array.isArray(clues) ? clues.length : 0
  const effectiveVisibleClues = Math.min(
    totalCluesCount,
    Math.max(
      0,
      Number.isInteger(visibleCluesCount)
        ? visibleCluesCount
        : Math.max(showCluesNum, 0)
    )
  )
  var cluesText = ''
  if (cluesDuration > 0 && effectiveVisibleClues > 0)
    for (let i = 0; i < effectiveVisibleClues; i++) {
      if (clues[i]?.clue)
        cluesText += `\n\n<b>Подсказка №${i + 1}</b>:\n<blockquote>${
          clues[i].clue
        }</blockquote>`
    }

  const relevantAddings = Array.isArray(timeAddings)
    ? timeAddings.filter(({ taskIndex, taskId }) => {
        if (currentTaskId && taskId) return taskId === currentTaskId
        if (taskId && !currentTaskId) return false
        if (typeof taskIndex === 'number') return taskIndex === taskNum
        return typeof taskIndex !== 'number'
      })
    : []

  const addingsSummary =
    relevantAddings.length > 0
      ? `\n\n<b>Штрафы текущего задания:</b>\n${relevantAddings
          .map(({ name, time }) => {
            const isBonus = time < 0
            const timeText = secondsToTimeStr(Math.abs(time), true)
            const icon = isBonus ? '\u{1F7E2}' : '\u{1F534}'
            return `${icon} ${timeText} - ${name}`
          })
          .join('\n')}`
      : ''

  const showTimedCountdown =
    cluesDuration > 0 && effectiveVisibleClues < totalCluesCount

  const nextClueIndex = effectiveVisibleClues + 1
  const secondsToNextClue = showTimedCountdown
    ? Math.max(nextClueIndex * cluesDuration - taskSecondsLeft, 0)
    : 0
  const secondsToTaskFinish = Math.max(taskDuration - taskSecondsLeft, 0)

  const countdownLabel = showTimedCountdown
    ? 'Время до подсказки'
    : 'Время до завершения задания'

  const countdownSeconds = showTimedCountdown
    ? secondsToNextClue
    : secondsToTaskFinish

  const targetTimestamp = (() => {
    if (!startTaskDate) return null
    const base = startTaskDate.getTime()
    if (showTimedCountdown) {
      return base + nextClueIndex * cluesDuration * 1000
    }
    return base + taskDuration * 1000
  })()

  const countdownValue = (() => {
    if (format === 'web') {
      const attributes = [
        `data-task-countdown="${showTimedCountdown ? 'hint' : 'task'}"`,
        'data-refresh-on-complete="true"',
      ]
      if (Number.isFinite(targetTimestamp)) {
        attributes.push(`data-target="${targetTimestamp}"`)
      }
      if (Number.isFinite(countdownSeconds)) {
        attributes.push(`data-seconds="${countdownSeconds}"`)
      }

      return `<span ${attributes.join(' ')}>${secondsToTime(
        countdownSeconds
      )}</span>`
    }

    return secondsToTime(countdownSeconds)
  })()

  const actionPrompt = `<b>${
    game.type === 'photo' ? 'ОТПРАВТЕ ФОТО' : 'ВВЕДИТЕ КОД'
  }</b>`

  return `<b>Задание №${taskNum + 1}${
    task.isBonusTask ? ' (БОНУСНОЕ)' : ''
  }:</b>\n<blockquote>${task}</blockquote>${cluesText}${
    game.type !== 'photo' && (haveBonusCodes || havePenaltyCodes)
      ? `\n\n<b>Внимание:</b> На месте есть ${
          haveBonusCodes && havePenaltyCodes
            ? `бонусные (${bonusCodes.length} шт.) и штрафные (${penaltyCodes.length} шт.)`
            : haveBonusCodes
            ? `бонусные (${bonusCodes.length} шт.)`
            : `штрафные (${penaltyCodes.length} шт.)`
        } коды!${
          haveBonusCodes
            ? ' Бонусные коды сработают, только если ввести его до завершения задания (ввода основных кодов)'
            : ''
        }`
      : ''
  }${
    game.type === 'photo'
      ? `\n\n<b>За выполнение основного задания</b>: ${getNounPoints(
          taskBonusForComplite || 0
        )}\n\n<b>Доп. задания</b>:${
          !subTasks?.length
            ? ' отсутствуют'
            : `\n${
                subTasks.length > 0
                  ? subTasks
                      .map(
                        ({ name, task, bonus }) =>
                          `"${name}" - ${getNounPoints(
                            bonus
                          )}\n<blockquote>${task}</blockquote>`
                      )
                      .join('')
                  : ''
              }`
        }`
      : `\n\n<b>Количество кодов на локации:</b> ${codes?.length ?? 0}${
          numCodesToCompliteTask
            ? `\n<b>Количество кодов необходимое для выполнения задания:</b> ${numCodesToCompliteTask}`
            : ''
        }`
  }${
    game.type !== 'photo' &&
    findedBonusCodes &&
    findedBonusCodes[taskNum]?.length > 0
      ? `\n\n<b>Найденные бонусные коды:</b>\n${bonusCodes
          .filter(({ code }) => findedBonusCodes[taskNum].includes(code))
          .map(
            ({ code, bonus, description }) =>
              `"${code}" - ${secondsToTimeStr(bonus)} - ${description}`
          )
          .join('\n')}`
      : ''
  }${
    game.type !== 'photo' &&
    findedPenaltyCodes &&
    findedPenaltyCodes[taskNum]?.length > 0
      ? `\n\n<b>Найденные штрафные коды:</b>\n${penaltyCodes
          .filter(({ code }) => findedPenaltyCodes[taskNum].includes(code))
          .map(
            ({ code, penalty, description }) =>
              `"${code}" - ${secondsToTimeStr(penalty)} - ${description}`
          )
          .join('\n')}`
      : ''
  }${
    game.type !== 'photo' && findedCodes && findedCodes[taskNum]?.length > 0
      ? `\n\n<b>Найденные коды:</b>\n"${findedCodes[taskNum].join(
          '", "'
        )}"\n\nОсталось найти ${getNounCodes(numOfCodesToFindLeft)}`
      : ''
  }${
    game.type === 'photo' && photos && photos[taskNum]?.photos?.length > 0
      ? `\n\n<b>Получено фото-ответов</b>: ${photos[taskNum]?.photos.length} шт.`
      : ''
  }${addingsSummary}\n\n<b>${countdownLabel}</b>: ${countdownValue}${
    includeActionPrompt ? `\n\n${actionPrompt}` : ''
  }`
}

export default taskText
