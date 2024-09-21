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
  } = tasks[taskNum]
  const taskSecondsLeft = Math.floor(getSecondsBetween(startTaskTime))

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
  var cluesText = ''
  if (cluesDuration > 0 && showCluesNum > 0)
    for (let i = 0; i < showCluesNum; i++) {
      if (clues[i]?.clue)
        cluesText += `\n\n<b>Подсказка №${i + 1}</b>:\n<blockquote>${
          clues[i].clue
        }</blockquote>`
    }

  return `<b>Задание №${
    taskNum + 1
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
  }${`\n\n${
    cluesDuration > 0 && showCluesNum < clues?.length
      ? `<b>Время до подсказки</b>: ${secondsToTime(
          cluesDuration - (taskSecondsLeft % cluesDuration)
        )}`
      : `<b>Время до завершения задания</b>: ${secondsToTime(
          taskDuration - taskSecondsLeft
        )}`
  }`}${
    game.type === 'photo'
      ? `\n<b>Бонус за выполнение задания</b>: ${getNounPoints(
          taskBonusForComplite || 0
        )}`
      : `\n<b>Количество кодов на локации:</b> ${codes?.length ?? 0}${
          numCodesToCompliteTask
            ? `\n<b>Количество кодов необходимое для выполнения задания:</b> ${numCodesToCompliteTask}`
            : ''
        }`
  }${
    game.type !== 'photo' &&
    findedBonusCodes &&
    findedBonusCodes[taskNum]?.length > 0
      ? `\n\n<b>Найденые бонусные коды:</b>\n${bonusCodes
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
      ? `\n\n<b>Найденые штрафные коды:</b>\n${penaltyCodes
          .filter(({ code }) => findedPenaltyCodes[taskNum].includes(code))
          .map(
            ({ code, penalty, description }) =>
              `"${code}" - ${secondsToTimeStr(penalty)} - ${description}`
          )
          .join('\n')}`
      : ''
  }${
    game.type !== 'photo' && findedCodes && findedCodes[taskNum]?.length > 0
      ? `\n\n<b>Найденые коды:</b>\n"${findedCodes[taskNum].join(
          '", "'
        )}"\n\nОсталось найти ${getNounCodes(numOfCodesToFindLeft)}`
      : ''
  }${
    game.type === 'photo' && photos && photos[taskNum]?.photos?.length > 0
      ? `\n\n<b>Получено фото-ответов</b>: ${photos[taskNum]?.photos.length} шт.`
      : ''
  }\n\n<b>${game.type === 'photo' ? 'ОТПРАВТЕ ФОТО' : 'ВВЕДИТЕ КОД'}</b>`
}

export default taskText
