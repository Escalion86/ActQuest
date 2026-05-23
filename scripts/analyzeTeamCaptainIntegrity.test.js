const test = require('node:test')
const assert = require('node:assert/strict')

const analyzeTeamCaptainIntegrity = require('../helpers/analyzeTeamCaptainIntegrity')

test('does not report a team with exactly one captain', () => {
  const result = analyzeTeamCaptainIntegrity({
    teams: [{ _id: 'team-1', name: 'Alpha' }],
    memberships: [
      { _id: 'm-1', teamId: 'team-1', userId: 'user-1', role: 'captain' },
      { _id: 'm-2', teamId: 'team-1', userId: 'user-2', role: 'participant' },
    ],
    users: [{ _id: 'user-1', name: 'Ivan' }, { _id: 'user-2', name: 'Petr' }],
  })

  assert.equal(result.summary.teamsCheckedCount, 1)
  assert.equal(result.summary.teamsWithIssuesCount, 0)
  assert.deepEqual(result.teamsWithIssues, [])
})

test('reports a team without a captain', () => {
  const result = analyzeTeamCaptainIntegrity({
    teams: [{ _id: 'team-1', name: 'Alpha' }],
    memberships: [
      { _id: 'm-1', teamId: 'team-1', userId: 'user-1', role: 'participant' },
      { _id: 'm-2', teamId: 'team-1', userId: 'user-2', role: 'participant' },
    ],
    users: [{ _id: 'user-1', name: 'Ivan' }, { _id: 'user-2', name: 'Petr' }],
  })

  assert.equal(result.summary.noCaptainTeamsCount, 1)
  assert.equal(result.summary.multipleCaptainsTeamsCount, 0)
  assert.equal(result.teamsWithIssues[0].issueCode, 'no_captain')
  assert.equal(result.teamsWithIssues[0].captainCount, 0)
})

test('reports a team with multiple captains including legacy captain role', () => {
  const result = analyzeTeamCaptainIntegrity({
    teams: [{ _id: 'team-1', name: 'Alpha' }],
    memberships: [
      { _id: 'm-1', teamId: 'team-1', userId: 'user-1', role: 'captain' },
      { _id: 'm-2', teamId: 'team-1', userId: 'user-2', role: 'captain' },
      { _id: 'm-3', teamId: 'team-1', userId: 'user-3', role: 'participant' },
    ],
    users: [
      { _id: 'user-1', name: 'Ivan' },
      { _id: 'user-2', name: 'Petr' },
      { _id: 'user-3', name: 'Olga' },
    ],
  })

  assert.equal(result.summary.noCaptainTeamsCount, 0)
  assert.equal(result.summary.multipleCaptainsTeamsCount, 1)
  assert.equal(result.teamsWithIssues[0].issueCode, 'multiple_captains')
  assert.equal(result.teamsWithIssues[0].captainCount, 2)
  assert.deepEqual(
    result.teamsWithIssues[0].captains.map((item) => item.membershipId),
    ['m-1', 'm-2'],
  )
})

test('ignores memberships without teamId when building team issues', () => {
  const result = analyzeTeamCaptainIntegrity({
    teams: [{ _id: 'team-1', name: 'Alpha' }],
    memberships: [
      { _id: 'm-1', teamId: '', userId: 'user-1', role: 'captain' },
      { _id: 'm-2', teamId: 'team-1', userId: 'user-2', role: 'captain' },
    ],
    users: [{ _id: 'user-2', name: 'Petr' }],
  })

  assert.equal(result.summary.teamsCheckedCount, 1)
  assert.equal(result.summary.teamsWithIssuesCount, 0)
})
