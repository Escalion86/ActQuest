const test = require('node:test')
const assert = require('node:assert/strict')

const planTeamMembershipRoleUpdate = require('../helpers/planTeamMembershipRoleUpdate')

test('prevents demoting the sole captain to participant', () => {
  const result = planTeamMembershipRoleUpdate({
    membershipId: 'captain-1',
    nextRole: 'participant',
    memberships: [
      { _id: 'captain-1', role: 'captain' },
      { _id: 'participant-1', role: 'participant' },
    ],
  })

  assert.equal(result.ok, false)
  assert.equal(result.code, 'captain_required')
})

test('promoting a member to captain demotes the previous captain', () => {
  const result = planTeamMembershipRoleUpdate({
    membershipId: 'participant-1',
    nextRole: 'captain',
    memberships: [
      { _id: 'captain-1', role: 'captain' },
      { _id: 'participant-1', role: 'participant' },
    ],
  })

  assert.equal(result.ok, true)
  assert.equal(result.nextRole, 'captain')
  assert.deepEqual(result.demoteCaptainIds, ['captain-1'])
})

test('promoting a member to captain demotes every other captain duplicate', () => {
  const result = planTeamMembershipRoleUpdate({
    membershipId: 'participant-1',
    nextRole: 'captain',
    memberships: [
      { _id: 'captain-1', role: 'captain' },
      { _id: 'captain-legacy', role: 'captain' },
      { _id: 'participant-1', role: 'participant' },
    ],
  })

  assert.equal(result.ok, true)
  assert.deepEqual(result.demoteCaptainIds, ['captain-1', 'captain-legacy'])
})

test('assigning liaison demotes every other liaison', () => {
  const result = planTeamMembershipRoleUpdate({
    membershipId: 'liaison-2',
    nextRole: 'liaison',
    memberships: [
      { _id: 'captain-1', role: 'captain' },
      { _id: 'liaison-1', role: 'liaison' },
      { _id: 'liaison-2', role: 'participant' },
    ],
  })

  assert.equal(result.ok, true)
  assert.deepEqual(result.demoteLiaisonIds, ['liaison-1'])
})
