import secondsToTimeStr from '@helpers/secondsToTimeStr'
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
  const penaltyCodes =
    typeof task?.penaltyCodes === 'object' ? task.penaltyCodes : []
  const bonusCodes = typeof task?.bonusCodes === 'object' ? task.bonusCodes : []

  const { clues } = task
  const cluesText =
    typeof clues === 'object'
      ? clues
          .map(
            ({ clue, images }, index) =>
              `\n\n<b>Подсказка №${
                index + 1
              }</b>:\n<blockquote>${clue}</blockquote>`
          )
          .join('')
      : ''

  return {
    // images: task.images ? task.images : undefined,
    message: `<b>Редактирование задания</b>\n"${
      task?.title
    }"\n\n<b>Текст задания</b>:\n<blockquote>${
      task?.task
    }</blockquote>${cluesText}\n\n<b>Коды (${codes.length ?? 0} шт)</b>:\n${
      codes.length > 0 ? codes.join(', ') : '[не задыны]'
    }${
      bonusCodes.length > 0
        ? `\n\n<b>Бонусные коды (${bonusCodes.length} шт)</b>:\n${
            bonusCodes.length > 0
              ? bonusCodes
                  .map(
                    ({ code, bonus, description }) =>
                      `"${code}" - ${secondsToTimeStr(bonus)} - ${description}`
                  )
                  .join(',\n')
              : '[не задыны]'
          }`
        : ''
    }${
      penaltyCodes.length > 0
        ? `\n\n<b>Штрафные коды (${penaltyCodes.length} шт)</b>:\n${
            penaltyCodes.length > 0
              ? penaltyCodes
                  .map(
                    ({ code, penalty, description }) =>
                      `"${code}" - ${secondsToTimeStr(
                        penalty
                      )} - ${description}`
                  )
                  .join(',\n')
              : '[не задыны]'
          }`
        : ''
    }\n\n<b>Количество кодов для выполнения</b>: ${
      task.numCodesToCompliteTask ?? 'Все'
    }${
      task.postMessage
        ? `\n\n<b>Сообщение после задания</b>:\n"${task.postMessage}"`
        : ''
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
      // {
      //   c: {
      //     c: 'setTaskI',
      //     gameId: jsonCommand.gameId,
      //     i: jsonCommand.i,
      //   },
      //   text: '\u{270F} Картинка',
      // },
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
            c: 'setCNum',
            gameId: jsonCommand.gameId,
            i: jsonCommand.i,
          },
          text: '\u{270F} Кол-во кодов для выполнения',
        },
      ],
      [
        {
          c: {
            c: 'editBonusCodes',
            gameId: jsonCommand.gameId,
            i: jsonCommand.i,
          },
          text: '\u{270F} Бонусные коды',
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
          c: 'setTaskPostMessage',
          gameId: jsonCommand.gameId,
          i: jsonCommand.i,
        },
        text: '\u{270F} Сообщение после задания',
      },
      {
        c: {
          c: 'delTask',
          gameId: jsonCommand.gameId,
          i: jsonCommand.i,
        },
        text: '\u{1F5D1} Удалить задание',
      },
      {
        c: { c: 'gameTasksEdit', gameId: jsonCommand.gameId },
        text: '\u{2B05} Назад',
      },
    ],
  }
}

export default editTask
