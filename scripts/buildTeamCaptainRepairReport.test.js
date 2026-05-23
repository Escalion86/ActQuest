const test = require('node:test')
const assert = require('node:assert/strict')

const buildTeamCaptainRepairReport = require('../helpers/buildTeamCaptainRepairReport')

test('builds repair plans for teams without captain and with duplicate captains', () => {
  const report = buildTeamCaptainRepairReport({
    teams: [
      { _id: 'team-1', name: 'Alpha', location: 'krsk' },
      { _id: 'team-2', name: 'Beta', location: 'nrsk' },
    ],
    users: [
      { _id: 'user-1', name: 'Ivan', username: 'ivan' },
      { _id: 'user-2', name: 'Petr', username: 'petr' },
      { _id: 'user-3', name: 'Olga', username: 'olga' },
    ],
    memberships: [
      {
        _id: 'm-1',
        teamId: 'team-1',
        userId: 'user-1',
        role: 'participant',
        createdAt: '2026-01-01T10:00:00.000Z',
      },
      {
        _id: 'm-2',
        teamId: 'team-1',
        userId: 'user-2',
        role: 'participant',
        createdAt: '2026-01-02T10:00:00.000Z',
      },
      {
        _id: 'm-3',
        teamId: 'team-2',
        userId: 'user-2',
        role: 'captain',
        createdAt: '2026-01-01T10:00:00.000Z',
      },
      {
        _id: 'm-4',
        teamId: 'team-2',
        userId: 'user-3',
        role: 'captain',
        createdAt: '2026-01-03T10:00:00.000Z',
      },
    ],
    limit: 20,
  })

  assert.equal(report.summary.teamsToRepairCount, 2)
  assert.equal(report.summary.noCaptainTeamsCount, 1)
  assert.equal(report.summary.multipleCaptainsTeamsCount, 1)
  assert.equal(report.plans[0].teamId, 'team-1')
  assert.equal(report.plans[0].promoteMembershipId, 'm-1')
  assert.equal(report.plans[0].promoteMember?.userName, 'Ivan')
  assert.equal(report.plans[1].teamId, 'team-2')
  assert.equal(report.plans[1].keepCaptainMembershipId, 'm-3')
  assert.deepEqual(report.plans[1].demoteMembershipIds, ['m-4'])
})

test('applies limit and reports truncation', () => {
  const report = buildTeamCaptainRepairReport({
    teams: [
      { _id: 'team-1', name: 'Alpha' },
      { _id: 'team-2', name: 'Beta' },
    ],
    memberships: [
      { _id: 'm-1', teamId: 'team-1', role: 'participant' },
      { _id: 'm-2', teamId: 'team-2', role: 'participant' },
    ],
    users: [],
    limit: 1,
  })

  assert.equal(report.summary.teamsToRepairCount, 2)
  assert.equal(report.summary.truncated, true)
  assert.equal(report.summary.plansReturnedCount, 1)
  assert.equal(report.plans.length, 1)
})
