import Games from '@models/Games'
import dbConnect from '@utils/dbConnect'

const array = [
  {
    prop: 'title',
    message: 'Введите заголовок задания (во время игры игроки его не увидят)',
    answerMessage: (answer) => `Задан заголовок задания "${answer}"`,
    buttons: (jsonCommand) => [
      {
        cmd: { cmd: 'gameTasksEdit', gameId: jsonCommand.gameId },
        text: '\u{1F6AB} Отмена создания задания',
      },
    ],
  },
  {
    prop: 'task',
    message: 'Введите задание',
    answerMessage: (answer) => `Задание введено`,
    buttons: (jsonCommand) => [
      {
        cmd: { cmd: 'gameTasksEdit', gameId: jsonCommand.gameId },
        text: '\u{1F6AB} Отмена создания задания',
      },
    ],
  },
  {
    prop: 'image',
    message: 'Отправьте картинку к заданию (если есть)',
    answerMessage: (answer) => `Картинка задания загружена`,
    buttons: (jsonCommand) => [
      {
        cmd: { image: '' },
        text: 'Без картинки',
      },
      {
        cmd: { cmd: 'gameTasksEdit', gameId: jsonCommand.gameId },
        text: '\u{1F6AB} Отмена создания задания',
      },
    ],
  },
  {
    prop: 'clue1',
    message: 'Введите первую подсказку',
    answerMessage: (answer) => `Первая подсказка введена`,
    buttons: (jsonCommand) => [
      {
        cmd: { cmd: 'gameTasksEdit', gameId: jsonCommand.gameId },
        text: '\u{1F6AB} Отмена создания задания',
      },
    ],
  },
  {
    prop: 'clueImage1',
    message: 'Отправьте картинку первой подсказки (не обязательно)',
    answerMessage: (answer) => `Картинка первой подсказки загружена`,
    buttons: (jsonCommand) => [
      {
        cmd: { clueImage1: '' },
        text: 'Без картинки',
      },
      {
        cmd: { cmd: 'gameTasksEdit', gameId: jsonCommand.gameId },
        text: '\u{1F6AB} Отмена создания задания',
      },
    ],
  },
  {
    prop: 'clue2',
    message: 'Введите вторую подсказку',
    answerMessage: (answer) => `Вторая подсказка введена`,
    buttons: (jsonCommand) => [
      {
        cmd: { cmd: 'gameTasksEdit', gameId: jsonCommand.gameId },
        text: '\u{1F6AB} Отмена создания задания',
      },
    ],
  },
  {
    prop: 'clueImage2',
    message: 'Отправьте картинку второй подсказки (не обязательно)',
    answerMessage: (answer) => `Картинка второй подсказки загружена`,
    buttons: (jsonCommand) => [
      {
        cmd: { clueImage2: '' },
        text: 'Без картинки',
      },
      {
        cmd: { cmd: 'gameTasksEdit', gameId: jsonCommand.gameId },
        text: '\u{1F6AB} Отмена создания задания',
      },
    ],
  },
]

const createTask = async ({ telegramId, jsonCommand }) => {
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
      const value = jsonCommand.message

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

  const newTask = {
    title: jsonCommand.title,
    task: jsonCommand.task,
    images: jsonCommand.image ? [jsonCommand.image] : [],
    clues: [
      {
        clue: jsonCommand.clue1,
        images: jsonCommand.clueImage1 ? [jsonCommand.clueImage1] : [],
      },
      {
        clue: jsonCommand.clue2,
        images: jsonCommand.clueImage2 ? [jsonCommand.clueImage2] : [],
      },
    ],
  }

  // Если все переменные на месте, то создаем команду
  await dbConnect()
  const game = await Games.findById(jsonCommand.gameId)
  await Games.findByIdAndUpdate(jsonCommand.gameId, {
    tasks: game.tasks ? [...game.tasks, newTask] : [newTask],
  })

  return {
    success: true,
    message: `Задание "${jsonCommand.title}" создано`,
    nextCommand: { cmd: 'gameTasksEdit', gameId: jsonCommand.gameId },
  }
}

export default createTask
