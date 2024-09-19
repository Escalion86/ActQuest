import check from 'telegram/func/check'
import Games from '@models/Games'
import secondsToTimeStr from '@helpers/secondsToTimeStr'
import arrayOfCommands from 'telegram/func/arrayOfCommands'

const cancelButton = (jsonCommand) => ({
  c: { c: 'editSubTasks', gameId: jsonCommand.gameId, i: jsonCommand.i },
  text: '\u{1F6AB} Отмена создания доп. задания',
})

const array = [
  {
    prop: 'name',
    message: 'Введите название доп. задания',
    answerMessage: (answer) => `Название доп. задания "${answer}"`,
    answerConverter: (answer) => answer.trim(),
    buttons: (jsonCommand) => [cancelButton(jsonCommand)],
  },
  {
    prop: 'task',
    message: 'Введите само доп. задание',
    answerMessage: (answer) =>
      `Задано доп. задание <blockquote>${answer}</blockquote>`,
    answerConverter: (answer) => answer.trim(),
    buttons: (jsonCommand) => [cancelButton(jsonCommand)],
  },
  {
    prop: 'bonus',
    message:
      'Введите бонус в баллах за выполнение доп. задания (число большее нуля)',
    checkAnswer: (answer) => {
      const answerNum = Number(answer)
      return answerNum == answer && answerNum > 0
    },
    errorMessage: (answer) => `Бонус должен быть больше нуля!`,
    answerMessage: (answer) => `Задан бонус "${answer} б."`,
    buttons: (jsonCommand) => [cancelButton(jsonCommand)],
  },
]

const addSubTask = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['gameId', 'i', 'j'])
  if (checkData) return checkData

  return await arrayOfCommands({
    array,
    jsonCommand,
    onFinish: async (result) => {
      const newSubTask = {
        name: result.name,
        task: result.task,
        bonus: result.bonus,
      }

      // Если все переменные на месте, то создаем команду
      const game = await Games.findById(jsonCommand.gameId)
      game.tasks[jsonCommand.i].subTasks.push(newSubTask)

      await Games.findByIdAndUpdate(jsonCommand.gameId, {
        tasks: game.tasks,
      })

      return {
        success: true,
        message: `Доп. задание "${result.name}" создано`,
        nextCommand: {
          c: 'editSubTasks',
          gameId: jsonCommand.gameId,
          i: jsonCommand.i,
        },
      }
    },
  })
}

export default addSubTask
