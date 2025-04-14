import { getNounPoints, getNounWrongCodes } from '@helpers/getNoun'
import isGameHaveErrors from '@helpers/isGameHaveErrors'
import secondsToTimeStr from '@helpers/secondsToTimeStr'
import moment from 'moment-timezone'
import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'

const editGame = async ({ telegramId, jsonCommand, location, db }) => {
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand.gameId, db)
  if (game.success === false) return game

  const tasksCount = game?.tasks
    ? game.tasks.filter(({ canceled }) => !canceled).length
    : 0

  const canceledTasksCount = game?.tasks
    ? game.tasks.filter(({ canceled }) => canceled).length
    : 0

  const haveErrorsInTasks = isGameHaveErrors(game)

  return {
    images: game.image ? [game.image] : undefined,
    message: `${game.status === 'canceled' ? '<b>(ИГРА ОТМЕНЕНА!)</b>\n' : ''}${
      game.hidden ? '<b>(ИГРА СКРЫТА!)</b>\n' : ''
    }<b>Редактирование игры "${game?.name}"</b>\n\n<b>Дата и время</b>: ${
      game.dateStart
        ? moment(game.dateStart)
            .tz('Asia/Krasnoyarsk')
            .format('DD.MM.yyyy H:mm')
        : '[не заданы]'
    }\n\n<b>Тип игры</b>: ${
      game.type === 'photo' ? `\u{1F4F7} Фотоквест` : `\u{1F697} Классика`
    }\n\n<b>Описание</b>:\n${
      game?.description ? `"${game?.description}"` : '[без описания]'
    }\n\n<b>Время и место сбора</b>: ${
      game?.startingPlace ?? '[не заданы]'
    }\n\n<b>Место сбора после игры</b>: ${
      game?.finishingPlace ?? '[не задано]'
    }\n\n<b>Количество заданий</b>: ${tasksCount}${
      canceledTasksCount > 0 ? ` (отмененных ${canceledTasksCount})` : ''
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
    }\n\n<b>Стоимость участия</b>: ${
      !game.prices || game.prices?.length === 0
        ? 'не указано'
        : game.prices.length === 1
        ? game.prices[0].price === 0
          ? 'бесплатно'
          : `${game.prices[0].price} руб.`
        : game.prices.map(({ name, price }) => `\n- ${name}: ${price} руб.`)
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
          text: `${haveErrorsInTasks ? '\u{2757} ' : ''}\u{270F} Задания`,
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
      {
        c: {
          c: 'editGamePrices',
          gameId: jsonCommand.gameId,
        },
        text: '\u{1F4B2} Варианты и цены участия',
      },
      [
        {
          c: { c: 'setGameStartingPlace', gameId: jsonCommand.gameId },
          text: `${
            game?.startingPlace ? '\u{2757} ' : ''
          }\u{1F4CC} Место сбора`,
        },
        {
          c: {
            c: 'setGameFinishingPlace',
            gameId: jsonCommand.gameId,
          },
          text: `${
            game?.finishingPlace ? '\u{2757} ' : ''
          }\u{1F4CC} Место сбора после игры`,
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
