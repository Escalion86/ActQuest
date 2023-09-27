import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'

const editTask = async ({ telegramId, jsonCommand }) => {
  const checkData = check(jsonCommand, ['gameId', 'i'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand.gameId)
  if (game.success === false) return game
  if (!game.tasks)
    return {
      text: 'У игры нет заданий',
      c: { c: 'gameTasksEdit', gameId: jsonCommand.gameId },
    }

  const task = game.tasks[jsonCommand.i]
  if (!task)
    return {
      text: 'Задание не найдено',
      c: { c: 'gameTasksEdit', gameId: jsonCommand.gameId },
    }

  const codes =
    typeof task?.codes === 'object'
      ? task.codes.filter((code) => code !== '')
      : []
  return {
    // images: task.images ? task.images : undefined,
    message: `<b>Редактирование задания "${
      task?.title
    }"</b>\n\n<b>Задание</b>:\n"${task?.task}"\n\n<b>Подсказка №1</b>:\n"${
      task.clues[0].clue
    }"\n\n<b>Подсказка №2</b>:\n"${task.clues[1].clue}"\n\n<b>Коды (${
      codes.length ?? 0
    } шт)</b>:\n${
      codes.length > 0 ? codes.join(', ') : '[не задыны]'
    }\n\nКоличество кодов для выполнения: ${
      task.numCodesToCompliteTask ?? 'Все'
    }`,
    buttons: [
      {
        c: {
          c: 'setTaskT',
          gameId: jsonCommand.gameId,
          i: jsonCommand.i,
        },
        text: '\u{270F} Заголовок',
      },
      {
        c: {
          c: 'setTaskN',
          gameId: jsonCommand.gameId,
          i: jsonCommand.i,
        },
        text: '\u{270F} Задание',
      },
      {
        c: {
          c: 'setTaskI',
          gameId: jsonCommand.gameId,
          i: jsonCommand.i,
        },
        text: '\u{270F} Картинка',
      },
      {
        c: {
          c: 'setClue1',
          gameId: jsonCommand.gameId,
          i: jsonCommand.i,
        },
        text: '\u{270F} Подсказка №1',
      },
      {
        c: {
          c: 'setClue2',
          gameId: jsonCommand.gameId,
          i: jsonCommand.i,
        },
        text: '\u{270F} Подсказка №2',
      },
      [
        {
          c: {
            c: 'setCodes',
            gameId: jsonCommand.gameId,
            i: jsonCommand.i,
          },
          text: '\u{270F} Коды',
        },
        {
          c: {
            c: 'editPenaltyCodes',
            gameId: jsonCommand.gameId,
            i: jsonCommand.i,
          },
          text: '\u{270F} Штрафные коды',
        },
      ],
      {
        c: {
          c: 'setCNum',
          gameId: jsonCommand.gameId,
          i: jsonCommand.i,
        },
        text: '\u{270F} Кол-во кодов для выполнения',
      },
      {
        c: {
          c: 'delTask',
          gameId: jsonCommand.gameId,
          i: jsonCommand.i,
        },
        text: '\u{1F4A3} Удалить задание',
      },
      {
        c: { c: 'gameTasksEdit', gameId: jsonCommand.gameId },
        text: '\u{2B05} Назад',
      },
    ],
  }
}

export default editTask
