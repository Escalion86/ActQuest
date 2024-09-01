import { getNounPoints, getNounWrongCodes } from '@helpers/getNoun'
import secondsToTimeStr from '@helpers/secondsToTimeStr'
import moment from 'moment-timezone'
import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'

const editGame = async ({ telegramId, jsonCommand, domen }) => {
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand.gameId)
  if (game.success === false) return game

  return {
    images: game.image ? [game.image] : undefined,
    message: `${
      game.hidden ? '<b>(ИГРА СКРЫТА!)</b>\n' : ''
    }<b>Редактирование игры "${game?.name}"</b>\n\n<b>Дата и время</b>:\n${
      game.dateStart
        ? moment(game.dateStart)
            .tz('Asia/Krasnoyarsk')
            .format('DD.MM.yyyy H:mm')
        : '[не заданы]'
    }\n\n<b>Описание</b>:\n${
      game?.description ? `"${game?.description}"` : '[без описания]'
    }\n\n<b>Время и место сбора</b>: ${
      game?.startingPlace ?? '[не заданы]'
    }\n\n<b>Место сбора после игры</b>: ${
      game?.finishingPlace ?? '[не задано]'
    }\n\n<b>Количество заданий</b>: ${
      game?.tasks?.length ?? 0
    }\n<b>Максимальная продолжительность одного задания</b>: ${secondsToTimeStr(
      game?.taskDuration ?? 3600
    )}\n${
      game?.cluesDuration === 0
        ? '<b>Подсказки</b>: отключены'
        : `<b>Время до подсказки</b>: ${secondsToTimeStr(
            game?.cluesDuration ?? 1200
          )}`
    }\n<b>Перерыв между заданиями</b>: ${
      !game?.breakDuration
        ? 'отсутствует'
        : secondsToTimeStr(game?.breakDuration)
    }\n<b>Штраф за невыполнение задания</b>: ${
      !game?.taskFailurePenalty
        ? 'отсутствует'
        : game.type === 'photo'
        ? getNounPoints(game?.taskFailurePenalty)
        : secondsToTimeStr(game?.taskFailurePenalty)
    }${
      game.manyCodesPenalty && game.manyCodesPenalty[0] > 0
        ? `\n<b>Штраф за большое кол-во неверно введенных кодов в одном задании</b>: ${secondsToTimeStr(
            game.manyCodesPenalty[1]
          )} за ${getNounWrongCodes(game.manyCodesPenalty[0])}`
        : ''
    }\n\n<b>Режим выдачи заданий</b>: ${
      game.individualStart ? 'Индивидуальный' : 'Одновременно со всеми'
    }`,
    buttons: [
      {
        c: { c: 'setGameType', gameId: jsonCommand.gameId },
        text: `Тип игры ${
          game.type === 'photo' ? '\u{1F4F7} Фотоквест' : '\u{1F697} Классика'
        }`,
      },
      [
        {
          c: { c: 'setGameName', gameId: jsonCommand.gameId },
          text: '\u{270F} Название',
        },
        {
          c: {
            c: 'setGameDesc',
            gameId: jsonCommand.gameId,
          },
          text: '\u{270F} Описание',
        },
        ,
        {
          c: {
            c: 'setGameDate',
            gameId: jsonCommand.gameId,
          },
          text: '\u{270F} Дата и время',
        },
      ],
      [
        {
          c: {
            c: 'setGameImage',
            gameId: jsonCommand.gameId,
          },
          text: '\u{270F} Картинка',
        },
        {
          c: {
            c: 'gameTasksEdit',
            gameId: jsonCommand.gameId,
          },
          text: '\u{270F} Задания',
        },
      ],
      [
        {
          c: {
            c: 'setTaskDuration',
            gameId: jsonCommand.gameId,
          },
          text: '\u{270F} Время задания',
        },
        {
          c: {
            c: 'setCluesDuration',
            gameId: jsonCommand.gameId,
          },
          text: '\u{270F} До подсказки',
        },
        {
          c: {
            c: 'setBreakDuration',
            gameId: jsonCommand.gameId,
          },
          text: '\u{270F} Перерыв',
        },
      ],
      [
        {
          c: {
            c: 'setManyCodesPenalty',
            gameId: jsonCommand.gameId,
          },
          text: '\u{270F} Штраф за много кодов',
          hide: game.type === 'photo',
        },
        {
          c: {
            c: 'setTaskPenalty',
            gameId: jsonCommand.gameId,
          },
          text: '\u{270F} Штраф за провал',
        },
      ],
      {
        c: {
          c: 'setGameIndividualStart',
          gameId: jsonCommand.gameId,
        },
        text: '\u{270F} Режим выдачи заданий',
      },
      [
        {
          c: { c: 'setGameStartingPlace', gameId: jsonCommand.gameId },
          text: '\u{1F4CC} Место сбора',
        },
        {
          c: {
            c: 'setGameFinishingPlace',
            gameId: jsonCommand.gameId,
          },
          text: '\u{1F4CC} Место сбора после игры',
        },
      ],
      {
        c: { c: 'editGameGeneral', gameId: jsonCommand.gameId },
        text: '\u{2B05} Назад',
      },
    ],
  }
}

export default editGame
