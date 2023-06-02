const taskText = ({ tasks, taskNum, findedCodes }) => {
  const { task, codes, numCodesToCompliteTask } = tasks[taskNum]
  return `<b>Задание №${taskNum}</b>\n\n${task}\n\nКоличество кодов на локации: ${
    codes?.length ?? 0
  }${
    numCodesToCompliteTask
      ? `\nКоличество кодов необходимое для выполнения задания: ${numCodesToCompliteTask}`
      : ''
  }
${
  findedCodes && findedCodes?.length > 0
    ? `\n\nНайденые коды: ${findedCodes}`
    : ''
}`
}

export default taskText
