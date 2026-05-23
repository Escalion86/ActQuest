const test = require('node:test')
const assert = require('node:assert/strict')

const resolveTeamMembershipForIdentity = require('../helpers/resolveTeamMembershipForIdentity')

test('uses userId as the primary identity source', () => {
  const membership = resolveTeamMembershipForIdentity({
    teamUsers: [
      {
        _id: 'membership-user-primary',
        userId: 'user-1',
        userTelegramId: 999001,
        role: 'captain',
      },
      {
        _id: 'membership-telegram-legacy',
        userId: 'user-2',
        userTelegramId: 999001,
        role: 'participant',
      },
    ],
    userId: 'user-1',
    telegramId: 999001,
  })

  assert.equal(membership.isTeamMember, true)
  assert.equal(membership.isCaptain, true)
  assert.equal(membership.matchedBy, 'userId')
  assert.deepEqual(
    membership.matchedMemberships.map((item) => item._id),
    ['membership-user-primary'],
  )
})

test('falls back to telegramId only when no userId membership is found', () => {
  const membership = resolveTeamMembershipForIdentity({
    teamUsers: [
      {
        _id: 'membership-telegram-legacy',
        userId: '',
        userTelegramId: 777001,
        role: 'captain',
      },
    ],
    userId: 'missing-user',
    telegramId: 777001,
  })

  assert.equal(membership.isTeamMember, true)
  assert.equal(membership.isCaptain, true)
  assert.equal(membership.matchedBy, 'telegramId')
  assert.deepEqual(
    membership.matchedMemberships.map((item) => item._id),
    ['membership-telegram-legacy'],
  )
})

test('does not elevate privileges through telegram fallback when userId already matched', () => {
  const membership = resolveTeamMembershipForIdentity({
    teamUsers: [
      {
        _id: 'membership-user-primary',
        userId: 'user-1',
        userTelegramId: null,
        role: 'participant',
      },
      {
        _id: 'membership-telegram-legacy',
        userId: 'user-2',
        userTelegramId: 555123,
        role: 'captain',
      },
    ],
    userId: 'user-1',
    telegramId: 555123,
  })

  assert.equal(membership.isTeamMember, true)
  assert.equal(membership.isCaptain, false)
  assert.equal(membership.matchedBy, 'userId')
  assert.deepEqual(
    membership.matchedMemberships.map((item) => item._id),
    ['membership-user-primary'],
  )
})

test('treats any matched userId membership with captain role as captain', () => {
  const membership = resolveTeamMembershipForIdentity({
    teamUsers: [
      {
        _id: 'membership-user-1',
        userId: 'user-1',
        userTelegramId: null,
        role: 'participant',
      },
      {
        _id: 'membership-user-2',
        userId: 'user-1',
        userTelegramId: null,
        role: 'captain',
      },
    ],
    userId: 'user-1',
    telegramId: null,
  })

  assert.equal(membership.isTeamMember, true)
  assert.equal(membership.isCaptain, true)
  assert.equal(membership.matchedBy, 'userId')
  assert.deepEqual(
    membership.matchedMemberships.map((item) => item._id),
    ['membership-user-1', 'membership-user-2'],
  )
})
