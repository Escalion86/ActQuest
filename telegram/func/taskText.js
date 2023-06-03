import getMinutesBetween from '@helpers/getMinutesBetween'

const taskText = ({ tasks, taskNum, findedCodes, startTaskTime }) => {
  const { task, codes, clues, numCodesToCompliteTask } = tasks[taskNum]

  const taskDuration = getMinutesBetween(startTaskTime)

  const showClue1 = taskDuration >= 20
  const showClue2 = taskDuration >= 40

  return `<b>Задание №${taskNum + 1}:</b>\n${task}${
    showClue1 ? `\n\n<b>Подсказка №1</b>:\n${clues[0].clue}` : ''
  }${showClue2 ? `\n\n<b>Подсказка №2</b>:\n${clues[1].clue}` : ''}${
    taskDuration < 40
      ? `\n\n<b>Время до подсказки</b>: ${taskDuration % 20}`
      : ''
  }\n\nКоличество кодов на локации: ${codes?.length ?? 0}${
    numCodesToCompliteTask
      ? `\nКоличество кодов необходимое для выполнения задания: ${numCodesToCompliteTask}`
      : ''
  }${
    findedCodes && findedCodes[taskNum]?.length > 0
      ? `\n\nНайденые коды: ${findedCodes[taskNum].join(', ')}`
      : ''
  }\n\nВведите код`
}

export default taskText
