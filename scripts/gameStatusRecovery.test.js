import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { resolveParticipationMetricsTransition } from '../helpers/gameParticipation.js'
import { buildCompletedParticipationStats, buildParticipationSnapshot } from '../server/buildCompletedParticipationStats.js'

// Выполняем настоящие обработчики; подменяем только авторизацию и инфраструктуру.
const loadHandler = async (path, name, dependencies) => {
  const source = await readFile(new URL(path, import.meta.url), 'utf8')
  const executable = source
    .replace(/import\s+[\s\S]*?\s+from\s+['"][^'"]+['"]\s*\n/g, '')
    .replace(/export async function/g, 'async function')
  return new Function(...Object.keys(dependencies), `${executable}\nreturn ${name}`)(...Object.values(dependencies))
}

const historicalGame = () => ({
  _id: '6a933422a42d54e00305aa56',
  location: 'ekb',
  type: 'classic',
  status: 'canceled',
  dateStartFact: '2026-09-26T14:10:48.073Z',
  dateEndFact: '2026-09-26T18:00:40.508Z',
  result: {
    teams: [{ _id: 'team', name: 'Историческая команда' }],
    gameTeams: [{ _id: 'registration', teamId: 'team', findedCodes: [['КОД']], timeAddings: [{ value: 30 }] }],
    teamsUsers: [{ userId: 'historic-user', teamId: 'team' }],
    teamsPlaces: { team: 1 },
    computed: { teams: [{ teamId: 'team', total: 100 }] },
    text: 'Сохранённые результаты',
  },
})

const updateHarness = async (initialGame = historicalGame(), canManage = true) => {
  const game = structuredClone(initialGame)
  Object.defineProperty(game, 'toObject', { value: () => structuredClone({ ...game }) })
  const calls = { snapshots: 0, rebuilds: 0, writes: 0, stats: 0, ratings: 0, history: [] }
  const Games = {
    findById: async () => game,
    findByIdAndUpdate: async (id, update) => {
      calls.writes += 1
      Object.assign(game, update)
      return game
    },
  }
  const db = { model: (name) => {
    assert.equal(name, 'Games', 'Восстановление не должно менять живой прогресс команд')
    return Games
  } }
  const dependencies = {
    runLocationLegacyHandler: async ({ request, handler }) => {
      const res = { status(code) { this.statusCode = code; return this }, json(data) { return { status: this.statusCode, data } } }
      return handler({ method: 'PUT', query: { id: game._id, location: game.location }, body: { data: request }, session: { user: { id: 'admin', role: 'admin', name: 'Администратор' } } }, res)
    },
    dbConnectGlobal: async () => db,
    canManageGame: () => canManage,
    fetchGameHistoryState: async ({ game: value }) => ({ game: structuredClone({ ...value }), gameTeams: [] }),
    protectStoryScenarioUpdate: ({ updateData }) => updateData,
    isIndividualGameStart: () => false,
    resolveParticipationMetricsTransition,
    validateClassicVariants: () => [],
    hasClassicVariants: () => false,
    buildGameResultSnapshots: async () => {
      calls.snapshots += 1
      return { teams: [{ _id: 'new-team' }], gameTeams: [], teamsUsers: [{ userId: 'new-user' }] }
    },
    buildGameResultComputed: async ({ game: value }) => {
      calls.rebuilds += 1
      assert.deepEqual(value.result.teamsUsers, initialGame.result.teamsUsers)
      return { teamsPlaces: { team: 1 }, computed: { restored: true } }
    },
    updateParticipantsClosedStats: async ({ game: value }) => {
      calls.stats += 1
      const { userGamesByKey } = buildCompletedParticipationStats([value])
      calls.participation = buildParticipationSnapshot({ gamesById: userGamesByKey.get('uid:historic-user'), nowIso: '2026-10-08T00:00:00Z' })
    },
    updateParticipantsRatings: async () => { calls.ratings += 1 },
    recordGameHistoryEntry: async (entry) => { calls.history.push(entry) },
    buildGameHistorySnapshot: (state) => state,
  }
  const PUT = await loadHandler('../app/api/[location]/games/[id]/route.js', 'PUT', dependencies)
  return { game, calls, update: (data) => PUT(data, {}) }
}

for (const requestedStatus of ['finished', 'reopen']) {
  test(`восстановление canceled через ${requestedStatus} сохраняет исторические результаты и участников`, async () => {
    const before = historicalGame()
    const { game, calls, update } = await updateHarness(before)
    const response = await update({ status: requestedStatus })
    assert.equal(response.status, 200)
    assert.equal(game.status, 'finished')
    assert.deepEqual(game.result, before.result)
    assert.equal(game.dateStartFact, before.dateStartFact)
    assert.equal(game.dateEndFact, before.dateEndFact)
    assert.equal(calls.snapshots, 0)
    assert.equal(calls.rebuilds, 0)
    assert.equal(calls.stats, 1)
    assert.equal(calls.participation.playedGamesCount, 1)
    assert.equal(calls.ratings, 0)
    assert.equal(calls.history.length, 1)
    assert.equal(calls.history[0].beforeState.game.status, 'canceled')
    assert.equal(calls.history[0].afterState.game.status, 'finished')
    assert.equal(calls.history[0].actor.userId, 'admin')
  })
}

test('нельзя восстановить непроведённую отменённую игру без исторических снимков', async () => {
  const { calls, update } = await updateHarness({ ...historicalGame(), result: null, dateEndFact: null })
  const response = await update({ status: 'finished' })
  assert.equal(response.status, 409)
  assert.equal(calls.writes, 0)
  assert.equal(calls.snapshots, 0)
})

test('дата окончания без снимков не разрешает восстановление', async () => {
  const { calls, update } = await updateHarness({ ...historicalGame(), result: null })
  assert.equal((await update({ status: 'finished' })).status, 409)
  assert.equal(calls.writes, 0)
})

test('при восстановлении нельзя подменить результат или даты', async () => {
  const { calls, update } = await updateHarness()
  assert.equal((await update({ status: 'finished', result: null, dateEndFact: null })).status, 409)
  assert.equal(calls.writes, 0)
})

test('проведённую отменённую игру нельзя случайно активировать вместо восстановления', async () => {
  const { calls, update } = await updateHarness()
  assert.equal((await update({ status: 'active' })).status, 409)
  assert.equal(calls.writes, 0)
})

test('непроведённую отменённую игру можно активировать', async () => {
  const { game, update } = await updateHarness({ ...historicalGame(), result: null, dateStartFact: null, dateEndFact: null })
  assert.equal((await update({ status: 'active' })).status, 200)
  assert.equal(game.status, 'active')
})

test('без рассчитанных итогов восстановление пересчитывает только сохранённые снимки', async () => {
  const before = historicalGame()
  before.result.computed = null
  const { game, calls, update } = await updateHarness(before)
  assert.equal((await update({ status: 'finished' })).status, 200)
  assert.deepEqual(game.result.teamsUsers, before.result.teamsUsers)
  assert.deepEqual(game.result.gameTeams, before.result.gameTeams)
  assert.equal(calls.snapshots, 0)
  assert.equal(calls.rebuilds, 1)
})

test('повторное восстановление не дублирует участие и не создаёт новый снимок', async () => {
  const { calls, update } = await updateHarness()
  assert.equal((await update({ status: 'finished' })).status, 200)
  assert.equal((await update({ status: 'finished' })).status, 200)
  assert.equal(calls.stats, 1)
  assert.equal(calls.participation.playedGamesCount, 1)
  assert.equal(calls.snapshots, 0)
})

test('первичная остановка started по-прежнему формирует снимок', async () => {
  const initial = { ...historicalGame(), status: 'started', result: null }
  const { calls, update } = await updateHarness(initial)
  // Для первичного результата состав должен браться из текущих регистраций.
  // Проверяем вызов; тестовая инфраструктура расчёта не использует старый состав.
  initial.result = { teamsUsers: [{ userId: 'new-user' }] }
  assert.equal((await update({ status: 'finished' })).status, 200)
  assert.equal(calls.snapshots, 1)
})

test('восстановление требует права управлять игрой', async () => {
  const { calls, update } = await updateHarness(historicalGame(), false)
  assert.equal((await update({ status: 'finished' })).status, 403)
  assert.equal(calls.writes, 0)
})

const loadClientCallback = async (name, dependencies) => {
  const source = await readFile(new URL('../components/cabinet/app-router/GamesPageClient.js', import.meta.url), 'utf8')
  const start = source.indexOf(`  const ${name} = `)
  const bodyStart = source.indexOf('(', start) + 1
  const end = name === 'statusModalActions'
    ? source.indexOf('}, [statusModalGame', bodyStart) + 1
    : source.indexOf('\n    [\n', bodyStart)
  const callback = source.slice(bodyStart, end).trim().replace(/,$/, '')
  return new Function(...Object.keys(dependencies), `return (${callback})`)(...Object.values(dependencies))
}

test('кабинет предлагает восстановление проведённой игры, а не активацию', async () => {
  for (const metadata of [{ isResultGenerated: true }, { dateEndFact: '2026-09-26T18:00:40.508Z' }]) {
    const callback = await loadClientCallback('statusModalActions', {
      statusModalGame: { status: 'canceled', ...metadata },
      isGameConducted: () => true,
    })
    const actions = callback()
    assert.equal(actions[0].id, 'restore_finished_game')
    assert.equal(actions[0].label, 'Восстановить в «Завершена»')
    assert.equal(actions.some((action) => action.id === 'activate_game'), false)
  }
  const callback = await loadClientCallback('statusModalActions', {
    statusModalGame: { status: 'canceled', isResultGenerated: false, dateEndFact: null },
    isGameConducted: () => false,
  })
  assert.equal(callback()[0].id, 'activate_game')
})

test('кнопка восстановления отправляет только finished без запуска, остановки или сброса', async () => {
  const requests = []
  const feedback = []
  const callback = await loadClientCallback('handleStatusAction', {
    statusModalGame: { id: 'game', status: 'canceled' },
    canEditAllGames: true,
    canManageGameStatus: () => true,
    CABINET_GAMES_API_BASE: '/api/cabinet/games',
    setIsStatusChanging: () => {},
    setStatusProgressMessage: () => {},
    setStatusValidationResult: () => {},
    setIsStatusModalOpen: () => {},
    setToastEvent: () => {},
    setFeedback: (value) => feedback.push(value),
    requestApiJson: async (url, options) => requests.push({ url, options }),
    queryClient: { invalidateQueries: async () => {} },
    gamesQuery: { refetch: async () => {} },
  })
  await callback('restore_finished_game')
  assert.equal(requests.length, 1)
  assert.equal(requests[0].url, '/api/cabinet/games/game')
  assert.equal(requests[0].options.method, 'PUT')
  assert.deepEqual(JSON.parse(requests[0].options.body), { data: { status: 'finished' } })
  assert.equal(feedback.at(-1).type, 'success')
})

test('отказ подтверждать отмену не меняет статус игры', async () => {
  let confirmed = false
  const callback = await loadClientCallback('handleStatusAction', {
    statusModalGame: { id: 'game', status: 'finished' },
    canEditAllGames: true,
    canManageGameStatus: () => true,
    window: { confirm: (message) => { confirmed = true; assert.match(message, /статистики участия/); return false } },
  })
  // Обращение к инфраструктуре после отказа вызовет ошибку: она намеренно не передана.
  await callback('cancel_game')
  assert.equal(confirmed, true)
})

if (process.env.GAME_STATUS_RECOVERY_FIXTURE) {
  test('проверка восстановления на прочитанном снимке настоящей игры без записи в рабочую БД', async () => {
    const before = JSON.parse(await readFile(process.env.GAME_STATUS_RECOVERY_FIXTURE, 'utf8'))
    const { game, calls, update } = await updateHarness(before)
    assert.equal((await update({ status: 'finished' })).status, 200)
    assert.deepEqual(game.result, before.result)
    assert.equal(calls.snapshots, 0)
    assert.equal(calls.rebuilds, 0)
    assert.equal(game.dateEndFact, before.dateEndFact)
    console.log(`Сохранены: команд ${game.result.teams.length}, записей участников ${game.result.teamsUsers.length}, мест ${Object.keys(game.result.teamsPlaces).length}`)
  })
}

test('список истории сохраняет автора и дату, не смешивает типы проекции и не загружает тело снимков', async () => {
  let projection
  const entries = [{ _id: 'latest', actor: { name: 'Администратор' }, createdAt: new Date('2026-10-01T15:13:03.102Z'), summary: 'Отмена игры', snapshot: { schemaVersion: 1 } }]
  const query = (value) => ({ select: () => ({ lean: async () => value }) })
  const dependencies = {
    NextResponse: { json: (data, options) => ({ ...options, data }) },
    getServerSession: async () => ({ user: { role: 'admin' } }),
    authOptions: {},
    toStringId: (value) => value == null ? '' : String(value),
    canManageGameHistory: () => true,
    dbConnectGlobal: async () => ({ model: (name) => name === 'Games'
      ? { findById: () => query({ _id: 'game' }) }
      : { find: () => ({ sort: () => ({ select: (fields) => {
        projection = fields
        const modes = new Set(Object.entries(fields).filter(([key]) => key !== '_id').map(([, value]) => value))
        assert.equal(modes.size, 1, 'MongoDB запрещает смешивать включение и исключение полей')
        return { lean: async () => entries }
      } }) }) } }),
  }
  const GET = await loadHandler('../app/api/cabinet/games/[gameId]/history/route.js', 'GET', dependencies)
  const response = await GET({}, { params: Promise.resolve({ gameId: 'game' }) })
  assert.equal(response.status, 200)
  assert.equal(response.data.data[0].actor.name, 'Администратор')
  assert.equal(response.data.data[0].createdAt, '2026-10-01T15:13:03.102Z')
  assert.equal(response.data.data[0].canRollback, false)
  assert.equal(projection.actor, 1)
  assert.equal(projection.summary, 1)
  assert.equal(projection.snapshot, undefined)
  assert.equal(projection.before, undefined)
})
