import test from 'node:test'
import assert from 'node:assert/strict'

import buildGameResultComputed from '../server/buildGameResultComputed.js'

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
