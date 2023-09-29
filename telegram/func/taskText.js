import getSecondsBetween from '@helpers/getSecondsBetween'
import secondsToTime from './secondsToTime'
import { getNounCodes } from '@helpers/getNoun'
import secondsToTimeStr from '@helpers/secondsToTimeStr'

const taskText = ({
  tasks,
  taskNum,
  findedCodes,
  findedBonusCodes,
  findedPenaltyCodes,
  startTaskTime,
  cluesDuration = 1200,
  taskDuration = 3600,
}) => {
  console.log('taskText=>startTaskTime :>> ', startTaskTime)
  const { task, codes, bonusCodes, penaltyCodes, clues, numCodesToCompliteTask } = tasks[taskNum]
  const taskSecondsLeft = Math.floor(getSecondsBetween(startTaskTime))

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
        cluesText += `\n\n<b>Подсказка №${i + 1}</b>:\n${clues[i].clue}`
    }

  const 

  return `<b>Задание №${
    taskNum + 1
  }:</b>\n${task}${cluesText}${`\n\n<b>Время до ${
    cluesDuration > 0 && showCluesNum < clues?.length
      ? 'подсказки'
      : 'завершения задания'
  }</b>: ${
    cluesDuration > 0
      ? secondsToTime(cluesDuration - (taskSecondsLeft % cluesDuration))
      : secondsToTime(taskDuration - taskSecondsLeft)
  }`}\n\nКоличество кодов на локации: ${codes?.length ?? 0}${
    numCodesToCompliteTask
      ? `\nКоличество кодов необходимое для выполнения задания: ${numCodesToCompliteTask}`
      : ''
  }${
    findedBonusCodes && findedBonusCodes[taskNum]?.length > 0
      ? `\n\nНайденые бонусные коды:\n${bonusCodes.filter(({code}) => findedBonusCodes[taskNum].includes(code)).map(({code, bonus, description}) => `"${code}" - ${secondsToTimeStr(bonus)} - ${description}`).join(', ')}`
      : ''
  }${
    findedPenaltyCodes && findedPenaltyCodes[taskNum]?.length > 0
      ? `\n\nНайденые штрафные коды:\n${penaltyCodes.filter(({code}) => findedPenaltyCodes[taskNum].includes(code)).map(({code, bonus, description}) => `"${code}" - ${secondsToTimeStr(bonus)} - ${description}`).join(', ')}`
      : ''
  }${
    findedCodes && findedCodes[taskNum]?.length > 0
      ? `\n\nНайденые коды:\n"${findedCodes[taskNum].join(
          '", "'
        )}"\n\nОсталось найти ${getNounCodes(numOfCodesToFindLeft)}`
      : ''
  }\n\n<b>ВВЕДИТЕ КОД</b>`
}

export default taskText
