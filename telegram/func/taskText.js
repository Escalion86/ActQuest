import getSecondsBetween from '@helpers/getSecondsBetween'
import secondsToTime from './secondsToTime'

const taskText = ({
  tasks,
  taskNum,
  findedCodes,
  startTaskTime,
  cluesDuration = 1200,
}) => {
  const { task, codes, clues, numCodesToCompliteTask } = tasks[taskNum]
  console.log('!1 :>> ')
  const taskDuration = Math.floor(getSecondsBetween(startTaskTime))

  const showCluesNum = Math.floor(taskDuration / cluesDuration)
  console.log('!2 :>> ')
  const cluesText = ''
  if (cluesDuration > 0 && showCluesNum > 0)
    for (let i = 0; i < showCluesNum; i++) {
      if (clues[i]?.clue)
        cluesText += `\n\n<b>Подсказка №${i + 1}</b>:\n${clues[i].clue}`
    }
  console.log('!3 :>> ')

  return `<b>Задание №${
    taskNum + 1
  }:</b>\n${task}${cluesText}${`\n\n<b>Время до ${
    cluesDuration > 0 && showCluesNum < clues?.length
      ? 'подсказки'
      : 'завершения задания'
  }</b>: ${secondsToTime(
    cluesDuration - (taskDuration % cluesDuration)
  )}`}\n\nКоличество кодов на локации: ${codes?.length ?? 0}${
    numCodesToCompliteTask
      ? `\nКоличество кодов необходимое для выполнения задания: ${numCodesToCompliteTask}`
      : ''
  }${
    findedCodes && findedCodes[taskNum]?.length > 0
      ? `\n\nНайденые коды: "${findedCodes[taskNum].join('", "')}"`
      : ''
  }\n\n<b>ВВЕДИТЕ КОД</b>`
}

export default taskText
