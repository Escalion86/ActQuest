import check from 'telegram/func/check'

const MODES = {
  penalty: 'penalty',
  time: 'time',
}

const setCluesEarlyMode = async ({ telegramId, jsonCommand, location, db }) => {
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  if (!jsonCommand.message) {
    return {
      message: 'Выберите способ досрочного получения подсказки',
      buttons: [
        [
          {
            text: 'Штраф организатора',
            c: { message: MODES.penalty },
          },
          {
            text: 'Добавить время до подсказки',
            c: { message: MODES.time },
          },
        ],
        {
          text: '\u{21A9} Назад',
          c: { c: 'cluesSettings', gameId: jsonCommand.gameId },
        },
      ],
    }
  }

  const mode = String(jsonCommand.message)

  if (!Object.values(MODES).includes(mode)) {
    return {
      success: false,
      message: 'Выберите один из предложенных вариантов.',
    }
  }

  await db.model('Games').findByIdAndUpdate(jsonCommand.gameId, {
    clueEarlyAccessMode: mode,
  })

  const modeText =
    mode === MODES.time
      ? 'Теперь подсказка выдается досрочно с добавлением времени до подсказки.'
      : 'Теперь подсказка выдается досрочно за штраф, заданный организатором.'

  return {
    success: true,
    message: modeText,
    nextCommand: { c: 'cluesSettings', gameId: jsonCommand.gameId },
  }
}

export default setCluesEarlyMode
