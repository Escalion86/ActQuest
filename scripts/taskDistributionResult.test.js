import test from 'node:test'
import assert from 'node:assert/strict'

import buildGameResultComputed from '../server/buildGameResultComputed.js'

test('result task columns stay bound to source task indexes with custom sequence', async () => {
  const result = await buildGameResultComputed({
    game: {
      _id: 'game-1',
      type: 'classic',
      taskDuration: 60,
      taskFailurePenalty: 0,
      manyCodesPenalty: [0, 0],
      tasks: [
        { _id: 'task-1', title: 'Первое', penaltyCodes: [], bonusCodes: [] },
        { _id: 'task-2', title: 'Второе', penaltyCodes: [], bonusCodes: [] },
        { _id: 'task-3', title: 'Третье', penaltyCodes: [], bonusCodes: [] },
      ],
      result: {
        teams: [{ _id: 'team-1', name: 'Команда' }],
        gameTeams: [
          {
            teamId: 'team-1',
            activeNum: 2,
            taskSequence: [1, 0, 2],
            startTime: [
              new Date('2026-01-01T00:00:30.000Z'),
              new Date('2026-01-01T00:00:00.000Z'),
              null,
            ],
            endTime: [
              new Date('2026-01-01T00:01:10.000Z'),
              new Date('2026-01-01T00:00:20.000Z'),
              null,
            ],
            wrongCodes: [[], [], []],
            findedPenaltyCodes: [[], [], []],
            findedBonusCodes: [[], [], []],
            timeAddings: [],
          },
        ],
        teamsUsers: [{ teamId: 'team-1', userId: 'user-1' }],
      },
    },
  })

  const team = result.computed.teams[0]

  assert.deepEqual(team.taskSequence, [1, 0, 2])
  assert.equal(team.taskResults[0].taskTitle, 'Первое')
  assert.equal(team.taskResults[0].seconds, 40)
  assert.equal(team.taskResults[1].taskTitle, 'Второе')
  assert.equal(team.taskResults[1].seconds, 20)
  assert.equal(team.taskResults[2].taskTitle, 'Третье')
  assert.equal(team.taskResults[2].status, 'in_progress')
})
