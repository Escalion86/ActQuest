import test from 'node:test'
import assert from 'node:assert/strict'

import {
  canAccessGameAsModerator,
  canAccessGameAsAgent,
  canBypassGameAssignments,
  canViewAgentCabinet,
} from '../helpers/gameAssignmentAccess.js'

test('admin and dev bypass game assignment checks', () => {
  assert.equal(canBypassGameAssignments('admin'), true)
  assert.equal(canBypassGameAssignments('dev'), true)
  assert.equal(canBypassGameAssignments('client'), false)
  assert.equal(canBypassGameAssignments('moder'), false)
  assert.equal(canBypassGameAssignments('agent'), false)
})

test('game moderator access depends on explicit assignment in game', () => {
  const game = {
    moderators: [{ _id: 'moder-1' }],
  }

  assert.equal(
    canAccessGameAsModerator({
      userRole: 'client',
      currentUserId: 'moder-1',
      game,
    }),
    true,
  )

  assert.equal(
    canAccessGameAsModerator({
      userRole: 'client',
      currentUserId: 'outsider',
      game,
    }),
    false,
  )
})

test('game agent access depends on explicit assignment in game', () => {
  const game = {
    agents: [{ userId: 'agent-1', active: true }],
  }

  assert.equal(
    canAccessGameAsAgent({
      userRole: 'client',
      currentUserId: 'agent-1',
      game,
    }),
    true,
  )

  assert.equal(
    canAccessGameAsAgent({
      userRole: 'client',
      currentUserId: 'outsider',
      game,
    }),
    false,
  )
})

test('assignment flags do not grant game access by themselves', () => {
  const game = {
    moderators: [],
    agents: [],
  }

  assert.equal(
    canAccessGameAsModerator({
      userRole: 'client',
      currentUserId: 'candidate-1',
      game,
      userCanBeGameModerator: true,
    }),
    false,
  )

  assert.equal(
    canAccessGameAsAgent({
      userRole: 'client',
      currentUserId: 'candidate-2',
      game,
      userCanBeGameAgent: true,
    }),
    false,
  )
})

test('agent cabinet is available to authenticated users and protected by api checks', () => {
  assert.equal(canViewAgentCabinet('client'), true)
  assert.equal(canViewAgentCabinet('admin'), true)
  assert.equal(canViewAgentCabinet('dev'), true)
})
