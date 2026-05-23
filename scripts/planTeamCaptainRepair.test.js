const test = require('node:test')
const assert = require('node:assert/strict')

const planTeamCaptainRepair = require('../helpers/planTeamCaptainRepair')

test('promotes the earliest team member when a team has no captain', () => {
  const plan = planTeamCaptainRepair({
    teamId: 'team-1',
    memberships: [
      {
        _id: 'm-2',
        teamId: 'team-1',
        role: 'participant',
        createdAt: '2026-01-03T10:00:00.000Z',
      },
      {
        _id: 'm-1',
        teamId: 'team-1',
        role: 'participant',
        createdAt: '2026-01-01T10:00:00.000Z',
      },
    ],
  })

  assert.equal(plan.issueCode, 'no_captain')
  assert.equal(plan.promoteMembershipId, 'm-1')
  assert.deepEqual(plan.demoteMembershipIds, [])
})

test('keeps the earliest captain and demotes the rest when a team has duplicates', () => {
  const plan = planTeamCaptainRepair({
    teamId: 'team-1',
    memberships: [
      {
        _id: 'm-2',
        teamId: 'team-1',
        role: 'captain',
        createdAt: '2026-01-03T10:00:00.000Z',
      },
      {
        _id: 'm-1',
        teamId: 'team-1',
        role: 'captain',
        createdAt: '2026-01-01T10:00:00.000Z',
      },
      {
        _id: 'm-3',
        teamId: 'team-1',
        role: 'participant',
        createdAt: '2026-01-02T10:00:00.000Z',
      },
    ],
  })

  assert.equal(plan.issueCode, 'multiple_captains')
  assert.equal(plan.keepCaptainMembershipId, 'm-1')
  assert.deepEqual(plan.demoteMembershipIds, ['m-2'])
})

test('falls back to membership id ordering when createdAt is missing', () => {
  const plan = planTeamCaptainRepair({
    teamId: 'team-1',
    memberships: [
      { _id: 'm-9', teamId: 'team-1', role: 'participant' },
      { _id: 'm-1', teamId: 'team-1', role: 'participant' },
    ],
  })

  assert.equal(plan.promoteMembershipId, 'm-1')
})

test('returns ok when the team already has exactly one captain', () => {
  const plan = planTeamCaptainRepair({
    teamId: 'team-1',
    memberships: [
      { _id: 'm-1', teamId: 'team-1', role: 'captain' },
      { _id: 'm-2', teamId: 'team-1', role: 'participant' },
    ],
  })

  assert.equal(plan.issueCode, null)
  assert.equal(plan.promoteMembershipId, null)
  assert.deepEqual(plan.demoteMembershipIds, [])
})
