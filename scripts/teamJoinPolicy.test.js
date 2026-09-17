import assert from 'node:assert/strict'
import test from 'node:test'

import {
  TEAM_JOIN_POLICY_CLOSED,
  TEAM_JOIN_POLICY_OPEN,
  TEAM_JOIN_POLICY_REQUEST,
  getTeamJoinPolicyLabel,
  normalizeTeamJoinPolicy,
  teamAcceptsJoinRequests,
  teamCanBeJoinedById,
} from '../helpers/teamJoinPolicy.js'

test('отсутствующая политика вступления считается открытой', () => {
  assert.equal(normalizeTeamJoinPolicy(undefined), TEAM_JOIN_POLICY_OPEN)
  assert.equal(normalizeTeamJoinPolicy(null), TEAM_JOIN_POLICY_OPEN)
  assert.equal(normalizeTeamJoinPolicy('unknown'), TEAM_JOIN_POLICY_OPEN)
})

test('поддерживаются три политики вступления', () => {
  assert.equal(normalizeTeamJoinPolicy(' OPEN '), TEAM_JOIN_POLICY_OPEN)
  assert.equal(normalizeTeamJoinPolicy('request'), TEAM_JOIN_POLICY_REQUEST)
  assert.equal(normalizeTeamJoinPolicy('closed'), TEAM_JOIN_POLICY_CLOSED)

  assert.equal(teamCanBeJoinedById(TEAM_JOIN_POLICY_OPEN), true)
  assert.equal(teamCanBeJoinedById(TEAM_JOIN_POLICY_REQUEST), true)
  assert.equal(teamCanBeJoinedById(TEAM_JOIN_POLICY_CLOSED), false)
  assert.equal(teamAcceptsJoinRequests(TEAM_JOIN_POLICY_OPEN), false)
  assert.equal(teamAcceptsJoinRequests(TEAM_JOIN_POLICY_REQUEST), true)
  assert.equal(getTeamJoinPolicyLabel(TEAM_JOIN_POLICY_REQUEST), 'По заявке')
})
