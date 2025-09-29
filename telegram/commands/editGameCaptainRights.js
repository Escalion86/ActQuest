import check from 'telegram/func/check'
import getGame from 'telegram/func/getGame'

const editGameCaptainRights = async ({ jsonCommand, db }) => {
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand.gameId, db)
  if (game.success === false) return game

  const toggleKey = jsonCommand.toggle
  const availableToggles = [
    'allowCaptainForceClue',
    'allowCaptainFailTask',
    'allowCaptainFinishBreak',
  ]

  if (toggleKey && availableToggles.includes(toggleKey)) {
    const currentValue = game?.[toggleKey] !== false
    const nextValue = !currentValue

    await db.model('Games').findByIdAndUpdate(jsonCommand.gameId, {
      [toggleKey]: nextValue,
    })

    game[toggleKey] = nextValue
  }

  const allowCaptainForceClue = game.allowCaptainForceClue !== false
  const allowCaptainFailTask = game.allowCaptainFailTask !== false
  const allowCaptainFinishBreak = game.allowCaptainFinishBreak !== false

  return {
    message: `<b>Права капитанов</b>\n\n<b>Досрочная подсказка</b>: ${
      allowCaptainForceClue ? 'разрешена' : 'запрещена'
    }\n<b>Слив задания</b>: ${
      allowCaptainFailTask ? 'разрешен' : 'запрещен'
    }\n<b>Завершение перерыва</b>: ${
      allowCaptainFinishBreak ? 'разрешено' : 'запрещено'
    }`,
    buttons: [
      [
        {
          c: {
            c: 'editGameCaptainRights',
            gameId: jsonCommand.gameId,
            toggle: 'allowCaptainForceClue',
          },
          text: `${allowCaptainForceClue ? '✅' : '❌'} Досрочная подсказка`,
        },
      ],
      [
        {
          c: {
            c: 'editGameCaptainRights',
            gameId: jsonCommand.gameId,
            toggle: 'allowCaptainFailTask',
          },
          text: `${allowCaptainFailTask ? '✅' : '❌'} Слив задания`,
        },
      ],
      [
        {
          c: {
            c: 'editGameCaptainRights',
            gameId: jsonCommand.gameId,
            toggle: 'allowCaptainFinishBreak',
          },
          text: `${allowCaptainFinishBreak ? '✅' : '❌'} Завершение перерыва`,
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

export default editGameCaptainRights
