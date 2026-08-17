import test from 'node:test'
import assert from 'node:assert/strict'

import buildGameResultComputed from '../server/buildGameResultComputed.js'
import { getAllComputedResultTeams } from '../helpers/gameResultComputed.js'

test('counts mixed-case bonus and penalty codes in classic result', async () => {
  const game = {
    type: 'classic',
    taskDuration: 3600,
    dateStartFact: new Date('2026-07-15T12:00:00.000Z'),
    dateEndFact: new Date('2026-07-15T12:10:00.000Z'),
    tasks: [
      {
        title: 'Task',
        codes: ['MAIN'],
        penaltyCodes: [{ code: 'PeNaLtY', penalty: 60 }],
        bonusCodes: [{ code: 'BoNuS', bonus: 30 }],
      },
    ],
    result: {
      teams: [{ _id: 'team-1', name: 'Team' }],
      teamsUsers: [{ teamId: 'team-1' }],
      gameTeams: [
        {
          teamId: 'team-1',
          activeNum: 1,
          startTime: [new Date('2026-07-15T12:00:00.000Z')],
          endTime: [new Date('2026-07-15T12:05:00.000Z')],
          findedPenaltyCodes: [['penalty']],
          findedBonusCodes: [['bonus']],
          wrongCodes: [[]],
          timeAddings: [],
        },
      ],
    },
  }

  const result = await buildGameResultComputed({ game })
  const teamResult = result.computed.teams[0]

  assert.equal(teamResult.codePenaltySeconds, 60)
  assert.equal(teamResult.codeBonusSeconds, 30)
  assert.equal(teamResult.finalSeconds, 330)
})

test('does not apply photo task failure penalty to bonus tasks', async () => {
  const game = {
    type: 'photo',
    taskFailurePenalty: 10,
    tasks: [
      {
        title: 'Обычное задание',
        isBonusTask: false,
        penaltyCodes: [],
        bonusCodes: [],
      },
      {
        title: 'Бонусное задание',
        isBonusTask: true,
        penaltyCodes: [],
        bonusCodes: [],
      },
    ],
    result: {
      teams: [{ _id: 'team-1', name: 'Team' }],
      teamsUsers: [{ teamId: 'team-1' }],
      gameTeams: [
        {
          teamId: 'team-1',
          photos: [
            { checks: { accepted: false } },
            { checks: { accepted: false } },
          ],
          findedPenaltyCodes: [[], []],
          findedBonusCodes: [[], []],
          wrongCodes: [[], []],
          timeAddings: [],
        },
      ],
    },
  }

  const result = await buildGameResultComputed({ game })
  const teamResult = result.computed.teams[0]

  assert.equal(teamResult.failurePenaltyPoints, 10)
  assert.equal(teamResult.taskResults[0].failurePenaltyPoints, 10)
  assert.equal(teamResult.taskResults[1].failurePenaltyPoints, 0)
  assert.equal(teamResult.finalPoints, -10)
})

test('exposes computed data for ranked and out-of-competition teams to result UI', () => {
  const rankedTeam = { teamId: 'ranked-team', place: 1 }
  const outOfCompetitionTeam = { teamId: 'outside-team', place: null }

  assert.deepEqual(
    getAllComputedResultTeams({
      teams: [rankedTeam],
      outOfCompetitionTeams: [outOfCompetitionTeam],
    }),
    [rankedTeam, outOfCompetitionTeam],
  )
})
