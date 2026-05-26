import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildWebUserBanPreview,
  applyWebUserBan,
} from '../server/webUserBan.js'
import {
  canCreateTeamForRole,
  canJoinTeamForRole,
  canAddTargetUserToTeam,
} from '../helpers/teamBanAccess.js'

const createFakeCollection = (items, key = '_id') => {
  const state = items.map((item) => ({ ...item }))

  const matchValue = (value, expected) => {
    if (expected && typeof expected === 'object' && '$ne' in expected) {
      return value !== expected.$ne
    }

    if (expected && typeof expected === 'object' && '$in' in expected) {
      return expected.$in.includes(value)
    }

    if (expected && typeof expected === 'object' && '$or' in expected) {
      return expected.$or.some((condition) => matches(value, condition))
    }

    return value === expected
  }

  const matches = (item, query = {}) =>
    Object.entries(query).every(([field, expected]) => {
      if (field === '$or') {
        return expected.some((condition) => matches(item, condition))
      }

      return matchValue(item?.[field], expected)
    })

  const pickFields = (item, projection) => {
    if (!projection) {
      return { ...item }
    }

    const selected = {}
    for (const [field, enabled] of Object.entries(projection)) {
      if (enabled) {
        selected[field] = item?.[field]
      }
    }
    return selected
  }

  const chain = (itemsToReturn) => ({
    select(projection) {
      const selected = itemsToReturn.map((item) => pickFields(item, projection))
      return chain(selected)
    },
    lean() {
      return Promise.resolve(itemsToReturn.map((item) => ({ ...item })))
    },
  })

  const singleChain = (itemToReturn) => ({
    select(projection) {
      if (!itemToReturn) {
        return singleChain(null)
      }
      return singleChain(pickFields(itemToReturn, projection))
    },
    lean() {
      return Promise.resolve(itemToReturn ? { ...itemToReturn } : null)
    },
  })

  return {
    state,
    find(query = {}) {
      return chain(state.filter((item) => matches(item, query)))
    },
    findOne(query = {}) {
      return singleChain(state.find((item) => matches(item, query)) ?? null)
    },
    findById(id) {
      return singleChain(state.find((item) => item?.[key] === id) ?? null)
    },
    async findByIdAndUpdate(id, update) {
      const index = state.findIndex((item) => item?.[key] === id)
      if (index === -1) {
        return null
      }

      if (update?.$set && typeof update.$set === 'object') {
        state[index] = { ...state[index], ...update.$set }
      } else {
        state[index] = { ...state[index], ...update }
      }

      return { ...state[index] }
    },
    async updateMany(query, update) {
      let modifiedCount = 0
      for (let index = 0; index < state.length; index += 1) {
        if (!matches(state[index], query)) {
          continue
        }
        modifiedCount += 1
        if (update?.$set && typeof update.$set === 'object') {
          state[index] = { ...state[index], ...update.$set }
        }
      }
      return { modifiedCount }
    },
    async deleteOne(query) {
      const index = state.findIndex((item) => matches(item, query))
      if (index === -1) {
        return { deletedCount: 0 }
      }
      state.splice(index, 1)
      return { deletedCount: 1 }
    },
    async deleteMany(query) {
      const nextState = state.filter((item) => !matches(item, query))
      const deletedCount = state.length - nextState.length
      state.splice(0, state.length, ...nextState)
      return { deletedCount }
    },
  }
}

const createFakeDb = () => {
  const collections = {
    Users: createFakeCollection([
      { _id: 'user-1', role: 'client', name: 'Ban Candidate' },
      { _id: 'user-2', role: 'client', name: 'Teammate 1' },
      { _id: 'user-3', role: 'client', name: 'Teammate 2' },
    ]),
    Teams: createFakeCollection([
      { _id: 'team-1', name: 'Alpha' },
      { _id: 'team-2', name: 'Beta' },
      { _id: 'team-3', name: 'Gamma' },
    ]),
    TeamsUsers: createFakeCollection([
      {
        _id: 'membership-1',
        teamId: 'team-1',
        userId: 'user-1',
        role: 'participant',
        createdAt: '2026-05-20T10:00:00.000Z',
      },
      {
        _id: 'membership-2',
        teamId: 'team-1',
        userId: 'user-2',
        role: 'captain',
        createdAt: '2026-05-19T10:00:00.000Z',
      },
      {
        _id: 'membership-3',
        teamId: 'team-2',
        userId: 'user-1',
        role: 'captain',
        createdAt: '2026-05-18T10:00:00.000Z',
      },
      {
        _id: 'membership-4',
        teamId: 'team-2',
        userId: 'user-2',
        role: 'participant',
        createdAt: '2026-05-17T10:00:00.000Z',
      },
      {
        _id: 'membership-5',
        teamId: 'team-2',
        userId: 'user-3',
        role: 'participant',
        createdAt: '2026-05-16T10:00:00.000Z',
      },
      {
        _id: 'membership-6',
        teamId: 'team-3',
        userId: 'user-1',
        role: 'captain',
        createdAt: '2026-05-15T10:00:00.000Z',
      },
    ]),
  }

  return {
    model(name) {
      return collections[name]
    },
    collections,
  }
}

test('team ban access blocks banned users from team actions', () => {
  assert.equal(canCreateTeamForRole('ban'), false)
  assert.equal(canCreateTeamForRole('client'), true)

  assert.equal(canJoinTeamForRole('ban'), false)
  assert.equal(canJoinTeamForRole('admin'), true)

  assert.equal(canAddTargetUserToTeam({ actorRole: 'admin', targetRole: 'ban' }), false)
  assert.equal(
    canAddTargetUserToTeam({ actorRole: 'admin', targetRole: 'client' }),
    true,
  )
})

test('buildWebUserBanPreview returns transfer and delete consequences', async () => {
  const db = createFakeDb()

  const preview = await buildWebUserBanPreview({
    db,
    userId: 'user-1',
  })

  assert.equal(preview.user.id, 'user-1')
  assert.equal(preview.summary.teamsCount, 3)
  assert.equal(preview.summary.captainTeamsCount, 2)
  assert.equal(preview.summary.deletedTeamsCount, 1)
  assert.equal(preview.summary.transferTeamsCount, 1)

  const transferTeam = preview.teams.find((team) => team.teamId === 'team-2')
  assert.equal(transferTeam.action, 'transfer_captaincy')
  assert.equal(transferTeam.nextCaptain.userId, 'user-3')

  const deletedTeam = preview.teams.find((team) => team.teamId === 'team-3')
  assert.equal(deletedTeam.action, 'delete_team')
})

test('applyWebUserBan removes memberships, transfers captaincy and deletes empty team', async () => {
  const db = createFakeDb()

  const result = await applyWebUserBan({
    db,
    userId: 'user-1',
  })

  assert.equal(result.user.role, 'ban')

  const { Users, Teams, TeamsUsers } = db.collections

  assert.equal(Users.state.find((user) => user._id === 'user-1')?.role, 'ban')
  assert.equal(
    TeamsUsers.state.some((membership) => membership.userId === 'user-1'),
    false,
  )

  const transferredCaptain = TeamsUsers.state.find(
    (membership) => membership.teamId === 'team-2' && membership.userId === 'user-3',
  )
  assert.equal(transferredCaptain?.role, 'captain')

  assert.equal(
    Teams.state.some((team) => team._id === 'team-3'),
    false,
  )
})
