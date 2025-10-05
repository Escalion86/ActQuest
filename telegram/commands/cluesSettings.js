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
  const clueEarlyMode =
    game.clueEarlyAccessMode === 'time' ? 'time' : 'penalty'

  const cluesDurationText =
    cluesDuration <= 0
      ? '<b>Подсказки</b>: отключены'
      : `<b>Время до подсказки</b>: ${secondsToTimeStr(cluesDuration)}`

  const penaltyText =
    clueEarlyMode === 'penalty'
      ? penalty > 0
        ? `<b>Штраф за досрочную подсказку</b>: ${secondsToTimeStr(penalty)}`
        : '<b>Штраф за досрочную подсказку</b>: отсутствует'
      : '<b>Штраф за досрочную подсказку</b>: не используется'

  const modeText =
    clueEarlyMode === 'penalty'
      ? '<b>Способ досрочной подсказки</b>: штраф организатора'
      : '<b>Способ досрочной подсказки</b>: добавляется оставшееся время до подсказки'

  return {
    message: `<b>Настройки подсказок</b>\n\n${cluesDurationText}\n${penaltyText}\n${modeText}\n<b>Досрочная подсказка капитану</b>: ${
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
          c: { c: 'setCluesEarlyMode', gameId: jsonCommand.gameId },
          text: '\u{2699}\u{FE0F} Способ досрочной подсказки',
        },
        {
          c: { c: 'setCluesPenalty', gameId: jsonCommand.gameId },
          text: '\u{270F} Штраф за досрочную подсказку',
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
