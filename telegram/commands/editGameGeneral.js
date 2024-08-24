import { getNounTeams, getNounWrongCodes } from '@helpers/getNoun'
import secondsToTimeStr from '@helpers/secondsToTimeStr'
import GamesTeams from '@models/GamesTeams'
import Teams from '@models/Teams'
import moment from 'moment-timezone'
import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'

const editGameGeneral = async ({ telegramId, jsonCommand, domen }) => {
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand.gameId)
  if (game.success === false) return game

  const gameTeams = await GamesTeams.find({ gameId: jsonCommand?.gameId })

  const teamsIds =
    gameTeams?.length > 0 ? gameTeams.map((gameTeam) => gameTeam.teamId) : []

  const teams =
    teamsIds.length > 0
      ? await Teams.find({
          _id: { $in: teamsIds },
        })
      : []

  return {
    images: game.image ? [game.image] : undefined,
    message: `${
      game.hidden ? '<b>(ИГРА СКРЫТА!)</b>\n' : ''
    }<b>Управление игрой "${game?.name}"</b>\n\n<b>Дата и время</b>:\n${
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
    }${
      game.manyCodesPenalty && game.manyCodesPenalty[0] > 0
        ? `\n<b>Штраф за большое кол-во неверно введенных кодов в одном задании</b>: ${secondsToTimeStr(
            game.manyCodesPenalty[1]
          )} за ${getNounWrongCodes(game.manyCodesPenalty[0])}`
        : ''
    }\n\n<b>Режим выдачи заданий</b>: ${
      game.individualStart ? 'Индивидуальный' : 'Одновременно со всеми'
    }${
      game.status === 'finished'
        ? `\n\n<b>Результаты</b>: ${
            game.result
              ? `сформированы и ${
                  game.hideResult ? 'СКРЫТЫ \u{1F648}' : 'ОТКРЫТЫ \u{1F441}'
                }`
              : 'не сформированы'
          }`
        : ''
    }\n\n<b>Код для присоединения к игре</b>:\n<b><code>${
      jsonCommand.gameId
    }</code></b>\n\nНа игру зарегистрировано ${getNounTeams(teams.length)}`,
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
        c: { c: 'checkGameTeamsDoubles', gameId: jsonCommand.gameId },
        text: '\u{26A1} Проверить игроков на задвоение',
        hide: game.status !== 'active',
      },
      {
        c: { c: 'gameAnonsMsg', gameId: jsonCommand.gameId },
        text: '\u{1F4E2} Отправить анонс игры всем подписчикам',
        hide: game.hidden || game.status !== 'active',
      },
      {
        c: { c: 'gameMsg', gameId: jsonCommand.gameId },
        text: '\u{1F4E2} Отправить всем участникам сообщение',
        // hide: game.status !== 'started',
      },
      [
        {
          c: { c: 'gameResultForm', gameId: jsonCommand.gameId },
          text: game.result
            ? '\u{1F504} Обновить результаты'
            : '\u{26A1} Сформировать результаты',
          hide: game.status !== 'finished',
        },
        {
          c: {
            c: game.hideResult ? 'gameResultShow' : 'gameResultHide',
            gameId: jsonCommand.gameId,
          },
          text: game.hideResult
            ? '\u{1F441} Открыть результаты'
            : '\u{1F648} Скрыть результаты',
          hide: !game.result,
        },
      ],
      [
        {
          c: { c: 'gameResultAdminBack', gameId: jsonCommand.gameId },
          text: '\u{1F4CB} Посмотреть результаты',
          hide: game.status !== 'finished' || !game.result,
        },
        {
          url:
            'https://actquest.ru/' +
            domen +
            '/game/result/' +
            jsonCommand.gameId,
          text: '\u{1F30F} на сайте',
          hide: game.status !== 'finished' || !game.result,
        },
      ],
      {
        c: { c: 'gameStatus', gameId: jsonCommand.gameId },
        text: '\u{26A1} Посмотреть статус игры',
        hide: game.status !== 'started',
      },
      {
        url:
          'https://actquest.ru/' +
          domen +
          '/game/location/' +
          jsonCommand.gameId,
        text: '\u{1F30F} команды на карте',
        // hide: game.status !== 'started',
      },
      {
        c: { c: 'editGame', gameId: jsonCommand.gameId },
        text: '\u{270F} Редактировать игру',
      },
      [
        {
          c: { c: 'gameTeamsAdmin', gameId: jsonCommand.gameId },
          text: `\u{1F465} Управление командами (${teams.length})`,
          hidden: teams.length === 0,
        },
      ],
      // [
      //   {
      //     c: { c: 'gameAddings', gameId: jsonCommand.gameId },
      //     text: '\u{1F48A} Добавить бонусы/штрафы командам',
      //     // hide: game.status !== 'finished',
      //   },
      // ],
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
        c: { c: 'delGame', gameId: jsonCommand.gameId },
        text: '\u{1F5D1} Удалить игру',
      },
      { c: 'menuGamesEdit', text: '\u{2B05} Назад' },
    ],
  }
}

export default editGameGeneral
