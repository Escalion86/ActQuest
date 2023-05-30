import formatDateTime from '@helpers/formatDateTime'
import dbConnect from '@utils/dbConnect'
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
      cmd: { cmd: 'gameTasksEdit', gameId: jsonCommand.gameId },
    }

  const task = game.tasks[jsonCommand.i]
  if (!task)
    return {
      text: 'Задание не найдено',
      cmd: { cmd: 'gameTasksEdit', gameId: jsonCommand.gameId },
    }

  return {
    // images: task.images ? task.images : undefined,
    message: `<b>Редактирование задания "${
      task?.title
    }"</b>.\n\n<b>Задание</b>:\n"${task?.task}"\n\n<b>Подсказка №1</b>:\n"${
      task.clues[0].clue
    }"\n\n<b>Подсказка №2</b>:\n"${task.clues[1].clue}"\n\n<b>Коды</b>:\n"${
      task.codes ? task.codes.join(', ') : '[не задыны]'
    }"`,
    buttons: [
      {
        cmd: {
          cmd: 'setTaskT',
          gameId: jsonCommand.gameId,
          i: jsonCommand.i,
        },
        text: '\u{270F} Изменить заголовок задания',
      },
      {
        cmd: {
          cmd: 'setTaskN',
          gameId: jsonCommand.gameId,
          i: jsonCommand.i,
        },
        text: '\u{270F} Изменить текст задания',
      },
      {
        cmd: {
          cmd: 'setClue1',
          gameId: jsonCommand.gameId,
          i: jsonCommand.i,
        },
        text: '\u{270F} Изменить текст подсказки №1',
      },
      {
        cmd: {
          cmd: 'setClue2',
          gameId: jsonCommand.gameId,
          i: jsonCommand.i,
        },
        text: '\u{270F} Изменить текст подсказки №2',
      },
      {
        cmd: {
          cmd: 'setCodes',
          gameId: jsonCommand.gameId,
          i: jsonCommand.i,
        },
        text: '\u{270F} Изменить коды подсказки №2',
      },
      {
        cmd: {
          cmd: 'delTask',
          gameId: jsonCommand.gameId,
          i: jsonCommand.i,
        },
        text: '\u{1F4A3} Удалить задание',
      },
      {
        cmd: { cmd: 'gameTasksEdit', gameId: jsonCommand.gameId },
        text: '\u{2B05} Назад',
      },
    ],
  }
}

export default editTask
