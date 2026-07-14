import test from 'node:test'
import assert from 'node:assert/strict'

import buildGameResultComputed from '../server/buildGameResultComputed.js'

const buildBaseGame = (type = 'classic') => ({
  _id: 'game-1',
  type,
  taskDuration: 60,
  taskFailurePenalty: 0,
  manyCodesPenalty: [0, 0],
  tasks: [
    {
      _id: 'task-1',
      title: 'Задание 1',
      canceled: false,
      isBonusTask: false,
      penaltyCodes: [],
      bonusCodes: [],
    },
  ],
  result: {
    teams: [{ _id: 'team-1', name: 'Альфа' }],
    gameTeams: [
      {
        teamId: 'team-1',
        activeNum: 1,
        startTime: [new Date('2026-05-26T00:00:00.000Z')],
        endTime: [new Date('2026-05-26T00:00:30.000Z')],
        wrongCodes: [[]],
        findedPenaltyCodes: [[]],
        findedBonusCodes: [[]],
        timeAddings: [],
        prequelProgress: {
          foundBonusCodes: ['BONUS'],
          foundPenaltyCodes: ['PENALTY'],
          appliedAdjustments: [
            {
              id: 'a1',
              type: 'bonus',
              source: 'bonus_code',
              code: 'BONUS',
              value: type === 'photo' ? 5 : 10,
            },
            {
              id: 'a2',
              type: 'penalty',
              source: 'wrong_attempts_limit',
              code: '',
              value: type === 'photo' ? 2 : 4,
            },
          ],
          appliedStoryEffects:
            type === 'story'
              ? [
                  {
                    id: 'e1',
                    type: 'unlock_node',
                    nodeId: 'node-1',
                    source: 'bonus_code',
                    code: 'BONUS',
                  },
                ]
              : [],
        },
      },
    ],
    teamsUsers: [{ teamId: 'team-1', userId: 'user-1' }],
  },
  prequel: {
    enabled: true,
    bonusCodes: [{ id: 'b1', code: 'BONUS', value: type === 'photo' ? 5 : 10 }],
    penaltyCodes: [{ id: 'p1', code: 'PENALTY', value: type === 'photo' ? 3 : 6 }],
    wrongAttemptsLimit: 2,
    wrongAttemptsPenalty: type === 'photo' ? 2 : 4,
  },
})

test('buildGameResultComputed includes classic prequel time adjustments', async () => {
  const result = await buildGameResultComputed({ game: buildBaseGame('classic') })
  const team = result.computed.teams[0]

  assert.equal(team.prequel.enabled, true)
  assert.equal(team.prequel.bonusValue, 10)
  assert.equal(team.prequel.wrongPenaltyValue, 4)
  assert.equal(team.finalSeconds, 24)
})

test('buildGameResultComputed includes photo prequel point adjustments', async () => {
  const result = await buildGameResultComputed({ game: buildBaseGame('photo') })
  const team = result.computed.teams[0]

  assert.equal(team.prequel.enabled, true)
  assert.equal(team.prequel.bonusValue, 5)
  assert.equal(team.prequel.wrongPenaltyValue, 2)
  assert.equal(team.finalPoints, 3)
})

test('buildGameResultComputed preserves story prequel effects in computed', async () => {
  const result = await buildGameResultComputed({ game: buildBaseGame('story') })
  const team = result.computed.teams[0]

  assert.deepEqual(result.teamsPlaces, {})
  assert.equal(result.computed.summary.scoringMode, 'story')
  assert.equal(team.place, null)
  assert.equal(Array.isArray(team.prequel.storyEffects), true)
  assert.equal(team.prequel.storyEffects.length, 1)
  assert.equal(team.prequel.storyEffects[0].type, 'unlock_node')
})

test('buildGameResultComputed exposes story ending, score and duration without places', async () => {
  const game = buildBaseGame('story')
  game.storyNodes = [{ id: 'node-1' }, { id: 'node-2' }]
  game.storyEndings = [
    {
      id: 'ending-1',
      title: 'Спасение',
      type: 'success',
      descriptionRich: '<p>Город спасён</p>',
    },
  ]
  game.result.gameTeams[0].storyProgress = {
    status: 'completed',
    startedAt: new Date('2026-05-26T00:00:00.000Z'),
    finishedAt: new Date('2026-05-26T00:10:00.000Z'),
    currentEndingId: 'ending-1',
    score: 42,
    completedNodeIds: ['node-1', 'node-2'],
    usedClueIds: ['clue-1'],
    inventory: [
      { itemId: 'key', status: 'active' },
      { itemId: 'coin', status: 'consumed' },
    ],
  }

  const result = await buildGameResultComputed({ game })
  const team = result.computed.teams[0]

  assert.deepEqual(result.teamsPlaces, {})
  assert.equal(team.score, 42)
  assert.equal(team.durationSeconds, 600)
  assert.equal(team.completedNodesCount, 2)
  assert.equal(team.usedCluesCount, 1)
  assert.equal(team.ending.title, 'Спасение')
})
