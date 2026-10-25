import check from 'telegram/func/check'
import formatGameName from 'telegram/func/formatGameName'
import getGame from 'telegram/func/getGame'
import sendMessage from 'telegram/sendMessage'
import buildGameResultSnapshots from '@server/buildGameResultSnapshots'
import withGameTeamsLocked from '@server/withGameTeamsLocked'

const runInBackground = (label, job) => {
  Promise.resolve()
    .then(job)
    .catch((error) => {
      console.error(`[background] ${label} failed`, error)
    })
}

const gameStop = async ({ telegramId: _telegramId, jsonCommand, location, db }) => {
  const checkData = check(jsonCommand, ['gameId'])
  if (checkData) return checkData

  const game = await getGame(jsonCommand.gameId, db)
  if (game.success === false) return game

  if (!jsonCommand.confirm) {
    return {
      success: true,
      message: `Подтвердите остановку игры ${formatGameName(game)}`,
      buttons: [
        {
          text: '\u{26D4} СТОП ИГРА',
          c: { confirm: true },
        },
        {
          text: '\u{1F6AB} Отмена',
          c: { c: 'editGameGeneral', gameId: jsonCommand.gameId },
        },
      ],
    }
  }

  const stopped = await withGameTeamsLocked({ db, gameId: jsonCommand.gameId }, async ({
    game: currentGame, teams, Games, assertHeld,
  }) => {
    if (['finished', 'closed'].includes(currentGame.status)) {
      return { alreadyStopped: true, message: 'Игра уже остановлена.' }
    }
    if (currentGame.status !== 'started') return { success: false, message: 'Игра ещё не запущена.' }
    const stoppedAt = new Date()
    const snapshots = await buildGameResultSnapshots({
      db, gameId: jsonCommand.gameId,
      game: { ...currentGame, dateEndFact: stoppedAt },
      gameTeams: teams.map(({ gameProcessLock: _lock, ...team }) => team),
    })
    await assertHeld()
    // Все принятые до захвата блокировок ответы включены в снимок.
    // Ожидающие запросы перечитают finished после освобождения блокировки.
    await Games.findByIdAndUpdate(currentGame._id, {
      status: 'finished', dateEndFact: stoppedAt,
      result: { ...snapshots, teamsPlaces: {}, computed: null, text: '' },
    })
    return { snapshots }
  })
  if (stopped.success === false || stopped.alreadyStopped) return stopped
  const snapshots = stopped.snapshots

  const teamsUsers = Array.isArray(snapshots.teamsUsers) ? snapshots.teamsUsers : []
  // Получаем telegramId всех участников игры (только валидные числа)
  const allUsersTelegramIds = Array.from(
    new Set(
      teamsUsers
        .map((teamUser) => Number(teamUser?.userTelegramId))
        .filter((telegramId) => Number.isFinite(telegramId)),
    ),
  )

  await db.model('LastCommands').updateMany(
    {
      userTelegramId: { $in: allUsersTelegramIds },
    },
    {
      command: { c: 'mainMenu' },
      // prevCommand: prevCommand?.command,
      // messageId,
    },
    { upsert: true }
  )

  if (allUsersTelegramIds.length > 0) {
    runInBackground('game stop telegram notifications', async () => {
      await Promise.allSettled(
        allUsersTelegramIds.map((telegramId) =>
          sendMessage({
            chat_id: telegramId,
            text: `\u{26D4}\u{26D4}\u{26D4} СТОП ИГРА \u{26D4}\u{26D4}\u{26D4}\n\n\nКоды больше не принимаются. ${
              game.showFinishingPlace && game.finishingPlace
                ? `Просим все команды прибыть на точку сбора: ${game.finishingPlace}`
                : ''
            }`,
            location,
          }),
        ),
      )
    })
  }

  return {
    message: `СТОП ИГРА!!\n\nИгра ${formatGameName(
      game
    )} ОСТАНОВЛЕНА.\n\n\u{26A0} Все игроки оповещены!`,
    nextCommand: { c: 'editGameGeneral', gameId: jsonCommand.gameId },
  }
}

export default gameStop
