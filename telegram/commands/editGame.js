import secondsToTimeStr from '@helpers/secondsToTimeStr'
import moment from 'moment-timezone'
import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'

const editGame = async ({ telegramId, jsonCommand }) => {
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
    )}\n<b>Время до подсказки</b>: ${secondsToTimeStr(
      game?.cluesDuration ?? 1200
    )}\n<b>Перерыв между заданиями</b>: ${
      !game?.breakDuration
        ? 'отсутствует'
        : secondsToTimeStr(game?.breakDuration)
    }\n<b>Штраф за невыполнение задания</b>: ${
      !game?.taskFailurePenalty
        ? 'отсутствует'
        : secondsToTimeStr(game?.taskFailurePenalty)
    }\n\n<b>Режим выдачи заданий</b>: ${
      game.individualStart ? 'Индивидуальный' : 'Одновременно со всеми'
    }`,
    buttons: [
      {
        c: { c: 'gameStart', gameId: jsonCommand.gameId },
        text: '\u{26A1} ЗАПУСТИТЬ ИГРУ',
        hide: game.status !== 'active',
      },
      {
        c: { c: 'gameStop', gameId: jsonCommand.gameId },
        text: '\u{26D4} СТОП ИГРА!',
        hide: game.status !== 'started',
      },
      {
        c: { c: 'gameActive', gameId: jsonCommand.gameId },
        text: '\u{26A1} СДЕЛАТЬ АКТИВНОЙ',
        hide: game.status === 'active' || game.status === 'started',
      },
      {
        c: { c: 'gameAnonsMsg', gameId: jsonCommand.gameId },
        text: '\u{26A1} Отправить анонс игры всем подписчикам',
        hide: game.hidden || game.status !== 'active',
      },
      {
        c: { c: 'gameMsg', gameId: jsonCommand.gameId },
        text: '\u{26A1} Отправить всем участникам сообщение',
        // hide: game.status !== 'started',
      },
      [
        {
          c: { c: 'gameResultForm', gameId: jsonCommand.gameId },
          text: '\u{26A1} Сформировать результаты игры',
          hide: game.status !== 'finished',
        },
        {
          c: { c: 'gameResult', gameId: jsonCommand.gameId },
          text: '\u{1F4CB} Посмотреть результаты игры',
          hide: game.status !== 'finished' || !game.result,
        },
      ],
      {
        url: 'https://actquest.ru/game/result/' + jsonCommand.gameId,
        text: '\u{1F30F} Посмотреть результаты игры на сайте',
        hide: game.status !== 'finished' || !game.result,
      },
      {
        c: { c: 'gameStatus', gameId: jsonCommand.gameId },
        text: '\u{26A1} Посмотреть статус игры',
        hide: game.status !== 'started',
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
      ],
      [
        {
          c: {
            c: 'setBreakDuration',
            gameId: jsonCommand.gameId,
          },
          text: '\u{270F} Перерыв',
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
        c: {
          c: 'hideGame',
          gameId: jsonCommand.gameId,
        },
        text: '\u{1F648} Скрыть',
        hide: game.hidden,
      },
      {
        c: {
          c: 'unhideGame',
          gameId: jsonCommand.gameId,
        },
        text: '\u{1F441} Отобразить',
        hide: !game.hidden,
      },
      {
        c: { c: 'deleteGame', gameId: jsonCommand.gameId },
        text: '\u{1F4A3} Удалить игру',
      },
      { c: 'menuGamesEdit', text: '\u{2B05} Назад' },
    ],
  }
}

export default editGame
