import check from 'telegram/func/check'

const setCluesEarlyMode = async ({ telegramId, jsonCommand, location, db }) => {
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  if (!jsonCommand.cm || !['penalty', 'time'].includes(jsonCommand.cm)) {
    return {
      message: 'Выберите способ досрочного получения подсказки',
      buttons: [
        [
          {
            text: 'Штраф организатора',
            c: { cm: 'penalty' },
          },
          {
            text: 'Добавить время до подсказки',
            c: { cm: 'time' },
          },
        ],
        {
          text: '\u{21A9} Назад',
          c: { c: 'cluesSettings', gameId: jsonCommand.gameId },
        },
      ],
    }
  }

  const mode = String(jsonCommand.cm)

  await db.model('Games').findByIdAndUpdate(jsonCommand.gameId, {
    clueEarlyAccessMode: mode,
  })

  const modeText =
    mode === 'time'
      ? 'Теперь подсказка выдается досрочно с добавлением времени до подсказки.'
      : 'Теперь подсказка выдается досрочно за штраф, заданный организатором.'

  return {
    success: true,
    message: modeText,
    nextCommand: { c: 'cluesSettings', gameId: jsonCommand.gameId },
  }
}

export default setCluesEarlyMode
