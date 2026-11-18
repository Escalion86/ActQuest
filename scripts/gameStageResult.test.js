import assert from 'node:assert/strict'
import test from 'node:test'
import buildGameStageResult from '../server/buildGameStageResult.js'

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

test('отклоняет разные регламенты и повторное участие', async () => {
  const first = game('a', [row('a1', 142)])
  await assert.rejects(buildGameStageResult([first, game('b', [row('b1', 139)], {
    taskDuration: 1200,
  })]), /отличаются задания, правила, город или сезон/)
  await assert.rejects(buildGameStageResult([first, game('b', [row('a1', 139)])]), /команда.*встречается/i)

  const second = game('b', [row('b1', 139)])
  second.result.teamsUsers[0].userId = first.result.teamsUsers[0].userId
  await assert.rejects(buildGameStageResult([first, second]), /игроков участвовал/i)
})

test('исторических мест недостаточно для восстановления результата', async () => {
  const first = game('a', [row('a1', 142)], { result: { teamsPlaces: { a1: 1 } } })
  await assert.rejects(buildGameStageResult([first, game('b', [row('b1', 139)])]), /сохранённые результаты или снимки/)
})
