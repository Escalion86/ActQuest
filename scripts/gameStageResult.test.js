import assert from 'node:assert/strict'
import test from 'node:test'
import buildGameStageResult, { compareGameStageHintRules, compareGameStageTasks } from '../server/buildGameStageResult.js'

const row = (teamId, finalSeconds, outOfCompetition = false) => ({
  teamId, finalSeconds, outOfCompetition, teamName: `Команда ${teamId}`,
})

const game = (id, teams, options = {}) => ({
  _id: id,
  name: `Проведение ${id}`,
  type: 'classic',
  location: 'ekb',
  seasonId: '2026',
  status: 'closed',
  taskDuration: 3600,
  tasks: [{ _id: `task-${id}`, title: 'Задание', codes: ['код'] }],
  result: {
    computed: {
      summary: { scoringMode: 'time' },
      teams: teams.filter((team) => !team.outOfCompetition),
      outOfCompetitionTeams: teams.filter((team) => team.outOfCompetition),
    },
    teamsUsers: teams.map((team) => ({ teamId: team.teamId, userId: `user-${team.teamId}` })),
  },
  ...options,
})

test('номер первой досрочной подсказки виден в предупреждении и сохраняет общий зачёт', async () => {
  const first = game('a', [row('a1', 142)], { allowCaptainForceClue: true, clueEarlyAccessFrom: 1 })
  const second = game('b', [row('b1', 139)], { allowCaptainForceClue: true, clueEarlyAccessFrom: 2 })

  assert.deepEqual((await buildGameStageResult([first, second])).teamsPlaces, { b1: 1, a1: 2 })
  const [difference] = compareGameStageHintRules([first, second])
  assert.equal(difference.gameId, 'b')
  assert.equal(difference.referenceValue, 'с подсказки №1')
  assert.equal(difference.value, 'с подсказки №2')
  assert.deepEqual(compareGameStageHintRules([{ ...first, allowCaptainForceClue: false }, second]), [])
  await assert.rejects(buildGameStageResult([first, { ...second, clueEarlyAccessMode: 'penalty' }]), /режим раннего доступа/)
})

test('пересчитывает места и очки трёх проведений по общему времени', async () => {
  const result = await buildGameStageResult([
    game('a', [row('a1', 142), row('a2', 170)]),
    game('b', [row('b1', 139), row('b2', 184), row('extra', 120, true)]),
    game('c', [row('c1', 147), row('c2', 157)]),
  ])

  assert.deepEqual(result.sourceGameIds, ['a', 'b', 'c'])
  assert.deepEqual(result.teamsPlaces, { b1: 1, a1: 2, c1: 3, c2: 4, a2: 5, b2: 6 })
  assert.deepEqual(result.rows.map((team) => team.score ?? null), [100, 80, 60, 40, 20, 0, null])
  assert.equal(result.rows[1].sourceGameId, 'a')
  assert.equal(result.rows.at(-1).place, null)
  assert.equal(result.teamsUsers.length, 7)
})

test('отменённая дата не входит в зачёт, а незакрытая блокирует публикацию', async () => {
  const closed = game('a', [row('a1', 142)])
  const canceled = game('b', [row('a1', 139)], { status: 'canceled' })
  const upcoming = game('c', [row('c1', 174)], { status: 'active' })

  assert.deepEqual((await buildGameStageResult([closed, canceled])).sourceGameIds, ['a'])
  await assert.rejects(buildGameStageResult([closed, upcoming]), /закройте все/i)
})

test('отклоняет повторное участие команды или игрока', async () => {
  const first = game('a', [row('a1', 142)])
  await assert.rejects(buildGameStageResult([first, game('b', [row('a1', 139)])]), /команда.*встречается/i)

  const second = game('b', [row('b1', 139)])
  second.result.teamsUsers[0].userId = first.result.teamsUsers[0].userId
  await assert.rejects(buildGameStageResult([first, second]), /игроков участвовал/i)
})

test('сравнивает содержимое заданий по порядку, игнорируя служебные ID и ключи', () => {
  const tasks = (gameId) => ['Старый мост', 'Фонтан', 'Станция'].map((title, index) => ({
    _id: `${gameId}-task-${index}`,
    stageKey: `${gameId}-stage-${index}`,
    title,
    codes: [`код ${index}`],
    clues: [{ _id: `${gameId}-clue-${index}`, clue: `подсказка ${index}` }],
  }))
  const reference = game('a', [row('a1', 142)], {
    dateStart: '2026-10-02T12:00:00.000Z',
    tasks: tasks('a'),
  })
  const unchanged = game('b', [row('b1', 139)], {
    dateStart: '2026-10-03T12:00:00.000Z',
    tasks: tasks('b'),
  })
  assert.deepEqual(compareGameStageTasks([reference, unchanged]), [])

  const changed = game('c', [row('c1', 140)], {
    dateStart: '2026-10-04T12:00:00.000Z',
    tasks: tasks('c'),
  })
  changed.tasks[0].title = 'Страый мост'
  changed.tasks[1].codes = ['исправленный код']
  changed.tasks.push({ title: 'Запасное задание' })
  const shortened = game('d', [row('d1', 141)], {
    dateStart: '2026-10-05T12:00:00.000Z',
    tasks: tasks('d').slice(0, 2),
  })

  const [changedWarning, shortenedWarning] = compareGameStageTasks([
    reference, unchanged, changed, shortened,
  ])
  assert.equal(changedWarning.gameId, 'c')
  assert.equal(changedWarning.gameName, changed.name)
  assert.equal(new Date(changedWarning.dateStart).toISOString(), changed.dateStart)
  assert.equal(changedWarning.referenceGameId, 'a')
  assert.equal(changedWarning.referenceGameName, reference.name)
  assert.equal(new Date(changedWarning.referenceDateStart).toISOString(), reference.dateStart)
  assert.deepEqual(changedWarning.tasks.map(({ number, kind }) => [number, kind]), [
    [1, 'changed'], [2, 'changed'], [4, 'added'],
  ])
  assert.equal(changedWarning.tasks[0].referenceTitle, 'Старый мост')
  assert.equal(changedWarning.tasks[0].title, 'Страый мост')
  assert.equal(changedWarning.tasks[1].referenceTitle, 'Фонтан')
  assert.equal(changedWarning.tasks[1].title, 'Фонтан')
  assert.equal(changedWarning.tasks[2].title, 'Запасное задание')
  assert.equal(shortenedWarning.gameId, 'd')
  assert.deepEqual(shortenedWarning.tasks.map(({ number, kind }) => [number, kind]), [[3, 'removed']])
  assert.equal(shortenedWarning.tasks[0].referenceTitle, 'Станция')
})

test('сравнивает описание приквела, сохраняя проверку бонусов и штрафов', async () => {
  const prequel = (id, {
    description = 'Подпись бонуса',
    bonus = 30,
    penalty = 15,
  } = {}) => ({
    id: `${id}-prequel`,
    title: 'Разминка',
    enabled: true,
    mode: 'multi_hit',
    bonusCodes: [{
      id: `${id}-bonus`,
      code: 'разминка',
      description,
      value: bonus,
    }],
    penaltyCodes: [{
      id: `${id}-penalty`,
      code: 'неверный ответ',
      value: penalty,
    }],
  })
  const first = game('a', [row('a1', 142)], { prequels: [prequel('a')] })
  const identical = game('b', [row('b1', 139)], { prequels: [prequel('b')] })
  assert.deepEqual(compareGameStageTasks([first, identical]), [])
  assert.deepEqual((await buildGameStageResult([first, identical])).teamsPlaces, { b1: 1, a1: 2 })

  const changedText = game('b', [row('b1', 139)], {
    prequels: [prequel('b', { description: 'Исправленная подпись бонуса' })],
  })
  const [warning] = compareGameStageTasks([first, changedText])
  assert.equal(warning.gameId, 'b')
  assert.equal(warning.tasks.length, 1)
  assert.equal(warning.tasks[0].section, 'prequel')
  assert.equal(warning.tasks[0].number, 1)
  assert.equal(warning.tasks[0].kind, 'changed')
  assert.equal(warning.tasks[0].referenceTitle, 'Разминка')
  assert.equal(warning.tasks[0].title, 'Разминка')
  assert.deepEqual((await buildGameStageResult([first, changedText])).teamsPlaces, { b1: 1, a1: 2 })

  for (const changed of [{ bonus: 60 }, { penalty: 45 }]) {
    const second = game('b', [row('b1', 139)], { prequels: [prequel('b', changed)] })
    await assert.rejects(buildGameStageResult([first, second]), /правила приквела/i)
  }
})

test('объединяет полные результаты при отличиях заданий', async () => {
  const first = game('a', [row('a1', 142), row('a2', 160)])
  const second = game('b', [row('b1', 139), row('b2', 155)], {
    tasks: [{ title: 'Другое задание', codes: ['другой код'] }, { title: 'Дополнение' }],
  })

  assert.equal(compareGameStageTasks([first, second]).length, 1)
  const result = await buildGameStageResult([first, second])
  assert.deepEqual(result.teamsPlaces, { b1: 1, a1: 2, b2: 3, a2: 4 })
  assert.deepEqual(result.rows.map((team) => team.score), [100, 200 / 3, 100 / 3, 0])
  assert.equal(result.teamsUsers.length, 4)
})

test('различия правил, города и сезона блокируют общий зачёт', async () => {
  const first = game('a', [row('a1', 142)], { breakDuration: 120 })
  const second = game('b', [row('b1', 139)], { breakDuration: 120 })
  const mismatches = [
    [{ taskDuration: 1200 }, /длительность задания/i],
    [{ breakDuration: 240 }, /перерыв/i],
    [{ location: 'nsk' }, /город/i],
    [{ seasonId: '2027' }, /сезон/i],
    [{ isRated: false }, /рейтинг/i],
    [{ participationMode: 'player' }, /участи/i],
    [{ type: 'photo' }, /тип/i],
  ]

  for (const [change, message] of mismatches) {
    await assert.rejects(buildGameStageResult([first, { ...second, ...change }]), message)
  }
})

test('исторических мест недостаточно для восстановления результата', async () => {
  const first = game('a', [row('a1', 142)], { result: { teamsPlaces: { a1: 1 } } })
  await assert.rejects(buildGameStageResult([first, game('b', [row('b1', 139)])]), /сохранённые результаты или снимки/)
})
