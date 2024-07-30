import check from 'telegram/func/check'
import Games from '@models/Games'
// import dbConnect from '@utils/dbConnect'
import secondsToTimeStr from '@helpers/secondsToTimeStr'

const cancelButton = (jsonCommand) => ({
  c: { c: 'editPenaltyCodes', gameId: jsonCommand.gameId, i: jsonCommand.i },
  text: '\u{1F6AB} Отмена создания штрафного кода',
})

const array = [
  {
    prop: 'code',
    message: 'Введите штрафной код',
    answerMessage: (answer) => `Штрафной код "${answer}"`,
    buttons: (jsonCommand) => [cancelButton(jsonCommand)],
  },
  {
    prop: 'penalty',
    message: 'Введите штраф в секундах',
    answerMessage: (answer) =>
      `Задан штраф по времени "${secondsToTimeStr(answer)}"`,
    buttons: (jsonCommand) => [cancelButton(jsonCommand)],
  },
  {
    prop: 'description',
    message: 'Введите описание штрафного кода (за что выдан код?)',
    answerMessage: (answer) => `Задано описание штрафного кода "${answer}"`,
    buttons: (jsonCommand) => [cancelButton(jsonCommand)],
  },
]

const addPenaltyCode = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['gameId', 'i', 'j'])
  if (checkData) return checkData

  // Если это запрос (команда), то отправляем текст пользователю
  if (!jsonCommand.message) {
    for (let i = 0; i < array.length; i++) {
      const data = array[i]
      if (jsonCommand[data.prop] === undefined) {
        return {
          success: true,
          message: data.message,
          buttons: data.buttons(jsonCommand),
          // nextCommand: `/menuTeams`,
        }
      }
    }
  }

  // Если это ответ на запрос, то смотрим какую переменную (key) последнюю внесли
  for (let i = 0; i < array.length; i++) {
    const data = array[i]
    if (jsonCommand[data.prop] === undefined) {
      const value =
        typeof array[i].answerConverter === 'function'
          ? array[i].answerConverter(jsonCommand.message)
          : jsonCommand.message

      if (i < array.length - 1) {
        return {
          success: true,
          message: array[i].answerMessage(value),
          // buttons: data.buttons(jsonCommand),
          nextCommand: { [data.prop]: value },
        }
      } else {
        jsonCommand[data.prop] = value
      }
    }
  }

  const newPenaltyCode = {
    penalty: jsonCommand.penalty,
    code: jsonCommand.code,
    description: jsonCommand.description,
  }

  // Если все переменные на месте, то создаем команду
  // await dbConnect() // TODO: Нужно ли это?
  const game = await Games.findById(jsonCommand.gameId)
  game.tasks[jsonCommand.i].penaltyCodes.push(newPenaltyCode)

  await Games.findByIdAndUpdate(jsonCommand.gameId, {
    tasks: game.tasks,
  })

  return {
    success: true,
    message: `Штрафной код "${jsonCommand.code}" создан`,
    nextCommand: {
      c: 'editPenaltyCodes',
      gameId: jsonCommand.gameId,
      i: jsonCommand.i,
    },
  }
}

export default addPenaltyCode
