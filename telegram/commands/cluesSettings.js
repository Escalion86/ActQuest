import secondsToTimeStr from '@helpers/secondsToTimeStr'
import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'

const cluesSettings = async ({ telegramId, jsonCommand, location, db }) => {
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand.gameId, db)
  if (game.success === false) return game

  const cluesDuration = game.cluesDuration ?? 0
  const penalty = game.clueEarlyPenalty ?? 0
  const allowCaptainForceClue = game.allowCaptainForceClue !== false
  const allowCaptainFailTask = game.allowCaptainFailTask !== false

  const cluesDurationText =
    cluesDuration <= 0
      ? '<b>Подсказки</b>: отключены'
      : `<b>Время до подсказки</b>: ${secondsToTimeStr(cluesDuration)}`

  const penaltyText =
    penalty > 0
      ? `<b>Штраф за досрочную подсказку</b>: ${secondsToTimeStr(penalty)}`
      : '<b>Штраф за досрочную подсказку</b>: отсутствует'

  return {
    message: `<b>Настройки подсказок</b>\n\n${cluesDurationText}\n${penaltyText}\n<b>Досрочная подсказка капитану</b>: ${
      allowCaptainForceClue ? 'разрешена' : 'запрещена'
    }\n<b>Слив задания капитаном</b>: ${
      allowCaptainFailTask ? 'разрешен' : 'запрещен'
    }`,
    buttons: [
      [
        {
          c: { c: 'setCluesDuration', gameId: jsonCommand.gameId },
          text: '\u{270F} Время до подсказки',
        },
      ],
      [
        {
          c: { c: 'setCluesPenalty', gameId: jsonCommand.gameId },
          text: '\u{270F} Штраф за досрочную подсказку',
        },
      ],
      [
        {
          c: { c: 'setCaptainForceClue', gameId: jsonCommand.gameId },
          text: allowCaptainForceClue
            ? '\u{1F6AB} Запретить досрочную подсказку'
            : '\u{2705} Разрешить досрочную подсказку',
        },
      ],
      [
        {
          c: { c: 'setCaptainFailTask', gameId: jsonCommand.gameId },
          text: allowCaptainFailTask
            ? '\u{1F6AB} Запретить слив задания'
            : '\u{2705} Разрешить слив задания',
        },
      ],
      [
        {
          c: { c: 'editGame', gameId: jsonCommand.gameId },
          text: '\u{21A9} Назад',
        },
      ],
    ],
  }
}

export default cluesSettings
