import { getNounPoints } from '@helpers/getNoun'
import secondsToTimeStr from '@helpers/secondsToTimeStr'
import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'

const gameTaskView = async ({ telegramId, jsonCommand }) => {
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

  const { clues, taskBonusForComplite, subTasks } = task
  const cluesText =
    typeof clues === 'object' && jsonCommand.showClue
      ? clues
          .filter(({ clue }, index) => jsonCommand.showClue >= index + 1)
          .map(
            ({ clue, images }, index) =>
              `\n\n<b>Подсказка №${
                index + 1
              }</b>:\n<blockquote>${clue}</blockquote>`
          )
          .join('')
      : ''

  const sumOfBonuses =
    game.type === 'photo'
      ? (taskBonusForComplite || 0) +
        (subTasks?.length
          ? subTasks.reduce((sum, { bonus }) => sum + (bonus || 0), 0)
          : 0)
      : 0

  const coordinates = task.coordinates || {}
  const latitude = coordinates?.latitude
  const longitude = coordinates?.longitude
  // const radius = coordinates?.radius

  return {
    // images: task.images ? task.images : undefined,
    message: `<b>Просмотр задания</b>\n"${task?.title}"${
      task.canceled ? `\n\n\u{26D4} <b>ЗАДАНИЕ ОТМЕНЕНО!</b>` : ''
    }\n\n<b>Координаты</b>: ${
      !latitude || !longitude
        ? '[не заданы]'
        : `<code>${latitude} ${longitude}</code>`
    }\n\n<b>Текст задания</b>:${
      !task?.task ? ' [не задано]' : `\n<blockquote>${task?.task}</blockquote>`
    }${cluesText}${
      game.type === 'photo'
        ? `\n\n<b>Список доп. заданий</b>:${
            !task?.subTasks?.length
              ? ' пуст'
              : `\n${
                  task?.subTasks.length > 0
                    ? task?.subTasks
                        .map(
                          ({ name, task, bonus }) =>
                            `"${name}" - ${getNounPoints(
                              bonus
                            )}\n<blockquote>${task}</blockquote>`
                        )
                        .join('')
                    : ''
                }`
          }`
        : `\n\n<b>Коды (${codes.length ?? 0} шт)</b>:\n${
            codes.length > 0 ? codes.join(', ') : '[не задыны]'
          }${
            bonusCodes.length > 0
              ? `\n\n<b>Бонусные коды (${bonusCodes.length} шт)</b>:\n${
                  bonusCodes.length > 0
                    ? bonusCodes
                        .map(
                          ({ code, bonus, description }) =>
                            `"${code}" - ${secondsToTimeStr(
                              bonus
                            )} - ${description}`
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
          }`
    }${
      game.type === 'photo'
        ? `\n\n<b>Бонус за выполнение задания</b>: ${getNounPoints(
            task.taskBonusForComplite || 0
          )}\n\n<b>Суммарный максимум баллов за задание</b>: ${getNounPoints(
            sumOfBonuses
          )}`
        : ''
    }${
      task.postMessage
        ? `\n\n<b>Сообщение после задания</b>:\n"${task.postMessage}"`
        : ''
    }`,
    buttons: [
      {
        c: { showClue: (jsonCommand.showClue ?? 0) + 1 },
        text: '\u{2B50} Показать подсказку',
        hide: typeof clues !== 'object' || jsonCommand.showClue >= clues.length,
      },
      // {
      //   c: { showAnswer: true },
      //   text: '\u{2B05} Показать Ответ',
      //   hide: typeof clues === 'object' && jsonCommand.showClue < clues.length
      // },
      {
        c: { c: 'gameTasksView', gameId: jsonCommand.gameId },
        text: '\u{2B05} Назад',
      },
    ],
  }
}

export default gameTaskView
